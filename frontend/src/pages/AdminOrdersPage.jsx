import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import usePersistentState from '../hooks/usePersistentState';
import {
  fetchAdminOrderFlowStages,
  fetchAdminOrders,
  moveAdminOrderStage,
  updateAdminOrderPaymentStatus,
  updateAdminOrderProductionStatus,
} from '../services/api';

function paymentTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'paid') return 'success';
  if (key === 'failed' || key === 'canceled') return 'danger';
  return 'warning';
}

function paymentLabel(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'paid') return 'Pago';
  if (key === 'pending_payment') return 'Aguardando pagamento';
  if (key === 'awaiting_confirmation') return 'Aguardando confirmacao';
  if (key === 'failed') return 'Falhou';
  if (key === 'canceled') return 'Cancelado';
  return 'Pendente';
}

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'pending_payment', label: 'Aguardando pagamento' },
  { value: 'awaiting_confirmation', label: 'Aguardando confirmacao' },
  { value: 'paid', label: 'Pago' },
  { value: 'failed', label: 'Falhou' },
  { value: 'canceled', label: 'Cancelado' },
];

function paymentMethodLabel(method) {
  const key = String(method || '').toLowerCase();
  if (key === 'pix') return 'Pix';
  if (key === 'credit_card') return 'Cartao';
  if (key === 'whatsapp') return 'WhatsApp';
  return '-';
}

function productionLabel(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'paid') return 'Pago';
  if (key === 'in_production') return 'Em producao';
  if (key === 'ready') return 'Pronto';
  return '-';
}

function productionTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'ready') return 'success';
  if (key === 'in_production') return 'info';
  if (key === 'paid') return 'warning';
  return 'neutral';
}

function customerName(order) {
  const byName = String(order.customer_name || '').trim();
  const byEmail = String(order.customer_email_snapshot || '').trim();
  const byPhone = String(order.customer_phone_snapshot || '').trim();
  return byName || byEmail || byPhone || 'Cliente nao identificado';
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = usePersistentState('modal:admin-orders:selected-order', null);
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [movingOrderId, setMovingOrderId] = useState(null);
  const [updatingProduction, setUpdatingProduction] = useState(false);
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);
  const [manualPaymentStatus, setManualPaymentStatus] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([fetchAdminOrders(), fetchAdminOrderFlowStages()])
      .then(([ordersData, stagesData]) => {
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setStages(Array.isArray(stagesData) ? stagesData : []);
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar pedidos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedOrder) return;
    setManualPaymentStatus(String(selectedOrder.payment_status || 'pending').toLowerCase());
  }, [selectedOrder]);

  const filteredOrders = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !query
        || String(order.id || '').includes(query)
        || String(customerName(order)).toLowerCase().includes(query)
        || String(order.customer_email_snapshot || '').toLowerCase().includes(query)
        || String(order.customer_phone_snapshot || '').toLowerCase().includes(query);
      const matchesPayment = paymentFilter === 'all' || String(order.payment_method || '') === paymentFilter;
      const matchesStatus = statusFilter === 'all' || String(order.payment_status || '') === statusFilter;
      const matchesStage = stageFilter === 'all' || Number(order.current_stage_id || 0) === Number(stageFilter || 0);
      const createdAt = order.created_at ? new Date(order.created_at) : null;
      const matchesFrom = !dateFrom || (createdAt && createdAt >= new Date(`${dateFrom}T00:00:00`));
      const matchesTo = !dateTo || (createdAt && createdAt <= new Date(`${dateTo}T23:59:59`));
      return matchesSearch && matchesPayment && matchesStatus && matchesStage && matchesFrom && matchesTo;
    });
  }, [orders, searchTerm, paymentFilter, statusFilter, stageFilter, dateFrom, dateTo]);

  const stageColumns = useMemo(() => {
    const activeStages = [...stages]
      .filter((stage) => Boolean(stage.is_active))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const grouped = activeStages.map((stage) => ({
      stage,
      orders: filteredOrders.filter((order) => Number(order.current_stage_id || 0) === Number(stage.id)),
    }));
    const withoutStage = filteredOrders.filter((order) => !order.current_stage_id || !activeStages.some((stage) => stage.id === order.current_stage_id));
    if (withoutStage.length) {
      grouped.unshift({
        stage: { id: 0, name: 'Sem etapa', color: '#94A3B8' },
        orders: withoutStage,
      });
    }
    return grouped;
  }, [stages, filteredOrders]);

  const summary = useMemo(() => {
    const total = filteredOrders.length;
    const paid = filteredOrders.filter((item) => String(item.payment_status || '').toLowerCase() === 'paid').length;
    const inProduction = filteredOrders.filter((item) => String(item.production_status || '').toLowerCase() === 'in_production').length;
    const ready = filteredOrders.filter((item) => String(item.production_status || '').toLowerCase() === 'ready').length;
    return { total, paid, inProduction, ready };
  }, [filteredOrders]);

  const handleMoveOrder = async (orderId, targetStageId) => {
    if (!orderId || !targetStageId || Number(targetStageId) <= 0) return;
    const order = orders.find((item) => item.id === orderId);
    if (!order || Number(order.current_stage_id || 0) === Number(targetStageId)) return;
    setMovingOrderId(orderId);
    setError('');
    setMessage('');
    try {
      const updated = await moveAdminOrderStage(orderId, { stage_id: targetStageId, note: 'kanban_drag_drop' });
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
      setMessage(`Pedido #${updated.id} movido com sucesso.`);
    } catch (requestError) {
      setError(requestError.message || 'Falha ao mover pedido.');
    } finally {
      setMovingOrderId(null);
      setDraggingOrderId(null);
    }
  };

  const applyProductionStatus = async (status) => {
    if (!selectedOrder?.id || !status) return;
    setUpdatingProduction(true);
    setError('');
    try {
      const updated = await updateAdminOrderProductionStatus(selectedOrder.id, status);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedOrder(updated);
      setMessage('Status de producao atualizado.');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao atualizar status de producao.');
    } finally {
      setUpdatingProduction(false);
    }
  };

  const applyPaymentStatus = async () => {
    if (!selectedOrder?.id || !manualPaymentStatus) return;
    setUpdatingPaymentStatus(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateAdminOrderPaymentStatus(selectedOrder.id, manualPaymentStatus);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedOrder(updated);
      setMessage('Status de pagamento atualizado.');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao atualizar status de pagamento.');
    } finally {
      setUpdatingPaymentStatus(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Operacao"
        title="Pedidos Kanban"
        subtitle="Arraste os pedidos entre as etapas do fluxo para acompanhar a operacao em tempo real."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Pedidos filtrados</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Pagos</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-800">{summary.paid}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Em producao</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-sky-800">{summary.inProduction}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Prontos</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-violet-800">{summary.ready}</p>
        </div>
      </section>

      <DataCard title="Filtros">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por pedido, cliente, email ou telefone"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
          />
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="all">Forma de pagamento (todas)</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="pix">Pix</option>
            <option value="credit_card">Cartao</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="all">Status de pagamento (todos)</option>
            <option value="pending">Pendente</option>
            <option value="pending_payment">Aguardando pagamento</option>
            <option value="awaiting_confirmation">Aguardando confirmacao</option>
            <option value="paid">Pago</option>
            <option value="failed">Falhou</option>
            <option value="canceled">Cancelado</option>
          </select>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="all">Etapa (todas)</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>{stage.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-9 px-3 text-xs"
            onClick={() => {
              setSearchTerm('');
              setPaymentFilter('all');
              setStatusFilter('all');
              setStageFilter('all');
              setDateFrom('');
              setDateTo('');
            }}
          >
            Limpar filtros
          </Button>
          <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={load}>
            Recarregar pedidos
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </DataCard>

      <DataCard title="Quadro operacional">
        {loading ? <p className="text-sm text-slate-500">Carregando quadro...</p> : null}
        {!loading ? (
          <div className="max-h-[78vh] overflow-x-auto overflow-y-hidden">
            <div className="flex min-w-max gap-4 pb-2">
              {stageColumns.map(({ stage, orders: stageOrders }) => (
                <section
                  key={stage.id}
                  className="flex h-[74vh] w-[310px] flex-col rounded-2xl border border-slate-200/60 bg-slate-50/50 backdrop-blur-xl p-3.5 shadow-sm transition-all duration-300"
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={() => {
                    if (draggingOrderId && stage.id) {
                      void handleMoveOrder(draggingOrderId, stage.id);
                    }
                  }}
                >
                  <header className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: stage.color || '#94A3B8' }} />
                      <h3 className="text-sm font-semibold text-slate-900">{stage.name}</h3>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">{stageOrders.length}</span>
                  </header>

                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {stageOrders.map((order) => (
                      <article
                        key={order.id}
                        draggable
                        onDragStart={() => setDraggingOrderId(order.id)}
                        onDragEnd={() => setDraggingOrderId(null)}
                        className={`kanban-drag-item rounded-xl border bg-white/90 backdrop-blur-sm p-3 ${
                          movingOrderId === order.id ? 'border-violet-300 opacity-70 scale-95 shadow-lg' : 'border-slate-200 hover:border-violet-200 hover:shadow-md'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">#{order.id}</p>
                          <StatusBadge tone={paymentTone(order.payment_status)}>{paymentLabel(order.payment_status)}</StatusBadge>
                        </div>
                        <p className="line-clamp-1 text-xs text-slate-600">{customerName(order)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <StatusBadge tone="neutral">{paymentMethodLabel(order.payment_method)}</StatusBadge>
                          <StatusBadge tone={productionTone(order.production_status)}>{productionLabel(order.production_status)}</StatusBadge>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Criado em {order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Itens: {Array.isArray(order.items) ? order.items.length : 0}
                        </p>
                        <p className="text-xs text-slate-500">
                          Previsao: {order.estimated_ready_at ? new Date(order.estimated_ready_at).toLocaleDateString('pt-BR') : '-'}
                        </p>
                        <Button variant="secondary" className="mt-3 w-full text-xs" onClick={() => setSelectedOrder(order)}>
                          Ver detalhes
                        </Button>
                      </article>
                    ))}
                    {!stageOrders.length ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
                        Nenhum pedido nesta etapa
                      </div>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : null}
      </DataCard>

      <Modal
        open={Boolean(selectedOrder)}
        title={`Pedido #${selectedOrder?.id || ''}`}
        onClose={() => setSelectedOrder(null)}
        footer={<Button onClick={() => setSelectedOrder(null)}>Fechar</Button>}
      >
        {selectedOrder ? (
          <div className="space-y-4 text-sm text-slate-600">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Cliente</p>
                <p className="mt-1 font-semibold text-slate-900">{customerName(selectedOrder)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 font-semibold text-slate-900">{Number(selectedOrder.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Pagamento</p>
                <p className="mt-1 font-semibold text-slate-900">{paymentLabel(selectedOrder.payment_status)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Metodo</p>
                <p className="mt-1 font-semibold text-slate-900">{paymentMethodLabel(selectedOrder.payment_method)}</p>
              </div>
            </div>
            <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status de pagamento manual</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={manualPaymentStatus}
                  onChange={(event) => setManualPaymentStatus(event.target.value)}
                  className="h-10 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
                >
                  {PAYMENT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  loading={updatingPaymentStatus}
                  onClick={applyPaymentStatus}
                  disabled={manualPaymentStatus === String(selectedOrder.payment_status || '').toLowerCase()}
                >
                  Atualizar pagamento
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Use esta opcao quando receber pagamento fora do site para liberar o fluxo operacional.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Etapa atual</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedOrder.current_stage_name || '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Atualizada em</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedOrder.current_stage_updated_at ? new Date(selectedOrder.current_stage_updated_at).toLocaleString('pt-BR') : '-'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Producao</p>
                <p className="mt-1 font-semibold text-slate-900">{productionLabel(selectedOrder.production_status)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Previsao conclusao</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedOrder.estimated_ready_at ? new Date(selectedOrder.estimated_ready_at).toLocaleString('pt-BR') : '-'}</p>
              </div>
            </div>
            {String(selectedOrder.payment_status || '').toLowerCase() === 'paid' ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" loading={updatingProduction} onClick={() => applyProductionStatus('paid')}>
                  Marcar como Pago
                </Button>
                <Button type="button" variant="secondary" loading={updatingProduction} onClick={() => applyProductionStatus('in_production')}>
                  Marcar Em producao
                </Button>
                <Button type="button" variant="secondary" loading={updatingProduction} onClick={() => applyProductionStatus('ready')}>
                  Marcar Pronto
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default AdminOrdersPage;
