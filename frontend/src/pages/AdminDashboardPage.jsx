import { useEffect, useState } from 'react';
import ChartCard from '../components/charts/ChartCard';
import MiniBarChart from '../components/charts/MiniBarChart';
import Button from '../components/ui/Button';
import MetricCard from '../components/ui/MetricCard';
import SectionHeader from '../components/ui/SectionHeader';
import { fetchAdminSummary } from '../services/api';

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateRange(filterMode, day, month, year) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const safeYear = Number(year) || currentYear;

  if (filterMode === 'day') {
    if (!day) return { date_from: null, date_to: null };
    return { date_from: day, date_to: day };
  }

  if (filterMode === 'month') {
    const source = month || `${currentYear}-${pad(now.getMonth() + 1)}`;
    const [yRaw, mRaw] = source.split('-');
    const y = Number(yRaw);
    const m = Number(mRaw);
    if (!y || !m) return { date_from: null, date_to: null };
    const lastDay = new Date(y, m, 0).getDate();
    return {
      date_from: `${y}-${pad(m)}-01`,
      date_to: `${y}-${pad(m)}-${pad(lastDay)}`,
    };
  }

  return {
    date_from: `${safeYear}-01-01`,
    date_to: `${safeYear}-12-31`,
  };
}

function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState('month');
  const [dayFilter, setDayFilter] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  });
  const [yearFilter, setYearFilter] = useState(() => String(new Date().getFullYear()));

  const loadSummary = () => {
    setLoading(true);
    setError('');
    const period = toDateRange(filterMode, dayFilter, monthFilter, yearFilter);
    fetchAdminSummary(period)
      .then(setSummary)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar dashboard.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Visao geral"
        title="Dashboard"
        subtitle="Metricas executivas para acompanhar saude comercial"
      />

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="admin-filter-bar">
          <select
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="day">Filtrar por dia</option>
            <option value="month">Filtrar por mes</option>
            <option value="year">Filtrar por ano</option>
          </select>

          {filterMode === 'day' ? (
            <input
              type="date"
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
            />
          ) : null}

          {filterMode === 'month' ? (
            <input
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
            />
          ) : null}

          {filterMode === 'year' ? (
            <input
              type="number"
              min="2020"
              max="2100"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
            />
          ) : null}

          <Button variant="secondary" onClick={loadSummary} loading={loading}>
            Aplicar filtro
          </Button>
        </div>
      </div>

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
