import re
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.core.config import (
    BANNER_UPLOADS_DIR,
    LOGO_UPLOADS_DIR,
    PRODUCT_UPLOADS_DIR,
    REVIEW_IMAGE_UPLOADS_DIR,
    REVIEW_VIDEO_UPLOADS_DIR,
)
from app.core.security import require_admin
from app.models import AdminUser
from app.services.image_optimization_service import optimize_image_upload
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


def _normalized_asset_base(name: str) -> str:
    stem = Path(str(name or '')).stem
    return re.sub(r'__(thumb|medium|large|orig)$', '', stem, flags=re.IGNORECASE)


def _build_variant_rename_pairs(folder_path: Path, old_base: str, new_base: str) -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    pattern = re.compile(rf'^{re.escape(old_base)}(__(thumb|medium|large|orig)\.[^.]+)$', re.IGNORECASE)
    for file_path in folder_path.iterdir():
        if not file_path.is_file():
            continue
        matched = pattern.match(file_path.name)
        if not matched:
            continue
        suffix = matched.group(1)
        pairs.append((file_path, folder_path / f'{new_base}{suffix}'))
    return pairs


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
        lower_name = file_path.name.lower()
        if '__thumb.' in lower_name or '__medium.' in lower_name or '__large.' in lower_name or '__orig.' in lower_name:
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

        if folder != 'reviews-videos':
            optimized = optimize_image_upload(
                file=incoming,
                target_dir=folder_path,
                url_prefix=url_prefix,
                source=source,
                base_name=Path(candidate_name).stem,
                profile='banner' if folder == 'banners' else ('logo' if folder == 'logo' else 'product'),
            ).to_response()
            uploaded.append(
                {
                    'folder': folder,
                    'name': Path(optimized['url']).name,
                    'size_bytes': int(optimized.get('optimized_size_bytes') or 0),
                    'url': optimized['url'],
                    'original_url': optimized.get('original_url'),
                    'thumbnail_url': optimized.get('thumbnail_url'),
                    'medium_url': optimized.get('medium_url'),
                    'large_url': optimized.get('large_url'),
                    'mime_type': optimized.get('mime_type'),
                    'is_animated': bool(optimized.get('is_animated')),
                    'optimized_format': optimized.get('optimized_format'),
                    'optimization_note': (
                        'GIF animado preservado.'
                        if bool(optimized.get('is_animated'))
                        else 'Imagem otimizada automaticamente (WebP + variantes).'
                    ),
                }
            )
            continue

        content = await incoming.read()
        destination.write_bytes(content)
        file_url = f'{url_prefix}{destination.name}'
        persist_image_file_base64(file_url=file_url, file_path=destination, source=source, mime_type=incoming.content_type)
        uploaded.append({'folder': folder, 'name': destination.name, 'size_bytes': destination.stat().st_size, 'url': file_url})

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

    old_base = _normalized_asset_base(current_file.name)
    new_base = Path(target_name).stem
    rename_pairs = [(current_file, target_file), *_build_variant_rename_pairs(folder_path, old_base, new_base)]

    source_paths = {str(src.resolve()) for src, _dst in rename_pairs}
    for _src, destination in rename_pairs:
        destination_path = destination.resolve()
        if destination.exists() and str(destination_path) not in source_paths:
            raise HTTPException(status_code=409, detail='Ja existe arquivo com o nome solicitado.')

    for source_path, destination in rename_pairs:
        if source_path.resolve() == destination.resolve():
            continue
        source_path.rename(destination)

    for old_path, new_path in rename_pairs:
        old_url = f'{url_prefix}{old_path.name}'
        new_url = f'{url_prefix}{new_path.name}'
        if old_url != new_url:
            delete_image_file_base64(old_url)
        persist_image_file_base64(file_url=new_url, file_path=new_path, source=source)

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
    temp_zip = tempfile.NamedTemporaryFile(prefix='uploads-gallery-', suffix='.zip', delete=False)
    temp_zip_path = Path(temp_zip.name)
    temp_zip.close()

    with zipfile.ZipFile(temp_zip_path, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
        for folder_key, (folder_path, _url_prefix, _source) in FOLDER_MAP.items():
            if not folder_path.exists():
                continue
            for file_path in folder_path.iterdir():
                if not file_path.is_file():
                    continue
                archive_name = f'{folder_key}/{file_path.name}'
                archive.write(file_path, archive_name)

    def _iter_file_chunks(path: Path, chunk_size: int = 1024 * 1024):
        with path.open('rb') as file_stream:
            while True:
                chunk = file_stream.read(chunk_size)
                if not chunk:
                    break
                yield chunk

    cleanup = BackgroundTask(lambda: temp_zip_path.unlink(missing_ok=True))
    return StreamingResponse(
        _iter_file_chunks(temp_zip_path),
        media_type='application/zip',
        headers={'Content-Disposition': 'attachment; filename="uploads-gallery.zip"'},
        background=cleanup,
    )
