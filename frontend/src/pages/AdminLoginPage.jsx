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
    <section className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md space-y-5 rounded-2xl p-6 sm:p-7">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Area administrativa</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Acesso ao painel</h1>
          <p className="text-sm text-slate-500">Gerencie produtos, pedidos e banners em uma interface moderna.</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button loading={loading} type="submit">
            Entrar
          </Button>
        </form>
      </Card>
    </section>
  );
}

export default AdminLoginPage;

