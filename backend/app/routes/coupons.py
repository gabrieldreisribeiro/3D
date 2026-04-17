from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas import CouponRequest, CouponResponse
from app.services.coupon_service import build_client_hash, validate_coupon_for_client

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post('/coupons/validate', response_model=CouponResponse)
def validate_coupon_endpoint(payload: CouponRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.headers.get('x-forwarded-for', '').split(',')[0].strip() or (request.client.host if request.client else '')
    client_fingerprint = request.headers.get('x-client-fingerprint', '')
    client_user_agent = request.headers.get('user-agent', '')
    client_hash = build_client_hash(client_ip, client_fingerprint, client_user_agent)
    coupon, coupon_error = validate_coupon_for_client(db, payload.code, client_hash)
    if not coupon:
        raise HTTPException(status_code=404, detail=coupon_error or 'Cupom invalido ou expirado')
    return CouponResponse(
        code=coupon.code,
        type=coupon.type,
        value=coupon.value,
        expires_at=coupon.expires_at,
        max_uses=coupon.max_uses,
        uses_count=coupon.uses_count,
    )
