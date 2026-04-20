
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import create_admin_token, get_db, require_admin, verify_password
from app.models import AdminUser
from app.schemas import (
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
    AdminProductCreate,
    AdminProductResponse,
    AdminProductUpdate,
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


@router.post('/auth/login', response_model=AdminLoginResponse)
def login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.email == payload.email.lower(), AdminUser.is_active == True).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciais invalidas')

    return AdminLoginResponse(token=create_admin_token(admin.id), email=admin.email)


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
    products = admin_list_products(db)
    return [_serialize_product(product) for product in products]


@router.post('/products', response_model=AdminProductResponse)
def create_admin_product(payload: AdminProductCreate, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    slug = payload.slug.strip().lower()
    payload.slug = slug
    if admin_slug_exists(db, slug):
        raise HTTPException(status_code=400, detail='Slug ja esta em uso')

    try:
        product = admin_create_product(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _serialize_product(product)


@router.put('/products/{product_id}', response_model=AdminProductResponse)
def update_admin_product(
    product_id: int,
    payload: AdminProductUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')

    slug = payload.slug.strip().lower()
    payload.slug = slug
    if admin_slug_exists(db, slug, ignore_id=product_id):
        raise HTTPException(status_code=400, detail='Slug ja esta em uso')

    try:
        product = admin_update_product(db, product, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _serialize_product(product)


@router.patch('/products/{product_id}/status', response_model=AdminProductResponse)
def set_product_status(
    product_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')

    product = admin_set_product_status(db, product, is_active)
    return _serialize_product(product)


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
    product = admin_get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail='Produto nao encontrado')
    admin_delete_product(db, product)


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
    promotions = list_promotions(db)
    return [serialize_promotion(db, promotion) for promotion in promotions]


@router.post('/promotions', response_model=PromotionResponse)
def create_admin_promotion(
    payload: PromotionCreate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    promotion = create_promotion(db, payload)
    return serialize_promotion(db, promotion)


@router.put('/promotions/{promotion_id}', response_model=PromotionResponse)
def update_admin_promotion(
    promotion_id: int,
    payload: PromotionUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    promotion = get_promotion_by_id(db, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promocao nao encontrada')
    promotion = update_promotion(db, promotion, payload)
    return serialize_promotion(db, promotion)


@router.patch('/promotions/{promotion_id}/toggle', response_model=PromotionResponse)
def toggle_admin_promotion(
    promotion_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    promotion = get_promotion_by_id(db, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promocao nao encontrada')
    promotion = toggle_promotion(db, promotion, is_active=is_active)
    return serialize_promotion(db, promotion)


@router.delete('/promotions/{promotion_id}', status_code=204)
def delete_admin_promotion(
    promotion_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    promotion = get_promotion_by_id(db, promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail='Promocao nao encontrada')
    delete_promotion(db, promotion)


@router.get('/banners', response_model=list[BannerResponse])
def list_banners(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return list_admin_banners(db)


@router.post('/banners', response_model=BannerResponse)
def create_banner_endpoint(payload: BannerCreate, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return create_banner(db, payload)


@router.put('/banners/{banner_id}', response_model=BannerResponse)
def update_banner_endpoint(
    banner_id: int,
    payload: BannerUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    banner = get_banner(db, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail='Banner nao encontrado')
    return update_banner(db, banner, payload)


@router.delete('/banners/{banner_id}', status_code=204)
def delete_banner_endpoint(banner_id: int, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    banner = get_banner(db, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail='Banner nao encontrado')
    delete_banner(db, banner)


@router.get('/highlight-items', response_model=list[HighlightItemResponse])
def list_highlight_items(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return list_admin_highlight_items(db)


@router.post('/highlight-items', response_model=HighlightItemResponse)
def create_highlight_item_endpoint(
    payload: HighlightItemCreate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return create_highlight_item(db, payload)


@router.put('/highlight-items/{item_id}', response_model=HighlightItemResponse)
def update_highlight_item_endpoint(
    item_id: int,
    payload: HighlightItemUpdate,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    item = get_highlight_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail='Card de destaque nao encontrado')
    return update_highlight_item(db, item, payload)


@router.patch('/highlight-items/{item_id}/toggle', response_model=HighlightItemResponse)
def toggle_highlight_item_endpoint(
    item_id: int,
    is_active: bool,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    item = get_highlight_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail='Card de destaque nao encontrado')
    return set_highlight_item_status(db, item, is_active)


@router.delete('/highlight-items/{item_id}', status_code=204)
def delete_highlight_item_endpoint(
    item_id: int,
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    item = get_highlight_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail='Card de destaque nao encontrado')
    delete_highlight_item(db, item)
