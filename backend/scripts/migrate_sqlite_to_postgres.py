import os
from typing import Any

from sqlalchemy import MetaData, create_engine, text


def normalize_database_url(url: str) -> str:
    value = str(url or '').strip()
    if value.startswith('postgres://'):
        return f"postgresql+psycopg://{value[len('postgres://'):]}"
    if value.startswith('postgresql://') and '+psycopg' not in value:
        return value.replace('postgresql://', 'postgresql+psycopg://', 1)
    return value


def chunks(items: list[dict[str, Any]], size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def main():
    source_sqlite_url = os.getenv('SOURCE_SQLITE_URL') or os.getenv('SQLITE_URL') or 'sqlite:///app.db'
    target_postgres_url = normalize_database_url(os.getenv('DATABASE_URL', ''))

    if not target_postgres_url or not target_postgres_url.startswith('postgresql'):
        raise RuntimeError('Defina DATABASE_URL apontando para PostgreSQL.')

    print(f'[INFO] Source SQLite: {source_sqlite_url}')
    print('[INFO] Target PostgreSQL: definido')

    source_engine = create_engine(source_sqlite_url)
    target_engine = create_engine(target_postgres_url, pool_pre_ping=True)

    source_meta = MetaData()
    source_meta.reflect(bind=source_engine)

    target_meta = MetaData()
    target_meta.reflect(bind=target_engine)

    with source_engine.connect() as source_conn, target_engine.begin() as target_conn:
        for source_table in source_meta.sorted_tables:
            table_name = source_table.name
            if table_name not in target_meta.tables:
                print(f'[WARN] Tabela ignorada (nao existe no destino): {table_name}')
                continue

            target_table = target_meta.tables[table_name]
            rows = source_conn.execute(source_table.select()).mappings().all()
            if not rows:
                print(f'[INFO] {table_name}: sem registros')
                continue

            try:
                target_conn.execute(text(f'TRUNCATE TABLE \"{table_name}\" RESTART IDENTITY CASCADE'))
            except Exception:
                target_conn.execute(text(f'DELETE FROM \"{table_name}\"'))

            mapped_rows = []
            allowed_columns = set(target_table.columns.keys())
            for row in rows:
                mapped_rows.append({key: value for key, value in dict(row).items() if key in allowed_columns})

            for batch in chunks(mapped_rows, 1000):
                target_conn.execute(target_table.insert(), batch)
            print(f'[OK] {table_name}: {len(mapped_rows)} registro(s) migrado(s)')

    print('[DONE] Migracao concluida com sucesso.')


if __name__ == '__main__':
    main()
