import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { customerForgotPassword } from '../services/api';

function CustomerForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setToken('');
    try {
      const result = await customerForgotPassword({ email });
      setMessage(result?.message || 'Se o e-mail existir, o token foi gerado.');
      setToken(result?.reset_token || '');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao solicitar redefinicao');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="customer-auth-shell">
      <div className="customer-auth-wrap">
        <Card className="customer-auth-card">
          <p className="customer-auth-eyebrow">Area do cliente</p>
          <h1 className="customer-auth-title">Recuperar senha</h1>
          <p className="customer-auth-subtitle">Informe seu e-mail para gerar o token de redefinicao.</p>

          <form className="customer-auth-form" onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              required
            />
            <Button className="w-full" type="submit" loading={loading}>
              Gerar token
            </Button>
          </form>

          {message ? <p className="customer-auth-success">{message}</p> : null}
          {token ? (
            <div className="customer-token-box">
              <p>Token gerado:</p>
              <strong>{token}</strong>
            </div>
          ) : null}
          {error ? <p className="customer-auth-error">{error}</p> : null}

          <div className="customer-auth-links">
            <span>Ja tem token?</span>
            <Link to="/minha-conta/redefinir-senha">Redefinir senha</Link>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default CustomerForgotPasswordPage;
