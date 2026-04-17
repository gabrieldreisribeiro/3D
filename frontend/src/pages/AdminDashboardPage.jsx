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
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Visao geral"
        title="Dashboard"
        subtitle="Métricas executivas para acompanhar saude comercial"
      />

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando...</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error && summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label="Produtos ativos" value={summary.total_products} helper="Catalogo publicado" />
            <MetricCard label="Pedidos" value={summary.total_orders} helper="Pedidos totais" />
            <MetricCard label="Vendas" value={`R$ ${summary.total_sold.toFixed(2)}`} helper="Valor acumulado" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Vendas por periodo">
              <MiniBarChart points={summary.sales_series || []} money />
            </ChartCard>
            <ChartCard title="Pedidos por periodo">
              <MiniBarChart points={summary.orders_series || []} />
            </ChartCard>
            <ChartCard title="Produtos mais vendidos">
              <ul className="space-y-2 text-sm">
                {(summary.top_products || []).map((item) => (
                  <li key={item.title} className="flex items-center justify-between rounded-[10px] border border-slate-100 px-3 py-2">
                    <span className="text-slate-600">{item.title}</span>
                    <strong className="font-semibold text-slate-900">{item.quantity} un.</strong>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="Distribuicao de status">
              <ul className="space-y-2 text-sm">
                {(summary.order_status || []).map((item) => (
                  <li key={item.status} className="flex items-center justify-between rounded-[10px] border border-slate-100 px-3 py-2">
                    <span className="text-slate-600">{item.status}</span>
                    <strong className="font-semibold text-slate-900">{item.value}</strong>
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
