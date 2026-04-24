import io
import json
import math
import re
import struct
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
from xml.etree import ElementTree as ET

from fastapi import HTTPException, UploadFile

from app.core.config import MODELS_3D_UPLOADS_DIR

MAX_3MF_FILE_SIZE_BYTES = 80 * 1024 * 1024
ALLOWED_3MF_EXTENSION = '.3mf'
IMPORT_3MF_DIR = MODELS_3D_UPLOADS_DIR / 'import_3mf'
MANIFEST_FILE_NAME = 'manifest.json'

UNIT_TO_MM = {
    'micron': 0.001,
    'millimeter': 1.0,
    'centimeter': 10.0,
    'meter': 1000.0,
    'inch': 25.4,
    'foot': 304.8,
}


def _local_name(tag: str) -> str:
    if not tag:
        return ''
    if '}' not in tag:
        return tag
    return tag.split('}', 1)[1]


def _sanitize_filename_base(value: str, fallback: str = 'modelo') -> str:
    text = str(value or '').strip()
    if not text:
        return fallback
    text = Path(text).stem.strip()
    text = re.sub(r'[^A-Za-z0-9._-]+', '_', text)
    text = re.sub(r'_+', '_', text).strip('._-')
    return text[:120] or fallback


def _matrix_identity() -> tuple[float, ...]:
    return (1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0)


def _parse_transform(raw: str | None) -> tuple[float, ...]:
    text = str(raw or '').strip()
    if not text:
        return _matrix_identity()
    values: list[float] = []
    for token in text.replace(',', ' ').split():
        try:
            values.append(float(token))
        except ValueError:
            return _matrix_identity()
    if len(values) != 12:
        return _matrix_identity()
    return tuple(values)


def _compose_transform(parent: tuple[float, ...], child: tuple[float, ...]) -> tuple[float, ...]:
    pa, pb, pc, pd, pe, pf, pg, ph, pi, pj, pk, pl = parent
    ca, cb, cc, cd, ce, cf, cg, ch, ci, cj, ck, cl = child
    return (
        pa * ca + pb * ce + pc * ci,
        pa * cb + pb * cf + pc * cj,
        pa * cc + pb * cg + pc * ck,
        pa * cd + pb * ch + pc * cl + pd,
        pe * ca + pf * ce + pg * ci,
        pe * cb + pf * cf + pg * cj,
        pe * cc + pf * cg + pg * ck,
        pe * cd + pf * ch + pg * cl + ph,
        pi * ca + pj * ce + pk * ci,
        pi * cb + pj * cf + pk * cj,
        pi * cc + pj * cg + pk * ck,
        pi * cd + pj * ch + pk * cl + pl,
    )


def _apply_transform(matrix: tuple[float, ...], point: tuple[float, float, float]) -> tuple[float, float, float]:
    a, b, c, d, e, f, g, h, i, j, k, l = matrix
    x, y, z = point
    return (
        a * x + b * y + c * z + d,
        e * x + f * y + g * z + h,
        i * x + j * y + k * z + l,
    )


def _parse_metadata_map(node: ET.Element) -> dict[str, str]:
    output: dict[str, str] = {}
    for child in list(node):
        if _local_name(child.tag).lower() != 'metadata':
            continue
        name = str(child.attrib.get('name') or child.attrib.get('type') or '').strip().lower()
        value = str(child.text or '').strip()
        if not value:
            continue
        if name:
            output[name] = value
        output[f'value:{len(output)}'] = value
    return output


def _plate_from_metadata(values: dict[str, str]) -> int | None:
    for key, value in values.items():
        blob = f'{key} {value}'.lower()
        if 'plate' not in blob and 'buildplate' not in blob:
            continue
        if str(value).strip().isdigit():
            return max(1, int(value))
        match = re.search(r'(?:plate|buildplate)[^\d]{0,5}(\d+)', blob)
        if match:
            return max(1, int(match.group(1)))
    return None


def _normal_for_triangle(triangle: tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]) -> tuple[float, float, float]:
    (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = triangle
    ux, uy, uz = x2 - x1, y2 - y1, z2 - z1
    vx, vy, vz = x3 - x1, y3 - y1, z3 - z1
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    if length <= 1e-12:
        return (0.0, 0.0, 0.0)
    return (nx / length, ny / length, nz / length)


def _binary_stl_bytes(name: str, triangles: list[tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]]) -> bytes:
    header = f'Generated from 3MF: {name}'.encode('ascii', errors='ignore')[:80]
    header = header.ljust(80, b' ')
    out = io.BytesIO()
    out.write(header)
    out.write(struct.pack('<I', len(triangles)))
    for triangle in triangles:
        nx, ny, nz = _normal_for_triangle(triangle)
        out.write(struct.pack('<fff', nx, ny, nz))
        for vertex in triangle:
            out.write(struct.pack('<fff', float(vertex[0]), float(vertex[1]), float(vertex[2])))
        out.write(struct.pack('<H', 0))
    return out.getvalue()


def _dimensions_from_triangles(triangles: list[tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]]) -> tuple[float, float, float] | None:
    if not triangles:
        return None
    min_x = min_y = min_z = float('inf')
    max_x = max_y = max_z = float('-inf')
    for triangle in triangles:
        for vx, vy, vz in triangle:
            min_x = min(min_x, vx)
            min_y = min(min_y, vy)
            min_z = min(min_z, vz)
            max_x = max(max_x, vx)
            max_y = max(max_y, vy)
            max_z = max(max_z, vz)
    if min_x == float('inf'):
        return None
    return (
        round(max_x - min_x, 3),
        round(max_y - min_y, 3),
        round(max_z - min_z, 3),
    )


def _load_3mf_model_xml(content: bytes) -> tuple[ET.Element, str]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(content), 'r')
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail='Arquivo .3mf invalido ou corrompido.') from exc
    model_candidates = sorted(
        [name for name in archive.namelist() if name.lower().startswith('3d/') and name.lower().endswith('.model')],
        key=lambda item: (0 if item.lower() == '3d/3dmodel.model' else 1, item),
    )
    if not model_candidates:
        raise HTTPException(status_code=400, detail='Nao foi encontrado arquivo .model dentro do pacote 3MF.')
    model_name = model_candidates[0]
    xml_bytes = archive.read(model_name)
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise HTTPException(status_code=400, detail='Conteudo XML do 3MF invalido.') from exc
    return root, model_name


def _parse_3mf_triangles_by_group(content: bytes) -> tuple[list[dict[str, Any]], bool]:
    root, _ = _load_3mf_model_xml(content)
    unit = str(root.attrib.get('unit') or 'millimeter').strip().lower()
    unit_scale = float(UNIT_TO_MM.get(unit, 1.0))

    resources_node = next((node for node in list(root) if _local_name(node.tag).lower() == 'resources'), None)
    build_node = next((node for node in list(root) if _local_name(node.tag).lower() == 'build'), None)
    if resources_node is None:
        raise HTTPException(status_code=400, detail='3MF sem secao resources.')

    object_nodes: dict[int, ET.Element] = {}
    object_metadata: dict[int, dict[str, str]] = {}
    object_meshes: dict[int, dict[str, Any]] = {}
    object_components: dict[int, list[tuple[int, tuple[float, ...]]]] = {}

    for node in list(resources_node):
        if _local_name(node.tag).lower() != 'object':
            continue
        object_id_raw = node.attrib.get('id')
        if object_id_raw is None:
            continue
        try:
            object_id = int(object_id_raw)
        except ValueError:
            continue
        object_nodes[object_id] = node
        object_metadata[object_id] = _parse_metadata_map(node)
        mesh_node = next((child for child in list(node) if _local_name(child.tag).lower() == 'mesh'), None)
        if mesh_node is not None:
            vertices_node = next((child for child in list(mesh_node) if _local_name(child.tag).lower() == 'vertices'), None)
            triangles_node = next((child for child in list(mesh_node) if _local_name(child.tag).lower() == 'triangles'), None)
            vertices: list[tuple[float, float, float]] = []
            triangles: list[tuple[int, int, int]] = []
            if vertices_node is not None:
                for vertex_node in list(vertices_node):
                    if _local_name(vertex_node.tag).lower() != 'vertex':
                        continue
                    try:
                        vertices.append((
                            float(vertex_node.attrib.get('x') or 0.0),
                            float(vertex_node.attrib.get('y') or 0.0),
                            float(vertex_node.attrib.get('z') or 0.0),
                        ))
                    except ValueError:
                        continue
            if triangles_node is not None:
                for tri_node in list(triangles_node):
                    if _local_name(tri_node.tag).lower() != 'triangle':
                        continue
                    try:
                        v1 = int(tri_node.attrib.get('v1'))
                        v2 = int(tri_node.attrib.get('v2'))
                        v3 = int(tri_node.attrib.get('v3'))
                    except (TypeError, ValueError):
                        continue
                    if min(v1, v2, v3) < 0 or max(v1, v2, v3) >= len(vertices):
                        continue
                    triangles.append((v1, v2, v3))
            object_meshes[object_id] = {'vertices': vertices, 'triangles': triangles}

        components_node = next((child for child in list(node) if _local_name(child.tag).lower() == 'components'), None)
        if components_node is not None:
            comps: list[tuple[int, tuple[float, ...]]] = []
            for comp_node in list(components_node):
                if _local_name(comp_node.tag).lower() != 'component':
                    continue
                obj_ref_raw = comp_node.attrib.get('objectid')
                if obj_ref_raw is None:
                    continue
                try:
                    obj_ref = int(obj_ref_raw)
                except ValueError:
                    continue
                comps.append((obj_ref, _parse_transform(comp_node.attrib.get('transform'))))
            if comps:
                object_components[object_id] = comps

    if not object_nodes:
        raise HTTPException(status_code=400, detail='Nao foi encontrado nenhum objeto dentro do 3MF.')

    def collect_object_triangles(
        object_id: int,
        transform: tuple[float, ...],
        stack: set[int],
    ) -> list[tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]]:
        if object_id in stack:
            return []
        next_stack = set(stack)
        next_stack.add(object_id)
        output: list[tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]] = []
        mesh = object_meshes.get(object_id)
        if mesh and mesh['vertices'] and mesh['triangles']:
            vertices = mesh['vertices']
            for i1, i2, i3 in mesh['triangles']:
                p1 = _apply_transform(transform, vertices[i1])
                p2 = _apply_transform(transform, vertices[i2])
                p3 = _apply_transform(transform, vertices[i3])
                if unit_scale != 1.0:
                    p1 = (p1[0] * unit_scale, p1[1] * unit_scale, p1[2] * unit_scale)
                    p2 = (p2[0] * unit_scale, p2[1] * unit_scale, p2[2] * unit_scale)
                    p3 = (p3[0] * unit_scale, p3[1] * unit_scale, p3[2] * unit_scale)
                output.append((p1, p2, p3))
        for child_object_id, child_transform in object_components.get(object_id, []):
            output.extend(collect_object_triangles(child_object_id, _compose_transform(transform, child_transform), next_stack))
        return output

    build_items: list[dict[str, Any]] = []
    if build_node is not None:
        for idx, node in enumerate(list(build_node)):
            if _local_name(node.tag).lower() != 'item':
                continue
            object_id_raw = node.attrib.get('objectid')
            if object_id_raw is None:
                continue
            try:
                object_id = int(object_id_raw)
            except ValueError:
                continue
            item_meta = _parse_metadata_map(node)
            plate_number = _plate_from_metadata(item_meta) or _plate_from_metadata(object_metadata.get(object_id, {}))
            build_items.append(
                {
                    'index': idx + 1,
                    'object_id': object_id,
                    'transform': _parse_transform(node.attrib.get('transform')),
                    'plate_number': plate_number,
                }
            )

    groups: list[dict[str, Any]] = []
    plate_detected = any(item.get('plate_number') is not None for item in build_items)

    if plate_detected and build_items:
        grouped_by_plate: dict[int, list[dict[str, Any]]] = {}
        for item in build_items:
            if item.get('plate_number') is None:
                continue
            grouped_by_plate.setdefault(int(item['plate_number']), []).append(item)
        for plate_number in sorted(grouped_by_plate.keys()):
            triangles: list[tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]] = []
            for item in grouped_by_plate[plate_number]:
                triangles.extend(collect_object_triangles(item['object_id'], item['transform'], set()))
            if not triangles:
                continue
            groups.append(
                {
                    'plate_number': int(plate_number),
                    'display_label': f'Plate {plate_number}',
                    'triangles': triangles,
                }
            )

    if not groups:
        fallback_items = build_items or [{'index': idx + 1, 'object_id': object_id, 'transform': _matrix_identity()} for idx, object_id in enumerate(sorted(object_nodes.keys()))]
        for fallback in fallback_items:
            triangles = collect_object_triangles(fallback['object_id'], fallback['transform'], set())
            if not triangles:
                continue
            groups.append(
                {
                    'plate_number': None,
                    'display_label': f'Objeto {fallback["index"]}',
                    'triangles': triangles,
                }
            )

    if not groups:
        raise HTTPException(status_code=400, detail='Nao foi possivel extrair malhas do arquivo 3MF.')

    return groups, not plate_detected


def process_3mf_file(file: UploadFile) -> dict[str, Any]:
    ext = Path(str(file.filename or '')).suffix.lower().strip()
    if ext != ALLOWED_3MF_EXTENSION:
        raise HTTPException(status_code=400, detail='Envie apenas arquivo .3mf.')
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail='Arquivo .3mf vazio.')
    if len(content) > MAX_3MF_FILE_SIZE_BYTES:
        max_mb = MAX_3MF_FILE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f'Arquivo muito grande. Limite: {max_mb} MB.')

    groups, used_fallback = _parse_3mf_triangles_by_group(content)

    IMPORT_3MF_DIR.mkdir(parents=True, exist_ok=True)
    session_id = uuid4().hex
    session_dir = (IMPORT_3MF_DIR / session_id).resolve()
    session_dir.mkdir(parents=True, exist_ok=True)

    source_name = _sanitize_filename_base(file.filename or 'modelo') + '.3mf'
    (session_dir / source_name).write_bytes(content)

    base_name = _sanitize_filename_base(file.filename or 'modelo')
    items: list[dict[str, Any]] = []
    existing_names: set[str] = set()
    for index, group in enumerate(groups, start=1):
        plate = group.get('plate_number')
        if plate is not None:
            file_name = f'{base_name}_plate_{int(plate)}.stl'
        else:
            file_name = f'{base_name}_objeto_{index}.stl'
        if file_name in existing_names:
            file_name = f'{Path(file_name).stem}_{index}.stl'
        existing_names.add(file_name)

        triangles = group['triangles']
        stl_bytes = _binary_stl_bytes(file_name, triangles)
        target_path = session_dir / file_name
        target_path.write_bytes(stl_bytes)
        dims = _dimensions_from_triangles(triangles) or (None, None, None)
        items.append(
            {
                'part_id': index,
                'file_name': file_name,
                'plate_number': plate,
                'width_mm': dims[0],
                'height_mm': dims[1],
                'depth_mm': dims[2],
                'file_size_bytes': int(target_path.stat().st_size),
                'stl_file_url': f'/uploads/models3d/import_3mf/{session_id}/{file_name}',
                'download_endpoint': f'/admin/3d-models/import-3mf/{session_id}/download/{index}',
                'display_label': str(group.get('display_label') or f'Item {index}'),
            }
        )

    manifest = {
        'session_id': session_id,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'source_file_name': source_name,
        'used_fallback': bool(used_fallback),
        'warning_message': (
            'Nao foi possivel identificar plates diretamente. Os arquivos foram separados por objeto.'
            if used_fallback
            else None
        ),
        'items': items,
    }
    (session_dir / MANIFEST_FILE_NAME).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest


def _validate_session_id(raw: str) -> str:
    value = str(raw or '').strip()
    if not value or not re.fullmatch(r'[a-fA-F0-9]{32}', value):
        raise HTTPException(status_code=404, detail='Sessao de importacao 3MF nao encontrada.')
    return value.lower()


def _session_dir(session_id: str) -> Path:
    normalized = _validate_session_id(session_id)
    root = IMPORT_3MF_DIR.resolve()
    target = (IMPORT_3MF_DIR / normalized).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail='Sessao de importacao 3MF nao encontrada.') from exc
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail='Sessao de importacao 3MF nao encontrada.')
    return target


def get_3mf_manifest(session_id: str) -> dict[str, Any]:
    session = _session_dir(session_id)
    manifest_path = session / MANIFEST_FILE_NAME
    if not manifest_path.exists() or not manifest_path.is_file():
        raise HTTPException(status_code=404, detail='Resultado da importacao nao encontrado.')
    try:
        return json.loads(manifest_path.read_text(encoding='utf-8'))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail='Manifesto da importacao invalido.') from exc


def get_3mf_generated_part_path(session_id: str, part_id: int) -> tuple[Path, dict[str, Any]]:
    manifest = get_3mf_manifest(session_id)
    item = next((entry for entry in manifest.get('items') or [] if int(entry.get('part_id') or 0) == int(part_id)), None)
    if not item:
        raise HTTPException(status_code=404, detail='Arquivo STL gerado nao encontrado.')
    file_name = Path(str(item.get('file_name') or '')).name
    if not file_name:
        raise HTTPException(status_code=404, detail='Arquivo STL gerado nao encontrado.')
    path = (_session_dir(session_id) / file_name).resolve()
    root = _session_dir(session_id).resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail='Arquivo STL gerado nao encontrado.') from exc
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail='Arquivo STL gerado nao encontrado.')
    return path, item
