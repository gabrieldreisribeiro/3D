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
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Visao geral"
        title="Dashboard"
        subtitle="Métricas executivas para acompanhar saude comercial"
      />

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando...</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error && summary ? (
        <>
          <div className="admin-card-grid-3">
            <MetricCard label="Produtos ativos" value={summary.total_products} helper="Catalogo publicado" />
            <MetricCard label="Pedidos" value={summary.total_orders} helper="Pedidos totais" />
            <MetricCard label="Vendas" value={`R$ ${summary.total_sold.toFixed(2)}`} helper="Valor acumulado" />
          </div>

          <div className="admin-card-grid-3">
            <MetricCard label="Itens vendidos" value={summary.total_items_sold || 0} helper="Volume total" />
            <MetricCard label="Valor estimado" value={`R$ ${(summary.total_sold || 0).toFixed(2)}`} helper="Pedidos confirmados" />
            <MetricCard label="Conversao carrinho ? WhatsApp" value={`${Number(summary.conversion_add_to_whatsapp || 0).toFixed(2)}%`} helper="Sessoes com add_to_cart x send_whatsapp" />
          </div>

          <div className="admin-card-grid-4">
            <MetricCard label="Sessoes geolocalizadas" value={summary.geolocated_sessions || 0} helper="Com pais/estado/cidade" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
            <ChartCard title="Funil de conversao">
              <MiniBarChart points={summary.funnel || []} />
            </ChartCard>
            <ChartCard title="Produtos mais vistos">
              <ul className="space-y-2 text-sm">
                {(summary.most_viewed_products || []).map((item) => (
                  <li key={item.title} className="flex items-center justify-between rounded-[10px] border border-slate-100 px-3 py-2">
                    <span className="text-slate-600">{item.title}</span>
                    <strong className="font-semibold text-slate-900">{item.quantity}</strong>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="Produtos mais adicionados">
              <ul className="space-y-2 text-sm">
                {(summary.most_added_products || []).map((item) => (
                  <li key={item.title} className="flex items-center justify-between rounded-[10px] border border-slate-100 px-3 py-2">
                    <span className="text-slate-600">{item.title}</span>
                    <strong className="font-semibold text-slate-900">{item.quantity}</strong>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="Top paises">
              <ul className="space-y-2 text-sm">
                {(summary.top_countries || []).map((item) => (
                  <li key={item.label} className="flex items-center justify-between rounded-[10px] border border-slate-100 px-3 py-2">
                    <span className="text-slate-600">{item.label}</span>
                    <strong className="font-semibold text-slate-900">{item.value}</strong>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="Top estados">
              <ul className="space-y-2 text-sm">
                {(summary.top_states || []).map((item) => (
                  <li key={item.label} className="flex items-center justify-between rounded-[10px] border border-slate-100 px-3 py-2">
                    <span className="text-slate-600">{item.label}</span>
                    <strong className="font-semibold text-slate-900">{item.value}</strong>
                  </li>
                ))}
              </ul>
            </ChartCard>
            <ChartCard title="Top cidades">
              <ul className="space-y-2 text-sm">
                {(summary.top_cities || []).map((item) => (
                  <li key={item.label} className="flex items-center justify-between rounded-[10px] border border-slate-100 px-3 py-2">
                    <span className="text-slate-600">{item.label}</span>
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


