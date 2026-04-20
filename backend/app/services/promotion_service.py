from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Product, Promotion, PromotionProduct


def _to_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _utcnow() -> datetime:
    return datetime.utcnow()


def _validate_discount(discount_type: str, discount_value: float) -> None:
    if discount_type not in {'percentage', 'fixed'}:
        raise HTTPException(status_code=400, detail='Tipo de desconto invalido.')
    if float(discount_value or 0) <= 0:
        raise HTTPException(status_code=400, detail='Valor de desconto deve ser maior que zero.')
    if discount_type == 'percentage' and float(discount_value) > 100:
        raise HTTPException(status_code=400, detail='Desconto percentual nao pode ser maior que 100%.')


def _validate_dates(start_at: datetime | None, end_at: datetime | None) -> None:
    if start_at and end_at and end_at <= start_at:
        raise HTTPException(status_code=400, detail='Data/hora de fim deve ser maior que a data/hora de inicio.')


def _normalize_payload(payload):
    start_at = _to_utc_naive(payload.start_at)
    end_at = _to_utc_naive(payload.end_at)
    _validate_dates(start_at, end_at)
    _validate_discount(payload.discount_type, float(payload.discount_value or 0))
    return {
        'name': str(payload.name or '').strip(),
        'description': (payload.description or '').strip() or None,
        'discount_type': payload.discount_type,
        'discount_value': float(payload.discount_value or 0),
        'applies_to_all': bool(payload.applies_to_all),
        'is_active': bool(payload.is_active),
        'start_at': start_at,
        'end_at': end_at,
        'product_ids': sorted({int(item) for item in (payload.product_ids or []) if int(item) > 0}),
    }


def _ensure_products_exist(db: Session, product_ids: list[int]) -> list[Product]:
    if not product_ids:
        return []
    products = db.query(Product).filter(Product.id.in_(product_ids)).all()
    found_ids = {item.id for item in products}
    missing = [item for item in product_ids if item not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f'Produtos nao encontrados: {missing}')
    return products


def compute_promotional_price(base_price: float, discount_type: str, discount_value: float) -> float:
    safe_base = max(0.0, float(base_price or 0))
    if discount_type == 'percentage':
        discounted = safe_base - (safe_base * float(discount_value) / 100.0)
    else:
        discounted = safe_base - float(discount_value)
    return max(0.0, round(discounted, 2))


def promotion_badge(discount_type: str, discount_value: float) -> str:
    if discount_type == 'percentage':
        return f'{float(discount_value):.0f}% OFF'
    value = f'{float(discount_value):.2f}'.replace('.', ',')
    return f'R$ {value} OFF'


def promotion_status(promotion: Promotion, now: datetime | None = None) -> str:
    current = now or _utcnow()
    if not bool(promotion.is_active):
        return 'inactive'
    if promotion.start_at and promotion.start_at > current:
        return 'scheduled'
    if promotion.end_at and promotion.end_at < current:
        return 'ended'
    return 'active'


def is_promotion_currently_applicable(promotion: Promotion, now: datetime | None = None) -> bool:
    return promotion_status(promotion, now=now) == 'active'


def get_promotion_by_id(db: Session, promotion_id: int) -> Promotion | None:
    return (
        db.query(Promotion)
        .options(joinedload(Promotion.product_links))
        .filter(Promotion.id == promotion_id)
        .first()
    )


def list_promotions(db: Session) -> list[Promotion]:
    return (
        db.query(Promotion)
        .options(joinedload(Promotion.product_links))
        .order_by(Promotion.id.desc())
        .all()
    )


def _sync_promotion_products(db: Session, promotion: Promotion, product_ids: list[int]) -> None:
    db.query(PromotionProduct).filter(PromotionProduct.promotion_id == promotion.id).delete(synchronize_session=False)
    for product_id in product_ids:
        db.add(PromotionProduct(promotion_id=promotion.id, product_id=product_id))


def create_promotion(db: Session, payload) -> Promotion:
    normalized = _normalize_payload(payload)
    if not normalized['name']:
        raise HTTPException(status_code=400, detail='Nome da promocao e obrigatorio.')
    if not normalized['applies_to_all'] and not normalized['product_ids']:
        raise HTTPException(status_code=400, detail='Selecione ao menos um produto ou marque aplicar para todos.')
    _ensure_products_exist(db, normalized['product_ids'])

    promotion = Promotion(
        name=normalized['name'],
        description=normalized['description'],
        discount_type=normalized['discount_type'],
        discount_value=normalized['discount_value'],
        applies_to_all=normalized['applies_to_all'],
        is_active=normalized['is_active'],
        start_at=normalized['start_at'],
        end_at=normalized['end_at'],
    )
    db.add(promotion)
    db.flush()
    _sync_promotion_products(db, promotion, [] if normalized['applies_to_all'] else normalized['product_ids'])
    db.commit()
    db.refresh(promotion)
    return get_promotion_by_id(db, promotion.id) or promotion


def update_promotion(db: Session, promotion: Promotion, payload) -> Promotion:
    normalized = _normalize_payload(payload)
    if not normalized['name']:
        raise HTTPException(status_code=400, detail='Nome da promocao e obrigatorio.')
    if not normalized['applies_to_all'] and not normalized['product_ids']:
        raise HTTPException(status_code=400, detail='Selecione ao menos um produto ou marque aplicar para todos.')
    _ensure_products_exist(db, normalized['product_ids'])

    promotion.name = normalized['name']
    promotion.description = normalized['description']
    promotion.discount_type = normalized['discount_type']
    promotion.discount_value = normalized['discount_value']
    promotion.applies_to_all = normalized['applies_to_all']
    promotion.is_active = normalized['is_active']
    promotion.start_at = normalized['start_at']
    promotion.end_at = normalized['end_at']
    _sync_promotion_products(db, promotion, [] if normalized['applies_to_all'] else normalized['product_ids'])
    db.add(promotion)
    db.commit()
    db.refresh(promotion)
    return get_promotion_by_id(db, promotion.id) or promotion


def toggle_promotion(db: Session, promotion: Promotion, is_active: bool) -> Promotion:
    promotion.is_active = bool(is_active)
    db.add(promotion)
    db.commit()
    db.refresh(promotion)
    return get_promotion_by_id(db, promotion.id) or promotion


def delete_promotion(db: Session, promotion: Promotion) -> None:
    db.delete(promotion)
    db.commit()


def _resolve_best_promotion_for_product(product_id: int, promotions: list[Promotion], now: datetime) -> Promotion | None:
    for promotion in promotions:
        if not is_promotion_currently_applicable(promotion, now=now):
            continue
        if promotion.applies_to_all:
            return promotion
        if any(link.product_id == product_id for link in (promotion.product_links or [])):
            return promotion
    return None


def resolve_promotions_for_products(db: Session, products: list[Product]) -> dict[int, Promotion]:
    product_ids = [int(item.id) for item in products if item and item.id]
    if not product_ids:
        return {}
    promotions = (
        db.query(Promotion)
        .options(joinedload(Promotion.product_links))
        .order_by(Promotion.id.desc())
        .all()
    )
    now = _utcnow()
    mapping: dict[int, Promotion] = {}
    for product_id in product_ids:
        promotion = _resolve_best_promotion_for_product(product_id, promotions, now)
        if promotion:
            mapping[product_id] = promotion
    return mapping


def apply_promotion_pricing_to_product(product: Product, promotion: Promotion | None) -> Product:
    base_price = float(product.final_price if product.final_price is not None else product.price or 0)
    if not promotion:
        product.is_on_sale = False
        product.original_price = None
        product.promotional_price = None
        product.promotion_badge = None
        return product

    discounted = compute_promotional_price(base_price, promotion.discount_type, promotion.discount_value)
    if discounted >= base_price:
        product.is_on_sale = False
        product.original_price = None
        product.promotional_price = None
        product.promotion_badge = None
        return product

    product.is_on_sale = True
    product.original_price = round(base_price, 2)
    product.promotional_price = discounted
    product.promotion_badge = promotion_badge(promotion.discount_type, promotion.discount_value)
    product.final_price = discounted
    return product


def apply_promotion_pricing_to_products(db: Session, products: list[Product]) -> list[Product]:
    promotions_map = resolve_promotions_for_products(db, products)
    for product in products:
        promotion = promotions_map.get(int(product.id)) if product and product.id else None
        apply_promotion_pricing_to_product(product, promotion)
    return products


def get_effective_price_for_product(db: Session, product: Product) -> float:
    if not product:
        return 0.0
    promo = resolve_promotions_for_products(db, [product]).get(int(product.id))
    base_price = float(product.final_price if product.final_price is not None else product.price or 0)
    if not promo:
        return round(max(0.0, base_price), 2)
    return compute_promotional_price(base_price, promo.discount_type, promo.discount_value)


def serialize_promotion(db: Session, promotion: Promotion) -> dict:
    product_ids = sorted({int(link.product_id) for link in (promotion.product_links or []) if link.product_id})
    if promotion.applies_to_all:
        affected_count = db.query(Product).filter(Product.is_active == True).count()
    else:
        affected_count = len(product_ids)
    return {
        'id': promotion.id,
        'name': promotion.name,
        'description': promotion.description,
        'discount_type': promotion.discount_type,
        'discount_value': float(promotion.discount_value or 0),
        'applies_to_all': bool(promotion.applies_to_all),
        'is_active': bool(promotion.is_active),
        'start_at': promotion.start_at,
        'end_at': promotion.end_at,
        'status': promotion_status(promotion),
        'promotion_badge': promotion_badge(promotion.discount_type, promotion.discount_value),
        'product_ids': [] if promotion.applies_to_all else product_ids,
        'affected_products_count': int(affected_count),
        'created_at': promotion.created_at,
        'updated_at': promotion.updated_at,
    }
