from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import HighlightItem

MAX_ACTIVE_HIGHLIGHTS = 3
ALLOWED_ICON_NAMES = {
    'truck',
    'shield',
    'star',
    'package',
    'gift',
    'clock',
    'sparkles',
    'badge-check',
    'shopping-bag',
    'box',
}


def _normalize_payload(payload):
    title = str(payload.title or '').strip()
    description = str(payload.description or '').strip()
    icon_name = str(payload.icon_name or '').strip().lower()
    sort_order = int(payload.sort_order or 1)
    is_active = bool(payload.is_active)

    if not title:
        raise HTTPException(status_code=400, detail='Titulo e obrigatorio.')
    if not description:
        raise HTTPException(status_code=400, detail='Descricao e obrigatoria.')
    if not icon_name:
        raise HTTPException(status_code=400, detail='Icone e obrigatorio.')
    if icon_name not in ALLOWED_ICON_NAMES:
        raise HTTPException(status_code=400, detail='Icone invalido.')
    if sort_order < 1 or sort_order > 3:
        raise HTTPException(status_code=400, detail='Ordem deve ser entre 1 e 3.')

    return {
        'title': title,
        'description': description,
        'icon_name': icon_name,
        'sort_order': sort_order,
        'is_active': is_active,
    }


def _count_active(db: Session, ignore_id: int | None = None) -> int:
    query = db.query(HighlightItem).filter(HighlightItem.is_active == True)
    if ignore_id:
        query = query.filter(HighlightItem.id != ignore_id)
    return query.count()


def _ensure_active_limit(db: Session, is_active: bool, ignore_id: int | None = None) -> None:
    if not is_active:
        return
    active_count = _count_active(db, ignore_id=ignore_id)
    if active_count >= MAX_ACTIVE_HIGHLIGHTS:
        raise HTTPException(status_code=400, detail='Limite maximo de 3 cards ativos atingido.')


def _resolve_sort_conflict(db: Session, sort_order: int, current_id: int | None = None) -> None:
    existing = (
        db.query(HighlightItem)
        .filter(HighlightItem.sort_order == sort_order)
        .order_by(HighlightItem.id.asc())
        .all()
    )
    for item in existing:
        if current_id and item.id == current_id:
            continue
        item.sort_order = min(3, int(item.sort_order or 1) + 1)
        db.add(item)


def list_admin_highlight_items(db: Session) -> list[HighlightItem]:
    return (
        db.query(HighlightItem)
        .order_by(HighlightItem.sort_order.asc(), HighlightItem.id.asc())
        .all()
    )


def list_public_highlight_items(db: Session) -> list[HighlightItem]:
    return (
        db.query(HighlightItem)
        .filter(HighlightItem.is_active == True)
        .order_by(HighlightItem.sort_order.asc(), HighlightItem.id.asc())
        .limit(MAX_ACTIVE_HIGHLIGHTS)
        .all()
    )


def get_highlight_item_by_id(db: Session, item_id: int) -> HighlightItem | None:
    return db.query(HighlightItem).filter(HighlightItem.id == item_id).first()


def create_highlight_item(db: Session, payload) -> HighlightItem:
    normalized = _normalize_payload(payload)
    _ensure_active_limit(db, normalized['is_active'])
    _resolve_sort_conflict(db, normalized['sort_order'])
    item = HighlightItem(**normalized)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_highlight_item(db: Session, item: HighlightItem, payload) -> HighlightItem:
    normalized = _normalize_payload(payload)
    _ensure_active_limit(db, normalized['is_active'], ignore_id=item.id)
    _resolve_sort_conflict(db, normalized['sort_order'], current_id=item.id)
    item.title = normalized['title']
    item.description = normalized['description']
    item.icon_name = normalized['icon_name']
    item.sort_order = normalized['sort_order']
    item.is_active = normalized['is_active']
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def set_highlight_item_status(db: Session, item: HighlightItem, is_active: bool) -> HighlightItem:
    _ensure_active_limit(db, bool(is_active), ignore_id=item.id)
    item.is_active = bool(is_active)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_highlight_item(db: Session, item: HighlightItem) -> None:
    db.delete(item)
    db.commit()
