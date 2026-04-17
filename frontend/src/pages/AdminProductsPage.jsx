import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import TextArea from '../components/ui/TextArea';
import usePersistentState from '../hooks/usePersistentState';
import {
  createAdminProduct,
  fetchAdminProducts,
  fetchCategories,
  setAdminProductStatus,
  updateAdminProduct,
} from '../services/api';

const defaultPricingFields = {
  grams_filament: '0',
  price_kg_filament: '0',
  hours_printing: '0',
  avg_power_watts: '0',
  price_kwh: '0',
  total_hours_labor: '0',
  price_hour_labor: '0',
  extra_cost: '0',
  profit_margin: '0',
};

const createEmptySubItem = () => ({
  title: '',
  image_url: '',
  pricing_mode: 'manual',
  manual_price: '',
  ...defaultPricingFields,
});

const initialForm = {
  title: '',
  slug: '',
  short_description: '',
  full_description: '',
  cover_image: '',
  images: '',
  is_active: true,
  category_id: '',
  pricing_mode: 'calculated',
  manual_price: '',
  sub_items: [],
  ...defaultPricingFields,
};

function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapSubItemToPayload(item) {
  const pricingMode = item.pricing_mode || 'manual';
  const payload = {
    title: String(item.title || '').trim(),
    image_url: String(item.image_url || '').trim() || null,
    pricing_mode: pricingMode,
    manual_price: pricingMode === 'manual' ? toNumber(item.manual_price) : null,
    grams_filament: pricingMode === 'calculated' ? toNumber(item.grams_filament) : 0,
    price_kg_filament: pricingMode === 'calculated' ? toNumber(item.price_kg_filament) : 0,
    hours_printing: pricingMode === 'calculated' ? toNumber(item.hours_printing) : 0,
    avg_power_watts: pricingMode === 'calculated' ? toNumber(item.avg_power_watts) : 0,
    price_kwh: pricingMode === 'calculated' ? toNumber(item.price_kwh) : 0,
    total_hours_labor: pricingMode === 'calculated' ? toNumber(item.total_hours_labor) : 0,
    price_hour_labor: pricingMode === 'calculated' ? toNumber(item.price_hour_labor) : 0,
    extra_cost: pricingMode === 'calculated' ? toNumber(item.extra_cost) : 0,
    profit_margin: pricingMode === 'calculated' ? toNumber(item.profit_margin) : 0,
  };

  if (!payload.title) {
    throw new Error('Todos os sub itens precisam de titulo.');
  }

  return payload;
}

function toPayload(form) {
  const pricingMode = form.pricing_mode || 'calculated';

  return {
    title: form.title.trim(),
    slug: form.slug.trim().toLowerCase(),
    short_description: form.short_description.trim(),
    full_description: form.full_description.trim(),
    cover_image: form.cover_image.trim(),
    images: form.images
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    sub_items: (form.sub_items || []).map(mapSubItemToPayload),
    is_active: form.is_active,
    category_id: form.category_id === '' ? null : Number(form.category_id),
    manual_price: pricingMode === 'manual' ? toNumber(form.manual_price) : null,
    grams_filament: pricingMode === 'calculated' ? toNumber(form.grams_filament) : 0,
    price_kg_filament: pricingMode === 'calculated' ? toNumber(form.price_kg_filament) : 0,
    hours_printing: pricingMode === 'calculated' ? toNumber(form.hours_printing) : 0,
    avg_power_watts: pricingMode === 'calculated' ? toNumber(form.avg_power_watts) : 0,
    price_kwh: pricingMode === 'calculated' ? toNumber(form.price_kwh) : 0,
    total_hours_labor: pricingMode === 'calculated' ? toNumber(form.total_hours_labor) : 0,
    price_hour_labor: pricingMode === 'calculated' ? toNumber(form.price_hour_labor) : 0,
    extra_cost: pricingMode === 'calculated' ? toNumber(form.extra_cost) : 0,
    profit_margin: pricingMode === 'calculated' ? toNumber(form.profit_margin) : 0,
  };
}

function allPricingFieldsZero(item) {
  return [
    item.grams_filament,
    item.price_kg_filament,
    item.hours_printing,
    item.avg_power_watts,
    item.price_kwh,
    item.total_hours_labor,
    item.price_hour_labor,
    item.extra_cost,
    item.profit_margin,
  ].every((value) => Number(value || 0) === 0);
}

function fromProduct(product) {
  const pricingMode = Number(product.manual_price || 0) > 0 && allPricingFieldsZero(product) ? 'manual' : 'calculated';

  const subItems = (product.sub_items || []).map((item) => {
    const subPricingMode = item.pricing_mode || (Number(item.manual_price || 0) > 0 && allPricingFieldsZero(item) ? 'manual' : 'calculated');
    return {
      title: item.title || item.name || '',
      image_url: item.image_url || '',
      pricing_mode: subPricingMode,
      manual_price: item.manual_price == null ? String(item.final_price ?? item.price ?? '') : String(item.manual_price),
      grams_filament: String(item.grams_filament ?? 0),
      price_kg_filament: String(item.price_kg_filament ?? 0),
      hours_printing: String(item.hours_printing ?? 0),
      avg_power_watts: String(item.avg_power_watts ?? 0),
      price_kwh: String(item.price_kwh ?? 0),
      total_hours_labor: String(item.total_hours_labor ?? 0),
      price_hour_labor: String(item.price_hour_labor ?? 0),
      extra_cost: String(item.extra_cost ?? 0),
      profit_margin: String(item.profit_margin ?? 0),
    };
  });

  return {
    title: product.title,
    slug: product.slug,
    short_description: product.short_description,
    full_description: product.full_description,
    cover_image: product.cover_image,
    images: (product.images || []).join('\n'),
    sub_items: subItems,
    is_active: product.is_active,
    category_id: product.category_id == null ? '' : String(product.category_id),
    pricing_mode: pricingMode,
    manual_price: product.manual_price == null ? '' : String(product.manual_price),
    grams_filament: String(product.grams_filament ?? 0),
    price_kg_filament: String(product.price_kg_filament ?? 0),
    hours_printing: String(product.hours_printing ?? 0),
    avg_power_watts: String(product.avg_power_watts ?? 0),
    price_kwh: String(product.price_kwh ?? 0),
    total_hours_labor: String(product.total_hours_labor ?? 0),
    price_hour_labor: String(product.price_hour_labor ?? 0),
    extra_cost: String(product.extra_cost ?? 0),
    profit_margin: String(product.profit_margin ?? 0),
  };
}

function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = usePersistentState('modal:admin-products:form', initialForm);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = usePersistentState('modal:admin-products:open', false);
  const [editingId, setEditingId] = usePersistentState('modal:admin-products:editing-id', null);
  const [confirmTarget, setConfirmTarget] = usePersistentState('modal:admin-products:confirm-target', null);
  const [selectedProduct, setSelectedProduct] = usePersistentState('modal:admin-products:selected', null);
  const [modalMode, setModalMode] = usePersistentState('modal:admin-products:mode', 'create');

  const loadProducts = () => {
    setLoading(true);
    fetchAdminProducts()
      .then(setProducts)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar produtos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
    fetchCategories().then(setCategories);
  }, []);

  const openCreate = () => {
    const shouldResetForm = editingId !== null || modalMode !== 'create';
    setEditingId(null);
    if (shouldResetForm) setForm(initialForm);
    setError('');
    setSelectedProduct(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openEdit = (product) => {
    const sameEditingTarget = editingId === product.id && modalMode === 'edit';
    setEditingId(product.id);
    if (!sameEditingTarget) setForm(fromProduct(product));
    setError('');
    setSelectedProduct(product);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateAdminProduct(editingId, payload);
      } else {
        await createAdminProduct(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setSelectedProduct(null);
      setModalMode('create');
      setForm(initialForm);
      loadProducts();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget) return;
    try {
      await setAdminProductStatus(confirmTarget.id, !confirmTarget.is_active);
      setConfirmTarget(null);
      loadProducts();
    } catch (toggleError) {
      setError(toggleError.message || 'Falha ao atualizar status.');
    }
  };

  const categoryOptions = [{ value: '', label: 'Sem categoria' }, ...categories.map((category) => ({ value: String(category.id), label: category.name }))];

  const updateSubItem = (index, field, value) => {
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addSubItem = () => {
    setForm((current) => ({ ...current, sub_items: [...(current.sub_items || []), createEmptySubItem()] }));
  };

  const removeSubItem = (index) => {
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Catalogo"
        title="Produtos"
        subtitle="Cadastre, edite e publique produtos com agilidade"
        action={<Button onClick={openCreate}>Novo produto</Button>}
      />

      <DataCard title="Lista de produtos">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando produtos...</div> : null}
        {!loading ? (
          <Table
            columns={['Produto', 'Categoria', 'Preco final', 'Custo', 'Lucro', 'Status', 'Acoes']}
            rows={products}
            empty={<EmptyState title="Sem produtos" description="Comece criando o primeiro produto." />}
            renderRow={(product) => (
              <tr key={product.id}>
                <td>
                  <div className="flex flex-col">
                    <strong className="font-semibold text-slate-900">{product.title}</strong>
                    <small className="text-xs text-slate-500">{product.slug}</small>
                  </div>
                </td>
                <td>
                  {categories.find((category) => category.id === product.category_id)?.name || 'Sem categoria'}
                </td>
                <td>
                  {(product.sub_items || []).length > 0
                    ? 'Personalizado'
                    : `R$ ${(product.final_price ?? product.price ?? 0).toFixed(2)}`}
                </td>
                <td>R$ {(product.cost_total ?? 0).toFixed(2)}</td>
                <td>R$ {(product.estimated_profit ?? 0).toFixed(2)}</td>
                <td>
                  <StatusBadge tone={product.is_active ? 'success' : 'danger'}>
                    {product.is_active ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openEdit(product)}>
                      Editar
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmTarget(product)}>
                      {product.is_active ? 'Inativar' : 'Ativar'}
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />
        ) : null}
      </DataCard>

      <Modal
        open={isModalOpen}
        title={editingId ? 'Editar produto' : 'Novo produto'}
        onClose={() => setIsModalOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={submitForm}>
              {editingId ? 'Salvar alteracoes' : 'Criar produto'}
            </Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submitForm}>
          <Input label="Titulo" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
          <Select label="Categoria" options={categoryOptions} value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Modo de preco</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, pricing_mode: 'calculated' })}
                className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                  form.pricing_mode === 'calculated'
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                }`}
              >
                Calculo automatico
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, pricing_mode: 'manual' })}
                className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                  form.pricing_mode === 'manual'
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                }`}
              >
                Preco fixo
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Em calculo automatico, o preco final e calculado ao salvar com base nos custos.
            </p>
          </div>

          <Input
            label="Descricao curta"
            value={form.short_description}
            onChange={(event) => setForm({ ...form, short_description: event.target.value })}
            required
          />
          <Input
            label="URL da capa"
            value={form.cover_image}
            onChange={(event) => setForm({ ...form, cover_image: event.target.value })}
            required
          />

          <TextArea
            label="Descricao completa"
            rows="4"
            value={form.full_description}
            onChange={(event) => setForm({ ...form, full_description: event.target.value })}
            className="md:col-span-2"
            required
          />

          <TextArea
            label="Imagens extras (uma por linha)"
            rows="4"
            value={form.images}
            onChange={(event) => setForm({ ...form, images: event.target.value })}
            className="md:col-span-2"
          />

          {form.pricing_mode === 'manual' ? (
            <Input
              label="Preco do produto"
              type="number"
              min="0"
              step="0.01"
              value={form.manual_price}
              onChange={(event) => setForm({ ...form, manual_price: event.target.value })}
            />
          ) : (
            <>
              <Input label="Filamento (gramas)" type="number" min="0" step="0.01" value={form.grams_filament} onChange={(event) => setForm({ ...form, grams_filament: event.target.value })} />
              <Input label="Preco KG filamento" type="number" min="0" step="0.01" value={form.price_kg_filament} onChange={(event) => setForm({ ...form, price_kg_filament: event.target.value })} />
              <Input label="Horas de impressao" type="number" min="0" step="0.01" value={form.hours_printing} onChange={(event) => setForm({ ...form, hours_printing: event.target.value })} />
              <Input label="Potencia media (watts)" type="number" min="0" step="0.01" value={form.avg_power_watts} onChange={(event) => setForm({ ...form, avg_power_watts: event.target.value })} />
              <Input label="Preco kWh" type="number" min="0" step="0.01" value={form.price_kwh} onChange={(event) => setForm({ ...form, price_kwh: event.target.value })} />
              <Input label="Horas mao de obra" type="number" min="0" step="0.01" value={form.total_hours_labor} onChange={(event) => setForm({ ...form, total_hours_labor: event.target.value })} />
              <Input label="Preco hora mao de obra" type="number" min="0" step="0.01" value={form.price_hour_labor} onChange={(event) => setForm({ ...form, price_hour_labor: event.target.value })} />
              <Input label="Custos extras" type="number" min="0" step="0.01" value={form.extra_cost} onChange={(event) => setForm({ ...form, extra_cost: event.target.value })} />
              <Input label="Margem de lucro (%)" type="number" min="0" step="0.01" value={form.profit_margin} onChange={(event) => setForm({ ...form, profit_margin: event.target.value })} />
            </>
          )}

          <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Sub itens do anuncio</h4>
              <Button type="button" variant="secondary" onClick={addSubItem}>Adicionar sub item</Button>
            </div>

            <div className="space-y-4">
              {(form.sub_items || []).length === 0 ? (
                <p className="text-sm text-slate-500">Sem sub itens. Produto sera tratado como item unico.</p>
              ) : null}

              {(form.sub_items || []).map((subItem, index) => (
                <div key={`sub-item-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <strong className="text-sm text-slate-900">Sub item {index + 1}</strong>
                    <Button type="button" variant="danger" onClick={() => removeSubItem(index)}>Remover</Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input label="Titulo" value={subItem.title} onChange={(event) => updateSubItem(index, 'title', event.target.value)} required />
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Modo de preco</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateSubItem(index, 'pricing_mode', 'calculated')}
                          className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                            subItem.pricing_mode === 'calculated'
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                          }`}
                        >
                          Calculo automatico
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSubItem(index, 'pricing_mode', 'manual')}
                          className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                            subItem.pricing_mode === 'manual'
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                          }`}
                        >
                          Preco fixo
                        </button>
                      </div>
                    </div>
                    <Input label="Imagem (URL)" className="md:col-span-2" value={subItem.image_url} onChange={(event) => updateSubItem(index, 'image_url', event.target.value)} />

                    {subItem.pricing_mode === 'manual' ? (
                      <Input label="Preco do sub item" type="number" min="0" step="0.01" value={subItem.manual_price} onChange={(event) => updateSubItem(index, 'manual_price', event.target.value)} />
                    ) : (
                      <>
                        <Input label="Filamento (gramas)" type="number" min="0" step="0.01" value={subItem.grams_filament} onChange={(event) => updateSubItem(index, 'grams_filament', event.target.value)} />
                        <Input label="Preco KG filamento" type="number" min="0" step="0.01" value={subItem.price_kg_filament} onChange={(event) => updateSubItem(index, 'price_kg_filament', event.target.value)} />
                        <Input label="Horas de impressao" type="number" min="0" step="0.01" value={subItem.hours_printing} onChange={(event) => updateSubItem(index, 'hours_printing', event.target.value)} />
                        <Input label="Potencia media (watts)" type="number" min="0" step="0.01" value={subItem.avg_power_watts} onChange={(event) => updateSubItem(index, 'avg_power_watts', event.target.value)} />
                        <Input label="Preco kWh" type="number" min="0" step="0.01" value={subItem.price_kwh} onChange={(event) => updateSubItem(index, 'price_kwh', event.target.value)} />
                        <Input label="Horas mao de obra" type="number" min="0" step="0.01" value={subItem.total_hours_labor} onChange={(event) => updateSubItem(index, 'total_hours_labor', event.target.value)} />
                        <Input label="Preco hora mao de obra" type="number" min="0" step="0.01" value={subItem.price_hour_labor} onChange={(event) => updateSubItem(index, 'price_hour_labor', event.target.value)} />
                        <Input label="Custos extras" type="number" min="0" step="0.01" value={subItem.extra_cost} onChange={(event) => updateSubItem(index, 'extra_cost', event.target.value)} />
                        <Input label="Margem de lucro (%)" type="number" min="0" step="0.01" value={subItem.profit_margin} onChange={(event) => updateSubItem(index, 'profit_margin', event.target.value)} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="md:col-span-2 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            <span>Produto ativo</span>
          </label>

          {selectedProduct ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Custo total: R$ {(selectedProduct.cost_total ?? 0).toFixed(2)}</p>
              <p className="text-sm text-slate-600">Preco calculado: R$ {(selectedProduct.calculated_price ?? 0).toFixed(2)}</p>
              <p className="text-sm text-slate-600">Lucro estimado: R$ {(selectedProduct.estimated_profit ?? 0).toFixed(2)}</p>
              <p className="text-sm font-semibold text-slate-900">Preco final: R$ {(selectedProduct.final_price ?? selectedProduct.price ?? 0).toFixed(2)}</p>
            </div>
          ) : null}

          {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        title="Confirmar alteracao"
        onClose={() => setConfirmTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmToggleStatus}>
              Confirmar
            </Button>
          </>
        }
      >
        <p>
          Deseja {confirmTarget?.is_active ? 'inativar' : 'ativar'} o produto <strong>{confirmTarget?.title}</strong>?
        </p>
      </Modal>
    </section>
  );
}

export default AdminProductsPage;
