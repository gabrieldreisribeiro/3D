from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.init_db import init_db
from app.routes import admin, coupons, orders, products

app = FastAPI(title='3D Marketplace API', version='1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(products.router)
app.include_router(coupons.router)
app.include_router(orders.router)
app.include_router(admin.router)


@app.on_event('startup')
def startup_event():
    init_db()
