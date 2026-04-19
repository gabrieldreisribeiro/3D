import io
import re
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import (
    BANNER_UPLOADS_DIR,
    LOGO_UPLOADS_DIR,
    PRODUCT_UPLOADS_DIR,
    REVIEW_IMAGE_UPLOADS_DIR,
    REVIEW_VIDEO_UPLOADS_DIR,
)
from app.core.security import require_admin
from app.models import AdminUser
from app.services.image_storage_service import delete_image_file_base64, persist_image_file_base64

router = APIRouter(prefix='/admin/uploads', tags=['admin-uploads'])

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
FOLDER_MAP = {
    'logo': (LOGO_UPLOADS_DIR, '/uploads/logo/', 'logo'),
    'banners': (BANNER_UPLOADS_DIR, '/uploads/banners/', 'banner'),
    'products': (PRODUCT_UPLOADS_DIR, '/uploads/products/', 'product'),
    'reviews-images': (REVIEW_IMAGE_UPLOADS_DIR, '/uploads/reviews/images/', 'review'),
    'reviews-videos': (REVIEW_VIDEO_UPLOADS_DIR, '/uploads/reviews/videos/', 'review'),
}


def _sanitize_basename(value: str) -> str:
    text = str(value or '').strip()
    text = re.sub(r'[^A-Za-z0-9._-]+', '-', text)
    text = re.sub(r'-{2,}', '-', text).strip('-.')
    return text[:120] if text else ''


def _resolve_folder(folder: str) -> tuple[Path, str, str]:
    key = str(folder or '').strip().lower()
    if key not in FOLDER_MAP:
        raise HTTPException(status_code=400, detail='Pasta invalida')
    return FOLDER_MAP[key]


def _list_folder_files(folder_key: str) -> list[dict]:
    folder_path, url_prefix, _source = _resolve_folder(folder_key)
    if not folder_path.exists():
        return []
    items = []
    for file_path in sorted(folder_path.iterdir(), key=lambda item: item.name.lower()):
        if not file_path.is_file():
            continue
        ext = file_path.suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            continue
        items.append(
            {
                'folder': folder_key,
                'name': file_path.name,
                'size_bytes': file_path.stat().st_size,
                'url': f'{url_prefix}{file_path.name}',
            }
        )
    return items


@router.get('/files')
def list_upload_files(
    folder: str = 'all',
    _: AdminUser = Depends(require_admin),
):
    folder_key = str(folder or '').strip().lower()
    if folder_key == 'all':
        files = []
        for key in FOLDER_MAP:
            files.extend(_list_folder_files(key))
        return {'items': files}
    return {'items': _list_folder_files(folder_key)}


@router.post('/upload')
async def upload_files(
    folder: str = Form(...),
    files: list[UploadFile] = File(...),
    _: AdminUser = Depends(require_admin),
):
    folder_path, url_prefix, source = _resolve_folder(folder)
    folder_path.mkdir(parents=True, exist_ok=True)
    uploaded = []

    for incoming in files:
        if not incoming.filename:
            continue
        incoming_ext = Path(incoming.filename).suffix.lower()
        if incoming_ext not in ALLOWED_EXTENSIONS:
            continue

        base_name = _sanitize_basename(Path(incoming.filename).stem) or 'arquivo'
        candidate_name = f'{base_name}{incoming_ext}'
        destination = folder_path / candidate_name
        counter = 1
        while destination.exists():
            candidate_name = f'{base_name}-{counter}{incoming_ext}'
            destination = folder_path / candidate_name
            counter += 1

        content = await incoming.read()
        destination.write_bytes(content)
        file_url = f'{url_prefix}{destination.name}'
        persist_image_file_base64(file_url=file_url, file_path=destination, source=source)
        uploaded.append(
            {
                'folder': folder,
                'name': destination.name,
                'size_bytes': destination.stat().st_size,
                'url': file_url,
            }
        )

    return {'items': uploaded}


@router.patch('/rename')
def rename_file(
    folder: str = Form(...),
    current_name: str = Form(...),
    new_name: str = Form(...),
    _: AdminUser = Depends(require_admin),
):
    folder_path, url_prefix, source = _resolve_folder(folder)
    current_file = folder_path / Path(current_name).name
    if not current_file.exists() or not current_file.is_file():
        raise HTTPException(status_code=404, detail='Arquivo nao encontrado')

    extension = current_file.suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail='Tipo de arquivo nao permitido')

    sanitized_base = _sanitize_basename(Path(new_name).stem if '.' in new_name else new_name)
    if not sanitized_base:
        raise HTTPException(status_code=400, detail='Novo nome invalido')

    target_name = f'{sanitized_base}{extension}'
    target_file = folder_path / target_name
    counter = 1
    while target_file.exists() and target_file.resolve() != current_file.resolve():
        target_name = f'{sanitized_base}-{counter}{extension}'
        target_file = folder_path / target_name
        counter += 1

    current_file.rename(target_file)
    old_url = f'{url_prefix}{current_file.name}'
    new_url = f'{url_prefix}{target_file.name}'
    delete_image_file_base64(old_url)
    persist_image_file_base64(file_url=new_url, file_path=target_file, source=source)

    return {
        'item': {
            'folder': folder,
            'name': target_file.name,
            'size_bytes': target_file.stat().st_size,
            'url': new_url,
        }
    }


@router.get('/download-all')
def download_all_uploads(_: AdminUser = Depends(require_admin)):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
        for folder_key, (folder_path, _url_prefix, _source) in FOLDER_MAP.items():
            if not folder_path.exists():
                continue
            for file_path in folder_path.iterdir():
                if not file_path.is_file():
                    continue
                if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
                    continue
                archive_name = f'{folder_key}/{file_path.name}'
                archive.write(file_path, archive_name)

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type='application/zip',
        headers={'Content-Disposition': 'attachment; filename="uploads-gallery.zip"'},
    )
