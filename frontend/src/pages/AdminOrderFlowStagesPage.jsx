import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
import {
  createAdminOrderFlowStage,
  deleteAdminOrderFlowStage,
  fetchAdminOrderFlowStages,
  reorderAdminOrderFlowStages,
  updateAdminOrderFlowStage,
} from '../services/api';

const INITIAL_FORM = {
  name: '',
  description: '',
  color: '#64748B',
  icon_name: '',
  sort_order: '',
  is_active: true,
  is_visible_to_customer: true,
};

function AdminOrderFlowStagesPage() {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)),
    [stages]
  );

  const stats = useMemo(() => {
    const total = orderedStages.length;
    const active = orderedStages.filter((item) => item.is_active).length;
    const visible = orderedStages.filter((item) => item.is_visible_to_customer).length;
    return {
      total,
      active,
      internal: Math.max(0, total - visible),
    };
  }, [orderedStages]);

  const loadStages = () => {
    setLoading(true);
    fetchAdminOrderFlowStages()
      .then((data) => setStages(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar etapas.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStages();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
  };

  const handleEdit = (stage) => {
    setEditingId(stage.id);
    setForm({
      name: stage.name || '',
      description: stage.description || '',
      color: stage.color || '#64748B',
      icon_name: stage.icon_name || '',
      sort_order: String(stage.sort_order || ''),
      is_active: Boolean(stage.is_active),
      is_visible_to_customer: Boolean(stage.is_visible_to_customer),
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const payload = {
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim() || null,
      color: String(form.color || '').trim() || null,
      icon_name: String(form.icon_name || '').trim() || null,
      sort_order: form.sort_order ? Number(form.sort_order) : null,
      is_active: Boolean(form.is_active),
      is_visible_to_customer: Boolean(form.is_visible_to_customer),
    };
    try {
      if (editingId) {
        const updated = await updateAdminOrderFlowStage(editingId, payload);
        setStages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setMessage('Etapa atualizada com sucesso.');
      } else {
        const created = await createAdminOrderFlowStage(payload);
        setStages((current) => [...current, created]);
        setMessage('Etapa criada com sucesso.');
      }
      resetForm();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao salvar etapa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stageId) => {
    if (!window.confirm('Deseja realmente excluir esta etapa?')) return;
    setError('');
    setMessage('');
    try {
      await deleteAdminOrderFlowStage(stageId);
      setStages((current) => current.filter((item) => item.id !== stageId));
      if (editingId === stageId) resetForm();
      setMessage('Etapa excluida com sucesso.');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao excluir etapa.');
    }
  };

  const moveStage = async (stageId, direction) => {
    const index = orderedStages.findIndex((stage) => stage.id === stageId);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedStages.length) return;
    const swapped = [...orderedStages];
    const [removed] = swapped.splice(index, 1);
    swapped.splice(targetIndex, 0, removed);
    const orderedIds = swapped.map((item) => item.id);
    setStages(swapped.map((item, idx) => ({ ...item, sort_order: idx + 1 })));
    try {
      const saved = await reorderAdminOrderFlowStages(orderedIds);
      setStages(saved);
      setMessage('Ordem atualizada com sucesso.');
    } catch (requestError) {
      setError(requestError.message || 'Falha ao reordenar etapas.');
      loadStages();
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Operacao"
        title="Fluxo de pedidos"
        subtitle="Configure as etapas exibidas no Kanban e na timeline do cliente."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total de etapas</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Etapas ativas</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-800">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Etapas internas</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-amber-800">{stats.internal}</p>
        </div>
      </section>

      <DataCard title={editingId ? 'Editar etapa' : 'Nova etapa'}>
        <form className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" onSubmit={handleSave}>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Dados da etapa</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Nome"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <Input
                label="Icone (opcional)"
                value={form.icon_name}
                onChange={(event) => setForm((current) => ({ ...current, icon_name: event.target.value }))}
                placeholder="truck, check-circle..."
              />
              <Input
                label="Descricao (opcional)"
                className="md:col-span-2"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
              <Input
                label="Cor"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                placeholder="#64748B"
              />
              <Input
                label="Ordem (opcional)"
                type="number"
                min="1"
                value={form.sort_order}
                onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Visibilidade</p>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
              />
              Etapa ativa
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_visible_to_customer}
                onChange={(event) => setForm((current) => ({ ...current, is_visible_to_customer: event.target.checked }))}
              />
              Exibir para cliente
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Preview</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: form.color || '#64748B' }} />
                <strong className="text-sm text-slate-900">{form.name || 'Nome da etapa'}</strong>
              </div>
              <p className="mt-1 text-xs text-slate-500">{form.description || 'Descricao da etapa para equipe e timeline.'}</p>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" loading={saving}>
              {editingId ? 'Salvar etapa' : 'Criar etapa'}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar edicao
              </Button>
            ) : null}
          </div>
        </form>
      </DataCard>

      <DataCard title="Etapas cadastradas">
        {loading ? <p className="text-sm text-slate-500">Carregando etapas...</p> : null}
        {!loading ? (
          <div className="space-y-3">
            {orderedStages.map((stage) => (
              <article key={stage.id} className="glass-card rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: stage.color || '#64748B' }} />
                      <p className="font-semibold text-slate-900">{stage.name}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stage.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        {stage.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stage.is_visible_to_customer ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                        {stage.is_visible_to_customer ? 'Cliente' : 'Interna'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Ordem {stage.sort_order}</p>
                    {stage.description ? <p className="mt-2 text-sm text-slate-600">{stage.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => moveStage(stage.id, -1)}>
                      Subir
                    </Button>
                    <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => moveStage(stage.id, 1)}>
                      Descer
                    </Button>
                    <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => handleEdit(stage)}>
                      Editar
                    </Button>
                    <Button type="button" variant="danger" className="h-9 px-3 text-xs" onClick={() => handleDelete(stage.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </article>
            ))}
            {!orderedStages.length ? <p className="text-sm text-slate-500">Nenhuma etapa cadastrada.</p> : null}
          </div>
        ) : null}
        {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </DataCard>
    </section>
  );
}

export default AdminOrderFlowStagesPage;
