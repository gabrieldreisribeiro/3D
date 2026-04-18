import re

from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.models import AdminUser, DatabaseQueryLog

ALLOWED_READ = {'select'}
ALLOWED_MAINTENANCE = {'insert', 'update', 'delete'}
BLOCKED_KEYWORDS = {
    'drop',
    'truncate',
    'alter',
    'create',
    'grant',
    'revoke',
    'comment',
    'vacuum',
    'attach',
    'detach',
    'copy',
}


def _normalize_sql(sql: str) -> str:
    normalized = str(sql or '').strip()
    if not normalized:
        raise ValueError('SQL vazio.')
    if ';' in normalized.strip().rstrip(';'):
        raise ValueError('Apenas uma query por execucao e permitida.')
    return normalized.rstrip(';')


def _query_type(sql: str) -> str:
    token = re.split(r'\s+', sql.strip(), maxsplit=1)[0].lower()
    return token


def _validate_sql(sql: str, mode: str, confirm_mutation: bool) -> str:
    normalized = _normalize_sql(sql)
    query_type = _query_type(normalized)
    lowered = normalized.lower()

    for keyword in BLOCKED_KEYWORDS:
        if re.search(rf'\b{keyword}\b', lowered):
            raise ValueError(f'Comando bloqueado por seguranca: {keyword.upper()}')

    if mode == 'read':
        if query_type not in ALLOWED_READ:
            raise ValueError('Modo leitura permite apenas SELECT.')
    elif mode == 'maintenance':
        if query_type in ALLOWED_MAINTENANCE:
            if not confirm_mutation:
                raise ValueError('Confirme a operacao mutavel para continuar.')
        elif query_type not in ALLOWED_READ:
            raise ValueError('Modo manutencao permite apenas SELECT, INSERT, UPDATE e DELETE.')
    else:
        raise ValueError('Modo de execucao invalido.')

    return normalized


def _create_log(
    db: Session,
    *,
    admin: AdminUser,
    sql_text: str,
    mode: str,
    query_type: str,
    status: str,
    affected_rows: int = 0,
    error_message: str | None = None,
) -> DatabaseQueryLog:
    log = DatabaseQueryLog(
        admin_id=admin.id if admin else None,
        sql_text=sql_text[:10000],
        mode=mode,
        query_type=query_type,
        status=status,
        affected_rows=affected_rows,
        error_message=error_message,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def execute_controlled_query(
    db: Session,
    *,
    admin: AdminUser,
    sql: str,
    mode: str = 'read',
    confirm_mutation: bool = False,
) -> dict:
    normalized = _validate_sql(sql, mode, confirm_mutation)
    query_type = _query_type(normalized)

    try:
        statement = text(normalized)
        if query_type == 'select':
            result = db.execute(statement)
            rows = result.mappings().all()
            columns = list(result.keys())
            row_count = len(rows)
            _create_log(
                db,
                admin=admin,
                sql_text=normalized,
                mode=mode,
                query_type=query_type,
                status='success',
                affected_rows=row_count,
            )
            return {
                'ok': True,
                'mode': mode,
                'query_type': query_type,
                'columns': columns,
                'rows': [dict(row) for row in rows],
                'row_count': row_count,
                'message': f'{row_count} linha(s) retornadas.',
            }

        result = db.execute(statement)
        db.commit()
        affected_rows = int(result.rowcount or 0)
        _create_log(
            db,
            admin=admin,
            sql_text=normalized,
            mode=mode,
            query_type=query_type,
            status='success',
            affected_rows=affected_rows,
        )
        return {
            'ok': True,
            'mode': mode,
            'query_type': query_type,
            'columns': [],
            'rows': [],
            'row_count': affected_rows,
            'message': f'Query executada com sucesso. Linhas afetadas: {affected_rows}.',
        }
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        _create_log(
            db,
            admin=admin,
            sql_text=normalized,
            mode=mode,
            query_type=query_type,
            status='error',
            affected_rows=0,
            error_message=str(exc),
        )
        raise


def list_query_logs(db: Session, *, page: int = 1, page_size: int = 20) -> tuple[list[DatabaseQueryLog], int]:
    query = db.query(DatabaseQueryLog).options(joinedload(DatabaseQueryLog.admin))
    total = query.count()
    items = query.order_by(DatabaseQueryLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total
