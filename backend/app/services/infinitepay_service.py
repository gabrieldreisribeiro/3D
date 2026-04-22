import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.models import Order, PaymentProviderInfinitePayConfig
from app.services.system_log_service import log_custom_event_safely

logger = logging.getLogger('infinitepay')

INFINITEPAY_CHECKOUT_URL = 'https://api.infinitepay.io/invoices/public/checkout/links'
INFINITEPAY_PAYMENT_CHECK_URL = 'https://api.infinitepay.io/invoices/public/checkout/payment_check'
INFINITEPAY_HTTP_USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/125.0.0.0 Safari/537.36'
)


@dataclass
class InfinitePayCheckoutResult:
    checkout_url: str
    raw_response: dict[str, Any]


class InfinitePayValidationError(RuntimeError):
    pass


def _normalize_text(value: str | None) -> str | None:
    normalized = str(value or '').strip()
    return normalized or None


def _to_cents(value: float | int | None) -> int:
    return int(round(float(value or 0.0) * 100))


def _extract_infinitepay_error_message(details: str) -> str:
    text = str(details or '').strip()
    if not text:
        return ''
    try:
        parsed = json.loads(text)
    except Exception:  # noqa: BLE001
        return text[:300]

    if not isinstance(parsed, dict):
        return text[:300]

    base_message = str(parsed.get('message') or '').strip()
    errors = parsed.get('errors')
    if isinstance(errors, dict):
        chunks = []
        for key, value in errors.items():
            if isinstance(value, list):
                joined = ', '.join([str(item).strip() for item in value if str(item).strip()])
                if joined:
                    chunks.append(f'{key}: {joined}')
            elif str(value or '').strip():
                chunks.append(f'{key}: {str(value).strip()}')
        if chunks:
            return f"{base_message} ({' | '.join(chunks)})".strip()
    return base_message or text[:300]


def _safe_json_dict(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except Exception:  # noqa: BLE001
            return {}
    return {}


def get_or_create_infinitepay_config(db: Session) -> PaymentProviderInfinitePayConfig:
    config = db.query(PaymentProviderInfinitePayConfig).first()
    if config:
        return config
    config = PaymentProviderInfinitePayConfig(
        id=1,
        is_enabled=False,
        handle=None,
        redirect_url=None,
        webhook_url=None,
        default_currency='BRL',
        success_page_url=None,
        cancel_page_url=None,
        test_mode=False,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def update_infinitepay_config(
    db: Session,
    *,
    is_enabled: bool,
    handle: str | None,
    redirect_url: str | None,
    webhook_url: str | None,
    default_currency: str | None,
    success_page_url: str | None,
    cancel_page_url: str | None,
    test_mode: bool,
) -> PaymentProviderInfinitePayConfig:
    config = get_or_create_infinitepay_config(db)
    config.is_enabled = bool(is_enabled)
    config.handle = _normalize_text(handle)
    config.redirect_url = _normalize_text(redirect_url)
    config.webhook_url = _normalize_text(webhook_url)
    config.default_currency = (_normalize_text(default_currency) or 'BRL').upper()
    config.success_page_url = _normalize_text(success_page_url)
    config.cancel_page_url = _normalize_text(cancel_page_url)
    config.test_mode = bool(test_mode)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def config_is_ready(config: PaymentProviderInfinitePayConfig | None) -> tuple[bool, str]:
    if not config:
        return False, 'Configuracao da InfinitePay nao encontrada'
    if not bool(config.is_enabled):
        return False, 'Integracao InfinitePay desativada'
    if not _normalize_text(config.handle):
        return False, 'Handle da InfinitePay nao configurada'
    return True, ''


def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    started_at = time.perf_counter()
    body = json.dumps(payload).encode('utf-8')
    request = Request(
        url=url,
        data=body,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': INFINITEPAY_HTTP_USER_AGENT,
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://luma3.com.br',
            'Referer': 'https://luma3.com.br/',
        },
    )
    try:
        with urlopen(request, timeout=12) as response:
            raw_body = response.read().decode('utf-8')
            data = json.loads(raw_body or '{}')
            parsed = data if isinstance(data, dict) else {'raw_response': data}
            log_custom_event_safely(
                level='info',
                category='integration',
                action_name='InfinitePay API call',
                request_method='POST',
                request_path=url,
                request_body=payload,
                response_status=int(getattr(response, 'status', 200)),
                response_body=parsed,
                duration_ms=max(0.0, (time.perf_counter() - started_at) * 1000),
                source_system='infinitepay',
                metadata={'integration': 'infinitepay'},
            )
            return parsed
    except HTTPError as exc:
        details = ''
        try:
            details = exc.read().decode('utf-8')
        except Exception:  # noqa: BLE001
            details = ''
        logger.error('InfinitePay HTTP error status=%s body=%s', exc.code, details)
        log_custom_event_safely(
            level='error',
            category='integration',
            action_name='InfinitePay API call failed',
            request_method='POST',
            request_path=url,
            request_body=payload,
            response_status=int(exc.code),
            response_body=details,
            duration_ms=max(0.0, (time.perf_counter() - started_at) * 1000),
            source_system='infinitepay',
            error_message=f'HTTP {exc.code}',
            metadata={'integration': 'infinitepay'},
        )
        if exc.code == 403 and ('error-1010' in details.lower() or 'browser_signature_banned' in details.lower()):
            raise RuntimeError(
                'InfinitePay bloqueou a requisicao (Cloudflare 1010). '
                'Verifique bloqueio de assinatura/user-agent ou solicite liberacao ao suporte da InfinitePay.'
            ) from exc
        if int(exc.code) == 422:
            message = _extract_infinitepay_error_message(details) or 'Parametros invalidos no checkout'
            raise InfinitePayValidationError(f'InfinitePay rejeitou o checkout: {message}') from exc
        raise RuntimeError(f'Erro HTTP InfinitePay ({exc.code})') from exc
    except URLError as exc:
        logger.error('InfinitePay URL error reason=%s', exc.reason)
        log_custom_event_safely(
            level='error',
            category='integration',
            action_name='InfinitePay API connection failed',
            request_method='POST',
            request_path=url,
            request_body=payload,
            duration_ms=max(0.0, (time.perf_counter() - started_at) * 1000),
            source_system='infinitepay',
            error_message=f'URL error: {exc.reason}',
            metadata={'integration': 'infinitepay'},
        )
        raise RuntimeError('Falha de conexao com a InfinitePay') from exc


def _build_items_payload(order: Order) -> list[dict[str, Any]]:
    unit_items: list[dict[str, Any]] = []
    for item in order.items or []:
        description = str(item.title or '').strip() or f'Item do pedido {order.id}'
        quantity = max(1, int(item.quantity or 1))
        base_price_cents = max(0, _to_cents(item.unit_price))
        for _index in range(quantity):
            unit_items.append(
                {
                    'description': description[:180],
                    'base_price_cents': base_price_cents,
                    'final_price_cents': base_price_cents,
                }
            )

    if not unit_items:
        return []

    subtotal_cents = int(sum(int(item['base_price_cents']) for item in unit_items))
    target_total_cents = max(0, _to_cents(order.total))

    if subtotal_cents > 0 and target_total_cents != subtotal_cents:
        proportional_rows = []
        assigned_sum = 0
        for index, item in enumerate(unit_items):
            raw_value = (int(item['base_price_cents']) * target_total_cents) / subtotal_cents
            floor_value = int(raw_value)
            proportional_rows.append((index, floor_value, raw_value - floor_value))
            assigned_sum += floor_value

        missing = target_total_cents - assigned_sum
        if missing > 0:
            proportional_rows.sort(key=lambda row: row[2], reverse=True)
            for cursor in range(missing):
                idx = proportional_rows[cursor % len(proportional_rows)][0]
                unit_items[idx]['final_price_cents'] += 1
        elif missing < 0:
            removable_indexes = [row[0] for row in sorted(proportional_rows, key=lambda row: row[2])]
            remaining = abs(missing)
            pointer = 0
            while remaining > 0 and removable_indexes:
                idx = removable_indexes[pointer % len(removable_indexes)]
                if unit_items[idx]['final_price_cents'] > 0:
                    unit_items[idx]['final_price_cents'] -= 1
                    remaining -= 1
                pointer += 1

    grouped: dict[tuple[str, int], int] = {}
    for item in unit_items:
        key = (str(item['description']), int(item['final_price_cents']))
        grouped[key] = int(grouped.get(key, 0)) + 1

    return [
        {
            'quantity': quantity,
            'price': int(price_cents),
            'description': description,
        }
        for (description, price_cents), quantity in grouped.items()
        if quantity > 0
    ]


def _validate_checkout_items(items: list[dict[str, Any]]) -> None:
    total_cents = 0
    for item in items:
        quantity = max(1, int(item.get('quantity') or 1))
        price_cents = int(item.get('price') or 0)
        total_cents += quantity * price_cents

    # InfinitePay exige total maior que 1 (na pratica: > R$ 1,00).
    if total_cents <= 100:
        raise InfinitePayValidationError('InfinitePay exige total maior que R$ 1,00 para gerar checkout.')


def _build_checkout_payload(
    order: Order,
    config: PaymentProviderInfinitePayConfig,
    customer: dict[str, Any] | None = None,
    address: dict[str, Any] | None = None,
) -> dict[str, Any]:
    items = _build_items_payload(order)
    _validate_checkout_items(items)
    payload: dict[str, Any] = {
        'handle': str(config.handle or '').strip(),
        'items': items,
        'order_nsu': str(order.order_nsu or '').strip(),
    }
    redirect_url = _normalize_text(config.redirect_url) or _normalize_text(config.success_page_url)
    if redirect_url:
        payload['redirect_url'] = redirect_url
    webhook_url = _normalize_text(config.webhook_url)
    if webhook_url:
        payload['webhook_url'] = webhook_url
    if customer and isinstance(customer, dict):
        payload['customer'] = customer
    if address and isinstance(address, dict):
        payload['address'] = address
    return payload


def create_checkout_link(
    *,
    order: Order,
    config: PaymentProviderInfinitePayConfig,
    customer: dict[str, Any] | None = None,
    address: dict[str, Any] | None = None,
) -> InfinitePayCheckoutResult:
    payload = _build_checkout_payload(order, config, customer=customer, address=address)
    logger.info('InfinitePay checkout create order_id=%s order_nsu=%s', order.id, order.order_nsu)
    response = _post_json(INFINITEPAY_CHECKOUT_URL, payload)
    checkout_url = _normalize_text(response.get('url')) or _normalize_text(response.get('checkout_url'))
    if not checkout_url:
        logger.error('InfinitePay checkout response missing url order_id=%s response=%s', order.id, response)
        raise RuntimeError('InfinitePay nao retornou URL de checkout')
    return InfinitePayCheckoutResult(checkout_url=checkout_url, raw_response=response)


def build_status_payload(
    *,
    config: PaymentProviderInfinitePayConfig,
    order_nsu: str,
    slug: str | None,
    transaction_nsu: str | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'handle': str(config.handle or '').strip(),
        'order_nsu': str(order_nsu or '').strip(),
    }
    if _normalize_text(transaction_nsu):
        payload['transaction_nsu'] = _normalize_text(transaction_nsu)
    if _normalize_text(slug):
        payload['slug'] = _normalize_text(slug)
    return payload


def check_payment_status(
    *,
    config: PaymentProviderInfinitePayConfig,
    order_nsu: str,
    slug: str | None,
    transaction_nsu: str | None,
) -> dict[str, Any]:
    payload = build_status_payload(
        config=config,
        order_nsu=order_nsu,
        slug=slug,
        transaction_nsu=transaction_nsu,
    )
    logger.info('InfinitePay status check order_nsu=%s', order_nsu)
    return _post_json(INFINITEPAY_PAYMENT_CHECK_URL, payload)


def infer_payment_status_from_payload(payload: dict[str, Any]) -> str:
    paid = payload.get('paid')
    if paid is True:
        return 'paid'
    if paid is False:
        return 'pending_payment'
    status = str(payload.get('status') or '').strip().lower()
    if status in {'paid', 'approved', 'succeeded'}:
        return 'paid'
    if status in {'failed', 'error', 'declined'}:
        return 'failed'
    if status in {'canceled', 'cancelled'}:
        return 'canceled'
    return 'awaiting_confirmation'


def infer_payment_method(capture_method: str | None, fallback_method: str | None = None) -> str | None:
    normalized = str(capture_method or '').strip().lower()
    if normalized == 'pix':
        return 'pix'
    if normalized in {'credit_card', 'card', 'credit'}:
        return 'credit_card'
    fallback = str(fallback_method or '').strip().lower()
    if fallback in {'pix', 'credit_card', 'whatsapp'}:
        return fallback
    return None


def serialize_infinitepay_config(config: PaymentProviderInfinitePayConfig) -> dict[str, Any]:
    return {
        'id': int(config.id),
        'enabled': bool(config.is_enabled),
        'handle': config.handle,
        'redirect_url': config.redirect_url,
        'webhook_url': config.webhook_url,
        'default_currency': config.default_currency or 'BRL',
        'success_page_url': config.success_page_url,
        'cancel_page_url': config.cancel_page_url,
        'test_mode': bool(config.test_mode),
        'is_ready': bool(config_is_ready(config)[0]),
        'created_at': config.created_at,
        'updated_at': config.updated_at,
    }


def build_payment_metadata(existing_metadata: Any, *, event: str, payload: dict[str, Any]) -> str:
    metadata = _safe_json_dict(existing_metadata)
    history = metadata.get('history')
    if not isinstance(history, list):
        history = []
    history.append({'event': event, 'at': datetime.utcnow().isoformat(), 'payload': payload})
    metadata['history'] = history[-20:]
    return json.dumps(metadata, ensure_ascii=False)
