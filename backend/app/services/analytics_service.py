import json
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Order, OrderItem, Product, UserEvent


FUNNEL_STEPS = [
    ('view_product', 'Visualizacoes'),
    ('click_product', 'Cliques'),
    ('add_to_cart', 'Carrinho'),
    ('start_checkout', 'Checkout'),
    ('send_whatsapp', 'WhatsApp'),
]


def create_user_event(db: Session, payload) -> UserEvent:
    event = UserEvent(
        event_type=payload.event_type,
        product_id=payload.product_id,
        session_id=payload.session_id,
        user_identifier=payload.user_identifier,
        metadata_json=json.dumps(payload.metadata_json or {}, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def parse_metadata(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def analytics_summary(db: Session) -> dict:
    total_orders = int(db.query(func.count(Order.id)).scalar() or 0)
    total_items_sold = int(db.query(func.coalesce(func.sum(OrderItem.quantity), 0)).scalar() or 0)
    estimated_total_value = float(db.query(func.coalesce(func.sum(Order.total), 0.0)).scalar() or 0.0)

    add_sessions = {
        row[0]
        for row in db.query(UserEvent.session_id)
        .filter(UserEvent.event_type == 'add_to_cart')
        .distinct()
        .all()
        if row[0]
    }
    whatsapp_sessions = {
        row[0]
        for row in db.query(UserEvent.session_id)
        .filter(UserEvent.event_type == 'send_whatsapp')
        .distinct()
        .all()
        if row[0]
    }
    conversion = 0.0
    if add_sessions:
        conversion = (len(add_sessions & whatsapp_sessions) / len(add_sessions)) * 100

    return {
        'total_orders': total_orders,
        'total_items_sold': total_items_sold,
        'estimated_total_value': estimated_total_value,
        'conversion_add_to_whatsapp': round(conversion, 2),
    }


def analytics_funnel(db: Session) -> list[dict]:
    points = []
    for event_type, label in FUNNEL_STEPS:
        value = int(
            db.query(func.count(func.distinct(UserEvent.session_id)))
            .filter(UserEvent.event_type == event_type)
            .scalar()
            or 0
        )
        points.append({'step': label, 'value': value})
    return points


def _event_product_ranking(db: Session, event_type: str, limit: int = 10) -> list[dict]:
    rows = (
        db.query(UserEvent.product_id, Product.title, func.count(UserEvent.id).label('value'))
        .outerjoin(Product, Product.id == UserEvent.product_id)
        .filter(UserEvent.event_type == event_type)
        .group_by(UserEvent.product_id, Product.title)
        .order_by(func.count(UserEvent.id).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            'product_id': row[0],
            'product_title': row[1] or f'Produto #{row[0]}' if row[0] else 'Produto nao identificado',
            'value': int(row[2] or 0),
            'total_value': None,
        }
        for row in rows
    ]


def _sold_product_ranking(db: Session, limit: int = 10, date_from: datetime | None = None, date_to: datetime | None = None) -> list[dict]:
    query = (
        db.query(
            Product.id,
            OrderItem.title,
            func.sum(OrderItem.quantity).label('qty'),
            func.sum(OrderItem.line_total).label('total_value'),
        )
        .outerjoin(Product, Product.slug == OrderItem.product_slug)
        .join(Order, Order.id == OrderItem.order_id)
    )
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    if date_to:
        query = query.filter(Order.created_at <= date_to)

    rows = (
        query.group_by(Product.id, OrderItem.title)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            'product_id': row[0],
            'product_title': row[1] or f'Produto #{row[0]}' if row[0] else 'Produto nao identificado',
            'value': int(row[2] or 0),
            'total_value': float(row[3] or 0.0),
        }
        for row in rows
    ]


def analytics_products(db: Session) -> dict:
    return {
        'most_viewed': _event_product_ranking(db, 'view_product', limit=10),
        'most_added': _event_product_ranking(db, 'add_to_cart', limit=10),
        'most_sold': _sold_product_ranking(db, limit=10),
    }


def parse_period(date_from: str | None, date_to: str | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.fromisoformat(date_from) if date_from else None
    end = datetime.fromisoformat(date_to) if date_to else None
    if end:
        end = end + timedelta(days=1) - timedelta(microseconds=1)
    return start, end


def report_sales(db: Session, date_from: datetime | None = None, date_to: datetime | None = None) -> dict:
    query = db.query(
        func.count(Order.id).label('orders'),
        func.coalesce(func.sum(Order.total), 0.0).label('total'),
    )
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    row = query.first()
    order_count = int(row[0] or 0)
    total_value = float(row[1] or 0.0)
    avg_ticket = total_value / order_count if order_count else 0.0
    return {
        'total_value': total_value,
        'order_count': order_count,
        'avg_ticket': round(avg_ticket, 2),
    }


def report_top_products(db: Session, date_from: datetime | None = None, date_to: datetime | None = None) -> list[dict]:
    return _sold_product_ranking(db, limit=20, date_from=date_from, date_to=date_to)


def report_leads(db: Session, date_from: datetime | None = None, date_to: datetime | None = None) -> dict:
    query = db.query(UserEvent).filter(UserEvent.event_type == 'send_whatsapp')
    if date_from:
        query = query.filter(UserEvent.created_at >= date_from)
    if date_to:
        query = query.filter(UserEvent.created_at <= date_to)

    items = query.order_by(UserEvent.created_at.desc()).limit(200).all()
    lead_sessions = {item.session_id for item in items if item.session_id}

    top_products = (
        db.query(UserEvent.product_id, Product.title, func.count(UserEvent.id))
        .outerjoin(Product, Product.id == UserEvent.product_id)
        .filter(UserEvent.event_type == 'send_whatsapp')
    )
    if date_from:
        top_products = top_products.filter(UserEvent.created_at >= date_from)
    if date_to:
        top_products = top_products.filter(UserEvent.created_at <= date_to)
    top_products = (
        top_products.group_by(UserEvent.product_id, Product.title)
        .order_by(func.count(UserEvent.id).desc())
        .limit(10)
        .all()
    )

    return {
        'total_leads': len(lead_sessions),
        'items': [
            {
                'session_id': item.session_id,
                'created_at': item.created_at,
                'event_type': item.event_type,
                'product_id': item.product_id,
                'product_title': item.product.title if item.product else None,
            }
            for item in items
        ],
        'top_products': [
            {
                'product_id': row[0],
                'product_title': row[1] or f'Produto #{row[0]}' if row[0] else 'Produto nao identificado',
                'value': int(row[2] or 0),
                'total_value': None,
            }
            for row in top_products
        ],
    }
