import { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import {
  approveAdminReview,
  deleteAdminReview,
  fetchAdminProducts,
  fetchAdminReviews,
  rejectAdminReview,
  resolveAssetUrl,
} from '../services/api';

function getStatusTone(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function getStatusLabel(status) {
  if (status === 'approved') return 'Aprovada';
  if (status === 'rejected') return 'Rejeitada';
  return 'Pendente';
}

function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReview, setSelectedReview] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [submittingAction, setSubmittingAction] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadReviews = () => {
    setLoading(true);
    setError('');
    fetchAdminReviews({
      page,
      page_size: pageSize,
      status: statusFilter === 'all' ? undefined : statusFilter,
      product_id: productFilter === 'all' ? undefined : Number(productFilter),
      rating: ratingFilter === 'all' ? undefined : Number(ratingFilter),
    })
      .then((data) => {
        setReviews(data.items || []);
        setTotal(Number(data.total || 0));
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar avaliacoes.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdminProducts().then(setProducts).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    loadReviews();
  }, [page, pageSize, statusFilter, productFilter, ratingFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const performAction = async (reviewId, action) => {
    setSubmittingAction(`${action}-${reviewId}`);
    setError('');
    try {
      if (action === 'approve') await approveAdminReview(reviewId);
      if (action === 'reject') await rejectAdminReview(reviewId);
      if (action === 'delete') await deleteAdminReview(reviewId);
      if (selectedReview?.id === reviewId) setSelectedReview(null);
      loadReviews();
    } catch (actionError) {
      setError(actionError.message || 'Falha ao atualizar avaliacao.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const productOptions = useMemo(
    () => products.map((product) => ({ value: String(product.id), label: product.title })),
    [products]
  );

  return (
    <section className="admin-page space-y-6">
      <SectionHeader eyebrow="Operacao" title="Avaliacoes" subtitle="Modere comentarios e midias de produtos" />

      <DataCard title="Lista de avaliacoes">
        <div className="mb-3 admin-filter-bar rounded-xl border border-slate-200 bg-slate-50 p-3">
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="all">Todos status</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Rejeitadas</option>
          </select>

          <select
            value={productFilter}
            onChange={(event) => {
              setProductFilter(event.target.value);
              setPage(1);
            }}
            className="h-9 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="all">Todos produtos</option>
            {productOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={ratingFilter}
            onChange={(event) => {
              setRatingFilter(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
          >
            <option value="all">Todas notas</option>
            <option value="5">5 estrelas</option>
            <option value="4">4 estrelas</option>
            <option value="3">3 estrelas</option>
            <option value="2">2 estrelas</option>
            <option value="1">1 estrela</option>
          </select>

          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-violet-300"
          >
            <option value={10}>10 / pagina</option>
            <option value={20}>20 / pagina</option>
            <option value={50}>50 / pagina</option>
          </select>
        </div>

        {error ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando avaliacoes...</div> : null}

        {!loading ? (
          <Table
            columns={['ID', 'Produto', 'Autor', 'Nota', 'Status', 'Data', 'Midia', 'Acoes']}
            rows={reviews}
            empty={<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Nenhuma avaliacao encontrada.</div>}
            renderRow={(review) => (
              <tr key={review.id}>
                <td>#{review.id}</td>
                <td>
                  <div className="max-w-[220px] truncate" title={review.product_title || '-'}>
                    {review.product_title || '-'}
                  </div>
                </td>
                <td>{review.author_name}</td>
                <td>{review.rating}★</td>
                <td>
                  <StatusBadge tone={getStatusTone(review.status)}>{getStatusLabel(review.status)}</StatusBadge>
                </td>
                <td>{review.created_at ? new Date(review.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td>
                  <span className="text-xs text-slate-600">{review.has_media ? `${(review.photos || []).length} foto(s)` : 'Sem midia'}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" className="h-8 px-3 text-xs" onClick={() => setSelectedReview(review)}>
                      Ver
                    </Button>
                    {review.status !== 'approved' ? (
                      <Button
                        className="h-8 px-3 text-xs"
                        loading={submittingAction === `approve-${review.id}`}
                        loadingText="..."
                        onClick={() => performAction(review.id, 'approve')}
                      >
                        Aprovar
                      </Button>
                    ) : null}
                    {review.status !== 'rejected' ? (
                      <Button
                        variant="secondary"
                        className="h-8 px-3 text-xs"
                        loading={submittingAction === `reject-${review.id}`}
                        loadingText="..."
                        onClick={() => performAction(review.id, 'reject')}
                      >
                        Rejeitar
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      className="h-8 px-3 text-xs"
                      loading={submittingAction === `delete-${review.id}`}
                      loadingText="..."
                      onClick={() => performAction(review.id, 'delete')}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />
        ) : null}

        {!loading ? (
          <div className="mt-3 admin-pagination-bar rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-600">
              Mostrando <strong>{total ? (page - 1) * pageSize + 1 : 0}</strong> - <strong>{Math.min(page * pageSize, total)}</strong> de <strong>{total}</strong> avaliacoes
            </p>
            <div className="admin-pagination-actions">
              <Button variant="secondary" className="h-8 px-3 text-xs" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Anterior
              </Button>
              <span className="text-xs text-slate-600">Pagina {page} de {totalPages}</span>
              <Button variant="secondary" className="h-8 px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Proxima
              </Button>
            </div>
          </div>
        ) : null}
      </DataCard>

      <Modal open={Boolean(selectedReview)} title={`Avaliacao #${selectedReview?.id || ''}`} onClose={() => setSelectedReview(null)} footer={<Button onClick={() => setSelectedReview(null)}>Fechar</Button>}>
        {selectedReview ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <strong>Produto:</strong> {selectedReview.product_title || '-'}
            </p>
            <p>
              <strong>Autor:</strong> {selectedReview.author_name}
            </p>
            <p>
              <strong>Nota:</strong> {selectedReview.rating} estrelas
            </p>
            <p>
              <strong>Status:</strong> {getStatusLabel(selectedReview.status)}
            </p>
            <p>
              <strong>Comentario:</strong> {selectedReview.comment}
            </p>
            {(selectedReview.photos || []).length ? (
              <div className="flex flex-wrap gap-2">
                {(selectedReview.photos || []).map((photo, index) => (
                  <img
                    key={`review-media-image-${index}`}
                    src={resolveAssetUrl(photo) || photo}
                    alt={`Midia ${index + 1}`}
                    className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                  />
                ))}
              </div>
            ) : null}
            {selectedReview.video ? (
              <video className="max-h-60 w-full rounded-lg border border-slate-200 bg-black" controls preload="metadata">
                <source src={resolveAssetUrl(selectedReview.video) || selectedReview.video} />
              </video>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default AdminReviewsPage;


