import { useEffect, useMemo, useState } from 'react';
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

function formatMoney(value) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function StatList({ items, keyField = 'label', labelField = 'label', valueField = 'value', suffix = '' }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-500">Nenhum dado para o periodo selecionado.</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item[keyField]} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
          <span className="line-clamp-1 text-slate-600">{item[labelField]}</span>
          <strong className="font-semibold text-slate-900">
            {item[valueField]}
            {suffix}
          </strong>
        </li>
      ))}
    </ul>
  );
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

  const periodLabel = useMemo(() => {
    if (filterMode === 'day') return dayFilter || 'Dia nao selecionado';
    if (filterMode === 'month') return monthFilter || 'Mes nao selecionado';
    return yearFilter || 'Ano nao selecionado';
  }, [filterMode, dayFilter, monthFilter, yearFilter]);

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
        subtitle="Acompanhe desempenho comercial, conversao e comportamento dos usuarios em um unico painel."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="admin-filter-bar">
          <select
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
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
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          ) : null}

          {filterMode === 'month' ? (
            <input
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          ) : null}

          {filterMode === 'year' ? (
            <input
              type="number"
              min="2020"
              max="2100"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="h-10 w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          ) : null}

          <Button variant="secondary" onClick={loadSummary} loading={loading} className="h-10 px-5">
            Aplicar filtro
          </Button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Periodo: {periodLabel}
          </span>
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando dashboard...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error && summary ? (
        <>
          <div className="admin-card-grid-4">
            <MetricCard label="Vendas" value={formatMoney(summary.total_sold)} helper="Receita no periodo" />
            <MetricCard label="Pedidos" value={summary.total_orders || 0} helper="Pedidos confirmados" />
            <MetricCard label="Itens vendidos" value={summary.total_items_sold || 0} helper="Volume comercializado" />
            <MetricCard
              label="Conversao carrinho para WhatsApp"
              value={`${Number(summary.conversion_add_to_whatsapp || 0).toFixed(2)}%`}
              helper="AddToCart x SendToWhatsApp"
            />
          </div>

          <div className="admin-card-grid-3">
            <MetricCard label="Produtos ativos" value={summary.total_products || 0} helper="Catalogo publicado" />
            <MetricCard label="Sessoes geolocalizadas" value={summary.geolocated_sessions || 0} helper="Com pais, estado e cidade" />
            <MetricCard label="Ticket medio estimado" value={formatMoney((summary.total_sold || 0) / Math.max(summary.total_orders || 0, 1))} helper="Vendas / pedidos" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Vendas por periodo">
              <MiniBarChart points={summary.sales_series || []} money />
            </ChartCard>
            <ChartCard title="Pedidos por periodo">
              <MiniBarChart points={summary.orders_series || []} />
            </ChartCard>
            <ChartCard title="Funil de conversao">
              <MiniBarChart points={summary.funnel || []} />
            </ChartCard>
            <ChartCard title="Distribuicao de status">
              <StatList items={summary.order_status || []} keyField="status" labelField="status" valueField="value" />
            </ChartCard>
            <ChartCard title="Produtos mais vendidos">
              <StatList items={summary.top_products || []} keyField="title" labelField="title" valueField="quantity" suffix=" un." />
            </ChartCard>
            <ChartCard title="Produtos mais vistos">
              <StatList items={summary.most_viewed_products || []} keyField="title" labelField="title" valueField="quantity" />
            </ChartCard>
            <ChartCard title="Produtos mais adicionados">
              <StatList items={summary.most_added_products || []} keyField="title" labelField="title" valueField="quantity" />
            </ChartCard>
            <ChartCard title="Top paises">
              <StatList items={summary.top_countries || []} />
            </ChartCard>
            <ChartCard title="Top estados">
              <StatList items={summary.top_states || []} />
            </ChartCard>
            <ChartCard title="Top cidades">
              <StatList items={summary.top_cities || []} />
            </ChartCard>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default AdminDashboardPage;
