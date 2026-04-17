import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import usePersistentState from '../hooks/usePersistentState';
import { fetchAdminOrders } from '../services/api';

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = usePersistentState('modal:admin-orders:selected-order', null);

  useEffect(() => {
    fetchAdminOrders()
      .then(setOrders)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar pedidos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-6">
      <SectionHeader eyebrow="Operacao" title="Pedidos" subtitle="Acompanhe detalhes e totais" />

      <DataCard title="Lista de pedidos">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando pedidos...</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {!loading && !error ? (
          <Table
            columns={['Pedido', 'Data', 'Total', 'Status', 'Acoes']}
            rows={orders}
            empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhum pedido registrado.</div>}
            renderRow={(order) => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td>R$ {order.total.toFixed(2)}</td>
                <td>
                  <StatusBadge tone="success">Concluido</StatusBadge>
                </td>
                <td>
                  <Button variant="secondary" onClick={() => setSelectedOrder(order)}>
                    Ver detalhes
                  </Button>
                </td>
              </tr>
            )}
          />
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
            <p>Subtotal: <strong className="text-slate-900">R$ {selectedOrder.subtotal.toFixed(2)}</strong></p>
            <p>Desconto: <strong className="text-slate-900">R$ {selectedOrder.discount.toFixed(2)}</strong></p>
            <p>Total: <strong className="text-slate-900">R$ {selectedOrder.total.toFixed(2)}</strong></p>
            <ul className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {selectedOrder.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{item.quantity}x {item.title}</span>
                  <strong className="text-slate-900">R$ {item.unit_price.toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default AdminOrdersPage;
