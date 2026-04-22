import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
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
    <section className="container py-8">
      <SectionHeader title="Entrar na conta" subtitle="Acesse suas compras e acompanhe seus pedidos." />
      <Card className="mx-auto max-w-lg space-y-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input label="Email ou telefone" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
          <Input label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <Button className="w-full" type="submit" loading={loading}>Entrar</Button>
        </form>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-violet-700 underline" to="/minha-conta/cadastro">Criar conta</Link>
          <Link className="text-violet-700 underline" to="/minha-conta/esqueci-senha">Esqueci minha senha</Link>
        </div>
      </Card>
    </section>
  );
}

export default CustomerLoginPage;
