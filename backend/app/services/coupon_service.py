from sqlalchemy.orm import Session

from app.models import Coupon

ALLOWED_COUPON_TYPES = {'percent', 'fixed'}


def normalize_coupon_code(code: str) -> str:
    return code.strip().upper()


def validate_coupon_payload(coupon_type: str, value: float) -> None:
    if coupon_type not in ALLOWED_COUPON_TYPES:
        raise ValueError('Tipo de cupom invalido. Use percent ou fixed.')
    if value <= 0:
        raise ValueError('Valor do cupom deve ser maior que zero.')
    if coupon_type == 'percent' and value >= 100:
        raise ValueError('Cupom percentual deve ser menor que 100.')


def admin_list_coupons(db: Session):
    return db.query(Coupon).order_by(Coupon.id.desc()).all()


def admin_coupon_by_id(db: Session, coupon_id: int):
    return db.query(Coupon).filter(Coupon.id == coupon_id).first()


def admin_coupon_code_exists(db: Session, code: str, ignore_id: int | None = None):
    query = db.query(Coupon).filter(Coupon.code == normalize_coupon_code(code))
    if ignore_id is not None:
        query = query.filter(Coupon.id != ignore_id)
    return query.first() is not None


def admin_create_coupon(db: Session, code: str, coupon_type: str, value: float, is_active: bool):
    normalized_code = normalize_coupon_code(code)
    validate_coupon_payload(coupon_type, value)

    coupon = Coupon(code=normalized_code, type=coupon_type, value=float(value), is_active=is_active)
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


def admin_update_coupon(db: Session, coupon: Coupon, code: str, coupon_type: str, value: float, is_active: bool):
    normalized_code = normalize_coupon_code(code)
    validate_coupon_payload(coupon_type, value)

    coupon.code = normalized_code
    coupon.type = coupon_type
    coupon.value = float(value)
    coupon.is_active = is_active
    db.commit()
    db.refresh(coupon)
    return coupon


def admin_set_coupon_status(db: Session, coupon: Coupon, is_active: bool):
    coupon.is_active = is_active
    db.commit()
    db.refresh(coupon)
    return coupon


def admin_delete_coupon(db: Session, coupon: Coupon):
    db.delete(coupon)
    db.commit()
