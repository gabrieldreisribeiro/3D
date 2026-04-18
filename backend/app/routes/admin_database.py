from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.security import get_db, require_admin
from app.models import AdminUser
from app.schemas import (
    DatabaseQueryLogsResponse,
    DatabaseQueryLogResponse,
    DatabaseQueryRequest,
    DatabaseQueryResponse,
    DatabaseTablesResponse,
)
from app.services.database_export_service import (
    export_all_data_sql,
    export_all_schema_sql,
    export_table_data_json,
    export_table_data_sql,
    export_table_schema_sql,
    get_table_names,
    list_tables_with_stats,
)
from app.services.database_query_service import execute_controlled_query, list_query_logs

router = APIRouter(prefix='/admin/database', tags=['admin-database'])


def _sql_download(filename: str, content: str) -> PlainTextResponse:
    response = PlainTextResponse(content, media_type='application/sql; charset=utf-8')
    response.headers['Content-Disposition'] = f'attachment; filename=\"{filename}\"'
    return response


def _text_download(filename: str, content: str, media_type: str = 'application/json; charset=utf-8') -> PlainTextResponse:
    response = PlainTextResponse(content, media_type=media_type)
    response.headers['Content-Disposition'] = f'attachment; filename=\"{filename}\"'
    return response


@router.get('/tables', response_model=DatabaseTablesResponse)
def list_tables(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return DatabaseTablesResponse(tables=list_tables_with_stats(db))


@router.get('/export/schema')
def download_schema(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return _sql_download('database_schema.sql', export_all_schema_sql(db))


@router.get('/export/data')
def download_data(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    return _sql_download('database_data.sql', export_all_data_sql(db))


@router.get('/export/full')
def download_schema_and_data(_: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    content = f"{export_all_schema_sql(db)}\n\n{export_all_data_sql(db)}"
    return _sql_download('database_full.sql', content)


@router.get('/export/table/{table_name}/schema')
def download_table_schema(table_name: str, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if table_name not in get_table_names(db):
        raise HTTPException(status_code=404, detail='Tabela nao encontrada')
    return _sql_download(f'{table_name}_schema.sql', export_table_schema_sql(db, table_name))


@router.get('/export/table/{table_name}/data')
def download_table_data(table_name: str, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if table_name not in get_table_names(db):
        raise HTTPException(status_code=404, detail='Tabela nao encontrada')
    return _sql_download(f'{table_name}_data.sql', export_table_data_sql(db, table_name))


@router.get('/export/table/{table_name}/json')
def download_table_json(table_name: str, _: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    if table_name not in get_table_names(db):
        raise HTTPException(status_code=404, detail='Tabela nao encontrada')
    return _text_download(f'{table_name}_data.json', export_table_data_json(db, table_name))


@router.post('/query', response_model=DatabaseQueryResponse)
def execute_query(payload: DatabaseQueryRequest, admin: AdminUser = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        result = execute_controlled_query(
            db,
            admin=admin,
            sql=payload.sql,
            mode=payload.mode,
            confirm_mutation=payload.confirm_mutation,
        )
        return DatabaseQueryResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f'Erro ao executar query: {exc}') from exc


@router.get('/query/logs', response_model=DatabaseQueryLogsResponse)
def query_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: AdminUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items, total = list_query_logs(db, page=page, page_size=page_size)
    return DatabaseQueryLogsResponse(
        items=[
            DatabaseQueryLogResponse(
                id=item.id,
                admin_id=item.admin_id,
                admin_email=item.admin.email if item.admin else None,
                sql_text=item.sql_text,
                mode=item.mode,
                query_type=item.query_type,
                status=item.status,
                affected_rows=item.affected_rows,
                error_message=item.error_message,
                created_at=item.created_at,
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
