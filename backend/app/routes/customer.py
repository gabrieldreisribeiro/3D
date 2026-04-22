import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.core.security import (
    create_customer_token,
    get_db,
    hash_password,
    require_customer,
    verify_password,
)
from app.models import CustomerAccount, CustomerPasswordResetToken, Order, OrderStageHistory
from app.schemas import (
    CustomerAccountResponse,
    CustomerAuthResponse,
    CustomerChangePasswordRequest,
    CustomerForgotPasswordRequest,
    CustomerForgotPasswordResponse,
    CustomerLinkLegacyOrdersResponse,
    CustomerLoginRequest,
    CustomerOrderListItem,
    CustomerOrderListResponse,
    CustomerRegisterRequest,
    CustomerResetPasswordRequest,
    CustomerUpdateProfileRequest,
    OrderResponse,
)
from app.services.customer_identity_service import normalize_email, normalize_phone
from app.services.email_service import send_account_created_email, send_password_reset_email
from app.services.order_flow_service import build_customer_order_timeline, ensure_default_order_flow_stages, ensure_order_has_stage
from app.services.order_service import serialize_order
from app.services.system_log_service import log_custom_event_safely

router = APIRouter(prefix='/customer', tags=['customer'])


def _normalize_email(value: str | None) -> str | None:
    return normalize_email(value)


def _normalize_phone(value: str | None) -> str | None:
    return normalize_phone(value)


def _serialize_customer(customer: CustomerAccount) -> CustomerAccountResponse:
    return CustomerAccountResponse(
        id=customer.id,
        full_name=customer.full_name,
        email=customer.email,
        phone_number=customer.phone_number,
        is_active=bool(customer.is_active),
        created_at=customer.created_at,
        updated_at=customer.updated_at,
        last_login_at=customer.last_login_at,
    )


def _link_legacy_orders(db: Session, customer: CustomerAccount, origin: str = 'auto_link') -> int:
    phone = _normalize_phone(customer.phone_number)
    email = _normalize_email(customer.email)
    if not phone and not email:
        return 0
    query = db.query(Order).filter(Order.customer_account_id.is_(None))
    conditions = []
    if phone:
        conditions.append(Order.customer_phone_snapshot == phone)
    if email:
        conditions.append(Order.customer_email_snapshot == email)
    if not conditions:
        return 0
    rows = query.filter(or_(*conditions)).all()
    linked_ids = [int(row.id) for row in rows]
    for row in rows:
        row.customer_account_id = customer.id
        if not row.customer_name:
            row.customer_name = customer.full_name
    if rows:
        db.commit()
        log_custom_event_safely(
            level='info',
            category='business_event',
            action_name='Auto-linked legacy orders',
            source_system='internal',
            entity_type='customer_account',
            entity_id=customer.id,
            metadata={
                'origin': origin,
                'customer_account_id': customer.id,
                'linked_orders_count': len(linked_ids),
                'linked_order_ids': linked_ids,
            },
        )
    return len(rows)


@router.post('/auth/register', response_model=CustomerAuthResponse, status_code=201)
def register_customer(payload: CustomerRegisterRequest, db: Session = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail='As senhas nao conferem')
    email = _normalize_email(payload.email)
    phone_number = _normalize_phone(payload.phone_number)
    if not email:
        raise HTTPException(status_code=400, detail='E-mail invalido')
    if not phone_number:
        raise HTTPException(status_code=400, detail='Telefone invalido')

    exists = db.query(CustomerAccount).filter(CustomerAccount.email == email).first()
    if exists:
        raise HTTPException(status_code=400, detail='Ja existe conta com este e-mail')

    customer = CustomerAccount(
        full_name=str(payload.full_name or '').strip(),
        email=email,
        phone_number=phone_number,
        password_hash=hash_password(payload.password),
        is_active=True,
        email_verified=False,
        phone_verified=False,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    linked = _link_legacy_orders(db, customer, origin='auto_link_on_signup')
    if email:
        send_account_created_email(
            db,
            recipient_email=email,
            full_name=customer.full_name,
            account_link='/minha-conta',
            customer_account_id=customer.id,
        )
    token = create_customer_token(customer.id)
    return CustomerAuthResponse(token=token, customer=_serialize_customer(customer), linked_orders_count=linked)


@router.post('/auth/login', response_model=CustomerAuthResponse)
def login_customer(payload: CustomerLoginRequest, db: Session = Depends(get_db)):
    identifier = str(payload.identifier or '').strip()
    normalized_email = _normalize_email(identifier)
    normalized_phone = _normalize_phone(identifier)
    query = db.query(CustomerAccount).filter(CustomerAccount.is_active == True)
    if normalized_email and '@' in normalized_email:
        customer = query.filter(CustomerAccount.email == normalized_email).first()
    else:
        customer = query.filter(CustomerAccount.phone_number == normalized_phone).first()
    if not customer or not verify_password(payload.password, customer.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciais invalidas')
    customer.last_login_at = datetime.utcnow()
    db.add(customer)
    db.commit()
    db.refresh(customer)
    linked = _link_legacy_orders(db, customer, origin='auto_link_on_login') if payload.link_legacy_orders else 0
    token = create_customer_token(customer.id)
    return CustomerAuthResponse(token=token, customer=_serialize_customer(customer), linked_orders_count=linked)


@router.post('/auth/logout', status_code=204)
def logout_customer(_: CustomerAccount = Depends(require_customer)):
    return None


@router.get('/auth/me', response_model=CustomerAccountResponse)
def customer_me(customer: CustomerAccount = Depends(require_customer)):
    return _serialize_customer(customer)


@router.post('/auth/forgot-password', response_model=CustomerForgotPasswordResponse)
def forgot_password(payload: CustomerForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    customer = db.query(CustomerAccount).filter(CustomerAccount.email == email, CustomerAccount.is_active == True).first()
    if not customer:
        return CustomerForgotPasswordResponse(
            ok=True,
            message='Se o e-mail existir, um token de redefinicao foi gerado.',
            reset_token=None,
        )
    token_value = secrets.token_urlsafe(36)
    token_row = CustomerPasswordResetToken(
        customer_account_id=customer.id,
        token=token_value,
        is_used=False,
        expires_at=datetime.utcnow() + timedelta(hours=2),
    )
    db.add(token_row)
    db.commit()
    reset_link = f"/minha-conta/redefinir-senha?token={token_value}"
    try:
        host = str(request.headers.get('origin') or '').strip()
        if host:
            reset_link = f"{host.rstrip('/')}/minha-conta/redefinir-senha?token={token_value}"
    except Exception:
        pass
    send_password_reset_email(
        db,
        recipient_email=customer.email,
        full_name=customer.full_name,
        reset_link=reset_link,
        token_expiration='2 horas',
        customer_account_id=customer.id,
    )
    return CustomerForgotPasswordResponse(
        ok=True,
        message='Se o e-mail existir, enviamos instrucoes para redefinicao.',
        reset_token=None,
    )


@router.post('/auth/reset-password', status_code=204)
def reset_password(payload: CustomerResetPasswordRequest, db: Session = Depends(get_db)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail='As senhas nao conferem')
    token_row = db.query(CustomerPasswordResetToken).filter(CustomerPasswordResetToken.token == payload.token).first()
    if not token_row:
        raise HTTPException(status_code=404, detail='Token invalido')
    if bool(token_row.is_used):
        raise HTTPException(status_code=400, detail='Token ja utilizado')
    if token_row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail='Token expirado')
    customer = db.query(CustomerAccount).filter(CustomerAccount.id == token_row.customer_account_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail='Conta nao encontrada')
    customer.password_hash = hash_password(payload.new_password)
    token_row.is_used = True
    db.add(customer)
    db.add(token_row)
    db.commit()
    return None


@router.post('/orders/link-legacy', response_model=CustomerLinkLegacyOrdersResponse)
def link_legacy_orders(customer: CustomerAccount = Depends(require_customer), db: Session = Depends(get_db)):
    linked = _link_legacy_orders(db, customer, origin='manual_link')
    return CustomerLinkLegacyOrdersResponse(
        linked_orders_count=linked,
        message=f'{linked} pedido(s) antigo(s) vinculado(s) com sucesso.' if linked else 'Nenhum pedido antigo para vincular.',
    )


@router.get('/orders', response_model=CustomerOrderListResponse)
def list_customer_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    customer: CustomerAccount = Depends(require_customer),
    db: Session = Depends(get_db),
):
    ensure_default_order_flow_stages(db)
    base_query = db.query(Order).filter(Order.customer_account_id == customer.id)
    total = int(base_query.count())
    rows = (
        base_query.options(selectinload(Order.current_stage)).order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    changed = False
    for row in rows:
        previous = row.current_stage_id
        ensure_order_has_stage(db, row, note='auto_assign_on_customer_list')
        if previous != row.current_stage_id:
            changed = True
    if changed:
        db.commit()
        for row in rows:
            db.refresh(row)
    return CustomerOrderListResponse(
        items=[
            CustomerOrderListItem(
                id=row.id,
                total=float(row.total or 0),
                subtotal=float(row.subtotal or 0),
                discount=float(row.discount or 0),
                payment_status=row.payment_status,
                payment_method=row.payment_method,
                payment_provider=row.payment_provider,
                sales_channel=row.sales_channel,
                current_stage_id=row.current_stage_id,
                current_stage_name=row.current_stage.name if row.current_stage else None,
                current_stage_color=row.current_stage.color if row.current_stage else None,
                current_stage_updated_at=row.current_stage_updated_at,
                production_status=row.production_status,
                estimated_ready_at=row.estimated_ready_at,
                production_started_at=row.production_started_at,
                ready_at=row.ready_at,
                created_at=row.created_at,
                receipt_url=row.receipt_url,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get('/orders/{order_id}', response_model=OrderResponse)
def get_customer_order(order_id: int, customer: CustomerAccount = Depends(require_customer), db: Session = Depends(get_db)):
    ensure_default_order_flow_stages(db)
    order = (
        db.query(Order)
        .options(selectinload(Order.items), selectinload(Order.current_stage), selectinload(Order.stage_history).selectinload(OrderStageHistory.stage))
        .filter(Order.id == order_id, Order.customer_account_id == customer.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail='Pedido nao encontrado')
    ensure_order_has_stage(db, order, note='auto_assign_on_customer_detail')
    db.commit()
    db.refresh(order)
    serialized = serialize_order(order)
    serialized['timeline'] = build_customer_order_timeline(db, order)
    return serialized


@router.put('/profile', response_model=CustomerAccountResponse)
def update_customer_profile(
    payload: CustomerUpdateProfileRequest,
    customer: CustomerAccount = Depends(require_customer),
    db: Session = Depends(get_db),
):
    email = _normalize_email(payload.email)
    phone_number = _normalize_phone(payload.phone_number)
    if not email or not phone_number:
        raise HTTPException(status_code=400, detail='Email ou telefone invalido')

    same_email = db.query(CustomerAccount).filter(CustomerAccount.email == email, CustomerAccount.id != customer.id).first()
    if same_email:
        raise HTTPException(status_code=400, detail='Ja existe conta com este e-mail')

    customer.full_name = str(payload.full_name or '').strip()
    customer.email = email
    customer.phone_number = phone_number
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _serialize_customer(customer)


@router.post('/change-password', status_code=204)
def change_customer_password(
    payload: CustomerChangePasswordRequest,
    customer: CustomerAccount = Depends(require_customer),
    db: Session = Depends(get_db),
):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail='As senhas nao conferem')
    if not verify_password(payload.current_password, customer.password_hash):
        raise HTTPException(status_code=400, detail='Senha atual invalida')
    customer.password_hash = hash_password(payload.new_password)
    db.add(customer)
    db.commit()
    return None
