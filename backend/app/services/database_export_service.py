import json
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import MetaData, inspect, text
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateTable


def _get_inspector(db: Session):
    return inspect(db.bind)


def get_table_names(db: Session) -> list[str]:
    inspector = _get_inspector(db)
    return sorted(inspector.get_table_names())


def list_tables_with_stats(db: Session) -> list[dict]:
    inspector = _get_inspector(db)
    preparer = db.bind.dialect.identifier_preparer
    table_names = sorted(inspector.get_table_names())
    items = []
    for table_name in table_names:
        quoted_table = preparer.quote(table_name)
        row_count = int(db.execute(text(f'SELECT COUNT(*) FROM {quoted_table}')).scalar() or 0)

        updated_at = None
        columns = {column['name'] for column in inspector.get_columns(table_name)}
        if 'updated_at' in columns:
            updated_at = db.execute(text(f'SELECT MAX(updated_at) FROM {quoted_table}')).scalar()
        elif 'created_at' in columns:
            updated_at = db.execute(text(f'SELECT MAX(created_at) FROM {quoted_table}')).scalar()

        items.append({
            'name': table_name,
            'row_count': row_count,
            'updated_at': updated_at,
        })
    return items


def _literal_sql(value) -> str:
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return f"'{value.isoformat(sep=' ')}'"
    if isinstance(value, (dict, list)):
        payload = json.dumps(value, ensure_ascii=False).replace("'", "''")
        return f"'{payload}'"
    text_value = str(value).replace("'", "''")
    return f"'{text_value}'"


def _table_data_sql(db: Session, table_name: str) -> str:
    inspector = _get_inspector(db)
    if table_name not in inspector.get_table_names():
        raise ValueError('Tabela nao encontrada.')

    preparer = db.bind.dialect.identifier_preparer
    quoted_table = preparer.quote(table_name)
    columns = [column['name'] for column in inspector.get_columns(table_name)]
    quoted_columns = ', '.join(preparer.quote(column) for column in columns)

    rows = db.execute(text(f'SELECT * FROM {quoted_table}')).mappings().all()
    if not rows:
        return f'-- Tabela {table_name}: sem dados para exportar.\n'

    statements = [f'-- Dados da tabela: {table_name}']
    for row in rows:
        values = ', '.join(_literal_sql(row.get(column)) for column in columns)
        statements.append(f'INSERT INTO {quoted_table} ({quoted_columns}) VALUES ({values});')
    return '\n'.join(statements) + '\n'


def export_table_data_sql(db: Session, table_name: str) -> str:
    return _table_data_sql(db, table_name)


def export_all_data_sql(db: Session) -> str:
    parts = ['-- Export de dados SQL']
    for table_name in get_table_names(db):
        parts.append(_table_data_sql(db, table_name))
    return '\n'.join(parts)


def export_table_schema_sql(db: Session, table_name: str) -> str:
    metadata = MetaData()
    metadata.reflect(bind=db.bind, only=[table_name])
    table = metadata.tables.get(table_name)
    if table is None:
        raise ValueError('Tabela nao encontrada.')
    ddl = str(CreateTable(table).compile(dialect=db.bind.dialect)).strip()
    return f'-- Schema da tabela: {table_name}\n{ddl};\n'


def export_all_schema_sql(db: Session) -> str:
    metadata = MetaData()
    metadata.reflect(bind=db.bind)
    parts = ['-- Export de schema SQL']
    for table_name in sorted(metadata.tables.keys()):
        table = metadata.tables[table_name]
        ddl = str(CreateTable(table).compile(dialect=db.bind.dialect)).strip()
        parts.append(f'-- Tabela: {table_name}\n{ddl};')
    return '\n\n'.join(parts) + '\n'


def export_table_data_json(db: Session, table_name: str) -> str:
    inspector = _get_inspector(db)
    if table_name not in inspector.get_table_names():
        raise ValueError('Tabela nao encontrada.')
    preparer = db.bind.dialect.identifier_preparer
    quoted_table = preparer.quote(table_name)
    rows = db.execute(text(f'SELECT * FROM {quoted_table}')).mappings().all()
    return json.dumps([dict(row) for row in rows], ensure_ascii=False, default=str, indent=2)

