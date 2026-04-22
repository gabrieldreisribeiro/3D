from pathlib import Path

from fastapi import UploadFile

from app.core.config import LOGO_UPLOADS_DIR
from app.services.image_optimization_service import optimize_image_upload
from app.services.image_storage_service import delete_image_file_base64


def _logo_url_from_path(file_path: Path) -> str:
    return f"/uploads/logo/{file_path.name}?v={int(file_path.stat().st_mtime)}"


def get_public_logo_url() -> str | None:
    files = [item for item in LOGO_UPLOADS_DIR.glob('site-logo.*') if item.is_file()]
    if not files:
        return None
    current = max(files, key=lambda item: item.stat().st_mtime)
    return _logo_url_from_path(current)


def save_logo(file: UploadFile) -> dict:
    for old_file in LOGO_UPLOADS_DIR.glob('site-logo*'):
        if old_file.is_file():
            old_url = f"/uploads/logo/{old_file.name}"
            old_file.unlink(missing_ok=True)
            delete_image_file_base64(old_url)

    result = optimize_image_upload(
        file=file,
        target_dir=LOGO_UPLOADS_DIR,
        url_prefix='/uploads/logo/',
        source='logo',
        base_name='site-logo',
        profile='logo',
    )

    # Keep legacy cache-busting behavior for header/logo consumers.
    final_file = LOGO_UPLOADS_DIR / Path(result.url).name
    response = result.to_response()
    response['url'] = _logo_url_from_path(final_file)
    return response
