import json
from datetime import datetime
from decimal import Decimal
from urllib import error, request

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models import AdsGenerationHistory, AdsProviderConfig, Category, OrderItem, Product, UserEvent

DEFAULT_PROVIDER = 'nvidia'
DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'
DEFAULT_MODEL = 'qwen/qwen2.5-coder-7b-instruct'


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
    is_active: bool,
) -> AdsProviderConfig:
    config = get_or_create_ads_provider_config(db)
    config.provider_name = str(provider_name or DEFAULT_PROVIDER).strip().lower()
    config.base_url = _normalize_base_url(base_url)
    config.model_name = str(model_name or DEFAULT_MODEL).strip()
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
        .filter(UserEvent.event_type == 'view_product')
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
        .filter(UserEvent.event_type == 'send_whatsapp')
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


def _build_ads_prompt(input_data: dict, ads_count: int, extra_context: str | None) -> list[dict]:
    system_prompt = (
        'Voce e um estrategista de performance para e-commerce de produtos impressos em 3D. '
        'Retorne SOMENTE JSON valido no formato: '
        '{"ads":[{"headline":"","primary_text":"","description":"","cta":"","target_audience":"","creative_idea":""}]}. '
        'Nao inclua markdown, comentarios nem texto fora do JSON.'
    )
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
            }
        )

    normalized_ads = [item for item in normalized_ads if item['headline'] and item['primary_text']]
    if not normalized_ads:
        raise ValueError('Modelo retornou anuncios vazios ou invalidos.')
    return {'ads': normalized_ads}


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
    messages = _build_ads_prompt(input_data, ads_count=ads_count, extra_context=extra_context)
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
