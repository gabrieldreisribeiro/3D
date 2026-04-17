import json

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Category, Coupon, Product
from app.services.product_pricing_service import calculate_product_pricing, calculate_product_pricing_from_fields


def list_categories(db: Session):
    return db.query(Category).filter(Category.is_active == True).order_by(Category.name.asc()).all()


def category_by_id(db: Session, category_id: int):
    return db.query(Category).filter(Category.id == category_id, Category.is_active == True).first()


def list_products(db: Session, category_slug: str | None = None):
    query = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active == True)
    if category_slug:
        query = query.join(Category).filter(Category.slug == category_slug, Category.is_active == True)
    return query.all()


def get_product_by_slug(db: Session, slug: str):
    return db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()


def validate_coupon(db: Session, code: str):
    return db.query(Coupon).filter(Coupon.code == code.upper(), Coupon.is_active == True).first()


def admin_list_products(db: Session):
    return db.query(Product).order_by(Product.id.desc()).all()


def admin_get_product_by_id(db: Session, product_id: int):
    return db.query(Product).filter(Product.id == product_id).first()


def admin_slug_exists(db: Session, slug: str, ignore_id: int | None = None):
    query = db.query(Product).filter(Product.slug == slug)
    if ignore_id is not None:
        query = query.filter(Product.id != ignore_id)
    return query.first() is not None


def _to_float(value, default=0.0):
    try:
        return float(value if value is not None else default)
    except Exception:  # noqa: BLE001
        return float(default)


def _normalize_sub_item_payload(item) -> dict:
    raw = item.model_dump() if hasattr(item, 'model_dump') else dict(item)
    title = (raw.get('title') or raw.get('name') or '').strip()
    if not title:
        raise HTTPException(status_code=422, detail='Subitem precisa de titulo.')

    pricing_mode = raw.get('pricing_mode') or 'manual'
    if pricing_mode not in {'manual', 'calculated'}:
        pricing_mode = 'manual'

    base = {
        'title': title,
        'image_url': (raw.get('image_url') or '').strip() or None,
        'pricing_mode': pricing_mode,
        'grams_filament': _to_float(raw.get('grams_filament')),
        'price_kg_filament': _to_float(raw.get('price_kg_filament')),
        'hours_printing': _to_float(raw.get('hours_printing')),
        'avg_power_watts': _to_float(raw.get('avg_power_watts')),
        'price_kwh': _to_float(raw.get('price_kwh')),
        'total_hours_labor': _to_float(raw.get('total_hours_labor')),
        'price_hour_labor': _to_float(raw.get('price_hour_labor')),
        'extra_cost': _to_float(raw.get('extra_cost')),
        'profit_margin': _to_float(raw.get('profit_margin')),
        'manual_price': raw.get('manual_price'),
    }

    legacy_price = raw.get('price')
    if base['manual_price'] is None and legacy_price is not None:
        base['manual_price'] = legacy_price

    if pricing_mode == 'calculated':
        pricing = calculate_product_pricing_from_fields(base)
        base['cost_total'] = pricing['cost_total']
        base['calculated_price'] = pricing['calculated_price']
        base['estimated_profit'] = pricing['estimated_profit']
        base['final_price'] = pricing['final_price']
    else:
        manual_value = _to_float(base['manual_price'])
        base['manual_price'] = manual_value
        base['cost_total'] = 0.0
        base['calculated_price'] = manual_value
        base['estimated_profit'] = 0.0
        base['final_price'] = manual_value

    return base


def prepare_sub_items_for_storage(sub_items) -> str:
    normalized = [_normalize_sub_item_payload(item) for item in (sub_items or [])]
    return json.dumps(normalized, ensure_ascii=False)


def parse_sub_items_from_storage(raw_value) -> list[dict]:
    if not raw_value:
        return []

    try:
        data = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
    except Exception:  # noqa: BLE001
        return []

    if not isinstance(data, list):
        return []

    parsed = []
    for item in data:
        try:
            parsed.append(_normalize_sub_item_payload(item))
        except Exception:  # noqa: BLE001
            continue
    return parsed


def _apply_pricing(product: Product, payload) -> None:
    pricing = calculate_product_pricing(payload)
    product.cost_total = pricing['cost_total']
    product.calculated_price = pricing['calculated_price']
    product.estimated_profit = pricing['estimated_profit']
    product.final_price = pricing['final_price']
    product.price = pricing['final_price']


def admin_create_product(db: Session, payload):
    if payload.category_id is not None and not category_by_id(db, payload.category_id):
        raise ValueError('Categoria invalida.')

    product = Product(
        title=payload.title,
        slug=payload.slug,
        short_description=payload.short_description,
        full_description=payload.full_description,
        cover_image=payload.cover_image,
        images=','.join(payload.images),
        sub_items=prepare_sub_items_for_storage(payload.sub_items),
        is_active=payload.is_active,
        rating_average=5.0,
        rating_count=0,
        category_id=payload.category_id,
        grams_filament=payload.grams_filament,
        price_kg_filament=payload.price_kg_filament,
        hours_printing=payload.hours_printing,
        avg_power_watts=payload.avg_power_watts,
        price_kwh=payload.price_kwh,
        total_hours_labor=payload.total_hours_labor,
        price_hour_labor=payload.price_hour_labor,
        extra_cost=payload.extra_cost,
        profit_margin=payload.profit_margin,
        manual_price=payload.manual_price,
    )
    _apply_pricing(product, payload)

    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def admin_update_product(db: Session, product: Product, payload):
    if payload.category_id is not None and not category_by_id(db, payload.category_id):
        raise ValueError('Categoria invalida.')

    product.title = payload.title
    product.slug = payload.slug
    product.short_description = payload.short_description
    product.full_description = payload.full_description
    product.cover_image = payload.cover_image
    product.images = ','.join(payload.images)
    product.sub_items = prepare_sub_items_for_storage(payload.sub_items)
    product.is_active = payload.is_active
    product.category_id = payload.category_id

    product.grams_filament = payload.grams_filament
    product.price_kg_filament = payload.price_kg_filament
    product.hours_printing = payload.hours_printing
    product.avg_power_watts = payload.avg_power_watts
    product.price_kwh = payload.price_kwh
    product.total_hours_labor = payload.total_hours_labor
    product.price_hour_labor = payload.price_hour_labor
    product.extra_cost = payload.extra_cost
    product.profit_margin = payload.profit_margin
    product.manual_price = payload.manual_price

    _apply_pricing(product, payload)

    db.commit()
    db.refresh(product)
    return product


def admin_set_product_status(db: Session, product: Product, is_active: bool):
    product.is_active = is_active
    db.commit()
    db.refresh(product)
    return product
