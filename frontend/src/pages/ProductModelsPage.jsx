import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Model3DViewer from '../components/Model3DViewer';
import Button from '../components/ui/Button';
import { fetchProduct, fetchPublicProductModels, resolveAssetUrl } from '../services/api';

function ProductModelsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const previewPrefix = location.pathname.startsWith('/preview') ? '/preview' : '';
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([fetchProduct(slug), fetchPublicProductModels(slug)])
      .then(([productData, modelRows]) => {
        const rows = Array.isArray(modelRows) ? modelRows : [];
        setProduct(productData);
        setModels(rows);
        setSelectedId(rows[0]?.id ?? null);
      })
      .catch((requestError) => {
        setError(requestError.message || 'Falha ao carregar modelos 3D.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === selectedId) || models[0] || null,
    [models, selectedId]
  );

  if (loading) {
    return <section className="container py-10 text-sm text-slate-600">Carregando modelos 3D...</section>;
  }

  if (error) {
    return (
      <section className="container py-10">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      </section>
    );
  }

  if (!product || !models.length) {
    return (
      <section className="container py-10 space-y-3">
        <h1 className="text-xl font-semibold text-slate-900">Modelos 3D</h1>
        <p className="text-sm text-slate-600">Este produto ainda nao possui modelos 3D publicados.</p>
        <Button variant="secondary" onClick={() => navigate(`${previewPrefix}/product/${slug}`)}>Voltar ao produto</Button>
      </section>
    );
  }

  return (
    <section className="container space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Modelos 3D</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{product.title}</h1>
        </div>
        <Button variant="secondary" onClick={() => navigate(`${previewPrefix}/product/${slug}`)}>Voltar ao produto</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-1 gap-2 max-lg:grid-cols-2">
            {models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => setSelectedId(model.id)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  model.id === selectedModel?.id
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-slate-200 bg-slate-50 hover:border-violet-200'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{model.name}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {model.width_mm ?? '-'} x {model.height_mm ?? '-'} x {model.depth_mm ?? '-'} mm
                </p>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          {selectedModel ? (
            <>
              <Model3DViewer fileUrl={selectedModel.preview_file_url} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedModel.name}</h2>
                  <p className="text-sm text-slate-600">{selectedModel.description || 'Sem descricao adicional.'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dimensoes: {selectedModel.width_mm ?? '-'}mm x {selectedModel.height_mm ?? '-'}mm x {selectedModel.depth_mm ?? '-'}mm
                  </p>
                </div>
                {selectedModel.allow_download && selectedModel.original_file_url ? (
                  <a
                    href={resolveAssetUrl(selectedModel.original_file_url) || selectedModel.original_file_url}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Baixar modelo
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ProductModelsPage;
