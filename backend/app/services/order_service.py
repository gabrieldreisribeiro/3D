from datetime import datetime, timedelta
import json

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Order, OrderItem, Product


def create_order(db: Session, items, coupon_code, subtotal, discount, total):
    return _create_order(
        db,
        items,
        coupon_code,
        subtotal,
        discount,
        total,
        payment_status='pending',
        payment_method='whatsapp',
        payment_provider='whatsapp',
        sales_channel='whatsapp',
    )


def _create_order(
    db: Session,
    items,
    coupon_code,
    subtotal,
    discount,
    total,
    payment_status,
    payment_method,
    *,
    customer_account_id=None,
    customer_name=None,
    customer_email_snapshot=None,
    customer_phone_snapshot=None,
    shipping_address_snapshot=None,
    payment_provider=None,
    sales_channel='whatsapp',
    order_nsu=None,
    invoice_slug=None,
    transaction_nsu=None,
    receipt_url=None,
    checkout_url=None,
    capture_method=None,
    paid_amount=None,
    installments=None,
    paid_at=None,
    payment_metadata_json='{}',
):
    order = Order(
        customer_account_id=customer_account_id,
        customer_name=customer_name,
        customer_email_snapshot=customer_email_snapshot,
        customer_phone_snapshot=customer_phone_snapshot,
        shipping_address_snapshot=shipping_address_snapshot,
        subtotal=subtotal,
        discount=discount,
        total=total,
        coupon_code=coupon_code,
        payment_status=payment_status or 'pending',
        payment_method=payment_method or 'whatsapp',
        payment_provider=payment_provider or ('whatsapp' if (payment_method or 'whatsapp') == 'whatsapp' else None),
        sales_channel=sales_channel or 'whatsapp',
        order_nsu=order_nsu,
        invoice_slug=invoice_slug,
        transaction_nsu=transaction_nsu,
        receipt_url=receipt_url,
        checkout_url=checkout_url,
        capture_method=capture_method,
        paid_amount=paid_amount,
        installments=installments,
        paid_at=paid_at,
        payment_metadata_json=payment_metadata_json or '{}',
    )
    db.add(order)
    db.flush()
    for item in items:
        order_item = OrderItem(
            order_id=order.id,
            product_slug=item['slug'],
            title=item['title'],
            quantity=item['quantity'],
            unit_price=item['unit_price'],
            line_total=item.get('line_total') or (float(item['unit_price']) * int(item['quantity'])),
            selected_color=item.get('selected_color'),
            selected_secondary_color=item.get('selected_secondary_color'),
            selected_sub_items=json.dumps(item.get('selected_sub_items') or [], ensure_ascii=False),
            name_personalizations=json.dumps(item.get('name_personalizations') or [], ensure_ascii=False),
        )
        db.add(order_item)
    db.commit()
    db.refresh(order)
    return order


def create_order_with_payment(
    db: Session,
    items,
    coupon_code,
    subtotal,
    discount,
    total,
    payment_status,
    payment_method,
    **kwargs,
):
    return _create_order(db, items, coupon_code, subtotal, discount, total, payment_status, payment_method, **kwargs)


def _safe_parse_selected_sub_items(raw_value):
    if not raw_value:
        return []
    try:
        data = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
    except Exception:  # noqa: BLE001
        return []
    if not isinstance(data, list):
        return []

    parsed = []
    for item in data:
        if not isinstance(item, dict):
            continue
        title = str(item.get('title') or '').strip()
        if not title:
            continue
        quantity = max(1, int(item.get('quantity') or 1))
        unit_price = float(item.get('unit_price') or 0)
        parsed.append(
            {
                'slug': item.get('slug'),
                'title': title,
                'quantity': quantity,
                'unit_price': unit_price,
                'selected_color': item.get('selected_color'),
                'selected_secondary_color': item.get('selected_secondary_color'),
            }
        )
    return parsed


def _safe_parse_name_personalizations(raw_value):
    if not raw_value:
        return []
    try:
        data = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
    except Exception:  # noqa: BLE001
        return []
    if not isinstance(data, list):
        return []
    return [str(value or '').strip() for value in data]


def serialize_order_item(item: OrderItem) -> dict:
    quantity = int(item.quantity or 0)
    unit_price = float(item.unit_price or 0)
    line_total = float(item.line_total if item.line_total is not None else unit_price * quantity)
    return {
        'id': item.id,
        'product_slug': item.product_slug,
        'title': item.title,
        'quantity': quantity,
        'unit_price': unit_price,
        'line_total': line_total,
        'selected_color': item.selected_color,
        'selected_secondary_color': item.selected_secondary_color,
        'selected_sub_items': _safe_parse_selected_sub_items(item.selected_sub_items),
        'name_personalizations': _safe_parse_name_personalizations(item.name_personalizations),
    }


def serialize_order(order: Order) -> dict:
    return {
        'id': order.id,
        'subtotal': float(order.subtotal or 0),
        'discount': float(order.discount or 0),
        'total': float(order.total or 0),
        'coupon_code': order.coupon_code,
        'payment_status': order.payment_status,
        'payment_provider': order.payment_provider,
        'payment_method': order.payment_method,
        'sales_channel': order.sales_channel,
        'order_nsu': order.order_nsu,
        'invoice_slug': order.invoice_slug,
        'transaction_nsu': order.transaction_nsu,
        'receipt_url': order.receipt_url,
        'checkout_url': order.checkout_url,
        'capture_method': order.capture_method,
        'paid_amount': float(order.paid_amount) if order.paid_amount is not None else None,
        'installments': int(order.installments) if order.installments is not None else None,
        'paid_at': order.paid_at,
        'payment_metadata_json': order.payment_metadata_json,
        'customer_account_id': order.customer_account_id,
        'customer_name': order.customer_name,
        'customer_email_snapshot': order.customer_email_snapshot,
        'customer_phone_snapshot': order.customer_phone_snapshot,
        'shipping_address_snapshot': order.shipping_address_snapshot,
        'items': [serialize_order_item(item) for item in (order.items or [])],
    }


def serialize_admin_order(order: Order) -> dict:
    return {
        **serialize_order(order),
        'created_at': order.created_at,
    }


def admin_list_orders(db: Session):
    return db.query(Order).options(selectinload(Order.items)).order_by(Order.id.desc()).all()


def admin_total_orders(db: Session) -> int:
    return db.query(func.count(Order.id)).scalar() or 0


def admin_total_sold(db: Session) -> float:
    return db.query(func.coalesce(func.sum(Order.total), 0.0)).scalar() or 0.0


def _build_daily_series(rows, start: datetime.date, end: datetime.date):
    mapped = {row[0]: row[1] for row in rows}
    series = []
    cursor = start
    while cursor <= end:
        key = cursor.isoformat()
        series.append({'label': cursor.strftime('%d/%m'), 'value': float(mapped.get(key, 0) or 0)})
        cursor += timedelta(days=1)
    return series


def dashboard_orders_last_days(
    db: Session,
    days: int = 7,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    if date_from or date_to:
        start = (date_from.date() if date_from else (date_to.date() - timedelta(days=days - 1) if date_to else datetime.now().date()))
        end = (date_to.date() if date_to else datetime.now().date())
    else:
        end = datetime.now().date()
        start = end - timedelta(days=days - 1)

    query = db.query(func.date(Order.created_at).label('day'), func.count(Order.id))
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    else:
        query = query.filter(Order.created_at >= start)
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    rows = query.group_by(func.date(Order.created_at)).all()
    return _build_daily_series(rows, start, end)


def dashboard_sales_last_days(
    db: Session,
    days: int = 7,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    if date_from or date_to:
        start = (date_from.date() if date_from else (date_to.date() - timedelta(days=days - 1) if date_to else datetime.now().date()))
        end = (date_to.date() if date_to else datetime.now().date())
    else:
        end = datetime.now().date()
        start = end - timedelta(days=days - 1)

    query = db.query(func.date(Order.created_at).label('day'), func.coalesce(func.sum(Order.total), 0.0))
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    else:
        query = query.filter(Order.created_at >= start)
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    rows = query.group_by(func.date(Order.created_at)).all()
    mapped_rows = [(row[0], float(row[1] or 0.0)) for row in rows]
    return _build_daily_series(mapped_rows, start, end)


def dashboard_top_products(
    db: Session,
    limit: int = 5,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
):
    query = db.query(OrderItem.title, func.sum(OrderItem.quantity).label('qty')).join(Order, Order.id == OrderItem.order_id)
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    rows = query.group_by(OrderItem.title).order_by(func.sum(OrderItem.quantity).desc()).limit(limit).all()
    return [{'title': row[0], 'quantity': int(row[1])} for row in rows]


def dashboard_order_status(db: Session, date_from: datetime | None = None, date_to: datetime | None = None):
    query = db.query(Order.payment_status, func.count(Order.id))
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    rows = query.group_by(Order.payment_status).all()
    mapped = {str(status or 'pending').lower(): int(count) for status, count in rows}
    return [
        {'status': 'Pago', 'value': mapped.get('paid', 0)},
        {'status': 'Pendente', 'value': mapped.get('pending', 0) + mapped.get('pending_payment', 0) + mapped.get('awaiting_confirmation', 0)},
        {'status': 'Falhou', 'value': mapped.get('failed', 0)},
        {'status': 'Cancelado', 'value': mapped.get('canceled', 0)},
    ]


def list_most_ordered_products(db: Session, limit: int = 4):
    safe_limit = max(1, min(int(limit or 4), 12))

    rows = (
        db.query(OrderItem.product_slug, func.sum(OrderItem.quantity).label('qty'))
        .group_by(OrderItem.product_slug)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(safe_limit)
        .all()
    )
    ranked_slugs = [str(row[0] or '').strip() for row in rows if row[0]]
    if ranked_slugs:
        products = (
            db.query(Product)
            .filter(Product.is_active == True, Product.slug.in_(ranked_slugs))
            .all()
        )
        by_slug = {product.slug: product for product in products}
        ordered = [by_slug[slug] for slug in ranked_slugs if slug in by_slug]
        if ordered:
            return ordered[:safe_limit]

    return (
        db.query(Product)
        .filter(Product.is_active == True)
        .order_by(Product.id.desc())
        .limit(safe_limit)
        .all()
    )
