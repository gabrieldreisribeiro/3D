import json
import re
import unicodedata
from datetime import datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from urllib import error, request

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import AdsGenerationHistory, AdsProviderConfig, Category, OrderItem, Product, UserEvent
from app.services.product_pricing_service import calculate_product_pricing_from_fields

DEFAULT_PROVIDER = 'nvidia'
DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'
DEFAULT_MODEL = 'qwen/qwen2.5-coder-7b-instruct'
DRAFT_PLACEHOLDER_IMAGE = 'https://placehold.co/1200x800/png?text=Produto+em+rascunho'
DEFAULT_PROMPT_FALLBACK = (
    'Voce e um estrategista de performance para e-commerce de produtos impressos em 3D. '
    'Retorne SOMENTE JSON valido no formato: '
    '{"ads":[{"headline":"","primary_text":"","description":"","cta":"","target_audience":"","creative_idea":"","product_draft":{"title":"","short_description":"","full_description":"","suggested_category":"","highlights":[],"tags":[]}}]}. '
    'Em product_draft, sempre preencha title, short_description e full_description. '
    'Nao inclua markdown, comentarios nem texto fora do JSON.'
)
DEFAULT_PROMPT_FILE = Path(__file__).resolve().parents[1] / 'prompts' / 'ads_generator_default.md'


@lru_cache(maxsize=1)
def get_default_ads_prompt_markdown() -> str:
    try:
        content = DEFAULT_PROMPT_FILE.read_text(encoding='utf-8').strip()
        return content or DEFAULT_PROMPT_FALLBACK
    except Exception:  # noqa: BLE001
        return DEFAULT_PROMPT_FALLBACK


def _safe_json_loads(raw: str | None) -> dict:
    try:
        data = json.loads(raw or '{}')
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def _normalize_base_url(base_url: str) -> str:
    value = str(base_url or '').strip().rstrip('/')
    if not value:
        return DEFAULT_BASE_URL
    return value


def _normalize_text(value: str | None) -> str:
    return str(value or '').strip()


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value or '')
    ascii_only = normalized.encode('ascii', 'ignore').decode('ascii').lower()
    slug = re.sub(r'[^a-z0-9]+', '-', ascii_only).strip('-')
    return slug or 'produto-ia'


def _unique_slug(db: Session, base_slug: str) -> str:
    slug = _slugify(base_slug)
    candidate = slug
    counter = 2
    while db.query(Product.id).filter(Product.slug == candidate).first():
        candidate = f'{slug}-{counter}'
        counter += 1
    return candidate


def _match_category_id(db: Session, suggested_category: str | None) -> int | None:
    suggestion = _normalize_text(suggested_category)
    if not suggestion:
        return None
    normalized = unicodedata.normalize('NFKD', suggestion).encode('ascii', 'ignore').decode('ascii').lower().strip()
    if not normalized:
        return None
    categories = db.query(Category).all()
    exact = next((item for item in categories if item.slug == normalized or item.name.lower() == normalized), None)
    if exact:
        return exact.id
    partial = next((item for item in categories if normalized in item.slug or normalized in item.name.lower()), None)
    if partial:
        return partial.id
    return None


def _parse_llm_json(content: str) -> dict:
    raw = str(content or '').strip()
    if not raw:
        raise ValueError('Resposta vazia do modelo.')
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:  # noqa: BLE001
        pass

    start = raw.find('{')
    end = raw.rfind('}')
    if start >= 0 and end > start:
        snippet = raw[start : end + 1]
        parsed = json.loads(snippet)
        if isinstance(parsed, dict):
            return parsed
    raise ValueError('Nao foi possivel interpretar JSON da resposta do modelo.')


def _http_json_post(url: str, api_key: str, payload: dict, timeout: int = 45) -> dict:
    req = request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST',
    )
    try:
        with request.urlopen(req, timeout=timeout) as response:  # noqa: S310
            body = response.read().decode('utf-8')
            return json.loads(body)
    except error.HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='ignore')
        raise ValueError(f'Erro HTTP no provider ({exc.code}): {detail[:400]}') from exc
    except error.URLError as exc:
        raise ValueError(f'Falha de conexao com provider: {exc.reason}') from exc
    except TimeoutError as exc:
        raise ValueError('Timeout ao chamar o provider de IA.') from exc
    except json.JSONDecodeError as exc:
        raise ValueError('Resposta invalida do provider de IA (JSON malformado).') from exc


def get_or_create_ads_provider_config(db: Session) -> AdsProviderConfig:
    config = db.query(AdsProviderConfig).order_by(AdsProviderConfig.id.asc()).first()
    if config:
        return config
    config = AdsProviderConfig(
        provider_name=DEFAULT_PROVIDER,
        base_url=DEFAULT_BASE_URL,
        model_name=DEFAULT_MODEL,
        is_active=False,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def update_ads_provider_config(
    db: Session,
    *,
    provider_name: str,
    base_url: str,
    api_key: str | None,
    model_name: str,
    prompt_complement: str | None,
    is_active: bool,
) -> AdsProviderConfig:
    config = get_or_create_ads_provider_config(db)
    config.provider_name = str(provider_name or DEFAULT_PROVIDER).strip().lower()
    config.base_url = _normalize_base_url(base_url)
    config.model_name = str(model_name or DEFAULT_MODEL).strip()
    config.prompt_complement = _normalize_text(prompt_complement) or None
    config.is_active = bool(is_active)
    if api_key is not None:
        api_key_value = str(api_key).strip()
        if api_key_value:
            config.api_key = api_key_value
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def _call_model(config: AdsProviderConfig, messages: list[dict], max_tokens: int = 1200) -> str:
    if not config.api_key:
        raise ValueError('API key do provider de anuncios nao configurada.')

    base = _normalize_base_url(config.base_url)
    endpoint = f'{base}/chat/completions'
    payload = {
        'model': config.model_name,
        'messages': messages,
        'temperature': 0.7,
        'max_tokens': max_tokens,
    }
    response = _http_json_post(endpoint, config.api_key, payload)
    choices = response.get('choices') or []
    if not choices:
        raise ValueError('Provider retornou resposta sem choices.')
    message = choices[0].get('message') or {}
    content = message.get('content')
    if not content:
        raise ValueError('Provider retornou resposta sem content.')
    return str(content)


def test_ads_provider_connection(db: Session) -> dict:
    config = get_or_create_ads_provider_config(db)
    if not config.base_url or not config.model_name:
        return {'ok': False, 'message': 'Base URL e modelo sao obrigatorios.', 'model': config.model_name}
    if not config.api_key:
        return {'ok': False, 'message': 'API key nao configurada.', 'model': config.model_name}

    messages = [
        {'role': 'system', 'content': 'Responda somente em JSON valido.'},
        {'role': 'user', 'content': 'Retorne {"ok": true, "provider": "nvidia"}'},
    ]
    try:
        content = _call_model(config, messages, max_tokens=200)
        parsed = _parse_llm_json(content)
        if parsed.get('ok') is True:
            return {'ok': True, 'message': 'Conexao com provider validada.', 'model': config.model_name}
        return {'ok': True, 'message': 'Conexao valida, mas resposta inesperada.', 'model': config.model_name}
    except Exception as exc:  # noqa: BLE001
        return {'ok': False, 'message': str(exc), 'model': config.model_name}


def _to_float(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def build_ads_input_data(db: Session, *, limit_products: int = 5) -> dict:
    sold_rows = (
        db.query(
            Product.id.label('product_id'),
            Product.title.label('title'),
            Category.name.label('category'),
            func.sum(OrderItem.quantity).label('sold_qty'),
            func.sum(OrderItem.line_total).label('sold_value'),
            func.avg(OrderItem.unit_price).label('avg_price'),
        )
        .join(Product, Product.slug == OrderItem.product_slug)
        .outerjoin(Category, Category.id == Product.category_id)
        .group_by(Product.id, Product.title, Category.name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit_products)
        .all()
    )

    viewed_rows = (
        db.query(
            Product.id.label('product_id'),
            Product.title.label('title'),
            func.count(UserEvent.id).label('views'),
        )
        .join(Product, Product.id == UserEvent.product_id)
        .filter(UserEvent.event_type.in_(['product_view', 'view_product']))
        .group_by(Product.id, Product.title)
        .order_by(func.count(UserEvent.id).desc())
        .limit(limit_products)
        .all()
    )

    whatsapp_rows = (
        db.query(
            Product.id.label('product_id'),
            Product.title.label('title'),
            func.count(UserEvent.id).label('whatsapp_hits'),
        )
        .join(Product, Product.id == UserEvent.product_id)
        .filter(UserEvent.event_type.in_(['whatsapp_click', 'send_whatsapp']))
        .group_by(Product.id, Product.title)
        .order_by(func.count(UserEvent.id).desc())
        .limit(limit_products)
        .all()
    )

    category_rows = (
        db.query(
            func.coalesce(Category.name, 'Sem categoria').label('category'),
            func.sum(
                case((OrderItem.quantity.is_(None), 0), else_=OrderItem.quantity),
            ).label('total_qty'),
        )
        .join(Product, Product.slug == OrderItem.product_slug)
        .outerjoin(Category, Category.id == Product.category_id)
        .group_by(func.coalesce(Category.name, 'Sem categoria'))
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
        .all()
    )

    sold_map: dict[int, dict] = {}
    for row in sold_rows:
        sold_map[row.product_id] = {
            'product_id': row.product_id,
            'title': row.title,
            'category': row.category or 'Sem categoria',
            'sold_qty': int(row.sold_qty or 0),
            'sold_value': round(_to_float(row.sold_value), 2),
            'avg_price': round(_to_float(row.avg_price), 2),
            'views': 0,
            'whatsapp_hits': 0,
        }

    for row in viewed_rows:
        base = sold_map.get(row.product_id) or {
            'product_id': row.product_id,
            'title': row.title,
            'category': 'Sem categoria',
            'sold_qty': 0,
            'sold_value': 0,
            'avg_price': 0,
            'views': 0,
            'whatsapp_hits': 0,
        }
        base['views'] = int(row.views or 0)
        sold_map[row.product_id] = base

    for row in whatsapp_rows:
        base = sold_map.get(row.product_id) or {
            'product_id': row.product_id,
            'title': row.title,
            'category': 'Sem categoria',
            'sold_qty': 0,
            'sold_value': 0,
            'avg_price': 0,
            'views': 0,
            'whatsapp_hits': 0,
        }
        base['whatsapp_hits'] = int(row.whatsapp_hits or 0)
        sold_map[row.product_id] = base

    products = list(sold_map.values())
    products.sort(key=lambda item: (item['sold_qty'], item['views'], item['whatsapp_hits']), reverse=True)
    products = products[:limit_products]

    average_price = round(sum((item.get('avg_price') or 0) for item in products) / len(products), 2) if products else 0
    main_category = category_rows[0].category if category_rows else 'Sem categoria'

    return {
        'generated_at': datetime.utcnow().isoformat(),
        'products': products,
        'top_categories': [{'category': row.category, 'sales_volume': int(row.total_qty or 0)} for row in category_rows],
        'main_category': main_category,
        'average_price_range': average_price,
    }


def _build_ads_prompt(
    input_data: dict,
    ads_count: int,
    extra_context: str | None,
    prompt_complement: str | None,
) -> list[dict]:
    default_prompt = get_default_ads_prompt_markdown()
    complement = _normalize_text(prompt_complement)
    system_prompt = default_prompt if not complement else f'{default_prompt}\n\nComplemento do admin:\n{complement}'
    user_payload = {
        'task': f'Gerar {ads_count} ideias de anuncios para Facebook/Instagram usando os dados reais fornecidos.',
        'constraints': {
            'language': 'pt-BR',
            'tone': 'comercial, claro e objetivo',
            'ctas_allowed': ['Compre agora', 'Saiba mais', 'Fale no WhatsApp'],
        },
        'business_data': input_data,
        'extra_context': (extra_context or '').strip(),
    }
    return [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': json.dumps(user_payload, ensure_ascii=False)},
    ]


def _normalize_ads_output(raw_output: dict) -> dict:
    ads = raw_output.get('ads')
    if not isinstance(ads, list):
        raise ValueError('Resposta do modelo sem lista "ads".')

    normalized_ads: list[dict] = []
    for item in ads:
        if not isinstance(item, dict):
            continue
        normalized_ads.append(
            {
                'headline': str(item.get('headline') or '').strip(),
                'primary_text': str(item.get('primary_text') or '').strip(),
                'description': str(item.get('description') or '').strip(),
                'cta': str(item.get('cta') or 'Compre agora').strip() or 'Compre agora',
                'target_audience': str(item.get('target_audience') or '').strip(),
                'creative_idea': str(item.get('creative_idea') or '').strip(),
                'product_draft': {
                    'title': _normalize_text((item.get('product_draft') or {}).get('title') if isinstance(item.get('product_draft'), dict) else item.get('headline')),
                    'short_description': _normalize_text((item.get('product_draft') or {}).get('short_description') if isinstance(item.get('product_draft'), dict) else item.get('description')),
                    'full_description': _normalize_text((item.get('product_draft') or {}).get('full_description') if isinstance(item.get('product_draft'), dict) else item.get('primary_text')),
                    'suggested_category': _normalize_text((item.get('product_draft') or {}).get('suggested_category') if isinstance(item.get('product_draft'), dict) else ''),
                    'highlights': [
                        _normalize_text(highlight)
                        for highlight in ((item.get('product_draft') or {}).get('highlights') or [])
                        if _normalize_text(highlight)
                    ][:6]
                    if isinstance(item.get('product_draft'), dict)
                    else [],
                    'tags': [
                        _normalize_text(tag)
                        for tag in ((item.get('product_draft') or {}).get('tags') or [])
                        if _normalize_text(tag)
                    ][:10]
                    if isinstance(item.get('product_draft'), dict)
                    else [],
                },
            }
        )

    normalized_ads = [item for item in normalized_ads if item['headline'] and item['primary_text']]
    if not normalized_ads:
        raise ValueError('Modelo retornou anuncios vazios ou invalidos.')
    return {'ads': normalized_ads}


def _build_product_descriptions_from_ad(ad_payload: dict) -> dict:
    product_draft = ad_payload.get('product_draft') if isinstance(ad_payload.get('product_draft'), dict) else {}
    headline = _normalize_text(ad_payload.get('headline'))
    primary_text = _normalize_text(ad_payload.get('primary_text'))
    ad_description = _normalize_text(ad_payload.get('description'))

    title = _normalize_text(product_draft.get('title')) or headline or 'Produto gerado por IA'
    short_description = _normalize_text(product_draft.get('short_description')) or ad_description or headline
    full_description = _normalize_text(product_draft.get('full_description')) or primary_text or short_description
    highlights = [item for item in (product_draft.get('highlights') or []) if _normalize_text(item)]
    tags = [item for item in (product_draft.get('tags') or []) if _normalize_text(item)]

    full_parts = [full_description]
    if highlights:
        highlights_block = '\n'.join(f'- {str(item).strip()}' for item in highlights[:6])
        full_parts.append(f'Destaques:\n{highlights_block}')
    if tags:
        tag_line = ' '.join(f'#{str(item).strip().replace(" ", "")}' for item in tags[:10])
        full_parts.append(f'Tags sugeridas: {tag_line}')

    return {
        'title': title[:160],
        'short_description': short_description[:260],
        'full_description': '\n\n'.join(part for part in full_parts if part).strip(),
        'suggested_category': _normalize_text(product_draft.get('suggested_category')),
        'tags': tags[:10],
    }


def generate_ads_ideas(
    db: Session,
    *,
    admin_id: int | None,
    ads_count: int = 3,
    extra_context: str | None = None,
) -> AdsGenerationHistory:
    config = get_or_create_ads_provider_config(db)
    if not config.is_active:
        raise ValueError('Integracao de anuncios com IA esta desativada.')
    if not config.api_key:
        raise ValueError('API key do provider nao configurada.')

    input_data = build_ads_input_data(db, limit_products=5)
    messages = _build_ads_prompt(
        input_data,
        ads_count=ads_count,
        extra_context=extra_context,
        prompt_complement=config.prompt_complement,
    )
    content = _call_model(config, messages, max_tokens=1500)
    parsed = _parse_llm_json(content)
    output = _normalize_ads_output(parsed)

    history = AdsGenerationHistory(
        input_data_json=json.dumps(input_data, ensure_ascii=False),
        output_data_json=json.dumps(output, ensure_ascii=False),
        model_used=config.model_name,
        admin_id=admin_id,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def create_product_draft_from_ad(
    db: Session,
    *,
    ad_generation_id: int,
    ad_index: int = 0,
) -> Product:
    history = db.query(AdsGenerationHistory).filter(AdsGenerationHistory.id == ad_generation_id).first()
    if not history:
        raise ValueError('Geracao de anuncios nao encontrada.')

    output = _safe_json_loads(history.output_data_json)
    ads = output.get('ads') if isinstance(output, dict) else None
    if not isinstance(ads, list) or not ads:
        raise ValueError('Geracao nao possui anuncios validos.')
    if ad_index < 0 or ad_index >= len(ads):
        raise ValueError('Indice do anuncio invalido.')

    ad_payload = ads[ad_index]
    if not isinstance(ad_payload, dict):
        raise ValueError('Anuncio selecionado invalido.')

    draft_data = _build_product_descriptions_from_ad(ad_payload)
    slug = _unique_slug(db, draft_data['title'])
    category_id = _match_category_id(db, draft_data.get('suggested_category'))
    hashtags = ' '.join(f'#{str(tag).strip().replace(" ", "")}' for tag in draft_data.get('tags') or [])

    pricing = calculate_product_pricing_from_fields(
        {
            'grams_filament': 0,
            'price_kg_filament': 0,
            'hours_printing': 0,
            'avg_power_watts': 0,
            'price_kwh': 0,
            'total_hours_labor': 0,
            'price_hour_labor': 0,
            'extra_cost': 0,
            'profit_margin': 0,
            'manual_price': None,
        }
    )

    product = Product(
        title=draft_data['title'],
        slug=slug,
        short_description=draft_data['short_description'],
        full_description=draft_data['full_description'],
        price=0.0,
        cover_image=DRAFT_PLACEHOLDER_IMAGE,
        images='',
        sub_items='',
        is_active=False,
        rating_average=0.0,
        rating_count=0,
        category_id=category_id,
        lead_time_hours=0.0,
        allow_colors=False,
        available_colors='[]',
        allow_secondary_color=False,
        secondary_color_pairs='[]',
        grams_filament=0.0,
        price_kg_filament=0.0,
        hours_printing=0.0,
        avg_power_watts=0.0,
        price_kwh=0.0,
        total_hours_labor=0.0,
        price_hour_labor=0.0,
        extra_cost=0.0,
        profit_margin=0.0,
        cost_total=pricing['cost_total'],
        calculated_price=pricing['calculated_price'],
        estimated_profit=pricing['estimated_profit'],
        manual_price=None,
        final_price=pricing['final_price'],
        publish_to_instagram=False,
        instagram_caption=None,
        instagram_hashtags=hashtags or None,
        instagram_post_status='not_published',
        instagram_post_id=None,
        instagram_published_at=None,
        instagram_error_message=None,
        is_draft=True,
        generated_by_ai=True,
        source_ad_generation_id=history.id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def list_ads_history(db: Session, *, page: int = 1, page_size: int = 20) -> tuple[list[AdsGenerationHistory], int]:
    query = db.query(AdsGenerationHistory)
    total = query.count()
    items = (
        query.order_by(AdsGenerationHistory.created_at.desc(), AdsGenerationHistory.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def serialize_history_item(item: AdsGenerationHistory) -> dict:
    return {
        'id': item.id,
        'model_used': item.model_used,
        'input_data_json': _safe_json_loads(item.input_data_json),
        'output_data_json': _safe_json_loads(item.output_data_json),
        'created_at': item.created_at,
    }
