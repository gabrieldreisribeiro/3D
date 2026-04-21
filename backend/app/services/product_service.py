import json
import re
import hashlib

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Category, Coupon, Product
from app.services.instagram_service import try_publish_product_to_instagram
from app.services.product_pricing_service import calculate_product_pricing, calculate_product_pricing_from_fields

HEX_COLOR_PATTERN = re.compile(r'^#[0-9A-F]{6}$')

def list_categories(db: Session):
    return db.query(Category).filter(Category.is_active == True).order_by(Category.name.asc()).all()


def category_by_id(db: Session, category_id: int, include_inactive: bool = False):
    query = db.query(Category).filter(Category.id == category_id)
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    return query.first()


def admin_list_categories(db: Session):
    return db.query(Category).order_by(Category.name.asc(), Category.id.asc()).all()


def admin_get_category_by_id(db: Session, category_id: int):
    return db.query(Category).filter(Category.id == category_id).first()


def admin_category_slug_exists(db: Session, slug: str, ignore_id: int | None = None):
    query = db.query(Category).filter(Category.slug == slug)
    if ignore_id is not None:
        query = query.filter(Category.id != ignore_id)
    return query.first() is not None


def admin_create_category(db: Session, name: str, slug: str, is_active: bool):
    category = Category(name=name, slug=slug, is_active=is_active)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def admin_update_category(db: Session, category: Category, name: str, slug: str, is_active: bool):
    category.name = name
    category.slug = slug
    category.is_active = is_active
    db.commit()
    db.refresh(category)
    return category


def admin_delete_category(db: Session, category: Category):
    db.query(Product).filter(Product.category_id == category.id).update({Product.category_id: None}, synchronize_session=False)
    db.delete(category)
    db.commit()


def list_products(db: Session, category_slug: str | None = None):
    query = db.query(Product).options(joinedload(Product.category)).filter(Product.is_active == True)
    if category_slug:
        query = query.join(Category).filter(Category.slug == category_slug, Category.is_active == True)
    return query.all()


def get_product_by_slug(db: Session, slug: str):
    return db.query(Product).filter(Product.slug == slug, Product.is_active == True).first()


def validate_coupon(db: Session, code: str):
    coupon = db.query(Coupon).filter(Coupon.code == code.upper(), Coupon.is_active == True).first()
    if not coupon:
        return None
    if coupon.expires_at and coupon.expires_at <= datetime.utcnow():
        return None
    if coupon.max_uses is not None and int(coupon.uses_count or 0) >= int(coupon.max_uses):
        return None
    return coupon


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


def _to_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value or '').strip().lower()
    return text in {'1', 'true', 'sim', 'yes', 'on'}


def _to_optional_non_negative_float(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == '':
        return None
    try:
        number = float(text)
    except Exception:  # noqa: BLE001
        return None
    if number < 0:
        return None
    return number


def _stable_sub_item_id(raw: dict, title: str) -> str:
    explicit = str(raw.get('id') or '').strip()
    if explicit:
        return explicit[:80]
    base = f"{title}|{str(raw.get('image_url') or '').strip().lower()}|{str(raw.get('manual_price') or '').strip()}"
    digest = hashlib.sha1(base.encode('utf-8')).hexdigest()[:24]
    return f"sub_{digest}"


def _normalize_colors(raw_colors) -> list[str]:
    if not raw_colors:
        return []

    if isinstance(raw_colors, str):
        chunks = raw_colors.replace('\r', '\n').replace(',', '\n').split('\n')
    else:
        chunks = list(raw_colors)

    colors = []
    for chunk in chunks:
        color = str(chunk or '').strip()
        if color and color not in colors:
            colors.append(color)
    return colors[:50]


def _normalize_secondary_pairs(raw_pairs, available_colors: list[str]) -> list[dict]:
    if not raw_pairs:
        return []
    pairs = []
    for item in raw_pairs:
        raw = item.model_dump() if hasattr(item, 'model_dump') else dict(item)
        primary = str(raw.get('primary') or '').strip().upper()
        secondary = str(raw.get('secondary') or '').strip().upper()
        if not primary or not secondary:
            continue
        if not HEX_COLOR_PATTERN.match(primary) or not HEX_COLOR_PATTERN.match(secondary):
            continue
        key = f'{primary}|{secondary}'
        if any(existing.get('_key') == key for existing in pairs):
            continue
        pairs.append({'primary': primary, 'secondary': secondary, '_key': key})
    return [{'primary': pair['primary'], 'secondary': pair['secondary']} for pair in pairs]


def _normalize_sub_item_payload(item) -> dict:
    raw = item.model_dump() if hasattr(item, 'model_dump') else dict(item)
    title = (raw.get('title') or raw.get('name') or '').strip()
    if not title:
        raise HTTPException(status_code=422, detail='Subitem precisa de titulo.')
    sub_item_id = _stable_sub_item_id(raw, title)

    pricing_mode = raw.get('pricing_mode') or 'manual'
    if pricing_mode not in {'manual', 'calculated'}:
        pricing_mode = 'manual'

    base = {
        'id': sub_item_id,
        'title': title,
        'image_url': (raw.get('image_url') or '').strip() or None,
        'pricing_mode': pricing_mode,
        'width_mm': _to_optional_non_negative_float(raw.get('width_mm')),
        'height_mm': _to_optional_non_negative_float(raw.get('height_mm')),
        'depth_mm': _to_optional_non_negative_float(raw.get('depth_mm')),
        'dimensions_source': 'model' if str(raw.get('dimensions_source') or '').strip().lower() == 'model' else 'manual',
        'lead_time_hours': _to_float(raw.get('lead_time_hours')),
        'allow_colors': _to_bool(raw.get('allow_colors')),
        'available_colors': _normalize_colors(raw.get('available_colors')),
        'allow_secondary_color': _to_bool(raw.get('allow_secondary_color')),
        'secondary_color_pairs': _normalize_secondary_pairs(raw.get('secondary_color_pairs') or [], _normalize_colors(raw.get('available_colors'))),
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

    if not base['allow_colors']:
        base['available_colors'] = []
        base['allow_secondary_color'] = False
        base['secondary_color_pairs'] = []
    if not base['allow_secondary_color']:
        base['secondary_color_pairs'] = []

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


def prepare_colors_for_storage(colors) -> str:
    return json.dumps(_normalize_colors(colors), ensure_ascii=False)


def parse_colors_from_storage(raw_value) -> list[str]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
    except Exception:  # noqa: BLE001
        return []
    return _normalize_colors(parsed)


def prepare_secondary_pairs_for_storage(pairs, available_colors) -> str:
    normalized_pairs = _normalize_secondary_pairs(pairs, _normalize_colors(available_colors))
    return json.dumps(normalized_pairs, ensure_ascii=False)


def parse_secondary_pairs_from_storage(raw_value, available_colors) -> list[dict]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
    except Exception:  # noqa: BLE001
        return []
    if not isinstance(parsed, list):
        return []
    return _normalize_secondary_pairs(parsed, _normalize_colors(available_colors))


def _apply_pricing(product: Product, payload) -> None:
    pricing = calculate_product_pricing(payload)
    product.cost_total = pricing['cost_total']
    product.calculated_price = pricing['calculated_price']
    product.estimated_profit = pricing['estimated_profit']
    product.final_price = pricing['final_price']
    product.price = pricing['final_price']


def admin_create_product(db: Session, payload):
    if payload.category_id is not None and not category_by_id(db, payload.category_id, include_inactive=True):
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
        lead_time_hours=payload.lead_time_hours,
        allow_colors=payload.allow_colors,
        available_colors=prepare_colors_for_storage(payload.available_colors if payload.allow_colors else []),
        allow_secondary_color=payload.allow_secondary_color if payload.allow_colors else False,
        secondary_color_pairs=prepare_secondary_pairs_for_storage(
            payload.secondary_color_pairs if payload.allow_colors and payload.allow_secondary_color else [],
            payload.available_colors if payload.allow_colors else [],
        ),
        allow_name_personalization=bool(payload.allow_name_personalization),
        width_mm=payload.width_mm,
        height_mm=payload.height_mm,
        depth_mm=payload.depth_mm,
        dimensions_source=payload.dimensions_source or 'manual',
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
        publish_to_instagram=bool(payload.publish_to_instagram),
        instagram_caption=(payload.instagram_caption or '').strip() or None,
        instagram_hashtags=(payload.instagram_hashtags or '').strip() or None,
        instagram_post_status='not_published',
        instagram_error_message=None,
        is_draft=bool(payload.is_draft) if payload.is_draft is not None else False,
        generated_by_ai=bool(payload.generated_by_ai) if payload.generated_by_ai is not None else False,
        source_ad_generation_id=payload.source_ad_generation_id,
    )
    _apply_pricing(product, payload)

    db.add(product)
    db.commit()
    db.refresh(product)
    product = try_publish_product_to_instagram(db, product)
    return product


def admin_update_product(db: Session, product: Product, payload):
    if payload.category_id is not None and not category_by_id(db, payload.category_id, include_inactive=True):
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
    product.lead_time_hours = payload.lead_time_hours
    product.allow_colors = payload.allow_colors
    product.available_colors = prepare_colors_for_storage(payload.available_colors if payload.allow_colors else [])
    product.allow_secondary_color = payload.allow_secondary_color if payload.allow_colors else False
    product.secondary_color_pairs = prepare_secondary_pairs_for_storage(
        payload.secondary_color_pairs if payload.allow_colors and payload.allow_secondary_color else [],
        payload.available_colors if payload.allow_colors else [],
    )
    product.allow_name_personalization = bool(payload.allow_name_personalization)
    product.width_mm = payload.width_mm
    product.height_mm = payload.height_mm
    product.depth_mm = payload.depth_mm
    product.dimensions_source = payload.dimensions_source or 'manual'

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
    product.publish_to_instagram = bool(payload.publish_to_instagram)
    product.instagram_caption = (payload.instagram_caption or '').strip() or None
    product.instagram_hashtags = (payload.instagram_hashtags or '').strip() or None
    if payload.is_draft is not None:
        product.is_draft = bool(payload.is_draft)
    if payload.generated_by_ai is not None:
        product.generated_by_ai = bool(payload.generated_by_ai)
    if payload.source_ad_generation_id is not None:
        product.source_ad_generation_id = payload.source_ad_generation_id

    _apply_pricing(product, payload)

    db.commit()
    db.refresh(product)
    product = try_publish_product_to_instagram(db, product)
    return product


def admin_set_product_status(db: Session, product: Product, is_active: bool):
    product.is_active = is_active
    db.commit()
    db.refresh(product)
    return product


def admin_delete_product(db: Session, product: Product):
    db.delete(product)
    db.commit()
