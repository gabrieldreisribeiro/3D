import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProductGallery from '../components/ProductGallery';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import SectionHeader from '../components/ui/SectionHeader';
import Button from '../components/ui/Button';
import { fetchProduct, fetchProducts, resolveAssetUrl } from '../services/api';
import { useCart } from '../services/cart';

function toNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getSubItemKey(item, index) {
  return String(item.id ?? item.slug ?? item.title ?? `sub-item-${index}`);
}

function getSubItemPrice(item) {
  return toNumber(item.final_price ?? item.price ?? item.manual_price ?? 0);
}

function estimateDaysFromHours(hours) {
  const safeHours = Math.max(0, toNumber(hours));
  if (safeHours <= 0) return 1;
  return Math.max(1, Math.ceil(safeHours / 24));
}

function sanitizeImageList(images = []) {
  return images
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function getSecondaryOptions(availableColors, pairs, selectedPrimary) {
  const colors = (availableColors || []).map((item) => String(item || '').trim()).filter(Boolean);
  const normalizedPairs = Array.isArray(pairs) ? pairs : [];
  if (!normalizedPairs.length) return colors;
  const filtered = normalizedPairs
    .filter((pair) => (selectedPrimary ? pair.primary === selectedPrimary : true))
    .map((pair) => String(pair.secondary || '').trim())
    .filter(Boolean);
  return Array.from(new Set(filtered));
}

function getPrimaryOptions(availableColors, pairs) {
  const primary = (availableColors || []).map((item) => String(item || '').trim()).filter(Boolean);
  const pairColors = (Array.isArray(pairs) ? pairs : [])
    .flatMap((pair) => [String(pair?.primary || '').trim(), String(pair?.secondary || '').trim()])
    .filter(Boolean);
  return Array.from(new Set([...primary, ...pairColors]));
}

function getSecondarySwatches(availableColors, pairs, selectedPrimary) {
  const normalizedPairs = Array.isArray(pairs) ? pairs : [];
  if (normalizedPairs.length) {
    const filteredPairs = normalizedPairs
      .filter((pair) => (selectedPrimary ? pair.primary === selectedPrimary : true))
      .map((pair) => ({
        primary: String(pair.primary || selectedPrimary || '').trim(),
        secondary: String(pair.secondary || '').trim(),
      }))
      .filter((pair) => pair.secondary);

    const uniquePairs = [];
    const seen = new Set();
    filteredPairs.forEach((pair) => {
      const key = `${pair.primary}|${pair.secondary}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePairs.push(pair);
      }
    });
    return uniquePairs;
  }

  const colors = getSecondaryOptions(availableColors, pairs, selectedPrimary);
  return colors.map((secondary) => ({
    primary: String(selectedPrimary || '').trim(),
    secondary,
  }));
}

function ColorSwatchButton({ selected, onClick, primaryColor = '', secondaryColor = '', size = 32, title = '' }) {
  const normalizedPrimary = String(primaryColor || '').trim();
  const normalizedSecondary = String(secondaryColor || '').trim();
  const isSplit = Boolean(normalizedPrimary && normalizedSecondary);
  const backgroundStyle = isSplit
    ? { background: `linear-gradient(90deg, ${normalizedPrimary} 0 50%, ${normalizedSecondary} 50% 100%)` }
    : { backgroundColor: normalizedSecondary || normalizedPrimary || '#ffffff' };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 ${selected ? 'border-violet-600' : 'border-slate-200'}`}
      style={{ width: size, height: size, ...backgroundStyle }}
      title={title || (isSplit ? `${normalizedPrimary} + ${normalizedSecondary}` : normalizedSecondary || normalizedPrimary)}
    />
  );
}

function resolveImageUrl(url) {
  const normalized = String(url || '').trim();
  if (!normalized) return '';
  return resolveAssetUrl(normalized) || normalized;
}

function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedSubItems, setSelectedSubItems] = useState({});
  const [subItemQuantities, setSubItemQuantities] = useState({});
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSecondaryColor, setSelectedSecondaryColor] = useState('');
  const [selectedSubItemColors, setSelectedSubItemColors] = useState({});
  const [selectedSubItemSecondaryColors, setSelectedSubItemSecondaryColors] = useState({});
  const [selectedImage, setSelectedImage] = useState(0);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isBuyingCustom, setIsBuyingCustom] = useState(false);
  const [isAddingSimple, setIsAddingSimple] = useState(false);
  const [isBuyingSimple, setIsBuyingSimple] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('description');
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    setLoading(true);
    fetchProduct(slug)
      .then((item) => {
        setProduct(item);
        setSelectedImage(0);
        setQuantity(1);
        setSelectedSubItems({});
        setSubItemQuantities({});
        setSelectedColor('');
        setSelectedSecondaryColor('');
        setSelectedSubItemColors({});
        setSelectedSubItemSecondaryColors({});
        setActiveDetailTab('description');
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));

    fetchProducts().then((items) => setRelated(items.filter((item) => item.slug !== slug).slice(0, 3)));
  }, [slug, navigate]);

  if (loading) {
    return <div className="loading-state-pro container">Carregando produto...</div>;
  }

  if (!product) {
    return <div className="empty-state-pro container">Produto nao encontrado.</div>;
  }

  const galleryImages = sanitizeImageList([
    resolveImageUrl(product.cover_image),
    ...((product.images || []).map((image) => resolveImageUrl(image))),
  ]);
  const finalPrice = Number(product.final_price ?? product.price ?? 0);
  const hasSubItems = (product.sub_items || []).length > 0;
  const selectedSubItemsList = (product.sub_items || [])
    .map((item, index) => ({ item, index, key: getSubItemKey(item, index) }))
    .filter(({ key }) => selectedSubItems[key])
    .map(({ item, key }) => ({
      ...item,
      key,
      quantity: Math.max(1, Math.floor(toNumber(subItemQuantities[key] || 1))),
      unit_price: getSubItemPrice(item),
    }));
  const selectedSubItemsTotal = selectedSubItemsList.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const selectedSubItemsLeadTimeHours = selectedSubItemsList.reduce(
    (sum, item) => sum + toNumber(item.lead_time_hours) * item.quantity,
    0
  );
  const canAddCustomized = selectedSubItemsList.length > 0;
  const productLeadTimeHours = toNumber(product.lead_time_hours);
  const productLeadTimeDays = estimateDaysFromHours(productLeadTimeHours);
  const customizedLeadTimeDays = estimateDaysFromHours(productLeadTimeHours + selectedSubItemsLeadTimeHours);
  const shouldScrollSubItems = (product.sub_items || []).length > 3;
  const productSecondaryOptions = getSecondaryOptions(
    product.available_colors || [],
    product.secondary_color_pairs || [],
    selectedColor
  );
  const productSecondarySwatches = getSecondarySwatches(
    product.available_colors || [],
    product.secondary_color_pairs || [],
    selectedColor
  );

  const handleToggleSubItem = (key, checked) => {
    setSelectedSubItems((current) => ({ ...current, [key]: checked }));
    if (checked) {
      setSubItemQuantities((current) => ({ ...current, [key]: Math.max(1, Math.floor(toNumber(current[key] || 1))) }));
    }
  };

  const handleSubItemQuantity = (key, value) => {
    const quantityValue = Math.max(1, Math.floor(toNumber(value || 1)));
    setSubItemQuantities((current) => ({ ...current, [key]: quantityValue }));
    setSelectedSubItems((current) => ({ ...current, [key]: true }));
  };

  const handleSubItemColor = (key, color) => {
    setSelectedSubItemColors((current) => ({ ...current, [key]: color }));
  };

  const handleSubItemSecondaryColor = (key, color) => {
    setSelectedSubItemSecondaryColors((current) => ({ ...current, [key]: color }));
  };

  const addCustomizedToCart = (goToCart = false) => {
    if (!canAddCustomized) return false;
    addToCart(product, quantity, {
      selectedSubItems: selectedSubItemsList.map((item) => ({
        id: item.id ?? null,
        slug: item.slug ?? null,
        title: item.title,
        image_url: item.image_url || '',
        unit_price: item.unit_price,
        quantity: item.quantity,
        lead_time_hours: toNumber(item.lead_time_hours),
        selected_color: selectedSubItemColors[item.key] || null,
        selected_secondary_color: selectedSubItemSecondaryColors[item.key] || null,
      })),
      selectedColor: selectedColor || null,
      selectedSecondaryColor: selectedSecondaryColor || null,
    });
    if (goToCart) navigate('/cart');
    return true;
  };

  const runAddAction = async (setLoadingState, action) => {
    if (loading) return;
    const startAt = Date.now();
    setLoadingState(true);
    try {
      await Promise.resolve(action());
    } finally {
      const elapsed = Date.now() - startAt;
      const delay = Math.max(0, 380 - elapsed);
      window.setTimeout(() => setLoadingState(false), delay);
    }
  };

  const highlightItems = [
    {
      id: 'custom',
      title: hasSubItems ? 'Configuracao personalizada' : 'Produto pronto para uso',
      description: hasSubItems
        ? 'Combine subitens e monte o kit conforme sua necessidade.'
        : 'Design funcional com acabamento premium em impressao 3D.',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20l8-4V8l-8-4-8 4v8l8 4z" />
          <path d="M12 12l8-4M12 12L4 8M12 12v8" />
        </svg>
      ),
    },
    {
      id: 'delivery',
      title: 'Prazo estimado',
      description: `${hasSubItems ? customizedLeadTimeDays : productLeadTimeDays} dia(s) apos confirmacao do pagamento.`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      ),
    },
    {
      id: 'shipping',
      title: 'Compra segura',
      description: 'Checkout direto e suporte para acompanhar todo o pedido.',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l8 4v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V7l8-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-4 sm:px-6 lg:gap-10 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <ProductGallery images={galleryImages} selected={selectedImage} onSelect={setSelectedImage} />

        <aside className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Produto
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[30px]">{product.title}</h1>
          <p className="text-sm leading-7 text-slate-600">{product.short_description}</p>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Preco</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              {hasSubItems ? `A partir de R$ ${finalPrice.toFixed(2)}` : `R$ ${finalPrice.toFixed(2)}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {hasSubItems ? 'Selecione os itens para calcular o total final.' : 'Valor unitario'}
            </p>
          </div>

          {hasSubItems ? (
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-900">Monte o seu kit</h3>
              <ul className={`space-y-2 text-sm text-slate-600 ${shouldScrollSubItems ? 'subitems-scroll-wrap' : ''}`}>
                {product.sub_items.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {item.image_url ? (
                          <div className="subitem-image-zoom-wrap">
                            <img src={resolveImageUrl(item.image_url)} alt={item.title} className="subitem-image-zoom" />
                            <div className="subitem-image-zoom-pop" aria-hidden="true">
                              <img src={resolveImageUrl(item.image_url)} alt={item.title} className="subitem-image-zoom-pop-img" />
                            </div>
                          </div>
                        ) : null}
                        <span>{item.title}</span>
                      </div>
                      <strong>R$ {getSubItemPrice(item).toFixed(2)}</strong>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedSubItems[getSubItemKey(item, index)])}
                          onChange={(event) => handleToggleSubItem(getSubItemKey(item, index), event.target.checked)}
                        />
                        Selecionar item
                      </label>
                      <div className={`${selectedSubItems[getSubItemKey(item, index)] ? '' : 'pointer-events-none opacity-60'}`}>
                        <QuantitySelector
                          value={Math.max(1, Math.floor(toNumber(subItemQuantities[getSubItemKey(item, index)] || 1)))}
                          onChange={(value) => handleSubItemQuantity(getSubItemKey(item, index), value)}
                        />
                      </div>
                      <small className="text-xs text-slate-500">
                        Prazo: {estimateDaysFromHours(item.lead_time_hours)} dia(s) apos pagamento
                      </small>
                      {item.allow_colors && (item.available_colors || []).length > 0 ? (
                        <div className="w-full space-y-2 rounded-[10px] border border-slate-200 bg-white p-2">
                          <p className="text-xs font-semibold text-slate-500">Cor principal</p>
                          <div className="flex flex-wrap gap-2">
                            {getPrimaryOptions(item.available_colors || [], item.secondary_color_pairs || []).map((color) => (
                              <ColorSwatchButton
                                key={`${getSubItemKey(item, index)}-primary-${color}`}
                                onClick={() => handleSubItemColor(getSubItemKey(item, index), color)}
                                selected={selectedSubItemColors[getSubItemKey(item, index)] === color}
                                secondaryColor={color}
                                size={28}
                                title={color}
                              />
                            ))}
                          </div>
                          {item.allow_secondary_color ? (
                            <>
                              <p className="text-xs font-semibold text-slate-500">Furta cor (segunda cor, opcional)</p>
                              <div className="flex flex-wrap gap-2">
                                {getSecondarySwatches(
                                  item.available_colors || [],
                                  item.secondary_color_pairs || [],
                                  selectedSubItemColors[getSubItemKey(item, index)]
                                ).map((pair) => (
                                  <ColorSwatchButton
                                    key={`${getSubItemKey(item, index)}-secondary-${pair.primary}-${pair.secondary}`}
                                    onClick={() => handleSubItemSecondaryColor(getSubItemKey(item, index), pair.secondary)}
                                    selected={selectedSubItemSecondaryColors[getSubItemKey(item, index)] === pair.secondary}
                                    primaryColor={pair.primary || selectedSubItemColors[getSubItemKey(item, index)]}
                                    secondaryColor={pair.secondary}
                                    size={28}
                                    title={`${pair.primary || selectedSubItemColors[getSubItemKey(item, index)] || '-'} + ${pair.secondary}`}
                                  />
                                ))}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-slate-500">Selecione os itens e ajuste quantidades para montar seu pedido.</p>
              {product.allow_colors && (product.available_colors || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cor principal do produto</p>
                  <div className="flex flex-wrap gap-2">
                    {getPrimaryOptions(product.available_colors || [], product.secondary_color_pairs || []).map((color) => (
                      <ColorSwatchButton
                        key={`product-primary-${color}`}
                        onClick={() => setSelectedColor(color)}
                        selected={selectedColor === color}
                        secondaryColor={color}
                        size={32}
                        title={color}
                      />
                    ))}
                  </div>
                  {product.allow_secondary_color ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Furta cor (segunda cor, opcional)</p>
                      <div className="flex flex-wrap gap-2">
                        {productSecondarySwatches.map((pair) => (
                          <ColorSwatchButton
                            key={`product-secondary-${pair.primary}-${pair.secondary}`}
                            onClick={() => setSelectedSecondaryColor(pair.secondary)}
                            selected={selectedSecondaryColor === pair.secondary}
                            primaryColor={pair.primary || selectedColor}
                            secondaryColor={pair.secondary}
                            size={32}
                            title={`${pair.primary || selectedColor || '-'} + ${pair.secondary}`}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <strong>Total da composicao: R$ {((finalPrice + selectedSubItemsTotal) * quantity).toFixed(2)}</strong>
              </div>
              <p className="text-xs text-slate-500">
                Prazo estimado: {customizedLeadTimeDays} dia(s) apos confirmacao do pagamento.
              </p>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <QuantitySelector value={quantity} onChange={setQuantity} />
                  <Button
                    className="h-11 flex-1"
                    disabled={!canAddCustomized}
                    loading={isAddingCustom}
                    loadingText="Adicionando..."
                    onClick={() => runAddAction(setIsAddingCustom, () => addCustomizedToCart(false))}
                  >
                    Adicionar ao carrinho
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  disabled={!canAddCustomized}
                  loading={isBuyingCustom}
                  loadingText="Adicionando..."
                  onClick={() => runAddAction(setIsBuyingCustom, () => addCustomizedToCart(true))}
                >
                  Comprar agora
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {product.allow_colors && (product.available_colors || []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cor do produto</p>
                  <select
                    className="h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    value={selectedColor}
                    onChange={(event) => setSelectedColor(event.target.value)}
                  >
                    <option value="">Selecione uma cor</option>
                    {(product.available_colors || []).map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  {product.allow_secondary_color ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Furta cor (segunda cor, opcional)</p>
                      <select
                        className="h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                        value={selectedSecondaryColor}
                        onChange={(event) => setSelectedSecondaryColor(event.target.value)}
                      >
                        <option value="">Selecione uma furta cor</option>
                        {productSecondaryOptions.map((color) => (
                          <option key={`secondary-${color}`} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : null}
                </div>
              ) : null}

              <p className="text-xs text-slate-500">Prazo estimado: {productLeadTimeDays} dia(s) apos confirmacao do pagamento.</p>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <QuantitySelector value={quantity} onChange={setQuantity} />
                  <Button
                    className="h-11 flex-1"
                    loading={isAddingSimple}
                    loadingText="Adicionando..."
                    onClick={() =>
                      runAddAction(setIsAddingSimple, () =>
                        addToCart(product, quantity, {
                          selectedColor: selectedColor || null,
                          selectedSecondaryColor: selectedSecondaryColor || null,
                          selectedSubItems: [],
                        })
                      )
                    }
                  >
                    Adicionar ao carrinho
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  loading={isBuyingSimple}
                  loadingText="Adicionando..."
                  onClick={() => {
                    runAddAction(setIsBuyingSimple, () => {
                      addToCart(product, quantity, {
                        selectedColor: selectedColor || null,
                        selectedSecondaryColor: selectedSecondaryColor || null,
                        selectedSubItems: [],
                      });
                      navigate('/cart');
                    });
                  }}
                >
                  Comprar agora
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveDetailTab('description')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeDetailTab === 'description'
                ? 'border-violet-500 bg-violet-50 text-violet-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
            }`}
          >
            Descricao
          </button>
          <button
            type="button"
            onClick={() => setActiveDetailTab('highlights')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeDetailTab === 'highlights'
                ? 'border-violet-500 bg-violet-50 text-violet-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
            }`}
          >
            Destaques
          </button>
        </div>

        {activeDetailTab === 'description' ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-8 text-slate-600">{product.full_description}</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {highlightItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                  {item.icon}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-xs leading-6 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Relacionados" subtitle="Sugestoes para complementar seu pedido" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} onAdd={addToCart} compact />
          ))}
        </div>
      </section>
    </section>
  );
}

export default ProductPage;
