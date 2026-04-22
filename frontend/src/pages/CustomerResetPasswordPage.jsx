import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
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
      setMessage('Senha redefinida com sucesso. Faça login novamente.');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container py-8">
      <SectionHeader title="Redefinir senha" subtitle="Use o token gerado para criar uma nova senha." />
      <Card className="mx-auto max-w-lg space-y-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input label="Token" value={token} onChange={(event) => setToken(event.target.value)} required />
          <Input label="Nova senha" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          <Input label="Confirmar nova senha" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          <Button className="w-full" type="submit" loading={loading}>Salvar nova senha</Button>
        </form>
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <p className="text-sm"><Link className="text-violet-700 underline" to="/minha-conta/login">Voltar para login</Link></p>
      </Card>
    </section>
  );
}

export default CustomerResetPasswordPage;
