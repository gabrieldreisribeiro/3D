import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProductGallery from '../components/ProductGallery';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import SectionHeader from '../components/ui/SectionHeader';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import {
  createProductReview,
  fetchProduct,
  fetchProductReviews,
  fetchProductReviewSummary,
  fetchProducts,
  resolveAssetUrl,
  trackEvent,
} from '../services/api';
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

function formatReviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getAvatarTone(name) {
  const tones = [
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
  ];
  const text = String(name || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash += text.charCodeAt(i);
  return tones[hash % tones.length];
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
  const [reviewSort, setReviewSort] = useState('recent');
  const [reviewsSummary, setReviewsSummary] = useState({
    average_rating: 0,
    total_reviews: 0,
    count_5: 0,
    count_4: 0,
    count_3: 0,
    count_2: 0,
    count_1: 0,
  });
  const [reviews, setReviews] = useState([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize] = useState(8);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [reviewSubmitNotice, setReviewSubmitNotice] = useState('');
  const [reviewForm, setReviewForm] = useState({
    author_name: '',
    rating: 0,
    comment: '',
    images: [],
    video: null,
  });
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
        setReviewSort('recent');
        setReviewPage(1);
        setReviewSubmitNotice('');
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));

    fetchProducts().then((items) => setRelated(items.filter((item) => item.slug !== slug).slice(0, 3)));
  }, [slug, navigate]);

  const productData = product || {
    id: 0,
    slug: '',
    title: '',
    short_description: '',
    full_description: '',
    cover_image: '',
    images: [],
    sub_items: [],
    available_colors: [],
    secondary_color_pairs: [],
    allow_colors: false,
    allow_secondary_color: false,
    lead_time_hours: 0,
    final_price: 0,
    price: 0,
    rating_average: 0,
    rating_count: 0,
    reviews: [],
  };

  const galleryImages = sanitizeImageList([
    resolveImageUrl(productData.cover_image),
    ...((productData.images || []).map((image) => resolveImageUrl(image))),
  ]);
  const finalPrice = Number(productData.final_price ?? productData.price ?? 0);
  const hasSubItems = (productData.sub_items || []).length > 0;
  const selectedSubItemsList = (productData.sub_items || [])
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
  const productLeadTimeHours = toNumber(productData.lead_time_hours);
  const productLeadTimeDays = estimateDaysFromHours(productLeadTimeHours);
  const customizedLeadTimeDays = estimateDaysFromHours(productLeadTimeHours + selectedSubItemsLeadTimeHours);
  const shouldScrollSubItems = (productData.sub_items || []).length > 3;
  const productSecondaryOptions = getSecondaryOptions(
    productData.available_colors || [],
    productData.secondary_color_pairs || [],
    selectedColor
  );
  const productSecondarySwatches = getSecondarySwatches(
    productData.available_colors || [],
    productData.secondary_color_pairs || [],
    selectedColor
  );
  const ratingDistribution = useMemo(() => {
    const total = Number(reviewsSummary.total_reviews || 0);
    return [
      { star: 5, count: Number(reviewsSummary.count_5 || 0) },
      { star: 4, count: Number(reviewsSummary.count_4 || 0) },
      { star: 3, count: Number(reviewsSummary.count_3 || 0) },
      { star: 2, count: Number(reviewsSummary.count_2 || 0) },
      { star: 1, count: Number(reviewsSummary.count_1 || 0) },
    ].map((item) => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }, [reviewsSummary]);

  const reviewPhotos = useMemo(
    () =>
      Array.from(
        new Set(
          reviews.flatMap((review) => (review.photos || []).map((photo) => resolveImageUrl(photo)).filter(Boolean))
        )
      ).slice(0, 8),
    [reviews]
  );

  const reviewTotalPages = Math.max(1, Math.ceil(reviewTotal / reviewPageSize));

  const reviewImagePreviews = useMemo(
    () =>
      (reviewForm.images || []).map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [reviewForm.images]
  );

  useEffect(() => () => {
    reviewImagePreviews.forEach((item) => URL.revokeObjectURL(item.url));
  }, [reviewImagePreviews]);

  useEffect(() => {
    if (!productData.id) return;
    trackEvent({
      event_type: 'product_view',
      product_id: productData.id,
      category_id: productData.category_id ?? null,
      metadata_json: {
        slug: productData.slug || slug,
      },
    }).catch(() => {});
  }, [productData.id, productData.slug, slug]);

  useEffect(() => {
    if (!productData.id) return;

    fetchProductReviewSummary(productData.id)
      .then(setReviewsSummary)
      .catch(() =>
        setReviewsSummary({
          average_rating: 0,
          total_reviews: 0,
          count_5: 0,
          count_4: 0,
          count_3: 0,
          count_2: 0,
          count_1: 0,
        })
      );
  }, [productData.id]);

  useEffect(() => {
    if (!productData.id) return;
    setReviewsLoading(true);

    const sort = reviewSort === 'best' ? 'best' : 'recent';
    const withMedia = reviewSort === 'with_photos';
    fetchProductReviews(productData.id, {
      sort,
      with_media: withMedia,
      page: reviewPage,
      page_size: reviewPageSize,
    })
      .then((data) => {
        setReviews(data.items || []);
        setReviewTotal(Number(data.total || 0));
      })
      .catch(() => {
        setReviews([]);
        setReviewTotal(0);
      })
      .finally(() => setReviewsLoading(false));
  }, [productData.id, reviewSort, reviewPage, reviewPageSize]);

  if (loading) {
    return <div className="loading-state-pro container">Carregando produto...</div>;
  }

  if (!product) {
    return <div className="empty-state-pro container">Produto nao encontrado.</div>;
  }

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

  const clearReviewForm = () => {
    setReviewForm({
      author_name: '',
      rating: 0,
      comment: '',
      images: [],
      video: null,
    });
  };

  const handleReviewImagesChange = (files) => {
    const selectedFiles = Array.from(files || []).slice(0, 5);
    setReviewForm((current) => ({ ...current, images: selectedFiles }));
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewFormError('');
    setReviewSubmitNotice('');

    if (!productData.id) return;
    if (!reviewForm.author_name.trim()) {
      setReviewFormError('Informe seu nome.');
      return;
    }
    if (Number(reviewForm.rating || 0) < 1 || Number(reviewForm.rating || 0) > 5) {
      setReviewFormError('Selecione uma nota entre 1 e 5.');
      return;
    }
    if (!reviewForm.comment.trim()) {
      setReviewFormError('Escreva seu comentario.');
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await createProductReview(productData.id, {
        author_name: reviewForm.author_name.trim(),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
        images: reviewForm.images || [],
        video: reviewForm.video || null,
      });
      setReviewModalOpen(false);
      setReviewSubmitNotice(response.message || 'Comentario submetido com sucesso.');
      clearReviewForm();
      fetchProductReviewSummary(productData.id).then(setReviewsSummary).catch(() => {});
      fetchProductReviews(productData.id, {
        sort: reviewSort === 'best' ? 'best' : 'recent',
        with_media: reviewSort === 'with_photos',
        page: 1,
        page_size: reviewPageSize,
      })
        .then((data) => {
          setReviewPage(1);
          setReviews(data.items || []);
          setReviewTotal(Number(data.total || 0));
        })
        .catch(() => {});
    } catch (submitError) {
      setReviewFormError(submitError?.message || 'Nao foi possivel enviar a avaliacao.');
    } finally {
      setReviewSubmitting(false);
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

      <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,0.38fr)_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Avaliacoes de clientes</p>
                <div className="mt-2 flex items-end gap-2">
                  <strong className="text-3xl font-bold tracking-tight text-slate-900">
                    {Number(reviewsSummary.total_reviews || 0) > 0 ? Number(reviewsSummary.average_rating || 0).toFixed(1) : '0.0'}
                  </strong>
                  <span className="pb-1 text-xs text-slate-500">/ 5</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }, (_, index) => (
                    <svg
                      key={`star-${index + 1}`}
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 ${index < Math.round(Number(reviewsSummary.average_rating || 0)) ? 'fill-current' : 'fill-slate-200 text-slate-200'}`}
                      aria-hidden="true"
                    >
                      <path d="M12 17.3l-6.18 3.25 1.18-6.88L2 8.9l6.91-1L12 1.6l3.09 6.3 6.91 1-5 4.77 1.18 6.88z" />
                    </svg>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">{Number(reviewsSummary.total_reviews || 0)} avaliacoes</p>
              </div>
              <Button variant="secondary" className="h-9 px-3 text-xs font-semibold" onClick={() => setReviewModalOpen(true)}>
                Escrever avaliacao
              </Button>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              {ratingDistribution.map((item) => (
                <div key={`distribution-${item.star}`} className="grid grid-cols-[40px_1fr_36px] items-center gap-2">
                  <span className="text-xs text-slate-600">{item.star}★</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <span className="text-right text-xs text-slate-500">{item.count}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReviewSort('recent');
                  setReviewPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  reviewSort === 'recent'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                }`}
              >
                Mais recentes
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewSort('best');
                  setReviewPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  reviewSort === 'best'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                }`}
              >
                Melhores avaliacoes
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewSort('with_photos');
                  setReviewPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  reviewSort === 'with_photos'
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                }`}
              >
                Com fotos
              </button>
            </div>

            {reviewSubmitNotice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {reviewSubmitNotice}
              </div>
            ) : null}

            {reviewPhotos.length ? (
              <div className="flex flex-wrap gap-2">
                {reviewPhotos.map((photo, index) => (
                  <img
                    key={`review-photo-${index}`}
                    src={photo}
                    alt={`Foto de cliente ${index + 1}`}
                    className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                Ainda sem fotos de clientes para este produto.
              </p>
            )}

            <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {reviewsLoading ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">Carregando avaliacoes...</div>
              ) : reviews.length ? (
                reviews.map((review, index) => (
                  <article
                    key={review.id}
                    className={`px-4 py-4 ${index < reviews.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <header className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${getAvatarTone(
                            review.author_name
                          )}`}
                        >
                          {getInitials(review.author_name)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{review.author_name}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {review.status === 'approved' ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                Comprador verificado
                              </span>
                            ) : null}
                            <span className="text-xs text-slate-500">{formatReviewDate(review.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400">
                        {Array.from({ length: 5 }, (_, starIndex) => (
                          <svg
                            key={`${review.id}-star-${starIndex}`}
                            viewBox="0 0 24 24"
                            className={`h-3.5 w-3.5 ${starIndex < review.rating ? 'fill-current' : 'fill-slate-200 text-slate-200'}`}
                            aria-hidden="true"
                          >
                            <path d="M12 17.3l-6.18 3.25 1.18-6.88L2 8.9l6.91-1L12 1.6l3.09 6.3 6.91 1-5 4.77 1.18 6.88z" />
                          </svg>
                        ))}
                      </div>
                    </header>

                    {review.comment ? <p className="mt-3 text-sm leading-relaxed text-slate-700">{review.comment}</p> : null}

                    {(review.photos || []).length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(review.photos || []).slice(0, 4).map((photo, photoIndex) => (
                          <img
                            key={`${review.id}-photo-${photoIndex}`}
                            src={resolveImageUrl(photo)}
                            alt={`Foto enviada por ${review.author_name}`}
                            className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    ) : null}

                    {review.video ? (
                      <div className="mt-3">
                        <video className="max-h-52 w-full rounded-lg border border-slate-200 bg-black" controls preload="metadata">
                          <source src={resolveImageUrl(review.video)} />
                        </video>
                      </div>
                    ) : null}

                    <footer className="mt-3 flex items-center gap-3">
                      <button type="button" className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-700">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 11v9" />
                          <path d="M14 4l-4 7v9h9a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-5" />
                          <path d="M7 20H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
                        </svg>
                        Util
                      </button>
                      <button type="button" className="text-xs text-slate-400 transition hover:text-slate-600">
                        Reportar
                      </button>
                    </footer>
                  </article>
                ))
              ) : (
                <div className="space-y-3 px-4 py-8 text-center text-sm text-slate-500">
                  <p>Ainda nao ha avaliacoes publicadas para este produto.</p>
                  <div>
                    <Button variant="secondary" className="h-9 px-4 text-xs" onClick={() => setReviewModalOpen(true)}>
                      Escrever a primeira avaliacao
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {reviewTotalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">
                  Mostrando pagina <strong>{reviewPage}</strong> de <strong>{reviewTotalPages}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={reviewPage <= 1}
                    onClick={() => setReviewPage((current) => Math.max(1, current - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    disabled={reviewPage >= reviewTotalPages}
                    onClick={() => setReviewPage((current) => Math.min(reviewTotalPages, current + 1))}
                  >
                    Proxima
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <Modal
        open={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setReviewFormError('');
        }}
        title="Escrever avaliacao"
        size="md"
      >
        <form className="space-y-3" onSubmit={handleReviewSubmit}>
          <label className="grid gap-1 text-sm text-slate-700">
            Nome
            <input
              type="text"
              maxLength={120}
              value={reviewForm.author_name}
              onChange={(event) => setReviewForm((current) => ({ ...current, author_name: event.target.value }))}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-300"
              required
            />
          </label>

          <div className="space-y-1">
            <p className="text-sm text-slate-700">Nota</p>
            <div className="flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                return (
                  <button
                    key={`review-rating-${value}`}
                    type="button"
                    onClick={() => setReviewForm((current) => ({ ...current, rating: value }))}
                    className="rounded p-0.5"
                    aria-label={`Selecionar ${value} estrelas`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-6 w-6 ${value <= Number(reviewForm.rating || 0) ? 'fill-current' : 'fill-slate-200 text-slate-200'}`}
                      aria-hidden="true"
                    >
                      <path d="M12 17.3l-6.18 3.25 1.18-6.88L2 8.9l6.91-1L12 1.6l3.09 6.3 6.91 1-5 4.77 1.18 6.88z" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="grid gap-1 text-sm text-slate-700">
            Comentario
            <textarea
              value={reviewForm.comment}
              onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
              className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300"
              required
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            Fotos (ate 5)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => handleReviewImagesChange(event.target.files)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>

          {reviewImagePreviews.length ? (
            <div className="flex flex-wrap gap-2">
              {reviewImagePreviews.map((file, index) => (
                <div key={`preview-image-${index}`} className="space-y-1">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                  />
                  <p className="max-w-16 truncate text-[10px] text-slate-500" title={file.name}>
                    {file.name}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <label className="grid gap-1 text-sm text-slate-700">
            Video (opcional)
            <input
              type="file"
              accept="video/mp4,video/webm"
              onChange={(event) =>
                setReviewForm((current) => ({ ...current, video: event.target.files?.[0] || null }))
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>

          {reviewForm.video ? (
            <p className="text-xs text-slate-500">Video selecionado: {reviewForm.video.name}</p>
          ) : null}

          {reviewFormError ? <p className="text-sm text-rose-600">{reviewFormError}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setReviewModalOpen(false);
                setReviewFormError('');
              }}
            >
              Fechar
            </Button>
            <Button type="submit" loading={reviewSubmitting} loadingText="Enviando...">
              Enviar avaliacao
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

export default ProductPage;

