import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import {
  createAdminProductFromAdCopy,
  fetchAdminAdsConfig,
  fetchAdminAdsHistory,
  generateAdminAds,
  saveAdminAdsConfig,
  testAdminAdsConfig,
} from '../services/api';

const initialConfig = {
  provider_name: 'nvidia',
  base_url: 'https://integrate.api.nvidia.com/v1',
  api_key: '',
  model_name: 'qwen/qwen2.5-coder-7b-instruct',
  prompt_complement: '',
  is_active: false,
};

function adToText(ad) {
  return [
    `Headline: ${ad.headline}`,
    `Copy principal: ${ad.primary_text}`,
    `Descricao: ${ad.description}`,
    `CTA: ${ad.cta}`,
    `Publico alvo: ${ad.target_audience}`,
    `Ideia de criativo: ${ad.creative_idea}`,
  ].join('\n');
}

function downloadAdText(ad, index) {
  const blob = new Blob([adToText(ad)], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `anuncio_ia_${index + 1}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function AdminAdsPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(initialConfig);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const [configError, setConfigError] = useState('');
  const [connectionResult, setConnectionResult] = useState(null);
  const [defaultPromptMd, setDefaultPromptMd] = useState('');

  const [adsCount, setAdsCount] = useState(3);
  const [extraContext, setExtraContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateMessage, setGenerateMessage] = useState('');
  const [generatedAds, setGeneratedAds] = useState([]);
  const [generatedInput, setGeneratedInput] = useState(null);
  const [historyId, setHistoryId] = useState(null);
  const [modelUsed, setModelUsed] = useState('');

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [creatingProductByIndex, setCreatingProductByIndex] = useState({});

  const historyTotalPages = useMemo(() => Math.max(1, Math.ceil(historyTotal / historyPageSize)), [historyTotal, historyPageSize]);

  const loadConfig = () => {
    setLoadingConfig(true);
    setConfigError('');
    fetchAdminAdsConfig()
      .then((data) => {
        setConfig({
          provider_name: data?.provider_name || 'nvidia',
          base_url: data?.base_url || 'https://integrate.api.nvidia.com/v1',
          api_key: '',
          model_name: data?.model_name || 'qwen/qwen2.5-coder-7b-instruct',
          prompt_complement: data?.prompt_complement || '',
          is_active: Boolean(data?.is_active),
        });
        setDefaultPromptMd(data?.default_prompt_md || '');
        setHasApiKey(Boolean(data?.has_api_key));
      })
      .catch((requestError) => setConfigError(requestError.message || 'Falha ao carregar configuracao.'))
      .finally(() => setLoadingConfig(false));
  };

  const loadHistory = () => {
    setHistoryLoading(true);
    fetchAdminAdsHistory({ page: historyPage, page_size: historyPageSize })
      .then((data) => {
        setHistoryItems(data?.items || []);
        setHistoryTotal(Number(data?.total || 0));
      })
      .catch((requestError) => setGenerateError(requestError.message || 'Falha ao carregar historico.'))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [historyPage, historyPageSize]);

  const handleSaveConfig = async (event) => {
    event.preventDefault();
    setSavingConfig(true);
    setConfigError('');
    setConfigMessage('');
    try {
      const saved = await saveAdminAdsConfig(config);
      setConfig((current) => ({ ...current, api_key: '' }));
      setHasApiKey(Boolean(saved?.has_api_key));
      setConfigMessage('Configuracao salva com sucesso.');
    } catch (requestError) {
      setConfigError(requestError.message || 'Falha ao salvar configuracao.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConfig = async () => {
    setTestingConfig(true);
    setConnectionResult(null);
    try {
      const result = await testAdminAdsConfig();
      setConnectionResult(result);
    } catch (requestError) {
      setConnectionResult({
        ok: false,
        message: requestError.message || 'Falha ao testar conexao.',
      });
    } finally {
      setTestingConfig(false);
    }
  };

  const runGenerate = async () => {
    setGenerating(true);
    setGenerateError('');
    setGenerateMessage('');
    try {
      const result = await generateAdminAds({
        ads_count: adsCount,
        extra_context: extraContext || null,
      });
      setGeneratedAds(result?.ads || []);
      setGeneratedInput(result?.input_data_json || null);
      setHistoryId(result?.history_id || null);
      setModelUsed(result?.model_used || '');
      setGenerateMessage('Ideias de anuncios geradas com sucesso.');
      loadHistory();
    } catch (requestError) {
      setGenerateError(requestError.message || 'Nao foi possivel gerar anuncios.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyAd = async (ad) => {
    try {
      await navigator.clipboard.writeText(adToText(ad));
      setGenerateMessage('Texto do anuncio copiado.');
      setTimeout(() => setGenerateMessage(''), 1800);
    } catch {
      setGenerateError('Nao foi possivel copiar para a area de transferencia.');
    }
  };

  const handleCreateProductFromAd = async (adIndex) => {
    if (!historyId) {
      setGenerateError('Historico nao encontrado para este resultado. Gere novamente.');
      return;
    }
    setCreatingProductByIndex((current) => ({ ...current, [adIndex]: true }));
    setGenerateError('');
    try {
      const result = await createAdminProductFromAdCopy({
        ad_generation_id: historyId,
        ad_index: adIndex,
      });
      const target = result?.edit_url || `/painel-interno/produtos?edit=${result?.product_id || ''}&source=ai`;
      navigate(target);
    } catch (requestError) {
      setGenerateError(requestError.message || 'Nao foi possivel criar o produto.');
    } finally {
      setCreatingProductByIndex((current) => ({ ...current, [adIndex]: false }));
    }
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="IA aplicada"
        title="Anuncios com IA"
        subtitle="Gere ideias de anuncios para Facebook e Instagram com base em dados reais de vendas e comportamento."
      />

      <DataCard title="Configuracao do provider NVIDIA (Qwen)">
        {loadingConfig ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando configuracao...</div>
        ) : (
          <form className="grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSaveConfig}>
            <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={config.is_active}
                onChange={(event) => setConfig((current) => ({ ...current, is_active: event.target.checked }))}
              />
              <span>Ativar gerador de anuncios com IA</span>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Provider</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={config.provider_name}
                onChange={(event) => setConfig((current) => ({ ...current, provider_name: event.target.value }))}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Modelo</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={config.model_name}
                onChange={(event) => setConfig((current) => ({ ...current, model_name: event.target.value }))}
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Base URL</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="text"
                value={config.base_url}
                onChange={(event) => setConfig((current) => ({ ...current, base_url: event.target.value }))}
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">API Key</span>
              <input
                className="h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                type="password"
                value={config.api_key}
                onChange={(event) => setConfig((current) => ({ ...current, api_key: event.target.value }))}
                placeholder={hasApiKey ? 'Ja configurada (preencha apenas para trocar)' : 'Cole sua API key'}
              />
              {hasApiKey ? <p className="text-xs text-slate-500">API key ja registrada no backend.</p> : null}
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Complemento de prompt (opcional)</span>
              <textarea
                className="min-h-[120px] w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-300"
                value={config.prompt_complement}
                onChange={(event) => setConfig((current) => ({ ...current, prompt_complement: event.target.value }))}
                placeholder="Ex.: priorize anuncios para decoracao premium e linguagem mais sofisticada."
              />
              <p className="text-xs text-slate-500">
                Esse texto sera somado ao prompt padrao para ajustar o comportamento da IA sem alterar o padrao do sistema.
              </p>
            </label>

            <div className="space-y-2 md:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Prompt padrao (somente leitura)</span>
              <pre className="max-h-72 overflow-auto rounded-[10px] border border-slate-200 bg-slate-950 p-3 text-xs leading-relaxed text-slate-200">
                {defaultPromptMd || 'Prompt padrao indisponivel.'}
              </pre>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <Button type="button" variant="secondary" loading={testingConfig} onClick={handleTestConfig}>
                Testar conexao
              </Button>
              <Button type="submit" loading={savingConfig}>
                Salvar configuracao
              </Button>
            </div>

            {connectionResult ? (
              <div className="md:col-span-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <StatusBadge tone={connectionResult.ok ? 'success' : 'danger'}>
                  {connectionResult.ok ? 'Conectado' : 'Falha'}
                </StatusBadge>
                <span className="text-slate-700">{connectionResult.message}</span>
                {connectionResult.model ? <span className="text-slate-500">Modelo: {connectionResult.model}</span> : null}
              </div>
            ) : null}

            {configMessage ? <p className="md:col-span-2 text-sm text-emerald-600">{configMessage}</p> : null}
            {configError ? <p className="md:col-span-2 text-sm text-rose-600">{configError}</p> : null}
          </form>
        )}
      </DataCard>

      <DataCard title="Gerador de ideias de anuncios">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px,1fr,auto] lg:items-end">
          <label className="grid gap-1 text-xs text-slate-600">
            Quantidade de anuncios
            <select
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
              value={adsCount}
              onChange={(event) => setAdsCount(Number(event.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            Contexto extra (opcional)
            <input
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-300"
              value={extraContext}
              onChange={(event) => setExtraContext(event.target.value)}
              placeholder="Ex.: campanha para Dia das Maes"
            />
          </label>
          <Button className="w-full lg:w-auto" loading={generating} onClick={runGenerate}>
            Gerar ideias de anuncios com IA
          </Button>
        </div>
        {generateMessage ? <p className="mt-3 text-sm text-emerald-600">{generateMessage}</p> : null}
        {generateError ? <p className="mt-3 text-sm text-rose-600">{generateError}</p> : null}
      </DataCard>

      <DataCard title="Resultado">
        {generatedAds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Nenhum anuncio gerado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Historico #{historyId || '-'} | Modelo: <strong>{modelUsed || '-'}</strong>
            </div>
            {generatedInput ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                Produtos usados no prompt: <strong>{(generatedInput.products || []).length}</strong> | Categoria principal:{' '}
                <strong>{generatedInput.main_category || '-'}</strong>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {generatedAds.map((ad, index) => (
                <article key={`ad-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-900">{ad.headline}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{ad.primary_text}</p>
                  <p className="mt-2 text-sm text-slate-600">{ad.description}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600">
                    <p>
                      <strong>CTA:</strong> {ad.cta}
                    </p>
                    <p>
                      <strong>Publico:</strong> {ad.target_audience}
                    </p>
                    <p>
                      <strong>Criativo:</strong> {ad.creative_idea}
                    </p>
                  </div>
                  {ad.existing_product_id ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Produto existente encontrado: {ad.existing_product_title || `#${ad.existing_product_id}`}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button className="h-8 px-3 text-xs" variant="secondary" onClick={() => handleCopyAd(ad)}>
                      Copiar
                    </Button>
                    <Button className="h-8 px-3 text-xs" variant="secondary" onClick={() => downloadAdText(ad, index)}>
                      Salvar
                    </Button>
                    <Button
                      className="h-8 px-3 text-xs"
                      variant="secondary"
                      loading={Boolean(creatingProductByIndex[index])}
                      loadingText={ad.existing_product_id ? 'Abrindo...' : 'Criando...'}
                      onClick={() => handleCreateProductFromAd(index)}
                    >
                      {ad.existing_product_id ? 'Editar produto' : 'Criar produto'}
                    </Button>
                    <Button className="h-8 px-3 text-xs" onClick={runGenerate} loading={generating}>
                      Regenerar
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </DataCard>

      <DataCard title="Historico de geracoes">
        {historyLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando historico...</div>
        ) : historyItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Sem historico de anuncios gerados.
          </div>
        ) : (
          <div className="space-y-3">
            {historyItems.map((item) => {
              const ads = item?.output_data_json?.ads || [];
              return (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Geracao #{item.id} <span className="font-normal text-slate-500">({ads.length} anuncios)</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'} | {item.model_used}
                    </p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-700">{ads[0]?.headline || 'Sem preview'}</p>
                </div>
              );
            })}
            <div className="admin-pagination-actions justify-end">
              <Button
                variant="secondary"
                className="h-8 px-3 text-xs"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-600">
                Pagina {historyPage} de {historyTotalPages}
              </span>
              <Button
                variant="secondary"
                className="h-8 px-3 text-xs"
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((current) => Math.min(historyTotalPages, current + 1))}
              >
                Proxima
              </Button>
            </div>
          </div>
        )}
      </DataCard>
    </section>
  );
}

export default AdminAdsPage;

