from datetime import datetime
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from types import SimpleNamespace

from app.core.security import get_db, get_optional_customer
from app.models import CustomerAccount
from app.schemas import OrderCreate, OrderResponse
from app.services.analytics_service import create_user_event
from app.services.coupon_service import build_client_hash, register_coupon_usage, validate_coupon_for_client
from app.services.order_service import create_order_with_payment, serialize_order
from app.services.product_service import get_product_by_slug, parse_sub_items_from_storage
from app.services.promotion_service import get_effective_price_for_product

router = APIRouter()


def _normalize_email(value: str | None) -> str | None:
    normalized = str(value or '').strip().lower()
    return normalized or None


def _normalize_phone(value: str | None) -> str | None:
    normalized = ''.join([char for char in str(value or '') if char.isdigit()])
    return normalized or None


@router.post('/orders', response_model=OrderResponse)
def create_order_endpoint(
    payload: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    customer: CustomerAccount | None = Depends(get_optional_customer),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail='Carrinho vazio')

    order_items = []
    subtotal = 0.0
    for item in payload.items:
        product = get_product_by_slug(db, item.slug)
        if not product:
            raise HTTPException(status_code=404, detail=f'Produto nao encontrado: {item.slug}')

        quantity = max(1, int(item.quantity))
        fallback_unit_price = float(get_effective_price_for_product(db, product))
        unit_price = float(item.unit_price) if item.unit_price is not None else fallback_unit_price
        raw_name_personalizations = item.name_personalizations or []
        name_personalizations = [str(value or '').strip() for value in raw_name_personalizations][:quantity]
        if len(name_personalizations) < quantity:
            name_personalizations.extend([''] * (quantity - len(name_personalizations)))
        selected_sub_items = []
        valid_sub_items = parse_sub_items_from_storage(product.sub_items)
        by_title = {str(sub.get('title') or '').strip().lower(): sub for sub in valid_sub_items}
        for sub in item.selected_sub_items or []:
            if not isinstance(sub, dict):
                continue
            sub_title = str(sub.get('title') or '').strip()
            if not sub_title:
                continue
            source_sub = by_title.get(sub_title.lower())
            sub_quantity = max(1, int(sub.get('quantity') or 1))
            sub_unit_price = float(sub.get('unit_price') or (source_sub.get('final_price') if source_sub else 0) or 0)
            selected_sub_items.append(
                {
                    'slug': sub.get('slug'),
                    'title': sub_title,
                    'quantity': sub_quantity,
                    'unit_price': sub_unit_price,
                    'selected_color': sub.get('selected_color'),
                    'selected_secondary_color': sub.get('selected_secondary_color'),
                }
            )

        line_total = unit_price * quantity
        subtotal += unit_price * quantity
        order_items.append(
            {
                'slug': product.slug,
                'title': product.title,
                'quantity': quantity,
                'unit_price': unit_price,
                'line_total': line_total,
                'selected_color': item.selected_color,
                'selected_secondary_color': item.selected_secondary_color,
                'selected_sub_items': selected_sub_items,
                'name_personalizations': name_personalizations,
            }
        )

    discount = 0.0
    coupon = None
    client_hash = None
    if payload.coupon:
        client_ip = request.headers.get('x-forwarded-for', '').split(',')[0].strip() or (request.client.host if request.client else '')
        client_fingerprint = request.headers.get('x-client-fingerprint', '')
        client_user_agent = request.headers.get('user-agent', '')
        client_hash = build_client_hash(client_ip, client_fingerprint, client_user_agent)

        coupon, coupon_error = validate_coupon_for_client(db, payload.coupon, client_hash)
        if not coupon:
            raise HTTPException(status_code=404, detail=coupon_error or 'Cupom invalido ou expirado')

        if coupon.type == 'percent':
            discount = subtotal * coupon.value / 100.0
        elif coupon.type == 'fixed':
            discount = min(float(coupon.value), subtotal)
        else:
            raise HTTPException(status_code=400, detail='Tipo de cupom invalido')

    total = subtotal - discount
    valid_status = {'pending', 'paid', 'pending_payment', 'failed', 'canceled', 'awaiting_confirmation'}
    payment_status = payload.payment_status if payload.payment_status in valid_status else 'pending'
    payment_method = (payload.payment_method or '').strip().lower() or 'whatsapp'
    if payment_method not in {'whatsapp', 'pix', 'credit_card'}:
        payment_method = 'whatsapp'
    payment_provider = 'whatsapp' if payment_method == 'whatsapp' else 'infinitepay'
    sales_channel = 'whatsapp' if payment_method == 'whatsapp' else 'online_checkout'
    paid_at = datetime.utcnow() if payment_status == 'paid' else None
    customer_name_snapshot = str(payload.customer_name or '').strip() or (str(customer.full_name or '').strip() if customer else None)
    customer_email_snapshot = _normalize_email(payload.customer_email) or (_normalize_email(customer.email) if customer else None)
    customer_phone_snapshot = _normalize_phone(payload.customer_phone) or (_normalize_phone(customer.phone_number) if customer else None)
    shipping_address_snapshot = payload.shipping_address_snapshot if isinstance(payload.shipping_address_snapshot, dict) else {}
    order = create_order_with_payment(
        db,
        order_items,
        coupon.code if payload.coupon and coupon else None,
        subtotal,
        discount,
        total,
        payment_status,
        payment_method,
        customer_account_id=customer.id if customer else None,
        customer_name=customer_name_snapshot,
        customer_email_snapshot=customer_email_snapshot,
        customer_phone_snapshot=customer_phone_snapshot,
        shipping_address_snapshot=json.dumps(shipping_address_snapshot, ensure_ascii=False) if shipping_address_snapshot else None,
        payment_provider=payment_provider,
        sales_channel=sales_channel,
        paid_at=paid_at,
    )
    if coupon:
        register_coupon_usage(db, coupon, client_hash, order.id)
        db.commit()

    session_id = (request.headers.get('x-session-id') or '').strip()
    if session_id:
        try:
            create_user_event(
                db,
                SimpleNamespace(
                    event_type='order_created',
                    product_id=None,
                    category_id=None,
                    session_id=session_id,
                    user_identifier=None,
                    page_url=str(request.url.path),
                    source_channel=None,
                    referrer=request.headers.get('referer'),
                    cta_name='order_create_api',
                    metadata_json={
                        'order_id': order.id,
                        'total': float(total),
                        'items_count': len(order_items),
                        'payment_status': payment_status,
                    },
                ),
            )
        except Exception:
            pass
    return serialize_order(order)
