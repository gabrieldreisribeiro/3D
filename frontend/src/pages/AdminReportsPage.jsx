import { useEffect, useMemo, useState } from 'react';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import {
  fetchAdminReportLeads,
  fetchAdminReportSales,
  fetchAdminReportTopProducts,
} from '../services/api';

function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [leads, setLeads] = useState({ total_leads: 0, items: [], top_products: [] });

  const loadReports = () => {
    setLoading(true);
    setError('');
    const params = {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      payment_method: paymentMethod === 'all' ? undefined : paymentMethod,
    };
    Promise.all([
      fetchAdminReportSales(params),
      fetchAdminReportTopProducts(params),
      fetchAdminReportLeads(params),
    ])
      .then(([salesData, topData, leadsData]) => {
        setSales(salesData);
        setTopProducts(topData.items || []);
        setLeads(leadsData || { total_leads: 0, items: [], top_products: [] });
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar relatorios.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, []);

  const totalLeadRows = useMemo(() => leads.items || [], [leads.items]);

  return (
    <section className="admin-page space-y-6">
      <SectionHeader eyebrow="Inteligencia" title="Relatorios" subtitle="Vendas, comportamento e leads por periodo" />

      <DataCard title="Filtros">
        <div className="admin-filter-bar items-end">
          <label className="grid gap-1 text-xs text-slate-600">
            Data inicial
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Data final
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Metodo de pagamento
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
            >
              <option value="all">Todos</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="pix">Pix</option>
              <option value="credit_card">Cartao</option>
            </select>
          </label>
          <Button onClick={loadReports} loading={loading} loadingText="Aplicando..." className="w-full sm:w-auto">
            Aplicar filtro
          </Button>
        </div>
      </DataCard>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DataCard title="Total de vendas">
          <p className="text-2xl font-semibold text-slate-900">R$ {Number(sales?.total_value || 0).toFixed(2)}</p>
        </DataCard>
        <DataCard title="Pedidos no periodo">
          <p className="text-2xl font-semibold text-slate-900">{Number(sales?.order_count || 0)}</p>
        </DataCard>
        <DataCard title="Ticket medio">
          <p className="text-2xl font-semibold text-slate-900">R$ {Number(sales?.avg_ticket || 0).toFixed(2)}</p>
        </DataCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DataCard title="Total por metodo">
          <Table
            columns={['Metodo', 'Total']}
            rows={sales?.by_payment_method || []}
            empty={<div className="text-sm text-slate-500">Sem dados por metodo.</div>}
            renderRow={(item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>R$ {Number(item.value || 0).toFixed(2)}</td>
              </tr>
            )}
          />
        </DataCard>
        <DataCard title="Ticket medio por metodo">
          <Table
            columns={['Metodo', 'Ticket medio']}
            rows={sales?.avg_ticket_by_method || []}
            empty={<div className="text-sm text-slate-500">Sem dados de ticket por metodo.</div>}
            renderRow={(item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>R$ {Number(item.value || 0).toFixed(2)}</td>
              </tr>
            )}
          />
        </DataCard>
      </div>

      <DataCard title="Produtos mais vendidos">
        <Table
          columns={['Produto', 'Quantidade', 'Valor gerado']}
          rows={topProducts}
          empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Sem dados para o periodo.</div>}
          renderRow={(item) => (
            <tr key={`${item.product_id || item.product_title}`}>
              <td>{item.product_title}</td>
              <td>{item.value}</td>
              <td>R$ {Number(item.total_value || 0).toFixed(2)}</td>
            </tr>
          )}
        />
      </DataCard>

      <DataCard title="Leads (envio para WhatsApp)">
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Total de leads: <strong>{Number(leads.total_leads || 0)}</strong>
        </div>
        <Table
          columns={['Data', 'Sessao', 'Produto', 'Evento']}
          rows={totalLeadRows}
          empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Sem leads para o periodo.</div>}
          renderRow={(item, index) => (
            <tr key={`${item.session_id}-${index}`}>
              <td>{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}</td>
              <td>{item.session_id}</td>
              <td>{item.product_title || '-'}</td>
              <td>{item.event_type}</td>
            </tr>
          )}
        />
      </DataCard>
    </section>
  );
}

export default AdminReportsPage;

