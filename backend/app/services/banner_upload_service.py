from uuid import uuid4

from fastapi import UploadFile

from app.core.config import BANNER_UPLOADS_DIR
from app.services.image_optimization_service import optimize_image_upload


def save_banner_image(file: UploadFile) -> dict:
    result = optimize_image_upload(
        file=file,
        target_dir=BANNER_UPLOADS_DIR,
        url_prefix='/uploads/banners/',
        source='banner',
        base_name=f'banner-{uuid4().hex}',
        profile='banner',
    )
    return result.to_response()
