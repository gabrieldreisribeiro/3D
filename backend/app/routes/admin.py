
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
    InstagramConnectionTestResponse,
    InstagramSettingsResponse,
    InstagramSettingsUpdate,
    LogoResponse,
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
from app.services.review_service import delete_review, get_review_by_id, list_admin_reviews, set_review_status
from app.services.settings_service import get_or_create_settings, update_instagram_settings, update_store_settings

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


@router.post('/banners/upload-image', response_model=LogoResponse)
def upload_banner_image(file: UploadFile = File(...), _: AdminUser = Depends(require_admin)):
    return LogoResponse(url=save_banner_image(file))


@router.post('/products/upload-image', response_model=LogoResponse)
def upload_product_image(file: UploadFile = File(...), _: AdminUser = Depends(require_admin)):
    return LogoResponse(url=save_product_image(file))


@router.get('/dashboard/summary', response_model=AdminDashboardSummary)
def dashboard_summary(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return AdminDashboardSummary(
        total_products=len(admin_list_products(db)),
        total_orders=admin_total_orders(db),
        total_sold=admin_total_sold(db),
        sales_series=dashboard_sales_last_days(db),
        orders_series=dashboard_orders_last_days(db),
        top_products=dashboard_top_products(db),
        order_status=dashboard_order_status(db),
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
