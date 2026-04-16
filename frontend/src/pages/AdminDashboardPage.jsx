import { useEffect, useState } from 'react';
import ChartCard from '../components/charts/ChartCard';
import MiniBarChart from '../components/charts/MiniBarChart';
import MetricCard from '../components/ui/MetricCard';
import SectionHeader from '../components/ui/SectionHeader';
import { fetchAdminSummary } from '../services/api';

function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAdminSummary()
      .then(setSummary)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="admin-page-pro">
      <SectionHeader
        eyebrow="Visao geral"
        title="Dashboard"
        subtitle="Métricas executivas para acompanhar saude comercial"
      />

      {loading ? <div className="loading-state-pro">Carregando...</div> : null}
      {error ? <div className="empty-state-pro">{error}</div> : null}

      {!loading && !error && summary ? (
        <>
          <div className="metrics-grid-pro">
            <MetricCard label="Produtos ativos" value={summary.total_products} helper="Catalogo publicado" />
            <MetricCard label="Pedidos" value={summary.total_orders} helper="Pedidos totais" />
            <MetricCard label="Vendas" value={`R$ ${summary.total_sold.toFixed(2)}`} helper="Valor acumulado" />
          </div>

          <div className="charts-grid-pro">
            <ChartCard title="Vendas por periodo">
              <MiniBarChart points={summary.sales_series || []} money />
            </ChartCard>
            <ChartCard title="Pedidos por periodo">
              <MiniBarChart points={summary.orders_series || []} />
            </ChartCard>
            <ChartCard title="Produtos mais vendidos">
              <ul className="top-products-list">
                {(summary.top_products || []).map((item) => (
                  <li key={item.title}>
                    <span>{item.title}</span>
                    <strong>{item.quantity} un.</strong>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="Distribuicao de status">
              <ul className="status-chart-list">
                {(summary.order_status || []).map((item) => (
                  <li key={item.status}>
                    <span>{item.status}</span>
                    <strong>{item.value}</strong>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default AdminDashboardPage;
