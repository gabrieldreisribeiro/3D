from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.schemas import ProductResponse
from app.services.product_service import get_product_by_slug, list_products

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get('/products', response_model=list[ProductResponse])
def read_products(db: Session = Depends(get_db)):
    products = list_products(db)
    for product in products:
        product.images = product.images.split(',') if product.images else []
    return products

@router.get('/products/{slug}', response_model=ProductResponse)
def read_product(slug: str, db: Session = Depends(get_db)):
    product = get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail='Produto não encontrado')
    product.images = product.images.split(',') if product.images else []
    return product
