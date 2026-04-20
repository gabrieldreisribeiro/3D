import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import {
  createAdminPromotion,
  deleteAdminPromotion,
  fetchAdminProducts,
  fetchAdminPromotions,
  setAdminPromotionStatus,
  updateAdminPromotion,
} from '../services/api';

const initialForm = {
  name: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '10',
  applies_to_all: true,
  product_ids: [],
  start_at: '',
  end_at: '',
  is_active: true,
};

function toLocalDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (item) => String(item).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function statusTone(status) {
  if (status === 'active') return 'success';
  if (status === 'scheduled') return 'info';
  if (status === 'ended') return 'warning';
  return 'danger';
}

function statusLabel(status) {
  if (status === 'active') return 'Ativa';
  if (status === 'scheduled') return 'Agendada';
  if (status === 'ended') return 'Encerrada';
  return 'Inativa';
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    discount_type: form.discount_type,
    discount_value: Number(form.discount_value || 0),
    applies_to_all: Boolean(form.applies_to_all),
    product_ids: form.applies_to_all ? [] : (form.product_ids || []).map((item) => Number(item)).filter((item) => item > 0),
    start_at: form.start_at || null,
    end_at: form.end_at || null,
    is_active: Boolean(form.is_active),
  };
}

function fromPromotion(item) {
  return {
    name: item?.name || '',
    description: item?.description || '',
    discount_type: item?.discount_type || 'percentage',
    discount_value: String(item?.discount_value ?? 0),
    applies_to_all: Boolean(item?.applies_to_all),
    product_ids: item?.product_ids || [],
    start_at: toLocalDateTimeInput(item?.start_at),
    end_at: toLocalDateTimeInput(item?.end_at),
    is_active: Boolean(item?.is_active),
  };
}

function calculatePreviewPrice(basePrice, discountType, discountValue) {
  const base = Math.max(0, Number(basePrice || 0));
  const value = Math.max(0, Number(discountValue || 0));
  if (discountType === 'percentage') return Math.max(0, base - (base * value) / 100);
  return Math.max(0, base - value);
}

function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [previewBasePrice, setPreviewBasePrice] = useState('100');

  const loadData = () => {
    setLoading(true);
    Promise.all([fetchAdminPromotions(), fetchAdminProducts()])
      .then(([promotionsData, productsData]) => {
        setPromotions(promotionsData || []);
        setProducts(productsData || []);
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar promocoes.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (promotion) => {
    setEditingId(promotion.id);
    setForm(fromPromotion(promotion));
    setError('');
    setIsModalOpen(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = toPayload(form);
      if (!payload.name) {
        throw new Error('Informe o nome da promocao.');
      }
      if (!payload.applies_to_all && !payload.product_ids.length) {
        throw new Error('Selecione ao menos um produto ou marque aplicar para todos.');
      }
      if (editingId) {
        await updateAdminPromotion(editingId, payload);
      } else {
        await createAdminPromotion(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setForm(initialForm);
      loadData();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar promocao.');
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget) return;
    try {
      await setAdminPromotionStatus(confirmTarget.id, !confirmTarget.is_active);
      setConfirmTarget(null);
      loadData();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao alterar status da promocao.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAdminPromotion(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao excluir promocao.');
    }
  };

  const previewPrice = useMemo(
    () => calculatePreviewPrice(previewBasePrice, form.discount_type, form.discount_value),
    [previewBasePrice, form.discount_type, form.discount_value]
  );

  const filteredPromotions = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    return promotions.filter((promotion) => {
      const matchesQuery = !query
        || String(promotion.name || '').toLowerCase().includes(query)
        || String(promotion.description || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || String(promotion.status || '').toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [promotions, searchTerm, statusFilter]);

  const toggleProductSelection = (productId, checked) => {
    setForm((current) => {
      const currentIds = new Set((current.product_ids || []).map((item) => Number(item)));
      if (checked) currentIds.add(Number(productId));
      else currentIds.delete(Number(productId));
      return { ...current, product_ids: Array.from(currentIds) };
    });
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Marketing"
        title="Promocoes"
        subtitle="Crie campanhas por percentual ou valor fixo, com periodo e aplicacao global ou por produto."
        action={<Button onClick={openCreate}>Nova promocao</Button>}
      />

      <DataCard title="Lista de promocoes">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando promocoes...</div> : null}

        {!loading ? (
          <>
            <div className="mb-3 admin-filter-bar rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nome ou descricao"
                className="h-9 min-w-[240px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              >
                <option value="all">Todos status</option>
                <option value="active">Ativas</option>
                <option value="scheduled">Agendadas</option>
                <option value="ended">Encerradas</option>
                <option value="inactive">Inativas</option>
              </select>
            </div>

            <Table
              columns={['Nome', 'Desconto', 'Aplicacao', 'Periodo', 'Status', 'Acoes']}
              rows={filteredPromotions}
              empty={<EmptyState title="Sem promocoes" description="Crie sua primeira promocao para comecar a vender com oferta." />}
              renderRow={(promotion) => (
                <tr key={promotion.id}>
                  <td>
                    <div className="table-title-cell">
                      <strong className="font-semibold text-slate-900">{promotion.name}</strong>
                      <small>{promotion.description || '-'}</small>
                    </div>
                  </td>
                  <td>
                    <div className="table-title-cell">
                      <strong>{promotion.promotion_badge}</strong>
                      <small>{promotion.discount_type === 'percentage' ? 'Percentual' : 'Valor fixo'}</small>
                    </div>
                  </td>
                  <td>
                    {promotion.applies_to_all
                      ? `Todos os produtos (${promotion.affected_products_count})`
                      : `${promotion.affected_products_count} produto(s) selecionado(s)`}
                  </td>
                  <td>
                    <div className="table-title-cell">
                      <small>Inicio: {formatDateTime(promotion.start_at)}</small>
                      <small>Fim: {formatDateTime(promotion.end_at)}</small>
                    </div>
                  </td>
                  <td>
                    <StatusBadge tone={statusTone(promotion.status)}>{statusLabel(promotion.status)}</StatusBadge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => openEdit(promotion)}>Editar</Button>
                      <Button variant="ghost" onClick={() => setConfirmTarget(promotion)}>
                        {promotion.is_active ? 'Inativar' : 'Ativar'}
                      </Button>
                      <Button variant="danger" onClick={() => setDeleteTarget(promotion)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              )}
            />
          </>
        ) : null}
      </DataCard>

      <Modal
        open={isModalOpen}
        title={editingId ? 'Editar promocao' : 'Nova promocao'}
        onClose={() => setIsModalOpen(false)}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={submitForm}>{editingId ? 'Salvar alteracoes' : 'Criar promocao'}</Button>
          </>
        )}
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submitForm}>
          <Input
            label="Nome da promocao"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <Select
            label="Tipo de desconto"
            options={[
              { value: 'percentage', label: 'Percentual (%)' },
              { value: 'fixed', label: 'Valor fixo (R$)' },
            ]}
            value={form.discount_type}
            onChange={(event) => setForm((current) => ({ ...current, discount_type: event.target.value }))}
          />
          <Input
            label={form.discount_type === 'percentage' ? 'Percentual (%)' : 'Valor fixo (R$)'}
            type="number"
            min="0"
            step="0.01"
            value={form.discount_value}
            onChange={(event) => setForm((current) => ({ ...current, discount_value: event.target.value }))}
            required
          />
          <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview rapido</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">
                Preco base
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={previewBasePrice}
                  onChange={(event) => setPreviewBasePrice(event.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                />
              </label>
              <div className="text-xs text-slate-600">
                Preco final
                <p className="mt-2 text-base font-semibold text-emerald-700">R$ {Number(previewPrice || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Descricao</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[88px] w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              placeholder="Detalhes internos da campanha"
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.applies_to_all}
              onChange={(event) => setForm((current) => ({ ...current, applies_to_all: event.target.checked }))}
            />
            <span>Aplicar a todos os produtos</span>
          </label>

          {!form.applies_to_all ? (
            <div className="md:col-span-2 rounded-[10px] border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produtos selecionados</p>
              <div className="mt-2 max-h-[220px] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2">
                {(products || []).map((product) => (
                  <label key={product.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={(form.product_ids || []).includes(product.id)}
                      onChange={(event) => toggleProductSelection(product.id, event.target.checked)}
                    />
                    <span>{product.title}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{(form.product_ids || []).length} produto(s) selecionado(s).</p>
            </div>
          ) : null}

          <Input
            label="Inicio da promocao"
            type="datetime-local"
            value={form.start_at}
            onChange={(event) => setForm((current) => ({ ...current, start_at: event.target.value }))}
          />
          <Input
            label="Fim da promocao"
            type="datetime-local"
            value={form.end_at}
            onChange={(event) => setForm((current) => ({ ...current, end_at: event.target.value }))}
          />

          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            <span>Promocao ativa</span>
          </label>

          {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        title="Confirmar alteracao"
        onClose={() => setConfirmTarget(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmToggleStatus}>Confirmar</Button>
          </>
        )}
      >
        <p>Deseja {confirmTarget?.is_active ? 'inativar' : 'ativar'} a promocao <strong>{confirmTarget?.name}</strong>?</p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Confirmar exclusao"
        onClose={() => setDeleteTarget(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Excluir</Button>
          </>
        )}
      >
        <p>Deseja excluir a promocao <strong>{deleteTarget?.name}</strong>? Essa acao nao pode ser desfeita.</p>
      </Modal>
    </section>
  );
}

export default AdminPromotionsPage;
