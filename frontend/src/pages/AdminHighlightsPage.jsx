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
import {
  createAdminHighlightItem,
  deleteAdminHighlightItem,
  fetchAdminHighlightItems,
  setAdminHighlightItemStatus,
  updateAdminHighlightItem,
} from '../services/api';
import { HIGHLIGHT_ICON_OPTIONS, renderHighlightIcon } from '../constants/highlightIcons';

const initialForm = {
  title: '',
  description: '',
  icon_name: 'badge-check',
  sort_order: 1,
  is_active: true,
};

function AdminHighlightsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(initialForm);
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeCount = useMemo(() => items.filter((item) => item.is_active).length, [items]);

  const loadItems = () => {
    setLoading(true);
    fetchAdminHighlightItems()
      .then((response) => {
        const ordered = [...(response || [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        setItems(ordered);
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar cards de destaque.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setError('');
    setSuccess('');
    setOpenModal(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      icon_name: item.icon_name || 'badge-check',
      sort_order: Number(item.sort_order || 1),
      is_active: Boolean(item.is_active),
    });
    setError('');
    setSuccess('');
    setOpenModal(true);
  };

  const saveItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        sort_order: Number(form.sort_order || 1),
        title: String(form.title || '').trim(),
        description: String(form.description || '').trim(),
        icon_name: String(form.icon_name || '').trim(),
      };
      if (editingId) {
        await updateAdminHighlightItem(editingId, payload);
      } else {
        await createAdminHighlightItem(payload);
      }
      setOpenModal(false);
      setEditingId(null);
      setForm(initialForm);
      setSuccess('Card salvo com sucesso.');
      loadItems();
    } catch (saveError) {
      setError(saveError.message || 'Falha ao salvar card de destaque.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    setError('');
    setSuccess('');
    try {
      await setAdminHighlightItemStatus(item.id, !item.is_active);
      setSuccess('Status atualizado com sucesso.');
      loadItems();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao atualizar status.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    setSuccess('');
    try {
      await deleteAdminHighlightItem(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess('Card excluido com sucesso.');
      loadItems();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao excluir card.');
    }
  };

  const previewItem = {
    ...form,
    title: String(form.title || '').trim() || 'Titulo do destaque',
    description: String(form.description || '').trim() || 'Descricao do card de destaque.',
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Conteudo"
        title="Highlights"
        subtitle="Gerencie ate 3 cards de destaque exibidos na loja."
        action={<Button onClick={openCreate}>Novo card</Button>}
      />

      <DataCard title="Cards cadastrados">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando cards...</div> : null}
        {!loading ? (
          <Table
            columns={['Ordem', 'Icone', 'Titulo', 'Status', 'Acoes']}
            rows={items}
            empty={<EmptyState title="Sem highlights" description="Crie o primeiro card de destaque." />}
            renderRow={(item) => (
              <tr key={item.id}>
                <td>{item.sort_order}</td>
                <td>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-violet-700">
                    {renderHighlightIcon(item.icon_name, 'h-4 w-4')}
                  </span>
                </td>
                <td>
                  <div>
                    <strong className="block text-sm text-slate-900">{item.title}</strong>
                    <small className="line-clamp-1 text-xs text-slate-500">{item.description}</small>
                  </div>
                </td>
                <td>
                  <StatusBadge tone={item.is_active ? 'success' : 'neutral'}>
                    {item.is_active ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openEdit(item)}>Editar</Button>
                    <Button
                      variant="ghost"
                      disabled={!item.is_active && activeCount >= 3}
                      onClick={() => toggleStatus(item)}
                    >
                      {item.is_active ? 'Inativar' : 'Ativar'}
                    </Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(item)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            )}
          />
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <StatusBadge tone={activeCount <= 3 ? 'success' : 'danger'}>{activeCount}/3 ativos</StatusBadge>
          <span>O sistema limita automaticamente no maximo 3 cards ativos.</span>
        </div>
      </DataCard>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={editingId ? 'Editar card de destaque' : 'Novo card de destaque'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveItem}>{editingId ? 'Salvar' : 'Criar card'}</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveItem}>
          <Input
            label="Titulo"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Ordem</span>
            <select
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              value={form.sort_order}
              onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>

          <TextArea
            label="Descricao"
            className="md:col-span-2"
            rows="3"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            required
          />

          <div className="space-y-1.5 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Icone</span>
            <select
              className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              value={form.icon_name}
              onChange={(event) => setForm((current) => ({ ...current, icon_name: event.target.value }))}
            >
              {HIGHLIGHT_ICON_OPTIONS.map((iconName) => (
                <option key={iconName} value={iconName}>{iconName}</option>
              ))}
            </select>
          </div>

          <label className="md:col-span-2 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            <span>Card ativo</span>
          </label>

          <div className="md:col-span-2 rounded-2xl border border-[#E4E8EF] bg-[#F6F7FB] px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Preview</p>
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E0E5ED] bg-white text-[#7A3FB0]">
              {renderHighlightIcon(previewItem.icon_name, 'h-4 w-4')}
            </div>
            <h3 className="mt-3 text-[18px] font-semibold leading-tight text-[#2A2F3A]">{previewItem.title}</h3>
            <p className="mt-2 text-[14px] leading-[1.35] text-[#535B6C]">{previewItem.description}</p>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar exclusao"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Excluir</Button>
          </>
        }
      >
        <p>Deseja excluir o card selecionado? Essa acao nao pode ser desfeita.</p>
      </Modal>

      {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </section>
  );
}

export default AdminHighlightsPage;
