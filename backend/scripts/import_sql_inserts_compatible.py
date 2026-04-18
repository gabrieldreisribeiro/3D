from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
from psycopg import sql


@dataclass
class ImportStats:
    inserts_seen: int = 0
    inserted: int = 0
    ignored_conflict: int = 0
    ignored_table_missing: int = 0
    ignored_parse: int = 0
    failed: int = 0


def load_dotenv(dotenv_path: Path) -> None:
    if not dotenv_path.exists():
        return
    for raw_line in dotenv_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if value and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def normalize_db_url(url: str) -> str:
    value = (url or '').strip()
    if value.startswith('postgresql+psycopg://'):
        value = value.replace('postgresql+psycopg://', 'postgresql://', 1)
    if value.startswith('postgres://'):
        value = value.replace('postgres://', 'postgresql://', 1)
    if 'dpg-' in value and '.render.com' not in value:
        value = value.replace('@dpg-', '@dpg-')  # no-op for readability
        if '@' in value:
            prefix, suffix = value.split('@', 1)
            host_and_rest = suffix
            host, rest = host_and_rest.split('/', 1)
            if '.' not in host:
                host = f'{host}.oregon-postgres.render.com'
                value = f'{prefix}@{host}/{rest}'
    if 'sslmode=' not in value and value.startswith('postgresql://'):
        sep = '&' if '?' in value else '?'
        value = f'{value}{sep}sslmode=require'
    return value


def split_sql_statements(sql_text: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single_quote = False

    i = 0
    while i < len(sql_text):
        char = sql_text[i]
        if char == "'":
            current.append(char)
            if in_single_quote and i + 1 < len(sql_text) and sql_text[i + 1] == "'":
                current.append("'")
                i += 1
            else:
                in_single_quote = not in_single_quote
            i += 1
            continue
        if char == ';' and not in_single_quote:
            stmt = ''.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
            continue
        current.append(char)
        i += 1

    tail = ''.join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def split_csv_outside_quotes(text: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    in_single_quote = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "'":
            current.append(ch)
            if in_single_quote and i + 1 < len(text) and text[i + 1] == "'":
                current.append("'")
                i += 1
            else:
                in_single_quote = not in_single_quote
            i += 1
            continue
        if ch == ',' and not in_single_quote:
            parts.append(''.join(current).strip())
            current = []
            i += 1
            continue
        current.append(ch)
        i += 1
    parts.append(''.join(current).strip())
    return parts


def parse_insert_statement(statement: str) -> tuple[str, list[str], list[Any]] | None:
    text = statement.strip()
    if not text.lower().startswith('insert into '):
        return None

    prefix_len = len('insert into ')
    after_insert = text[prefix_len:]
    open_cols = after_insert.find('(')
    values_idx = after_insert.lower().find(' values ')
    if open_cols <= 0 or values_idx <= 0:
        return None
    table_name = after_insert[:open_cols].strip().strip('"')

    cols_section = after_insert[open_cols + 1 : after_insert.find(')', open_cols)]
    columns = [c.strip().strip('"') for c in split_csv_outside_quotes(cols_section)]

    values_part = after_insert[values_idx + len(' values ') :].strip()
    if not values_part.startswith('(') or not values_part.endswith(')'):
        return None
    values_raw = values_part[1:-1]
    raw_tokens = split_csv_outside_quotes(values_raw)

    parsed_values: list[Any] = []
    for token in raw_tokens:
        t = token.strip()
        if t.upper() == 'NULL':
            parsed_values.append(None)
        elif t.startswith("'") and t.endswith("'"):
            parsed_values.append(t[1:-1].replace("''", "'"))
        else:
            try:
                if '.' in t:
                    parsed_values.append(float(t))
                else:
                    parsed_values.append(int(t))
            except Exception:
                parsed_values.append(t)

    if len(columns) != len(parsed_values):
        return None
    return table_name, columns, parsed_values


def fetch_table_columns(cur: psycopg.Cursor[Any], table: str) -> dict[str, dict[str, Any]]:
    cur.execute(
        """
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table,),
    )
    return {row[0]: {'data_type': row[1], 'max_length': row[2]} for row in cur.fetchall()}


def to_db_value(value: Any, data_type: str, max_length: int | None) -> Any:
    if value is None:
        return None
    if data_type == 'boolean' and isinstance(value, int):
        return bool(value)
    if isinstance(value, str) and isinstance(max_length, int) and max_length > 0 and len(value) > max_length:
        return value[:max_length]
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description='Importa INSERTs SQL de forma compatível com schema atual.')
    parser.add_argument('--sql-file', required=True)
    parser.add_argument('--database-url', default=None)
    args = parser.parse_args()

    backend_dir = Path(__file__).resolve().parent.parent
    load_dotenv(backend_dir / '.env')

    sql_file = Path(args.sql_file).expanduser().resolve()
    if not sql_file.exists():
        raise FileNotFoundError(f'Arquivo nao encontrado: {sql_file}')

    db_url = normalize_db_url((args.database_url or os.getenv('DATABASE_URL') or '').strip())
    if not db_url:
        raise RuntimeError('DATABASE_URL nao informado.')

    statements = split_sql_statements(sql_file.read_text(encoding='utf-8'))
    stats = ImportStats()
    table_cache: dict[str, dict[str, dict[str, Any]]] = {}

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            for stmt in statements:
                parsed = parse_insert_statement(stmt)
                if not parsed:
                    continue

                stats.inserts_seen += 1
                table, columns, values = parsed

                if table not in table_cache:
                    table_cache[table] = fetch_table_columns(cur, table)
                table_columns = table_cache[table]
                if not table_columns:
                    stats.ignored_table_missing += 1
                    continue

                filtered_cols: list[str] = []
                filtered_vals: list[Any] = []
                for col, val in zip(columns, values):
                    if col not in table_columns:
                        continue
                    col_meta = table_columns[col]
                    filtered_cols.append(col)
                    filtered_vals.append(
                        to_db_value(val, col_meta['data_type'], col_meta['max_length'])
                    )

                if not filtered_cols:
                    stats.ignored_parse += 1
                    continue

                query = sql.SQL("INSERT INTO {table} ({cols}) VALUES ({vals}) ON CONFLICT DO NOTHING").format(
                    table=sql.Identifier(table),
                    cols=sql.SQL(', ').join(sql.Identifier(c) for c in filtered_cols),
                    vals=sql.SQL(', ').join(sql.Placeholder() for _ in filtered_cols),
                )
                try:
                    cur.execute('SAVEPOINT import_row')
                    cur.execute(query, filtered_vals)
                    cur.execute('RELEASE SAVEPOINT import_row')
                    if cur.rowcount and cur.rowcount > 0:
                        stats.inserted += cur.rowcount
                    else:
                        stats.ignored_conflict += 1
                except Exception as exc:  # noqa: BLE001
                    cur.execute('ROLLBACK TO SAVEPOINT import_row')
                    cur.execute('RELEASE SAVEPOINT import_row')
                    stats.failed += 1
                    print(f'[FALHA] tabela={table} erro={type(exc).__name__} detalhe={str(exc)[:160]}')
            conn.commit()

    print('Resumo import compatível:')
    print(f'INSERTs lidos: {stats.inserts_seen}')
    print(f'Registros inseridos: {stats.inserted}')
    print(f'Ignorados por conflito: {stats.ignored_conflict}')
    print(f'Ignorados por tabela ausente: {stats.ignored_table_missing}')
    print(f'Ignorados por parse/coluna: {stats.ignored_parse}')
    print(f'Falhas: {stats.failed}')
    return 0 if stats.failed == 0 else 2


if __name__ == '__main__':
    raise SystemExit(main())
