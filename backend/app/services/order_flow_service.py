from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Order, OrderFlowStage, OrderStageHistory

DEFAULT_ORDER_FLOW_STAGES = [
    {'name': 'Pedido recebido', 'description': 'Pedido criado no sistema', 'color': '#64748B', 'icon_name': 'inbox', 'sort_order': 1, 'is_active': True, 'is_visible_to_customer': True},
    {'name': 'Pago', 'description': 'Pagamento confirmado', 'color': '#16A34A', 'icon_name': 'check-circle', 'sort_order': 2, 'is_active': True, 'is_visible_to_customer': True},
    {'name': 'Em producao', 'description': 'Pedido em producao', 'color': '#2563EB', 'icon_name': 'cog', 'sort_order': 3, 'is_active': True, 'is_visible_to_customer': True},
    {'name': 'Pronto', 'description': 'Pedido pronto para envio/retirada', 'color': '#7C3AED', 'icon_name': 'package-check', 'sort_order': 4, 'is_active': True, 'is_visible_to_customer': True},
    {'name': 'Enviado', 'description': 'Pedido enviado', 'color': '#F59E0B', 'icon_name': 'truck', 'sort_order': 5, 'is_active': True, 'is_visible_to_customer': True},
    {'name': 'Entregue', 'description': 'Pedido finalizado', 'color': '#059669', 'icon_name': 'home', 'sort_order': 6, 'is_active': True, 'is_visible_to_customer': True},
]


def list_order_flow_stages(db: Session, *, active_only: bool = False, customer_visible_only: bool = False) -> list[OrderFlowStage]:
    query = db.query(OrderFlowStage)
    if active_only:
        query = query.filter(OrderFlowStage.is_active == True)
    if customer_visible_only:
        query = query.filter(OrderFlowStage.is_visible_to_customer == True)
    return query.order_by(OrderFlowStage.sort_order.asc(), OrderFlowStage.id.asc()).all()


def ensure_default_order_flow_stages(db: Session) -> list[OrderFlowStage]:
    stages = list_order_flow_stages(db)
    if stages:
        return stages
    for payload in DEFAULT_ORDER_FLOW_STAGES:
        db.add(OrderFlowStage(**payload))
    db.commit()
    return list_order_flow_stages(db)


def get_order_flow_stage_by_id(db: Session, stage_id: int) -> OrderFlowStage | None:
    return db.query(OrderFlowStage).filter(OrderFlowStage.id == stage_id).first()


def get_first_active_stage(db: Session) -> OrderFlowStage | None:
    return (
        db.query(OrderFlowStage)
        .filter(OrderFlowStage.is_active == True)
        .order_by(OrderFlowStage.sort_order.asc(), OrderFlowStage.id.asc())
        .first()
    )


def create_order_flow_stage(
    db: Session,
    *,
    name: str,
    description: str | None = None,
    color: str | None = None,
    icon_name: str | None = None,
    sort_order: int | None = None,
    is_active: bool = True,
    is_visible_to_customer: bool = True,
) -> OrderFlowStage:
    current_max = db.query(OrderFlowStage).count()
    safe_sort = int(sort_order or (current_max + 1))
    stage = OrderFlowStage(
        name=str(name or '').strip(),
        description=str(description or '').strip() or None,
        color=str(color or '').strip() or None,
        icon_name=str(icon_name or '').strip() or None,
        sort_order=max(1, safe_sort),
        is_active=bool(is_active),
        is_visible_to_customer=bool(is_visible_to_customer),
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


def update_order_flow_stage(db: Session, stage: OrderFlowStage, payload: dict) -> OrderFlowStage:
    stage.name = str(payload.get('name') or stage.name).strip()
    stage.description = str(payload.get('description') or '').strip() or None
    stage.color = str(payload.get('color') or '').strip() or None
    stage.icon_name = str(payload.get('icon_name') or '').strip() or None
    if payload.get('sort_order') is not None:
        stage.sort_order = max(1, int(payload.get('sort_order') or 1))
    if payload.get('is_active') is not None:
        stage.is_active = bool(payload.get('is_active'))
    if payload.get('is_visible_to_customer') is not None:
        stage.is_visible_to_customer = bool(payload.get('is_visible_to_customer'))
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


def reorder_order_flow_stages(db: Session, stage_ids: list[int]) -> list[OrderFlowStage]:
    if not stage_ids:
        return list_order_flow_stages(db)
    rows = db.query(OrderFlowStage).filter(OrderFlowStage.id.in_(stage_ids)).all()
    mapped = {int(item.id): item for item in rows}
    for index, stage_id in enumerate(stage_ids, start=1):
        stage = mapped.get(int(stage_id))
        if stage:
            stage.sort_order = index
            db.add(stage)
    db.commit()
    return list_order_flow_stages(db)


def can_delete_order_flow_stage(db: Session, stage_id: int) -> bool:
    linked_orders_total = db.query(Order).filter(Order.current_stage_id == stage_id).count()
    if int(linked_orders_total or 0) > 0:
        return False
    history_total = db.query(OrderStageHistory).filter(OrderStageHistory.stage_id == stage_id).count()
    return int(history_total or 0) == 0


def delete_order_flow_stage(db: Session, stage: OrderFlowStage) -> None:
    db.delete(stage)
    db.commit()


def _safe_stage_tokens(stage: OrderFlowStage | None) -> str:
    if not stage:
        return ''
    return f"{str(stage.name or '').strip().lower()} {str(stage.description or '').strip().lower()}"


def _find_stage_by_keywords(stages: list[OrderFlowStage], keywords: tuple[str, ...]) -> OrderFlowStage | None:
    for stage in stages:
        tokens = _safe_stage_tokens(stage)
        if any(keyword in tokens for keyword in keywords):
            return stage
    return None


def _resolve_automatic_stage_for_order(db: Session, order: Order) -> OrderFlowStage | None:
    stages = list_order_flow_stages(db, active_only=True)
    if not stages:
        return None
    production = str(order.production_status or '').strip().lower()
    payment = str(order.payment_status or '').strip().lower()

    if production == 'ready':
        return _find_stage_by_keywords(stages, ('pronto', 'ready')) or stages[-1]
    if production == 'in_production':
        return _find_stage_by_keywords(stages, ('producao', 'produção', 'in_production', 'produc')) or stages[0]
    if payment == 'paid':
        return _find_stage_by_keywords(stages, ('pago', 'paid')) or stages[0]
    return stages[0]


def _create_stage_history_entry(
    db: Session,
    *,
    order_id: int,
    stage: OrderFlowStage | None = None,
    stage_id: int | None = None,
    moved_by_admin_user_id: int | None = None,
    note: str | None = None,
) -> None:
    resolved_stage_id = int(stage.id) if stage and stage.id else stage_id
    db.add(
        OrderStageHistory(
            order_id=order_id,
            stage_id=resolved_stage_id,
            stage_name_snapshot=(str(stage.name or '').strip() or None) if stage else None,
            stage_description_snapshot=(str(stage.description or '').strip() or None) if stage else None,
            stage_color_snapshot=(str(stage.color or '').strip() or None) if stage else None,
            stage_icon_name_snapshot=(str(stage.icon_name or '').strip() or None) if stage else None,
            stage_sort_order_snapshot=int(stage.sort_order) if stage and stage.sort_order is not None else None,
            stage_visible_to_customer_snapshot=bool(stage.is_visible_to_customer) if stage else None,
            moved_by_admin_user_id=moved_by_admin_user_id,
            note=str(note or '').strip() or None,
        )
    )


def ensure_order_has_stage(db: Session, order: Order, *, note: str | None = None) -> None:
    if order.current_stage_id:
        return
    ensure_default_order_flow_stages(db)
    initial_stage = _resolve_automatic_stage_for_order(db, order) or get_first_active_stage(db)
    if not initial_stage:
        return
    order.current_stage_id = initial_stage.id
    order.current_stage_updated_at = datetime.utcnow()
    db.add(order)
    _create_stage_history_entry(db, order_id=order.id, stage=initial_stage, note=note or 'initial_stage')


def _sort_order(stage: OrderFlowStage | None) -> int:
    return int(stage.sort_order) if stage and stage.sort_order is not None else 0


def move_order_to_stage(
    db: Session,
    *,
    order: Order,
    stage: OrderFlowStage,
    moved_by_admin_user_id: int | None = None,
    note: str | None = None,
    prevent_regression: bool = False,
) -> bool:
    if not stage:
        return False
    if order.current_stage_id == stage.id:
        return False
    current = order.current_stage
    if prevent_regression and current and _sort_order(stage) < _sort_order(current):
        return False
    order.current_stage_id = stage.id
    order.current_stage_updated_at = datetime.utcnow()
    db.add(order)
    _create_stage_history_entry(
        db,
        order_id=order.id,
        stage=stage,
        moved_by_admin_user_id=moved_by_admin_user_id,
        note=note,
    )
    return True


def sync_order_stage_from_business_status(db: Session, order: Order, *, note: str) -> None:
    ensure_default_order_flow_stages(db)
    target = _resolve_automatic_stage_for_order(db, order)
    if not target:
        return
    if not order.current_stage_id:
        ensure_order_has_stage(db, order, note=note)
        return
    move_order_to_stage(
        db,
        order=order,
        stage=target,
        moved_by_admin_user_id=None,
        note=note,
        prevent_regression=True,
    )


def serialize_order_flow_stage(stage: OrderFlowStage) -> dict:
    return {
        'id': stage.id,
        'name': stage.name,
        'description': stage.description,
        'color': stage.color,
        'icon_name': stage.icon_name,
        'sort_order': stage.sort_order,
        'is_active': bool(stage.is_active),
        'is_visible_to_customer': bool(stage.is_visible_to_customer),
        'created_at': stage.created_at,
        'updated_at': stage.updated_at,
    }


def serialize_order_stage_history(entry: OrderStageHistory) -> dict:
    return {
        'id': entry.id,
        'order_id': entry.order_id,
        'stage_id': entry.stage_id,
        'stage_name': entry.stage.name if entry.stage else entry.stage_name_snapshot,
        'stage_color': entry.stage.color if entry.stage else entry.stage_color_snapshot,
        'stage_icon_name': entry.stage.icon_name if entry.stage else entry.stage_icon_name_snapshot,
        'stage_sort_order': entry.stage.sort_order if entry.stage else entry.stage_sort_order_snapshot,
        'stage_visible_to_customer': (
            bool(entry.stage.is_visible_to_customer)
            if entry.stage
            else (bool(entry.stage_visible_to_customer_snapshot) if entry.stage_visible_to_customer_snapshot is not None else None)
        ),
        'moved_by_admin_user_id': entry.moved_by_admin_user_id,
        'note': entry.note,
        'created_at': entry.created_at,
    }


def build_customer_order_timeline(db: Session, order: Order) -> list[dict]:
    configured_stages = list_order_flow_stages(db, active_only=False, customer_visible_only=True)

    history_rows = (
        db.query(OrderStageHistory)
        .filter(OrderStageHistory.order_id == order.id)
        .order_by(OrderStageHistory.created_at.asc(), OrderStageHistory.id.asc())
        .all()
    )
    completed_by_stage_id: dict[int, datetime] = {}
    historical_only_stages: list[dict] = []
    configured_ids = {int(stage.id) for stage in configured_stages}
    for entry in history_rows:
        if entry.stage_id and entry.stage_id not in completed_by_stage_id:
            completed_by_stage_id[entry.stage_id] = entry.created_at
        is_visible_snapshot = (
            bool(entry.stage.is_visible_to_customer)
            if entry.stage
            else bool(entry.stage_visible_to_customer_snapshot)
        )
        if (
            entry.stage_id
            and int(entry.stage_id) not in configured_ids
            and is_visible_snapshot
            and (entry.stage or entry.stage_name_snapshot)
        ):
            historical_only_stages.append(
                {
                    'id': int(entry.stage_id),
                    'name': entry.stage.name if entry.stage else entry.stage_name_snapshot,
                    'description': entry.stage.description if entry.stage else entry.stage_description_snapshot,
                    'color': entry.stage.color if entry.stage else entry.stage_color_snapshot,
                    'icon_name': entry.stage.icon_name if entry.stage else entry.stage_icon_name_snapshot,
                    'sort_order': (
                        int(entry.stage.sort_order)
                        if entry.stage and entry.stage.sort_order is not None
                        else int(entry.stage_sort_order_snapshot or 9999)
                    ),
                }
            )

    dedup_historical: dict[int, dict] = {}
    for stage in historical_only_stages:
        dedup_historical[int(stage['id'])] = stage

    all_stages = [
        *[
            {
                'id': int(stage.id),
                'name': stage.name,
                'description': stage.description,
                'color': stage.color,
                'icon_name': stage.icon_name,
                'sort_order': int(stage.sort_order or 0),
            }
            for stage in configured_stages
        ],
        *dedup_historical.values(),
    ]
    all_stages = sorted(all_stages, key=lambda stage: (int(stage.get('sort_order') or 0), int(stage.get('id') or 0)))
    if not all_stages:
        return []

    current_index = -1
    for index, stage in enumerate(all_stages):
        if int(stage['id']) == int(order.current_stage_id or 0):
            current_index = index
            break

    timeline = []
    for index, stage in enumerate(all_stages):
        completed_at = completed_by_stage_id.get(stage['id'])
        is_current = int(order.current_stage_id or 0) == int(stage['id'])
        if completed_at is None and current_index >= 0 and index < current_index:
            completed_at = order.current_stage_updated_at or order.created_at
        timeline.append(
            {
                'stage_id': stage['id'],
                'name': stage.get('name'),
                'description': stage.get('description'),
                'color': stage.get('color'),
                'icon_name': stage.get('icon_name'),
                'sort_order': stage.get('sort_order'),
                'is_current': is_current,
                'is_completed': bool(completed_at) or (current_index >= 0 and index < current_index),
                'completed_at': completed_at,
            }
        )
    return timeline
