import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import SectionHeader from '../components/ui/SectionHeader';
import { checkInfinitePayStatus, fetchPublicInfinitePayReturnStatus } from '../services/api';

function PaymentReturnPage() {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const orderNsu = useMemo(() => params.get('order_nsu') || '', [params]);
  const slug = useMemo(() => params.get('slug') || '', [params]);
  const transactionNsu = useMemo(() => params.get('transaction_nsu') || '', [params]);

  useEffect(() => {
    if (!orderNsu) {
      setError('Pagamento nao identificado: order_nsu ausente.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    fetchPublicInfinitePayReturnStatus({
      order_nsu: orderNsu,
      slug: slug || undefined,
      transaction_nsu: transactionNsu || undefined,
    })
      .then(async (data) => {
        setStatus(data || null);
        if (data?.payment_status !== 'paid' && data?.payment_status !== 'not_found') {
          try {
            const statusCheck = await checkInfinitePayStatus({
              order_nsu: orderNsu,
              slug: slug || undefined,
              transaction_nsu: transactionNsu || undefined,
            });
            setStatus((current) => ({
              ...(current || {}),
              payment_status: statusCheck?.payment_status || current?.payment_status,
              payment_method: statusCheck?.payment_method || current?.payment_method,
              paid_amount: statusCheck?.paid_amount ?? current?.paid_amount,
            }));
          } catch {
            // fallback no status already loaded
          }
        }
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao consultar retorno do pagamento.'))
      .finally(() => setLoading(false));
  }, [orderNsu, slug, transactionNsu]);

  const title = (() => {
    const paymentStatus = String(status?.payment_status || '').toLowerCase();
    if (paymentStatus === 'paid') return 'Pagamento aprovado';
    if (paymentStatus === 'pending' || paymentStatus === 'pending_payment' || paymentStatus === 'awaiting_confirmation') return 'Pagamento pendente';
    if (paymentStatus === 'not_found') return 'Pagamento nao identificado';
    return 'Status do pagamento';
  })();

  const tone = (() => {
    const paymentStatus = String(status?.payment_status || '').toLowerCase();
    if (paymentStatus === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (paymentStatus === 'pending' || paymentStatus === 'pending_payment' || paymentStatus === 'awaiting_confirmation') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-slate-50 text-slate-700';
  })();

  return (
    <section className="container py-8">
      <SectionHeader title="Retorno do pagamento" subtitle="Validacao do checkout online da InfinitePay." />
      <Card className="space-y-4">
        {loading ? <p className="text-sm text-slate-500">Validando pagamento...</p> : null}
        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {!loading && !error ? (
          <>
            <div className={`rounded-xl border px-3 py-3 text-sm font-medium ${tone}`}>{title}</div>
            <div className="space-y-1 text-sm text-slate-700">
              <p>Pedido: <strong>#{status?.order_id || '-'}</strong></p>
              <p>Order NSU: <strong>{status?.order_nsu || orderNsu || '-'}</strong></p>
              <p>Status: <strong>{status?.payment_status || '-'}</strong></p>
              <p>Metodo: <strong>{status?.payment_method || '-'}</strong></p>
              <p>Total: <strong>R$ {Number(status?.total || 0).toFixed(2)}</strong></p>
              <p>Pago: <strong>R$ {Number(status?.paid_amount || 0).toFixed(2)}</strong></p>
              {status?.receipt_url ? (
                <p>
                  Comprovante: <a className="text-violet-700 underline" href={status.receipt_url} target="_blank" rel="noreferrer">abrir recibo</a>
                </p>
              ) : null}
            </div>
          </>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white"
          >
            Voltar para loja
          </Link>
          <Link
            to="/cart"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Ir para carrinho
          </Link>
        </div>
      </Card>
    </section>
  );
}

export default PaymentReturnPage;
