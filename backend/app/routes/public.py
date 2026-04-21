from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_db
from app.schemas import BannerResponse, HighlightItemResponse, LogoResponse, MetaPixelPublicConfigResponse, ProductResponse, StoreSettingsResponse
from app.services.banner_service import list_public_banners
from app.services.highlight_service import list_public_highlight_items
from app.services.logo_service import get_public_logo_url
from app.services.order_service import list_most_ordered_products
from app.services.product_service import (
    parse_colors_from_storage,
    parse_secondary_pairs_from_storage,
    parse_sub_items_from_storage,
)
from app.services.product_3d_model_service import apply_effective_product_dimensions
from app.services.settings_service import get_or_create_settings, is_meta_pixel_config_valid
from app.services.promotion_service import apply_promotion_pricing_to_products

router = APIRouter(prefix='/public', tags=['public'])


@router.get('/logo', response_model=LogoResponse)
def read_public_logo():
    return LogoResponse(url=get_public_logo_url())


@router.get('/banners', response_model=list[BannerResponse])
def read_public_banners(db: Session = Depends(get_db)):
    return list_public_banners(db)


@router.get('/settings', response_model=StoreSettingsResponse)
def read_public_settings(db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    return StoreSettingsResponse(
        whatsapp_number=settings.whatsapp_number,
        pix_key=settings.pix_key,
    )


@router.get('/meta-pixel/config', response_model=MetaPixelPublicConfigResponse)
def read_public_meta_pixel_config(db: Session = Depends(get_db)):
    settings = get_or_create_settings(db)
    pixel_id = str(settings.meta_pixel_pixel_id or '').strip()
    return MetaPixelPublicConfigResponse(
        enabled=bool(is_meta_pixel_config_valid(settings)),
        pixel_id=pixel_id or None,
        auto_page_view=bool(settings.meta_pixel_auto_page_view),
        track_product_events=bool(settings.meta_pixel_track_product_events),
        track_cart_events=bool(settings.meta_pixel_track_cart_events),
        track_whatsapp_as_lead=bool(settings.meta_pixel_track_whatsapp_as_lead),
        track_order_created=bool(settings.meta_pixel_track_order_created),
    )


@router.get('/highlight-items', response_model=list[HighlightItemResponse])
def read_public_highlight_items(db: Session = Depends(get_db)):
    return list_public_highlight_items(db)


@router.get('/most-ordered', response_model=list[ProductResponse])
def read_most_ordered_products(limit: int = Query(default=4, ge=1, le=12), db: Session = Depends(get_db)):
    products = list_most_ordered_products(db, limit=limit)
    apply_promotion_pricing_to_products(db, products)
    apply_effective_product_dimensions(products, db)
    for product in products:
        product.images = product.images.split(',') if product.images else []
        product.sub_items = parse_sub_items_from_storage(product.sub_items)
        product.available_colors = parse_colors_from_storage(product.available_colors)
        product.secondary_color_pairs = parse_secondary_pairs_from_storage(product.secondary_color_pairs, product.available_colors)
    return products
