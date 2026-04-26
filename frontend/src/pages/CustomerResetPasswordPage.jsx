import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { customerResetPassword } from '../services/api';

function CustomerResetPasswordPage() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await customerResetPassword({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setMessage('Senha redefinida com sucesso. Faca login novamente.');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="customer-auth-shell">
      <div className="customer-auth-wrap">
        <aside className="customer-auth-hero" aria-hidden="true">
          <span className="customer-auth-hero-icon">3D</span>
          <h2>Defina uma nova senha para sua conta.</h2>
          <p>Depois disso, voce ja pode voltar ao painel do cliente normalmente.</p>
          <div className="customer-auth-hero-list">
            <span>Senha atualizada</span>
            <span>Pedidos preservados</span>
            <span>Login protegido</span>
          </div>
        </aside>
        <Card className="customer-auth-card">
          <p className="customer-auth-eyebrow">Area do cliente</p>
          <h1 className="customer-auth-title">Redefinir senha</h1>
          <p className="customer-auth-subtitle">Use o token recebido para definir uma nova senha com seguranca.</p>

          <form className="customer-auth-form" onSubmit={handleSubmit}>
            <Input
              label="Token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Cole aqui o token"
              required
            />
            <Input
              label="Nova senha"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Nova senha"
              required
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a nova senha"
              required
            />
            <Button className="w-full" type="submit" loading={loading}>
              Salvar nova senha
            </Button>
          </form>

          {message ? <p className="customer-auth-success">{message}</p> : null}
          {error ? <p className="customer-auth-error">{error}</p> : null}

          <div className="customer-auth-links">
            <span>Ja pode entrar?</span>
            <Link to="/minha-conta/login">Voltar ao login</Link>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default CustomerResetPasswordPage;
