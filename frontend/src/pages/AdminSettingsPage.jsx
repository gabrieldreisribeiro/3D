import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import {
  fetchAdminSettings,
  removeAdminFavicon,
  resolveAssetUrl,
  updateAdminSettings,
  uploadAdminFavicon,
  uploadAdminLogo,
} from '../services/api';
import { applySiteFavicon } from '../services/faviconService';
import {
  getLogoSizeConfig,
  getLogoSizeKey,
  LOGO_SIZE_OPTIONS,
  setLogoSizeKey as persistLogoSizeKey,
} from '../services/logoSettings';

function AdminSettingsPage() {
  const context = useOutletContext();
  const logoUrl = context?.logoUrl || null;
  const setLogoUrl = context?.setLogoUrl || (() => {});
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [storeSettings, setStoreSettings] = useState({ whatsapp_number: '', pix_key: '' });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [faviconFile, setFaviconFile] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [faviconUrl, setFaviconUrl] = useState(null);
  const [faviconLoading, setFaviconLoading] = useState(false);
  const [faviconMessage, setFaviconMessage] = useState('');
  const [faviconError, setFaviconError] = useState('');

  const [localLogoSizeKey, setLocalLogoSizeKey] = useState(getLogoSizeKey());
  const logoSizeKey = context?.logoSizeKey || localLogoSizeKey;
  const setLogoSizeKey = context?.setLogoSizeKey || ((next) => {
    persistLogoSizeKey(next);
    setLocalLogoSizeKey(getLogoSizeKey());
  });

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  useEffect(() => {
    fetchAdminSettings()
      .then((data) => {
        setStoreSettings({
          whatsapp_number: data?.whatsapp_number || '',
          pix_key: data?.pix_key || '',
        });
        setFaviconUrl(resolveAssetUrl(data?.favicon_url));
      })
      .catch((requestError) => setSettingsError(requestError.message || 'Falha ao carregar configuracoes.'));
  }, []);

  useEffect(() => {
    if (!faviconFile) {
      setFaviconPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(faviconFile);
    setFaviconPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [faviconFile]);

  const previewUrl = localPreview || logoUrl;
  const logoSize = getLogoSizeConfig(logoSizeKey);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Selecione um arquivo antes de atualizar.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await uploadAdminLogo(selectedFile);
      const nextLogo = resolveAssetUrl(result?.url);
      setLogoUrl(nextLogo);
      setSelectedFile(null);
      setMessage('Logo atualizada com sucesso.');
    } catch (uploadError) {
      setError(uploadError.message || 'Falha ao atualizar logo.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeLogoSize = (nextSize) => {
    setLogoSizeKey(nextSize);
    setMessage('Tamanho da logo atualizado.');
  };

  const handleStoreSettingsSubmit = async (event) => {
    event.preventDefault();
    setSettingsLoading(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      const result = await updateAdminSettings({
        whatsapp_number: storeSettings.whatsapp_number,
        pix_key: storeSettings.pix_key,
      });
      setStoreSettings({
        whatsapp_number: result?.whatsapp_number || '',
        pix_key: result?.pix_key || '',
      });
      setSettingsMessage('Configuracoes de pagamento atualizadas.');
    } catch (submitError) {
      setSettingsError(submitError.message || 'Falha ao atualizar configuracoes.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleFaviconUpload = async (event) => {
    event.preventDefault();
    if (!faviconFile) {
      setFaviconError('Selecione um favicon antes de salvar.');
      return;
    }
    setFaviconLoading(true);
    setFaviconError('');
    setFaviconMessage('');
    try {
      const result = await uploadAdminFavicon(faviconFile);
      const nextUrl = resolveAssetUrl(result?.url);
      setFaviconUrl(nextUrl);
      setFaviconFile(null);
      applySiteFavicon(nextUrl);
      setFaviconMessage('Favicon atualizado com sucesso.');
    } catch (uploadError) {
      setFaviconError(uploadError.message || 'Falha ao atualizar favicon.');
    } finally {
      setFaviconLoading(false);
    }
  };

  const handleFaviconRemove = async () => {
    setFaviconLoading(true);
    setFaviconError('');
    setFaviconMessage('');
    try {
      await removeAdminFavicon();
      setFaviconUrl(null);
      setFaviconFile(null);
      applySiteFavicon(null);
      setFaviconMessage('Favicon removido com sucesso.');
    } catch (removeError) {
      setFaviconError(removeError.message || 'Falha ao remover favicon.');
    } finally {
      setFaviconLoading(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader eyebrow="Configuracoes" title="Identidade visual" subtitle="Gerencie a logo principal da loja" />

      <DataCard title="Logo do site">
        <form className="flex max-w-lg flex-col gap-4" onSubmit={handleUpload}>
          <div className="flex h-44 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-auto object-contain"
                style={{ height: `${logoSize.previewHeight}px`, maxWidth: `${logoSize.previewMaxWidth}px` }}
              />
            ) : (
              <span className="text-sm text-slate-500">Sem logo</span>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tamanho da logo</span>
            <div className="flex flex-wrap gap-2">
              {LOGO_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChangeLogoSize(option.value)}
                  className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                    logoSizeKey === option.value
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">Tamanhos fixos para melhorar logos pequenas sem quebrar layout.</p>
          </div>

          <input
            className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />

          <Button className="w-full sm:w-auto" loading={loading} type="submit">
            Atualizar logo
          </Button>

          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </form>
      </DataCard>

      <DataCard title="Tema do site">
        <form className="grid max-w-lg gap-4" onSubmit={handleFaviconUpload}>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Favicon do site</span>
            <input
              className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              type="file"
              accept=".png,.ico,.svg,image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
              onChange={(event) => setFaviconFile(event.target.files?.[0] || null)}
            />
            <p className="text-xs text-slate-500">Formatos aceitos: PNG, ICO e SVG. Recomendado: 32x32 ou 64x64.</p>
          </label>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white">
              {faviconPreview || faviconUrl ? (
                <img src={faviconPreview || faviconUrl} alt="Preview favicon" className="h-8 w-8 object-contain" />
              ) : (
                <span className="text-[10px] text-slate-400">N/A</span>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-700">Preview atual</p>
              <p className="text-[11px] text-slate-500">{faviconPreview ? 'Novo arquivo selecionado' : (faviconUrl ? 'Favicon ativo' : 'Sem favicon configurado')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button className="w-full sm:w-auto" loading={faviconLoading} type="submit">
              Salvar favicon
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" loading={faviconLoading} type="button" onClick={handleFaviconRemove}>
              Remover favicon
            </Button>
          </div>

          {faviconMessage ? <p className="text-sm text-emerald-600">{faviconMessage}</p> : null}
          {faviconError ? <p className="text-sm text-rose-600">{faviconError}</p> : null}
        </form>
      </DataCard>

      <DataCard title="Pagamento e atendimento">
        <form className="grid max-w-2xl gap-4" onSubmit={handleStoreSettingsSubmit}>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">WhatsApp de atendimento</span>
            <input
              className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              type="text"
              placeholder="Ex.: 5511999999999"
              value={storeSettings.whatsapp_number}
              onChange={(event) => setStoreSettings((current) => ({ ...current, whatsapp_number: event.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Chave Pix</span>
            <input
              className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              type="text"
              placeholder="CPF, e-mail, telefone ou chave aleatoria"
              value={storeSettings.pix_key}
              onChange={(event) => setStoreSettings((current) => ({ ...current, pix_key: event.target.value }))}
            />
          </label>

          <Button className="w-full sm:w-auto" loading={settingsLoading} type="submit">
            Salvar configuracoes
          </Button>

          {settingsMessage ? <p className="text-sm text-emerald-600">{settingsMessage}</p> : null}
          {settingsError ? <p className="text-sm text-rose-600">{settingsError}</p> : null}
        </form>
      </DataCard>
    </section>
  );
}

export default AdminSettingsPage;

