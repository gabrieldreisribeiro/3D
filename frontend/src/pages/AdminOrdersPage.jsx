import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import usePersistentState from '../hooks/usePersistentState';
import { fetchAdminOrders } from '../services/api';

function ColorPreview({ primary, secondary }) {
  const normalizedPrimary = String(primary || '').trim();
  const normalizedSecondary = String(secondary || '').trim();
  if (!normalizedPrimary && !normalizedSecondary) return null;

  const hasSecondary = Boolean(normalizedSecondary);
  const style = hasSecondary
    ? { background: `linear-gradient(90deg, ${normalizedPrimary || '#ffffff'} 0 50%, ${normalizedSecondary} 50% 100%)` }
    : { backgroundColor: normalizedPrimary || normalizedSecondary };

  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-600">
      <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={style} />
      <span>{hasSecondary ? 'Cor + furta cor' : 'Cor principal'}</span>
    </span>
  );
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = usePersistentState('modal:admin-orders:selected-order', null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchAdminOrders()
      .then(setOrders)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar pedidos.'))
      .finally(() => setLoading(false));
  }, []);

  const getStatusTone = (status) => (status === 'paid' ? 'success' : 'warning');
  const getStatusLabel = (status) => (status === 'paid' ? 'Pago' : 'Pendente');
  const getMethodLabel = (method) => {
    if (method === 'pix') return 'Pix';
    if (method === 'whatsapp') return 'WhatsApp';
    return method || '-';
  };

  const filteredOrders = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    return orders.filter((order) => {
      const matchesQuery = !query
        || String(order.id || '').includes(query)
        || String(order.total || '').toLowerCase().includes(query)
        || String(order.coupon_code || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || String(order.payment_status || '') === statusFilter;
      const matchesPayment = paymentFilter === 'all' || String(order.payment_method || '') === paymentFilter;
      return matchesQuery && matchesStatus && matchesPayment;
    });
  }, [orders, searchTerm, statusFilter, paymentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentFilter, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <section className="admin-page space-y-6">
      <SectionHeader eyebrow="Operacao" title="Pedidos" subtitle="Acompanhe detalhes e totais" />

      <DataCard title="Lista de pedidos">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando pedidos...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {!loading && !error ? (
          <>
            <div className="mb-3 admin-filter-bar rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por pedido, cupom ou total"
                className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              >
                <option value="all">Todos status</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
              </select>
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
              >
                <option value="all">Todos pagamentos</option>
                <option value="pix">Pix</option>
                <option value="whatsapp">WhatsApp</option>
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
              columns={['Pedido', 'Data', 'Total', 'Status', 'Pagamento', 'Acoes']}
              rows={paginatedOrders}
              empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhum pedido registrado.</div>}
              renderRow={(order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-'}</td>
                  <td>R$ {Number(order.total || 0).toFixed(2)}</td>
                  <td>
                    <StatusBadge tone={getStatusTone(order.payment_status)}>{getStatusLabel(order.payment_status)}</StatusBadge>
                  </td>
                  <td>
                    <span className="text-sm text-slate-600">{getMethodLabel(order.payment_method)}</span>
                  </td>
                  <td>
                    <Button variant="secondary" onClick={() => setSelectedOrder(order)}>
                      Ver detalhes
                    </Button>
                  </td>
                </tr>
              )}
            />

            <div className="mt-3 admin-pagination-bar rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                Mostrando <strong>{filteredOrders.length ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</strong> de <strong>{filteredOrders.length}</strong> pedidos
              </p>
              <div className="admin-pagination-actions">
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>
                  Anterior
                </Button>
                <span className="text-xs text-slate-600">Pagina {currentPage} de {totalPages}</span>
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>
                  Proxima
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DataCard>

      <Modal
        open={Boolean(selectedOrder)}
        title={`Pedido #${selectedOrder?.id || ''}`}
        onClose={() => setSelectedOrder(null)}
        footer={<Button onClick={() => setSelectedOrder(null)}>Fechar</Button>}
      >
        {selectedOrder ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Subtotal: <strong className="text-slate-900">R$ {Number(selectedOrder.subtotal || 0).toFixed(2)}</strong></p>
            <p>Desconto: <strong className="text-slate-900">R$ {Number(selectedOrder.discount || 0).toFixed(2)}</strong></p>
            <p>Total: <strong className="text-slate-900">R$ {Number(selectedOrder.total || 0).toFixed(2)}</strong></p>
            <p>Status: <strong className="text-slate-900">{getStatusLabel(selectedOrder.payment_status)}</strong></p>
            <p>Pagamento: <strong className="text-slate-900">{getMethodLabel(selectedOrder.payment_method)}</strong></p>
            <ul className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {(selectedOrder.items || []).map((item) => {
                const computedLineTotal = Number(item.unit_price || 0) * Number(item.quantity || 0);
                const providedLineTotal = Number(item.line_total || 0);
                const lineTotal = providedLineTotal > 0 ? providedLineTotal : computedLineTotal;

                return (
                  <li key={item.id} className="space-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span>{item.quantity}x {item.title}</span>
                      <strong className="text-slate-900">R$ {lineTotal.toFixed(2)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Unitario: R$ {Number(item.unit_price || 0).toFixed(2)}</span>
                      {item.selected_color || item.selected_secondary_color ? (
                        <ColorPreview primary={item.selected_color} secondary={item.selected_secondary_color} />
                      ) : <span>Sem cor registrada</span>}
                    </div>
                    {(item.selected_sub_items || []).length ? (
                      <div className="space-y-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                        {(item.selected_sub_items || []).map((subItem, index) => (
                          <div key={`${item.id}-sub-${index}`} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <span>{subItem.quantity}x {subItem.title}</span>
                              {subItem.selected_color || subItem.selected_secondary_color ? (
                                <ColorPreview primary={subItem.selected_color} secondary={subItem.selected_secondary_color} />
                              ) : null}
                            </span>
                            <strong>R$ {(Number(subItem.unit_price || 0) * Number(subItem.quantity || 0)).toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">Sem subitens neste item.</p>}
                    {(item.name_personalizations || []).length ? (
                      <div className="space-y-1 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        <p className="font-semibold">Textos para personalizacao:</p>
                        {(item.name_personalizations || []).map((name, index) => (
                          <p key={`${item.id}-name-${index}`}>
                            Unidade {index + 1}: {String(name || '').trim() || '(sem texto)'}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default AdminOrdersPage;


