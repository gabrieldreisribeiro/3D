import { useEffect, useMemo, useState } from 'react';
import DataCard from '../components/ui/DataCard';
import MetricCard from '../components/ui/MetricCard';
import SectionHeader from '../components/ui/SectionHeader';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import {
  fetchAdminCategories,
  fetchAdminLeadsConversionAbandonment,
  fetchAdminLeadsConversionCtas,
  fetchAdminLeadsConversionFunnel,
  fetchAdminLeadsConversionLeads,
  fetchAdminLeadsConversionProducts,
  fetchAdminLeadsConversionSources,
  fetchAdminLeadsConversionSummary,
  fetchAdminProducts,
} from '../services/api';

const initialState = {
  summary: null,
  funnel: { steps: [] },
  products: {
    most_viewed: [],
    most_clicked: [],
    most_added: [],
    most_whatsapp: [],
    most_purchased: [],
    most_abandoned: [],
    best_conversion: [],
    highest_estimated_value: [],
  },
  ctas: { total_cta_clicks: 0, top_cta: null, items: [] },
  leads: { items: [], total: 0, page: 1, page_size: 20 },
  sources: { items: [] },
  abandonment: { abandoned_sessions: 0, high_intent_without_whatsapp: 0, high_intent_without_order: 0, abandoned_products: [] },
};
const TABLE_PAGE_SIZE = 8;

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function AdminLeadsConversionPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(initialState);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [leadsPage, setLeadsPage] = useState(1);
  const [tablePages, setTablePages] = useState({
    funnel: 1,
    most_viewed: 1,
    most_added: 1,
    most_abandoned: 1,
    ctas: 1,
    sources: 1,
  });
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    category_id: '',
    product_id: '',
    source_channel: '',
    lead_level: '',
  });

  const leadsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(Number(data.leads.total || 0) / Number(data.leads.page_size || 20))),
    [data.leads.total, data.leads.page_size]
  );

  const queryFilters = useMemo(
    () => ({
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      category_id: filters.category_id ? Number(filters.category_id) : undefined,
      product_id: filters.product_id ? Number(filters.product_id) : undefined,
      source_channel: filters.source_channel || undefined,
    }),
    [filters]
  );

  const loadStaticOptions = () => {
    fetchAdminCategories().then(setCategories).catch(() => setCategories([]));
    fetchAdminProducts().then(setProducts).catch(() => setProducts([]));
  };

  const loadData = (targetLeadsPage = leadsPage) => {
    setLoading(true);
    setError('');
    Promise.all([
      fetchAdminLeadsConversionSummary(queryFilters),
      fetchAdminLeadsConversionFunnel(queryFilters),
      fetchAdminLeadsConversionProducts(queryFilters),
      fetchAdminLeadsConversionCtas(queryFilters),
      fetchAdminLeadsConversionLeads({
        ...queryFilters,
        lead_level: filters.lead_level || undefined,
        page: targetLeadsPage,
        page_size: 20,
      }),
      fetchAdminLeadsConversionSources(queryFilters),
      fetchAdminLeadsConversionAbandonment(queryFilters),
    ])
      .then(([summary, funnel, productsData, ctas, leads, sources, abandonment]) => {
        setData({
          summary,
          funnel,
          products: productsData,
          ctas,
          leads,
          sources,
          abandonment,
        });
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar Leads & Conversao.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStaticOptions();
  }, []);

  useEffect(() => {
    setLeadsPage(1);
    setTablePages({
      funnel: 1,
      most_viewed: 1,
      most_added: 1,
      most_abandoned: 1,
      ctas: 1,
      sources: 1,
    });
  }, [filters.date_from, filters.date_to, filters.category_id, filters.product_id, filters.source_channel, filters.lead_level]);

  useEffect(() => {
    loadData(leadsPage);
  }, [queryFilters, filters.lead_level, leadsPage]);

  const getTablePagination = (key, rows, pageSize = TABLE_PAGE_SIZE) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const totalPages = Math.max(1, Math.ceil(safeRows.length / pageSize));
    const currentPage = Math.min(tablePages[key] || 1, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pagedRows = safeRows.slice(start, start + pageSize);
    return { pagedRows, currentPage, totalPages };
  };

  const setTablePage = (key, nextPage) => {
    setTablePages((current) => ({ ...current, [key]: nextPage }));
  };

  const renderMiniPager = (key, currentPage, totalPages) => (
    <div className="mt-3 flex items-center justify-end gap-2">
      <Button
        variant="secondary"
        className="h-8 px-3 text-xs"
        disabled={currentPage <= 1}
        onClick={() => setTablePage(key, Math.max(1, currentPage - 1))}
      >
        Anterior
      </Button>
      <span className="text-xs text-slate-600">
        Pagina {currentPage} de {totalPages}
      </span>
      <Button
        variant="secondary"
        className="h-8 px-3 text-xs"
        disabled={currentPage >= totalPages}
        onClick={() => setTablePage(key, Math.min(totalPages, currentPage + 1))}
      >
        Proxima
      </Button>
    </div>
  );

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Inteligencia comercial"
        title="Leads & Conversao"
        subtitle="Acompanhe jornada de compra, intencao e performance por sessao, produto e CTA."
      />

      <DataCard title="Filtros globais">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="grid gap-1 text-xs text-slate-600">
            Data inicial
            <input type="date" value={filters.date_from} onChange={(event) => setFilters((c) => ({ ...c, date_from: event.target.value }))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-300" />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Data final
            <input type="date" value={filters.date_to} onChange={(event) => setFilters((c) => ({ ...c, date_to: event.target.value }))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-300" />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Categoria
            <select value={filters.category_id} onChange={(event) => setFilters((c) => ({ ...c, category_id: event.target.value }))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-300">
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Produto
            <select value={filters.product_id} onChange={(event) => setFilters((c) => ({ ...c, product_id: event.target.value }))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-300">
              <option value="">Todos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.title}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Origem
            <select value={filters.source_channel} onChange={(event) => setFilters((c) => ({ ...c, source_channel: event.target.value }))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-300">
              <option value="">Todas</option>
              <option value="direto">Direto</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="google">Google</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="referral">Referral</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Classificacao
            <select value={filters.lead_level} onChange={(event) => setFilters((c) => ({ ...c, lead_level: event.target.value }))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-300">
              <option value="">Todas</option>
              <option value="cold">Lead frio</option>
              <option value="warm">Lead morno</option>
              <option value="hot">Lead quente</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => loadData(1)} loading={loading}>Atualizar</Button>
        </div>
      </DataCard>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Carregando painel...</div> : null}

      {!loading && data.summary ? (
        <>
          {(() => {
            const funnelPage = getTablePagination('funnel', data.funnel.steps || []);
            const viewedPage = getTablePagination('most_viewed', data.products.most_viewed || []);
            const addedPage = getTablePagination('most_added', data.products.most_added || []);
            const abandonedPage = getTablePagination('most_abandoned', data.products.most_abandoned || []);
            const ctasPage = getTablePagination('ctas', data.ctas.items || []);
            const sourcesPage = getTablePagination('sources', data.sources.items || []);
            return (
              <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Sessoes" value={data.summary.sessions} helper="Visitantes rastreados" />
            <MetricCard label="Leads frios" value={data.summary.leads_cold} helper="Baixa intencao" />
            <MetricCard label="Leads mornos" value={data.summary.leads_warm} helper="Media intencao" />
            <MetricCard label="Leads quentes" value={data.summary.leads_hot} helper="Alta intencao" />
            <MetricCard label="WhatsApp clicks" value={data.summary.whatsapp_clicks} helper="Leads de contato" />
            <MetricCard label="Pedidos criados" value={data.summary.orders_created} helper="Conversao final" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
            <MetricCard label="Views produto" value={data.summary.product_views} helper="Topo do funil" />
            <MetricCard label="Cliques produto" value={data.summary.product_clicks} helper="Interesse ativo" />
            <MetricCard label="Add to cart" value={data.summary.add_to_cart} helper="Intencao de compra" />
            <MetricCard label="Checkout starts" value={data.summary.checkout_starts} helper="Pre-fechamento" />
            <MetricCard label="Conversao para WhatsApp" value={formatPercent(data.summary.conversion_to_whatsapp)} helper="Sessoes -> WhatsApp" />
            <MetricCard label="Add -> WhatsApp" value={formatPercent(data.summary.conversion_add_to_whatsapp)} helper="Carrinho -> WhatsApp" />
            <MetricCard label="Ticket medio" value={`R$ ${Number(data.summary.estimated_ticket || 0).toFixed(2)}`} helper="Pedidos reais" />
            <MetricCard label="Valor estimado WhatsApp" value={`R$ ${Number(data.summary.estimated_whatsapp_value || 0).toFixed(2)}`} helper="Estimativa comercial" />
          </div>

          <DataCard title="Funil">
            <Table
              columns={['Etapa', 'Quantidade', 'Conversao etapa', 'Perda']}
              rows={funnelPage.pagedRows}
              maxHeightClass="max-h-[360px]"
              renderRow={(item) => (
                <tr key={item.key}>
                  <td>{item.label}</td>
                  <td>{item.value}</td>
                  <td>{formatPercent(item.step_conversion)}</td>
                  <td>{item.dropoff}</td>
                </tr>
              )}
            />
            {renderMiniPager('funnel', funnelPage.currentPage, funnelPage.totalPages)}
          </DataCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DataCard title="Produtos: mais vistos / clicados">
              <Table
                columns={['Produto', 'Label', 'Views', 'Cliques']}
                rows={viewedPage.pagedRows}
                maxHeightClass="max-h-[360px]"
                renderRow={(item) => (
                  <tr key={`view-${item.product_id || item.product_title}`}>
                    <td>{item.product_title}</td>
                    <td>{item.product_label || '-'}</td>
                    <td>{item.views}</td>
                    <td>{item.clicks}</td>
                  </tr>
                )}
              />
              {renderMiniPager('most_viewed', viewedPage.currentPage, viewedPage.totalPages)}
            </DataCard>
            <DataCard title="Produtos: add / WhatsApp / pedidos">
              <Table
                columns={['Produto', 'Add', 'WhatsApp', 'Pedidos', 'Conversao']}
                rows={addedPage.pagedRows}
                maxHeightClass="max-h-[360px]"
                renderRow={(item) => (
                  <tr key={`add-${item.product_id || item.product_title}`}>
                    <td>{item.product_title}</td>
                    <td>{item.add_to_cart}</td>
                    <td>{item.whatsapp_click}</td>
                    <td>{item.orders}</td>
                    <td>{formatPercent(item.conversion_rate)}</td>
                  </tr>
                )}
              />
              {renderMiniPager('most_added', addedPage.currentPage, addedPage.totalPages)}
            </DataCard>
            <DataCard title="Produtos: abandono / valor">
              <Table
                columns={['Produto', 'Abandono', 'Valor estimado', 'Label']}
                rows={abandonedPage.pagedRows}
                maxHeightClass="max-h-[360px]"
                renderRow={(item) => (
                  <tr key={`abandon-${item.product_id || item.product_title}`}>
                    <td>{item.product_title}</td>
                    <td>{item.abandoned_sessions}</td>
                    <td>R$ {Number(item.estimated_value || 0).toFixed(2)}</td>
                    <td>{item.product_label || '-'}</td>
                  </tr>
                )}
              />
              {renderMiniPager('most_abandoned', abandonedPage.currentPage, abandonedPage.totalPages)}
            </DataCard>
            <DataCard title="CTAs mais clicados">
              <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Total cliques CTA: <strong>{data.ctas.total_cta_clicks}</strong> | Top CTA: <strong>{data.ctas.top_cta || '-'}</strong>
              </div>
              <Table
                columns={['CTA', 'Cliques', 'CTR']}
                rows={ctasPage.pagedRows}
                maxHeightClass="max-h-[360px]"
                renderRow={(item) => (
                  <tr key={item.cta_name}>
                    <td>{item.cta_name}</td>
                    <td>{item.clicks}</td>
                    <td>{formatPercent(item.ctr)}</td>
                  </tr>
                )}
              />
              {renderMiniPager('ctas', ctasPage.currentPage, ctasPage.totalPages)}
            </DataCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DataCard title="Leads por sessao">
              <Table
                columns={['Sessao', 'Nivel', 'Score', 'Views', 'Add', 'WhatsApp', 'Origem', 'Ultima atividade']}
                rows={data.leads.items || []}
                maxHeightClass="max-h-[380px]"
                renderRow={(item) => (
                  <tr key={item.session_id}>
                    <td>{item.session_id}</td>
                    <td>{item.lead_level}</td>
                    <td>{item.score}</td>
                    <td>{item.viewed_products}</td>
                    <td>{item.add_to_cart}</td>
                    <td>{item.whatsapp_clicked ? 'Sim' : 'Nao'}</td>
                    <td>{item.source_channel || '-'}</td>
                    <td>{item.last_activity ? new Date(item.last_activity).toLocaleString('pt-BR') : '-'}</td>
                  </tr>
                )}
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={leadsPage <= 1} onClick={() => setLeadsPage((value) => Math.max(1, value - 1))}>Anterior</Button>
                <span className="text-xs text-slate-600">Pagina {leadsPage} de {leadsTotalPages}</span>
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={leadsPage >= leadsTotalPages} onClick={() => setLeadsPage((value) => Math.min(leadsTotalPages, value + 1))}>Proxima</Button>
              </div>
            </DataCard>

            <div className="space-y-4">
              <DataCard title="Origens">
                <Table
                  columns={['Origem', 'Sessoes', 'Leads', 'WhatsApp', 'Conversao']}
                  rows={sourcesPage.pagedRows}
                  maxHeightClass="max-h-[360px]"
                  renderRow={(item) => (
                    <tr key={item.source_channel}>
                      <td>{item.source_channel}</td>
                      <td>{item.sessions}</td>
                      <td>{item.leads}</td>
                      <td>{item.whatsapp_clicks}</td>
                      <td>{formatPercent(item.conversion_to_whatsapp)}</td>
                    </tr>
                  )}
                />
                {renderMiniPager('sources', sourcesPage.currentPage, sourcesPage.totalPages)}
              </DataCard>
              <DataCard title="Abandono">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <MetricCard label="Carrinhos abandonados" value={data.abandonment.abandoned_sessions} helper="Add sem WhatsApp/Pedido" />
                  <MetricCard label="Alta intencao sem WhatsApp" value={data.abandonment.high_intent_without_whatsapp} helper="Leads quentes perdidos" />
                  <MetricCard label="Alta intencao sem pedido" value={data.abandonment.high_intent_without_order} helper="Risco de perda" />
                </div>
              </DataCard>
            </div>
          </div>
              </>
            );
          })()}
        </>
      ) : null}
    </section>
  );
}

export default AdminLeadsConversionPage;
