from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_db, require_admin
from app.models import AdminUser
from app.schemas import (
    AnalyticsFunnelResponse,
    AnalyticsProductsResponse,
    AnalyticsSummaryResponse,
    ReportLeadsResponse,
    ReportSalesResponse,
    ReportTopProductsResponse,
)
from app.services.analytics_service import (
    analytics_funnel,
    analytics_products,
    analytics_summary,
    parse_period,
    report_leads,
    report_sales,
    report_top_products,
)

router = APIRouter(prefix='/admin', tags=['admin-analytics'])


@router.get('/analytics/summary', response_model=AnalyticsSummaryResponse)
def get_analytics_summary(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return AnalyticsSummaryResponse(**analytics_summary(db))


@router.get('/analytics/funnel', response_model=AnalyticsFunnelResponse)
def get_analytics_funnel(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return AnalyticsFunnelResponse(points=analytics_funnel(db))


@router.get('/analytics/products', response_model=AnalyticsProductsResponse)
def get_analytics_products(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    data = analytics_products(db)
    return AnalyticsProductsResponse(
        most_viewed=data['most_viewed'],
        most_added=data['most_added'],
        most_sold=data['most_sold'],
    )


@router.get('/reports/sales', response_model=ReportSalesResponse)
def get_report_sales(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    start, end = parse_period(date_from, date_to)
    return ReportSalesResponse(**report_sales(db, date_from=start, date_to=end, payment_method=payment_method))


@router.get('/reports/top-products', response_model=ReportTopProductsResponse)
def get_report_top_products(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    start, end = parse_period(date_from, date_to)
    return ReportTopProductsResponse(items=report_top_products(db, date_from=start, date_to=end, payment_method=payment_method))


@router.get('/reports/leads', response_model=ReportLeadsResponse)
def get_report_leads(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    start, end = parse_period(date_from, date_to)
    data = report_leads(db, date_from=start, date_to=end)
    return ReportLeadsResponse(
        total_leads=data['total_leads'],
        items=data['items'],
        top_products=data['top_products'],
    )
