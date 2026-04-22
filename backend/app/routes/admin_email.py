import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_db, require_admin
from app.models import AdminUser
from app.schemas import (
    EmailLogListResponse,
    EmailLogResponse,
    EmailProviderConfigResponse,
    EmailProviderConfigUpdate,
    EmailSendTestRequest,
    EmailSendTestResponse,
    EmailTemplatePreviewRequest,
    EmailTemplatePreviewResponse,
    EmailTemplateResponse,
    EmailTemplateUpdateRequest,
)
from app.services.email_service import (
    get_email_log_by_id,
    get_email_template_by_key,
    get_or_create_email_provider_config,
    list_email_logs,
    list_email_templates,
    preview_email_template,
    send_test_email,
    serialize_email_log,
    serialize_email_provider_config,
    serialize_email_template,
    update_email_provider_config,
    update_email_template,
)
from app.services.system_log_service import log_business_event

router = APIRouter(prefix='/admin/email', tags=['admin-email'])


def _serialize_log(item) -> EmailLogResponse:
    data = serialize_email_log(item)
    return EmailLogResponse(**data)


@router.get('/config', response_model=EmailProviderConfigResponse)
def read_email_config(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    config = get_or_create_email_provider_config(db)
    return EmailProviderConfigResponse(**serialize_email_provider_config(config))


@router.put('/config', response_model=EmailProviderConfigResponse)
def save_email_config(
    payload: EmailProviderConfigUpdate,
    admin: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    config = update_email_provider_config(
        db,
        provider_name=payload.provider_name,
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        smtp_username=payload.smtp_username,
        smtp_password=payload.smtp_password,
        smtp_use_tls=payload.smtp_use_tls,
        smtp_use_ssl=payload.smtp_use_ssl,
        from_name=payload.from_name,
        from_email=payload.from_email,
        reply_to_email=payload.reply_to_email,
        is_enabled=payload.is_enabled,
    )
    log_business_event(
        db,
        action_name='Admin updated email provider config',
        admin_user_id=admin.id,
        entity_type='email_provider_config',
        entity_id=config.id,
        metadata={
            'provider_name': config.provider_name,
            'smtp_host': config.smtp_host,
            'smtp_port': config.smtp_port,
            'smtp_username': config.smtp_username,
            'smtp_use_tls': bool(config.smtp_use_tls),
            'smtp_use_ssl': bool(config.smtp_use_ssl),
            'from_email': config.from_email,
            'is_enabled': bool(config.is_enabled),
        },
    )
    return EmailProviderConfigResponse(**serialize_email_provider_config(config))


@router.post('/test-send', response_model=EmailSendTestResponse)
def test_email_send(
    payload: EmailSendTestRequest,
    admin: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    result = send_test_email(db, payload.recipient_email)
    log_business_event(
        db,
        action_name='Admin test email send',
        admin_user_id=admin.id,
        entity_type='email_provider_config',
        entity_id=1,
        metadata={
            'recipient_email': payload.recipient_email,
            'ok': bool(result.get('ok')),
        },
        error_message=None if result.get('ok') else result.get('message'),
        level='info' if result.get('ok') else 'warning',
    )
    return EmailSendTestResponse(ok=bool(result.get('ok')), message=str(result.get('message') or ''))


@router.get('/templates', response_model=list[EmailTemplateResponse])
def read_email_templates(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    rows = list_email_templates(db)
    return [EmailTemplateResponse(**serialize_email_template(item)) for item in rows]


@router.put('/templates/{template_key}', response_model=EmailTemplateResponse)
def save_email_template(
    template_key: str,
    payload: EmailTemplateUpdateRequest,
    admin: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    template = update_email_template(
        db,
        template_key=template_key,
        name=payload.name,
        subject_template=payload.subject_template,
        body_html_template=payload.body_html_template,
        body_text_template=payload.body_text_template,
        variables=payload.variables,
        is_active=payload.is_active,
    )
    log_business_event(
        db,
        action_name='Admin updated email template',
        admin_user_id=admin.id,
        entity_type='email_template',
        entity_id=template.key,
        metadata={
            'template_key': template.key,
            'name': template.name,
            'is_active': bool(template.is_active),
            'variables': payload.variables,
        },
    )
    return EmailTemplateResponse(**serialize_email_template(template))


@router.post('/templates/{template_key}/preview', response_model=EmailTemplatePreviewResponse)
def preview_template(
    template_key: str,
    payload: EmailTemplatePreviewRequest,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    template = get_email_template_by_key(db, template_key)
    if not template:
        raise HTTPException(status_code=404, detail='Template nao encontrado')
    result = preview_email_template(template, payload.variables or {})
    return EmailTemplatePreviewResponse(**result)


@router.get('/logs', response_model=EmailLogListResponse)
def read_email_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    status: str | None = Query(default=None),
    template_key: str | None = Query(default=None),
    text: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows, total = list_email_logs(
        db,
        page=page,
        page_size=page_size,
        status=(str(status or '').strip().lower() or None),
        template_key=(str(template_key or '').strip().lower() or None),
        text=(str(text or '').strip() or None),
    )
    return EmailLogListResponse(
        items=[_serialize_log(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get('/logs/{log_id}', response_model=EmailLogResponse)
def read_email_log_detail(log_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    row = get_email_log_by_id(db, log_id)
    if not row:
        raise HTTPException(status_code=404, detail='Log de e-mail nao encontrado')
    return _serialize_log(row)
