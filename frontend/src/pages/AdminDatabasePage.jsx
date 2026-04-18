import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import Table from '../components/ui/Table';
import {
  downloadAdminDatabaseExport,
  executeAdminDatabaseQuery,
  fetchAdminDatabaseQueryLogs,
  fetchAdminDatabaseTables,
} from '../services/api';

function detectQueryType(sql) {
  const normalized = String(sql || '').trim().toLowerCase();
  if (!normalized) return '';
  const token = normalized.split(/\s+/)[0];
  return token;
}

function AdminDatabasePage() {
  const [tables, setTables] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [querySql, setQuerySql] = useState('SELECT * FROM products LIMIT 20');
  const [queryMode, setQueryMode] = useState('read');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState('');

  const loadTables = () => {
    setLoading(true);
    fetchAdminDatabaseTables()
      .then((data) => setTables(data.tables || []))
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar tabelas.'))
      .finally(() => setLoading(false));
  };

  const loadLogs = () => {
    setLogsLoading(true);
    fetchAdminDatabaseQueryLogs({ page: logsPage, page_size: logsPageSize })
      .then((data) => {
        setLogs(data.items || []);
        setLogsTotal(Number(data.total || 0));
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar logs.'))
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [logsPage, logsPageSize]);

  const totalRows = useMemo(
    () => tables.reduce((sum, table) => sum + Number(table.row_count || 0), 0),
    [tables]
  );

  const logsTotalPages = Math.max(1, Math.ceil(logsTotal / logsPageSize));

  const runDownload = async (path, filename, key) => {
    setError('');
    setDownloading(key);
    try {
      await downloadAdminDatabaseExport(path, filename);
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar arquivo.');
    } finally {
      setDownloading('');
    }
  };

  const handleExecuteQuery = async () => {
    setQueryError('');
    setQueryResult(null);
    const sql = String(querySql || '').trim();
    if (!sql) {
      setQueryError('Informe uma query SQL.');
      return;
    }

    const type = detectQueryType(sql);
    const isMutation = ['insert', 'update', 'delete'].includes(type);
    let confirmMutation = false;
    if (isMutation) {
      if (queryMode !== 'maintenance') {
        setQueryError('Queries de alteracao exigem modo manutencao.');
        return;
      }
      confirmMutation = window.confirm(
        'Voce esta prestes a executar uma query mutavel (INSERT/UPDATE/DELETE). Deseja continuar?'
      );
      if (!confirmMutation) return;
    }

    setQueryLoading(true);
    try {
      const result = await executeAdminDatabaseQuery({
        sql,
        mode: queryMode,
        confirm_mutation: confirmMutation,
      });
      setQueryResult(result);
      loadTables();
      loadLogs();
    } catch (requestError) {
      setQueryError(requestError.message || 'Erro ao executar query.');
    } finally {
      setQueryLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader eyebrow="Infraestrutura" title="Banco de dados" subtitle="Exportacao, inspeção e consultas administrativas" />

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <DataCard title="Resumo da base">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tabelas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tables.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Registros totais</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{totalRows}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Logs de query</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{logsTotal}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button loading={downloading === 'schema'} loadingText="Baixando..." onClick={() => runDownload('/admin/database/export/schema', 'database_schema.sql', 'schema')}>
            Baixar schema SQL
          </Button>
          <Button variant="secondary" loading={downloading === 'data'} loadingText="Baixando..." onClick={() => runDownload('/admin/database/export/data', 'database_data.sql', 'data')}>
            Baixar dados SQL
          </Button>
          <Button variant="secondary" loading={downloading === 'full'} loadingText="Baixando..." onClick={() => runDownload('/admin/database/export/full', 'database_full.sql', 'full')}>
            Baixar schema + dados
          </Button>
        </div>
      </DataCard>

      <DataCard title="Tabelas e exportacao por tabela">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando tabelas...</div>
        ) : (
          <Table
            columns={['Tabela', 'Registros', 'Ultima atualizacao', 'Acoes']}
            rows={tables}
            empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhuma tabela encontrada.</div>}
            renderRow={(table) => (
              <tr key={table.name}>
                <td>{table.name}</td>
                <td>{Number(table.row_count || 0)}</td>
                <td>{table.updated_at ? new Date(table.updated_at).toLocaleString('pt-BR') : '-'}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      loading={downloading === `${table.name}-schema`}
                      loadingText="..."
                      onClick={() =>
                        runDownload(
                          `/admin/database/export/table/${table.name}/schema`,
                          `${table.name}_schema.sql`,
                          `${table.name}-schema`
                        )
                      }
                    >
                      Schema
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      loading={downloading === `${table.name}-data`}
                      loadingText="..."
                      onClick={() =>
                        runDownload(
                          `/admin/database/export/table/${table.name}/data`,
                          `${table.name}_data.sql`,
                          `${table.name}-data`
                        )
                      }
                    >
                      Dados SQL
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      loading={downloading === `${table.name}-json`}
                      loadingText="..."
                      onClick={() =>
                        runDownload(
                          `/admin/database/export/table/${table.name}/json`,
                          `${table.name}_data.json`,
                          `${table.name}-json`
                        )
                      }
                    >
                      JSON
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </DataCard>

      <DataCard title="Executor de query (controlado)">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={queryMode}
              onChange={(event) => setQueryMode(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
            >
              <option value="read">Somente leitura (SELECT)</option>
              <option value="maintenance">Manutencao controlada (SELECT/INSERT/UPDATE/DELETE)</option>
            </select>
            <Button loading={queryLoading} loadingText="Executando..." onClick={handleExecuteQuery}>
              Executar query
            </Button>
          </div>
          <textarea
            value={querySql}
            onChange={(event) => setQuerySql(event.target.value)}
            className="min-h-40 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none focus:border-violet-300"
            spellCheck={false}
          />
          {queryError ? <p className="text-sm text-rose-600">{queryError}</p> : null}

          {queryResult ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">
                Tipo: <strong>{queryResult.query_type}</strong> | Linhas: <strong>{queryResult.row_count}</strong>
              </p>
              {queryResult.message ? <p className="text-sm text-slate-700">{queryResult.message}</p> : null}
              {queryResult.columns?.length ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {queryResult.columns.map((column) => (
                          <th key={column} className="px-2 py-2 text-left text-slate-600">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(queryResult.rows || []).slice(0, 100).map((row, rowIndex) => (
                        <tr key={`query-row-${rowIndex}`} className="border-t border-slate-100">
                          {queryResult.columns.map((column) => (
                            <td key={`${rowIndex}-${column}`} className="px-2 py-2 text-slate-700">
                              {row[column] == null ? 'NULL' : String(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DataCard>

      <DataCard title="Logs de execucao">
        {logsLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando logs...</div>
        ) : (
          <Table
            columns={['Data', 'Admin', 'Modo', 'Tipo', 'Status', 'Linhas', 'SQL']}
            rows={logs}
            empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Sem logs de query.</div>}
            renderRow={(item) => (
              <tr key={item.id}>
                <td>{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td>{item.admin_email || `#${item.admin_id || '-'}`}</td>
                <td>{item.mode}</td>
                <td>{item.query_type.toUpperCase()}</td>
                <td>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {item.status}
                  </span>
                </td>
                <td>{item.affected_rows}</td>
                <td>
                  <code className="line-clamp-2 block max-w-[420px] text-[11px] text-slate-600">{item.sql_text}</code>
                </td>
              </tr>
            )}
          />
        )}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={logsPage <= 1} onClick={() => setLogsPage((current) => Math.max(1, current - 1))}>
            Anterior
          </Button>
          <span className="text-xs text-slate-600">
            Pagina {logsPage} de {logsTotalPages}
          </span>
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage((current) => Math.min(logsTotalPages, current + 1))}>
            Proxima
          </Button>
        </div>
      </DataCard>
    </section>
  );
}

export default AdminDatabasePage;
