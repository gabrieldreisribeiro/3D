import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_db, require_admin
from app.models import AdminUser, SystemLog
from app.schemas import LogSettingsResponse, LogSettingsUpdate, SystemLogResponse, SystemLogsListResponse
from app.services.system_log_service import get_logging_settings, list_system_logs, log_business_event

router = APIRouter(prefix='/admin/logs', tags=['admin-logs'])


def _safe_parse_json(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def _serialize_log(item) -> SystemLogResponse:
    return SystemLogResponse(
        id=item.id,
        level=item.level,
        category=item.category,
        action_name=item.action_name,
        request_method=item.request_method,
        request_path=item.request_path,
        request_query=item.request_query,
        request_headers_json=_safe_parse_json(item.request_headers_json),
        request_body_json=item.request_body_json,
        response_status=item.response_status,
        response_headers_json=_safe_parse_json(item.response_headers_json),
        response_body_json=item.response_body_json,
        duration_ms=item.duration_ms,
        response_size_bytes=item.response_size_bytes,
        admin_user_id=item.admin_user_id,
        admin_email=item.admin.email if getattr(item, 'admin', None) else None,
        session_id=item.session_id,
        ip_address=item.ip_address,
        user_agent=item.user_agent,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        source_system=item.source_system,
        error_message=item.error_message,
        stack_trace=item.stack_trace,
        metadata_json=_safe_parse_json(item.metadata_json),
        created_at=item.created_at,
    )


@router.get('/settings', response_model=LogSettingsResponse)
def read_log_settings(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    settings = get_logging_settings(db)
    return LogSettingsResponse(
        logs_enabled=bool(settings.logs_enabled),
        logs_capture_request_body=bool(settings.logs_capture_request_body),
        logs_capture_response_body=bool(settings.logs_capture_response_body),
        logs_capture_integrations=bool(settings.logs_capture_integrations),
        logs_capture_webhooks=bool(settings.logs_capture_webhooks),
        logs_min_level=str(settings.logs_min_level or 'info').lower(),
    )


@router.post('/settings', response_model=LogSettingsResponse)
def save_log_settings(
    payload: LogSettingsUpdate,
    current_admin: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = get_logging_settings(db)
    settings.logs_enabled = bool(payload.logs_enabled)
    settings.logs_capture_request_body = bool(payload.logs_capture_request_body)
    settings.logs_capture_response_body = bool(payload.logs_capture_response_body)
    settings.logs_capture_integrations = bool(payload.logs_capture_integrations)
    settings.logs_capture_webhooks = bool(payload.logs_capture_webhooks)
    settings.logs_min_level = str(payload.logs_min_level or 'info').strip().lower()
    db.add(settings)
    db.commit()
    db.refresh(settings)
    log_business_event(
        db,
        action_name='Admin updated log settings',
        admin_user_id=current_admin.id,
        entity_type='store_settings',
        entity_id=settings.id,
        metadata=payload.model_dump(mode='json'),
    )
    return LogSettingsResponse(
        logs_enabled=bool(settings.logs_enabled),
        logs_capture_request_body=bool(settings.logs_capture_request_body),
        logs_capture_response_body=bool(settings.logs_capture_response_body),
        logs_capture_integrations=bool(settings.logs_capture_integrations),
        logs_capture_webhooks=bool(settings.logs_capture_webhooks),
        logs_min_level=str(settings.logs_min_level or 'info').lower(),
    )


@router.get('', response_model=SystemLogsListResponse)
def get_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    level: str | None = Query(default=None),
    category: str | None = Query(default=None),
    path: str | None = Query(default=None),
    admin_user_id: int | None = Query(default=None, ge=1),
    status_code: int | None = Query(default=None, ge=100, le=599),
    source_system: str | None = Query(default=None),
    text: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items, total = list_system_logs(
        db,
        page=page,
        page_size=page_size,
        level=(str(level or '').strip().lower() or None),
        category=(str(category or '').strip().lower() or None),
        path=path,
        admin_user_id=admin_user_id,
        status_code=status_code,
        source_system=(str(source_system or '').strip().lower() or None),
        text=text,
        date_from=date_from,
        date_to=date_to,
    )
    return SystemLogsListResponse(
        items=[_serialize_log(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get('/{log_id}', response_model=SystemLogResponse)
def get_log_detail(log_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    target_item = db.query(SystemLog).filter(SystemLog.id == log_id).first()
    if not target_item:
        raise HTTPException(status_code=404, detail='Log nao encontrado')
    return _serialize_log(target_item)
