from sqlalchemy.orm import Session, joinedload

from app.models import Category, Coupon, Product
from app.services.product_pricing_service import calculate_product_pricing


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
