import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.config import PRODUCT_UPLOADS_DIR
from app.services.image_storage_service import persist_image_file_base64

ALLOWED_CONTENT_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}


def _product_image_url(file_path: Path) -> str:
    return f"/uploads/products/{file_path.name}"


def save_product_image(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail='Formato invalido. Use jpg, png ou webp.')

    extension = ALLOWED_CONTENT_TYPES[file.content_type]
    filename = f'product-{uuid4().hex}.{extension}'
    destination = PRODUCT_UPLOADS_DIR / filename

    with destination.open('wb') as output:
        shutil.copyfileobj(file.file, output)

    file_url = _product_image_url(destination)
    persist_image_file_base64(
        file_url=file_url,
        file_path=destination,
        source='product',
        mime_type=file.content_type,
    )
    return file_url
