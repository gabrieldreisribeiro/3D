import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import { resolveAssetUrl, uploadAdminLogo } from '../services/api';

function AdminSettingsPage() {
  const context = useOutletContext();
  const logoUrl = context?.logoUrl || null;
  const setLogoUrl = context?.setLogoUrl || (() => {});
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  return (
    <section className="admin-page-pro">
      <SectionHeader eyebrow="Configuracoes" title="Identidade visual" subtitle="Gerencie a logo principal da loja" />

      <DataCard title="Logo do site">
        <form className="form-stack" onSubmit={handleUpload}>
          <div className="logo-preview-box">
            {previewUrl ? <img src={previewUrl} alt="Preview" className="logo-preview-image" /> : <span>Sem logo</span>}
          </div>

          <input
            className="field-control"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />

          <Button loading={loading} type="submit">
            Atualizar logo
          </Button>

          {message ? <p className="form-success">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
        </form>
      </DataCard>
    </section>
  );
}

export default AdminSettingsPage;
