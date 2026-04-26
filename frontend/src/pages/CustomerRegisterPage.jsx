import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { customerRegister, saveCustomerSession } from '../services/api';

function CustomerRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await customerRegister({
        ...form,
        link_legacy_orders: true,
      });
      saveCustomerSession(session);
      navigate('/minha-conta', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="customer-auth-shell">
      <div className="customer-auth-wrap">
        <aside className="customer-auth-hero" aria-hidden="true">
          <span className="customer-auth-hero-icon">3D</span>
          <h2>Crie sua conta e acompanhe suas compras.</h2>
          <p>Seu historico, pedidos e dados ficam reunidos em uma area simples e segura.</p>
          <div className="customer-auth-hero-list">
            <span>Cadastro rapido</span>
            <span>Pedidos vinculados</span>
            <span>Acompanhamento claro</span>
          </div>
        </aside>
        <Card className="customer-auth-card">
          <p className="customer-auth-eyebrow">Area do cliente</p>
          <h1 className="customer-auth-title">Criar conta</h1>
          <p className="customer-auth-subtitle">Cadastre-se para acompanhar suas compras e vincular pedidos antigos.</p>

          <form className="customer-auth-form" onSubmit={handleSubmit}>
            <Input
              label="Nome completo"
              value={form.full_name}
              onChange={(event) => handleChange('full_name', event.target.value)}
              placeholder="Seu nome"
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => handleChange('email', event.target.value)}
              placeholder="voce@exemplo.com"
              required
            />
            <Input
              label="Telefone"
              value={form.phone_number}
              onChange={(event) => handleChange('phone_number', event.target.value)}
              placeholder="(11) 99999-9999"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={form.password}
              onChange={(event) => handleChange('password', event.target.value)}
              placeholder="Minimo de 8 caracteres"
              required
            />
            <Input
              label="Confirmar senha"
              type="password"
              value={form.confirm_password}
              onChange={(event) => handleChange('confirm_password', event.target.value)}
              placeholder="Repita a senha"
              required
            />
            <Button className="w-full" type="submit" loading={loading}>
              Criar conta
            </Button>
          </form>

          {error ? <p className="customer-auth-error">{error}</p> : null}

          <div className="customer-auth-links">
            <span>Ja possui conta?</span>
            <Link to="/minha-conta/login">Entrar</Link>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default CustomerRegisterPage;
