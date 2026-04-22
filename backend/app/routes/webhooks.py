import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.security import get_db
from app.models import Order
from app.services.infinitepay_service import (
    build_payment_metadata,
    infer_payment_method,
    infer_payment_status_from_payload,
)
from app.services.email_service import send_order_paid_email
from app.services.order_flow_service import sync_order_stage_from_business_status
from app.services.production_service import ensure_order_production_estimate, set_order_production_status
from app.services.system_log_service import log_custom_event_safely

router = APIRouter(tags=['webhooks'])
logger = logging.getLogger('infinitepay')


def _to_brl_amount(value):
    if value is None:
        return None
    try:
        normalized = str(value).strip().replace(',', '.')
        number = float(normalized)
    except Exception:  # noqa: BLE001
        return None
    if float(number).is_integer():
        return float(number) / 100.0
    return float(number)


@router.post('/webhooks/infinitepay')
async def infinitepay_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    logger.info('InfinitePay webhook received payload=%s', payload)
    log_custom_event_safely(
        level='info',
        category='webhook',
        action_name='InfinitePay webhook received',
        request_method='POST',
        request_path='/webhooks/infinitepay',
        request_headers=dict(request.headers.items()),
        request_body=payload,
        source_system='infinitepay',
        metadata={'integration': 'infinitepay'},
    )
    order_nsu = str(payload.get('order_nsu') or '').strip()
    if not order_nsu:
        logger.warning('InfinitePay webhook missing order_nsu')
        log_custom_event_safely(
            level='warning',
            category='webhook',
            action_name='InfinitePay webhook invalid payload',
            request_method='POST',
            request_path='/webhooks/infinitepay',
            request_body=payload,
            response_status=400,
            source_system='infinitepay',
            error_message='order_nsu ausente',
            metadata={'integration': 'infinitepay'},
        )
        return {'success': False, 'message': 'order_nsu ausente'}

    order = db.query(Order).filter(Order.order_nsu == order_nsu).first()
    if not order:
        logger.warning('InfinitePay webhook order not found order_nsu=%s', order_nsu)
        log_custom_event_safely(
            level='warning',
            category='webhook',
            action_name='InfinitePay webhook order not found',
            request_method='POST',
            request_path='/webhooks/infinitepay',
            request_body=payload,
            response_status=404,
            source_system='infinitepay',
            entity_type='order',
            entity_id=order_nsu,
            error_message='pedido nao encontrado',
            metadata={'integration': 'infinitepay'},
        )
        return {'success': False, 'message': 'pedido nao encontrado'}

    transaction_nsu = str(payload.get('transaction_nsu') or '').strip() or None
    invoice_slug = str(payload.get('invoice_slug') or payload.get('slug') or '').strip() or None
    receipt_url = str(payload.get('receipt_url') or '').strip() or None
    capture_method = str(payload.get('capture_method') or '').strip().lower() or None
    amount = payload.get('amount')
    paid_amount = payload.get('paid_amount')
    installments = payload.get('installments')

    if transaction_nsu and order.transaction_nsu and str(order.transaction_nsu) == transaction_nsu:
        logger.info('InfinitePay webhook duplicated transaction order_id=%s transaction_nsu=%s', order.id, transaction_nsu)
    previous_payment_status = str(order.payment_status or '').strip().lower()
    order.invoice_slug = invoice_slug or order.invoice_slug
    order.transaction_nsu = transaction_nsu or order.transaction_nsu
    order.receipt_url = receipt_url or order.receipt_url
    order.capture_method = capture_method or order.capture_method
    order.payment_provider = 'infinitepay'
    order.sales_channel = 'online_checkout'
    method = infer_payment_method(capture_method, order.payment_method)
    if method:
        order.payment_method = method
    status = infer_payment_status_from_payload(payload)
    order.payment_status = status
    if amount is not None:
        amount_value = _to_brl_amount(amount)
        if order.paid_amount is None and amount_value > 0:
            order.paid_amount = amount_value
    if paid_amount is not None:
        paid_amount_value = _to_brl_amount(paid_amount)
        order.paid_amount = paid_amount_value
    if installments is not None:
        order.installments = int(installments or 1)
    if status == 'paid' and not order.paid_at:
        order.paid_at = datetime.utcnow()
    if status == 'paid':
        set_order_production_status(order, 'paid')
        ensure_order_production_estimate(order)
        sync_order_stage_from_business_status(db, order, note='auto_on_payment_paid_webhook')
    order.payment_metadata_json = build_payment_metadata(order.payment_metadata_json, event='webhook', payload=payload)
    db.add(order)
    db.commit()
    if status == 'paid' and previous_payment_status != 'paid':
        try:
            send_order_paid_email(db, order)
        except Exception:
            pass
    log_custom_event_safely(
        level='info',
        category='webhook',
        action_name='InfinitePay webhook processed',
        request_method='POST',
        request_path='/webhooks/infinitepay',
        request_body=payload,
        response_status=200,
        source_system='infinitepay',
        entity_type='order',
        entity_id=order.id,
        metadata={'integration': 'infinitepay', 'payment_status': order.payment_status, 'payment_method': order.payment_method},
    )

    return {'success': True, 'message': None}
