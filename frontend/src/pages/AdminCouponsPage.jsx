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
import usePersistentState from '../hooks/usePersistentState';
import {
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  setAdminCouponStatus,
  updateAdminCoupon,
} from '../services/api';

const initialForm = {
  code: '',
  type: 'percent',
  value: '0',
  is_active: true,
};

function toPayload(form) {
  return {
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: Number(form.value || 0),
    is_active: form.is_active,
  };
}

function fromCoupon(coupon) {
  return {
    code: coupon.code,
    type: coupon.type,
    value: String(coupon.value ?? 0),
    is_active: coupon.is_active,
  };
}

function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = usePersistentState('modal:admin-coupons:form', initialForm);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = usePersistentState('modal:admin-coupons:open', false);
  const [editingId, setEditingId] = usePersistentState('modal:admin-coupons:editing-id', null);
  const [confirmTarget, setConfirmTarget] = usePersistentState('modal:admin-coupons:confirm-target', null);
  const [deleteTarget, setDeleteTarget] = usePersistentState('modal:admin-coupons:delete-target', null);
  const [modalMode, setModalMode] = usePersistentState('modal:admin-coupons:mode', 'create');

  const loadCoupons = () => {
    setLoading(true);
    fetchAdminCoupons()
      .then(setCoupons)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar cupons.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const openCreate = () => {
    const shouldResetForm = editingId !== null || modalMode !== 'create';
    if (shouldResetForm) setForm(initialForm);
    setEditingId(null);
    setError('');
    setModalMode('create');
    setIsModalOpen(true);
  };

  const openEdit = (coupon) => {
    const sameEditingTarget = editingId === coupon.id && modalMode === 'edit';
    setEditingId(coupon.id);
    if (!sameEditingTarget) setForm(fromCoupon(coupon));
    setError('');
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
        await updateAdminCoupon(editingId, payload);
      } else {
        await createAdminCoupon(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setModalMode('create');
      setForm(initialForm);
      loadCoupons();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar cupom.');
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget) return;
    try {
      await setAdminCouponStatus(confirmTarget.id, !confirmTarget.is_active);
      setConfirmTarget(null);
      loadCoupons();
    } catch (statusError) {
      setError(statusError.message || 'Falha ao atualizar status.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAdminCoupon(deleteTarget.id);
      setDeleteTarget(null);
      loadCoupons();
    } catch (deleteError) {
      setError(deleteError.message || 'Falha ao excluir cupom.');
    }
  };

  const typeOptions = [
    { value: 'percent', label: 'Percentual (%)' },
    { value: 'fixed', label: 'Valor fixo (R$)' },
  ];

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Campanhas"
        title="Cupons"
        subtitle="Cadastre cupons com percentual ou valor fixo"
        action={<Button onClick={openCreate}>Novo cupom</Button>}
      />

      <DataCard title="Lista de cupons">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando cupons...</div> : null}

        {!loading ? (
          <Table
            columns={['Codigo', 'Tipo', 'Valor', 'Status', 'Acoes']}
            rows={coupons}
            empty={<EmptyState title="Sem cupons" description="Crie seu primeiro cupom para campanhas." />}
            renderRow={(coupon) => (
              <tr key={coupon.id}>
                <td><strong className="font-semibold text-slate-900">{coupon.code}</strong></td>
                <td>{coupon.type === 'percent' ? 'Percentual' : 'Valor fixo'}</td>
                <td>{coupon.type === 'percent' ? `${coupon.value}%` : `R$ ${coupon.value.toFixed(2)}`}</td>
                <td>
                  <StatusBadge tone={coupon.is_active ? 'success' : 'danger'}>
                    {coupon.is_active ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => openEdit(coupon)}>Editar</Button>
                    <Button variant="ghost" onClick={() => setConfirmTarget(coupon)}>
                      {coupon.is_active ? 'Inativar' : 'Ativar'}
                    </Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(coupon)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            )}
          />
        ) : null}
      </DataCard>

      <Modal
        open={isModalOpen}
        title={editingId ? 'Editar cupom' : 'Novo cupom'}
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={submitForm}>{editingId ? 'Salvar alteracoes' : 'Criar cupom'}</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submitForm}>
          <Input
            label="Codigo"
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            required
          />
          <Select
            label="Tipo de desconto"
            options={typeOptions}
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
          />
          <Input
            label={form.type === 'percent' ? 'Percentual (%)' : 'Valor fixo (R$)'}
            type="number"
            min="0"
            step="0.01"
            value={form.value}
            onChange={(event) => setForm({ ...form, value: event.target.value })}
            required
          />
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            <span>Cupom ativo</span>
          </label>
          <p className="md:col-span-2 text-xs text-slate-500">Use percentual ou valor fixo. O sistema valida automaticamente.</p>
          {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        title="Confirmar alteracao"
        onClose={() => setConfirmTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmToggleStatus}>Confirmar</Button>
          </>
        }
      >
        <p>
          Deseja {confirmTarget?.is_active ? 'inativar' : 'ativar'} o cupom <strong>{confirmTarget?.code}</strong>?
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Confirmar exclusao"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Excluir</Button>
          </>
        }
      >
        <p>Deseja excluir o cupom <strong>{deleteTarget?.code}</strong>? Essa acao nao pode ser desfeita.</p>
      </Modal>
    </section>
  );
}

export default AdminCouponsPage;
