import json
import io
import mimetypes
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import (
    create_admin_token,
    get_db,
    hash_password,
    needs_password_rehash,
    require_admin,
    require_super_admin,
    verify_password,
)
from app.models import AdminUser, Product3DModel, PublicationDraft
from app.schemas import (
    AdminAuthUserResponse,
    AdminCategoryCreate,
    AdminCategoryResponse,
    AdminCategoryUpdate,
    AdminCouponCreate,
    AdminCouponResponse,
    AdminCouponUpdate,
    AdminDashboardSummary,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminOrderResponse,
    AdminUserCreateRequest,
    AdminUserPasswordUpdateRequest,
    AdminUserResponse,
    AdminUserUpdateRequest,
    AdminProductCreate,
    AdminProductResponse,
    AdminProductUpdate,
    Admin3DModelCreateRequest,
    Admin3DModelResponse,
    Admin3DModelUpdateRequest,
    Product3DModelCreate,
    Product3DModelResponse,
    Product3DModelUpdate,
    Product3DModelUploadResponse,
    ProductResponse,
    AdminReviewListResponse,
    AdminReviewResponse,
    BannerCreate,
    BannerResponse,
    BannerUpdate,
    HighlightItemCreate,
    HighlightItemResponse,
    HighlightItemUpdate,
    InstagramConnectionTestResponse,
    InstagramSettingsResponse,
    InstagramSettingsUpdate,
    LogoResponse,
    MetaPixelAdminConfigResponse,
    MetaPixelAdminConfigUpdate,
    MetaPixelValidationResponse,
    PromotionCreate,
    PublicationActionResponse,
    PublicationPendingItemResponse,
    PromotionResponse,
    PromotionUpdate,
    StoreSettingsResponse,
    StoreSettingsUpdate,
)
from app.services.coupon_service import (
    admin_coupon_by_id,
    admin_coupon_code_exists,
    admin_create_coupon,
    admin_delete_coupon,
    admin_list_coupons,
    admin_set_coupon_status,
    admin_update_coupon,
)
from app.services.banner_service import create_banner, delete_banner, get_banner, list_admin_banners, update_banner
from app.services.banner_upload_service import save_banner_image
from app.services.highlight_service import (
    create_highlight_item,
    delete_highlight_item,
    get_highlight_item_by_id,
    list_admin_highlight_items,
    set_highlight_item_status,
    update_highlight_item,
)
from app.services.analytics_service import analytics_funnel, analytics_products, analytics_summary, parse_period
from app.services.logo_service import save_logo
from app.services.product_upload_service import save_product_image
from app.services.product_3d_model_service import (
    get_product_3d_model,
    list_all_3d_models,
    list_product_3d_models,
    save_original_model_file,
    save_preview_model_file,
    url_to_upload_path,
)
from app.services.order_service import (
    admin_list_orders,
    admin_total_orders,
    admin_total_sold,
    dashboard_order_status,
    dashboard_orders_last_days,
    dashboard_sales_last_days,
    dashboard_top_products,
    serialize_admin_order,
)
from app.services.instagram_service import test_instagram_connection, try_publish_product_to_instagram
from app.services.product_service import (
    admin_category_slug_exists,
    admin_create_category,
    admin_delete_category,
    admin_get_category_by_id,
    admin_list_categories,
    admin_create_product,
    admin_delete_product,
    admin_get_product_by_id,
    admin_list_products,
    admin_set_product_status,
    admin_slug_exists,
    admin_update_product,
    parse_colors_from_storage,
    parse_secondary_pairs_from_storage,
    parse_sub_items_from_storage,
    admin_update_category,
)
from app.services.promotion_service import (
    create_promotion,
    delete_promotion,
    get_promotion_by_id,
    list_promotions,
    serialize_promotion,
    toggle_promotion,
    update_promotion,
)
from app.services.publication_service import (
    build_preview_banners,
    build_preview_highlights,
    build_preview_most_ordered_products,
    build_preview_product_by_slug,
    build_preview_products,
    build_preview_promotions,
    discard_draft_by_entity_and_id,
    find_draft_by_id,
    get_pending_publication_items,
    list_admin_banners_with_drafts,
    list_admin_highlights_with_drafts,
    list_admin_products_with_drafts,
    list_admin_promotions_with_drafts,
    list_entity_create_drafts,
    get_draft_payload,
    get_entity_draft,
    publish_all_drafts,
    publish_draft,
    publish_draft_by_entity_and_id,
    save_draft,
    serialize_product_payload_for_draft,
)
from app.services.review_service import delete_review, get_review_by_id, list_admin_reviews, set_review_status
from app.services.settings_service import (
    get_or_create_settings,
    is_meta_pixel_config_valid,
    update_instagram_settings,
    update_meta_pixel_settings,
    update_store_settings,
)

router = APIRouter(prefix='/admin', tags=['admin'])


def _serialize_product(product):
    product.images = product.images.split(',') if product.images else []
    product.sub_items = parse_sub_items_from_storage(product.sub_items)
    product.available_colors = parse_colors_from_storage(product.available_colors)
    product.secondary_color_pairs = parse_secondary_pairs_from_storage(product.secondary_color_pairs, product.available_colors)
    return product


def _serialize_admin_review(review) -> AdminReviewResponse:
    media = sorted(review.media or [], key=lambda item: (item.sort_order, item.id))
    photos = [item.file_path for item in media if item.media_type == 'image']
    video = next((item.file_path for item in media if item.media_type == 'video'), None)
    return AdminReviewResponse(
        id=review.id,
        product_id=review.product_id,
        author_name=review.author_name,
        rating=review.rating,
        comment=review.comment,
        status=review.status,
        created_at=review.created_at,
        updated_at=review.updated_at,
        media=media,
        photos=photos,
        video=video,
        has_media=bool(media),
        product_title=review.product.title if review.product else None,
        product_slug=review.product.slug if review.product else None,
    )


def _serialize_admin_user(admin: AdminUser) -> AdminUserResponse:
    return AdminUserResponse(
        id=admin.id,
        name=admin.name,
        email=admin.email,
        role=admin.role,
        is_active=bool(admin.is_active),
        is_blocked=bool(admin.is_blocked),
        last_login_at=admin.last_login_at,
        created_at=admin.created_at,
        updated_at=admin.updated_at,
    )


def _serialize_product_3d_model(model) -> Product3DModelResponse:
    sub_item_title = None
    if model.product and model.sub_item_id:
        sub_items = parse_sub_items_from_storage(model.product.sub_items)
        linked = next((item for item in sub_items if str(item.get('id') or '').strip() == str(model.sub_item_id).strip()), None)
        sub_item_title = linked.get('title') if linked else None
    return Product3DModelResponse(
        id=model.id,
        product_id=model.product_id,
        sub_item_id=model.sub_item_id,
        name=model.name,
        description=model.description,
        original_file_url=model.original_file_url,
        preview_file_url=model.preview_file_url,
        width_mm=model.width_mm,
        height_mm=model.height_mm,
        depth_mm=model.depth_mm,
        dimensions_source=model.dimensions_source,
        allow_download=bool(model.allow_download),
        sort_order=int(model.sort_order or 1),
        is_active=bool(model.is_active),
        sub_item_title=sub_item_title,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _file_name_from_url(url: str | None) -> str | None:
    value = str(url or '').strip()
    if not value:
        return None
    clean = value.split('?', 1)[0].split('#', 1)[0]
    return Path(clean).name or None


def _serialize_admin_3d_model(model: Product3DModel) -> Admin3DModelResponse:
    sub_item_title = None
    if model.product and model.sub_item_id:
        sub_items = parse_sub_items_from_storage(model.product.sub_items)
        linked = next((item for item in sub_items if str(item.get('id') or '').strip() == str(model.sub_item_id).strip()), None)
        sub_item_title = linked.get('title') if linked else None
    return Admin3DModelResponse(
        id=model.id,
        product_id=model.product_id,
        sub_item_id=model.sub_item_id,
        name=model.name,
        description=model.description,
        original_file_url=model.original_file_url,
        preview_file_url=model.preview_file_url,
        width_mm=model.width_mm,
        height_mm=model.height_mm,
        depth_mm=model.depth_mm,
        dimensions_source=model.dimensions_source,
        allow_download=bool(model.allow_download),
        sort_order=int(model.sort_order or 1),
        is_active=bool(model.is_active),
        created_at=model.created_at,
        updated_at=model.updated_at,
        sub_item_title=sub_item_title,
        product_title=model.product.title if model.product else None,
        product_slug=model.product.slug if model.product else None,
        original_file_name=_file_name_from_url(model.original_file_url),
        preview_file_name=_file_name_from_url(model.preview_file_url),
    )


def _normalize_sub_item_id(value: str | None) -> str | None:
    normalized = str(value or '').strip()
    return normalized or None


def _ensure_valid_model_target(product, sub_item_id: str | None) -> None:
    if not sub_item_id:
        return
    sub_items = parse_sub_items_from_storage(product.sub_items)
    exists = any(str(item.get('id') or '').strip() == sub_item_id for item in sub_items)
    if not exists:
        raise HTTPException(status_code=400, detail='Subitem vinculado nao existe no produto informado.')


def _count_super_admins(db: Session) -> int:
    total = db.query(func.count(AdminUser.id)).filter(AdminUser.role == 'super_admin').scalar()
    return int(total or 0)


def _ensure_not_last_super_admin(db: Session, target: AdminUser, detail: str) -> None:
    if target.role != 'super_admin':
        return
    if _count_super_admins(db) <= 1:
        raise HTTPException(status_code=400, detail=detail)


@router.post('/auth/login', response_model=AdminLoginResponse)
def login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.email == payload.email.lower()).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciais invalidas')
    if not bool(admin.is_active):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Seu usuario esta inativo. Contate um super administrador.')
    if bool(admin.is_blocked):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Seu acesso foi bloqueado. Contate um super administrador.')
    if needs_password_rehash(admin.password_hash):
        admin.password_hash = hash_password(payload.password)
    admin.last_login_at = datetime.utcnow()
    db.add(admin)
    db.commit()
    db.refresh(admin)

    return AdminLoginResponse(
        token=create_admin_token(admin.id),
        admin=AdminAuthUserResponse(
            id=admin.id,
            name=admin.name,
            email=admin.email,
            role=admin.role,
            is_active=bool(admin.is_active),
            is_blocked=bool(admin.is_blocked),
        ),
    )


@router.get('/auth/me', response_model=AdminAuthUserResponse)
def admin_me(admin: AdminUser = Depends(require_admin)):
    return AdminAuthUserResponse(
        id=admin.id,
        name=admin.name,
        email=admin.email,
        role=admin.role,
        is_active=bool(admin.is_active),
        is_blocked=bool(admin.is_blocked),
    )


@router.get('/users', response_model=list[AdminUserResponse])
def list_admin_users(_: AdminUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    rows = db.query(AdminUser).order_by(AdminUser.created_at.desc(), AdminUser.id.desc()).all()
    return [_serialize_admin_user(row) for row in rows]


@router.post('/users', response_model=AdminUserResponse, status_code=201)
def create_admin_user(
    payload: AdminUserCreateRequest,
    _: AdminUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(AdminUser).filter(AdminUser.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail='E-mail ja esta em uso')
    admin = AdminUser(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=bool(payload.is_active),
        is_blocked=False,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _serialize_admin_user(admin)


@router.put('/users/{user_id}', response_model=AdminUserResponse)
def update_admin_user(
    user_id: int,
    payload: AdminUserUpdateRequest,
    current_admin: AdminUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    admin = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail='Usuario nao encontrado')
    existing_email = db.query(AdminUser).filter(AdminUser.email == payload.email.lower(), AdminUser.id != user_id).first()
    if existing_email:
        raise HTTPException(status_code=400, detail='E-mail ja esta em uso')
    if admin.id == current_admin.id and not bool(payload.is_active):
        raise HTTPException(status_code=400, detail='Nao e permitido desativar seu proprio usuario')
    is_removing_super_role = admin.role == 'super_admin' and payload.role != 'super_admin'
    is_disabling_last_super_admin = admin.role == 'super_admin' and not bool(payload.is_active)
    if is_removing_super_role or is_disabling_last_super_admin:
        _ensure_not_last_super_admin(db, admin, 'Nao e permitido remover o ultimo super_admin')
    admin.name = payload.name.strip()
    admin.email = payload.email.lower()
    admin.role = payload.role
    admin.is_active = bool(payload.is_active)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _serialize_admin_user(admin)


@router.patch('/users/{user_id}/password', status_code=204)
def update_admin_user_password(
    user_id: int,
    payload: AdminUserPasswordUpdateRequest,
    _: AdminUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    admin = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail='Usuario nao encontrado')
    admin.password_hash = hash_password(payload.new_password)
    db.add(admin)
    db.commit()


@router.patch('/users/{user_id}/blocked', response_model=AdminUserResponse)
def set_admin_user_blocked(
    user_id: int,
    is_blocked: bool,
    current_admin: AdminUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    admin = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail='Usuario nao encontrado')
    if admin.id == current_admin.id and bool(is_blocked):
        raise HTTPException(status_code=400, detail='Nao e permitido bloquear seu proprio usuario')
    if bool(is_blocked):
        _ensure_not_last_super_admin(db, admin, 'Nao e permitido bloquear o ultimo super_admin')
    admin.is_blocked = bool(is_blocked)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _serialize_admin_user(admin)


@router.delete('/users/{user_id}', status_code=204)
def delete_admin_user(
    user_id: int,
    current_admin: AdminUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    admin = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail='Usuario nao encontrado')
    if admin.id == current_admin.id:
        raise HTTPException(status_code=400, detail='Nao e permitido excluir seu proprio usuario')
    _ensure_not_last_super_admin(db, admin, 'Nao e permitido excluir o ultimo super_admin')
    db.delete(admin)
    db.commit()


@router.post('/logo/upload', response_model=LogoResponse)
def upload_logo(
    file: UploadFile = File(...),
    _: AdminUser = Depends(require_admin),
):
    url = save_logo(file)
    return LogoResponse(url=url)


@router.get('/settings', response_model=StoreSettingsResponse)
def read_store_settings(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    return StoreSettingsResponse(
        whatsapp_number=settings.whatsapp_number,
        pix_key=settings.pix_key,
    )


@router.put('/settings', response_model=StoreSettingsResponse)
def save_store_settings(
    payload: StoreSettingsUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = update_store_settings(db, payload.whatsapp_number, payload.pix_key)
    return StoreSettingsResponse(
        whatsapp_number=settings.whatsapp_number,
        pix_key=settings.pix_key,
    )


@router.get('/integrations/instagram', response_model=InstagramSettingsResponse)
def read_instagram_settings(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    return InstagramSettingsResponse(
        instagram_enabled=bool(settings.instagram_enabled),
        instagram_app_id=settings.instagram_app_id,
        instagram_app_secret=settings.instagram_app_secret,
        instagram_access_token=settings.instagram_access_token,
        instagram_user_id=settings.instagram_user_id,
        instagram_page_id=settings.instagram_page_id,
        instagram_default_caption=settings.instagram_default_caption,
        instagram_default_hashtags=settings.instagram_default_hashtags,
        instagram_auto_publish_default=bool(settings.instagram_auto_publish_default),
    )


@router.put('/integrations/instagram', response_model=InstagramSettingsResponse)
def save_instagram_settings(
    payload: InstagramSettingsUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = update_instagram_settings(
        db,
        payload.instagram_enabled,
        payload.instagram_app_id,
        payload.instagram_app_secret,
        payload.instagram_access_token,
        payload.instagram_user_id,
        payload.instagram_page_id,
        payload.instagram_default_caption,
        payload.instagram_default_hashtags,
        payload.instagram_auto_publish_default,
    )
    return InstagramSettingsResponse(
        instagram_enabled=bool(settings.instagram_enabled),
        instagram_app_id=settings.instagram_app_id,
        instagram_app_secret=settings.instagram_app_secret,
        instagram_access_token=settings.instagram_access_token,
        instagram_user_id=settings.instagram_user_id,
        instagram_page_id=settings.instagram_page_id,
        instagram_default_caption=settings.instagram_default_caption,
        instagram_default_hashtags=settings.instagram_default_hashtags,
        instagram_auto_publish_default=bool(settings.instagram_auto_publish_default),
    )


@router.post('/integrations/instagram/test', response_model=InstagramConnectionTestResponse)
def instagram_test_connection(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    result = test_instagram_connection(db)
    return InstagramConnectionTestResponse(
        ok=bool(result.get('ok')),
        message=result.get('message') or '',
        account_id=result.get('account_id'),
        account_name=result.get('account_name'),
    )


@router.get('/meta-pixel/config', response_model=MetaPixelAdminConfigResponse)
def read_meta_pixel_config(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    return MetaPixelAdminConfigResponse(
        enabled=bool(settings.meta_pixel_enabled),
        pixel_id=settings.meta_pixel_pixel_id,
        auto_page_view=bool(settings.meta_pixel_auto_page_view),
        track_product_events=bool(settings.meta_pixel_track_product_events),
        track_cart_events=bool(settings.meta_pixel_track_cart_events),
        track_whatsapp_as_lead=bool(settings.meta_pixel_track_whatsapp_as_lead),
        track_order_created=bool(settings.meta_pixel_track_order_created),
        test_event_code=settings.meta_pixel_test_event_code,
        is_valid=is_meta_pixel_config_valid(settings),
    )


@router.post('/meta-pixel/config', response_model=MetaPixelAdminConfigResponse)
def save_meta_pixel_config(
    payload: MetaPixelAdminConfigUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    settings = update_meta_pixel_settings(
        db,
        payload.enabled,
        payload.pixel_id,
        payload.auto_page_view,
        payload.track_product_events,
        payload.track_cart_events,
        payload.track_whatsapp_as_lead,
        payload.track_order_created,
        payload.test_event_code,
    )
    return MetaPixelAdminConfigResponse(
        enabled=bool(settings.meta_pixel_enabled),
        pixel_id=settings.meta_pixel_pixel_id,
        auto_page_view=bool(settings.meta_pixel_auto_page_view),
        track_product_events=bool(settings.meta_pixel_track_product_events),
        track_cart_events=bool(settings.meta_pixel_track_cart_events),
        track_whatsapp_as_lead=bool(settings.meta_pixel_track_whatsapp_as_lead),
        track_order_created=bool(settings.meta_pixel_track_order_created),
        test_event_code=settings.meta_pixel_test_event_code,
        is_valid=is_meta_pixel_config_valid(settings),
    )


@router.post('/meta-pixel/config/test', response_model=MetaPixelValidationResponse)
def test_meta_pixel_config(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    if not bool(settings.meta_pixel_enabled):
        return MetaPixelValidationResponse(ok=False, message='Meta Pixel desativado. Ative para validar a integracao.')
    if not is_meta_pixel_config_valid(settings):
        return MetaPixelValidationResponse(ok=False, message='Pixel ID invalido. Informe um ID numerico valido.')
    return MetaPixelValidationResponse(
        ok=True,
        message='Configuracao valida. Use o Meta Pixel Helper no navegador para confirmar os eventos em tempo real.',
    )


@router.post('/banners/upload-image', response_model=LogoResponse)
def upload_banner_image(file: UploadFile = File(...), _: AdminUser = Depends(require_admin)):
    return LogoResponse(url=save_banner_image(file))


@router.post('/products/upload-image', response_model=LogoResponse)
def upload_product_image(file: UploadFile = File(...), _: AdminUser = Depends(require_admin)):
    return LogoResponse(url=save_product_image(file))


@router.post('/products/3d/upload-original', response_model=Product3DModelUploadResponse)
def upload_product_3d_original_file(
    file: UploadFile = File(...),
    file_name: str | None = Form(default=None),
    _: AdminUser = Depends(require_admin),
):
    url = save_original_model_file(file, preferred_name=file_name)
    return Product3DModelUploadResponse(url=url, dimensions_extracted=False)


@router.post('/products/3d/upload-preview', response_model=Product3DModelUploadResponse)
def upload_product_3d_preview_file(
    file: UploadFile = File(...),
    file_name: str | None = Form(default=None),
    _: AdminUser = Depends(require_admin),
):
    url, dimensions = save_preview_model_file(file, preferred_name=file_name)
    if not dimensions:
        return Product3DModelUploadResponse(url=url, dimensions_extracted=False)
    return Product3DModelUploadResponse(
        url=url,
        width_mm=dimensions[0],
        height_mm=dimensions[1],
        depth_mm=dimensions[2],
        dimensions_extracted=True,
    )


@router.get('/3d-models', response_model=list[Admin3DModelResponse])
def list_admin_3d_models(
    search: str | None = Query(default=None),
    product_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    allow_download: bool | None = Query(default=None),
    created_from: str | None = Query(default=None),
    created_to: str | None = Query(default=None),
    sub_item_id: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = list_all_3d_models(
        db,
        search=search,
        product_id=product_id,
        is_active=is_active,
        allow_download=allow_download,
        created_from=created_from,
        created_to=created_to,
    )
    if sub_item_id is not None:
        normalized = _normalize_sub_item_id(sub_item_id)
        rows = [row for row in rows if _normalize_sub_item_id(row.sub_item_id) == normalized]
    return [_serialize_admin_3d_model(row) for row in rows]


@router.get('/3d-models/{model_id}', response_model=Admin3DModelResponse)
def read_admin_3d_model(model_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    model = get_product_3d_model(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    return _serialize_admin_3d_model(model)


@router.post('/3d-models', response_model=Admin3DModelResponse, status_code=201)
def create_admin_3d_model(
    payload: Admin3DModelCreateRequest,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = admin_get_product_by_id(db, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    sub_item_id = _normalize_sub_item_id(payload.sub_item_id)
    _ensure_valid_model_target(product, sub_item_id)
    model = Product3DModel(
        product_id=int(payload.product_id),
        sub_item_id=sub_item_id,
        name=payload.name.strip(),
        description=(payload.description or '').strip() or None,
        original_file_url=(payload.original_file_url or '').strip() or None,
        preview_file_url=payload.preview_file_url.strip(),
        width_mm=payload.width_mm,
        height_mm=payload.height_mm,
        depth_mm=payload.depth_mm,
        dimensions_source=payload.dimensions_source,
        allow_download=bool(payload.allow_download),
        sort_order=int(payload.sort_order or 1),
        is_active=bool(payload.is_active),
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _serialize_admin_3d_model(model)


@router.put('/3d-models/{model_id}', response_model=Admin3DModelResponse)
def update_admin_3d_model(
    model_id: int,
    payload: Admin3DModelUpdateRequest,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = get_product_3d_model(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    product = admin_get_product_by_id(db, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    sub_item_id = _normalize_sub_item_id(payload.sub_item_id)
    _ensure_valid_model_target(product, sub_item_id)

    model.product_id = int(payload.product_id)
    model.sub_item_id = sub_item_id
    model.name = payload.name.strip()
    model.description = (payload.description or '').strip() or None
    model.original_file_url = (payload.original_file_url or '').strip() or None
    model.preview_file_url = payload.preview_file_url.strip()
    model.width_mm = payload.width_mm
    model.height_mm = payload.height_mm
    model.depth_mm = payload.depth_mm
    model.dimensions_source = payload.dimensions_source
    model.allow_download = bool(payload.allow_download)
    model.sort_order = int(payload.sort_order or 1)
    model.is_active = bool(payload.is_active)
    db.add(model)
    db.commit()
    db.refresh(model)
    return _serialize_admin_3d_model(model)


@router.delete('/3d-models/{model_id}', status_code=204)
def delete_admin_3d_model(model_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    model = get_product_3d_model(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    db.delete(model)
    db.commit()


@router.get('/3d-models/{model_id}/download/original')
def download_admin_3d_model_original(model_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    model = get_product_3d_model(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    path = url_to_upload_path(model.original_file_url)
    if not path:
        raise HTTPException(status_code=404, detail='Arquivo original nao encontrado')
    media_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return FileResponse(path=path, filename=path.name, media_type=media_type)


@router.get('/3d-models/{model_id}/download/preview')
def download_admin_3d_model_preview(model_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    model = get_product_3d_model(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    path = url_to_upload_path(model.preview_file_url)
    if not path:
        raise HTTPException(status_code=404, detail='Arquivo de preview nao encontrado')
    media_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return FileResponse(path=path, filename=path.name, media_type=media_type)


@router.get('/3d-models/download/all')
def download_all_admin_3d_models(
    search: str | None = Query(default=None),
    product_id: int | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    allow_download: bool | None = Query(default=None),
    created_from: str | None = Query(default=None),
    created_to: str | None = Query(default=None),
    include_preview: bool = Query(default=True),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = list_all_3d_models(
        db,
        search=search,
        product_id=product_id,
        is_active=is_active,
        allow_download=allow_download,
        created_from=created_from,
        created_to=created_to,
    )
    if not rows:
        raise HTTPException(status_code=404, detail='Nenhum modelo 3D encontrado para download.')

    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zip_out:
        for row in rows:
            product_folder = (row.product.title if row.product else f'produto_{row.product_id}').strip() or f'produto_{row.product_id}'
            safe_folder = ''.join(ch if ch.isalnum() or ch in {' ', '_', '-'} else '_' for ch in product_folder).strip().replace(' ', '_')

            original_path = url_to_upload_path(row.original_file_url)
            if original_path:
                zip_out.write(original_path, arcname=f'{safe_folder}/{original_path.name}')

            if include_preview:
                preview_path = url_to_upload_path(row.preview_file_url)
                if preview_path:
                    zip_out.write(preview_path, arcname=f'{safe_folder}/{preview_path.name}')

    memory_file.seek(0)
    file_name = f'modelos_3d_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.zip'
    headers = {'Content-Disposition': f'attachment; filename="{file_name}"'}
    return StreamingResponse(memory_file, media_type='application/zip', headers=headers)


@router.get('/products/{product_id}/3d-models', response_model=list[Product3DModelResponse])
def list_admin_product_3d_models(product_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if product_id <= 0:
        return []
    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    return [_serialize_product_3d_model(item) for item in list_product_3d_models(db, product_id)]


@router.post('/products/{product_id}/3d-models', response_model=Product3DModelResponse, status_code=201)
def create_admin_product_3d_model(
    product_id: int,
    payload: Product3DModelCreate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if product_id <= 0:
        raise HTTPException(status_code=400, detail='Publique o produto antes de cadastrar modelos 3D.')
    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    sub_item_id = _normalize_sub_item_id(payload.sub_item_id)
    _ensure_valid_model_target(product, sub_item_id)
    model = Product3DModel(
        product_id=product_id,
        sub_item_id=sub_item_id,
        name=payload.name.strip(),
        description=(payload.description or '').strip() or None,
        original_file_url=(payload.original_file_url or '').strip() or None,
        preview_file_url=payload.preview_file_url.strip(),
        width_mm=payload.width_mm,
        height_mm=payload.height_mm,
        depth_mm=payload.depth_mm,
        dimensions_source=payload.dimensions_source,
        allow_download=bool(payload.allow_download),
        sort_order=int(payload.sort_order or 1),
        is_active=bool(payload.is_active),
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _serialize_product_3d_model(model)


@router.put('/products/{product_id}/3d-models/{model_id}', response_model=Product3DModelResponse)
def update_admin_product_3d_model(
    product_id: int,
    model_id: int,
    payload: Product3DModelUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = get_product_3d_model(db, model_id)
    if not model or int(model.product_id) != int(product_id):
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    sub_item_id = _normalize_sub_item_id(payload.sub_item_id)
    _ensure_valid_model_target(product, sub_item_id)
    model.name = payload.name.strip()
    model.sub_item_id = sub_item_id
    model.description = (payload.description or '').strip() or None
    model.original_file_url = (payload.original_file_url or '').strip() or None
    model.preview_file_url = payload.preview_file_url.strip()
    model.width_mm = payload.width_mm
    model.height_mm = payload.height_mm
    model.depth_mm = payload.depth_mm
    model.dimensions_source = payload.dimensions_source
    model.allow_download = bool(payload.allow_download)
    model.sort_order = int(payload.sort_order or 1)
    model.is_active = bool(payload.is_active)
    db.add(model)
    db.commit()
    db.refresh(model)
    return _serialize_product_3d_model(model)


@router.patch('/products/{product_id}/3d-models/{model_id}/status', response_model=Product3DModelResponse)
def set_admin_product_3d_model_status(
    product_id: int,
    model_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = get_product_3d_model(db, model_id)
    if not model or int(model.product_id) != int(product_id):
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    model.is_active = bool(is_active)
    db.add(model)
    db.commit()
    db.refresh(model)
    return _serialize_product_3d_model(model)


@router.delete('/products/{product_id}/3d-models/{model_id}', status_code=204)
def delete_admin_product_3d_model(
    product_id: int,
    model_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = get_product_3d_model(db, model_id)
    if not model or int(model.product_id) != int(product_id):
        raise HTTPException(status_code=404, detail='Modelo 3D nao encontrado')
    db.delete(model)
    db.commit()


@router.get('/dashboard/summary', response_model=AdminDashboardSummary)
def dashboard_summary(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    start, end = parse_period(date_from, date_to)
    summary = analytics_summary(db, date_from=start, date_to=end)
    products_stats = analytics_products(db, date_from=start, date_to=end)
    funnel_points = analytics_funnel(db, date_from=start, date_to=end)
    return AdminDashboardSummary(
        total_products=len(admin_list_products(db)),
        total_orders=summary['total_orders'] if summary else admin_total_orders(db),
        total_sold=summary.get('estimated_total_value', 0.0),
        total_items_sold=summary.get('total_items_sold', 0),
        conversion_add_to_whatsapp=summary.get('conversion_add_to_whatsapp', 0),
        sales_series=dashboard_sales_last_days(db, date_from=start, date_to=end),
        orders_series=dashboard_orders_last_days(db, date_from=start, date_to=end),
        top_products=dashboard_top_products(db, date_from=start, date_to=end),
        order_status=dashboard_order_status(db, date_from=start, date_to=end),
        funnel=[{'label': item['step'], 'value': float(item['value'])} for item in funnel_points],
        most_viewed_products=[
            {'title': item['product_title'], 'quantity': int(item['value']), 'total_value': item.get('total_value')}
            for item in products_stats.get('most_viewed', [])
        ],
        most_added_products=[
            {'title': item['product_title'], 'quantity': int(item['value']), 'total_value': item.get('total_value')}
            for item in products_stats.get('most_added', [])
        ],
        geolocated_sessions=int(summary.get('geolocated_sessions', 0) or 0),
        top_countries=summary.get('top_countries', []),
        top_states=summary.get('top_states', []),
        top_cities=summary.get('top_cities', []),
    )


@router.get('/products', response_model=list[AdminProductResponse])
def list_admin_products(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return list_admin_products_with_drafts(db)


@router.post('/products', response_model=AdminProductResponse)
def create_admin_product(payload: AdminProductCreate, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    slug = payload.slug.strip().lower()
    payload.slug = slug
    if admin_slug_exists(db, slug):
        raise HTTPException(status_code=400, detail='Slug ja esta em uso')
    payload_dict = payload.model_dump(mode='json', exclude_none=True)
    draft = save_draft(
        db,
        entity_type='product',
        action='create',
        payload=payload_dict,
    )
    products = list_admin_products_with_drafts(db)
    return next((item for item in products if int(item.get('id', 0)) == -int(draft.id)), products[0] if products else {})


@router.put('/products/{product_id}', response_model=AdminProductResponse)
def update_admin_product(
    product_id: int,
    payload: AdminProductUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = admin_get_product_by_id(db, product_id)
    slug = payload.slug.strip().lower()
    payload.slug = slug
    payload_dict = payload.model_dump(mode='json', exclude_none=True)
    if product_id < 0:
        draft = find_draft_by_id(db, abs(product_id))
        if not draft or draft.entity_type != 'product' or draft.action != 'create':
            raise HTTPException(status_code=404, detail='Rascunho de produto nao encontrado')
        if admin_slug_exists(db, slug):
            raise HTTPException(status_code=400, detail='Slug ja esta em uso')
        merged_payload = get_draft_payload(draft)
        merged_payload.update(payload_dict)
        draft.payload_json = json.dumps(merged_payload, ensure_ascii=False)
        db.add(draft)
        db.commit()
        db.refresh(draft)
        products = list_admin_products_with_drafts(db)
        return next((item for item in products if int(item.get('id', 0)) == -int(draft.id)), products[0] if products else {})

    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    if admin_slug_exists(db, slug, ignore_id=product_id):
        raise HTTPException(status_code=400, detail='Slug ja esta em uso')

    existing_draft = get_entity_draft(db, 'product', product_id)
    if existing_draft and existing_draft.action == 'update':
        merged_payload = get_draft_payload(existing_draft)
        merged_payload.update(payload_dict)
        save_draft(
            db,
            entity_type='product',
            entity_id=product_id,
            action='update',
            payload=merged_payload,
        )
    else:
        save_draft(
            db,
            entity_type='product',
            entity_id=product_id,
            action='update',
            payload=payload_dict,
        )
    products = list_admin_products_with_drafts(db)
    return next((item for item in products if int(item.get('id', 0)) == int(product_id)), products[0] if products else {})


@router.patch('/products/{product_id}/status', response_model=AdminProductResponse)
def set_product_status(
    product_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if product_id < 0:
        draft = find_draft_by_id(db, abs(product_id))
        if not draft or draft.entity_type != 'product':
            raise HTTPException(status_code=404, detail='Rascunho de produto nao encontrado')
        payload = get_draft_payload(draft)
        payload['is_active'] = bool(is_active)
        draft.payload_json = json.dumps(payload, ensure_ascii=False)
        db.add(draft)
        db.commit()
        products = list_admin_products_with_drafts(db)
        return next((item for item in products if int(item.get('id', 0)) == int(product_id)), products[0] if products else {})

    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    existing_draft = get_entity_draft(db, 'product', product_id)
    if existing_draft and existing_draft.action == 'update':
        payload = get_draft_payload(existing_draft)
    else:
        payload = serialize_product_payload_for_draft(product)
    payload['is_active'] = bool(is_active)
    save_draft(db, entity_type='product', entity_id=product_id, action='update', payload=payload)
    products = list_admin_products_with_drafts(db)
    return next((item for item in products if int(item.get('id', 0)) == int(product_id)), products[0] if products else {})


@router.post('/products/{product_id}/instagram/publish', response_model=AdminProductResponse)
def publish_product_on_instagram(
    product_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    product.publish_to_instagram = True
    db.add(product)
    db.commit()
    db.refresh(product)
    product = try_publish_product_to_instagram(db, product)
    return _serialize_product(product)


@router.get('/categories', response_model=list[AdminCategoryResponse])
def list_admin_categories(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return admin_list_categories(db)


@router.post('/categories', response_model=AdminCategoryResponse)
def create_category(payload: AdminCategoryCreate, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    slug = payload.slug.strip().lower()
    if admin_category_slug_exists(db, slug):
        raise HTTPException(status_code=400, detail='Slug de categoria ja esta em uso')
    return admin_create_category(db, payload.name.strip(), slug, bool(payload.is_active))


@router.put('/categories/{category_id}', response_model=AdminCategoryResponse)
def update_category(
    category_id: int,
    payload: AdminCategoryUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    category = admin_get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail='Categoria nao encontrada')

    slug = payload.slug.strip().lower()
    if admin_category_slug_exists(db, slug, ignore_id=category_id):
        raise HTTPException(status_code=400, detail='Slug de categoria ja esta em uso')

    return admin_update_category(db, category, payload.name.strip(), slug, bool(payload.is_active))


@router.delete('/categories/{category_id}', status_code=204)
def delete_category(category_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    category = admin_get_category_by_id(db, category_id)
    if not category:
        raise HTTPException(status_code=404, detail='Categoria nao encontrada')
    admin_delete_category(db, category)


@router.delete('/products/{product_id}', status_code=204)
def delete_product(product_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if product_id < 0:
        draft = find_draft_by_id(db, abs(product_id))
        if not draft or draft.entity_type != 'product':
            raise HTTPException(status_code=404, detail='Rascunho de produto nao encontrado')
        db.delete(draft)
        db.commit()
        return

    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')

    # Exclusao imediata do produto publicado.
    # Tambem remove rascunhos pendentes vinculados para evitar lixo e estados inconsistentes.
    (
        db.query(PublicationDraft)
        .filter(PublicationDraft.entity_type == 'product', PublicationDraft.entity_id == product_id)
        .delete(synchronize_session=False)
    )
    db.delete(product)
    db.commit()


@router.get('/reviews', response_model=AdminReviewListResponse)
def list_reviews(
    product_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias='status'),
    rating: int | None = Query(default=None, ge=1, le=5),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    reviews, total = list_admin_reviews(
        db,
        product_id=product_id,
        status=status_filter,
        rating=rating,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return AdminReviewListResponse(
        items=[_serialize_admin_review(item) for item in reviews],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch('/reviews/{review_id}/approve', response_model=AdminReviewResponse)
def approve_review(review_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    review = get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail='Avaliacao nao encontrada')
    review = set_review_status(db, review, 'approved')
    return _serialize_admin_review(review)


@router.patch('/reviews/{review_id}/reject', response_model=AdminReviewResponse)
def reject_review(review_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    review = get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail='Avaliacao nao encontrada')
    review = set_review_status(db, review, 'rejected')
    return _serialize_admin_review(review)


@router.delete('/reviews/{review_id}', status_code=204)
def remove_review(review_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    review = get_review_by_id(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail='Avaliacao nao encontrada')
    delete_review(db, review)


@router.get('/orders', response_model=list[AdminOrderResponse])
def list_admin_orders(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return [serialize_admin_order(order) for order in admin_list_orders(db)]


@router.get('/coupons', response_model=list[AdminCouponResponse])
def list_coupons(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return admin_list_coupons(db)


@router.post('/coupons', response_model=AdminCouponResponse)
def create_coupon(payload: AdminCouponCreate, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if admin_coupon_code_exists(db, payload.code):
        raise HTTPException(status_code=400, detail='Codigo de cupom ja esta em uso')
    try:
        return admin_create_coupon(
            db,
            payload.code,
            payload.type,
            payload.value,
            payload.is_active,
            payload.expires_at,
            payload.max_uses,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put('/coupons/{coupon_id}', response_model=AdminCouponResponse)
def update_coupon(
    coupon_id: int,
    payload: AdminCouponUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coupon = admin_coupon_by_id(db, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail='Cupom nao encontrado')
    if admin_coupon_code_exists(db, payload.code, ignore_id=coupon_id):
        raise HTTPException(status_code=400, detail='Codigo de cupom ja esta em uso')
    try:
        return admin_update_coupon(
            db,
            coupon,
            payload.code,
            payload.type,
            payload.value,
            payload.is_active,
            payload.expires_at,
            payload.max_uses,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch('/coupons/{coupon_id}/status', response_model=AdminCouponResponse)
def set_coupon_status(
    coupon_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coupon = admin_coupon_by_id(db, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail='Cupom nao encontrado')
    return admin_set_coupon_status(db, coupon, is_active)


@router.delete('/coupons/{coupon_id}', status_code=204)
def delete_coupon(coupon_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    coupon = admin_coupon_by_id(db, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail='Cupom nao encontrado')
    admin_delete_coupon(db, coupon)


@router.get('/promotions', response_model=list[PromotionResponse])
def list_admin_promotions(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return list_admin_promotions_with_drafts(db)


@router.post('/promotions', response_model=PromotionResponse)
def create_admin_promotion(
    payload: PromotionCreate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    draft = save_draft(db, entity_type='promotion', action='create', payload=payload.model_dump(mode='json'))
    promotions = list_admin_promotions_with_drafts(db)
    return next((item for item in promotions if int(item.get('id', 0)) == -int(draft.id)), promotions[0] if promotions else {})


@router.put('/promotions/{promotion_id}', response_model=PromotionResponse)
def update_admin_promotion(
    promotion_id: int,
    payload: PromotionUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if promotion_id < 0:
        draft = find_draft_by_id(db, abs(promotion_id))
        if not draft or draft.entity_type != 'promotion' or draft.action != 'create':
            raise HTTPException(status_code=404, detail='Rascunho de promocao nao encontrado')
        draft.payload_json = json.dumps(payload.model_dump(mode='json'), ensure_ascii=False)
        db.add(draft)
        db.commit()
        promotions = list_admin_promotions_with_drafts(db)
        return next((item for item in promotions if int(item.get('id', 0)) == int(promotion_id)), promotions[0] if promotions else {})
    promotion = get_promotion_by_id(db, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promocao nao encontrada')
    save_draft(db, entity_type='promotion', entity_id=promotion_id, action='update', payload=payload.model_dump(mode='json'))
    promotions = list_admin_promotions_with_drafts(db)
    return next((item for item in promotions if int(item.get('id', 0)) == int(promotion_id)), promotions[0] if promotions else {})


@router.patch('/promotions/{promotion_id}/toggle', response_model=PromotionResponse)
def toggle_admin_promotion(
    promotion_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if promotion_id < 0:
        draft = find_draft_by_id(db, abs(promotion_id))
        if not draft or draft.entity_type != 'promotion':
            raise HTTPException(status_code=404, detail='Rascunho de promocao nao encontrado')
        payload = get_draft_payload(draft)
        payload['is_active'] = bool(is_active)
        draft.payload_json = json.dumps(payload, ensure_ascii=False)
        db.add(draft)
        db.commit()
        promotions = list_admin_promotions_with_drafts(db)
        return next((item for item in promotions if int(item.get('id', 0)) == int(promotion_id)), promotions[0] if promotions else {})
    promotion = get_promotion_by_id(db, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promocao nao encontrada')
    payload = serialize_promotion(db, promotion)
    payload['is_active'] = bool(is_active)
    save_draft(db, entity_type='promotion', entity_id=promotion_id, action='update', payload=payload)
    promotions = list_admin_promotions_with_drafts(db)
    return next((item for item in promotions if int(item.get('id', 0)) == int(promotion_id)), promotions[0] if promotions else {})


@router.delete('/promotions/{promotion_id}', status_code=204)
def delete_admin_promotion(
    promotion_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if promotion_id < 0:
        draft = find_draft_by_id(db, abs(promotion_id))
        if not draft or draft.entity_type != 'promotion':
            raise HTTPException(status_code=404, detail='Rascunho de promocao nao encontrado')
        db.delete(draft)
        db.commit()
        return
    promotion = get_promotion_by_id(db, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promocao nao encontrada')
    save_draft(db, entity_type='promotion', entity_id=promotion_id, action='delete', payload={})


@router.get('/banners', response_model=list[BannerResponse])
def list_banners(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return list_admin_banners_with_drafts(db)


@router.post('/banners', response_model=BannerResponse)
def create_banner_endpoint(payload: BannerCreate, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    draft = save_draft(db, entity_type='banner', action='create', payload=payload.model_dump(mode='json'))
    rows = list_admin_banners_with_drafts(db)
    return next((item for item in rows if int(item.get('id', 0)) == -int(draft.id)), rows[0] if rows else {})


@router.put('/banners/{banner_id}', response_model=BannerResponse)
def update_banner_endpoint(
    banner_id: int,
    payload: BannerUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if banner_id < 0:
        draft = find_draft_by_id(db, abs(banner_id))
        if not draft or draft.entity_type != 'banner' or draft.action != 'create':
            raise HTTPException(status_code=404, detail='Rascunho de banner nao encontrado')
        draft.payload_json = json.dumps(payload.model_dump(mode='json'), ensure_ascii=False)
        db.add(draft)
        db.commit()
        rows = list_admin_banners_with_drafts(db)
        return next((item for item in rows if int(item.get('id', 0)) == int(banner_id)), rows[0] if rows else {})
    banner = get_banner(db, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail='Banner nao encontrado')
    save_draft(db, entity_type='banner', entity_id=banner_id, action='update', payload=payload.model_dump(mode='json'))
    rows = list_admin_banners_with_drafts(db)
    return next((item for item in rows if int(item.get('id', 0)) == int(banner_id)), rows[0] if rows else {})


@router.delete('/banners/{banner_id}', status_code=204)
def delete_banner_endpoint(banner_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if banner_id < 0:
        draft = find_draft_by_id(db, abs(banner_id))
        if not draft or draft.entity_type != 'banner':
            raise HTTPException(status_code=404, detail='Rascunho de banner nao encontrado')
        db.delete(draft)
        db.commit()
        return
    banner = get_banner(db, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail='Banner nao encontrado')
    save_draft(db, entity_type='banner', entity_id=banner_id, action='delete', payload={})


@router.get('/highlight-items', response_model=list[HighlightItemResponse])
def list_highlight_items(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return list_admin_highlights_with_drafts(db)


@router.post('/highlight-items', response_model=HighlightItemResponse)
def create_highlight_item_endpoint(
    payload: HighlightItemCreate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    draft = save_draft(db, entity_type='highlight', action='create', payload=payload.model_dump(mode='json'))
    rows = list_admin_highlights_with_drafts(db)
    return next((item for item in rows if int(item.get('id', 0)) == -int(draft.id)), rows[0] if rows else {})


@router.put('/highlight-items/{item_id}', response_model=HighlightItemResponse)
def update_highlight_item_endpoint(
    item_id: int,
    payload: HighlightItemUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if item_id < 0:
        draft = find_draft_by_id(db, abs(item_id))
        if not draft or draft.entity_type != 'highlight' or draft.action != 'create':
            raise HTTPException(status_code=404, detail='Rascunho de card de destaque nao encontrado')
        draft.payload_json = json.dumps(payload.model_dump(mode='json'), ensure_ascii=False)
        db.add(draft)
        db.commit()
        rows = list_admin_highlights_with_drafts(db)
        return next((item for item in rows if int(item.get('id', 0)) == int(item_id)), rows[0] if rows else {})
    item = get_highlight_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail='Card de destaque nao encontrado')
    save_draft(db, entity_type='highlight', entity_id=item_id, action='update', payload=payload.model_dump(mode='json'))
    rows = list_admin_highlights_with_drafts(db)
    return next((item for item in rows if int(item.get('id', 0)) == int(item_id)), rows[0] if rows else {})


@router.patch('/highlight-items/{item_id}/toggle', response_model=HighlightItemResponse)
def toggle_highlight_item_endpoint(
    item_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if item_id < 0:
        draft = find_draft_by_id(db, abs(item_id))
        if not draft or draft.entity_type != 'highlight':
            raise HTTPException(status_code=404, detail='Rascunho de card de destaque nao encontrado')
        payload = get_draft_payload(draft)
        payload['is_active'] = bool(is_active)
        draft.payload_json = json.dumps(payload, ensure_ascii=False)
        db.add(draft)
        db.commit()
        rows = list_admin_highlights_with_drafts(db)
        return next((item for item in rows if int(item.get('id', 0)) == int(item_id)), rows[0] if rows else {})
    item = get_highlight_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail='Card de destaque nao encontrado')
    payload = {
        'title': item.title,
        'description': item.description,
        'icon_name': item.icon_name,
        'sort_order': item.sort_order,
        'is_active': bool(is_active),
    }
    save_draft(db, entity_type='highlight', entity_id=item_id, action='update', payload=payload)
    rows = list_admin_highlights_with_drafts(db)
    return next((item for item in rows if int(item.get('id', 0)) == int(item_id)), rows[0] if rows else {})


@router.delete('/highlight-items/{item_id}', status_code=204)
def delete_highlight_item_endpoint(
    item_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if item_id < 0:
        draft = find_draft_by_id(db, abs(item_id))
        if not draft or draft.entity_type != 'highlight':
            raise HTTPException(status_code=404, detail='Rascunho de card de destaque nao encontrado')
        db.delete(draft)
        db.commit()
        return
    item = get_highlight_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail='Card de destaque nao encontrado')
    save_draft(db, entity_type='highlight', entity_id=item_id, action='delete', payload={})


@router.get('/publication/pending', response_model=list[PublicationPendingItemResponse])
def list_publication_pending(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return get_pending_publication_items(db)


@router.get('/publication/preview-data')
def get_publication_preview_data(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return {
        'products': build_preview_products(db),
        'banners': build_preview_banners(db),
        'highlight_items': build_preview_highlights(db),
        'promotions': build_preview_promotions(db),
    }


@router.post('/publication/publish', response_model=PublicationActionResponse)
def publish_all_publication(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    result = publish_all_drafts(db)
    return PublicationActionResponse(
        ok=bool(result.get('ok')),
        message='Publicacao concluida com sucesso.' if result.get('ok') else 'Falha na publicacao.',
        published_count=int(result.get('published_count') or 0),
        published_at=result.get('published_at'),
    )


@router.post('/publication/publish/{entity}/{entity_id}', response_model=PublicationActionResponse)
def publish_entity_publication(
    entity: str,
    entity_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ok = publish_draft_by_entity_and_id(db, entity, entity_id)
    if not ok:
        raise HTTPException(status_code=404, detail='Rascunho pendente nao encontrado para publicacao.')
    return PublicationActionResponse(ok=True, message='Publicado com sucesso.', published_count=1, published_at=datetime.utcnow().isoformat())


@router.post('/publication/discard/{entity}/{entity_id}', response_model=PublicationActionResponse)
def discard_entity_publication(
    entity: str,
    entity_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ok = discard_draft_by_entity_and_id(db, entity, entity_id)
    if not ok:
        raise HTTPException(status_code=404, detail='Rascunho pendente nao encontrado para descarte.')
    return PublicationActionResponse(ok=True, message='Rascunho descartado com sucesso.', published_count=0)


@router.get('/publication/preview/banners', response_model=list[BannerResponse])
def preview_banners(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return build_preview_banners(db)


@router.get('/publication/preview/highlight-items', response_model=list[HighlightItemResponse])
def preview_highlight_items(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return build_preview_highlights(db)


@router.get('/publication/preview/products', response_model=list[ProductResponse])
def preview_products(
    category: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return build_preview_products(db, category_slug=category)


@router.get('/publication/preview/products/{slug}', response_model=ProductResponse)
def preview_product_by_slug(slug: str, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    product = build_preview_product_by_slug(db, slug)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    return product


@router.get('/publication/preview/most-ordered', response_model=list[ProductResponse])
def preview_most_ordered_products(
    limit: int = Query(default=4, ge=1, le=12),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return build_preview_most_ordered_products(db, limit=limit)



