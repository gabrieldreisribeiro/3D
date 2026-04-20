import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import {
  discardAdminDraft,
  fetchAdminPublicationPending,
  publishAdminDraft,
  publishAllAdminDrafts,
} from '../services/api';

function entityLabel(type) {
  if (type === 'product') return 'Produto';
  if (type === 'banner') return 'Banner';
  if (type === 'highlight') return 'Highlight';
  if (type === 'promotion') return 'Promocao';
  return type;
}

function toneForAction(action) {
  if (action === 'create') return 'info';
  if (action === 'update') return 'warning';
  if (action === 'delete') return 'danger';
  return 'neutral';
}

function actionLabel(action) {
  if (action === 'create') return 'Novo rascunho';
  if (action === 'update') return 'Edicao pendente';
  if (action === 'delete') return 'Exclusao pendente';
  return 'Pendente';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function AdminPublicationPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadPending = () => {
    setLoading(true);
    fetchAdminPublicationPending()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar pendencias de publicacao.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPending();
  }, []);

  const groupedCount = useMemo(() => {
    return {
      total: items.length,
      products: items.filter((item) => item.entity_type === 'product').length,
      banners: items.filter((item) => item.entity_type === 'banner').length,
      highlights: items.filter((item) => item.entity_type === 'highlight').length,
      promotions: items.filter((item) => item.entity_type === 'promotion').length,
    };
  }, [items]);

  const publishAll = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await publishAllAdminDrafts();
      setMessage(`Publicacao concluida. ${result?.published_count || 0} alteracao(oes) aplicadas.`);
      loadPending();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao publicar alteracoes.');
    } finally {
      setBusy(false);
    }
  };

  const publishOne = async (item) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await publishAdminDraft(item.entity_type, item.entity_id ?? -item.draft_id);
      setMessage(`Publicado: ${item.title}`);
      loadPending();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao publicar item.');
    } finally {
      setBusy(false);
    }
  };

  const discardOne = async (item) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await discardAdminDraft(item.entity_type, item.entity_id ?? -item.draft_id);
      setMessage(`Rascunho descartado: ${item.title}`);
      loadPending();
    } catch (requestError) {
      setError(requestError.message || 'Falha ao descartar rascunho.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Publicacao"
        title="Preview e Publicacao"
        subtitle="Edicoes ficam em rascunho ate voce publicar. O site publico nao muda automaticamente."
        action={(
          <div className="flex flex-wrap gap-2">
            <Link to="/preview" target="_blank" rel="noreferrer">
              <Button variant="secondary">Visualizar site preview</Button>
            </Link>
            <Button onClick={publishAll} loading={busy} disabled={busy || !items.length}>Publicar tudo</Button>
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <DataCard title="Pendencias"><p className="text-2xl font-semibold text-slate-900">{groupedCount.total}</p></DataCard>
        <DataCard title="Produtos"><p className="text-2xl font-semibold text-slate-900">{groupedCount.products}</p></DataCard>
        <DataCard title="Banners"><p className="text-2xl font-semibold text-slate-900">{groupedCount.banners}</p></DataCard>
        <DataCard title="Highlights"><p className="text-2xl font-semibold text-slate-900">{groupedCount.highlights}</p></DataCard>
        <DataCard title="Promocoes"><p className="text-2xl font-semibold text-slate-900">{groupedCount.promotions}</p></DataCard>
      </div>

      <DataCard title="Alteracoes pendentes">
        {loading ? <p className="text-sm text-slate-500">Carregando pendencias...</p> : null}
        {!loading ? (
          <Table
            columns={['Item', 'Tipo', 'Acao', 'Ultima alteracao', 'Acoes']}
            rows={items}
            empty={<EmptyState title="Sem alteracoes pendentes" description="Tudo publicado. Novas alteracoes salvas no admin aparecerao aqui." />}
            renderRow={(item) => (
              <tr key={item.draft_id}>
                <td>
                  <div className="table-title-cell">
                    <strong className="font-semibold text-slate-900">{item.title}</strong>
                    <small>{item.status}</small>
                  </div>
                </td>
                <td>{entityLabel(item.entity_type)}</td>
                <td>
                  <StatusBadge tone={toneForAction(item.action)}>{actionLabel(item.action)}</StatusBadge>
                </td>
                <td>{formatDate(item.updated_at)}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => publishOne(item)} disabled={busy}>Publicar</Button>
                    <Button variant="danger" onClick={() => discardOne(item)} disabled={busy}>Descartar</Button>
                  </div>
                </td>
              </tr>
            )}
          />
        ) : null}

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </DataCard>
    </section>
  );
}

export default AdminPublicationPage;
