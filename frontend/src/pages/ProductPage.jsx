import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProductGallery from '../components/ProductGallery';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import PriceBlock from '../components/ui/PriceBlock';
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

function formatSelectedColors(primary, secondary) {
  const colors = [primary, secondary].filter(Boolean);
  if (!colors.length) return null;
  return colors.join(' + ');
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
    if (!canAddCustomized) return;
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
  };

  return (
    <section className="container product-page-pro">
      <div className="product-layout-pro">
        <ProductGallery images={galleryImages} selected={selectedImage} onSelect={setSelectedImage} />

        <div className="product-info-pro">
          <span className="eyebrow">Produto</span>
          <h1>{product.title}</h1>
          <p>{product.short_description}</p>
          <PriceBlock
            price={finalPrice}
            personalized={hasSubItems}
            helper={hasSubItems ? 'Escolha os itens para ver o valor total da composicao' : 'Preco unitario'}
          />

          {hasSubItems ? (
            <div className="detail-card">
              <h3>Monte o seu kit</h3>
              <ul className={`space-y-2 text-sm text-slate-600 ${shouldScrollSubItems ? 'subitems-scroll-wrap' : ''}`}>
                {product.sub_items.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-3">
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
              <p className="mt-3 text-xs text-slate-500">Selecione os itens e ajuste quantidades para montar seu pedido.</p>
              {product.allow_colors && (product.available_colors || []).length > 0 ? (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Cor principal do produto</p>
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
                      <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Furta cor (segunda cor, opcional)</p>
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
              <div className="mt-4 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <strong>Total da composicao: R$ {((finalPrice + selectedSubItemsTotal) * quantity).toFixed(2)}</strong>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Prazo estimado: {customizedLeadTimeDays} dia(s) apos confirmacao do pagamento.
              </p>
              <div className="mt-3 product-buy-actions">
                <QuantitySelector value={quantity} onChange={setQuantity} />
                <Button disabled={!canAddCustomized} onClick={() => addCustomizedToCart(false)}>
                  Adicionar ao carrinho
                </Button>
                <Button variant="secondary" disabled={!canAddCustomized} onClick={() => addCustomizedToCart(true)}>
                  Comprar agora
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {product.allow_colors && (product.available_colors || []).length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Cor do produto</p>
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
                      <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Furta cor (segunda cor, opcional)</p>
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

              <p className="text-xs text-slate-500">
                Prazo estimado: {productLeadTimeDays} dia(s) apos confirmacao do pagamento.
              </p>

              <div className="product-buy-actions">
                <QuantitySelector value={quantity} onChange={setQuantity} />
                <Button
                  onClick={() =>
                    addToCart(product, quantity, {
                      selectedColor: selectedColor || null,
                      selectedSecondaryColor: selectedSecondaryColor || null,
                      selectedSubItems: [],
                    })
                  }
                >
                  Adicionar ao carrinho
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    addToCart(product, quantity, {
                      selectedColor: selectedColor || null,
                      selectedSecondaryColor: selectedSecondaryColor || null,
                      selectedSubItems: [],
                    });
                    navigate('/cart');
                  }}
                >
                  Comprar agora
                </Button>
              </div>
            </div>
          )}

          <div className="detail-card">
            <h3>Descricao completa</h3>
            <p className="whitespace-pre-line leading-8 text-slate-600">{product.full_description}</p>
          </div>
        </div>
      </div>

      <section className="related-products">
        <SectionHeader title="Relacionados" subtitle="Sugestoes para complementar seu pedido" />
        <div className="product-grid-pro">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} onAdd={addToCart} />
          ))}
        </div>
      </section>
    </section>
  );
}

export default ProductPage;
