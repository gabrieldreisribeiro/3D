from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas import CategoryResponse, ProductResponse
from app.services.product_service import (
    get_product_by_slug,
    list_categories,
    list_products,
    parse_colors_from_storage,
    parse_secondary_pairs_from_storage,
    parse_sub_items_from_storage,
)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get('/categories', response_model=list[CategoryResponse])
def read_categories(db: Session = Depends(get_db)):
    return list_categories(db)


@router.get('/products', response_model=list[ProductResponse])
def read_products(category: str | None = Query(default=None), db: Session = Depends(get_db)):
    products = list_products(db, category_slug=category)
    for product in products:
        product.images = product.images.split(',') if product.images else []
        product.sub_items = parse_sub_items_from_storage(product.sub_items)
        product.available_colors = parse_colors_from_storage(product.available_colors)
        product.secondary_color_pairs = parse_secondary_pairs_from_storage(product.secondary_color_pairs, product.available_colors)
    return products


@router.get('/products/{slug}', response_model=ProductResponse)
def read_product(slug: str, db: Session = Depends(get_db)):
    product = get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    product.images = product.images.split(',') if product.images else []
    product.sub_items = parse_sub_items_from_storage(product.sub_items)
    product.available_colors = parse_colors_from_storage(product.available_colors)
    product.secondary_color_pairs = parse_secondary_pairs_from_storage(product.secondary_color_pairs, product.available_colors)
    return product
