import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_db
from app.models import Order
from app.schemas import (
    InfinitePayCheckoutRequest,
    InfinitePayCheckoutResponse,
    InfinitePayStatusCheckRequest,
    InfinitePayStatusCheckResponse,
    PublicPaymentReturnResponse,
)
from app.services.infinitepay_service import (
    InfinitePayValidationError,
    build_payment_metadata,
    check_payment_status,
    config_is_ready,
    create_checkout_link,
    get_or_create_infinitepay_config,
    infer_payment_method,
    infer_payment_status_from_payload,
)
from app.services.email_service import send_order_paid_email
from app.services.customer_identity_service import normalize_email, normalize_phone

router = APIRouter(tags=['payments'])
logger = logging.getLogger('infinitepay')


def _to_brl_amount(value):
    if value is None:
        return None
    try:
        normalized = str(value).strip().replace(',', '.')
        number = float(normalized)
    except Exception:  # noqa: BLE001
        return None
    # InfinitePay retorna valores monetarios em centavos (inteiro).
    if float(number).is_integer():
        return float(number) / 100.0
    return float(number)


def _ensure_order_nsu(order: Order) -> str:
    normalized = str(order.order_nsu or '').strip()
    if normalized:
        return normalized
    normalized = f'ORDER-{order.id}-{datetime.utcnow().strftime("%Y%m%d%H%M%S")}'
    order.order_nsu = normalized
    return normalized


def _format_customer(payload: InfinitePayCheckoutRequest) -> dict | None:
    name = str(payload.customer_name or '').strip()
    email = normalize_email(payload.customer_email)
    phone = normalize_phone(payload.customer_phone)
    document = str(payload.customer_document or '').strip()
    if not any([name, email, phone, document]):
        return None
    data = {}
    if name:
        data['name'] = name
    if email:
        data['email'] = email
    if phone:
        data['phone_number'] = phone
    if document:
        data['document'] = document
    return data


@router.post('/payments/infinitepay/checkout', response_model=InfinitePayCheckoutResponse)
def create_infinitepay_checkout(payload: InfinitePayCheckoutRequest, db: Session = Depends(get_db)):
    order = (
        db.query(Order)
        .options(selectinload(Order.items))
        .filter(Order.id == payload.order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail='Pedido nao encontrado')
    if not order.items:
        raise HTTPException(status_code=400, detail='Pedido sem itens')

    config = get_or_create_infinitepay_config(db)
    ready, reason = config_is_ready(config)
    if not ready:
        raise HTTPException(status_code=400, detail=reason)

    order_nsu = _ensure_order_nsu(order)
    customer = _format_customer(payload)
    address = payload.address if isinstance(payload.address, dict) and payload.address else None
    try:
        checkout = create_checkout_link(order=order, config=config, customer=customer, address=address)
    except InfinitePayValidationError as exc:
        logger.warning('InfinitePay checkout validation failure order_id=%s: %s', order.id, exc)
        order.payment_status = 'failed'
        order.payment_provider = 'infinitepay'
        order.payment_method = order.payment_method or 'pix'
        order.sales_channel = 'online_checkout'
        order.payment_metadata_json = build_payment_metadata(
            order.payment_metadata_json,
            event='checkout_validation_error',
            payload={'error': str(exc)},
        )
        db.add(order)
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception('InfinitePay checkout failure order_id=%s', order.id)
        order.payment_status = 'failed'
        order.payment_provider = 'infinitepay'
        order.payment_method = order.payment_method or 'pix'
        order.sales_channel = 'online_checkout'
        order.payment_metadata_json = build_payment_metadata(
            order.payment_metadata_json,
            event='checkout_error',
            payload={'error': str(exc)},
        )
        db.add(order)
        db.commit()
        raise HTTPException(status_code=502, detail=f'Falha ao criar checkout na InfinitePay: {exc}') from exc

    order.payment_provider = 'infinitepay'
    order.sales_channel = 'online_checkout'
    order.payment_status = 'pending_payment'
    order.checkout_url = checkout.checkout_url
    order.payment_metadata_json = build_payment_metadata(
        order.payment_metadata_json,
        event='checkout_created',
        payload=checkout.raw_response,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    logger.info('InfinitePay checkout success order_id=%s order_nsu=%s', order.id, order.order_nsu)
    return InfinitePayCheckoutResponse(
        ok=True,
        order_id=order.id,
        order_nsu=str(order.order_nsu or order_nsu),
        checkout_url=str(order.checkout_url or checkout.checkout_url),
        payment_status=order.payment_status,
    )


@router.post('/payments/infinitepay/status-check', response_model=InfinitePayStatusCheckResponse)
def infinitepay_status_check(payload: InfinitePayStatusCheckRequest, db: Session = Depends(get_db)):
    order = None
    if payload.order_id:
        order = db.query(Order).filter(Order.id == payload.order_id).first()
    elif payload.order_nsu:
        order = db.query(Order).filter(Order.order_nsu == payload.order_nsu).first()

    config = get_or_create_infinitepay_config(db)
    ready, reason = config_is_ready(config)
    if not ready:
        raise HTTPException(status_code=400, detail=reason)
    if not order:
        raise HTTPException(status_code=404, detail='Pedido nao encontrado')

    order_nsu = _ensure_order_nsu(order)
    slug = payload.slug or order.invoice_slug
    transaction_nsu = payload.transaction_nsu or order.transaction_nsu
    try:
        result = check_payment_status(
            config=config,
            order_nsu=order_nsu,
            slug=slug,
            transaction_nsu=transaction_nsu,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception('InfinitePay status-check failure order_id=%s', order.id)
        raise HTTPException(status_code=502, detail=f'Falha ao consultar status na InfinitePay: {exc}') from exc

    capture_method = str(result.get('capture_method') or '').strip().lower() or None
    payment_method = infer_payment_method(capture_method, order.payment_method)
    payment_status = infer_payment_status_from_payload(result)
    previous_payment_status = str(order.payment_status or '').strip().lower()
    paid_amount = result.get('paid_amount')
    amount = result.get('amount')
    installments = result.get('installments')
    receipt_url = str(result.get('receipt_url') or '').strip() or None

    order.invoice_slug = str(result.get('slug') or slug or '').strip() or order.invoice_slug
    order.transaction_nsu = str(result.get('transaction_nsu') or transaction_nsu or '').strip() or order.transaction_nsu
    order.receipt_url = receipt_url or order.receipt_url
    order.capture_method = capture_method or order.capture_method
    order.payment_provider = 'infinitepay'
    order.sales_channel = 'online_checkout'
    if payment_method:
        order.payment_method = payment_method
    order.payment_status = payment_status
    if paid_amount is not None:
        order.paid_amount = _to_brl_amount(paid_amount)
    if installments is not None:
        order.installments = int(installments)
    if payment_status == 'paid' and not order.paid_at:
        order.paid_at = datetime.utcnow()
    order.payment_metadata_json = build_payment_metadata(order.payment_metadata_json, event='status_check', payload=result)
    db.add(order)
    db.commit()
    if payment_status == 'paid' and previous_payment_status != 'paid':
        try:
            send_order_paid_email(db, order)
        except Exception:
            pass

    return InfinitePayStatusCheckResponse(
        ok=True,
        payment_status=order.payment_status,
        payment_method=order.payment_method,
        paid=result.get('paid'),
        amount=_to_brl_amount(amount),
        paid_amount=order.paid_amount,
        installments=order.installments,
        capture_method=order.capture_method,
        receipt_url=order.receipt_url,
        raw=result,
    )


@router.get('/public/payments/infinitepay/return', response_model=PublicPaymentReturnResponse)
def public_infinitepay_return_status(
    order_nsu: str,
    slug: str | None = None,
    transaction_nsu: str | None = None,
    db: Session = Depends(get_db),
):
    normalized_nsu = str(order_nsu or '').strip()
    if not normalized_nsu:
        raise HTTPException(status_code=400, detail='order_nsu obrigatorio')
    order = db.query(Order).filter(Order.order_nsu == normalized_nsu).first()
    if not order:
        return PublicPaymentReturnResponse(
            order_id=None,
            order_nsu=normalized_nsu,
            payment_status='not_found',
            payment_method=None,
            receipt_url=None,
            total=0,
            paid_amount=None,
        )

    # Consulta eventual para atualizar status ao retornar ao site.
    config = get_or_create_infinitepay_config(db)
    ready, _ = config_is_ready(config)
    if ready:
        try:
            previous_payment_status = str(order.payment_status or '').strip().lower()
            status_result = check_payment_status(
                config=config,
                order_nsu=normalized_nsu,
                slug=slug or order.invoice_slug,
                transaction_nsu=transaction_nsu or order.transaction_nsu,
            )
            payment_status = infer_payment_status_from_payload(status_result)
            capture_method = str(status_result.get('capture_method') or '').strip().lower() or None
            payment_method = infer_payment_method(capture_method, order.payment_method)
            order.payment_status = payment_status
            if payment_method:
                order.payment_method = payment_method
            order.capture_method = capture_method or order.capture_method
            if status_result.get('paid_amount') is not None:
                order.paid_amount = _to_brl_amount(status_result.get('paid_amount'))
            receipt_url = str(status_result.get('receipt_url') or '').strip() or None
            order.receipt_url = receipt_url or order.receipt_url
            if status_result.get('installments') is not None:
                order.installments = int(status_result.get('installments') or 1)
            order.invoice_slug = str(status_result.get('slug') or slug or '').strip() or order.invoice_slug
            order.transaction_nsu = str(status_result.get('transaction_nsu') or transaction_nsu or '').strip() or order.transaction_nsu
            if payment_status == 'paid' and not order.paid_at:
                order.paid_at = datetime.utcnow()
            order.payment_metadata_json = build_payment_metadata(
                order.payment_metadata_json,
                event='redirect_status_check',
                payload=status_result,
            )
            db.add(order)
            db.commit()
            db.refresh(order)
            if payment_status == 'paid' and previous_payment_status != 'paid':
                try:
                    send_order_paid_email(db, order)
                except Exception:
                    pass
        except Exception:  # noqa: BLE001
            logger.exception('InfinitePay return status-check failed order_nsu=%s', normalized_nsu)

    return PublicPaymentReturnResponse(
        order_id=order.id,
        order_nsu=order.order_nsu,
        payment_status=order.payment_status,
        payment_method=order.payment_method,
        receipt_url=order.receipt_url,
        total=float(order.total or 0.0),
        paid_amount=float(order.paid_amount) if order.paid_amount is not None else None,
    )
