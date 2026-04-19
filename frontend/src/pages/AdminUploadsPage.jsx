import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import {
  downloadAdminUploadsZip,
  fetchAdminUploadFiles,
  renameAdminUploadFile,
  resolveAssetUrl,
  uploadAdminFiles,
} from '../services/api';

const folderOptions = [
  { value: 'all', label: 'Todas as pastas' },
  { value: 'products', label: 'products' },
  { value: 'banners', label: 'banners' },
  { value: 'logo', label: 'logo' },
  { value: 'reviews-images', label: 'reviews/images' },
  { value: 'reviews-videos', label: 'reviews/videos' },
];

function formatBytes(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminUploadsPage() {
  const [folder, setFolder] = useState('all');
  const [targetFolder, setTargetFolder] = useState('products');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [renameLoading, setRenameLoading] = useState({});
  const [renameDrafts, setRenameDrafts] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadFiles = (currentFolder = folder) => {
    setLoading(true);
    setError('');
    fetchAdminUploadFiles(currentFolder)
      .then((data) => setFiles(Array.isArray(data?.items) ? data.items : []))
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar arquivos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFiles(folder);
  }, [folder]);

  const grouped = useMemo(() => {
    return files.reduce((acc, item) => {
      const key = String(item.folder || 'outros');
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [files]);

  const handleUpload = async (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;

    setUploading(true);
    setError('');
    setNotice('');
    try {
      const response = await uploadAdminFiles(targetFolder, selected);
      const count = Array.isArray(response?.items) ? response.items.length : 0;
      setNotice(`${count} arquivo(s) enviado(s) para ${targetFolder}.`);
      loadFiles(folder);
    } catch (uploadError) {
      setError(uploadError.message || 'Falha ao enviar arquivos.');
    } finally {
      setUploading(false);
    }
  };

  const handleRename = async (item) => {
    const key = `${item.folder}/${item.name}`;
    const newName = String(renameDrafts[key] || '').trim();
    if (!newName) return;
    setRenameLoading((current) => ({ ...current, [key]: true }));
    setError('');
    setNotice('');
    try {
      await renameAdminUploadFile(item.folder, item.name, newName);
      setNotice(`Arquivo ${item.name} renomeado com sucesso.`);
      setRenameDrafts((current) => ({ ...current, [key]: '' }));
      loadFiles(folder);
    } catch (renameError) {
      setError(renameError.message || 'Falha ao renomear arquivo.');
    } finally {
      setRenameLoading((current) => ({ ...current, [key]: false }));
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    setError('');
    try {
      await downloadAdminUploadsZip();
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar ZIP.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Arquivos"
        title="Galeria de Uploads"
        subtitle="Visualize, envie, renomeie e baixe as imagens do sistema"
      />

      <DataCard
        title="Acoes"
        action={
          <Button variant="secondary" loading={downloading} onClick={handleDownloadAll}>
            Baixar tudo (ZIP)
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select
            label="Filtrar galeria"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            options={folderOptions}
          />
          <Select
            label="Pasta de upload"
            value={targetFolder}
            onChange={(event) => setTargetFolder(event.target.value)}
            options={folderOptions.filter((option) => option.value !== 'all')}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Upload de multiplas fotos</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleUpload}
              className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              disabled={uploading}
            />
          </label>
        </div>
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </DataCard>

      <DataCard title="Galeria">
        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Carregando arquivos...</p>
        ) : null}
        {!loading && files.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Nenhuma imagem encontrada para o filtro atual.
          </p>
        ) : null}

        {!loading
          ? Object.entries(grouped).map(([groupName, groupItems]) => (
            <div key={groupName} className="mb-5">
              <h4 className="mb-2 text-sm font-semibold text-slate-900">{groupName}</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groupItems.map((item) => {
                  const key = `${item.folder}/${item.name}`;
                  return (
                    <article key={key} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                        <img
                          src={resolveAssetUrl(item.url)}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <p className="truncate text-xs text-slate-700" title={item.name}>{item.name}</p>
                      <p className="text-[11px] text-slate-500">{formatBytes(item.size_bytes)}</p>
                      <div className="flex items-center gap-2">
                        <Input
                          value={renameDrafts[key] || ''}
                          onChange={(event) => setRenameDrafts((current) => ({ ...current, [key]: event.target.value }))}
                          placeholder="Novo nome (sem extensao)"
                          className="w-full"
                        />
                        <Button
                          variant="secondary"
                          className="h-10 px-3"
                          loading={Boolean(renameLoading[key])}
                          onClick={() => handleRename(item)}
                        >
                          Renomear
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
          : null}
      </DataCard>
    </section>
  );
}

export default AdminUploadsPage;
