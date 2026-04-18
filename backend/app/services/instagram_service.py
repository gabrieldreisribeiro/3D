import json
import os
from datetime import datetime
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.models import Product
from app.services.settings_service import get_or_create_settings

GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'


def _normalize_hashtags(value: str | None) -> str:
    raw = str(value or '').replace('\n', ' ').strip()
    if not raw:
        return ''
    parts = [item.strip() for item in raw.replace(',', ' ').split(' ') if item.strip()]
    tags = []
    for part in parts:
        tag = part if part.startswith('#') else f'#{part}'
        if tag not in tags:
            tags.append(tag)
    return ' '.join(tags)


def _http_get_json(url: str):
    request = Request(url, method='GET')
    with urlopen(request, timeout=20) as response:
        payload = response.read().decode('utf-8')
        return json.loads(payload) if payload else {}


def _http_post_json(url: str, data: dict):
    encoded = urlencode(data).encode('utf-8')
    request = Request(url, data=encoded, method='POST')
    with urlopen(request, timeout=25) as response:
        payload = response.read().decode('utf-8')
        return json.loads(payload) if payload else {}


def _format_graph_error(exc: Exception) -> str:
    if isinstance(exc, HTTPError):
        try:
            body = exc.read().decode('utf-8')
            parsed = json.loads(body)
            detail = parsed.get('error', {}).get('message')
            if detail:
                return f'Instagram API: {detail}'
        except Exception:  # noqa: BLE001
            pass
        return f'Instagram API HTTP {exc.code}'
    if isinstance(exc, URLError):
        return 'Falha de rede ao conectar com Instagram'
    return str(exc) or 'Falha ao comunicar com Instagram'


def _validate_required_settings(settings):
    missing = []
    if not settings.instagram_enabled:
        missing.append('Integracao desativada')
    if not settings.instagram_access_token:
        missing.append('access_token')
    if not settings.instagram_user_id:
        missing.append('instagram_user_id')
    if missing:
        return False, f'Configuracao incompleta: {", ".join(missing)}'
    return True, ''


def test_instagram_connection(db: Session):
    settings = get_or_create_settings(db)
    valid, message = _validate_required_settings(settings)
    if not valid:
        return {'ok': False, 'message': message}

    try:
        params = urlencode(
            {
                'fields': 'id,username',
                'access_token': settings.instagram_access_token,
            }
        )
        data = _http_get_json(f'{GRAPH_API_BASE}/{settings.instagram_user_id}?{params}')
        return {
            'ok': True,
            'message': 'Conexao com Instagram validada com sucesso.',
            'account_id': str(data.get('id') or settings.instagram_user_id),
            'account_name': data.get('username'),
        }
    except Exception as exc:  # noqa: BLE001
        return {'ok': False, 'message': _format_graph_error(exc)}


def _resolve_public_product_link(product: Product) -> str:
    base = str(os.getenv('PUBLIC_STORE_URL') or '').strip().rstrip('/')
    if not base:
        return ''
    return f'{base}/product/{product.slug}'


def _resolve_public_image_url(image_url: str | None) -> str:
    raw = str(image_url or '').strip()
    if not raw:
        return ''
    if raw.startswith('http://') or raw.startswith('https://'):
        return raw
    base = str(os.getenv('PUBLIC_API_BASE_URL') or '').strip().rstrip('/')
    if base:
        return f'{base}{raw}'
    return raw


def build_instagram_caption(product: Product, settings) -> str:
    base_caption = str(settings.instagram_default_caption or '').strip()
    custom_caption = str(product.instagram_caption or '').strip()
    description = str(product.short_description or '').strip()
    price = float(product.final_price if product.final_price is not None else product.price or 0)
    link = _resolve_public_product_link(product)
    default_hashtags = _normalize_hashtags(settings.instagram_default_hashtags)
    extra_hashtags = _normalize_hashtags(product.instagram_hashtags)

    lines = []
    if custom_caption:
        lines.append(custom_caption)
    else:
        if base_caption:
            lines.append(base_caption)
        lines.append(product.title)
        if description:
            lines.append(description)
        lines.append(f'Preco: R$ {price:.2f}')
        if link:
            lines.append(link)
    hashtags = ' '.join(item for item in [default_hashtags, extra_hashtags] if item)
    if hashtags:
        lines.append(hashtags)
    return '\n'.join([line for line in lines if line]).strip()


def publish_product_to_instagram(db: Session, product: Product):
    settings = get_or_create_settings(db)
    valid, message = _validate_required_settings(settings)
    if not valid:
        raise ValueError(message)

    image_url = _resolve_public_image_url(product.cover_image)
    if not image_url.startswith('http://') and not image_url.startswith('https://'):
        raise ValueError('A imagem principal precisa ser uma URL publica para postar no Instagram.')

    caption = build_instagram_caption(product, settings)

    media_data = _http_post_json(
        f'{GRAPH_API_BASE}/{settings.instagram_user_id}/media',
        {
            'image_url': image_url,
            'caption': caption,
            'access_token': settings.instagram_access_token,
        },
    )
    creation_id = media_data.get('id')
    if not creation_id:
        raise ValueError('Instagram nao retornou creation_id.')

    publish_data = _http_post_json(
        f'{GRAPH_API_BASE}/{settings.instagram_user_id}/media_publish',
        {
            'creation_id': creation_id,
            'access_token': settings.instagram_access_token,
        },
    )
    post_id = publish_data.get('id')
    if not post_id:
        raise ValueError('Instagram nao retornou post_id.')
    return str(post_id)


def try_publish_product_to_instagram(db: Session, product: Product):
    if not product.publish_to_instagram:
        product.instagram_post_status = 'not_published'
        product.instagram_error_message = None
        return product

    product.instagram_post_status = 'pending'
    product.instagram_error_message = None
    db.add(product)
    db.commit()
    db.refresh(product)

    try:
        post_id = publish_product_to_instagram(db, product)
        product.instagram_post_status = 'published'
        product.instagram_post_id = post_id
        product.instagram_published_at = datetime.utcnow()
        product.instagram_error_message = None
    except Exception as exc:  # noqa: BLE001
        product.instagram_post_status = 'error'
        product.instagram_error_message = _format_graph_error(exc)

    db.add(product)
    db.commit()
    db.refresh(product)
    return product
