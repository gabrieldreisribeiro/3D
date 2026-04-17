from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Order, OrderItem, Product


def create_order(db: Session, items, coupon_code, subtotal, discount, total):
    return _create_order(db, items, coupon_code, subtotal, discount, total, 'pending', None)


def _create_order(db: Session, items, coupon_code, subtotal, discount, total, payment_status, payment_method):
    order = Order(
        subtotal=subtotal,
        discount=discount,
        total=total,
        coupon_code=coupon_code,
        payment_status=payment_status or 'pending',
        payment_method=payment_method,
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
        )
        db.add(order_item)
    db.commit()
    db.refresh(order)
    return order


def create_order_with_payment(db: Session, items, coupon_code, subtotal, discount, total, payment_status, payment_method):
    return _create_order(db, items, coupon_code, subtotal, discount, total, payment_status, payment_method)


def admin_list_orders(db: Session):
    return db.query(Order).options(selectinload(Order.items)).order_by(Order.id.desc()).all()


def admin_total_orders(db: Session) -> int:
    return db.query(func.count(Order.id)).scalar() or 0


def admin_total_sold(db: Session) -> float:
    return db.query(func.coalesce(func.sum(Order.total), 0.0)).scalar() or 0.0


def dashboard_orders_last_days(db: Session, days: int = 7):
    today = datetime.now().date()
    start = today - timedelta(days=days - 1)

    rows = (
        db.query(func.date(Order.created_at).label('day'), func.count(Order.id))
        .filter(Order.created_at >= start)
        .group_by(func.date(Order.created_at))
        .all()
    )
    mapped = {row[0]: row[1] for row in rows}

    series = []
    for index in range(days):
        day = start + timedelta(days=index)
        key = day.isoformat()
        series.append({'label': day.strftime('%d/%m'), 'value': float(mapped.get(key, 0))})
    return series


def dashboard_sales_last_days(db: Session, days: int = 7):
    today = datetime.now().date()
    start = today - timedelta(days=days - 1)

    rows = (
        db.query(func.date(Order.created_at).label('day'), func.coalesce(func.sum(Order.total), 0.0))
        .filter(Order.created_at >= start)
        .group_by(func.date(Order.created_at))
        .all()
    )
    mapped = {row[0]: float(row[1]) for row in rows}

    series = []
    for index in range(days):
        day = start + timedelta(days=index)
        key = day.isoformat()
        series.append({'label': day.strftime('%d/%m'), 'value': float(mapped.get(key, 0.0))})
    return series


def dashboard_top_products(db: Session, limit: int = 5):
    rows = (
        db.query(OrderItem.title, func.sum(OrderItem.quantity).label('qty'))
        .group_by(OrderItem.title)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return [{'title': row[0], 'quantity': int(row[1])} for row in rows]


def dashboard_order_status(db: Session):
    rows = db.query(Order.payment_status, func.count(Order.id)).group_by(Order.payment_status).all()
    mapped = {str(status or 'pending').lower(): int(count) for status, count in rows}
    return [
        {'status': 'Pago', 'value': mapped.get('paid', 0)},
        {'status': 'Pendente', 'value': mapped.get('pending', 0)},
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
