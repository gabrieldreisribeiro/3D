from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from types import SimpleNamespace

from app.db.session import SessionLocal
from app.schemas import OrderCreate, OrderResponse
from app.services.analytics_service import create_user_event
from app.services.coupon_service import build_client_hash, register_coupon_usage, validate_coupon_for_client
from app.services.order_service import create_order_with_payment, serialize_order
from app.services.product_service import get_product_by_slug, parse_sub_items_from_storage

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post('/orders', response_model=OrderResponse)
def create_order_endpoint(payload: OrderCreate, request: Request, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail='Carrinho vazio')

    order_items = []
    subtotal = 0.0
    for item in payload.items:
        product = get_product_by_slug(db, item.slug)
        if not product:
            raise HTTPException(status_code=404, detail=f'Produto nao encontrado: {item.slug}')

        quantity = max(1, int(item.quantity))
        fallback_unit_price = float(product.final_price if product.final_price is not None else product.price)
        unit_price = float(item.unit_price) if item.unit_price is not None else fallback_unit_price
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
    payment_status = payload.payment_status if payload.payment_status in {'pending', 'paid'} else 'pending'
    payment_method = (payload.payment_method or '').strip() or None
    order = create_order_with_payment(
        db,
        order_items,
        coupon.code if payload.coupon and coupon else None,
        subtotal,
        discount,
        total,
        payment_status,
        payment_method,
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
