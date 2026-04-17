import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import TextArea from '../components/ui/TextArea';
import usePersistentState from '../hooks/usePersistentState';
import {
  createAdminBanner,
  deleteAdminBanner,
  fetchAdminBanners,
  resolveAssetUrl,
  updateAdminBanner,
  uploadAdminBannerImage,
} from '../services/api';

const initialBannerForm = {
  title: '',
  subtitle: '',
  image_url: '',
  target_url: '',
  sort_order: 0,
  is_active: true,
  show_in_carousel: true,
};

function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = usePersistentState('modal:admin-banners:form', initialBannerForm);
  const [editingId, setEditingId] = usePersistentState('modal:admin-banners:editing-id', null);
  const [openModal, setOpenModal] = usePersistentState('modal:admin-banners:open', false);
  const [deleteTarget, setDeleteTarget] = usePersistentState('modal:admin-banners:delete-target', null);
  const [modalMode, setModalMode] = usePersistentState('modal:admin-banners:mode', 'create');

  const previewUrl = useMemo(() => resolveAssetUrl(form.image_url) || form.image_url, [form.image_url]);

  const loadBanners = () => {
    setLoading(true);
    fetchAdminBanners()
      .then(setBanners)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar banners.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const openCreate = () => {
    const shouldResetForm = editingId !== null || modalMode !== 'create';
    if (shouldResetForm) {
      setForm(initialBannerForm);
    }
    setEditingId(null);
    setError('');
    setModalMode('create');
    setOpenModal(true);
  };

  const openEdit = (banner) => {
    const sameEditingTarget = editingId === banner.id && modalMode === 'edit';
    setEditingId(banner.id);
    if (!sameEditingTarget) {
      setForm({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image_url: banner.image_url || '',
        target_url: banner.target_url || '',
        sort_order: banner.sort_order || 0,
        is_active: Boolean(banner.is_active),
        show_in_carousel: Boolean(banner.show_in_carousel),
      });
    }
    setError('');
    setModalMode('edit');
    setOpenModal(true);
  };

  const saveBanner = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      sort_order: Number(form.sort_order || 0),
      title: form.title || null,
      subtitle: form.subtitle || null,
      target_url: form.target_url || null,
    };

    try {
      if (editingId) {
        await updateAdminBanner(editingId, payload);
      } else {
        await createAdminBanner(payload);
      }
      setOpenModal(false);
      setEditingId(null);
      setModalMode('create');
      setForm(initialBannerForm);
      loadBanners();
    } catch (saveError) {
      setError(saveError.message || 'Falha ao salvar banner.');
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const response = await uploadAdminBannerImage(file);
      setForm((current) => ({ ...current, image_url: response.url || '' }));
    } catch (uploadError) {
      setError(uploadError.message || 'Falha ao enviar imagem.');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAdminBanner(deleteTarget.id);
      setDeleteTarget(null);
      loadBanners();
    } catch (deleteError) {
      setError(deleteError.message || 'Falha ao excluir banner.');
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Marketing"
        title="Banners"
        subtitle="Gerencie o carrossel da home com ordem e ativacao"
        action={<Button onClick={openCreate}>Novo banner</Button>}
      />

      <DataCard title="Lista de banners">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando banners...</div> : null}

        {!loading ? (
          <Table
            columns={['Banner', 'Ordem', 'Status', 'Carousel', 'Acoes']}
            rows={banners}
            empty={<EmptyState title="Sem banners" description="Crie um banner para alimentar o carrossel da home." />}
            renderRow={(banner) => (
              <tr key={banner.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <img className="h-14 w-24 rounded-[10px] border border-slate-200 object-cover" src={resolveAssetUrl(banner.image_url) || banner.image_url} alt={banner.title || 'Banner'} />
                    <div>
                      <strong className="block font-semibold text-slate-900">{banner.title || 'Sem titulo'}</strong>
                      <small className="text-xs text-slate-500">{banner.subtitle || 'Sem subtitulo'}</small>
                    </div>
                  </div>
                </td>
                <td>{banner.sort_order}</td>
                <td>
                  <StatusBadge tone={banner.is_active ? 'success' : 'danger'}>
                    {banner.is_active ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td>
                  <StatusBadge tone={banner.show_in_carousel ? 'info' : 'neutral'}>
                    {banner.show_in_carousel ? 'Visivel' : 'Oculto'}
                  </StatusBadge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openEdit(banner)}>
                      Editar
                    </Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(banner)}>
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />
        ) : null}
      </DataCard>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={editingId ? 'Editar banner' : 'Novo banner'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={saveBanner}>
              {editingId ? 'Salvar' : 'Criar banner'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveBanner}>
          <Input label="Titulo" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Input
            label="Ordem"
            type="number"
            value={form.sort_order}
            onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
          />
          <TextArea
            label="Subtitulo"
            className="md:col-span-2"
            rows="3"
            value={form.subtitle}
            onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
          />
          <Input
            label="URL da imagem"
            className="md:col-span-2"
            value={form.image_url}
            onChange={(event) => setForm({ ...form, image_url: event.target.value })}
            required
          />
          <Input
            label="Link de destino"
            className="md:col-span-2"
            value={form.target_url}
            onChange={(event) => setForm({ ...form, target_url: event.target.value })}
            placeholder="/cart ou https://..."
          />

          <label className="md:col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Upload de imagem</span>
            <input className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage} />
            {uploading ? <small className="text-xs text-slate-500">Enviando imagem...</small> : null}
          </label>

          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            <span>Banner ativo</span>
          </label>

          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.show_in_carousel}
              onChange={(event) => setForm({ ...form, show_in_carousel: event.target.checked })}
            />
            <span>Exibir no carrossel</span>
          </label>

          <div className="md:col-span-2 flex min-h-[180px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
            {previewUrl ? <img className="h-full max-h-[240px] w-full rounded-[10px] object-cover" src={previewUrl} alt="Preview" /> : <span className="text-sm text-slate-500">Preview do banner</span>}
          </div>

          {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar exclusao"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <p>Deseja excluir o banner selecionado? Essa acao nao pode ser desfeita.</p>
      </Modal>
    </section>
  );
}

export default AdminBannersPage;
