from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.schemas import OrderCreate, OrderResponse
from app.services.order_service import create_order
from app.services.product_service import validate_coupon, get_product_by_slug

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post('/orders', response_model=OrderResponse)
def create_order_endpoint(payload: OrderCreate, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail='Carrinho vazio')

    order_items = []
    subtotal = 0.0
    for item in payload.items:
        product = get_product_by_slug(db, item.slug)
        if not product:
            raise HTTPException(status_code=404, detail=f'Produto não encontrado: {item.slug}')
        unit_price = product.price
        subtotal += unit_price * item.quantity
        order_items.append({
            'slug': product.slug,
            'title': product.title,
            'quantity': item.quantity,
            'unit_price': unit_price,
        })

    discount = 0.0
    if payload.coupon:
        coupon = validate_coupon(db, payload.coupon)
        if coupon:
            discount = subtotal * coupon.value / 100.0
        else:
            raise HTTPException(status_code=404, detail='Cupom inválido ou expirado')

    total = subtotal - discount
    order = create_order(db, order_items, payload.coupon, subtotal, discount, total)
    return order
