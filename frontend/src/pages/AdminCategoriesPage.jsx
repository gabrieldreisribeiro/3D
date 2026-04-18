import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import usePersistentState from '../hooks/usePersistentState';
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from '../services/api';

const initialForm = {
  name: '',
  slug: '',
  is_active: true,
};

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [form, setForm] = usePersistentState('modal:admin-categories:form', initialForm);
  const [openModal, setOpenModal] = usePersistentState('modal:admin-categories:open', false);
  const [editingId, setEditingId] = usePersistentState('modal:admin-categories:editing-id', null);
  const [deleteTarget, setDeleteTarget] = usePersistentState('modal:admin-categories:delete-target', null);

  const loadCategories = () => {
    setLoading(true);
    fetchAdminCategories()
      .then(setCategories)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar categorias.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    return categories.filter((category) => {
      const matchesQuery = !query
        || String(category.name || '').toLowerCase().includes(query)
        || String(category.slug || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? Boolean(category.is_active) : !category.is_active);
      return matchesQuery && matchesStatus;
    });
  }, [categories, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / itemsPerPage));
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCategories.slice(start, start + itemsPerPage);
  }, [filteredCategories, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openCreate = () => {
    setEditingId(null);
    setError('');
    setForm(initialForm);
    setOpenModal(true);
  };

  const openEdit = (category) => {
    setEditingId(category.id);
    setError('');
    setForm({
      name: category.name || '',
      slug: category.slug || '',
      is_active: Boolean(category.is_active),
    });
    setOpenModal(true);
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: String(form.name || '').trim(),
      slug: String(form.slug || '').trim().toLowerCase(),
      is_active: Boolean(form.is_active),
    };

    try {
      if (editingId) {
        await updateAdminCategory(editingId, payload);
      } else {
        await createAdminCategory(payload);
      }
      setOpenModal(false);
      setEditingId(null);
      setForm(initialForm);
      loadCategories();
    } catch (saveError) {
      setError(saveError.message || 'Falha ao salvar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAdminCategory(deleteTarget.id);
      setDeleteTarget(null);
      loadCategories();
    } catch (deleteError) {
      setError(deleteError.message || 'Falha ao excluir categoria.');
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Catalogo"
        title="Categorias"
        subtitle="Crie e organize as categorias usadas na loja e no admin"
        action={<Button onClick={openCreate}>Nova categoria</Button>}
      />

      <DataCard title="Lista de categorias">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando categorias...</div> : null}
        {!loading ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nome ou slug"
                className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              >
                <option value="all">Todos status</option>
                <option value="active">Ativas</option>
                <option value="inactive">Inativas</option>
              </select>
              <select
                value={itemsPerPage}
                onChange={(event) => setItemsPerPage(Number(event.target.value))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              >
                <option value={10}>10 / pagina</option>
                <option value={20}>20 / pagina</option>
                <option value={50}>50 / pagina</option>
              </select>
            </div>

            <Table
              columns={['Nome', 'Slug', 'Status', 'Acoes']}
              rows={paginatedCategories}
              empty={<EmptyState title="Sem categorias" description="Crie a primeira categoria." />}
              renderRow={(category) => (
                <tr key={category.id}>
                  <td><strong className="font-semibold text-slate-900">{category.name}</strong></td>
                  <td><code className="text-xs text-slate-600">{category.slug}</code></td>
                  <td>
                    <StatusBadge tone={category.is_active ? 'success' : 'danger'}>
                      {category.is_active ? 'Ativa' : 'Inativa'}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => openEdit(category)}>Editar</Button>
                      <Button variant="danger" onClick={() => setDeleteTarget(category)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              )}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                Mostrando <strong>{filteredCategories.length ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredCategories.length)}</strong> de <strong>{filteredCategories.length}</strong> categorias
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Anterior</Button>
                <span className="text-xs text-slate-600">Pagina {currentPage} de {totalPages}</span>
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Proxima</Button>
              </div>
            </div>
          </>
        ) : null}
      </DataCard>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={editingId ? 'Editar categoria' : 'Nova categoria'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveCategory}>{editingId ? 'Salvar' : 'Criar categoria'}</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4" onSubmit={saveCategory}>
          <Input
            label="Nome"
            value={form.name}
            onChange={(event) => {
              const nextName = event.target.value;
              setForm((current) => ({
                ...current,
                name: nextName,
                slug: current.slug ? current.slug : slugify(nextName),
              }));
            }}
            required
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
            required
          />
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            <span>Categoria ativa</span>
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
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
        <p>
          Deseja excluir a categoria <strong>{deleteTarget?.name}</strong>? Produtos dessa categoria ficarao sem categoria.
        </p>
      </Modal>
    </section>
  );
}

export default AdminCategoriesPage;

