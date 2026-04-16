import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import LOGO_UPLOADS_DIR

ALLOWED_CONTENT_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}


def _logo_url_from_path(file_path: Path) -> str:
    return f"/uploads/logo/{file_path.name}?v={int(file_path.stat().st_mtime)}"


def get_public_logo_url() -> str | None:
    files = [item for item in LOGO_UPLOADS_DIR.glob('site-logo.*') if item.is_file()]
    if not files:
        return None
    current = max(files, key=lambda item: item.stat().st_mtime)
    return _logo_url_from_path(current)


def save_logo(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='Formato invalido. Use jpg, png ou webp.')

    extension = ALLOWED_CONTENT_TYPES[file.content_type]

    for old_file in LOGO_UPLOADS_DIR.glob('site-logo.*'):
        if old_file.is_file():
            old_file.unlink(missing_ok=True)

    filename = f'site-logo.{extension}'
    destination = LOGO_UPLOADS_DIR / filename

    with destination.open('wb') as output:
        shutil.copyfileobj(file.file, output)

    return _logo_url_from_path(destination)
