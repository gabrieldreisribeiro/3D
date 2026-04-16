import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { adminLogin, getAdminToken, saveAdminToken } from '../services/api';

function AdminLoginPage() {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = getAdminToken();
  const location = useLocation();
  const navigate = useNavigate();

  if (token) {
    return <Navigate to="/painel-interno" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await adminLogin({ email, password });
      saveAdminToken(response.token);
      const target = location.state?.from?.pathname || '/painel-interno';
      navigate(target, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="admin-login-wrap">
      <Card className="admin-login-card-pro">
        <span className="eyebrow">Area administrativa</span>
        <h1>Acesso ao painel</h1>
        <p>Gerencie produtos, pedidos e banners em uma interface moderna.</p>

        <form className="form-stack" onSubmit={handleSubmit}>
          <Input label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="form-error">{error}</p> : null}
          <Button loading={loading} type="submit">
            Entrar
          </Button>
        </form>
      </Card>
    </section>
  );
}

export default AdminLoginPage;
