from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Order, OrderItem


def create_order(db: Session, items, coupon_code, subtotal, discount, total):
    order = Order(subtotal=subtotal, discount=discount, total=total, coupon_code=coupon_code)
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
    total_orders = admin_total_orders(db)
    if total_orders == 0:
        return [
            {'status': 'Concluido', 'value': 0},
            {'status': 'Novo', 'value': 0},
        ]

    return [
        {'status': 'Concluido', 'value': total_orders},
        {'status': 'Novo', 'value': 0},
    ]
