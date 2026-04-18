import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import {
  fetchAdminInstagramSettings,
  testAdminInstagramConnection,
  updateAdminInstagramSettings,
} from '../services/api';

const initialForm = {
  instagram_enabled: false,
  instagram_app_id: '',
  instagram_app_secret: '',
  instagram_access_token: '',
  instagram_user_id: '',
  instagram_page_id: '',
  instagram_default_caption: '',
  instagram_default_hashtags: '',
  instagram_auto_publish_default: false,
};

function AdminInstagramPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [connectionResult, setConnectionResult] = useState(null);

  const loadSettings = () => {
    setLoading(true);
    fetchAdminInstagramSettings()
      .then((data) => {
        setForm({
          instagram_enabled: Boolean(data?.instagram_enabled),
          instagram_app_id: data?.instagram_app_id || '',
          instagram_app_secret: data?.instagram_app_secret || '',
          instagram_access_token: data?.instagram_access_token || '',
          instagram_user_id: data?.instagram_user_id || '',
          instagram_page_id: data?.instagram_page_id || '',
          instagram_default_caption: data?.instagram_default_caption || '',
          instagram_default_hashtags: data?.instagram_default_hashtags || '',
          instagram_auto_publish_default: Boolean(data?.instagram_auto_publish_default),
        });
      })
      .catch((requestError) => setSaveError(requestError.message || 'Falha ao carregar configuracoes do Instagram.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const result = await updateAdminInstagramSettings(form);
      setForm({
        instagram_enabled: Boolean(result?.instagram_enabled),
        instagram_app_id: result?.instagram_app_id || '',
        instagram_app_secret: result?.instagram_app_secret || '',
        instagram_access_token: result?.instagram_access_token || '',
        instagram_user_id: result?.instagram_user_id || '',
        instagram_page_id: result?.instagram_page_id || '',
        instagram_default_caption: result?.instagram_default_caption || '',
        instagram_default_hashtags: result?.instagram_default_hashtags || '',
        instagram_auto_publish_default: Boolean(result?.instagram_auto_publish_default),
      });
      setSaveMessage('Configuracoes do Instagram salvas com sucesso.');
    } catch (submitError) {
      setSaveError(submitError.message || 'Falha ao salvar configuracoes do Instagram.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionResult(null);
    try {
      const result = await testAdminInstagramConnection();
      setConnectionResult(result);
    } catch (requestError) {
      setConnectionResult({
        ok: false,
        message: requestError.message || 'Falha ao testar conexao.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Integracoes"
        title="Instagram"
        subtitle="Conecte sua conta para publicar imagem principal + legenda de forma opcional nos produtos."
      />

      <DataCard title="Configuracao da API oficial da Meta">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando configuracoes...</div>
        ) : (
          <form className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSave}>
            <label className="md:col-span-2 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.instagram_enabled}
                onChange={(event) => setForm((current) => ({ ...current, instagram_enabled: event.target.checked }))}
              />
              <span>Ativar integracao com Instagram</span>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">App ID</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={form.instagram_app_id}
                onChange={(event) => setForm((current) => ({ ...current, instagram_app_id: event.target.value }))}
                placeholder="ID do app Meta"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">App Secret</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="password"
                value={form.instagram_app_secret}
                onChange={(event) => setForm((current) => ({ ...current, instagram_app_secret: event.target.value }))}
                placeholder="Segredo do app"
              />
            </label>

            <label className="md:col-span-2 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Access Token</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="password"
                value={form.instagram_access_token}
                onChange={(event) => setForm((current) => ({ ...current, instagram_access_token: event.target.value }))}
                placeholder="Token de acesso da API Graph"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Instagram User ID</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={form.instagram_user_id}
                onChange={(event) => setForm((current) => ({ ...current, instagram_user_id: event.target.value }))}
                placeholder="ID da conta comercial"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Page ID (opcional)</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={form.instagram_page_id}
                onChange={(event) => setForm((current) => ({ ...current, instagram_page_id: event.target.value }))}
                placeholder="ID da pagina do Facebook"
              />
            </label>

            <label className="md:col-span-2 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Legenda padrao</span>
              <textarea
                className="min-h-[90px] w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                value={form.instagram_default_caption}
                onChange={(event) => setForm((current) => ({ ...current, instagram_default_caption: event.target.value }))}
                placeholder="Texto base para postagem"
              />
            </label>

            <label className="md:col-span-2 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Hashtags padrao</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={form.instagram_default_hashtags}
                onChange={(event) => setForm((current) => ({ ...current, instagram_default_hashtags: event.target.value }))}
                placeholder="#3d #impressao3d #decoracao"
              />
            </label>

            <label className="md:col-span-2 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.instagram_auto_publish_default}
                onChange={(event) =>
                  setForm((current) => ({ ...current, instagram_auto_publish_default: event.target.checked }))
                }
              />
              <span>Marcar publicacao no Instagram por padrao ao criar produto</span>
            </label>

            <div className="md:col-span-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" loading={testing} onClick={handleTestConnection}>
                Testar conexao
              </Button>
              <Button type="submit" loading={saving}>
                Salvar configuracoes
              </Button>
            </div>

            {connectionResult ? (
              <div className="md:col-span-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <StatusBadge tone={connectionResult.ok ? 'success' : 'danger'}>
                  {connectionResult.ok ? 'Conectado' : 'Falha na conexao'}
                </StatusBadge>
                <span className="text-slate-700">{connectionResult.message}</span>
                {connectionResult.account_name ? <span className="text-slate-500">Conta: {connectionResult.account_name}</span> : null}
              </div>
            ) : null}

            {saveMessage ? <p className="md:col-span-2 text-sm text-emerald-600">{saveMessage}</p> : null}
            {saveError ? <p className="md:col-span-2 text-sm text-rose-600">{saveError}</p> : null}
          </form>
        )}
      </DataCard>
    </section>
  );
}

export default AdminInstagramPage;
