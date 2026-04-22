from __future__ import annotations

from datetime import datetime, timedelta

from app.models import Order


def _is_paid_status(value: str | None) -> bool:
    return str(value or '').strip().lower() == 'paid'


def _max_production_days(order: Order) -> int:
    values = []
    for item in order.items or []:
        try:
            values.append(int(item.production_days_snapshot or 0))
        except Exception:  # noqa: BLE001
            continue
    safe_values = [value for value in values if value > 0]
    return max(safe_values) if safe_values else 1


def ensure_order_production_estimate(order: Order) -> None:
    if not _is_paid_status(order.payment_status):
        return

    if not str(order.production_status or '').strip():
        order.production_status = 'paid'

    if order.estimated_ready_at is None:
        base_date = order.paid_at or datetime.utcnow()
        order.estimated_ready_at = base_date + timedelta(days=_max_production_days(order))


def set_order_production_status(order: Order, next_status: str) -> None:
    status = str(next_status or '').strip().lower()
    if status not in {'paid', 'in_production', 'ready'}:
        return

    now = datetime.utcnow()
    if status == 'paid':
        order.production_status = 'paid'
        if _is_paid_status(order.payment_status):
            ensure_order_production_estimate(order)
        return

    if status == 'in_production':
        order.production_status = 'in_production'
        if order.production_started_at is None:
            order.production_started_at = now
        if _is_paid_status(order.payment_status):
            ensure_order_production_estimate(order)
        return

    if status == 'ready':
        order.production_status = 'ready'
        if order.production_started_at is None:
            order.production_started_at = now
        if order.ready_at is None:
            order.ready_at = now
        if _is_paid_status(order.payment_status):
            ensure_order_production_estimate(order)
