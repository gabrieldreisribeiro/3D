import json
import os

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import UPLOADS_DIR, ensure_upload_dirs
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.routes import admin, admin_ads, admin_analytics, admin_database, admin_leads_conversion, admin_logs, admin_uploads, coupons, customer, events, orders, payments, products, public, webhooks
from app.services.image_storage_service import sync_existing_upload_images_to_db
from app.services.system_log_service import build_exception_stack, log_http_event, now_ms

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
app.include_router(payments.router)
app.include_router(events.router)
app.include_router(customer.router)
app.include_router(webhooks.router)
app.include_router(admin.router)
app.include_router(admin_ads.router)
app.include_router(admin_analytics.router)
app.include_router(admin_leads_conversion.router)
app.include_router(admin_database.router)
app.include_router(admin_logs.router)
app.include_router(admin_uploads.router)
app.include_router(public.router)


@app.middleware('http')
async def http_logging_middleware(request: Request, call_next):
    start_ms = now_ms()
    body_bytes = await request.body()
    request.scope['_cached_body'] = body_bytes

    async def receive():
        return {'type': 'http.request', 'body': body_bytes, 'more_body': False}

    request._receive = receive
    request_body = None
    content_type = str(request.headers.get('content-type') or '').lower()
    if body_bytes and 'multipart/form-data' not in content_type:
        try:
            request_body = json.loads(body_bytes.decode('utf-8', errors='ignore'))
        except Exception:  # noqa: BLE001
            request_body = body_bytes.decode('utf-8', errors='ignore')
    elif 'multipart/form-data' in content_type:
        request_body = '[BINARY_OR_MULTIPART]'

    response_status = None
    response_headers = {}
    response_body = None
    response_size_bytes = None
    try:
        response = await call_next(request)
        response_status = int(getattr(response, 'status_code', 200))
        response_headers = {k: v for k, v in response.headers.items()}
        if hasattr(response, 'body') and response.body is not None:
            raw = response.body
            response_size_bytes = len(raw)
            try:
                decoded = raw.decode('utf-8', errors='ignore')
                response_body = json.loads(decoded)
            except Exception:  # noqa: BLE001
                response_body = raw.decode('utf-8', errors='ignore')
        duration_ms = max(0.0, now_ms() - start_ms)
        db = SessionLocal()
        try:
            log_http_event(
                db,
                level='info',
                method=request.method,
                path=request.url.path,
                query=str(request.url.query or ''),
                request_headers=dict(request.headers.items()),
                request_body=request_body,
                response_status=response_status,
                response_headers=response_headers,
                response_body=response_body,
                duration_ms=duration_ms,
                response_size_bytes=response_size_bytes,
                ip_address=request.client.host if request.client else None,
                session_id=request.headers.get('x-session-id'),
                user_agent=request.headers.get('user-agent'),
            )
        except Exception:
            db.rollback()
        finally:
            db.close()
        return response
    except Exception as exc:
        duration_ms = max(0.0, now_ms() - start_ms)
        db = SessionLocal()
        try:
            log_http_event(
                db,
                level='error',
                method=request.method,
                path=request.url.path,
                query=str(request.url.query or ''),
                request_headers=dict(request.headers.items()),
                request_body=request_body,
                response_status=response_status or 500,
                response_headers=response_headers,
                response_body=response_body,
                duration_ms=duration_ms,
                response_size_bytes=response_size_bytes,
                ip_address=request.client.host if request.client else None,
                session_id=request.headers.get('x-session-id'),
                user_agent=request.headers.get('user-agent'),
                error_message=str(exc),
                stack_trace=build_exception_stack(),
            )
        except Exception:
            db.rollback()
        finally:
            db.close()
        raise


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
