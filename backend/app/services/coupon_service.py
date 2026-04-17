import hashlib
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Coupon, CouponUsage

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


def validate_coupon_limits(expires_at=None, max_uses=None) -> None:
    if max_uses is not None and int(max_uses) <= 0:
        raise ValueError('Quantidade disponivel deve ser maior que zero.')
    ensure_coupon_not_expired(expires_at)


def normalize_coupon_expiration(expires_at):
    if expires_at is None:
        return None
    if expires_at.tzinfo is not None:
        return expires_at.astimezone(timezone.utc).replace(tzinfo=None)
    return expires_at


def ensure_coupon_not_expired(expires_at) -> None:
    if expires_at is None:
        return
    if normalize_coupon_expiration(expires_at) <= datetime.utcnow():
        raise ValueError('Data/hora de expiracao deve ser futura.')


def is_coupon_expired(coupon: Coupon) -> bool:
    return bool(coupon.expires_at and normalize_coupon_expiration(coupon.expires_at) <= datetime.utcnow())


def is_coupon_depleted(coupon: Coupon) -> bool:
    return coupon.max_uses is not None and int(coupon.uses_count or 0) >= int(coupon.max_uses)


def build_client_hash(ip_address: str | None, fingerprint: str | None, user_agent: str | None) -> str:
    raw = f"{(ip_address or '').strip()}|{(fingerprint or '').strip()}|{(user_agent or '').strip()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def client_has_coupon_usage(db: Session, coupon_id: int, client_hash: str) -> bool:
    return (
        db.query(CouponUsage)
        .filter(CouponUsage.coupon_id == coupon_id, CouponUsage.client_hash == client_hash)
        .first()
        is not None
    )


def validate_coupon_for_client(db: Session, code: str, client_hash: str | None = None):
    normalized_code = normalize_coupon_code(code)
    coupon = db.query(Coupon).filter(Coupon.code == normalized_code, Coupon.is_active == True).first()
    if not coupon:
        return None, 'Cupom invalido.'
    if is_coupon_expired(coupon):
        return None, 'Cupom expirado.'
    if is_coupon_depleted(coupon):
        return None, 'Cupom esgotado.'
    if client_hash and client_has_coupon_usage(db, coupon.id, client_hash):
        return None, 'Este cupom ja foi usado por este cliente.'
    return coupon, None


def register_coupon_usage(db: Session, coupon: Coupon, client_hash: str | None, order_id: int | None = None) -> None:
    coupon.uses_count = int(coupon.uses_count or 0) + 1
    if client_hash:
        db.add(CouponUsage(coupon_id=coupon.id, client_hash=client_hash, order_id=order_id))


def admin_list_coupons(db: Session):
    return db.query(Coupon).order_by(Coupon.id.desc()).all()


def admin_coupon_by_id(db: Session, coupon_id: int):
    return db.query(Coupon).filter(Coupon.id == coupon_id).first()


def admin_coupon_code_exists(db: Session, code: str, ignore_id: int | None = None):
    query = db.query(Coupon).filter(Coupon.code == normalize_coupon_code(code))
    if ignore_id is not None:
        query = query.filter(Coupon.id != ignore_id)
    return query.first() is not None


def admin_create_coupon(db: Session, code: str, coupon_type: str, value: float, is_active: bool, expires_at=None, max_uses=None):
    normalized_code = normalize_coupon_code(code)
    validate_coupon_payload(coupon_type, value)
    validate_coupon_limits(expires_at, max_uses)

    coupon = Coupon(
        code=normalized_code,
        type=coupon_type,
        value=float(value),
        is_active=is_active,
        expires_at=normalize_coupon_expiration(expires_at),
        max_uses=int(max_uses) if max_uses is not None else None,
        uses_count=0,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


def admin_update_coupon(db: Session, coupon: Coupon, code: str, coupon_type: str, value: float, is_active: bool, expires_at=None, max_uses=None):
    normalized_code = normalize_coupon_code(code)
    validate_coupon_payload(coupon_type, value)
    validate_coupon_limits(expires_at, max_uses)

    coupon.code = normalized_code
    coupon.type = coupon_type
    coupon.value = float(value)
    coupon.is_active = is_active
    coupon.expires_at = normalize_coupon_expiration(expires_at)
    coupon.max_uses = int(max_uses) if max_uses is not None else None
    if coupon.max_uses is not None and coupon.uses_count > coupon.max_uses:
        raise ValueError('Quantidade disponivel nao pode ser menor que a quantidade ja usada.')
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
