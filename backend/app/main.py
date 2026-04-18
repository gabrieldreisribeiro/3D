import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOADS_DIR, ensure_upload_dirs
from app.db.init_db import init_db
from app.routes import admin, admin_database, coupons, orders, products, public

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
app.include_router(admin.router)
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


if __name__ == '__main__':
    uvicorn.run('app.main:app', host='0.0.0.0', port=int(os.getenv('PORT', '8000')))
