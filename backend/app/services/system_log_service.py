import json
import time
import traceback
from datetime import datetime
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import parse_admin_token
from app.db.session import SessionLocal
from app.models import AdminUser, StoreSettings, SystemLog

MAX_BODY_CHARS = 8000
SENSITIVE_KEYS = {
    'password',
    'password_hash',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'cookie',
    'secret',
    'api_key',
    'webhook_secret',
    'card_number',
    'cvv',
}
LEVEL_ORDER = {'debug': 10, 'info': 20, 'warning': 30, 'error': 40, 'critical': 50}


def _truncate(value: str | None, max_chars: int = MAX_BODY_CHARS) -> str | None:
    if value is None:
        return None
    text = str(value)
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}...[TRUNCATED:{len(text) - max_chars}]"


def _safe_json_dump(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:  # noqa: BLE001
        return json.dumps({'value': str(value)}, ensure_ascii=False)


def sanitize_value(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized = {}
        for key, inner in value.items():
            key_lower = str(key or '').strip().lower()
            if key_lower in SENSITIVE_KEYS:
                sanitized[key] = '[REDACTED]'
            else:
                sanitized[key] = sanitize_value(inner)
        return sanitized
    if isinstance(value, list):
        return [sanitize_value(item) for item in value]
    if isinstance(value, str):
        if len(value) > MAX_BODY_CHARS:
            return _truncate(value)
        return value
    return value


def _decode_admin_id_from_header(db: Session, authorization_header: str | None) -> int | None:
    value = str(authorization_header or '').strip()
    if not value.lower().startswith('bearer '):
        return None
    token = value.split(' ', 1)[1].strip()
    if not token:
        return None
    try:
        admin_id = parse_admin_token(token)
    except Exception:  # noqa: BLE001
        return None
    exists = db.query(AdminUser.id).filter(AdminUser.id == admin_id).first()
    return int(admin_id) if exists else None


def get_logging_settings(db: Session) -> StoreSettings:
    settings = db.query(StoreSettings).first()
    if settings:
        return settings
    settings = StoreSettings(id=1, whatsapp_number=None, pix_key=None)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def should_log(level: str, min_level: str) -> bool:
    return LEVEL_ORDER.get(level, 20) >= LEVEL_ORDER.get(min_level, 20)


def create_system_log(db: Session, **kwargs) -> SystemLog:
    payload = dict(kwargs)
    payload['request_headers_json'] = _safe_json_dump(sanitize_value(payload.get('request_headers_json') or {}))
    payload['response_headers_json'] = _safe_json_dump(sanitize_value(payload.get('response_headers_json') or {}))
    payload['metadata_json'] = _safe_json_dump(sanitize_value(payload.get('metadata_json') or {}))
    payload['request_body_json'] = _truncate(_safe_json_dump(sanitize_value(payload.get('request_body_json')))) if payload.get('request_body_json') is not None else None
    payload['response_body_json'] = _truncate(_safe_json_dump(sanitize_value(payload.get('response_body_json')))) if payload.get('response_body_json') is not None else None
    payload['error_message'] = _truncate(payload.get('error_message'), 4000)
    payload['stack_trace'] = _truncate(payload.get('stack_trace'), 12000)
    log = SystemLog(**payload)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def build_http_category(path: str, method: str) -> str:
    normalized = str(path or '').strip().lower()
    if normalized.startswith('/webhooks/'):
        return 'webhook'
    if normalized.startswith('/admin/auth/'):
        return 'auth'
    if normalized.startswith('/admin/') and method.upper() in {'POST', 'PUT', 'PATCH', 'DELETE'}:
        return 'admin_action'
    if normalized.startswith('/payments/'):
        return 'integration'
    return 'http'


def log_http_event(
    db: Session,
    *,
    level: str,
    method: str,
    path: str,
    query: str | None,
    request_headers: dict | None,
    request_body: Any,
    response_status: int | None,
    response_headers: dict | None,
    response_body: Any,
    duration_ms: float | None,
    response_size_bytes: int | None,
    ip_address: str | None,
    session_id: str | None,
    user_agent: str | None,
    error_message: str | None = None,
    stack_trace: str | None = None,
):
    settings = get_logging_settings(db)
    if not bool(settings.logs_enabled):
        return
    min_level = str(settings.logs_min_level or 'info').strip().lower()
    if not should_log(level, min_level):
        return
    category = build_http_category(path, method)
    if category == 'webhook' and not bool(settings.logs_capture_webhooks):
        return
    if category == 'integration' and not bool(settings.logs_capture_integrations):
        return

    admin_user_id = _decode_admin_id_from_header(db, (request_headers or {}).get('authorization'))
    capture_request_body = bool(settings.logs_capture_request_body)
    capture_response_body = bool(settings.logs_capture_response_body)
    create_system_log(
        db,
        level=level,
        category=category,
        action_name=f'{method.upper()} {path}',
        request_method=method.upper(),
        request_path=path,
        request_query=query,
        request_headers_json=request_headers or {},
        request_body_json=(request_body if capture_request_body else '[DISABLED]'),
        response_status=response_status,
        response_headers_json=response_headers or {},
        response_body_json=(response_body if capture_response_body else '[DISABLED]'),
        duration_ms=duration_ms,
        response_size_bytes=response_size_bytes,
        admin_user_id=admin_user_id,
        session_id=session_id,
        ip_address=ip_address,
        user_agent=user_agent,
        source_system='internal',
        error_message=error_message,
        stack_trace=stack_trace,
        metadata_json={},
    )


def log_business_event(
    db: Session,
    *,
    action_name: str,
    level: str = 'info',
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    source_system: str = 'internal',
    admin_user_id: int | None = None,
    metadata: dict | None = None,
    error_message: str | None = None,
):
    settings = get_logging_settings(db)
    if not bool(settings.logs_enabled):
        return
    if not should_log(level, str(settings.logs_min_level or 'info').lower()):
        return
    create_system_log(
        db,
        level=level,
        category='business_event',
        action_name=action_name,
        admin_user_id=admin_user_id,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        source_system=source_system,
        metadata_json=metadata or {},
        error_message=error_message,
    )


def log_custom_event_safely(
    *,
    level: str = 'info',
    category: str = 'business_event',
    action_name: str,
    request_method: str | None = None,
    request_path: str | None = None,
    request_query: str | None = None,
    request_headers: dict | None = None,
    request_body: Any = None,
    response_status: int | None = None,
    response_headers: dict | None = None,
    response_body: Any = None,
    duration_ms: float | None = None,
    response_size_bytes: int | None = None,
    admin_user_id: int | None = None,
    session_id: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    source_system: str | None = 'internal',
    error_message: str | None = None,
    stack_trace: str | None = None,
    metadata: dict | None = None,
) -> None:
    db = SessionLocal()
    try:
        settings = get_logging_settings(db)
        if not bool(settings.logs_enabled):
            return
        if category == 'integration' and not bool(settings.logs_capture_integrations):
            return
        if category == 'webhook' and not bool(settings.logs_capture_webhooks):
            return
        if not should_log(level, str(settings.logs_min_level or 'info').lower()):
            return
        create_system_log(
            db,
            level=level,
            category=category,
            action_name=action_name,
            request_method=request_method.upper() if request_method else None,
            request_path=request_path,
            request_query=request_query,
            request_headers_json=request_headers or {},
            request_body_json=request_body,
            response_status=response_status,
            response_headers_json=response_headers or {},
            response_body_json=response_body,
            duration_ms=duration_ms,
            response_size_bytes=response_size_bytes,
            admin_user_id=admin_user_id,
            session_id=session_id,
            ip_address=ip_address,
            user_agent=user_agent,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            source_system=source_system,
            error_message=error_message,
            stack_trace=stack_trace,
            metadata_json=metadata or {},
        )
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()


def list_system_logs(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    level: str | None = None,
    category: str | None = None,
    path: str | None = None,
    admin_user_id: int | None = None,
    status_code: int | None = None,
    source_system: str | None = None,
    text: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> tuple[list[SystemLog], int]:
    query = db.query(SystemLog)
    if level:
        query = query.filter(SystemLog.level == level)
    if category:
        query = query.filter(SystemLog.category == category)
    if path:
        query = query.filter(SystemLog.request_path.ilike(f'%{path}%'))
    if admin_user_id:
        query = query.filter(SystemLog.admin_user_id == admin_user_id)
    if status_code is not None:
        query = query.filter(SystemLog.response_status == status_code)
    if source_system:
        query = query.filter(SystemLog.source_system == source_system)
    if date_from:
        query = query.filter(SystemLog.created_at >= date_from)
    if date_to:
        query = query.filter(SystemLog.created_at <= date_to)
    if text:
        pattern = f'%{text}%'
        query = query.filter(
            or_(
                SystemLog.action_name.ilike(pattern),
                SystemLog.request_path.ilike(pattern),
                SystemLog.error_message.ilike(pattern),
                SystemLog.metadata_json.ilike(pattern),
            )
        )
    total = int(query.count())
    items = query.order_by(SystemLog.created_at.desc(), SystemLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_system_log_by_id(db: Session, log_id: int) -> SystemLog | None:
    return db.query(SystemLog).filter(SystemLog.id == log_id).first()


def _read_request_body(request) -> tuple[bytes, Any]:
    try:
        content_type = str(request.headers.get('content-type') or '').lower()
        if 'multipart/form-data' in content_type:
            return b'', '[BINARY_OR_MULTIPART]'
        body = b''
        try:
            body = request.scope.get('_cached_body') or b''
        except Exception:  # noqa: BLE001
            body = b''
        if not body:
            body = b''
        if not body:
            return b'', None
        decoded = body.decode('utf-8', errors='ignore')
        try:
            return body, json.loads(decoded)
        except Exception:  # noqa: BLE001
            return body, _truncate(decoded)
    except Exception:  # noqa: BLE001
        return b'', None


def build_exception_stack() -> str:
    return ''.join(traceback.format_exc())


def now_ms() -> float:
    return time.perf_counter() * 1000
