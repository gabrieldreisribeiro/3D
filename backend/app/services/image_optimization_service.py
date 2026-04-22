from __future__ import annotations

import shutil
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.services.image_storage_service import persist_image_file_base64

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
}

MAX_STATIC_BYTES = 12 * 1024 * 1024
MAX_GIF_BYTES = 20 * 1024 * 1024

PROFILE_WIDTHS = {
    'product': {'thumbnail': 400, 'medium': 800, 'large': 1200},
    'banner': {'thumbnail': 400, 'medium': 900, 'large': 1600},
    'logo': {'thumbnail': 240, 'medium': 480, 'large': 960},
    'review': {'thumbnail': 320, 'medium': 800, 'large': 1200},
    'default': {'thumbnail': 320, 'medium': 800, 'large': 1200},
}


@dataclass
class OptimizedImageResult:
    url: str
    original_url: str
    thumbnail_url: str
    medium_url: str
    large_url: str
    mime_type: str
    is_animated: bool
    optimized_format: str
    original_size_bytes: int
    optimized_size_bytes: int

    def to_response(self) -> dict:
        return {
            'url': self.url,
            'original_url': self.original_url,
            'thumbnail_url': self.thumbnail_url,
            'medium_url': self.medium_url,
            'large_url': self.large_url,
            'mime_type': self.mime_type,
            'is_animated': self.is_animated,
            'optimized_format': self.optimized_format,
            'original_size_bytes': self.original_size_bytes,
            'optimized_size_bytes': self.optimized_size_bytes,
        }


def _normalize_extension(file: UploadFile) -> str:
    content_type = str(file.content_type or '').strip().lower()
    if content_type in ALLOWED_MIME_TYPES:
        return ALLOWED_MIME_TYPES[content_type]
    filename_ext = Path(str(file.filename or '')).suffix.lower()
    if filename_ext in ALLOWED_IMAGE_EXTENSIONS:
        return filename_ext
    raise HTTPException(status_code=400, detail='Formato invalido. Use jpg, jpeg, png, webp ou gif.')


def _is_animated_gif(ext: str, image: Image.Image) -> bool:
    if ext != '.gif':
        return False
    return bool(getattr(image, 'is_animated', False) and int(getattr(image, 'n_frames', 1)) > 1)


def _resize_to_width(image: Image.Image, width: int) -> Image.Image:
    current_width, current_height = image.size
    if current_width <= width:
        return image.copy()
    ratio = width / float(max(1, current_width))
    next_height = max(1, int(round(current_height * ratio)))
    return image.resize((width, next_height), Image.Resampling.LANCZOS)


def _save_webp(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(
        destination,
        format='WEBP',
        quality=82,
        method=6,
        optimize=True,
    )


def optimize_image_upload(
    *,
    file: UploadFile,
    target_dir: Path,
    url_prefix: str,
    source: str,
    base_name: str,
    profile: str = 'default',
) -> OptimizedImageResult:
    ext = _normalize_extension(file)
    raw_bytes = file.file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail='Arquivo vazio.')

    target_dir.mkdir(parents=True, exist_ok=True)
    profile_widths = PROFILE_WIDTHS.get(profile, PROFILE_WIDTHS['default'])
    original_size = len(raw_bytes)

    try:
        with Image.open(BytesIO(raw_bytes)) as loaded:
            loaded.verify()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail='Arquivo de imagem invalido.') from None

    with Image.open(BytesIO(raw_bytes)) as loaded:
        image = ImageOps.exif_transpose(loaded)
        animated_gif = _is_animated_gif(ext, image)

        max_allowed = MAX_GIF_BYTES if animated_gif else MAX_STATIC_BYTES
        if original_size > max_allowed:
            limit_mb = int(max_allowed / (1024 * 1024))
            raise HTTPException(status_code=400, detail=f'Arquivo muito grande. Limite de {limit_mb}MB.')

        if animated_gif:
            final_name = f'{base_name}.gif'
            final_path = target_dir / final_name
            final_path.write_bytes(raw_bytes)
            file_url = f'{url_prefix}{final_name}'
            persist_image_file_base64(
                file_url=file_url,
                file_path=final_path,
                source=source,
                mime_type='image/gif',
                original_url=file_url,
                thumbnail_url=file_url,
                medium_url=file_url,
                large_url=file_url,
                is_animated=True,
                optimized_format='gif',
            )
            return OptimizedImageResult(
                url=file_url,
                original_url=file_url,
                thumbnail_url=file_url,
                medium_url=file_url,
                large_url=file_url,
                mime_type='image/gif',
                is_animated=True,
                optimized_format='gif',
                original_size_bytes=original_size,
                optimized_size_bytes=final_path.stat().st_size,
            )

        original_name = f'{base_name}__orig{ext}'
        original_path = target_dir / original_name
        original_path.write_bytes(raw_bytes)
        original_url = f'{url_prefix}{original_name}'

        mode = image.mode
        converted = image.convert('RGBA' if mode in ('RGBA', 'LA', 'P') else 'RGB')
        thumb = _resize_to_width(converted, profile_widths['thumbnail'])
        medium = _resize_to_width(converted, profile_widths['medium'])
        large = _resize_to_width(converted, profile_widths['large'])

        thumb_name = f'{base_name}__thumb.webp'
        medium_name = f'{base_name}__medium.webp'
        large_name = f'{base_name}__large.webp'
        canonical_name = f'{base_name}.webp'

        thumb_path = target_dir / thumb_name
        medium_path = target_dir / medium_name
        large_path = target_dir / large_name
        canonical_path = target_dir / canonical_name

        _save_webp(thumb, thumb_path)
        _save_webp(medium, medium_path)
        _save_webp(large, large_path)
        shutil.copyfile(large_path, canonical_path)

        thumb_url = f'{url_prefix}{thumb_name}'
        medium_url = f'{url_prefix}{medium_name}'
        large_url = f'{url_prefix}{large_name}'
        canonical_url = f'{url_prefix}{canonical_name}'

        persist_image_file_base64(
            file_url=canonical_url,
            file_path=canonical_path,
            source=source,
            mime_type='image/webp',
            original_url=original_url,
            thumbnail_url=thumb_url,
            medium_url=medium_url,
            large_url=large_url,
            is_animated=False,
            optimized_format='webp',
        )

        return OptimizedImageResult(
            url=canonical_url,
            original_url=original_url,
            thumbnail_url=thumb_url,
            medium_url=medium_url,
            large_url=large_url,
            mime_type='image/webp',
            is_animated=False,
            optimized_format='webp',
            original_size_bytes=original_size,
            optimized_size_bytes=canonical_path.stat().st_size,
        )
