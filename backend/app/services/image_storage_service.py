import base64
from pathlib import Path

from app.core.config import BANNER_UPLOADS_DIR, LOGO_UPLOADS_DIR, PRODUCT_UPLOADS_DIR, REVIEW_IMAGE_UPLOADS_DIR
from app.db.session import SessionLocal
from app.models import UploadedImage

MIME_BY_SUFFIX = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
}


def _guess_mime_type(file_path: Path) -> str | None:
    return MIME_BY_SUFFIX.get(file_path.suffix.lower())


def persist_image_file_base64(
    *,
    file_url: str,
    file_path: Path,
    source: str,
    mime_type: str | None = None,
    original_url: str | None = None,
    thumbnail_url: str | None = None,
    medium_url: str | None = None,
    large_url: str | None = None,
    is_animated: bool | None = None,
    optimized_format: str | None = None,
) -> None:
    if not file_path.exists() or not file_path.is_file():
        return

    raw_bytes = file_path.read_bytes()
    encoded = base64.b64encode(raw_bytes).decode('ascii')
    resolved_mime = mime_type or _guess_mime_type(file_path)

    session = SessionLocal()
    try:
        item = session.query(UploadedImage).filter(UploadedImage.file_url == file_url).first()
        if item is None:
            item = UploadedImage(file_url=file_url)
        item.file_name = file_path.name
        item.mime_type = resolved_mime
        item.source = source
        item.size_bytes = len(raw_bytes)
        item.base64_data = encoded
        if hasattr(item, 'original_url'):
            item.original_url = original_url
        if hasattr(item, 'thumbnail_url'):
            item.thumbnail_url = thumbnail_url
        if hasattr(item, 'medium_url'):
            item.medium_url = medium_url
        if hasattr(item, 'large_url'):
            item.large_url = large_url
        if hasattr(item, 'is_animated') and is_animated is not None:
            item.is_animated = bool(is_animated)
        if hasattr(item, 'optimized_format'):
            item.optimized_format = optimized_format
        session.add(item)
        session.commit()
    except Exception:  # noqa: BLE001
        session.rollback()
        raise
    finally:
        session.close()


def delete_image_file_base64(file_url: str) -> None:
    session = SessionLocal()
    try:
        item = session.query(UploadedImage).filter(UploadedImage.file_url == file_url).first()
        if item is None:
            return
        session.delete(item)
        session.commit()
    except Exception:  # noqa: BLE001
        session.rollback()
        raise
    finally:
        session.close()


def _iter_image_files() -> list[tuple[Path, str, str]]:
    roots = [
        (LOGO_UPLOADS_DIR, 'logo', '/uploads/logo/'),
        (BANNER_UPLOADS_DIR, 'banner', '/uploads/banners/'),
        (PRODUCT_UPLOADS_DIR, 'product', '/uploads/products/'),
        (REVIEW_IMAGE_UPLOADS_DIR, 'review', '/uploads/reviews/images/'),
    ]
    items: list[tuple[Path, str, str]] = []
    for root_path, source, url_prefix in roots:
        if not root_path.exists():
            continue
        for file_path in root_path.iterdir():
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in MIME_BY_SUFFIX:
                continue
            lower_name = file_path.name.lower()
            if '__thumb.' in lower_name or '__medium.' in lower_name or '__large.' in lower_name or '__orig.' in lower_name:
                continue
            file_url = f'{url_prefix}{file_path.name}'
            items.append((file_path, source, file_url))
    return items


def sync_existing_upload_images_to_db() -> dict[str, int]:
    scanned = 0
    synced = 0
    for file_path, source, file_url in _iter_image_files():
        scanned += 1
        persist_image_file_base64(
            file_url=file_url,
            file_path=file_path,
            source=source,
            mime_type=_guess_mime_type(file_path),
        )
        synced += 1
    return {'scanned': scanned, 'synced': synced}
