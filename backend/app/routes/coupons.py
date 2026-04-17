from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas import CouponRequest, CouponResponse
from app.services.product_service import validate_coupon

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post('/coupons/validate', response_model=CouponResponse)
def validate_coupon_endpoint(payload: CouponRequest, db: Session = Depends(get_db)):
    coupon = validate_coupon(db, payload.code)
    if not coupon:
        raise HTTPException(status_code=404, detail='Cupom invalido ou expirado')
    return CouponResponse(code=coupon.code, type=coupon.type, value=coupon.value)
