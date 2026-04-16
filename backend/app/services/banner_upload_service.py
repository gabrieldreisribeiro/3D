import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.config import BANNER_UPLOADS_DIR

ALLOWED_CONTENT_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}


def _banner_url_from_path(file_path: Path) -> str:
    return f"/uploads/banners/{file_path.name}"


def save_banner_image(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='Formato invalido. Use jpg, png ou webp.')

    extension = ALLOWED_CONTENT_TYPES[file.content_type]
    filename = f'banner-{uuid4().hex}.{extension}'
    destination = BANNER_UPLOADS_DIR / filename

    with destination.open('wb') as output:
        shutil.copyfileobj(file.file, output)

    return _banner_url_from_path(destination)
