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
    return normalized.rstrip(';')


def _split_sql_statements(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_quote = False
    index = 0
    while index < len(sql):
        char = sql[index]
        if char == "'":
            current.append(char)
            if in_quote and index + 1 < len(sql) and sql[index + 1] == "'":
                current.append("'")
                index += 1
            else:
                in_quote = not in_quote
            index += 1
            continue

        if char == ';' and not in_quote:
            statement = ''.join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            index += 1
            continue

        current.append(char)
        index += 1

    tail = ''.join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def _query_type(sql: str) -> str:
    token = re.split(r'\s+', sql.strip(), maxsplit=1)[0].lower()
    return token


def _validate_sql(sql: str, mode: str, confirm_mutation: bool) -> tuple[list[str], list[str]]:
    normalized = _normalize_sql(sql)
    statements = _split_sql_statements(normalized)
    if not statements:
        raise ValueError('SQL vazio.')
    query_types = [_query_type(stmt) for stmt in statements]
    lowered = normalized.lower()

    for keyword in BLOCKED_KEYWORDS:
        if re.search(rf'\b{keyword}\b', lowered):
            raise ValueError(f'Comando bloqueado por seguranca: {keyword.upper()}')

    if mode == 'read':
        if len(statements) != 1 or query_types[0] not in ALLOWED_READ:
            raise ValueError('Modo leitura permite apenas SELECT.')
    elif mode == 'maintenance':
        mutating = any(query_type in ALLOWED_MAINTENANCE for query_type in query_types)
        if mutating:
            if not confirm_mutation:
                raise ValueError('Confirme a operacao mutavel para continuar.')
        for query_type in query_types:
            if query_type not in ALLOWED_READ and query_type not in ALLOWED_MAINTENANCE:
                raise ValueError('Modo manutencao permite apenas SELECT, INSERT, UPDATE e DELETE.')

        # Lote multiplo permitido somente para INSERT.
        if len(statements) > 1 and any(query_type != 'insert' for query_type in query_types):
            raise ValueError('Lote multiplo permite apenas INSERT.')
    else:
        raise ValueError('Modo de execucao invalido.')

    return statements, query_types


def _idempotent_insert_sql(statement: str, dialect_name: str) -> str:
    lowered = statement.lower()
    if not lowered.startswith('insert'):
        return statement

    if dialect_name == 'sqlite':
        if 'insert or ignore into' in lowered:
            return statement
        return re.sub(r'^\s*insert\s+into\b', 'INSERT OR IGNORE INTO', statement, flags=re.IGNORECASE)

    if dialect_name.startswith('postgres'):
        if ' on conflict ' in lowered:
            return statement
        return f'{statement} ON CONFLICT DO NOTHING'

    return statement


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
    statements, query_types = _validate_sql(sql, mode, confirm_mutation)
    dialect_name = db.bind.dialect.name

    try:
        if len(statements) == 1 and query_types[0] == 'select':
            statement = text(statements[0])
            result = db.execute(statement)
            rows = result.mappings().all()
            columns = list(result.keys())
            row_count = len(rows)
            _create_log(
                db,
                admin=admin,
                sql_text=statements[0],
                mode=mode,
                query_type='select',
                status='success',
                affected_rows=row_count,
            )
            return {
                'ok': True,
                'mode': mode,
                'query_type': 'select',
                'columns': columns,
                'rows': [dict(row) for row in rows],
                'row_count': row_count,
                'message': f'{row_count} linha(s) retornadas.',
            }

        affected_rows = 0
        for statement_text, query_type in zip(statements, query_types):
            if query_type == 'insert':
                statement_text = _idempotent_insert_sql(statement_text, dialect_name)
            result = db.execute(text(statement_text))
            affected_rows += int(result.rowcount or 0)

        db.commit()
        response_query_type = query_types[0] if len(set(query_types)) == 1 else 'batch'
        _create_log(
            db,
            admin=admin,
            sql_text=';\n'.join(statements),
            mode=mode,
            query_type=response_query_type,
            status='success',
            affected_rows=affected_rows,
        )
        return {
            'ok': True,
            'mode': mode,
            'query_type': response_query_type,
            'columns': [],
            'rows': [],
            'row_count': affected_rows,
            'message': f'Query executada com sucesso. Linhas afetadas: {affected_rows}.',
        }
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        query_type = query_types[0] if query_types else 'unknown'
        _create_log(
            db,
            admin=admin,
            sql_text=';\n'.join(statements),
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
