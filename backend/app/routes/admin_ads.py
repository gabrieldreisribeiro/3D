from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_db, require_admin
from app.models import AdminUser
from app.schemas import (
    AdsConnectionTestResponse,
    AdsGenerateRequest,
    AdsGenerateResponse,
    AdsGenerationHistoryResponse,
    AdsProviderConfigResponse,
    AdsProviderConfigUpdate,
    CreateProductFromAdRequest,
    CreateProductFromAdResponse,
)
from app.services.ads_ai_service import (
    create_product_draft_from_ad,
    generate_ads_ideas,
    get_or_create_ads_provider_config,
    list_ads_history,
    serialize_history_item,
    test_ads_provider_connection,
    update_ads_provider_config,
)

router = APIRouter(prefix='/admin/ads', tags=['admin-ads'])


@router.get('/config', response_model=AdsProviderConfigResponse)
def get_ads_config(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    config = get_or_create_ads_provider_config(db)
    return AdsProviderConfigResponse(
        id=config.id,
        provider_name=config.provider_name,
        base_url=config.base_url,
        model_name=config.model_name,
        is_active=bool(config.is_active),
        has_api_key=bool(config.api_key),
        created_at=config.created_at,
    )


@router.post('/config', response_model=AdsProviderConfigResponse)
def save_ads_config(
    payload: AdsProviderConfigUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    config = update_ads_provider_config(
        db,
        provider_name=payload.provider_name,
        base_url=payload.base_url,
        api_key=payload.api_key,
        model_name=payload.model_name,
        is_active=payload.is_active,
    )
    return AdsProviderConfigResponse(
        id=config.id,
        provider_name=config.provider_name,
        base_url=config.base_url,
        model_name=config.model_name,
        is_active=bool(config.is_active),
        has_api_key=bool(config.api_key),
        created_at=config.created_at,
    )


@router.post('/config/test', response_model=AdsConnectionTestResponse)
def test_ads_config(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    result = test_ads_provider_connection(db)
    return AdsConnectionTestResponse(ok=bool(result.get('ok')), message=result.get('message') or '', model=result.get('model'))


@router.post('/generate', response_model=AdsGenerateResponse)
def generate_ads(
    payload: AdsGenerateRequest,
    admin: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        history = generate_ads_ideas(
            db,
            admin_id=admin.id,
            ads_count=payload.ads_count,
            extra_context=payload.extra_context,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f'Falha ao gerar anuncios: {exc}') from exc

    serialized = serialize_history_item(history)
    output = serialized.get('output_data_json') or {}
    return AdsGenerateResponse(
        history_id=history.id,
        model_used=history.model_used,
        input_data_json=serialized.get('input_data_json') or {},
        ads=output.get('ads') or [],
        created_at=history.created_at,
    )


@router.get('/history', response_model=AdsGenerationHistoryResponse)
def history_ads(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items, total = list_ads_history(db, page=page, page_size=page_size)
    return AdsGenerationHistoryResponse(
        items=[serialize_history_item(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post('/create-product-from-copy', response_model=CreateProductFromAdResponse)
def create_product_from_copy(
    payload: CreateProductFromAdRequest,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        product = create_product_draft_from_ad(
            db,
            ad_generation_id=payload.ad_generation_id,
            ad_index=payload.ad_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f'Falha ao criar draft de produto: {exc}') from exc

    return CreateProductFromAdResponse(
        product_id=product.id,
        edit_url=f'/painel-interno/produtos?edit={product.id}&source=ai',
    )
