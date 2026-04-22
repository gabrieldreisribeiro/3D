import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
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
      setError(submitError.message || 'Falha ao solicitar reset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container py-8">
      <SectionHeader title="Recuperar senha" subtitle="Solicite um token para redefinir sua senha." />
      <Card className="mx-auto max-w-lg space-y-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input label="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Button className="w-full" type="submit" loading={loading}>Gerar token</Button>
        </form>
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {token ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">Token: <strong>{token}</strong></p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <p className="text-sm"><Link className="text-violet-700 underline" to="/minha-conta/redefinir-senha">Ja tem token? Redefinir senha</Link></p>
      </Card>
    </section>
  );
}

export default CustomerForgotPasswordPage;
