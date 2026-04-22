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


def _normalize_text(value: str | None) -> str | None:
    raw = (value or '').strip()
    return raw or None


def _normalize_pixel_id(value: str | None) -> str | None:
    raw = ''.join(char for char in str(value or '') if char.isdigit())
    return raw or None


def _is_valid_pixel_id(value: str | None) -> bool:
    pixel_id = _normalize_pixel_id(value)
    if not pixel_id:
        return False
    return 8 <= len(pixel_id) <= 32


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


def update_instagram_settings(
    db: Session,
    instagram_enabled: bool,
    instagram_app_id: str | None,
    instagram_app_secret: str | None,
    instagram_access_token: str | None,
    instagram_user_id: str | None,
    instagram_page_id: str | None,
    instagram_default_caption: str | None,
    instagram_default_hashtags: str | None,
    instagram_auto_publish_default: bool,
) -> StoreSettings:
    settings = get_or_create_settings(db)
    settings.instagram_enabled = bool(instagram_enabled)
    settings.instagram_app_id = _normalize_text(instagram_app_id)
    settings.instagram_app_secret = _normalize_text(instagram_app_secret)
    settings.instagram_access_token = _normalize_text(instagram_access_token)
    settings.instagram_user_id = _normalize_text(instagram_user_id)
    settings.instagram_page_id = _normalize_text(instagram_page_id)
    settings.instagram_default_caption = _normalize_text(instagram_default_caption)
    settings.instagram_default_hashtags = _normalize_text(instagram_default_hashtags)
    settings.instagram_auto_publish_default = bool(instagram_auto_publish_default)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_store_favicon(db: Session, favicon_url: str | None) -> StoreSettings:
    settings = get_or_create_settings(db)
    settings.favicon_url = _normalize_text(favicon_url)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_meta_pixel_settings(
    db: Session,
    enabled: bool,
    pixel_id: str | None,
    auto_page_view: bool,
    track_product_events: bool,
    track_cart_events: bool,
    track_whatsapp_as_lead: bool,
    track_order_created: bool,
    test_event_code: str | None,
) -> StoreSettings:
    settings = get_or_create_settings(db)
    settings.meta_pixel_enabled = bool(enabled)
    settings.meta_pixel_pixel_id = _normalize_pixel_id(pixel_id)
    settings.meta_pixel_auto_page_view = bool(auto_page_view)
    settings.meta_pixel_track_product_events = bool(track_product_events)
    settings.meta_pixel_track_cart_events = bool(track_cart_events)
    settings.meta_pixel_track_whatsapp_as_lead = bool(track_whatsapp_as_lead)
    settings.meta_pixel_track_order_created = bool(track_order_created)
    settings.meta_pixel_test_event_code = _normalize_text(test_event_code)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def is_meta_pixel_config_valid(settings: StoreSettings) -> bool:
    if not settings or not bool(settings.meta_pixel_enabled):
        return False
    return _is_valid_pixel_id(settings.meta_pixel_pixel_id)
