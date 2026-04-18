# Banco de dados (PostgreSQL + Database Tools)

## 1) Variavel de ambiente `DATABASE_URL`

O backend agora usa `DATABASE_URL`.

Exemplos:

- Local com SQLite:
  - `DATABASE_URL=sqlite:///app.db`
- Render PostgreSQL:
  - `DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME`

Obs.: `postgres://` e `postgresql://` sao normalizados automaticamente para driver `psycopg`.

## 2) Dependencia para PostgreSQL

Ja incluida em `requirements.txt`:

- `psycopg[binary]`

## 3) Migracao de dados SQLite -> PostgreSQL

Script:

- `backend/scripts/migrate_sqlite_to_postgres.py`

Passos sugeridos:

1. Suba a API apontando para PostgreSQL (para criar schema com `init_db`/models).
2. Rode o script de migracao:

```powershell
cd backend
$env:SOURCE_SQLITE_URL="sqlite:///app.db"
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME"
python scripts/migrate_sqlite_to_postgres.py
```

O script limpa e copia dados tabela por tabela no banco de destino.

## 4) Area Admin: Banco de dados

Nova rota no admin:

- `/painel-interno/banco`

Funcionalidades:

- Listagem de tabelas + contagem de registros
- Export completo:
  - schema SQL
  - data SQL
  - schema + data
- Export por tabela:
  - schema SQL
  - data SQL
  - JSON
- Executor de query controlado:
  - modo leitura: `SELECT`
  - modo manutencao: `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- Logs de execucao de query

## 5) Endpoints

- `GET /admin/database/tables`
- `GET /admin/database/export/schema`
- `GET /admin/database/export/data`
- `GET /admin/database/export/full`
- `GET /admin/database/export/table/{table_name}/schema`
- `GET /admin/database/export/table/{table_name}/data`
- `GET /admin/database/export/table/{table_name}/json`
- `POST /admin/database/query`
- `GET /admin/database/query/logs`

Todos protegidos por autenticao admin.

## 6) Seguranca aplicada no query runner

- Apenas 1 query por execucao, exceto lote de `INSERT` em modo `maintenance`
- Bloqueio de comandos perigosos:
  - `DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`, etc.
- Modo leitura aceita apenas `SELECT`
- Query mutavel exige:
  - modo `maintenance`
  - confirmacao explicita
- Todas as execucoes sao logadas na tabela:
  - `database_query_logs`

## 7) Compatibilidade SQLite + PostgreSQL

- A area de banco funciona com os dois bancos via `DATABASE_URL`.
- O executor controlado aceita lote apenas para `INSERT` no modo `maintenance`.
- Em lote de `INSERT`, o sistema aplica idempotencia por dialeto:
  - SQLite: `INSERT OR IGNORE`
  - PostgreSQL: `ON CONFLICT DO NOTHING`

