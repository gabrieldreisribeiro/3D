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
