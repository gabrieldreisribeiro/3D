import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import { resolveAssetUrl, uploadAdminLogo } from '../services/api';
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

  return (
    <section className="space-y-6">
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

          <Button loading={loading} type="submit">
            Atualizar logo
          </Button>

          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </form>
      </DataCard>
    </section>
  );
}

export default AdminSettingsPage;
