import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOADS_DIR, ensure_upload_dirs
from app.db.init_db import init_db
from app.routes import admin, admin_ads, admin_analytics, admin_database, admin_leads_conversion, coupons, events, orders, products, public
from app.services.image_storage_service import sync_existing_upload_images_to_db

ensure_upload_dirs()

app = FastAPI(title='3D Marketplace API', version='1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.mount('/uploads', StaticFiles(directory=str(UPLOADS_DIR)), name='uploads')

app.include_router(products.router)
app.include_router(coupons.router)
app.include_router(orders.router)
app.include_router(events.router)
app.include_router(admin.router)
app.include_router(admin_ads.router)
app.include_router(admin_analytics.router)
app.include_router(admin_leads_conversion.router)
app.include_router(admin_database.router)
app.include_router(public.router)


@app.get('/')
def root():
    return {'status': 'ok', 'service': '3D Marketplace API'}


@app.get('/healthz')
def healthz():
    return {'status': 'healthy'}


@app.on_event('startup')
def startup_event():
    ensure_upload_dirs()
    init_db()
    sync_result = sync_existing_upload_images_to_db()
    print(f"[startup] uploaded_images sync -> scanned={sync_result['scanned']} synced={sync_result['synced']}")


if __name__ == '__main__':
    uvicorn.run('app.main:app', host='0.0.0.0', port=int(os.getenv('PORT', '8000')))
