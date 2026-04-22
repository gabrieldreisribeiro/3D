import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import FAVICON_UPLOADS_DIR
from app.services.image_storage_service import delete_image_file_base64, persist_image_file_base64

MAX_FAVICON_SIZE_BYTES = 1 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    'image/png': 'png',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'image/svg+xml': 'svg',
}
ALLOWED_EXTENSIONS = {'png', 'ico', 'svg'}


def _favicon_url_from_path(file_path: Path) -> str:
    return f"/uploads/favicon/{file_path.name}?v={int(file_path.stat().st_mtime)}"


def _guess_extension(file: UploadFile) -> str:
    content_type = str(file.content_type or '').strip().lower()
    if content_type in ALLOWED_CONTENT_TYPES:
        return ALLOWED_CONTENT_TYPES[content_type]
    name = str(file.filename or '').strip().lower()
    if '.' in name:
        extension = name.rsplit('.', 1)[-1]
        if extension in ALLOWED_EXTENSIONS:
            return extension
    raise HTTPException(status_code=400, detail='Formato invalido. Use png, ico ou svg.')


def save_favicon(file: UploadFile) -> str:
    extension = _guess_extension(file)
    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail='Arquivo vazio.')
    if len(raw) > MAX_FAVICON_SIZE_BYTES:
        raise HTTPException(status_code=400, detail='Arquivo muito grande. Limite de 1MB.')

    for old_file in FAVICON_UPLOADS_DIR.glob('favicon-*.*'):
        if old_file.is_file():
            old_url = f"/uploads/favicon/{old_file.name}"
            old_file.unlink(missing_ok=True)
            delete_image_file_base64(old_url)

    filename = f'favicon-{uuid.uuid4().hex}.{extension}'
    destination = FAVICON_UPLOADS_DIR / filename
    with destination.open('wb') as output:
        output.write(raw)

    mime_type = str(file.content_type or '').strip() or None
    persist_image_file_base64(
        file_url=f"/uploads/favicon/{filename}",
        file_path=destination,
        source='favicon',
        mime_type=mime_type,
    )
    return _favicon_url_from_path(destination)


def remove_favicon_file(favicon_url: str | None) -> None:
    clean_url = str(favicon_url or '').split('?', 1)[0].strip()
    if clean_url.startswith('/uploads/favicon/'):
        file_name = clean_url.rsplit('/', 1)[-1]
        target = FAVICON_UPLOADS_DIR / file_name
        if target.exists():
            target.unlink(missing_ok=True)
        delete_image_file_base64(clean_url)

    for old_file in FAVICON_UPLOADS_DIR.glob('favicon-*.*'):
        if old_file.is_file():
            old_url = f"/uploads/favicon/{old_file.name}"
            old_file.unlink(missing_ok=True)
            delete_image_file_base64(old_url)
