from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_admin_token, get_db, require_admin, verify_password
from app.models import AdminUser
from app.schemas import (
    AdminDashboardSummary,
    AdminLoginRequest,
    AdminLoginResponse,
    AdminOrderResponse,
    AdminProductCreate,
    AdminProductResponse,
    AdminProductUpdate,
)
from app.services.order_service import admin_list_orders, admin_total_orders, admin_total_sold
from app.services.product_service import (
    admin_create_product,
    admin_get_product_by_id,
    admin_list_products,
    admin_set_product_status,
    admin_slug_exists,
    admin_update_product,
)

router = APIRouter(prefix='/admin', tags=['admin'])


def _serialize_product(product):
    product.images = product.images.split(',') if product.images else []
    return product


@router.post('/auth/login', response_model=AdminLoginResponse)
def login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(AdminUser).filter(AdminUser.email == payload.email.lower(), AdminUser.is_active == True).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciais inválidas')

    return AdminLoginResponse(token=create_admin_token(admin.id), email=admin.email)


@router.get('/dashboard/summary', response_model=AdminDashboardSummary)
def dashboard_summary(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return AdminDashboardSummary(
        total_products=len(admin_list_products(db)),
        total_orders=admin_total_orders(db),
        total_sold=admin_total_sold(db),
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
        raise HTTPException(status_code=400, detail='Slug já está em uso')

    product = admin_create_product(db, payload)
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
        raise HTTPException(status_code=404, detail='Produto não encontrado')

    slug = payload.slug.strip().lower()
    payload.slug = slug
    if admin_slug_exists(db, slug, ignore_id=product_id):
        raise HTTPException(status_code=400, detail='Slug já está em uso')

    product = admin_update_product(db, product, payload)
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
        raise HTTPException(status_code=404, detail='Produto não encontrado')

    product = admin_set_product_status(db, product, is_active)
    return _serialize_product(product)


@router.get('/orders', response_model=list[AdminOrderResponse])
def list_admin_orders(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return admin_list_orders(db)
