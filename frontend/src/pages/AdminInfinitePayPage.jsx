import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import {
  fetchAdminInfinitePayConfig,
  testAdminInfinitePayConfig,
  updateAdminInfinitePayConfig,
} from '../services/api';

const INITIAL_FORM = {
  enabled: false,
  handle: '',
  redirect_url: '',
  webhook_url: '',
  default_currency: 'BRL',
  success_page_url: '',
  cancel_page_url: '',
  test_mode: false,
};

function AdminInfinitePayPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminInfinitePayConfig()
      .then((data) => {
        setForm({
          enabled: Boolean(data?.enabled),
          handle: data?.handle || '',
          redirect_url: data?.redirect_url || '',
          webhook_url: data?.webhook_url || '',
          default_currency: data?.default_currency || 'BRL',
          success_page_url: data?.success_page_url || '',
          cancel_page_url: data?.cancel_page_url || '',
          test_mode: Boolean(data?.test_mode),
        });
        setStatusText(Boolean(data?.is_ready) ? 'Pronta para uso' : 'Configuracao incompleta');
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar configuracao da InfinitePay.'))
      .finally(() => setLoading(false));
  }, []);

  const visualStatus = useMemo(() => {
    if (error) return { tone: 'text-rose-700 bg-rose-50 border-rose-200', label: 'Erro' };
    if (form.enabled && form.handle.trim() && form.redirect_url.trim()) {
      return { tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Ativa' };
    }
    if (form.enabled) return { tone: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Pendente' };
    return { tone: 'text-slate-700 bg-slate-50 border-slate-200', label: 'Desativada' };
  }, [error, form.enabled, form.handle, form.redirect_url]);

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await updateAdminInfinitePayConfig(form);
      setForm({
        enabled: Boolean(data?.enabled),
        handle: data?.handle || '',
        redirect_url: data?.redirect_url || '',
        webhook_url: data?.webhook_url || '',
        default_currency: data?.default_currency || 'BRL',
        success_page_url: data?.success_page_url || '',
        cancel_page_url: data?.cancel_page_url || '',
        test_mode: Boolean(data?.test_mode),
      });
      setStatusText(Boolean(data?.is_ready) ? 'Pronta para uso' : 'Configuracao incompleta');
      setMessage('Configuracao salva com sucesso.');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar configuracao.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage('');
    setError('');
    try {
      const result = await testAdminInfinitePayConfig();
      if (result?.ok) {
        setMessage(result.message || 'Teste concluido com sucesso.');
      } else {
        setError(result?.message || 'Teste retornou falha.');
      }
    } catch (testError) {
      setError(testError.message || 'Falha ao testar integracao.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Integracoes"
        title="InfinitePay"
        subtitle="Configure o checkout online com redirect, webhook e controle de status."
      />

      <DataCard title="Status da integracao">
        <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${visualStatus.tone}`}>
          {visualStatus.label} - {statusText || 'Sem status'}
        </div>
      </DataCard>

      <DataCard title="Configuracao da InfinitePay">
        {loading ? <p className="text-sm text-slate-500">Carregando configuracoes...</p> : null}
        {!loading ? (
          <form className="grid max-w-3xl gap-4" onSubmit={handleSave}>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => handleChange('enabled', event.target.checked)}
              />
              Integracao habilitada
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Handle</span>
              <input className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm" value={form.handle} onChange={(event) => handleChange('handle', event.target.value)} placeholder="sua_infinite_tag" />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Redirect URL</span>
              <input className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm" value={form.redirect_url} onChange={(event) => handleChange('redirect_url', event.target.value)} placeholder="https://seusite.com/pagamento/retorno" />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Webhook URL</span>
              <input className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm" value={form.webhook_url} onChange={(event) => handleChange('webhook_url', event.target.value)} placeholder="https://seusite.com/webhooks/infinitepay" />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Moeda padrao</span>
              <input className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm" value={form.default_currency} onChange={(event) => handleChange('default_currency', event.target.value.toUpperCase())} placeholder="BRL" />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Success page URL (opcional)</span>
              <input className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm" value={form.success_page_url} onChange={(event) => handleChange('success_page_url', event.target.value)} placeholder="https://seusite.com/pagamento/aprovado" />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Cancel page URL (opcional)</span>
              <input className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm" value={form.cancel_page_url} onChange={(event) => handleChange('cancel_page_url', event.target.value)} placeholder="https://seusite.com/pagamento/cancelado" />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.test_mode}
                onChange={(event) => handleChange('test_mode', event.target.checked)}
              />
              Modo de teste
            </label>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>
                Salvar configuracao
              </Button>
              <Button type="button" variant="secondary" onClick={handleTest} loading={testing}>
                Testar integracao
              </Button>
            </div>

            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        ) : null}
      </DataCard>
    </section>
  );
}

export default AdminInfinitePayPage;
