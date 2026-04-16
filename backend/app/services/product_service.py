from sqlalchemy.orm import Session

from app.models import Coupon, Product


def list_products(db: Session):
    return db.query(Product).filter(Product.is_active == True).all()


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


def admin_create_product(db: Session, payload):
    product = Product(
        title=payload.title,
        slug=payload.slug,
        short_description=payload.short_description,
        full_description=payload.full_description,
        price=payload.price,
        cover_image=payload.cover_image,
        images=','.join(payload.images),
        is_active=payload.is_active,
        rating_average=5.0,
        rating_count=0,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def admin_update_product(db: Session, product: Product, payload):
    product.title = payload.title
    product.slug = payload.slug
    product.short_description = payload.short_description
    product.full_description = payload.full_description
    product.price = payload.price
    product.cover_image = payload.cover_image
    product.images = ','.join(payload.images)
    product.is_active = payload.is_active
    db.commit()
    db.refresh(product)
    return product


def admin_set_product_status(db: Session, product: Product, is_active: bool):
    product.is_active = is_active
    db.commit()
    db.refresh(product)
    return product
