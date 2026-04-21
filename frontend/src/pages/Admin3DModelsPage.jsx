import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import {
  createAdmin3DModel,
  deleteAdmin3DModel,
  downloadAdmin3DModelOriginal,
  downloadAdmin3DModelPreview,
  downloadAllAdmin3DModels,
  fetchAdmin3DModelById,
  fetchAdmin3DModels,
  fetchAdminProducts,
  resolveAssetUrl,
  updateAdmin3DModel,
} from '../services/api';

const PAGE_SIZE = 24;

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

const isPreviewImage = (url) => {
  const value = String(url || '').toLowerCase().split('?')[0].split('#')[0];
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'].some((ext) => value.endsWith(ext));
};

function toOptionalNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDims(item) {
  return `${item.width_mm ?? '-'} x ${item.height_mm ?? '-'} x ${item.depth_mm ?? '-'} mm`;
}

function ModelCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 aspect-square rounded-xl bg-slate-100" />
      <div className="h-4 w-2/3 rounded bg-slate-100" />
      <div className="mt-2 h-3 w-full rounded bg-slate-100" />
      <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
      <div className="mt-3 h-8 w-full rounded bg-slate-100" />
    </div>
  );
}

function fileExtensionFromUrl(url) {
  const value = String(url || '').toLowerCase().split('?')[0].split('#')[0];
  const index = value.lastIndexOf('.');
  if (index < 0) return '';
  return value.slice(index);
}

function ModelThumbnail({ item }) {
  const previewUrl = resolveAssetUrl(item.preview_file_url || '') || item.preview_file_url || '';
  const isImage = isPreviewImage(previewUrl);
  const extension = fileExtensionFromUrl(previewUrl);
  const canRenderGlb = extension === '.glb' && typeof customElements !== 'undefined' && customElements.get('model-viewer');

  if (canRenderGlb && previewUrl) {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <model-viewer
          src={previewUrl}
          camera-controls
          disable-zoom
          interaction-prompt="none"
          exposure="1"
          shadow-intensity="0.8"
          environment-image="neutral"
          style={{ width: '100%', height: '100%', '--poster-color': 'transparent' }}
        />
      </div>
    );
  }

  if (isImage && previewUrl) {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <img
          src={previewUrl}
          alt={item.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex flex-col items-center gap-2 text-slate-500 transition duration-300 group-hover:scale-[1.03]">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
        <span className="px-2 text-center text-[11px] font-medium">Preview 3D</span>
      </div>
    </div>
  );
}

function Admin3DModelsPage() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloadFilter, setDownloadFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailModel, setDetailModel] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.customElements && window.customElements.get('model-viewer')) return;
    if (document.querySelector('script[data-model-viewer="true"]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    script.setAttribute('data-model-viewer', 'true');
    document.head.appendChild(script);
  }, []);

  const flashNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetchAdminProducts(),
      fetchAdmin3DModels({
        search: search || undefined,
        product_id: productFilter !== 'all' ? Number(productFilter) : undefined,
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

  const filteredRows = useMemo(() => {
    const text = String(search || '').trim().toLowerCase();
    return rows.filter((item) => {
      const isSubItem = Boolean(item.sub_item_id);
      if (typeFilter === 'subitem' && !isSubItem) return false;
      if (typeFilter === 'product' && isSubItem) return false;
      if (statusFilter === 'active' && !item.is_active) return false;
      if (statusFilter === 'inactive' && item.is_active) return false;
      if (downloadFilter === 'yes' && !item.allow_download) return false;
      if (downloadFilter === 'no' && item.allow_download) return false;
      if (productFilter !== 'all' && String(item.product_id) !== String(productFilter)) return false;
      if (!text) return true;
      const blob = `${item.name || ''} ${item.product_title || ''} ${item.product_slug || ''} ${item.sub_item_title || ''}`.toLowerCase();
      return blob.includes(text);
    });
  }, [rows, search, productFilter, statusFilter, downloadFilter, typeFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, productFilter, statusFilter, downloadFilter, typeFilter, rows]);

  const visibleRows = useMemo(() => filteredRows.slice(0, visibleCount), [filteredRows, visibleCount]);
  const hasMore = visibleRows.length < filteredRows.length;

  const groupedRows = useMemo(() => {
    const map = new Map();
    visibleRows.forEach((item) => {
      const key = `${item.product_id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          productId: item.product_id,
          productTitle: item.product_title || `Produto #${item.product_id}`,
          items: [],
        });
      }
      map.get(key).items.push(item);
    });
    return Array.from(map.values()).sort((a, b) => a.productTitle.localeCompare(b.productTitle));
  }, [visibleRows]);

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
        flashNotice('Modelo atualizado com sucesso.');
      } else {
        await createAdmin3DModel(payload);
        flashNotice('Modelo criado com sucesso.');
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

  const removeModel = async (item) => {
    const confirmed = window.confirm(`Tem certeza que deseja excluir "${item.name}"?`);
    if (!confirmed) return;
    try {
      await deleteAdmin3DModel(item.id);
      flashNotice('Modelo excluido com sucesso.');
      loadData();
    } catch (deleteError) {
      setError(deleteError.message || 'Falha ao excluir modelo 3D.');
    }
  };

  const handleDownloadOriginal = async (item) => {
    try {
      await downloadAdmin3DModelOriginal(item.id);
      flashNotice(`Download original: ${item.name}`);
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar arquivo original.');
    }
  };

  const handleDownloadPreview = async (item) => {
    try {
      await downloadAdmin3DModelPreview(item.id);
      flashNotice(`Download preview: ${item.name}`);
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar preview.');
    }
  };

  const handleDownloadAll = async () => {
    try {
      await downloadAllAdmin3DModels({
        search: search || undefined,
        product_id: productFilter !== 'all' ? Number(productFilter) : undefined,
        is_active: statusFilter === 'all' ? 'all' : statusFilter === 'active',
        allow_download: downloadFilter === 'all' ? 'all' : downloadFilter === 'yes',
      });
      flashNotice('Download em lote iniciado.');
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar modelos.');
    }
  };

  const quickPillClass = (active) =>
    `h-9 rounded-full border px-3 text-xs font-semibold transition ${
      active
        ? 'border-violet-600 bg-violet-600 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
    }`;

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Interno"
        title="Modelos 3D"
        subtitle="Gerencie todos os modelos 3D vinculados aos seus produtos."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              Total: {filteredRows.length} modelos
            </span>
            <Button variant="secondary" onClick={handleDownloadAll}>Baixar todos</Button>
            <Button onClick={openCreate}>+ Novo modelo</Button>
          </div>
        )}
      />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              label="Busca"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, produto ou subitem"
              className="min-w-[220px]"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Produto</span>
              <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
                <option value="all">Todos</option>
                {productOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <Button variant="secondary" onClick={loadData}>Atualizar</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={quickPillClass(typeFilter === 'all')} onClick={() => setTypeFilter('all')}>Tipo: todos</button>
            <button type="button" className={quickPillClass(typeFilter === 'product')} onClick={() => setTypeFilter('product')}>Produto</button>
            <button type="button" className={quickPillClass(typeFilter === 'subitem')} onClick={() => setTypeFilter('subitem')}>Subitem</button>
            <button type="button" className={quickPillClass(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>Status: todos</button>
            <button type="button" className={quickPillClass(statusFilter === 'active')} onClick={() => setStatusFilter('active')}>Ativos</button>
            <button type="button" className={quickPillClass(statusFilter === 'inactive')} onClick={() => setStatusFilter('inactive')}>Inativos</button>
            <button type="button" className={quickPillClass(downloadFilter === 'all')} onClick={() => setDownloadFilter('all')}>Download: todos</button>
            <button type="button" className={quickPillClass(downloadFilter === 'yes')} onClick={() => setDownloadFilter('yes')}>Download ativo</button>
            <button type="button" className={quickPillClass(downloadFilter === 'no')} onClick={() => setDownloadFilter('no')}>Sem download</button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Carregando modelos...</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => <ModelCardSkeleton key={`skeleton-${index}`} />)}
          </div>
        </section>
      ) : groupedRows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
              <path d="m4 7.5 8 4.5 8-4.5" />
              <path d="M12 12v9" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-800">Nenhum modelo 3D cadastrado ainda</h3>
          <p className="mt-1 text-sm text-slate-500">Crie o primeiro modelo para comecar a organizar sua biblioteca.</p>
          <div className="mt-4">
            <Button onClick={openCreate}>Criar primeiro modelo</Button>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          {groupedRows.map((group) => (
            <article key={group.key} className="space-y-3">
              <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">
                  {group.productTitle} <span className="text-slate-500">({group.items.length} modelos)</span>
                </h3>
              </header>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.items.map((item) => {
                  const isPrincipal = !item.sub_item_id && Number(item.sort_order || 9999) === 1;
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <ModelThumbnail item={item} />

                      <div className="mt-3 space-y-2">
                        <h4 className="line-clamp-1 text-sm font-semibold text-slate-900">{item.name}</h4>
                        <p className="line-clamp-1 text-xs text-slate-500">{item.product_title || `Produto #${item.product_id}`}</p>
                        <p className="line-clamp-1 text-xs text-slate-500">
                          {item.sub_item_title ? `Subitem: ${item.sub_item_title}` : 'Vinculo: produto principal'}
                        </p>
                        <p className="text-xs font-medium text-slate-700">Dimensoes: {formatDims(item)}</p>
                        <p className="text-xs text-slate-500">Ordem: {item.sort_order}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {isPrincipal ? <StatusBadge tone="info">Principal</StatusBadge> : null}
                        <StatusBadge tone={item.sub_item_id ? 'info' : 'neutral'}>{item.sub_item_id ? 'Subitem' : 'Produto'}</StatusBadge>
                        {item.allow_download ? <StatusBadge tone="success">Download ativo</StatusBadge> : null}
                        {!item.is_active ? <StatusBadge tone="danger">Inativo</StatusBadge> : null}
                      </div>

                      <div className="mt-4 grid grid-cols-5 gap-1">
                        <button type="button" title="Detalhes" onClick={() => openDetail(item.id)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">i</button>
                        <button type="button" title="Baixar original" onClick={() => handleDownloadOriginal(item)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">O</button>
                        <button type="button" title="Baixar preview" onClick={() => handleDownloadPreview(item)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">P</button>
                        <button type="button" title="Editar" onClick={() => openEdit(item)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">E</button>
                        <button type="button" title="Excluir" onClick={() => removeModel(item)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100">X</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}

          {hasMore ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>Carregar mais</Button>
            </div>
          ) : null}
        </section>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? 'Editar modelo 3D' : 'Novo modelo 3D'}
        onClose={() => setModalOpen(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveModel}>{editingId ? 'Salvar alteracoes' : 'Criar modelo'}</Button>
          </>
        )}
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
          <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
            <p><strong>Nome:</strong> {detailModel.name}</p>
            <p><strong>Produto:</strong> {detailModel.product_title || `#${detailModel.product_id}`}</p>
            <p><strong>Subitem:</strong> {detailModel.sub_item_title || 'Principal do produto'}</p>
            <p><strong>Ordem:</strong> {detailModel.sort_order}</p>
            <p className="md:col-span-2"><strong>Descricao:</strong> {detailModel.description || '-'}</p>
            <p className="md:col-span-2"><strong>Dimensoes:</strong> {formatDims(detailModel)} ({detailModel.dimensions_source})</p>
            <p><strong>Original:</strong> {detailModel.original_file_name || '-'}</p>
            <p><strong>Preview:</strong> {detailModel.preview_file_name || '-'}</p>
            <p><strong>Download:</strong> {detailModel.allow_download ? 'Permitido' : 'Bloqueado'}</p>
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
