import { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import { fetchAdminOrders } from '../services/api';

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchAdminOrders()
      .then(setOrders)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar pedidos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="admin-page-pro">
      <SectionHeader eyebrow="Operacao" title="Pedidos" subtitle="Acompanhe detalhes e totais" />

      <DataCard title="Lista de pedidos">
        {loading ? <div className="loading-state-pro">Carregando pedidos...</div> : null}
        {error ? <div className="empty-state-pro">{error}</div> : null}
        {!loading && !error ? (
          <Table
            columns={['Pedido', 'Data', 'Total', 'Status', 'Acoes']}
            rows={orders}
            empty={<div className="empty-state-pro">Nenhum pedido registrado.</div>}
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
          <div className="order-detail-modal">
            <p>Subtotal: R$ {selectedOrder.subtotal.toFixed(2)}</p>
            <p>Desconto: R$ {selectedOrder.discount.toFixed(2)}</p>
            <p>Total: R$ {selectedOrder.total.toFixed(2)}</p>
            <ul>
              {selectedOrder.items.map((item) => (
                <li key={item.id}>
                  <span>{item.quantity}x {item.title}</span>
                  <strong>R$ {item.unit_price.toFixed(2)}</strong>
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
