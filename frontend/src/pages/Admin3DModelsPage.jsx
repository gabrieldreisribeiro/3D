import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import {
  createAdmin3DModel,
  deleteAdmin3DModel,
  downloadAdmin3DModelOriginal,
  downloadAdmin3DModelPreview,
  downloadAllAdmin3DModels,
  fetchAdmin3DModelById,
  fetchAdmin3DModels,
  fetchAdminProducts,
  updateAdmin3DModel,
} from '../services/api';

const emptyForm = {
  product_id: '',
  sub_item_id: '',
  name: '',
  description: '',
  sort_order: 1,
  original_file_url: '',
  preview_file_url: '',
  width_mm: '',
  height_mm: '',
  depth_mm: '',
  dimensions_source: 'auto',
  allow_download: false,
  is_active: true,
};

function toOptionalNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

function Admin3DModelsPage() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloadFilter, setDownloadFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailModel, setDetailModel] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetchAdminProducts(),
      fetchAdmin3DModels({
        search,
        product_id: productFilter !== 'all' ? Number(productFilter) : undefined,
        created_from: dateFrom || undefined,
        created_to: dateTo || undefined,
        is_active: statusFilter === 'all' ? 'all' : statusFilter === 'active',
        allow_download: downloadFilter === 'all' ? 'all' : downloadFilter === 'yes',
      }),
    ])
      .then(([productRows, modelRows]) => {
        setProducts(Array.isArray(productRows) ? productRows : []);
        setRows(Array.isArray(modelRows) ? modelRows : []);
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar modelos 3D.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const applyFilters = () => {
    loadData();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
      setForm({
        product_id: String(item.product_id),
      sub_item_id: String(item.sub_item_id || ''),
      name: item.name || '',
      description: item.description || '',
      sort_order: Number(item.sort_order || 1),
      original_file_url: item.original_file_url || '',
      preview_file_url: item.preview_file_url || '',
      width_mm: item.width_mm == null ? '' : String(item.width_mm),
      height_mm: item.height_mm == null ? '' : String(item.height_mm),
      depth_mm: item.depth_mm == null ? '' : String(item.depth_mm),
      dimensions_source: item.dimensions_source || 'auto',
      allow_download: Boolean(item.allow_download),
      is_active: Boolean(item.is_active),
    });
    setModalOpen(true);
  };

  const openDetail = async (id) => {
    setError('');
    try {
      const data = await fetchAdmin3DModelById(id);
      setDetailModel(data);
      setDetailOpen(true);
    } catch (detailError) {
      setError(detailError.message || 'Falha ao carregar detalhe do modelo.');
    }
  };

  const saveModel = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        product_id: Number(form.product_id || 0),
        sub_item_id: String(form.sub_item_id || '').trim() || null,
        name: String(form.name || '').trim(),
        description: String(form.description || '').trim() || null,
        sort_order: Number(form.sort_order || 1),
        original_file_url: String(form.original_file_url || '').trim() || null,
        preview_file_url: String(form.preview_file_url || '').trim(),
        width_mm: toOptionalNumber(form.width_mm),
        height_mm: toOptionalNumber(form.height_mm),
        depth_mm: toOptionalNumber(form.depth_mm),
        dimensions_source: form.dimensions_source === 'manual' ? 'manual' : 'auto',
        allow_download: Boolean(form.allow_download),
        is_active: Boolean(form.is_active),
      };
      if (!payload.product_id) throw new Error('Selecione um produto.');
      if (!payload.preview_file_url) throw new Error('Arquivo preview e obrigatorio.');

      if (editingId) {
        await updateAdmin3DModel(editingId, payload);
      } else {
        await createAdmin3DModel(payload);
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      loadData();
    } catch (saveError) {
      setError(saveError.message || 'Falha ao salvar modelo 3D.');
    } finally {
      setSaving(false);
    }
  };

  const removeModel = async (id, name) => {
    const confirmed = window.confirm(`Tem certeza que deseja excluir "${name}"?`);
    if (!confirmed) return;
    try {
      await deleteAdmin3DModel(id);
      loadData();
    } catch (deleteError) {
      setError(deleteError.message || 'Falha ao excluir modelo 3D.');
    }
  };

  const productOptions = useMemo(
    () => products.filter((item) => Number(item.id) > 0).map((item) => ({ value: String(item.id), label: item.title })),
    [products]
  );
  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === String(form.product_id || '')),
    [products, form.product_id]
  );
  const subItemOptions = useMemo(() => {
    if (!selectedProduct || !Array.isArray(selectedProduct.sub_items)) return [];
    return selectedProduct.sub_items
      .map((item) => ({
        value: String(item?.id || '').trim(),
        label: item?.title || 'Sub item',
      }))
      .filter((item) => item.value);
  }, [selectedProduct]);

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Interno"
        title="Modelos 3D"
        subtitle="Gestao completa dos modelos 3D internos. Nao exibido para clientes finais."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadAllAdmin3DModels({ search, product_id: productFilter !== 'all' ? Number(productFilter) : undefined, created_from: dateFrom || undefined, created_to: dateTo || undefined })}>
              Baixar todos
            </Button>
            <Button onClick={openCreate}>Novo modelo</Button>
          </div>
        }
      />

      <DataCard title="Filtros">
        <div className="admin-filter-bar flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, descricao ou produto"
            className="h-10 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
          />
          <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="all">Todos produtos</option>
            {productOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="all">Todos status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
          <select value={downloadFilter} onChange={(event) => setDownloadFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="all">Download (todos)</option>
            <option value="yes">Download permitido</option>
            <option value="no">Download bloqueado</option>
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          <Button variant="secondary" onClick={applyFilters}>Aplicar</Button>
        </div>
      </DataCard>

      <DataCard title="Modelos cadastrados">
        {error ? <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">Carregando modelos 3D...</p>
        ) : (
          <Table
            columns={['Modelo', 'Produto/Subitem', 'Ordem', 'Dimensoes', 'Arquivos', 'Download', 'Status', 'Criado em', 'Acoes']}
            rows={rows}
            empty={<EmptyState title="Sem modelos 3D" description="Cadastre modelos para comecar." />}
            renderRow={(item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>
                  <div className="flex flex-col text-xs text-slate-700">
                    <span>{item.product_title || `Produto #${item.product_id}`}</span>
                    <span className="text-slate-500">
                      {item.sub_item_title ? `Subitem: ${item.sub_item_title}` : 'Principal do produto'}
                    </span>
                  </div>
                </td>
                <td>{item.sort_order}</td>
                <td>{item.width_mm ?? '-'} x {item.height_mm ?? '-'} x {item.depth_mm ?? '-'} mm</td>
                <td>
                  <div className="flex flex-col text-xs text-slate-600">
                    <span>Original: {item.original_file_name || '-'}</span>
                    <span>Preview: {item.preview_file_name || '-'}</span>
                  </div>
                </td>
                <td>
                  <StatusBadge tone={item.allow_download ? 'success' : 'warning'}>
                    {item.allow_download ? 'Permitido' : 'Bloqueado'}
                  </StatusBadge>
                </td>
                <td>
                  <StatusBadge tone={item.is_active ? 'success' : 'danger'}>
                    {item.is_active ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td>{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openDetail(item.id)}>Detalhe</Button>
                    <Button variant="secondary" onClick={() => openEdit(item)}>Editar</Button>
                    <Button variant="ghost" onClick={() => downloadAdmin3DModelOriginal(item.id)}>Baixar original</Button>
                    <Button variant="ghost" onClick={() => downloadAdmin3DModelPreview(item.id)}>Baixar preview</Button>
                    <Button variant="danger" onClick={() => removeModel(item.id, item.name)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </DataCard>

      <Modal
        open={modalOpen}
        title={editingId ? 'Editar modelo 3D' : 'Novo modelo 3D'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveModel}>{editingId ? 'Salvar alteracoes' : 'Criar modelo'}</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveModel}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Produto vinculado</span>
            <select value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">Selecione</option>
              {productOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Subitem vinculado (opcional)</span>
            <select value={form.sub_item_id} onChange={(event) => setForm({ ...form, sub_item_id: event.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">Principal do produto</option>
              {subItemOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </label>
          <Input label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Input label="Ordem" type="number" min="1" step="1" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
          <Input label="Preview URL" value={form.preview_file_url} onChange={(event) => setForm({ ...form, preview_file_url: event.target.value })} required />
          <Input label="Original URL" value={form.original_file_url} onChange={(event) => setForm({ ...form, original_file_url: event.target.value })} />
          <Input label="Largura (mm)" type="number" min="0" step="0.01" value={form.width_mm} onChange={(event) => setForm({ ...form, width_mm: event.target.value, dimensions_source: 'manual' })} />
          <Input label="Altura (mm)" type="number" min="0" step="0.01" value={form.height_mm} onChange={(event) => setForm({ ...form, height_mm: event.target.value, dimensions_source: 'manual' })} />
          <Input label="Profundidade (mm)" type="number" min="0" step="0.01" value={form.depth_mm} onChange={(event) => setForm({ ...form, depth_mm: event.target.value, dimensions_source: 'manual' })} />
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.allow_download} onChange={(event) => setForm({ ...form, allow_download: event.target.checked })} />
            Permitir download
          </label>
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            Modelo ativo
          </label>
          <Input label="Descricao" className="md:col-span-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </form>
      </Modal>

      <Modal
        open={detailOpen}
        title="Detalhes do modelo 3D"
        onClose={() => setDetailOpen(false)}
        footer={<Button variant="secondary" onClick={() => setDetailOpen(false)}>Fechar</Button>}
      >
        {detailModel ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p><strong>Nome:</strong> {detailModel.name}</p>
            <p><strong>Produto:</strong> {detailModel.product_title || `#${detailModel.product_id}`}</p>
            <p><strong>Subitem:</strong> {detailModel.sub_item_title || 'Principal do produto'}</p>
            <p><strong>Descricao:</strong> {detailModel.description || '-'}</p>
            <p><strong>Ordem:</strong> {detailModel.sort_order}</p>
            <p><strong>Dimensoes:</strong> {detailModel.width_mm ?? '-'} x {detailModel.height_mm ?? '-'} x {detailModel.depth_mm ?? '-'} mm ({detailModel.dimensions_source})</p>
            <p><strong>Original:</strong> {detailModel.original_file_name || '-'}</p>
            <p><strong>Preview:</strong> {detailModel.preview_file_name || '-'}</p>
            <p><strong>Download permitido:</strong> {detailModel.allow_download ? 'Sim' : 'Nao'}</p>
            <p><strong>Status:</strong> {detailModel.is_active ? 'Ativo' : 'Inativo'}</p>
            <p><strong>Criado em:</strong> {detailModel.created_at ? new Date(detailModel.created_at).toLocaleString('pt-BR') : '-'}</p>
            <p><strong>Atualizado em:</strong> {detailModel.updated_at ? new Date(detailModel.updated_at).toLocaleString('pt-BR') : '-'}</p>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default Admin3DModelsPage;
