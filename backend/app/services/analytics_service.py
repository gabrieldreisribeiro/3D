import json
from datetime import datetime, timedelta
import logging

from sqlalchemy import func, inspect
from sqlalchemy.orm import Session

from app.models import Order, OrderItem, Product, UserEvent

logger = logging.getLogger('analytics')

CANONICAL_EVENT = {
    'view_product': 'product_view',
    'click_product': 'product_click',
    'update_cart': 'update_cart_quantity',
    'send_whatsapp': 'whatsapp_click',
}

FUNNEL_STEPS = [
    ('product_view', 'Visualizacoes'),
    ('product_click', 'Cliques'),
    ('add_to_cart', 'Carrinho'),
    ('start_checkout', 'Checkout'),
    ('whatsapp_click', 'WhatsApp'),
]


def _aliases(event_type: str) -> list[str]:
    canonical = CANONICAL_EVENT.get(event_type, event_type)
    aliases = [canonical]
    reverse_aliases = [key for key, value in CANONICAL_EVENT.items() if value == canonical]
    return list(dict.fromkeys(aliases + reverse_aliases))


def create_user_event(
    db: Session,
    payload,
    *,
    ip_address: str | None = None,
    country: str | None = None,
    state: str | None = None,
    city: str | None = None,
) -> UserEvent:
    normalized_event_type = CANONICAL_EVENT.get(payload.event_type, payload.event_type)
    event = UserEvent(
        event_type=normalized_event_type,
        product_id=payload.product_id,
        category_id=payload.category_id,
        session_id=payload.session_id,
        user_identifier=payload.user_identifier,
        page_url=payload.page_url,
        source_channel=payload.source_channel,
        referrer=payload.referrer,
        cta_name=payload.cta_name,
        ip_address=ip_address,
        country=country,
        state=state,
        city=city,
        metadata_json=json.dumps(payload.metadata_json or {}, ensure_ascii=False),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def parse_metadata(raw: str | None) -> dict:
    if not raw:
        return {}


def _has_order_column(db: Session, column_name: str) -> bool:
    try:
        inspector = inspect(db.bind)
        columns = inspector.get_columns('orders')
        names = {str(column.get('name') or '').strip().lower() for column in columns}
        return str(column_name or '').strip().lower() in names
    except Exception:  # noqa: BLE001
        return False


def _table_columns(db: Session, table_name: str) -> set[str]:
    try:
        inspector = inspect(db.bind)
        columns = inspector.get_columns(table_name)
        return {str(column.get('name') or '').strip().lower() for column in columns}
    except Exception:  # noqa: BLE001
        return set()
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def analytics_summary(db: Session, date_from: datetime | None = None, date_to: datetime | None = None) -> dict:
    orders_query = db.query(Order)
    order_items_query = db.query(OrderItem).join(Order, Order.id == OrderItem.order_id)
    if date_from:
        orders_query = orders_query.filter(Order.created_at >= date_from)
        order_items_query = order_items_query.filter(Order.created_at >= date_from)
    if date_to:
        orders_query = orders_query.filter(Order.created_at <= date_to)
        order_items_query = order_items_query.filter(Order.created_at <= date_to)

    total_orders = int(orders_query.with_entities(func.count(Order.id)).scalar() or 0)
    total_items_sold = int(order_items_query.with_entities(func.coalesce(func.sum(OrderItem.quantity), 0)).scalar() or 0)
    estimated_total_value = float(orders_query.with_entities(func.coalesce(func.sum(Order.total), 0.0)).scalar() or 0.0)

    add_query = db.query(UserEvent.session_id).filter(UserEvent.event_type.in_(_aliases('add_to_cart')))
    whatsapp_query = db.query(UserEvent.session_id).filter(UserEvent.event_type.in_(_aliases('whatsapp_click')))
    if date_from:
        add_query = add_query.filter(UserEvent.created_at >= date_from)
        whatsapp_query = whatsapp_query.filter(UserEvent.created_at >= date_from)
    if date_to:
        add_query = add_query.filter(UserEvent.created_at <= date_to)
        whatsapp_query = whatsapp_query.filter(UserEvent.created_at <= date_to)

    add_sessions = {row[0] for row in add_query.distinct().all() if row[0]}
    whatsapp_sessions = {row[0] for row in whatsapp_query.distinct().all() if row[0]}
    conversion = 0.0
    if add_sessions:
        conversion = (len(add_sessions & whatsapp_sessions) / len(add_sessions)) * 100

    # Localidade por sessao (ultimo evento conhecido da sessao).
    location_by_session: dict[str, tuple[str, str, str]] = {}
    event_columns = _table_columns(db, 'user_events')
    has_geo_columns = {'country', 'state', 'city'}.issubset(event_columns)
    session_query = db.query(UserEvent.session_id, UserEvent.created_at).filter(UserEvent.session_id.isnot(None))
    if has_geo_columns:
        session_query = db.query(
            UserEvent.session_id,
            UserEvent.country,
            UserEvent.state,
            UserEvent.city,
            UserEvent.created_at,
        ).filter(UserEvent.session_id.isnot(None))
    if date_from:
        session_query = session_query.filter(UserEvent.created_at >= date_from)
    if date_to:
        session_query = session_query.filter(UserEvent.created_at <= date_to)
    session_events = session_query.order_by(UserEvent.created_at.asc()).all()

    if not has_geo_columns:
        session_events = [(row[0], None, None, None, row[1]) for row in session_events]

    for session_id, country, state, city, _created_at in session_events:
        sid = str(session_id or '').strip()
        if not sid:
            continue
        location_by_session[sid] = (
            str(country or '').strip() or 'Desconhecido',
            str(state or '').strip() or 'Desconhecido',
            str(city or '').strip() or 'Desconhecido',
        )

    country_counts: dict[str, int] = {}
    state_counts: dict[str, int] = {}
    city_counts: dict[str, int] = {}
    for country, state, city in location_by_session.values():
        country_counts[country] = country_counts.get(country, 0) + 1
        state_counts[state] = state_counts.get(state, 0) + 1
        city_counts[city] = city_counts.get(city, 0) + 1

    def _top_map(data: dict[str, int], limit: int = 5) -> list[dict]:
        return [
            {'label': label, 'value': value}
            for label, value in sorted(data.items(), key=lambda item: item[1], reverse=True)[:limit]
        ]

    normalized_methods = {
        'whatsapp': {'label': 'WhatsApp', 'orders': 0, 'total': 0.0},
        'pix': {'label': 'Pix', 'orders': 0, 'total': 0.0},
        'credit_card': {'label': 'Cartao', 'orders': 0, 'total': 0.0},
    }
    if _has_order_column(db, 'payment_method'):
        try:
            payment_rows = db.query(
                func.coalesce(Order.payment_method, 'whatsapp').label('payment_method'),
                func.count(Order.id).label('orders_count'),
                func.coalesce(func.sum(Order.total), 0.0).label('total_value'),
            )
            if date_from:
                payment_rows = payment_rows.filter(Order.created_at >= date_from)
            if date_to:
                payment_rows = payment_rows.filter(Order.created_at <= date_to)
            payment_rows = payment_rows.group_by(func.coalesce(Order.payment_method, 'whatsapp')).all()
            for method, count, total_value in payment_rows:
                key = str(method or 'whatsapp').strip().lower()
                if key in {'card', 'credit'}:
                    key = 'credit_card'
                if key not in normalized_methods:
                    continue
                normalized_methods[key]['orders'] = int(count or 0)
                normalized_methods[key]['total'] = float(total_value or 0.0)
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            logger.exception('analytics_summary payment split fallback due to error: %s', exc)

    grand_total = sum(item['total'] for item in normalized_methods.values())
    payment_method_counts = [
        {'label': item['label'], 'value': float(item['orders'])}
        for item in normalized_methods.values()
    ]
    payment_method_values = [
        {'label': item['label'], 'value': float(item['total'])}
        for item in normalized_methods.values()
    ]
    payment_method_share = [
        {'label': item['label'], 'value': round(((item['total'] / grand_total) * 100) if grand_total else 0.0, 2)}
        for item in normalized_methods.values()
    ]

    return {
        'total_orders': total_orders,
        'total_items_sold': total_items_sold,
        'estimated_total_value': estimated_total_value,
        'conversion_add_to_whatsapp': round(conversion, 2),
        'geolocated_sessions': len(location_by_session),
        'top_countries': _top_map(country_counts),
        'top_states': _top_map(state_counts),
        'top_cities': _top_map(city_counts),
        'payment_method_counts': payment_method_counts,
        'payment_method_values': payment_method_values,
        'payment_method_share': payment_method_share,
        'whatsapp_orders': int(normalized_methods['whatsapp']['orders']),
        'pix_orders': int(normalized_methods['pix']['orders']),
        'credit_card_orders': int(normalized_methods['credit_card']['orders']),
        'whatsapp_total': float(normalized_methods['whatsapp']['total']),
        'pix_total': float(normalized_methods['pix']['total']),
        'credit_card_total': float(normalized_methods['credit_card']['total']),
    }


def analytics_funnel(db: Session, date_from: datetime | None = None, date_to: datetime | None = None) -> list[dict]:
    points = []
    for event_type, label in FUNNEL_STEPS:
        query = db.query(func.count(func.distinct(UserEvent.session_id))).filter(UserEvent.event_type.in_(_aliases(event_type)))
        if date_from:
            query = query.filter(UserEvent.created_at >= date_from)
        if date_to:
            query = query.filter(UserEvent.created_at <= date_to)
        value = int(query.scalar() or 0)
        points.append({'step': label, 'value': value})
    return points


def _event_product_ranking(
    db: Session,
    event_type: str,
    limit: int = 10,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[dict]:
    query = (
        db.query(UserEvent.product_id, Product.title, func.count(UserEvent.id).label('value'))
        .outerjoin(Product, Product.id == UserEvent.product_id)
        .filter(UserEvent.event_type.in_(_aliases(event_type)))
    )
    if date_from:
        query = query.filter(UserEvent.created_at >= date_from)
    if date_to:
        query = query.filter(UserEvent.created_at <= date_to)
    rows = query.group_by(UserEvent.product_id, Product.title).order_by(func.count(UserEvent.id).desc()).limit(limit).all()
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


def analytics_products(db: Session, date_from: datetime | None = None, date_to: datetime | None = None) -> dict:
    return {
        'most_viewed': _event_product_ranking(db, 'product_view', limit=10, date_from=date_from, date_to=date_to),
        'most_added': _event_product_ranking(db, 'add_to_cart', limit=10, date_from=date_from, date_to=date_to),
        'most_sold': _sold_product_ranking(db, limit=10, date_from=date_from, date_to=date_to),
    }


def parse_period(date_from: str | None, date_to: str | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.fromisoformat(date_from) if date_from else None
    end = datetime.fromisoformat(date_to) if date_to else None
    if end:
        end = end + timedelta(days=1) - timedelta(microseconds=1)
    return start, end


def report_sales(
    db: Session,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    payment_method: str | None = None,
) -> dict:
    normalized_method = str(payment_method or '').strip().lower() or None
    if normalized_method in {'card', 'credit'}:
        normalized_method = 'credit_card'
    query = db.query(
        func.count(Order.id).label('orders'),
        func.coalesce(func.sum(Order.total), 0.0).label('total'),
    )
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    can_filter_by_payment_method = _has_order_column(db, 'payment_method')
    if normalized_method and can_filter_by_payment_method:
        query = query.filter(func.coalesce(Order.payment_method, 'whatsapp') == normalized_method)
    row = query.first()
    order_count = int(row[0] or 0)
    total_value = float(row[1] or 0.0)
    avg_ticket = total_value / order_count if order_count else 0.0

    labels = {'whatsapp': 'WhatsApp', 'pix': 'Pix', 'credit_card': 'Cartao'}
    totals_by_method: dict[str, float] = {'whatsapp': 0.0, 'pix': 0.0, 'credit_card': 0.0}
    count_by_method: dict[str, int] = {'whatsapp': 0, 'pix': 0, 'credit_card': 0}
    if can_filter_by_payment_method:
        try:
            payment_query = db.query(
                func.coalesce(Order.payment_method, 'whatsapp').label('payment_method'),
                func.count(Order.id).label('orders_count'),
                func.coalesce(func.sum(Order.total), 0.0).label('total_value'),
            )
            if date_from:
                payment_query = payment_query.filter(Order.created_at >= date_from)
            if date_to:
                payment_query = payment_query.filter(Order.created_at <= date_to)
            if normalized_method:
                payment_query = payment_query.filter(func.coalesce(Order.payment_method, 'whatsapp') == normalized_method)
            payment_rows = payment_query.group_by(func.coalesce(Order.payment_method, 'whatsapp')).all()
            for method, count, total in payment_rows:
                key = str(method or 'whatsapp').strip().lower()
                if key in {'card', 'credit'}:
                    key = 'credit_card'
                if key not in totals_by_method:
                    continue
                totals_by_method[key] = float(total or 0.0)
                count_by_method[key] = int(count or 0)
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            logger.exception('report_sales payment split fallback due to error: %s', exc)

    return {
        'total_value': total_value,
        'order_count': order_count,
        'avg_ticket': round(avg_ticket, 2),
        'by_payment_method': [{'label': labels[key], 'value': float(totals_by_method[key])} for key in ['whatsapp', 'pix', 'credit_card']],
        'avg_ticket_by_method': [
            {
                'label': labels[key],
                'value': round((totals_by_method[key] / count_by_method[key]), 2) if count_by_method[key] else 0.0,
            }
            for key in ['whatsapp', 'pix', 'credit_card']
        ],
    }


def report_top_products(
    db: Session,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    payment_method: str | None = None,
) -> list[dict]:
    normalized_method = str(payment_method or '').strip().lower() or None
    if normalized_method in {'card', 'credit'}:
        normalized_method = 'credit_card'
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
    if normalized_method and _has_order_column(db, 'payment_method'):
        query = query.filter(func.coalesce(Order.payment_method, 'whatsapp') == normalized_method)
    rows = (
        query.group_by(Product.id, OrderItem.title)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(20)
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


def report_leads(db: Session, date_from: datetime | None = None, date_to: datetime | None = None) -> dict:
    query = db.query(UserEvent).filter(UserEvent.event_type.in_(_aliases('whatsapp_click')))
    if date_from:
        query = query.filter(UserEvent.created_at >= date_from)
    if date_to:
        query = query.filter(UserEvent.created_at <= date_to)

    items = query.order_by(UserEvent.created_at.desc()).limit(200).all()
    lead_sessions = {item.session_id for item in items if item.session_id}

    top_products = (
        db.query(UserEvent.product_id, Product.title, func.count(UserEvent.id))
        .outerjoin(Product, Product.id == UserEvent.product_id)
        .filter(UserEvent.event_type.in_(_aliases('whatsapp_click')))
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
