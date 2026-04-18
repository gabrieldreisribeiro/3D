from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg
from psycopg import errors


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


def normalize_db_url_for_psycopg(url: str) -> str:
    value = (url or '').strip()
    if value.startswith('postgresql+psycopg://'):
        return value.replace('postgresql+psycopg://', 'postgresql://', 1)
    if value.startswith('postgres://'):
        return value.replace('postgres://', 'postgresql://', 1)
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
            statement = ''.join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            i += 1
            continue

        current.append(char)
        i += 1

    tail = ''.join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def should_ignore_error(exc: Exception) -> bool:
    return isinstance(
        exc,
        (
            errors.UniqueViolation,
            errors.DuplicateTable,
            errors.DuplicateObject,
            errors.DuplicateColumn,
            errors.DuplicateDatabase,
            errors.DuplicateFunction,
            errors.DuplicateFile,
        ),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description='Importa arquivo SQL no PostgreSQL (Render).')
    parser.add_argument('--sql-file', required=True, help='Caminho do arquivo .sql')
    parser.add_argument('--database-url', default=None, help='DATABASE_URL opcional')
    args = parser.parse_args()

    backend_dir = Path(__file__).resolve().parent.parent
    load_dotenv(backend_dir / '.env')

    sql_file = Path(args.sql_file).expanduser().resolve()
    if not sql_file.exists():
        raise FileNotFoundError(f'Arquivo SQL nao encontrado: {sql_file}')

    database_url = (args.database_url or os.getenv('DATABASE_URL') or '').strip()
    if not database_url:
        raise RuntimeError('DATABASE_URL nao definido. Configure no .env ou passe --database-url.')
    database_url = normalize_db_url_for_psycopg(database_url)

    sql_text = sql_file.read_text(encoding='utf-8')
    statements = split_sql_statements(sql_text)
    total = len(statements)

    ok = 0
    ignored = 0
    failed = 0

    print(f'Arquivo: {sql_file}')
    print(f'Statements encontrados: {total}')

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for index, statement in enumerate(statements, start=1):
                stmt_preview = statement.strip().splitlines()[0][:120]
                try:
                    cur.execute('SAVEPOINT import_stmt')
                    cur.execute(statement)
                    cur.execute('RELEASE SAVEPOINT import_stmt')
                    ok += 1
                except Exception as exc:  # noqa: BLE001
                    cur.execute('ROLLBACK TO SAVEPOINT import_stmt')
                    cur.execute('RELEASE SAVEPOINT import_stmt')
                    if should_ignore_error(exc):
                        ignored += 1
                        print(f'[IGNORADO #{index}] {type(exc).__name__}: {stmt_preview}')
                    else:
                        failed += 1
                        print(f'[FALHA #{index}] {type(exc).__name__}: {stmt_preview}')
                        print(f'  -> {exc}')

        conn.commit()

    print('\nResumo:')
    print(f'Executados com sucesso: {ok}')
    print(f'Ignorados (duplicados/existentes): {ignored}')
    print(f'Falhas: {failed}')
    return 0 if failed == 0 else 2


if __name__ == '__main__':
    raise SystemExit(main())
