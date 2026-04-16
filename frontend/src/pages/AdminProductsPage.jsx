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
import {
  createAdminProduct,
  fetchAdminProducts,
  fetchCategories,
  setAdminProductStatus,
  updateAdminProduct,
} from '../services/api';

const initialForm = {
  title: '',
  slug: '',
  short_description: '',
  full_description: '',
  cover_image: '',
  images: '',
  is_active: true,
  category_id: '',
  grams_filament: '0',
  price_kg_filament: '0',
  hours_printing: '0',
  avg_power_watts: '0',
  price_kwh: '0',
  total_hours_labor: '0',
  price_hour_labor: '0',
  extra_cost: '0',
  profit_margin: '0',
  manual_price: '',
};

function toPayload(form) {
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
    is_active: form.is_active,
    category_id: form.category_id === '' ? null : Number(form.category_id),
    grams_filament: Number(form.grams_filament || 0),
    price_kg_filament: Number(form.price_kg_filament || 0),
    hours_printing: Number(form.hours_printing || 0),
    avg_power_watts: Number(form.avg_power_watts || 0),
    price_kwh: Number(form.price_kwh || 0),
    total_hours_labor: Number(form.total_hours_labor || 0),
    price_hour_labor: Number(form.price_hour_labor || 0),
    extra_cost: Number(form.extra_cost || 0),
    profit_margin: Number(form.profit_margin || 0),
    manual_price: form.manual_price === '' ? null : Number(form.manual_price),
  };
}

function fromProduct(product) {
  return {
    title: product.title,
    slug: product.slug,
    short_description: product.short_description,
    full_description: product.full_description,
    cover_image: product.cover_image,
    images: (product.images || []).join('\n'),
    is_active: product.is_active,
    category_id: product.category_id == null ? '' : String(product.category_id),
    grams_filament: String(product.grams_filament ?? 0),
    price_kg_filament: String(product.price_kg_filament ?? 0),
    hours_printing: String(product.hours_printing ?? 0),
    avg_power_watts: String(product.avg_power_watts ?? 0),
    price_kwh: String(product.price_kwh ?? 0),
    total_hours_labor: String(product.total_hours_labor ?? 0),
    price_hour_labor: String(product.price_hour_labor ?? 0),
    extra_cost: String(product.extra_cost ?? 0),
    profit_margin: String(product.profit_margin ?? 0),
    manual_price: product.manual_price == null ? '' : String(product.manual_price),
  };
}

function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

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
    setEditingId(null);
    setForm(initialForm);
    setError('');
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const openEdit = (product) => {
    setEditingId(product.id);
    setForm(fromProduct(product));
    setError('');
    setSelectedProduct(product);
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

  return (
    <section className="admin-page-pro">
      <SectionHeader
        eyebrow="Catalogo"
        title="Produtos"
        subtitle="Cadastre, edite e publique produtos com agilidade"
        action={<Button onClick={openCreate}>Novo produto</Button>}
      />

      <DataCard title="Lista de produtos">
        {loading ? <div className="loading-state-pro">Carregando produtos...</div> : null}
        {!loading ? (
          <Table
            columns={['Produto', 'Categoria', 'Preco final', 'Custo', 'Lucro', 'Status', 'Acoes']}
            rows={products}
            empty={<EmptyState title="Sem produtos" description="Comece criando o primeiro produto." />}
            renderRow={(product) => (
              <tr key={product.id}>
                <td>
                  <div className="table-title-cell">
                    <strong>{product.title}</strong>
                    <small>{product.slug}</small>
                  </div>
                </td>
                <td>
                  {categories.find((category) => category.id === product.category_id)?.name || 'Sem categoria'}
                </td>
                <td>R$ {(product.final_price ?? product.price ?? 0).toFixed(2)}</td>
                <td>R$ {(product.cost_total ?? 0).toFixed(2)}</td>
                <td>R$ {(product.estimated_profit ?? 0).toFixed(2)}</td>
                <td>
                  <StatusBadge tone={product.is_active ? 'success' : 'danger'}>
                    {product.is_active ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td>
                  <div className="table-actions-row">
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
        <form className="form-grid" onSubmit={submitForm}>
          <Input label="Titulo" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
          <Select label="Categoria" options={categoryOptions} value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} />
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
            className="span-2"
            required
          />
          <TextArea
            label="Imagens extras (uma por linha)"
            rows="4"
            value={form.images}
            onChange={(event) => setForm({ ...form, images: event.target.value })}
            className="span-2"
          />

          <Input label="Filamento (gramas)" type="number" min="0" step="0.01" value={form.grams_filament} onChange={(event) => setForm({ ...form, grams_filament: event.target.value })} />
          <Input label="Preco KG filamento" type="number" min="0" step="0.01" value={form.price_kg_filament} onChange={(event) => setForm({ ...form, price_kg_filament: event.target.value })} />
          <Input label="Horas de impressao" type="number" min="0" step="0.01" value={form.hours_printing} onChange={(event) => setForm({ ...form, hours_printing: event.target.value })} />
          <Input label="Potencia media (watts)" type="number" min="0" step="0.01" value={form.avg_power_watts} onChange={(event) => setForm({ ...form, avg_power_watts: event.target.value })} />
          <Input label="Preco kWh" type="number" min="0" step="0.01" value={form.price_kwh} onChange={(event) => setForm({ ...form, price_kwh: event.target.value })} />
          <Input label="Horas mao de obra" type="number" min="0" step="0.01" value={form.total_hours_labor} onChange={(event) => setForm({ ...form, total_hours_labor: event.target.value })} />
          <Input label="Preco hora mao de obra" type="number" min="0" step="0.01" value={form.price_hour_labor} onChange={(event) => setForm({ ...form, price_hour_labor: event.target.value })} />
          <Input label="Custos extras" type="number" min="0" step="0.01" value={form.extra_cost} onChange={(event) => setForm({ ...form, extra_cost: event.target.value })} />
          <Input label="Margem de lucro (%)" type="number" min="0" step="0.01" value={form.profit_margin} onChange={(event) => setForm({ ...form, profit_margin: event.target.value })} />
          <Input label="Preco manual (opcional)" type="number" min="0" step="0.01" value={form.manual_price} onChange={(event) => setForm({ ...form, manual_price: event.target.value })} />

          <label className="checkbox-row span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            <span>Produto ativo</span>
          </label>

          {selectedProduct ? (
            <div className="span-2">
              <p className="helper-text">Custo total: R$ {(selectedProduct.cost_total ?? 0).toFixed(2)}</p>
              <p className="helper-text">Preco calculado: R$ {(selectedProduct.calculated_price ?? 0).toFixed(2)}</p>
              <p className="helper-text">Lucro estimado: R$ {(selectedProduct.estimated_profit ?? 0).toFixed(2)}</p>
              <p className="helper-text">Preco final: R$ {(selectedProduct.final_price ?? selectedProduct.price ?? 0).toFixed(2)}</p>
            </div>
          ) : null}

          {error ? <p className="form-error span-2">{error}</p> : null}
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
