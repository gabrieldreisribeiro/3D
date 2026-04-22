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

router = APIRouter(tags=['webhooks'])
logger = logging.getLogger('infinitepay')


@router.post('/webhooks/infinitepay')
async def infinitepay_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    logger.info('InfinitePay webhook received payload=%s', payload)
    order_nsu = str(payload.get('order_nsu') or '').strip()
    if not order_nsu:
        logger.warning('InfinitePay webhook missing order_nsu')
        return {'success': False, 'message': 'order_nsu ausente'}

    order = db.query(Order).filter(Order.order_nsu == order_nsu).first()
    if not order:
        logger.warning('InfinitePay webhook order not found order_nsu=%s', order_nsu)
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
        amount_value = float(amount)
        if order.paid_amount is None and amount_value > 0:
            order.paid_amount = amount_value / 100.0 if amount_value > 100 else amount_value
    if paid_amount is not None:
        paid_amount_value = float(paid_amount)
        order.paid_amount = paid_amount_value / 100.0 if paid_amount_value > 100 else paid_amount_value
    if installments is not None:
        order.installments = int(installments or 1)
    if status == 'paid' and not order.paid_at:
        order.paid_at = datetime.utcnow()
    order.payment_metadata_json = build_payment_metadata(order.payment_metadata_json, event='webhook', payload=payload)
    db.add(order)
    db.commit()

    return {'success': True, 'message': None}
