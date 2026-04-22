from __future__ import annotations

import json
import re
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from sqlalchemy.orm import Session

from app.models import EmailLog, EmailProviderConfig, EmailTemplate, Order
from app.services.system_log_service import log_custom_event_safely

TOKEN_PATTERN = re.compile(r'\{\{\s*([a-zA-Z0-9_]+)\s*\}\}')


def _safe_json_load(value: str | None, fallback: Any):
    if not value:
        return fallback
    try:
        data = json.loads(value)
        return data
    except Exception:  # noqa: BLE001
        return fallback


def _safe_json_dump(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:  # noqa: BLE001
        return json.dumps({}, ensure_ascii=False)


def _normalize_email(value: str | None) -> str | None:
    normalized = str(value or '').strip().lower()
    return normalized or None


def _first_name(full_name: str | None) -> str:
    value = str(full_name or '').strip()
    if not value:
        return 'cliente'
    return value.split(' ')[0]


def _extract_tokens(text: str | None) -> list[str]:
    if not text:
        return []
    return sorted(set(TOKEN_PATTERN.findall(str(text))))


def _render_template_text(text: str | None, variables: dict[str, Any]) -> tuple[str, list[str]]:
    source = str(text or '')
    missing: list[str] = []

    def _replace(match):
        key = str(match.group(1) or '').strip()
        if key in variables and variables[key] is not None:
            return str(variables[key])
        missing.append(key)
        return ''

    rendered = TOKEN_PATTERN.sub(_replace, source)
    return rendered, sorted(set(missing))


def _html_to_text(value: str | None) -> str:
    html = str(value or '')
    if not html:
        return ''
    text = re.sub(r'<\s*br\s*/?>', '\n', html, flags=re.IGNORECASE)
    text = re.sub(r'</p\s*>', '\n\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


def get_or_create_email_provider_config(db: Session) -> EmailProviderConfig:
    config = db.query(EmailProviderConfig).first()
    if config:
        return config
    config = EmailProviderConfig(
        id=1,
        provider_name='smtp',
        smtp_port=587,
        smtp_use_tls=True,
        smtp_use_ssl=False,
        is_enabled=False,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def serialize_email_provider_config(config: EmailProviderConfig) -> dict:
    return {
        'id': config.id,
        'provider_name': config.provider_name,
        'smtp_host': config.smtp_host,
        'smtp_port': int(config.smtp_port or 587),
        'smtp_username': config.smtp_username,
        'has_smtp_password': bool(str(config.smtp_password or '').strip()),
        'smtp_use_tls': bool(config.smtp_use_tls),
        'smtp_use_ssl': bool(config.smtp_use_ssl),
        'from_name': config.from_name,
        'from_email': config.from_email,
        'reply_to_email': config.reply_to_email,
        'is_enabled': bool(config.is_enabled),
        'created_at': config.created_at,
        'updated_at': config.updated_at,
    }


def update_email_provider_config(
    db: Session,
    *,
    provider_name: str,
    smtp_host: str | None,
    smtp_port: int,
    smtp_username: str | None,
    smtp_password: str | None,
    smtp_use_tls: bool,
    smtp_use_ssl: bool,
    from_name: str | None,
    from_email: str | None,
    reply_to_email: str | None,
    is_enabled: bool,
) -> EmailProviderConfig:
    config = get_or_create_email_provider_config(db)
    config.provider_name = str(provider_name or 'smtp').strip().lower() or 'smtp'
    config.smtp_host = str(smtp_host or '').strip() or None
    config.smtp_port = int(smtp_port or 587)
    config.smtp_username = str(smtp_username or '').strip() or None
    if smtp_password is not None and str(smtp_password).strip():
        config.smtp_password = str(smtp_password)
    config.smtp_use_tls = bool(smtp_use_tls)
    config.smtp_use_ssl = bool(smtp_use_ssl)
    config.from_name = str(from_name or '').strip() or None
    config.from_email = _normalize_email(from_email)
    config.reply_to_email = _normalize_email(reply_to_email)
    config.is_enabled = bool(is_enabled)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def list_email_templates(db: Session) -> list[EmailTemplate]:
    return db.query(EmailTemplate).order_by(EmailTemplate.key.asc()).all()


def get_email_template_by_key(db: Session, template_key: str) -> EmailTemplate | None:
    key = str(template_key or '').strip().lower()
    if not key:
        return None
    return db.query(EmailTemplate).filter(EmailTemplate.key == key).first()


def serialize_email_template(template: EmailTemplate) -> dict:
    return {
        'id': template.id,
        'key': template.key,
        'name': template.name,
        'subject_template': template.subject_template,
        'body_html_template': template.body_html_template,
        'body_text_template': template.body_text_template,
        'variables': _safe_json_load(template.variables_json, []) if template.variables_json else [],
        'is_active': bool(template.is_active),
        'created_at': template.created_at,
        'updated_at': template.updated_at,
    }


def update_email_template(
    db: Session,
    *,
    template_key: str,
    name: str,
    subject_template: str,
    body_html_template: str,
    body_text_template: str | None,
    variables: list[str] | None,
    is_active: bool,
) -> EmailTemplate:
    key = str(template_key or '').strip().lower()
    template = get_email_template_by_key(db, key)
    if not template:
        template = EmailTemplate(key=key, name=name, subject_template=subject_template, body_html_template=body_html_template)
    template.name = str(name or '').strip()
    template.subject_template = str(subject_template or '').strip()
    template.body_html_template = str(body_html_template or '').strip()
    template.body_text_template = str(body_text_template or '').strip() or None
    sanitized_variables = [str(item or '').strip() for item in (variables or []) if str(item or '').strip()]
    template.variables_json = _safe_json_dump(sorted(set(sanitized_variables)))
    template.is_active = bool(is_active)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def preview_email_template(template: EmailTemplate, variables: dict[str, Any] | None) -> dict:
    normalized_variables = dict(variables or {})
    subject_rendered, subject_missing = _render_template_text(template.subject_template, normalized_variables)
    body_html_rendered, body_html_missing = _render_template_text(template.body_html_template, normalized_variables)
    body_text_source = template.body_text_template or _html_to_text(template.body_html_template)
    body_text_rendered, body_text_missing = _render_template_text(body_text_source, normalized_variables)
    missing = sorted(set(subject_missing + body_html_missing + body_text_missing))
    return {
        'template_key': template.key,
        'subject_rendered': subject_rendered,
        'body_html_rendered': body_html_rendered,
        'body_text_rendered': body_text_rendered,
        'missing_variables': missing,
    }


def _create_email_log(
    db: Session,
    *,
    template_key: str | None,
    recipient_email: str,
    subject_rendered: str,
    body_preview: str,
    status: str,
    related_entity_type: str | None,
    related_entity_id: str | int | None,
    error_message: str | None,
    metadata: dict | None,
    sent_at: datetime | None = None,
) -> EmailLog:
    row = EmailLog(
        template_key=template_key,
        recipient_email=recipient_email,
        subject_rendered=subject_rendered,
        body_rendered_preview=body_preview[:8000] if body_preview else None,
        status=status,
        error_message=error_message,
        related_entity_type=related_entity_type,
        related_entity_id=str(related_entity_id) if related_entity_id is not None else None,
        metadata_json=_safe_json_dump(metadata or {}),
        sent_at=sent_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def serialize_email_log(row: EmailLog) -> dict:
    return {
        'id': row.id,
        'template_key': row.template_key,
        'recipient_email': row.recipient_email,
        'subject_rendered': row.subject_rendered,
        'body_rendered_preview': row.body_rendered_preview,
        'status': row.status,
        'error_message': row.error_message,
        'related_entity_type': row.related_entity_type,
        'related_entity_id': row.related_entity_id,
        'metadata_json': _safe_json_load(row.metadata_json, {}),
        'created_at': row.created_at,
        'sent_at': row.sent_at,
    }


def list_email_logs(db: Session, *, page: int, page_size: int, status: str | None = None, template_key: str | None = None, text: str | None = None):
    query = db.query(EmailLog)
    if status:
        query = query.filter(EmailLog.status == str(status).strip().lower())
    if template_key:
        query = query.filter(EmailLog.template_key == str(template_key).strip().lower())
    if text:
        pattern = f"%{text}%"
        query = query.filter(
            (EmailLog.recipient_email.ilike(pattern))
            | (EmailLog.subject_rendered.ilike(pattern))
            | (EmailLog.error_message.ilike(pattern))
        )
    total = int(query.count())
    rows = query.order_by(EmailLog.created_at.desc(), EmailLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return rows, total


def get_email_log_by_id(db: Session, log_id: int) -> EmailLog | None:
    return db.query(EmailLog).filter(EmailLog.id == log_id).first()


def _ensure_ready_config(config: EmailProviderConfig):
    if not bool(config.is_enabled):
        raise RuntimeError('Envio de e-mail desabilitado no admin.')
    if config.provider_name != 'smtp':
        raise RuntimeError('Apenas provider SMTP esta disponivel nesta versao.')
    if not str(config.smtp_host or '').strip():
        raise RuntimeError('SMTP host nao configurado.')
    if not int(config.smtp_port or 0):
        raise RuntimeError('SMTP port nao configurada.')
    if not str(config.from_email or '').strip():
        raise RuntimeError('E-mail remetente (from_email) nao configurado.')


def _send_email_via_smtp(
    *,
    config: EmailProviderConfig,
    recipient_email: str,
    subject: str,
    body_html: str,
    body_text: str,
):
    message = MIMEMultipart('alternative')
    message['Subject'] = subject
    message['From'] = str(config.from_email or '').strip()
    message['To'] = recipient_email
    if str(config.reply_to_email or '').strip():
        message['Reply-To'] = str(config.reply_to_email or '').strip()

    message.attach(MIMEText(body_text or _html_to_text(body_html), 'plain', 'utf-8'))
    message.attach(MIMEText(body_html or '', 'html', 'utf-8'))

    host = str(config.smtp_host or '').strip()
    port = int(config.smtp_port or 587)
    username = str(config.smtp_username or '').strip() or None
    password = str(config.smtp_password or '')

    if bool(config.smtp_use_ssl):
        with smtplib.SMTP_SSL(host=host, port=port, timeout=20) as server:
            if username:
                server.login(username, password)
            server.send_message(message)
        return

    with smtplib.SMTP(host=host, port=port, timeout=20) as server:
        if bool(config.smtp_use_tls):
            server.starttls()
        if username:
            server.login(username, password)
        server.send_message(message)


def send_templated_email(
    db: Session,
    *,
    template_key: str,
    recipient_email: str,
    variables: dict[str, Any] | None = None,
    related_entity_type: str | None = None,
    related_entity_id: str | int | None = None,
    metadata: dict | None = None,
) -> dict:
    normalized_recipient = _normalize_email(recipient_email)
    if not normalized_recipient:
        return {'ok': False, 'message': 'Destinatario invalido'}

    template = get_email_template_by_key(db, template_key)
    if not template or not bool(template.is_active):
        return {'ok': False, 'message': f'Template {template_key} indisponivel'}

    preview = preview_email_template(template, variables or {})
    config = get_or_create_email_provider_config(db)

    try:
        _ensure_ready_config(config)
        _send_email_via_smtp(
            config=config,
            recipient_email=normalized_recipient,
            subject=preview['subject_rendered'],
            body_html=preview['body_html_rendered'],
            body_text=preview['body_text_rendered'],
        )
        _create_email_log(
            db,
            template_key=template.key,
            recipient_email=normalized_recipient,
            subject_rendered=preview['subject_rendered'],
            body_preview=preview['body_text_rendered'] or preview['body_html_rendered'],
            status='sent',
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            error_message=None,
            metadata={
                **(metadata or {}),
                'missing_variables': preview.get('missing_variables', []),
            },
            sent_at=datetime.utcnow(),
        )
        log_custom_event_safely(
            level='info',
            category='integration',
            action_name='Email sent',
            source_system='smtp',
            entity_type=related_entity_type,
            entity_id=related_entity_id,
            metadata={'template_key': template.key, 'recipient_email': normalized_recipient},
        )
        return {'ok': True, 'message': 'Email enviado com sucesso'}
    except Exception as exc:  # noqa: BLE001
        _create_email_log(
            db,
            template_key=template.key,
            recipient_email=normalized_recipient,
            subject_rendered=preview['subject_rendered'],
            body_preview=preview['body_text_rendered'] or preview['body_html_rendered'],
            status='failed',
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            error_message=str(exc),
            metadata={
                **(metadata or {}),
                'missing_variables': preview.get('missing_variables', []),
            },
            sent_at=None,
        )
        log_custom_event_safely(
            level='error',
            category='integration',
            action_name='Email send failed',
            source_system='smtp',
            entity_type=related_entity_type,
            entity_id=related_entity_id,
            error_message=str(exc),
            metadata={'template_key': template.key, 'recipient_email': normalized_recipient},
        )
        return {'ok': False, 'message': str(exc)}


def send_test_email(db: Session, recipient_email: str) -> dict:
    return send_templated_email(
        db,
        template_key='account_created',
        recipient_email=recipient_email,
        variables={
            'nome': 'Cliente Teste',
            'primeiro_nome': 'Cliente',
            'login_email': _normalize_email(recipient_email) or '',
            'account_link': '/minha-conta',
        },
        related_entity_type='email_config',
        related_entity_id=1,
        metadata={'kind': 'test_send'},
    )


def _payment_method_ptbr(value: str | None) -> str:
    key = str(value or '').strip().lower()
    if key == 'pix':
        return 'Pix'
    if key == 'credit_card':
        return 'Cartao'
    if key == 'whatsapp':
        return 'WhatsApp'
    return key or '-'


def _payment_status_ptbr(value: str | None) -> str:
    key = str(value or '').strip().lower()
    mapping = {
        'pending': 'Pendente',
        'pending_payment': 'Aguardando pagamento',
        'awaiting_confirmation': 'Aguardando confirmacao',
        'paid': 'Pago',
        'failed': 'Falhou',
        'canceled': 'Cancelado',
    }
    return mapping.get(key, key or '-')


def build_order_items_summary(order: Order) -> str:
    lines: list[str] = []
    for item in order.items or []:
        lines.append(f"{int(item.quantity or 0)}x {item.title} - R$ {float(item.line_total or 0):.2f}")
    return '\n'.join(lines)


def send_password_reset_email(
    db: Session,
    *,
    recipient_email: str,
    full_name: str | None,
    reset_link: str,
    token_expiration: str,
    customer_account_id: int | None,
):
    return send_templated_email(
        db,
        template_key='password_reset',
        recipient_email=recipient_email,
        variables={
            'nome': str(full_name or '').strip() or 'Cliente',
            'primeiro_nome': _first_name(full_name),
            'email': recipient_email,
            'reset_link': reset_link,
            'token_expiration': token_expiration,
        },
        related_entity_type='customer_account',
        related_entity_id=customer_account_id,
        metadata={'purpose': 'password_reset'},
    )


def send_account_created_email(
    db: Session,
    *,
    recipient_email: str,
    full_name: str,
    account_link: str,
    customer_account_id: int,
):
    return send_templated_email(
        db,
        template_key='account_created',
        recipient_email=recipient_email,
        variables={
            'nome': full_name,
            'primeiro_nome': _first_name(full_name),
            'login_email': recipient_email,
            'account_link': account_link,
        },
        related_entity_type='customer_account',
        related_entity_id=customer_account_id,
        metadata={'purpose': 'account_created'},
    )


def send_order_success_email(db: Session, order: Order, account_link: str = '/minha-conta'):
    recipient = _normalize_email(order.customer_email_snapshot)
    if not recipient:
        return {'ok': False, 'message': 'Pedido sem e-mail para envio'}
    return send_templated_email(
        db,
        template_key='order_success',
        recipient_email=recipient,
        variables={
            'nome': str(order.customer_name or '').strip() or 'Cliente',
            'primeiro_nome': _first_name(order.customer_name),
            'order_id': order.id,
            'order_date': (order.created_at.strftime('%d/%m/%Y %H:%M') if order.created_at else '-'),
            'order_total': f"R$ {float(order.total or 0):.2f}",
            'payment_method': _payment_method_ptbr(order.payment_method),
            'payment_status': _payment_status_ptbr(order.payment_status),
            'items_summary': build_order_items_summary(order),
            'account_link': account_link,
            'receipt_url': str(order.receipt_url or ''),
        },
        related_entity_type='order',
        related_entity_id=order.id,
        metadata={'purpose': 'order_success'},
    )


def send_order_paid_email(db: Session, order: Order, account_link: str = '/minha-conta'):
    recipient = _normalize_email(order.customer_email_snapshot)
    if not recipient:
        return {'ok': False, 'message': 'Pedido sem e-mail para envio'}
    return send_templated_email(
        db,
        template_key='order_paid',
        recipient_email=recipient,
        variables={
            'order_id': order.id,
            'order_total': f"R$ {float(order.paid_amount if order.paid_amount is not None else order.total or 0):.2f}",
            'payment_method': _payment_method_ptbr(order.payment_method),
            'payment_status': _payment_status_ptbr(order.payment_status),
            'receipt_url': str(order.receipt_url or ''),
            'account_link': account_link,
        },
        related_entity_type='order',
        related_entity_id=order.id,
        metadata={'purpose': 'order_paid'},
    )
