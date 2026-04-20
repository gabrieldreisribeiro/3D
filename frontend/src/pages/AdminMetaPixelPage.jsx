import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import {
  fetchAdminMetaPixelConfig,
  saveAdminMetaPixelConfig,
  testAdminMetaPixelConfig,
} from '../services/api';

const initialForm = {
  enabled: false,
  pixel_id: '',
  auto_page_view: true,
  track_product_events: true,
  track_cart_events: true,
  track_whatsapp_as_lead: true,
  track_order_created: true,
  test_event_code: '',
};

function AdminMetaPixelPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [runtimeStatus, setRuntimeStatus] = useState({ enabled: false, is_valid: false });
  const [testResult, setTestResult] = useState(null);

  const hasPixelId = useMemo(() => /^\d{8,32}$/.test(String(form.pixel_id || '').trim()), [form.pixel_id]);

  useEffect(() => {
    setLoading(true);
    fetchAdminMetaPixelConfig()
      .then((data) => {
        setForm({
          enabled: Boolean(data?.enabled),
          pixel_id: data?.pixel_id || '',
          auto_page_view: Boolean(data?.auto_page_view ?? true),
          track_product_events: Boolean(data?.track_product_events ?? true),
          track_cart_events: Boolean(data?.track_cart_events ?? true),
          track_whatsapp_as_lead: Boolean(data?.track_whatsapp_as_lead ?? true),
          track_order_created: Boolean(data?.track_order_created ?? true),
          test_event_code: data?.test_event_code || '',
        });
        setRuntimeStatus({
          enabled: Boolean(data?.enabled),
          is_valid: Boolean(data?.is_valid),
        });
      })
      .catch((requestError) => setSaveError(requestError.message || 'Falha ao carregar configuracoes do Meta Pixel.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    setTestResult(null);
    try {
      const result = await saveAdminMetaPixelConfig(form);
      setForm({
        enabled: Boolean(result?.enabled),
        pixel_id: result?.pixel_id || '',
        auto_page_view: Boolean(result?.auto_page_view ?? true),
        track_product_events: Boolean(result?.track_product_events ?? true),
        track_cart_events: Boolean(result?.track_cart_events ?? true),
        track_whatsapp_as_lead: Boolean(result?.track_whatsapp_as_lead ?? true),
        track_order_created: Boolean(result?.track_order_created ?? true),
        test_event_code: result?.test_event_code || '',
      });
      setRuntimeStatus({
        enabled: Boolean(result?.enabled),
        is_valid: Boolean(result?.is_valid),
      });
      setSaveMessage('Configuracao do Meta Pixel salva com sucesso.');
    } catch (submitError) {
      setSaveError(submitError.message || 'Falha ao salvar configuracao do Meta Pixel.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAdminMetaPixelConfig();
      setTestResult(result);
    } catch (requestError) {
      setTestResult({
        ok: false,
        message: requestError.message || 'Falha ao validar configuracao.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Marketing"
        title="Meta Pixel"
        subtitle="Configure o Pixel para medir PageView, funil de produto/carrinho e conversoes de WhatsApp e pedido."
      />

      <DataCard title="Configuracao de rastreamento">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando configuracoes...</div>
        ) : (
          <form className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSave}>
            <label className="md:col-span-2 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <span>Ativar Meta Pixel</span>
            </label>

            <label className="md:col-span-2 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Pixel ID</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={form.pixel_id}
                onChange={(event) => setForm((current) => ({ ...current, pixel_id: event.target.value.replace(/[^\d]/g, '') }))}
                placeholder="Ex.: 123456789012345"
              />
              {!hasPixelId && form.pixel_id ? (
                <p className="text-xs text-rose-600">Informe um Pixel ID numerico valido.</p>
              ) : null}
            </label>

            <label className="md:col-span-2 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Test Event Code (opcional)</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={form.test_event_code}
                onChange={(event) => setForm((current) => ({ ...current, test_event_code: event.target.value }))}
                placeholder="Preparado para futura evolucao com Conversions API"
              />
            </label>

            <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.auto_page_view}
                onChange={(event) => setForm((current) => ({ ...current, auto_page_view: event.target.checked }))}
              />
              <span>Enviar PageView automaticamente</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.track_product_events}
                onChange={(event) => setForm((current) => ({ ...current, track_product_events: event.target.checked }))}
              />
              <span>Enviar eventos de produto</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.track_cart_events}
                onChange={(event) => setForm((current) => ({ ...current, track_cart_events: event.target.checked }))}
              />
              <span>Enviar eventos de carrinho/checkout</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.track_whatsapp_as_lead}
                onChange={(event) => setForm((current) => ({ ...current, track_whatsapp_as_lead: event.target.checked }))}
              />
              <span>Enviar clique no WhatsApp como Lead</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={form.track_order_created}
                onChange={(event) => setForm((current) => ({ ...current, track_order_created: event.target.checked }))}
              />
              <span>Enviar pedido criado como Purchase</span>
            </label>

            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <Button className="w-full sm:w-auto" type="button" variant="secondary" loading={testing} onClick={handleTest}>
                Validar configuracao
              </Button>
              <Button className="w-full sm:w-auto" type="submit" loading={saving}>
                Salvar configuracao
              </Button>
            </div>

            {testResult ? (
              <div className="md:col-span-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <StatusBadge tone={testResult.ok ? 'success' : 'danger'}>{testResult.ok ? 'Configuracao valida' : 'Ajustes necessarios'}</StatusBadge>
                <span className="text-slate-700">{testResult.message}</span>
              </div>
            ) : null}

            {saveMessage ? <p className="md:col-span-2 text-sm text-emerald-600">{saveMessage}</p> : null}
            {saveError ? <p className="md:col-span-2 text-sm text-rose-600">{saveError}</p> : null}
          </form>
        )}
      </DataCard>

      <DataCard title="Status e validacao final">
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={runtimeStatus.enabled ? 'success' : 'warning'}>
              {runtimeStatus.enabled ? 'Integracao ativa' : 'Integracao desativada'}
            </StatusBadge>
            <StatusBadge tone={hasPixelId ? 'success' : 'warning'}>
              {hasPixelId ? 'Pixel ID preenchido' : 'Pixel ID pendente'}
            </StatusBadge>
            <StatusBadge tone={runtimeStatus.is_valid ? 'success' : 'warning'}>
              {runtimeStatus.is_valid ? 'Configuracao valida' : 'Configuracao incompleta'}
            </StatusBadge>
          </div>
          <p>Eventos previstos: PageView, ViewContent, AddToCart, InitiateCheckout, Lead e Purchase.</p>
          <p>O teste final deve ser feito no navegador com a extensao Meta Pixel Helper.</p>
          <p>Os eventos so sao enviados quando a integracao estiver ativa e com Pixel ID valido.</p>
        </div>
      </DataCard>
    </section>
  );
}

export default AdminMetaPixelPage;
