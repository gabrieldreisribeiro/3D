import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
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
    <section className="container py-8">
      <SectionHeader title="Criar conta" subtitle="Cadastre-se para acompanhar pedidos atuais e antigos." />
      <Card className="mx-auto max-w-lg space-y-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input label="Nome completo" value={form.full_name} onChange={(event) => handleChange('full_name', event.target.value)} required />
          <Input label="Email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} required />
          <Input label="Telefone" value={form.phone_number} onChange={(event) => handleChange('phone_number', event.target.value)} required />
          <Input label="Senha" type="password" value={form.password} onChange={(event) => handleChange('password', event.target.value)} required />
          <Input label="Confirmar senha" type="password" value={form.confirm_password} onChange={(event) => handleChange('confirm_password', event.target.value)} required />
          <Button className="w-full" type="submit" loading={loading}>Criar conta</Button>
        </form>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <p className="text-sm">Ja tem conta? <Link className="text-violet-700 underline" to="/minha-conta/login">Entrar</Link></p>
      </Card>
    </section>
  );
}

export default CustomerRegisterPage;
