from sqlalchemy.orm import Session

from app.models import StoreSettings


def _normalize_whatsapp_number(value: str | None) -> str | None:
    raw = (value or '').strip()
    if not raw:
        return None
    return ''.join(char for char in raw if char.isdigit() or char == '+')


def _normalize_pix_key(value: str | None) -> str | None:
    raw = (value or '').strip()
    return raw or None


def get_or_create_settings(db: Session) -> StoreSettings:
    settings = db.query(StoreSettings).first()
    if settings:
        return settings
    settings = StoreSettings(id=1, whatsapp_number=None, pix_key=None)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_store_settings(db: Session, whatsapp_number: str | None, pix_key: str | None) -> StoreSettings:
    settings = get_or_create_settings(db)
    settings.whatsapp_number = _normalize_whatsapp_number(whatsapp_number)
    settings.pix_key = _normalize_pix_key(pix_key)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
