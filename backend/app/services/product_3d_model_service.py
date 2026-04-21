import base64
import json
import re
import struct
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import MODELS_3D_ORIGINAL_UPLOADS_DIR, MODELS_3D_PREVIEW_UPLOADS_DIR, UPLOADS_DIR
from app.models import Product, Product3DModel
from app.services.product_service import parse_sub_items_from_storage

ALLOWED_ORIGINAL_EXTENSIONS = {'.3mf', '.stl', '.gcode', '.glb', '.obj', '.step', '.stp'}
ALLOWED_PREVIEW_EXTENSIONS = {'.stl', '.glb'}


def _extension(filename: str) -> str:
    return Path(str(filename or '')).suffix.lower().strip()


def _public_url_for(path: Path) -> str:
    parts = path.parts
    if 'uploads' not in parts:
        raise HTTPException(status_code=500, detail='Caminho de upload invalido.')
    uploads_index = parts.index('uploads')
    return '/' + '/'.join(parts[uploads_index:])


def _sanitize_filename_base(value: str) -> str:
    text = str(value or '').strip()
    if not text:
        return ''
    text = Path(text).stem.strip()
    text = re.sub(r'[^A-Za-z0-9._-]+', '_', text)
    text = re.sub(r'_+', '_', text).strip('._-')
    return text[:120]


def _resolve_target_with_name(directory: Path, extension: str, preferred_name: str | None, fallback_prefix: str) -> Path:
    safe_ext = str(extension or '').lower().strip()
    base = _sanitize_filename_base(preferred_name or '')
    if not base:
        base = f'{fallback_prefix}-{uuid4().hex[:8]}'
    candidate = directory / f'{base}{safe_ext}'
    if not candidate.exists():
        return candidate
    index = 2
    while True:
        candidate = directory / f'{base}-{index}{safe_ext}'
        if not candidate.exists():
            return candidate
        index += 1


def _exact_target_with_name(directory: Path, extension: str, preferred_name: str | None, fallback_prefix: str) -> Path:
    safe_ext = str(extension or '').lower().strip()
    base = _sanitize_filename_base(preferred_name or '')
    if not base:
        base = f'{fallback_prefix}-{uuid4().hex[:8]}'
    return directory / f'{base}{safe_ext}'


def _normalize_dimensions(width: float, height: float, depth: float) -> tuple[float, float, float] | None:
    values = [float(width or 0), float(height or 0), float(depth or 0)]
    if any(value < 0 for value in values):
        return None
    if all(value == 0 for value in values):
        return None
    return (round(values[0], 3), round(values[1], 3), round(values[2], 3))


def _extract_stl_dimensions(content: bytes) -> tuple[float, float, float] | None:
    if not content:
        return None

    # Binary STL: 80-byte header + uint32 tri count + 50 bytes per triangle.
    if len(content) >= 84:
        tri_count = struct.unpack_from('<I', content, 80)[0]
        expected = 84 + tri_count * 50
        if expected == len(content):
            min_x = min_y = min_z = float('inf')
            max_x = max_y = max_z = float('-inf')
            offset = 84
            for _ in range(tri_count):
                # Skip normal vector.
                offset += 12
                for _vertex in range(3):
                    x, y, z = struct.unpack_from('<fff', content, offset)
                    offset += 12
                    min_x = min(min_x, x)
                    min_y = min(min_y, y)
                    min_z = min(min_z, z)
                    max_x = max(max_x, x)
                    max_y = max(max_y, y)
                    max_z = max(max_z, z)
                # Attribute byte count.
                offset += 2
            if min_x != float('inf'):
                return _normalize_dimensions(max_x - min_x, max_y - min_y, max_z - min_z)

    # ASCII STL fallback.
    min_x = min_y = min_z = float('inf')
    max_x = max_y = max_z = float('-inf')
    try:
        text = content.decode('utf-8', errors='ignore')
    except Exception:  # noqa: BLE001
        return None
    for line in text.splitlines():
        clean = line.strip().lower()
        if not clean.startswith('vertex '):
            continue
        parts = clean.split()
        if len(parts) != 4:
            continue
        try:
            x = float(parts[1])
            y = float(parts[2])
            z = float(parts[3])
        except ValueError:
            continue
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        min_z = min(min_z, z)
        max_x = max(max_x, x)
        max_y = max(max_y, y)
        max_z = max(max_z, z)
    if min_x == float('inf'):
        return None
    return _normalize_dimensions(max_x - min_x, max_y - min_y, max_z - min_z)


def _read_glb_chunks(content: bytes) -> tuple[dict, bytes | None]:
    if len(content) < 20:
        raise ValueError('Arquivo GLB invalido.')
    magic, version, length = struct.unpack_from('<4sII', content, 0)
    if magic != b'glTF' or version != 2 or length > len(content):
        raise ValueError('Cabecalho GLB invalido.')

    offset = 12
    gltf_json = None
    bin_chunk = None
    while offset + 8 <= len(content):
        chunk_length, chunk_type = struct.unpack_from('<I4s', content, offset)
        offset += 8
        chunk_data = content[offset: offset + chunk_length]
        offset += chunk_length
        if chunk_type == b'JSON':
            gltf_json = json.loads(chunk_data.decode('utf-8'))
        elif chunk_type == b'BIN\x00':
            bin_chunk = chunk_data
    if not isinstance(gltf_json, dict):
        raise ValueError('Chunk JSON GLB ausente.')
    return gltf_json, bin_chunk


def _gltf_buffer_data(gltf: dict, glb_bin: bytes | None, index: int) -> bytes | None:
    buffers = gltf.get('buffers') or []
    if index < 0 or index >= len(buffers):
        return None
    entry = buffers[index] or {}
    uri = entry.get('uri')
    if uri:
        if isinstance(uri, str) and uri.startswith('data:') and ';base64,' in uri:
            _, raw = uri.split(';base64,', 1)
            return base64.b64decode(raw)
        return None
    return glb_bin


def _extract_glb_dimensions(content: bytes) -> tuple[float, float, float] | None:
    gltf, glb_bin = _read_glb_chunks(content)
    accessors = gltf.get('accessors') or []
    buffer_views = gltf.get('bufferViews') or []
    meshes = gltf.get('meshes') or []

    min_xyz = [float('inf'), float('inf'), float('inf')]
    max_xyz = [float('-inf'), float('-inf'), float('-inf')]
    has_points = False

    def apply_minmax(values_min, values_max):
        nonlocal has_points
        if not isinstance(values_min, list) or not isinstance(values_max, list) or len(values_min) < 3 or len(values_max) < 3:
            return
        for i in range(3):
            min_xyz[i] = min(min_xyz[i], float(values_min[i]))
            max_xyz[i] = max(max_xyz[i], float(values_max[i]))
        has_points = True

    for mesh in meshes:
        for primitive in mesh.get('primitives') or []:
            attributes = primitive.get('attributes') or {}
            accessor_index = attributes.get('POSITION')
            if accessor_index is None or accessor_index >= len(accessors):
                continue
            accessor = accessors[accessor_index] or {}
            acc_min = accessor.get('min')
            acc_max = accessor.get('max')
            if acc_min is not None and acc_max is not None:
                apply_minmax(acc_min, acc_max)
                continue

            # Fallback: read raw VEC3 float data from accessor.
            if accessor.get('type') != 'VEC3' or int(accessor.get('componentType') or 0) != 5126:
                continue
            count = int(accessor.get('count') or 0)
            if count <= 0:
                continue
            view_index = int(accessor.get('bufferView') or -1)
            if view_index < 0 or view_index >= len(buffer_views):
                continue
            view = buffer_views[view_index] or {}
            buffer_index = int(view.get('buffer') or 0)
            data = _gltf_buffer_data(gltf, glb_bin, buffer_index)
            if not data:
                continue
            view_offset = int(view.get('byteOffset') or 0)
            accessor_offset = int(accessor.get('byteOffset') or 0)
            stride = int(view.get('byteStride') or 12)
            start = view_offset + accessor_offset
            for idx in range(count):
                pos = start + idx * stride
                if pos + 12 > len(data):
                    break
                x, y, z = struct.unpack_from('<fff', data, pos)
                min_xyz[0] = min(min_xyz[0], x)
                min_xyz[1] = min(min_xyz[1], y)
                min_xyz[2] = min(min_xyz[2], z)
                max_xyz[0] = max(max_xyz[0], x)
                max_xyz[1] = max(max_xyz[1], y)
                max_xyz[2] = max(max_xyz[2], z)
                has_points = True

    if not has_points:
        return None
    return _normalize_dimensions(max_xyz[0] - min_xyz[0], max_xyz[1] - min_xyz[1], max_xyz[2] - min_xyz[2])


def extract_dimensions_from_preview(file_path: Path) -> tuple[float, float, float] | None:
    extension = file_path.suffix.lower()
    content = file_path.read_bytes()
    if extension == '.stl':
        return _extract_stl_dimensions(content)
    if extension == '.glb':
        try:
            return _extract_glb_dimensions(content)
        except Exception:  # noqa: BLE001
            return None
    return None


def save_original_model_file(file: UploadFile, preferred_name: str | None = None) -> str:
    ext = _extension(file.filename)
    if ext not in ALLOWED_ORIGINAL_EXTENSIONS:
        raise HTTPException(status_code=400, detail='Formato de arquivo original nao suportado.')
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail='Arquivo original vazio.')
    preferred_target = _exact_target_with_name(MODELS_3D_ORIGINAL_UPLOADS_DIR, ext, preferred_name or file.filename, 'model')
    # If same filename already exists with the same content, reuse it instead of duplicating.
    if preferred_target.exists() and preferred_target.read_bytes() == content:
        return _public_url_for(preferred_target)
    target = preferred_target if not preferred_target.exists() else _resolve_target_with_name(MODELS_3D_ORIGINAL_UPLOADS_DIR, ext, preferred_name or file.filename, 'model')
    target.write_bytes(content)
    return _public_url_for(target)


def save_preview_model_file(file: UploadFile, preferred_name: str | None = None) -> tuple[str, tuple[float, float, float] | None]:
    ext = _extension(file.filename)
    if ext not in ALLOWED_PREVIEW_EXTENSIONS:
        raise HTTPException(status_code=400, detail='Formato de arquivo de preview nao suportado. Use .glb ou .stl.')
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail='Arquivo de preview vazio.')
    preferred_target = _exact_target_with_name(MODELS_3D_PREVIEW_UPLOADS_DIR, ext, preferred_name or file.filename, 'preview')
    # Reuse identical file when same name + same bytes were already uploaded.
    if preferred_target.exists() and preferred_target.read_bytes() == content:
        dimensions = extract_dimensions_from_preview(preferred_target)
        return _public_url_for(preferred_target), dimensions
    target = preferred_target if not preferred_target.exists() else _resolve_target_with_name(MODELS_3D_PREVIEW_UPLOADS_DIR, ext, preferred_name or file.filename, 'preview')
    target.write_bytes(content)
    dimensions = extract_dimensions_from_preview(target)
    return _public_url_for(target), dimensions


def list_product_3d_models(
    db: Session,
    product_id: int,
    *,
    active_only: bool = False,
    sub_item_id: str | None = None,
) -> list[Product3DModel]:
    query = db.query(Product3DModel).filter(Product3DModel.product_id == int(product_id))
    normalized_sub_item_id = str(sub_item_id or '').strip()
    if normalized_sub_item_id:
        query = query.filter(Product3DModel.sub_item_id == normalized_sub_item_id)
    if active_only:
        query = query.filter(Product3DModel.is_active == True)
    return query.order_by(Product3DModel.sort_order.asc(), Product3DModel.id.asc()).all()


def get_product_3d_model(db: Session, model_id: int) -> Product3DModel | None:
    return db.query(Product3DModel).filter(Product3DModel.id == int(model_id)).first()


def list_all_3d_models(
    db: Session,
    *,
    search: str | None = None,
    product_id: int | None = None,
    is_active: bool | None = None,
    allow_download: bool | None = None,
    created_from: str | None = None,
    created_to: str | None = None,
) -> list[Product3DModel]:
    query = db.query(Product3DModel).options(joinedload(Product3DModel.product))
    if product_id is not None:
        query = query.filter(Product3DModel.product_id == int(product_id))
    if is_active is not None:
        query = query.filter(Product3DModel.is_active == bool(is_active))
    if allow_download is not None:
        query = query.filter(Product3DModel.allow_download == bool(allow_download))
    if created_from:
        try:
            start = datetime.fromisoformat(str(created_from))
            query = query.filter(Product3DModel.created_at >= start)
        except ValueError:
            pass
    if created_to:
        try:
            end = datetime.fromisoformat(str(created_to))
            query = query.filter(Product3DModel.created_at <= end)
        except ValueError:
            pass
    text = str(search or '').strip()
    if text:
        like = f'%{text}%'
        query = query.outerjoin(Product, Product.id == Product3DModel.product_id).filter(
            or_(
                Product3DModel.name.ilike(like),
                Product3DModel.description.ilike(like),
                Product3DModel.sub_item_id.ilike(like),
                Product.title.ilike(like),
                Product.slug.ilike(like),
            )
        )
    return query.order_by(Product3DModel.created_at.desc(), Product3DModel.id.desc()).all()


def url_to_upload_path(public_url: str | None) -> Path | None:
    value = str(public_url or '').strip()
    if not value:
        return None
    clean = value.split('?', 1)[0].split('#', 1)[0].strip()
    if not clean.startswith('/uploads/'):
        return None
    relative = clean[len('/uploads/'):].strip('/\\')
    if not relative:
        return None
    path = (UPLOADS_DIR / relative).resolve()
    uploads_root = UPLOADS_DIR.resolve()
    try:
        path.relative_to(uploads_root)
    except ValueError:
        return None
    if not path.exists() or not path.is_file():
        return None
    return path


def get_primary_model_dimensions_map(db: Session, product_ids: list[int]) -> dict[int, tuple[float, float, float]]:
    ids = [int(item) for item in product_ids if int(item) > 0]
    if not ids:
        return {}
    rows = (
        db.query(Product3DModel)
        .filter(
            Product3DModel.product_id.in_(ids),
            Product3DModel.is_active == True,
            Product3DModel.sub_item_id.is_(None),
        )
        .order_by(Product3DModel.product_id.asc(), Product3DModel.sort_order.asc(), Product3DModel.id.asc())
        .all()
    )
    output: dict[int, tuple[float, float, float]] = {}
    for row in rows:
        pid = int(row.product_id)
        if pid in output:
            continue
        if row.width_mm is None or row.height_mm is None or row.depth_mm is None:
            continue
        dimensions = _normalize_dimensions(row.width_mm, row.height_mm, row.depth_mm)
        if dimensions:
            output[pid] = dimensions
    return output


def get_sub_item_dimensions_map(
    db: Session,
    product_ids: list[int],
) -> dict[tuple[int, str], tuple[float, float, float]]:
    ids = [int(item) for item in product_ids if int(item) > 0]
    if not ids:
        return {}
    rows = (
        db.query(Product3DModel)
        .filter(
            Product3DModel.product_id.in_(ids),
            Product3DModel.is_active == True,
            Product3DModel.sub_item_id.is_not(None),
        )
        .order_by(Product3DModel.product_id.asc(), Product3DModel.sub_item_id.asc(), Product3DModel.sort_order.asc(), Product3DModel.id.asc())
        .all()
    )
    output: dict[tuple[int, str], tuple[float, float, float]] = {}
    for row in rows:
        sub_item_id = str(row.sub_item_id or '').strip()
        if not sub_item_id:
            continue
        key = (int(row.product_id), sub_item_id)
        if key in output:
            continue
        if row.width_mm is None or row.height_mm is None or row.depth_mm is None:
            continue
        dimensions = _normalize_dimensions(row.width_mm, row.height_mm, row.depth_mm)
        if dimensions:
            output[key] = dimensions
    return output


def apply_effective_product_dimensions(products: list, db: Session) -> None:
    if not products:
        return
    ids = [int(item.id) for item in products if getattr(item, 'id', None)]
    by_product = get_primary_model_dimensions_map(db, ids)
    by_sub_item = get_sub_item_dimensions_map(db, ids)
    for product in products:
        width = getattr(product, 'width_mm', None)
        height = getattr(product, 'height_mm', None)
        depth = getattr(product, 'depth_mm', None)
        source = str(getattr(product, 'dimensions_source', 'manual') or 'manual')

        has_manual = width is not None and height is not None and depth is not None
        preferred_model = source == 'model' or not has_manual
        if preferred_model and int(product.id) in by_product:
            model_dims = by_product[int(product.id)]
            product.width_mm = model_dims[0]
            product.height_mm = model_dims[1]
            product.depth_mm = model_dims[2]
            product.dimensions_source = 'model'
        elif has_manual:
            product.dimensions_source = 'manual'

        # Resolve sub-item dimensions with priority:
        # manual sub-item dimensions -> 3D model linked to sub-item -> none.
        parsed_sub_items = parse_sub_items_from_storage(getattr(product, 'sub_items', []))
        for sub_item in parsed_sub_items:
            sub_item_id = str(sub_item.get('id') or '').strip()
            manual_dims = (
                sub_item.get('width_mm'),
                sub_item.get('height_mm'),
                sub_item.get('depth_mm'),
            )
            has_manual_subitem = all(value is not None for value in manual_dims)
            source = str(sub_item.get('dimensions_source') or 'manual').lower()
            if has_manual_subitem and source != 'model':
                sub_item['dimensions_source'] = 'manual'
                continue

            key = (int(product.id), sub_item_id)
            model_dims = by_sub_item.get(key)
            if model_dims:
                sub_item['width_mm'] = model_dims[0]
                sub_item['height_mm'] = model_dims[1]
                sub_item['depth_mm'] = model_dims[2]
                sub_item['dimensions_source'] = 'model'
            elif has_manual_subitem:
                sub_item['dimensions_source'] = 'manual'
            else:
                sub_item['width_mm'] = None
                sub_item['height_mm'] = None
                sub_item['depth_mm'] = None
                sub_item['dimensions_source'] = 'manual'
        product.sub_items = parsed_sub_items
