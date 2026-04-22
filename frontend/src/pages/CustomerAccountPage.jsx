import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import StatusBadge from '../components/ui/StatusBadge';
import {
  changeCustomerPassword,
  clearCustomerSession,
  customerLogout,
  fetchCustomerMe,
  fetchCustomerOrderById,
  fetchCustomerOrders,
  getCustomerToken,
  saveCustomerSession,
  updateCustomerProfile,
} from '../services/api';

const NAV_ITEMS = [
  { key: 'overview', label: 'Minha conta' },
  { key: 'orders', label: 'Minhas compras' },
  { key: 'profile', label: 'Perfil' },
  { key: 'password', label: 'Alterar senha' },
];

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function paymentStatusLabel(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'paid') return 'Pago';
  if (key === 'pending' || key === 'pending_payment') return 'Aguardando pagamento';
  if (key === 'awaiting_confirmation') return 'Aguardando confirmacao';
  if (key === 'failed') return 'Falhou';
  if (key === 'canceled') return 'Cancelado';
  return key || '-';
}

function paymentMethodLabel(method) {
  const key = String(method || '').toLowerCase();
  if (key === 'pix') return 'Pix';
  if (key === 'credit_card') return 'Cartao';
  if (key === 'whatsapp') return 'WhatsApp';
  return key || '-';
}

function productionStatusLabel(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'paid') return 'Pago';
  if (key === 'in_production') return 'Em producao';
  if (key === 'ready') return 'Pronto';
  return '-';
}

function statusBadgeTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'paid') return 'success';
  if (key === 'pending' || key === 'pending_payment' || key === 'awaiting_confirmation') return 'warning';
  if (key === 'failed' || key === 'canceled') return 'danger';
  return 'info';
}

function productionBadgeTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'ready') return 'success';
  if (key === 'in_production') return 'info';
  if (key === 'paid') return 'warning';
  return 'neutral';
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function resolveOrderItemThumb(item) {
  return firstNonEmpty(
    item?.image_url_snapshot,
    item?.image_url,
    item?.cover_image_snapshot,
    item?.cover_image,
    item?.product_image,
    item?.product_cover_image,
  );
}

function CustomerAccountPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', phone_number: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const paidOrders = orders.filter((order) => String(order.payment_status || '').toLowerCase() === 'paid').length;
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const lastOrder = orders[0] || null;
    return { totalOrders, paidOrders, totalSpent, lastOrder };
  }, [orders]);

  const load = () => {
    setLoading(true);
    Promise.all([fetchCustomerMe(), fetchCustomerOrders({ page: 1, page_size: 20 })])
      .then(([me, ordersData]) => {
        setCustomer(me || null);
        setProfileForm({
          full_name: me?.full_name || '',
          email: me?.email || '',
          phone_number: me?.phone_number || '',
        });
        setOrders(ordersData?.items || []);
      })
      .catch((requestError) => {
        clearCustomerSession();
        setError(requestError.message || 'Sessao invalida');
        navigate('/minha-conta/login', { replace: true });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!getCustomerToken()) {
      navigate('/minha-conta/login', { replace: true });
      return;
    }
    load();
  }, []);

  const handleOpenOrder = async (orderId) => {
    setError('');
    try {
      const data = await fetchCustomerOrderById(orderId);
      setSelectedOrder(data || null);
      setActiveTab('order_detail');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao abrir pedido');
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setMessage('');
    setError('');
    try {
      const next = await updateCustomerProfile(profileForm);
      setCustomer(next);
      saveCustomerSession({ token: getCustomerToken(), customer: next });
      setMessage('Perfil atualizado com sucesso.');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setMessage('');
    setError('');
    try {
      await changeCustomerPassword(passwordForm);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setMessage('Senha alterada com sucesso.');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await customerLogout();
    } catch {
      // ignore
    } finally {
      clearCustomerSession();
      navigate('/minha-conta/login', { replace: true });
    }
  };

  return (
    <section className="container py-6 md:py-8">
      <div className="customer-panel-shell">
        <div className="customer-panel-head">
          <div>
            <p className="customer-auth-eyebrow">Minha conta</p>
            <h1 className="customer-panel-title">Ola, {customer?.full_name ? customer.full_name.split(' ')[0] : 'cliente'}.</h1>
            <p className="customer-panel-subtitle">Gerencie seus dados e acompanhe seus pedidos de forma simples.</p>
          </div>
          <div className="customer-panel-head-actions">
            <Button variant="secondary" onClick={handleLogout}>Sair</Button>
          </div>
        </div>

        {message ? <div className="customer-banner customer-banner-success">{message}</div> : null}
        {error ? <div className="customer-banner customer-banner-error">{error}</div> : null}

        {loading ? (
          <Card>
            <p className="text-sm text-slate-500">Carregando dados da sua conta...</p>
          </Card>
        ) : (
          <div className="customer-panel-grid">
            <aside className="customer-panel-nav" aria-label="Navegacao da conta">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`customer-nav-item ${activeTab === item.key ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </aside>

            <div className="customer-panel-content">
              {activeTab === 'overview' ? (
                <>
                  <div className="customer-stats-grid">
                    <Card className="customer-stat-card">
                      <p>Total de pedidos</p>
                      <strong>{stats.totalOrders}</strong>
                    </Card>
                    <Card className="customer-stat-card">
                      <p>Pedidos pagos</p>
                      <strong>{stats.paidOrders}</strong>
                    </Card>
                    <Card className="customer-stat-card">
                      <p>Total em compras</p>
                      <strong>{formatMoney(stats.totalSpent)}</strong>
                    </Card>
                  </div>

                  <Card className="space-y-3">
                    <h3 className="customer-card-title">Resumo da conta</h3>
                    <div className="customer-account-list">
                      <p><strong>Nome:</strong> {customer?.full_name || '-'}</p>
                      <p><strong>Email:</strong> {customer?.email || '-'}</p>
                      <p><strong>Telefone:</strong> {customer?.phone_number || '-'}</p>
                      <p><strong>Ultimo pedido:</strong> {stats.lastOrder ? `#${stats.lastOrder.id}` : '-'}</p>
                    </div>
                  </Card>
                </>
              ) : null}

              {activeTab === 'orders' ? (
                <Card className="space-y-4">
                  <div className="customer-content-head">
                    <h3 className="customer-card-title">Minhas compras</h3>
                    <p className="text-sm text-slate-500">Visualize status, pagamento e detalhe dos pedidos.</p>
                  </div>

                  {!orders.length ? (
                    <EmptyState
                      title="Voce ainda nao realizou nenhuma compra"
                      description="Quando seu primeiro pedido for criado, ele aparecera aqui automaticamente."
                      action={<Link className="inline-flex text-sm font-semibold text-violet-700 underline" to="/">Explorar produtos</Link>}
                    />
                  ) : (
                    <div className="customer-orders-list">
                      {orders.map((order) => (
                        <article key={order.id} className="customer-order-card">
                          <div className="customer-order-head">
                            <div>
                              <h4>Pedido #{order.id}</h4>
                              <p>{formatDateTime(order.created_at)}</p>
                            </div>
                            <StatusBadge tone={statusBadgeTone(order.payment_status)}>
                              {paymentStatusLabel(order.payment_status)}
                            </StatusBadge>
                          </div>
                          <div className="customer-order-meta">
                            <p><span>Pagamento</span><strong>{paymentMethodLabel(order.payment_method)}</strong></p>
                            <p><span>Total</span><strong>{formatMoney(order.total)}</strong></p>
                            <p><span>Etapa</span><strong>{order.current_stage_name || productionStatusLabel(order.production_status)}</strong></p>
                            <p><span>Previsao</span><strong>{order.estimated_ready_at ? formatDateTime(order.estimated_ready_at) : '-'}</strong></p>
                          </div>
                          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleOpenOrder(order.id)}>
                            Ver detalhes
                          </Button>
                        </article>
                      ))}
                    </div>
                  )}
                </Card>
              ) : null}

              {activeTab === 'order_detail' ? (
                <Card className="space-y-4">
                  {!selectedOrder ? (
                    <EmptyState title="Nenhum pedido selecionado" description="Selecione um pedido na aba Minhas compras para ver os detalhes." />
                  ) : (
                    <>
                      <div className="customer-content-head">
                        <div>
                          <h3 className="customer-card-title">Pedido #{selectedOrder.id}</h3>
                          <p className="text-sm text-slate-500">Criado em {formatDateTime(selectedOrder.created_at)}</p>
                        </div>
                        <StatusBadge tone={statusBadgeTone(selectedOrder.payment_status)}>
                          {paymentStatusLabel(selectedOrder.payment_status)}
                        </StatusBadge>
                      </div>

                      <section className="customer-order-hero">
                        <div className="customer-order-hero-main">
                          <p className="customer-order-hero-label">Status do pedido</p>
                          <div className="customer-order-hero-status-wrap">
                            <StatusBadge tone={statusBadgeTone(selectedOrder.payment_status)}>
                              {paymentStatusLabel(selectedOrder.payment_status)}
                            </StatusBadge>
                            <StatusBadge tone={productionBadgeTone(selectedOrder.production_status)}>
                              {selectedOrder.current_stage_name || productionStatusLabel(selectedOrder.production_status)}
                            </StatusBadge>
                          </div>
                          <h4 className="customer-order-hero-title">
                            {selectedOrder.current_stage_name || productionStatusLabel(selectedOrder.production_status)}
                          </h4>
                          <p className="customer-order-hero-subtitle">
                            Acompanhe abaixo cada etapa da producao e atualizacoes do pedido em tempo real.
                          </p>
                        </div>
                        <div className="customer-order-hero-metrics">
                          <div className="customer-order-hero-metric">
                            <span>Previsao de conclusao</span>
                            <strong>{selectedOrder.estimated_ready_at ? formatDateTime(selectedOrder.estimated_ready_at) : '-'}</strong>
                          </div>
                          <div className="customer-order-hero-metric">
                            <span>Status do pagamento</span>
                            <strong>{paymentStatusLabel(selectedOrder.payment_status)}</strong>
                          </div>
                        </div>
                      </section>

                      <div className="customer-detail-grid">
                        <div className="customer-detail-block">
                          <h4>Resumo</h4>
                          <p><span>Subtotal</span><strong>{formatMoney(selectedOrder.subtotal)}</strong></p>
                          <p><span>Desconto</span><strong>{formatMoney(selectedOrder.discount)}</strong></p>
                          <p><span>Total</span><strong>{formatMoney(selectedOrder.total)}</strong></p>
                        </div>
                        <div className="customer-detail-block">
                          <h4>Pagamento</h4>
                          <p><span>Metodo</span><strong>{paymentMethodLabel(selectedOrder.payment_method)}</strong></p>
                          <p><span>Status</span><strong>{paymentStatusLabel(selectedOrder.payment_status)}</strong></p>
                          {selectedOrder.receipt_url ? (
                            <a className="customer-link" href={selectedOrder.receipt_url} target="_blank" rel="noreferrer">
                              Baixar comprovante
                            </a>
                          ) : (
                            <span className="text-sm text-slate-400">Comprovante indisponivel</span>
                          )}
                        </div>
                        <div className="customer-detail-block">
                          <h4>Producao</h4>
                          <p><span>Status</span><strong>{productionStatusLabel(selectedOrder.production_status)}</strong></p>
                          <p><span>Inicio</span><strong>{selectedOrder.production_started_at ? formatDateTime(selectedOrder.production_started_at) : '-'}</strong></p>
                          <p><span>Previsao</span><strong>{selectedOrder.estimated_ready_at ? formatDateTime(selectedOrder.estimated_ready_at) : '-'}</strong></p>
                          <p><span>Concluido em</span><strong>{selectedOrder.ready_at ? formatDateTime(selectedOrder.ready_at) : '-'}</strong></p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="customer-card-subtitle">Andamento</h4>
                        {(selectedOrder.timeline || []).length ? (
                          <div className="customer-timeline">
                            {(selectedOrder.timeline || []).map((step) => (
                              <div key={step.stage_id} className={`customer-timeline-item ${step.is_current ? 'is-current' : step.is_completed ? 'is-completed' : 'is-pending'}`}>
                                <div className="customer-timeline-track" aria-hidden="true">
                                  <span
                                    className={`customer-timeline-dot ${step.is_current ? 'is-current' : step.is_completed ? 'is-completed' : 'is-pending'}`}
                                    style={{ backgroundColor: step.color || undefined }}
                                  >
                                    {step.is_completed ? 'v' : null}
                                  </span>
                                  <span className={`customer-timeline-line ${step.is_completed ? 'is-completed' : ''}`} />
                                </div>
                                <div className="customer-timeline-content">
                                  <div className="customer-timeline-head">
                                    <p className="customer-timeline-title">{step.name}</p>
                                    <StatusBadge tone={step.is_current ? 'info' : step.is_completed ? 'success' : 'neutral'}>
                                      {step.is_current ? 'Atual' : step.is_completed ? 'Concluida' : 'Pendente'}
                                    </StatusBadge>
                                  </div>
                                  {step.description ? <p className="customer-timeline-description">{step.description}</p> : null}
                                  <p className="customer-timeline-date">{step.completed_at ? formatDateTime(step.completed_at) : '-'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge tone={productionBadgeTone('paid')}>Pago</StatusBadge>
                            <StatusBadge tone={productionBadgeTone(selectedOrder.production_status === 'in_production' || selectedOrder.production_status === 'ready' ? 'in_production' : null)}>Em producao</StatusBadge>
                            <StatusBadge tone={productionBadgeTone(selectedOrder.production_status === 'ready' ? 'ready' : null)}>Pronto</StatusBadge>
                          </div>
                        )}
                        {String(selectedOrder.payment_status || '').toLowerCase() !== 'paid' ? (
                          <p className="text-xs text-amber-700">Aguardando confirmacao do pagamento para iniciar producao.</p>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <h4 className="customer-card-subtitle">Itens comprados</h4>
                        {!selectedOrder.items?.length ? (
                          <p className="text-sm text-slate-500">Nenhum item encontrado para este pedido.</p>
                        ) : (
                          <div className="customer-items-list">
                            {selectedOrder.items.map((item, index) => {
                              const thumbUrl = resolveOrderItemThumb(item);
                              return (
                                <div key={`${item.product_slug}-${index}`} className="customer-item-row">
                                  <div className="customer-item-left">
                                    <div className="customer-item-thumb">
                                      {thumbUrl ? (
                                        <img src={thumbUrl} alt={item.title} loading="lazy" />
                                      ) : (
                                        <span>{(item.title || '?').slice(0, 1).toUpperCase()}</span>
                                      )}
                                    </div>
                                    <div>
                                      <p className="customer-item-title">{item.title}</p>
                                      <p className="customer-item-muted">Quantidade: {item.quantity} | Prazo: {Math.max(1, Number(item.production_days_snapshot || 1))} dia(s)</p>
                                    </div>
                                  </div>
                                  <strong className="customer-item-price">{formatMoney(item.line_total)}</strong>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </Card>
              ) : null}

              {activeTab === 'profile' ? (
                <Card className="space-y-4">
                  <div className="customer-content-head">
                    <h3 className="customer-card-title">Perfil</h3>
                    <p className="text-sm text-slate-500">Mantenha seus dados atualizados para facilitar novos pedidos.</p>
                  </div>
                  <form className="grid gap-3" onSubmit={handleSaveProfile}>
                    <Input
                      label="Nome completo"
                      value={profileForm.full_name}
                      onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))}
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={profileForm.email}
                      onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                    <Input
                      label="Telefone"
                      value={profileForm.phone_number}
                      onChange={(event) => setProfileForm((current) => ({ ...current, phone_number: event.target.value }))}
                      required
                    />
                    <Button type="submit" className="w-full sm:w-auto" loading={savingProfile}>Salvar perfil</Button>
                  </form>
                </Card>
              ) : null}

              {activeTab === 'password' ? (
                <Card className="space-y-4">
                  <div className="customer-content-head">
                    <h3 className="customer-card-title">Alterar senha</h3>
                    <p className="text-sm text-slate-500">Use uma senha forte para proteger sua conta.</p>
                  </div>
                  <form className="grid gap-3" onSubmit={handleChangePassword}>
                    <Input
                      label="Senha atual"
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                      required
                    />
                    <Input
                      label="Nova senha"
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))}
                      required
                    />
                    <Input
                      label="Confirmar nova senha"
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))}
                      required
                    />
                    <Button type="submit" className="w-full sm:w-auto" loading={savingPassword}>Salvar nova senha</Button>
                  </form>
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default CustomerAccountPage;
