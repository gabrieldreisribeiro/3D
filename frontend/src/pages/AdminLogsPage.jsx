import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import Table from '../components/ui/Table';
import {
  fetchAdminLogById,
  fetchAdminLogs,
  fetchAdminLogSettings,
  updateAdminLogSettings,
} from '../services/api';

const DEFAULT_FILTERS = {
  level: '',
  category: '',
  path: '',
  status_code: '',
  source_system: '',
  text: '',
  date_from: '',
  date_to: '',
};

const DEFAULT_SETTINGS = {
  logs_enabled: true,
  logs_capture_request_body: true,
  logs_capture_response_body: false,
  logs_capture_integrations: true,
  logs_capture_webhooks: true,
  logs_min_level: 'info',
};

function levelTone(level) {
  const normalized = String(level || '').toLowerCase();
  if (normalized === 'critical') return 'bg-rose-900 text-white';
  if (normalized === 'error') return 'bg-rose-100 text-rose-700';
  if (normalized === 'warning') return 'bg-amber-100 text-amber-700';
  if (normalized === 'debug') return 'bg-slate-100 text-slate-700';
  return 'bg-sky-100 text-sky-700';
}

function prettyJson(data) {
  try {
    return JSON.stringify(data || {}, null, 2);
  } catch {
    return String(data || '');
  }
}

function AdminLogsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  const loadSettings = () => {
    setSettingsLoading(true);
    fetchAdminLogSettings()
      .then((data) => {
        setSettings({
          logs_enabled: Boolean(data?.logs_enabled),
          logs_capture_request_body: Boolean(data?.logs_capture_request_body),
          logs_capture_response_body: Boolean(data?.logs_capture_response_body),
          logs_capture_integrations: Boolean(data?.logs_capture_integrations),
          logs_capture_webhooks: Boolean(data?.logs_capture_webhooks),
          logs_min_level: data?.logs_min_level || 'info',
        });
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar configuracao de logs.'))
      .finally(() => setSettingsLoading(false));
  };

  const loadLogs = () => {
    setLoading(true);
    setError('');
    fetchAdminLogs({
      page,
      page_size: pageSize,
      level: filters.level || undefined,
      category: filters.category || undefined,
      path: filters.path || undefined,
      status_code: filters.status_code ? Number(filters.status_code) : undefined,
      source_system: filters.source_system || undefined,
      text: filters.text || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    })
      .then((data) => {
        setLogs(data?.items || []);
        setTotal(Number(data?.total || 0));
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar logs.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, pageSize]);

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    setSettingsSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await updateAdminLogSettings(settings);
      setSettings({
        logs_enabled: Boolean(data?.logs_enabled),
        logs_capture_request_body: Boolean(data?.logs_capture_request_body),
        logs_capture_response_body: Boolean(data?.logs_capture_response_body),
        logs_capture_integrations: Boolean(data?.logs_capture_integrations),
        logs_capture_webhooks: Boolean(data?.logs_capture_webhooks),
        logs_min_level: data?.logs_min_level || 'info',
      });
      setMessage('Configuracao de logs salva com sucesso.');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar configuracao de logs.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleApplyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    loadLogs();
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setTimeout(() => loadLogs(), 0);
  };

  const openLogDetail = async (logId) => {
    setDetailLoading(true);
    setSelectedLog(null);
    setError('');
    try {
      const data = await fetchAdminLogById(logId);
      setSelectedLog(data || null);
    } catch (requestError) {
      setError(requestError.message || 'Falha ao carregar detalhe do log.');
    } finally {
      setDetailLoading(false);
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      setMessage('Copiado para a area de transferencia.');
    } catch {
      setError('Nao foi possivel copiar neste navegador.');
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Observabilidade"
        title="Logs do sistema"
        subtitle="Acompanhe requisicoes, erros, integracoes e eventos criticos em um unico painel."
      />

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <DataCard title="Configuracoes de captura">
        {settingsLoading ? <p className="text-sm text-slate-500">Carregando configuracoes...</p> : null}
        {!settingsLoading ? (
          <form className="grid max-w-3xl gap-4" onSubmit={handleSaveSettings}>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={settings.logs_enabled} onChange={(event) => setSettings((current) => ({ ...current, logs_enabled: event.target.checked }))} />
              Logging habilitado
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={settings.logs_capture_request_body} onChange={(event) => setSettings((current) => ({ ...current, logs_capture_request_body: event.target.checked }))} />
              Capturar body de requisicao
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={settings.logs_capture_response_body} onChange={(event) => setSettings((current) => ({ ...current, logs_capture_response_body: event.target.checked }))} />
              Capturar body de resposta
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={settings.logs_capture_integrations} onChange={(event) => setSettings((current) => ({ ...current, logs_capture_integrations: event.target.checked }))} />
              Capturar integracoes externas
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={settings.logs_capture_webhooks} onChange={(event) => setSettings((current) => ({ ...current, logs_capture_webhooks: event.target.checked }))} />
              Capturar webhooks
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Nivel minimo</span>
              <select className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm" value={settings.logs_min_level} onChange={(event) => setSettings((current) => ({ ...current, logs_min_level: event.target.value }))}>
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <div>
              <Button type="submit" loading={settingsSaving}>Salvar configuracao</Button>
            </div>
          </form>
        ) : null}
      </DataCard>

      <DataCard title="Filtros">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleApplyFilters}>
          <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder="Busca por texto" value={filters.text} onChange={(event) => setFilters((current) => ({ ...current, text: event.target.value }))} />
          <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder="Path/rota" value={filters.path} onChange={(event) => setFilters((current) => ({ ...current, path: event.target.value }))} />
          <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder="Status HTTP (ex: 500)" value={filters.status_code} onChange={(event) => setFilters((current) => ({ ...current, status_code: event.target.value.replace(/\D/g, '') }))} />
          <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" placeholder="Origem (ex: infinitepay)" value={filters.source_system} onChange={(event) => setFilters((current) => ({ ...current, source_system: event.target.value }))} />
          <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={filters.level} onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))}>
            <option value="">Nivel (todos)</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
            <option value="critical">critical</option>
          </select>
          <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
            <option value="">Categoria (todas)</option>
            <option value="http">http</option>
            <option value="auth">auth</option>
            <option value="admin_action">admin_action</option>
            <option value="integration">integration</option>
            <option value="webhook">webhook</option>
            <option value="business_event">business_event</option>
            <option value="exception">exception</option>
          </select>
          <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" type="datetime-local" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} />
          <input className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" type="datetime-local" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} />
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-2">
            <Button type="submit">Aplicar filtros</Button>
            <Button type="button" variant="secondary" onClick={handleResetFilters}>Limpar filtros</Button>
          </div>
        </form>
      </DataCard>

      <DataCard title="Eventos registrados">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando logs...</div>
        ) : (
          <Table
            columns={['Data', 'Nivel', 'Categoria', 'Acao/Rota', 'Status', 'Origem', 'Duracao', 'Detalhe']}
            rows={logs}
            empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhum log encontrado para os filtros informados.</div>}
            renderRow={(item) => (
              <tr key={item.id}>
                <td>{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${levelTone(item.level)}`}>
                    {item.level}
                  </span>
                </td>
                <td>{item.category || '-'}</td>
                <td>
                  <div className="max-w-[320px]">
                    <p className="truncate text-xs font-semibold text-slate-700">{item.action_name || '-'}</p>
                    <p className="truncate text-[11px] text-slate-500">{item.request_path || '-'}</p>
                  </div>
                </td>
                <td>{item.response_status || '-'}</td>
                <td>{item.source_system || 'internal'}</td>
                <td>{item.duration_ms != null ? `${Math.round(item.duration_ms)} ms` : '-'}</td>
                <td>
                  <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => openLogDetail(item.id)}>
                    Ver detalhe
                  </Button>
                </td>
              </tr>
            )}
          />
        )}
        <div className="admin-pagination-actions mt-3 justify-end">
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Anterior
          </Button>
          <span className="text-xs text-slate-600">Pagina {page} de {totalPages}</span>
          <Button variant="secondary" className="h-8 px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            Proxima
          </Button>
        </div>
      </DataCard>

      {(detailLoading || selectedLog) ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 md:items-center md:p-6">
          <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 md:max-w-5xl md:rounded-2xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Detalhe do log</h3>
                <p className="text-xs text-slate-500">ID #{selectedLog?.id || '-'}</p>
              </div>
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>Fechar</Button>
            </div>

            {detailLoading ? <p className="text-sm text-slate-500">Carregando detalhe...</p> : null}
            {!detailLoading && selectedLog ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><strong>Nivel:</strong> {selectedLog.level}</div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><strong>Categoria:</strong> {selectedLog.category}</div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><strong>Status:</strong> {selectedLog.response_status || '-'}</div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Request</p>
                      <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => copyText(prettyJson({
                        method: selectedLog.request_method,
                        path: selectedLog.request_path,
                        query: selectedLog.request_query,
                        headers: selectedLog.request_headers_json,
                        body: selectedLog.request_body_json,
                      }))}>
                        Copiar request
                      </Button>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">{prettyJson({
                      method: selectedLog.request_method,
                      path: selectedLog.request_path,
                      query: selectedLog.request_query,
                      headers: selectedLog.request_headers_json,
                      body: selectedLog.request_body_json,
                    })}</pre>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">Response</p>
                      <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => copyText(prettyJson({
                        status: selectedLog.response_status,
                        headers: selectedLog.response_headers_json,
                        body: selectedLog.response_body_json,
                        duration_ms: selectedLog.duration_ms,
                        response_size_bytes: selectedLog.response_size_bytes,
                      }))}>
                        Copiar response
                      </Button>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">{prettyJson({
                      status: selectedLog.response_status,
                      headers: selectedLog.response_headers_json,
                      body: selectedLog.response_body_json,
                      duration_ms: selectedLog.duration_ms,
                      response_size_bytes: selectedLog.response_size_bytes,
                    })}</pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Erro e stack trace</p>
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => copyText(selectedLog.stack_trace || selectedLog.error_message || '')}>
                      Copiar stack trace
                    </Button>
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">{selectedLog.stack_trace || selectedLog.error_message || 'Sem erro registrado.'}</pre>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">Metadata</p>
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => copyText(prettyJson(selectedLog.metadata_json))}>
                      Copiar JSON
                    </Button>
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700">{prettyJson(selectedLog.metadata_json)}</pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AdminLogsPage;
