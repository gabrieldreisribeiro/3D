import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import {
  changeCustomerPassword,
  clearCustomerSession,
  customerLogout,
  fetchCustomerMe,
  fetchCustomerOrderById,
  fetchCustomerOrders,
  getCustomerToken,
  linkLegacyCustomerOrders,
  saveCustomerSession,
  updateCustomerProfile,
} from '../services/api';

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

function CustomerAccountPage() {
  const navigate = useNavigate();
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

  const handleLinkLegacy = async () => {
    setMessage('');
    setError('');
    try {
      const result = await linkLegacyCustomerOrders();
      setMessage(result?.message || 'Vinculo executado com sucesso.');
      load();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao vincular pedidos antigos');
    }
  };

  const handleOpenOrder = async (orderId) => {
    setError('');
    try {
      const data = await fetchCustomerOrderById(orderId);
      setSelectedOrder(data || null);
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
    <section className="container py-8 space-y-6">
      <SectionHeader title="Minha conta" subtitle="Acompanhe pedidos, atualize dados e gerencie sua senha." />
      {loading ? <Card><p className="text-sm text-slate-500">Carregando...</p></Card> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {!loading ? (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Resumo da conta</h3>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleLinkLegacy}>Vincular pedidos antigos</Button>
                <Button variant="secondary" onClick={handleLogout}>Sair</Button>
              </div>
            </div>
            <p className="text-sm text-slate-700"><strong>Nome:</strong> {customer?.full_name || '-'}</p>
            <p className="text-sm text-slate-700"><strong>Email:</strong> {customer?.email || '-'}</p>
            <p className="text-sm text-slate-700"><strong>Telefone:</strong> {customer?.phone_number || '-'}</p>
          </Card>

          <Card className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900">Minhas compras</h3>
            {!orders.length ? <p className="text-sm text-slate-500">Nenhum pedido vinculado.</p> : null}
            <div className="grid gap-3">
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">Pedido #{order.id}</p>
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => handleOpenOrder(order.id)}>Ver detalhes</Button>
                  </div>
                  <p className="text-slate-600">Data: {order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '-'}</p>
                  <p className="text-slate-600">Status: {paymentStatusLabel(order.payment_status)}</p>
                  <p className="text-slate-600">Metodo: {paymentMethodLabel(order.payment_method)}</p>
                  <p className="text-slate-800 font-semibold">Total: R$ {Number(order.total || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </Card>

          {selectedOrder ? (
            <Card className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900">Detalhe do pedido #{selectedOrder.id}</h3>
              <p className="text-sm text-slate-700">Status pagamento: {paymentStatusLabel(selectedOrder.payment_status)}</p>
              <p className="text-sm text-slate-700">Metodo: {paymentMethodLabel(selectedOrder.payment_method)}</p>
              <p className="text-sm text-slate-700">Subtotal: R$ {Number(selectedOrder.subtotal || 0).toFixed(2)}</p>
              <p className="text-sm text-slate-700">Desconto: R$ {Number(selectedOrder.discount || 0).toFixed(2)}</p>
              <p className="text-sm font-semibold text-slate-900">Total: R$ {Number(selectedOrder.total || 0).toFixed(2)}</p>
              {selectedOrder.receipt_url ? <a className="text-sm text-violet-700 underline" href={selectedOrder.receipt_url} target="_blank" rel="noreferrer">Abrir comprovante</a> : null}
              <div className="space-y-2">
                {selectedOrder.items?.map((item, index) => (
                  <div key={`${item.product_slug}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                    {item.quantity}x {item.title} - R$ {Number(item.line_total || 0).toFixed(2)}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900">Perfil</h3>
              <form className="space-y-3" onSubmit={handleSaveProfile}>
                <Input label="Nome completo" value={profileForm.full_name} onChange={(event) => setProfileForm((current) => ({ ...current, full_name: event.target.value }))} required />
                <Input label="Email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} required />
                <Input label="Telefone" value={profileForm.phone_number} onChange={(event) => setProfileForm((current) => ({ ...current, phone_number: event.target.value }))} required />
                <Button type="submit" loading={savingProfile}>Salvar perfil</Button>
              </form>
            </Card>

            <Card className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900">Alterar senha</h3>
              <form className="space-y-3" onSubmit={handleChangePassword}>
                <Input label="Senha atual" type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} required />
                <Input label="Nova senha" type="password" value={passwordForm.new_password} onChange={(event) => setPasswordForm((current) => ({ ...current, new_password: event.target.value }))} required />
                <Input label="Confirmar nova senha" type="password" value={passwordForm.confirm_password} onChange={(event) => setPasswordForm((current) => ({ ...current, confirm_password: event.target.value }))} required />
                <Button type="submit" loading={savingPassword}>Salvar nova senha</Button>
              </form>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default CustomerAccountPage;
