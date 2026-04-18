import json
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import Order, OrderItem, Product, UserEvent

EVENT_ALIASES = {
    'product_view': {'product_view', 'view_product'},
    'product_click': {'product_click', 'click_product'},
    'add_to_cart': {'add_to_cart'},
    'remove_from_cart': {'remove_from_cart'},
    'update_cart_quantity': {'update_cart_quantity', 'update_cart'},
    'start_checkout': {'start_checkout'},
    'whatsapp_click': {'whatsapp_click', 'send_whatsapp'},
    'order_created': {'order_created'},
    'category_click': {'category_click'},
    'banner_click': {'banner_click'},
    'cta_click': {'cta_click'},
    'search': {'search'},
    'filter_apply': {'filter_apply'},
    'page_view': {'page_view'},
}

SCORING_WEIGHTS = {
    'product_view': 1,
    'product_click': 2,
    'add_to_cart': 4,
    'start_checkout': 6,
    'whatsapp_click': 8,
    'order_created': 9,
}

FUNNEL_STEPS = [
    ('product_view', 'Visualizacao produto'),
    ('product_click', 'Clique produto'),
    ('add_to_cart', 'Add ao carrinho'),
    ('start_checkout', 'Inicio checkout'),
    ('whatsapp_click', 'Clique WhatsApp'),
    ('order_created', 'Pedido criado'),
]


def parse_period(date_from: str | None, date_to: str | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.fromisoformat(date_from) if date_from else None
    end = datetime.fromisoformat(date_to) if date_to else None
    if end:
        end = end + timedelta(days=1) - timedelta(microseconds=1)
    return start, end


def _normalize_source(value: str | None, referrer: str | None) -> str:
    source = str(value or '').strip().lower()
    if source:
        return source
    ref = str(referrer or '').lower()
    if 'instagram' in ref:
        return 'instagram'
    if 'facebook' in ref or 'fb.' in ref:
        return 'facebook'
    if 'google' in ref:
        return 'google'
    if 'whatsapp' in ref:
        return 'whatsapp'
    if ref:
        return 'referral'
    return 'direto'


def _event_in(event_type: str, canonical: str) -> bool:
    return str(event_type or '').strip().lower() in EVENT_ALIASES.get(canonical, set())


def _parse_metadata(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def _lead_level(score: int) -> str:
    if score >= 14:
        return 'hot'
    if score >= 6:
        return 'warm'
    return 'cold'


def _events_query(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
):
    query = db.query(UserEvent).outerjoin(Product, Product.id == UserEvent.product_id)
    if date_from:
        query = query.filter(UserEvent.created_at >= date_from)
    if date_to:
        query = query.filter(UserEvent.created_at <= date_to)
    if product_id:
        query = query.filter(UserEvent.product_id == product_id)
    if category_id:
        query = query.filter(or_(UserEvent.category_id == category_id, Product.category_id == category_id))
    if source_channel:
        normalized = str(source_channel).strip().lower()
        query = query.filter(func.lower(func.coalesce(UserEvent.source_channel, '')) == normalized)
    return query


def _build_session_map(events: list[UserEvent]) -> dict[str, dict]:
    sessions: dict[str, dict] = {}
    for event in events:
        sid = str(event.session_id or '').strip()
        if not sid:
            continue
        entry = sessions.setdefault(
            sid,
            {
                'score': 0,
                'events': [],
                'last_activity': None,
                'sources': [],
                'views': set(),
                'clicks': set(),
                'add_to_cart': 0,
                'checkout_started': False,
                'whatsapp_clicked': False,
                'order_created': False,
                'estimated_interest_value': 0.0,
                'by_product_add': defaultdict(int),
                'by_product_whatsapp': defaultdict(int),
                'by_product_order': defaultdict(int),
            },
        )
        entry['events'].append(event)
        entry['last_activity'] = event.created_at if not entry['last_activity'] or (event.created_at and event.created_at > entry['last_activity']) else entry['last_activity']
        source = _normalize_source(event.source_channel, event.referrer)
        if source:
            entry['sources'].append(source)

        metadata = _parse_metadata(event.metadata_json)
        event_type = str(event.event_type or '').lower()
        for canonical, weight in SCORING_WEIGHTS.items():
            if _event_in(event_type, canonical):
                entry['score'] += weight

        if _event_in(event_type, 'product_view') and event.product_id:
            entry['views'].add(event.product_id)
        if _event_in(event_type, 'product_click') and event.product_id:
            entry['clicks'].add(event.product_id)
        if _event_in(event_type, 'add_to_cart'):
            entry['add_to_cart'] += 1
            if event.product_id:
                entry['by_product_add'][event.product_id] += 1
            qty = float(metadata.get('quantity') or 1)
            price = float(metadata.get('unit_price') or metadata.get('line_total') or 0)
            entry['estimated_interest_value'] += max(0.0, qty * price)
        if _event_in(event_type, 'start_checkout'):
            entry['checkout_started'] = True
        if _event_in(event_type, 'whatsapp_click'):
            entry['whatsapp_clicked'] = True
            if event.product_id:
                entry['by_product_whatsapp'][event.product_id] += 1
        if _event_in(event_type, 'order_created'):
            entry['order_created'] = True
            if event.product_id:
                entry['by_product_order'][event.product_id] += 1

    return sessions


def _product_sales_map(db: Session, *, date_from: datetime | None = None, date_to: datetime | None = None):
    query = (
        db.query(
            Product.id.label('product_id'),
            Product.title.label('title'),
            func.sum(OrderItem.quantity).label('orders'),
            func.sum(OrderItem.line_total).label('total_value'),
        )
        .join(Product, Product.slug == OrderItem.product_slug)
        .join(Order, Order.id == OrderItem.order_id)
    )
    if date_from:
        query = query.filter(Order.created_at >= date_from)
    if date_to:
        query = query.filter(Order.created_at <= date_to)
    rows = query.group_by(Product.id, Product.title).all()
    return {
        int(row.product_id): {
            'product_id': int(row.product_id),
            'product_title': row.title or f'Produto #{row.product_id}',
            'orders': int(row.orders or 0),
            'estimated_value': float(row.total_value or 0.0),
        }
        for row in rows
    }


def _base_product_metrics(db: Session, events: list[UserEvent], sessions: dict[str, dict], date_from: datetime | None, date_to: datetime | None):
    metrics: dict[int, dict] = {}
    for event in events:
        if not event.product_id:
            continue
        item = metrics.setdefault(
            int(event.product_id),
            {
                'product_id': int(event.product_id),
                'product_title': event.product.title if event.product else f'Produto #{event.product_id}',
                'views': 0,
                'clicks': 0,
                'add_to_cart': 0,
                'whatsapp_click': 0,
                'orders': 0,
                'abandoned_sessions': 0,
                'conversion_rate': 0.0,
                'estimated_value': 0.0,
                'product_label': '',
            },
        )
        event_type = str(event.event_type or '').lower()
        if _event_in(event_type, 'product_view'):
            item['views'] += 1
        if _event_in(event_type, 'product_click'):
            item['clicks'] += 1
        if _event_in(event_type, 'add_to_cart'):
            item['add_to_cart'] += 1
        if _event_in(event_type, 'whatsapp_click'):
            item['whatsapp_click'] += 1

    sales_map = _product_sales_map(db, date_from=date_from, date_to=date_to)
    for pid, sales in sales_map.items():
        item = metrics.setdefault(
            pid,
            {
                'product_id': pid,
                'product_title': sales['product_title'],
                'views': 0,
                'clicks': 0,
                'add_to_cart': 0,
                'whatsapp_click': 0,
                'orders': 0,
                'abandoned_sessions': 0,
                'conversion_rate': 0.0,
                'estimated_value': 0.0,
                'product_label': '',
            },
        )
        item['orders'] = sales['orders']
        item['estimated_value'] = sales['estimated_value']

    for sid, session in sessions.items():
        has_whatsapp = session['whatsapp_clicked']
        has_order = session['order_created']
        if has_whatsapp or has_order:
            continue
        for pid in session['by_product_add'].keys():
            item = metrics.setdefault(
                pid,
                {
                    'product_id': pid,
                    'product_title': f'Produto #{pid}',
                    'views': 0,
                    'clicks': 0,
                    'add_to_cart': 0,
                    'whatsapp_click': 0,
                    'orders': 0,
                    'abandoned_sessions': 0,
                    'conversion_rate': 0.0,
                    'estimated_value': 0.0,
                    'product_label': '',
                },
            )
            item['abandoned_sessions'] += 1

    for item in metrics.values():
        base = item['views'] if item['views'] > 0 else item['add_to_cart']
        item['conversion_rate'] = round(((item['orders'] / base) * 100) if base > 0 else 0.0, 2)

    _apply_product_labels(metrics)
    return metrics


def _apply_product_labels(metrics: dict[int, dict]) -> None:
    if not metrics:
        return
    items = list(metrics.values())
    avg_views = sum(item['views'] for item in items) / len(items)
    avg_orders = sum(item['orders'] for item in items) / len(items)
    avg_add = sum(item['add_to_cart'] for item in items) / len(items)
    avg_whatsapp = sum(item['whatsapp_click'] for item in items) / len(items)
    avg_abandon = sum(item['abandoned_sessions'] for item in items) / len(items)

    for item in items:
        label = ''
        if item['views'] >= avg_views and item['orders'] <= avg_orders and item['views'] > 0:
            label = 'Ima de clique'
        if item['views'] <= avg_views and item['orders'] > avg_orders and item['conversion_rate'] >= 20:
            label = 'Bom de conversao'
        if item['add_to_cart'] >= avg_add and item['add_to_cart'] > 0:
            label = 'Campeao de interesse'
        if item['whatsapp_click'] >= avg_whatsapp and item['orders'] >= avg_orders and item['orders'] > 0:
            label = 'Campeao de fechamento'
        if item['abandoned_sessions'] >= avg_abandon and item['abandoned_sessions'] > 0:
            label = 'Produto problema'
        item['product_label'] = label


def _sort_top(metrics: dict[int, dict], key: str, limit: int = 10, reverse: bool = True):
    return sorted(metrics.values(), key=lambda item: item.get(key, 0), reverse=reverse)[:limit]


def leads_conversion_summary(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
):
    events = _events_query(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    ).all()
    sessions = _build_session_map(events)
    leads_cold = sum(1 for data in sessions.values() if _lead_level(data['score']) == 'cold')
    leads_warm = sum(1 for data in sessions.values() if _lead_level(data['score']) == 'warm')
    leads_hot = sum(1 for data in sessions.values() if _lead_level(data['score']) == 'hot')

    counts = defaultdict(int)
    for event in events:
        event_type = str(event.event_type or '').lower()
        if _event_in(event_type, 'product_view'):
            counts['product_views'] += 1
        if _event_in(event_type, 'product_click'):
            counts['product_clicks'] += 1
        if _event_in(event_type, 'add_to_cart'):
            counts['add_to_cart'] += 1
        if _event_in(event_type, 'start_checkout'):
            counts['checkout_starts'] += 1
        if _event_in(event_type, 'whatsapp_click'):
            counts['whatsapp_clicks'] += 1
        if _event_in(event_type, 'order_created'):
            counts['orders_created'] += 1

    total_orders = int(db.query(func.count(Order.id)).scalar() or 0)
    total_value = float(db.query(func.coalesce(func.sum(Order.total), 0.0)).scalar() or 0.0)
    estimated_ticket = round(total_value / total_orders, 2) if total_orders else 0.0
    estimated_whatsapp_value = round(counts['whatsapp_clicks'] * estimated_ticket, 2)

    sessions_count = len(sessions)
    conversion_to_whatsapp = round((counts['whatsapp_clicks'] / sessions_count) * 100, 2) if sessions_count else 0.0
    conversion_add_to_whatsapp = round((counts['whatsapp_clicks'] / counts['add_to_cart']) * 100, 2) if counts['add_to_cart'] else 0.0

    return {
        'sessions': sessions_count,
        'leads_cold': leads_cold,
        'leads_warm': leads_warm,
        'leads_hot': leads_hot,
        'product_views': counts['product_views'],
        'product_clicks': counts['product_clicks'],
        'add_to_cart': counts['add_to_cart'],
        'checkout_starts': counts['checkout_starts'],
        'whatsapp_clicks': counts['whatsapp_clicks'],
        'orders_created': counts['orders_created'],
        'conversion_to_whatsapp': conversion_to_whatsapp,
        'conversion_add_to_whatsapp': conversion_add_to_whatsapp,
        'estimated_ticket': estimated_ticket,
        'estimated_whatsapp_value': estimated_whatsapp_value,
    }


def leads_conversion_funnel(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
):
    events = _events_query(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    ).all()
    by_step: dict[str, set] = {key: set() for key, _ in FUNNEL_STEPS}
    for event in events:
        sid = str(event.session_id or '').strip()
        if not sid:
            continue
        event_type = str(event.event_type or '').lower()
        for key, _label in FUNNEL_STEPS:
            if _event_in(event_type, key):
                by_step[key].add(sid)

    steps = []
    previous_value = None
    for key, label in FUNNEL_STEPS:
        value = len(by_step[key])
        if previous_value is None:
            step_conversion = 100.0 if value else 0.0
            dropoff = 0
        else:
            step_conversion = round((value / previous_value) * 100, 2) if previous_value else 0.0
            dropoff = max(previous_value - value, 0)
        steps.append(
            {
                'key': key,
                'label': label,
                'value': value,
                'step_conversion': step_conversion,
                'dropoff': dropoff,
            }
        )
        previous_value = value
    return {'steps': steps}


def leads_conversion_products(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
):
    events = _events_query(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    ).all()
    sessions = _build_session_map(events)
    metrics = _base_product_metrics(db, events, sessions, date_from, date_to)
    return {
        'most_viewed': _sort_top(metrics, 'views', 10),
        'most_clicked': _sort_top(metrics, 'clicks', 10),
        'most_added': _sort_top(metrics, 'add_to_cart', 10),
        'most_whatsapp': _sort_top(metrics, 'whatsapp_click', 10),
        'most_purchased': _sort_top(metrics, 'orders', 10),
        'most_abandoned': _sort_top(metrics, 'abandoned_sessions', 10),
        'best_conversion': _sort_top(metrics, 'conversion_rate', 10),
        'highest_estimated_value': _sort_top(metrics, 'estimated_value', 10),
    }


def leads_conversion_ctas(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
):
    events = _events_query(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    ).all()
    total_sessions = len({event.session_id for event in events if event.session_id})
    counts = defaultdict(int)
    for event in events:
        event_type = str(event.event_type or '').lower()
        if not (
            _event_in(event_type, 'cta_click')
            or _event_in(event_type, 'banner_click')
            or _event_in(event_type, 'category_click')
            or _event_in(event_type, 'whatsapp_click')
            or _event_in(event_type, 'add_to_cart')
        ):
            continue
        key = str(event.cta_name or event.event_type or 'cta').strip().lower()
        counts[key] += 1

    items = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    mapped = [
        {
            'cta_name': name,
            'clicks': value,
            'ctr': round((value / total_sessions) * 100, 2) if total_sessions else 0.0,
        }
        for name, value in items
    ]
    return {
        'total_cta_clicks': int(sum(counts.values())),
        'top_cta': mapped[0]['cta_name'] if mapped else None,
        'items': mapped[:30],
    }


def leads_conversion_leads(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
    lead_level: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    events = _events_query(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    ).all()
    sessions = _build_session_map(events)
    rows = []
    for session_id, data in sessions.items():
        level = _lead_level(data['score'])
        if lead_level and level != str(lead_level).lower():
            continue
        source = data['sources'][-1] if data['sources'] else None
        rows.append(
            {
                'session_id': session_id,
                'lead_level': level,
                'score': int(data['score']),
                'last_activity': data['last_activity'],
                'viewed_products': len(data['views']),
                'clicked_products': len(data['clicks']),
                'add_to_cart': int(data['add_to_cart']),
                'checkout_started': bool(data['checkout_started']),
                'whatsapp_clicked': bool(data['whatsapp_clicked']),
                'estimated_interest_value': round(float(data['estimated_interest_value']), 2),
                'source_channel': source,
            }
        )
    rows.sort(key=lambda item: (item['last_activity'] is not None, item['last_activity']), reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    paginated = rows[start : start + page_size]
    return {'items': paginated, 'total': total, 'page': page, 'page_size': page_size}


def leads_conversion_sources(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
):
    events = _events_query(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    ).all()
    sessions = _build_session_map(events)
    buckets = defaultdict(lambda: {'sessions': 0, 'leads': 0, 'whatsapp_clicks': 0})
    for sid, data in sessions.items():
        source = data['sources'][-1] if data['sources'] else 'direto'
        bucket = buckets[source]
        bucket['sessions'] += 1
        level = _lead_level(data['score'])
        if level in {'warm', 'hot'}:
            bucket['leads'] += 1
        if data['whatsapp_clicked']:
            bucket['whatsapp_clicks'] += 1

    items = []
    for source, values in buckets.items():
        sessions_count = values['sessions']
        items.append(
            {
                'source_channel': source,
                'sessions': sessions_count,
                'leads': values['leads'],
                'whatsapp_clicks': values['whatsapp_clicks'],
                'conversion_to_whatsapp': round((values['whatsapp_clicks'] / sessions_count) * 100, 2) if sessions_count else 0.0,
            }
        )
    items.sort(key=lambda item: item['sessions'], reverse=True)
    return {'items': items}


def leads_conversion_abandonment(
    db: Session,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
    source_channel: str | None = None,
):
    events = _events_query(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    ).all()
    sessions = _build_session_map(events)
    abandoned_sessions = 0
    high_intent_without_whatsapp = 0
    high_intent_without_order = 0
    for _sid, data in sessions.items():
        has_add = data['add_to_cart'] > 0
        has_whatsapp = data['whatsapp_clicked']
        has_order = data['order_created']
        level = _lead_level(data['score'])
        if has_add and not has_whatsapp and not has_order:
            abandoned_sessions += 1
        if level == 'hot' and not has_whatsapp:
            high_intent_without_whatsapp += 1
        if level == 'hot' and not has_order:
            high_intent_without_order += 1

    product_data = leads_conversion_products(
        db,
        date_from=date_from,
        date_to=date_to,
        category_id=category_id,
        product_id=product_id,
        source_channel=source_channel,
    )
    return {
        'abandoned_sessions': abandoned_sessions,
        'high_intent_without_whatsapp': high_intent_without_whatsapp,
        'high_intent_without_order': high_intent_without_order,
        'abandoned_products': product_data['most_abandoned'][:10],
    }
