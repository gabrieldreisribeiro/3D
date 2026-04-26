import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { customerLogin, saveCustomerSession } from '../services/api';

function CustomerLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await customerLogin({
        identifier,
        password,
        link_legacy_orders: true,
      });
      saveCustomerSession(session);
      navigate('/minha-conta', { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="customer-auth-shell">
      <div className="customer-auth-wrap">
        <aside className="customer-auth-hero" aria-hidden="true">
          <span className="customer-auth-hero-icon">3D</span>
          <h2>Seu espaco para acompanhar cada pedido.</h2>
          <p>Veja pagamentos, producao, prazos e historico de compras com clareza.</p>
          <div className="customer-auth-hero-list">
            <span>Pedidos organizados</span>
            <span>Status em tempo real</span>
            <span>Dados seguros</span>
          </div>
        </aside>
        <Card className="customer-auth-card">
          <p className="customer-auth-eyebrow">Area do cliente</p>
          <h1 className="customer-auth-title">Entrar na conta</h1>
          <p className="customer-auth-subtitle">Acompanhe pedidos, pagamentos e dados da sua conta em um so lugar.</p>

          <form className="customer-auth-form" onSubmit={handleSubmit}>
            <Input
              label="Email ou telefone"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="voce@exemplo.com ou (11) 99999-9999"
              required
            />
            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              required
            />
            <Button className="w-full" type="submit" loading={loading}>
              Entrar na conta
            </Button>
          </form>

          {error ? <p className="customer-auth-error">{error}</p> : null}

          <div className="customer-auth-links">
            <span>Nao tem conta?</span>
            <Link to="/minha-conta/cadastro">Criar conta</Link>
          </div>
          <div className="customer-auth-links">
            <span>Esqueceu sua senha?</span>
            <Link to="/minha-conta/esqueci-senha">Recuperar acesso</Link>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default CustomerLoginPage;
