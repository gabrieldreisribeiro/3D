from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas import CategoryResponse, ProductResponse
from app.services.product_service import get_product_by_slug, list_categories, list_products

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
    return products


@router.get('/products/{slug}', response_model=ProductResponse)
def read_product(slug: str, db: Session = Depends(get_db)):
    product = get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    product.images = product.images.split(',') if product.images else []
    return product
