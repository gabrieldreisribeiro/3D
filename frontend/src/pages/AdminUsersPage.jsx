import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminMe,
  fetchAdminUsers,
  setAdminUserBlocked,
  updateAdminUser,
  updateAdminUserPassword,
} from '../services/api';

const initialCreateForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'admin',
  is_active: true,
};

const initialEditForm = {
  name: '',
  email: '',
  role: 'admin',
  is_active: true,
};

const initialPasswordForm = {
  newPassword: '',
  confirmPassword: '',
};

function formatLastLogin(value) {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Nunca';
  return date.toLocaleString('pt-BR');
}

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([fetchAdminUsers(), fetchAdminMe()])
      .then(([adminUsers, me]) => {
        setUsers(adminUsers);
        setCurrentAdmin(me);
      })
      .catch((requestError) => {
        setError(requestError.message || 'Falha ao carregar usuarios.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    return users.filter((item) => {
      if (!q) return true;
      const name = String(item.name || '').toLowerCase();
      const email = String(item.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [search, users]);

  const superAdminCount = useMemo(
    () => users.filter((item) => item.role === 'super_admin').length,
    [users]
  );

  const validateCreateForm = () => {
    if (createForm.password.length < 6) return 'A senha deve ter no minimo 6 caracteres.';
    if (createForm.password !== createForm.confirmPassword) return 'A confirmacao de senha nao confere.';
    return '';
  };

  const validatePasswordForm = () => {
    if (passwordForm.newPassword.length < 6) return 'A senha deve ter no minimo 6 caracteres.';
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return 'A confirmacao de senha nao confere.';
    return '';
  };

  const openEdit = (user) => {
    setEditTarget(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'admin',
      is_active: Boolean(user.is_active),
    });
    setError('');
  };

  const createUser = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    const validation = validateCreateForm();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      await createAdminUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        is_active: Boolean(createForm.is_active),
      });
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      setSuccessMessage('Usuario criado com sucesso.');
      loadData();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao criar usuario.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editTarget) return;
    setError('');
    setSuccessMessage('');
    setSaving(true);
    try {
      await updateAdminUser(editTarget.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        is_active: Boolean(editForm.is_active),
      });
      setEditTarget(null);
      setSuccessMessage('Usuario atualizado com sucesso.');
      loadData();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao atualizar usuario.');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!passwordTarget) return;
    setError('');
    setSuccessMessage('');
    const validation = validatePasswordForm();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      await updateAdminUserPassword(passwordTarget.id, { new_password: passwordForm.newPassword });
      setPasswordTarget(null);
      setPasswordForm(initialPasswordForm);
      setSuccessMessage('Senha atualizada com sucesso.');
    } catch (submitError) {
      setError(submitError.message || 'Falha ao atualizar senha.');
    } finally {
      setSaving(false);
    }
  };

  const confirmBlockToggle = async () => {
    if (!blockTarget) return;
    setError('');
    setSuccessMessage('');
    setSaving(true);
    try {
      await setAdminUserBlocked(blockTarget.id, !blockTarget.is_blocked);
      setBlockTarget(null);
      setSuccessMessage(`Usuario ${blockTarget.is_blocked ? 'desbloqueado' : 'bloqueado'} com sucesso.`);
      loadData();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao alterar bloqueio.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    setSuccessMessage('');
    setSaving(true);
    try {
      await deleteAdminUser(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessMessage('Usuario excluido com sucesso.');
      loadData();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao excluir usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Seguranca"
        title="Usuarios"
        subtitle="Gerencie acessos administrativos com perfis e bloqueios."
        action={<Button onClick={() => { setCreateOpen(true); setError(''); }}>Novo usuario</Button>}
      />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {successMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p> : null}

      <DataCard title="Lista de usuarios administrativos">
        {loading ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Carregando usuarios...</p> : null}

        {!loading ? (
          <>
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou e-mail"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
              />
            </div>

            <Table
              columns={['Nome', 'E-mail', 'Tipo', 'Status', 'Ultimo acesso', 'Acoes']}
              rows={filteredUsers}
              empty={<EmptyState title="Sem usuarios" description="Crie o primeiro usuario administrativo." />}
              renderRow={(user) => {
                const isSelf = currentAdmin?.id === user.id;
                const isLastSuperAdmin = user.role === 'super_admin' && superAdminCount <= 1;
                const blockDisabled = isSelf || isLastSuperAdmin;
                const deleteDisabled = isSelf || isLastSuperAdmin;
                return (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <StatusBadge tone={user.role === 'super_admin' ? 'info' : 'neutral'}>
                        {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </StatusBadge>
                    </td>
                    <td>
                      {user.is_blocked ? (
                        <StatusBadge tone="danger">Bloqueado</StatusBadge>
                      ) : (
                        <StatusBadge tone={user.is_active ? 'success' : 'warning'}>
                          {user.is_active ? 'Ativo' : 'Inativo'}
                        </StatusBadge>
                      )}
                    </td>
                    <td>{formatLastLogin(user.last_login_at)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => openEdit(user)}>Editar</Button>
                        <Button
                          variant="ghost"
                          onClick={() => setBlockTarget(user)}
                          disabled={blockDisabled}
                          title={blockDisabled ? 'Acao bloqueada por regra de seguranca' : ''}
                        >
                          {user.is_blocked ? 'Desbloquear' : 'Bloquear'}
                        </Button>
                        <Button variant="ghost" onClick={() => { setPasswordTarget(user); setPasswordForm(initialPasswordForm); setError(''); }}>
                          Alterar senha
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => setDeleteTarget(user)}
                          disabled={deleteDisabled}
                          title={deleteDisabled ? 'Acao bloqueada por regra de seguranca' : ''}
                        >
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }}
            />
          </>
        ) : null}
      </DataCard>

      <Modal
        open={createOpen}
        title="Novo usuario"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={createUser}>Criar usuario</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={createUser}>
          <Input label="Nome" value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} required />
          <Input label="E-mail" type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} required />
          <Input label="Senha" type="password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} required />
          <Input
            label="Confirmar senha"
            type="password"
            value={createForm.confirmPassword}
            onChange={(event) => setCreateForm({ ...createForm, confirmPassword: event.target.value })}
            required
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tipo</span>
            <select
              value={createForm.role}
              onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createForm.is_active}
              onChange={(event) => setCreateForm({ ...createForm, is_active: event.target.checked })}
            />
            Usuario ativo
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        title="Editar usuario"
        onClose={() => setEditTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button loading={saving} onClick={saveEdit}>Salvar alteracoes</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveEdit}>
          <Input label="Nome" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
          <Input label="E-mail" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tipo</span>
            <select
              value={editForm.role}
              onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })}
            />
            Usuario ativo
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(passwordTarget)}
        title="Alterar senha"
        onClose={() => setPasswordTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordTarget(null)}>Cancelar</Button>
            <Button loading={saving} onClick={savePassword}>Atualizar senha</Button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4" onSubmit={savePassword}>
          <Input
            label="Nova senha"
            type="password"
            value={passwordForm.newPassword}
            onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
            required
          />
          <Input
            label="Confirmar senha"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
            required
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(blockTarget)}
        title={blockTarget?.is_blocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
        onClose={() => setBlockTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockTarget(null)}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={confirmBlockToggle}>
              {blockTarget?.is_blocked ? 'Desbloquear' : 'Bloquear'}
            </Button>
          </>
        }
      >
        <p>
          Deseja {blockTarget?.is_blocked ? 'desbloquear' : 'bloquear'} o usuario <strong>{blockTarget?.name}</strong>?
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Excluir usuario"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={confirmDelete}>Excluir</Button>
          </>
        }
      >
        <p>Tem certeza que deseja excluir este usuario?</p>
      </Modal>
    </section>
  );
}

export default AdminUsersPage;
