from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_db, require_admin
from app.models import AdminUser
from app.schemas import (
    LeadsConversionAbandonmentResponse,
    LeadsConversionCtasResponse,
    LeadsConversionFunnelResponse,
    LeadsConversionLeadsResponse,
    LeadsConversionLocationsResponse,
    LeadsConversionProductsResponse,
    LeadsConversionSourcesResponse,
    LeadsConversionSummaryResponse,
)
from app.services.leads_conversion_service import (
    leads_conversion_abandonment,
    leads_conversion_ctas,
    leads_conversion_funnel,
    leads_conversion_leads,
    leads_conversion_locations,
    leads_conversion_products,
    leads_conversion_sources,
    leads_conversion_summary,
    parse_period,
)

router = APIRouter(prefix='/admin/leads-conversion', tags=['admin-leads-conversion'])


def _filters(
    date_from: str | None,
    date_to: str | None,
    category_id: int | None,
    product_id: int | None,
    source_channel: str | None,
    country: str | None,
    state: str | None,
    city: str | None,
):
    start, end = parse_period(date_from, date_to)
    return {
        'date_from': start,
        'date_to': end,
        'category_id': category_id,
        'product_id': product_id,
        'source_channel': source_channel,
        'country': country,
        'state': state,
        'city': city,
    }


@router.get('/summary', response_model=LeadsConversionSummaryResponse)
def get_summary(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return LeadsConversionSummaryResponse(**leads_conversion_summary(db, **_filters(date_from, date_to, category_id, product_id, source_channel, country, state, city)))


@router.get('/funnel', response_model=LeadsConversionFunnelResponse)
def get_funnel(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return LeadsConversionFunnelResponse(**leads_conversion_funnel(db, **_filters(date_from, date_to, category_id, product_id, source_channel, country, state, city)))


@router.get('/products', response_model=LeadsConversionProductsResponse)
def get_products(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return LeadsConversionProductsResponse(
        **leads_conversion_products(db, **_filters(date_from, date_to, category_id, product_id, source_channel, country, state, city))
    )


@router.get('/ctas', response_model=LeadsConversionCtasResponse)
def get_ctas(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return LeadsConversionCtasResponse(**leads_conversion_ctas(db, **_filters(date_from, date_to, category_id, product_id, source_channel, country, state, city)))


@router.get('/leads', response_model=LeadsConversionLeadsResponse)
def get_leads(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    lead_level: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    filters = _filters(date_from, date_to, category_id, product_id, source_channel, country, state, city)
    result = leads_conversion_leads(
        db,
        **filters,
        lead_level=lead_level,
        page=page,
        page_size=page_size,
    )
    return LeadsConversionLeadsResponse(**result)


@router.get('/sources', response_model=LeadsConversionSourcesResponse)
def get_sources(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    filters = _filters(date_from, date_to, category_id, product_id, source_channel, country, state, city)
    return LeadsConversionSourcesResponse(**leads_conversion_sources(db, **filters))


@router.get('/locations', response_model=LeadsConversionLocationsResponse)
def get_locations(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    filters = _filters(date_from, date_to, category_id, product_id, source_channel, country, state, city)
    return LeadsConversionLocationsResponse(**leads_conversion_locations(db, **filters))


@router.get('/abandonment', response_model=LeadsConversionAbandonmentResponse)
def get_abandonment(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    source_channel: str | None = Query(default=None),
    country: str | None = Query(default=None),
    state: str | None = Query(default=None),
    city: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return LeadsConversionAbandonmentResponse(
        **leads_conversion_abandonment(db, **_filters(date_from, date_to, category_id, product_id, source_channel, country, state, city))
    )
