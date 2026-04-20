import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import DataCard from '../components/ui/DataCard';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import Table from '../components/ui/Table';
import TextArea from '../components/ui/TextArea';
import usePersistentState from '../hooks/usePersistentState';
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminInstagramSettings,
  fetchAdminProducts,
  fetchAdminCategories,
  publishAdminProductInstagram,
  setAdminProductStatus,
  updateAdminProduct,
  uploadAdminProductImage,
} from '../services/api';

const defaultPricingFields = {
  grams_filament: '0',
  price_kg_filament: '150',
  hours_printing: '0',
  avg_power_watts: '110',
  price_kwh: '0',
  total_hours_labor: '0',
  price_hour_labor: '0',
  extra_cost: '0',
  profit_margin: '40',
};

const createEmptySubItem = () => ({
  title: '',
  image_url: '',
  pricing_mode: 'manual',
  manual_price: '',
  lead_time_hours: '0',
  allow_colors: false,
  available_colors: [],
  allow_secondary_color: false,
  secondary_color_pairs: [],
  ...defaultPricingFields,
});

const createEmptyPairDraft = () => ({
  primary: '#FFFFFF',
  secondary: '#000000',
});

const initialForm = {
  title: '',
  slug: '',
  short_description: '',
  full_description: '',
  cover_image: '',
  images: '',
  is_active: true,
  category_id: '',
  pricing_mode: 'calculated',
  manual_price: '',
  lead_time_hours: '0',
  allow_colors: false,
  available_colors: [],
  allow_secondary_color: false,
  secondary_color_pairs: [],
  allow_name_personalization: false,
  publish_to_instagram: false,
  instagram_caption: '',
  instagram_hashtags: '',
  sub_items: [],
  ...defaultPricingFields,
};

function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseColors(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function parseImageLinks(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHexColor(value) {
  const color = String(value || '').trim().toUpperCase();
  if (!color) return '';
  if (/^#[0-9A-F]{6}$/.test(color)) return color;
  return '';
}

function normalizeSecondaryPair(pair) {
  const primary = normalizeHexColor(pair?.primary);
  const secondary = normalizeHexColor(pair?.secondary);
  if (!primary || !secondary) return null;
  return { primary, secondary };
}

function parseSecondaryPairs(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const pairs = [];
  value.forEach((item) => {
    const normalized = normalizeSecondaryPair(item);
    if (!normalized) return;
    const key = `${normalized.primary}|${normalized.secondary}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push(normalized);
  });
  return pairs;
}

function mapSubItemToPayload(item) {
  const pricingMode = item.pricing_mode || 'manual';
  const payload = {
    title: String(item.title || '').trim(),
    image_url: String(item.image_url || '').trim() || null,
    pricing_mode: pricingMode,
    lead_time_hours: toNumber(item.lead_time_hours),
    allow_colors: Boolean(item.allow_colors),
    available_colors: item.allow_colors ? parseColors(item.available_colors) : [],
    allow_secondary_color: Boolean(item.allow_secondary_color) && Boolean(item.allow_colors),
    secondary_color_pairs: item.allow_colors && item.allow_secondary_color ? parseSecondaryPairs(item.secondary_color_pairs) : [],
    manual_price: pricingMode === 'manual' ? toNumber(item.manual_price) : null,
    grams_filament: pricingMode === 'calculated' ? toNumber(item.grams_filament) : 0,
    price_kg_filament: pricingMode === 'calculated' ? toNumber(item.price_kg_filament) : 0,
    hours_printing: pricingMode === 'calculated' ? toNumber(item.hours_printing) : 0,
    avg_power_watts: pricingMode === 'calculated' ? toNumber(item.avg_power_watts) : 0,
    price_kwh: pricingMode === 'calculated' ? toNumber(item.price_kwh) : 0,
    total_hours_labor: pricingMode === 'calculated' ? toNumber(item.total_hours_labor) : 0,
    price_hour_labor: pricingMode === 'calculated' ? toNumber(item.price_hour_labor) : 0,
    extra_cost: pricingMode === 'calculated' ? toNumber(item.extra_cost) : 0,
    profit_margin: pricingMode === 'calculated' ? toNumber(item.profit_margin) : 0,
  };

  if (!payload.title) {
    throw new Error('Todos os sub itens precisam de titulo.');
  }

  return payload;
}

function toPayload(form) {
  const pricingMode = form.pricing_mode || 'calculated';
  const hasSubItems = (form.sub_items || []).length > 0;
  const shouldUseProductPricing = !hasSubItems;

  return {
    title: form.title.trim(),
    slug: form.slug.trim().toLowerCase(),
    short_description: form.short_description.trim(),
    full_description: form.full_description.trim(),
    cover_image: form.cover_image.trim(),
    images: form.images
      ? parseImageLinks(form.images)
      : [],
    sub_items: (form.sub_items || []).map(mapSubItemToPayload),
    is_active: form.is_active,
    category_id: form.category_id === '' ? null : Number(form.category_id),
    lead_time_hours: toNumber(form.lead_time_hours),
    allow_colors: Boolean(form.allow_colors),
    available_colors: form.allow_colors ? parseColors(form.available_colors) : [],
    allow_secondary_color: Boolean(form.allow_colors) && Boolean(form.allow_secondary_color),
    secondary_color_pairs: form.allow_colors && form.allow_secondary_color ? parseSecondaryPairs(form.secondary_color_pairs) : [],
    allow_name_personalization: Boolean(form.allow_name_personalization),
    publish_to_instagram: Boolean(form.publish_to_instagram),
    instagram_caption: String(form.instagram_caption || '').trim() || null,
    instagram_hashtags: String(form.instagram_hashtags || '').trim() || null,
    manual_price: shouldUseProductPricing && pricingMode === 'manual' ? toNumber(form.manual_price) : null,
    grams_filament: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.grams_filament) : 0,
    price_kg_filament: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.price_kg_filament) : 0,
    hours_printing: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.hours_printing) : 0,
    avg_power_watts: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.avg_power_watts) : 0,
    price_kwh: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.price_kwh) : 0,
    total_hours_labor: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.total_hours_labor) : 0,
    price_hour_labor: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.price_hour_labor) : 0,
    extra_cost: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.extra_cost) : 0,
    profit_margin: shouldUseProductPricing && pricingMode === 'calculated' ? toNumber(form.profit_margin) : 0,
  };
}

function allPricingFieldsZero(item) {
  return [
    item.grams_filament,
    item.price_kg_filament,
    item.hours_printing,
    item.avg_power_watts,
    item.price_kwh,
    item.total_hours_labor,
    item.price_hour_labor,
    item.extra_cost,
    item.profit_margin,
  ].every((value) => Number(value || 0) === 0);
}

function fromProduct(product) {
  const pricingMode = Number(product.manual_price || 0) > 0 && allPricingFieldsZero(product) ? 'manual' : 'calculated';

  const subItems = (product.sub_items || []).map((item) => {
    const subPricingMode = item.pricing_mode || (Number(item.manual_price || 0) > 0 && allPricingFieldsZero(item) ? 'manual' : 'calculated');
    return {
      title: item.title || item.name || '',
      image_url: item.image_url || '',
      pricing_mode: subPricingMode,
      lead_time_hours: String(item.lead_time_hours ?? 0),
      allow_colors: Boolean(item.allow_colors),
      available_colors: Array.isArray(item.available_colors) ? item.available_colors : [],
      allow_secondary_color: Boolean(item.allow_secondary_color),
      secondary_color_pairs: parseSecondaryPairs(item.secondary_color_pairs || []),
      manual_price: item.manual_price == null ? String(item.final_price ?? item.price ?? '') : String(item.manual_price),
      grams_filament: String(item.grams_filament ?? 0),
      price_kg_filament: String(item.price_kg_filament ?? 0),
      hours_printing: String(item.hours_printing ?? 0),
      avg_power_watts: String(item.avg_power_watts ?? 0),
      price_kwh: String(item.price_kwh ?? 0),
      total_hours_labor: String(item.total_hours_labor ?? 0),
      price_hour_labor: String(item.price_hour_labor ?? 0),
      extra_cost: String(item.extra_cost ?? 0),
      profit_margin: String(item.profit_margin ?? 0),
    };
  });

  return {
    title: product.title,
    slug: product.slug,
    short_description: product.short_description,
    full_description: product.full_description,
    cover_image: product.cover_image,
    images: (product.images || []).filter(Boolean).join(', '),
    sub_items: subItems,
    is_active: product.is_active,
    category_id: product.category_id == null ? '' : String(product.category_id),
    pricing_mode: pricingMode,
    manual_price: product.manual_price == null ? '' : String(product.manual_price),
    lead_time_hours: String(product.lead_time_hours ?? 0),
    allow_colors: Boolean(product.allow_colors),
    available_colors: Array.isArray(product.available_colors) ? product.available_colors : [],
    allow_secondary_color: Boolean(product.allow_secondary_color),
    secondary_color_pairs: parseSecondaryPairs(product.secondary_color_pairs || []),
    allow_name_personalization: Boolean(product.allow_name_personalization),
    publish_to_instagram: Boolean(product.publish_to_instagram),
    instagram_caption: product.instagram_caption || '',
    instagram_hashtags: product.instagram_hashtags || '',
    grams_filament: String(product.grams_filament ?? 0),
    price_kg_filament: String(product.price_kg_filament ?? 0),
    hours_printing: String(product.hours_printing ?? 0),
    avg_power_watts: String(product.avg_power_watts ?? 0),
    price_kwh: String(product.price_kwh ?? 0),
    total_hours_labor: String(product.total_hours_labor ?? 0),
    price_hour_labor: String(product.price_hour_labor ?? 0),
    extra_cost: String(product.extra_cost ?? 0),
    profit_margin: String(product.profit_margin ?? 0),
  };
}

function ColorPickerField({ label, value, onChange }) {
  const normalizedValue = normalizeHexColor(value) || '#FFFFFF';
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-2 py-2">
        <input
          type="color"
          value={normalizedValue}
          onChange={(event) => onChange(normalizeHexColor(event.target.value))}
          className="h-10 w-12 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
        />
        <code className="text-xs text-slate-700">{normalizedValue}</code>
      </div>
    </div>
  );
}

function getInstagramStatusTone(status) {
  if (status === 'published') return 'success';
  if (status === 'pending') return 'info';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function getInstagramStatusLabel(status) {
  if (status === 'published') return 'Publicado';
  if (status === 'pending') return 'Pendente';
  if (status === 'error') return 'Erro';
  return 'Nao publicado';
}

function ProductFormSection({ title, subtitle = null, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-4 border-b border-slate-100 pb-3">
        <h4 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h4>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function AdminProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingExtraImages, setUploadingExtraImages] = useState(false);
  const [uploadingSubItems, setUploadingSubItems] = useState({});
/*  */  const [form, setForm] = usePersistentState('modal:admin-products:form', initialForm);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = usePersistentState('modal:admin-products:open', false);
  const [editingId, setEditingId] = usePersistentState('modal:admin-products:editing-id', null);
  const [confirmTarget, setConfirmTarget] = usePersistentState('modal:admin-products:confirm-target', null);
  const [selectedProduct, setSelectedProduct] = usePersistentState('modal:admin-products:selected', null);
  const [modalMode, setModalMode] = usePersistentState('modal:admin-products:mode', 'create');
  const [collapsedSubItems, setCollapsedSubItems] = useState({});
  const [productPairDraft, setProductPairDraft] = useState(createEmptyPairDraft());
  const [subItemPairDrafts, setSubItemPairDrafts] = useState({});
  const [deleteTarget, setDeleteTarget] = usePersistentState('modal:admin-products:delete-target', null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [instagramAutoPublishDefault, setInstagramAutoPublishDefault] = useState(false);
  const [publishingInstagramById, setPublishingInstagramById] = useState({});
  const [autoOpenedEditId, setAutoOpenedEditId] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const actionMenuRef = useRef(null);

  const loadProducts = () => {
    setLoading(true);
    fetchAdminProducts()
      .then(setProducts)
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar produtos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
    fetchAdminCategories().then(setCategories);
    fetchAdminInstagramSettings()
      .then((settings) => setInstagramAutoPublishDefault(Boolean(settings?.instagram_auto_publish_default)))
      .catch(() => setInstagramAutoPublishDefault(false));
  }, []);

  useEffect(() => {
    setForm((current) => ({
      ...initialForm,
      ...current,
      publish_to_instagram:
        typeof current?.publish_to_instagram === 'boolean' ? current.publish_to_instagram : instagramAutoPublishDefault,
      instagram_caption: current?.instagram_caption ?? '',
      instagram_hashtags: current?.instagram_hashtags ?? '',
    }));
  }, [instagramAutoPublishDefault, setForm]);

  useEffect(() => {
    const editParam = Number(searchParams.get('edit') || 0);
    if (!editParam || !products.length || autoOpenedEditId === editParam) return;
    const product = products.find((item) => Number(item.id) === editParam);
    if (!product) return;
    openEdit(product);
    setAutoOpenedEditId(editParam);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('edit');
    nextParams.delete('source');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, products, autoOpenedEditId]);

  useEffect(() => {
    if (openActionMenuId == null) return undefined;

    const handleClickOutside = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) {
        setOpenActionMenuId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenActionMenuId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [openActionMenuId]);

  const openCreate = () => {
    const shouldResetForm = editingId !== null || modalMode !== 'create';
    setEditingId(null);
    if (shouldResetForm) {
      setForm({
        ...initialForm,
        publish_to_instagram: instagramAutoPublishDefault,
      });
    }
    setError('');
    setSelectedProduct(null);
    setCollapsedSubItems({});
    setProductPairDraft(createEmptyPairDraft());
    setSubItemPairDrafts({});
    setModalMode('create');
    setOpenActionMenuId(null);
    setIsModalOpen(true);
  };

  const openEdit = (product) => {
    const sameEditingTarget = editingId === product.id && modalMode === 'edit';
    setEditingId(product.id);
    if (!sameEditingTarget) {
      setForm(fromProduct(product));
      const nextCollapsed = {};
      (product.sub_items || []).forEach((_, index) => {
        nextCollapsed[index] = index > 0;
      });
      setCollapsedSubItems(nextCollapsed);
      setProductPairDraft(createEmptyPairDraft());
      const pairDrafts = {};
      (product.sub_items || []).forEach((_, index) => {
        pairDrafts[index] = createEmptyPairDraft();
      });
      setSubItemPairDrafts(pairDrafts);
    }
    setError('');
    setSelectedProduct(product);
    setModalMode('edit');
    setOpenActionMenuId(null);
    setIsModalOpen(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateAdminProduct(editingId, payload);
      } else {
        await createAdminProduct(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setSelectedProduct(null);
      setModalMode('create');
      setForm({
        ...initialForm,
        publish_to_instagram: instagramAutoPublishDefault,
      });
      loadProducts();
    } catch (submitError) {
      setError(submitError.message || 'Falha ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleStatus = async () => {
    if (!confirmTarget) return;
    try {
      await setAdminProductStatus(confirmTarget.id, !confirmTarget.is_active);
      setConfirmTarget(null);
      loadProducts();
    } catch (toggleError) {
      setError(toggleError.message || 'Falha ao atualizar status.');
    }
  };


  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAdminProduct(deleteTarget.id);
      setDeleteTarget(null);
      loadProducts();
    } catch (deleteError) {
      setError(deleteError.message || 'Falha ao excluir produto.');
    }
  };

  const publishOnInstagram = async (productId) => {
    setPublishingInstagramById((current) => ({ ...current, [productId]: true }));
    setError('');
    try {
      await publishAdminProductInstagram(productId);
      loadProducts();
    } catch (publishError) {
      setError(publishError.message || 'Falha ao publicar no Instagram.');
    } finally {
      setPublishingInstagramById((current) => ({ ...current, [productId]: false }));
    }
  };

  const filteredProducts = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query
        || String(product.title || '').toLowerCase().includes(query)
        || String(product.slug || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? Boolean(product.is_active) : !product.is_active);
      const matchesCategory = categoryFilter === 'all'
        || String(product.category_id || '') === categoryFilter
        || (categoryFilter === 'none' && !product.category_id);
      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [products, searchTerm, statusFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const categoryOptions = [{ value: '', label: 'Sem categoria' }, ...categories.map((category) => ({ value: String(category.id), label: category.name }))];

  const updateSubItem = (index, field, value) => {
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addProductColor = (color) => {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    setForm((current) => {
      const currentColors = parseColors(current.available_colors);
      if (currentColors.includes(normalized)) return current;
      return { ...current, available_colors: [...currentColors, normalized] };
    });
  };

  const removeProductColor = (color) => {
    setForm((current) => ({
      ...current,
      available_colors: parseColors(current.available_colors).filter((item) => item !== color),
    }));
  };

  const addSubItemColor = (index, color) => {
    const normalized = normalizeHexColor(color);
    if (!normalized) return;
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const currentColors = parseColors(item.available_colors);
        if (currentColors.includes(normalized)) return item;
        return { ...item, available_colors: [...currentColors, normalized] };
      }),
    }));
  };

  const removeSubItemColor = (index, color) => {
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, available_colors: parseColors(item.available_colors).filter((it) => it !== color) } : item
      ),
    }));
  };

  const addSubItem = () => {
    const nextIndex = (form.sub_items || []).length;
    setForm((current) => ({ ...current, sub_items: [...(current.sub_items || []), createEmptySubItem()] }));
    setCollapsedSubItems((current) => ({
      ...current,
      [nextIndex]: false,
    }));
    setSubItemPairDrafts((current) => ({ ...current, [nextIndex]: createEmptyPairDraft() }));
  };

  const removeSubItem = (index) => {
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setCollapsedSubItems((current) => {
      const next = {};
      Object.keys(current).forEach((key) => {
        const itemIndex = Number(key);
        if (itemIndex < index) next[itemIndex] = current[itemIndex];
        if (itemIndex > index) next[itemIndex - 1] = current[itemIndex];
      });
      return next;
    });
    setSubItemPairDrafts((current) => {
      const next = {};
      Object.keys(current).forEach((key) => {
        const itemIndex = Number(key);
        if (itemIndex < index) next[itemIndex] = current[itemIndex];
        if (itemIndex > index) next[itemIndex - 1] = current[itemIndex];
      });
      return next;
    });
  };

  const addProductSecondaryPair = () => {
    const normalized = normalizeSecondaryPair(productPairDraft);
    if (!normalized) return;
    setForm((current) => {
      const currentPairs = parseSecondaryPairs(current.secondary_color_pairs);
      const exists = currentPairs.some((item) => item.primary === normalized.primary && item.secondary === normalized.secondary);
      if (exists) return current;
      return { ...current, secondary_color_pairs: [...currentPairs, normalized] };
    });
    setProductPairDraft(createEmptyPairDraft());
  };

  const removeProductSecondaryPair = (pair) => {
    setForm((current) => ({
      ...current,
      secondary_color_pairs: parseSecondaryPairs(current.secondary_color_pairs).filter(
        (item) => !(item.primary === pair.primary && item.secondary === pair.secondary)
      ),
    }));
  };

  const addSubItemSecondaryPair = (index) => {
    const draft = subItemPairDrafts[index] || createEmptyPairDraft();
    const normalized = normalizeSecondaryPair(draft);
    if (!normalized) return;
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const currentPairs = parseSecondaryPairs(item.secondary_color_pairs);
        const exists = currentPairs.some((pair) => pair.primary === normalized.primary && pair.secondary === normalized.secondary);
        if (exists) return item;
        return { ...item, secondary_color_pairs: [...currentPairs, normalized] };
      }),
    }));
    setSubItemPairDrafts((current) => ({ ...current, [index]: createEmptyPairDraft() }));
  };

  const removeSubItemSecondaryPair = (index, pair) => {
    setForm((current) => ({
      ...current,
      sub_items: current.sub_items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              secondary_color_pairs: parseSecondaryPairs(item.secondary_color_pairs).filter(
                (currentPair) => !(currentPair.primary === pair.primary && currentPair.secondary === pair.secondary)
              ),
            }
          : item
      ),
    }));
  };

  const handleUploadError = (uploadError) => {
    setError(uploadError.message || 'Falha ao enviar imagem.');
  };

  const uploadCoverFile = async (file) => {
    if (!file) return;
    setUploadingCover(true);
    setError('');
    try {
      const response = await uploadAdminProductImage(file);
      setForm((current) => ({ ...current, cover_image: response.url || '' }));
    } catch (uploadError) {
      handleUploadError(uploadError);
    } finally {
      setUploadingCover(false);
    }
  };

  const appendExtraImageUrl = (url) => {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) return;
    setForm((current) => {
      const currentLinks = parseImageLinks(current.images);
      if (currentLinks.includes(normalizedUrl)) return current;
      return {
        ...current,
        images: [...currentLinks, normalizedUrl].join('\n'),
      };
    });
  };

  const uploadExtraImageFile = async (file) => {
    if (!file) return;
    setError('');
    const response = await uploadAdminProductImage(file);
    appendExtraImageUrl(response.url || '');
  };

  const uploadExtraImageFiles = async (files) => {
    const validFiles = Array.from(files || []).filter(Boolean);
    if (!validFiles.length) return;
    setUploadingExtraImages(true);
    try {
      for (const file of validFiles) {
        await uploadExtraImageFile(file);
      }
    } catch (uploadError) {
      handleUploadError(uploadError);
    } finally {
      setUploadingExtraImages(false);
    }
  };

  const uploadSubItemFile = async (index, file) => {
    if (!file) return;
    setUploadingSubItems((current) => ({ ...current, [index]: true }));
    setError('');
    try {
      const response = await uploadAdminProductImage(file);
      updateSubItem(index, 'image_url', response.url || '');
    } catch (uploadError) {
      handleUploadError(uploadError);
    } finally {
      setUploadingSubItems((current) => ({ ...current, [index]: false }));
    }
  };

  const readClipboardImage = (event) => {
    const items = event.clipboardData?.items || [];
    for (const item of items) {
      if (item.type?.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
    return null;
  };

  const handleCoverPaste = async (event) => {
    const file = readClipboardImage(event);
    if (!file) return;
    event.preventDefault();
    await uploadCoverFile(file);
  };

  const handleSubItemPaste = async (index, event) => {
    const file = readClipboardImage(event);
    if (!file) return;
    event.preventDefault();
    await uploadSubItemFile(index, file);
  };

  const handleExtraImagesPaste = async (event) => {
    const file = readClipboardImage(event);
    if (!file) return;
    event.preventDefault();
    await uploadExtraImageFiles([file]);
  };

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Catalogo"
        title="Produtos"
        subtitle="Cadastre, edite e publique produtos com agilidade"
        action={<Button onClick={openCreate}>Novo produto</Button>}
      />

      <DataCard title="Lista de produtos">
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Carregando produtos...</div> : null}
        {!loading ? (
          <>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="admin-filter-bar">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por titulo ou slug"
                className="h-10 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              >
                <option value="all">Todos status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              >
                <option value="all">Todas categorias</option>
                <option value="none">Sem categoria</option>
                {categories.map((category) => (
                  <option key={`filter-category-${category.id}`} value={String(category.id)}>{category.name}</option>
                ))}
              </select>
              <select
                value={itemsPerPage}
                onChange={(event) => setItemsPerPage(Number(event.target.value))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              >
                <option value={10}>10 / pagina</option>
                <option value={20}>20 / pagina</option>
                <option value={50}>50 / pagina</option>
              </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-500">
                  {filteredProducts.length} produto(s) encontrado(s)
                </p>
                <Button variant="secondary" className="h-9 px-3 text-xs" onClick={openCreate}>
                  Novo produto
                </Button>
              </div>
            </div>

            <Table
              columns={['Produto', 'Categoria', 'Preco final', 'Custo', 'Lucro', 'Status', 'Instagram', 'Acoes']}
              rows={paginatedProducts}
              empty={<EmptyState title="Sem produtos" description="Comece criando o primeiro produto." />}
              renderRow={(product) => (
                <tr key={product.id}>
                  <td>
                    <div className="flex flex-col">
                      <strong className="font-semibold text-slate-900">{product.title}</strong>
                      <small className="text-xs text-slate-500">{product.slug}</small>
                      {product.is_draft ? <small className="text-[11px] font-medium text-amber-600">Rascunho</small> : null}
                      {product.generated_by_ai ? <small className="text-[11px] font-medium text-violet-600">Origem IA</small> : null}
                    </div>
                  </td>
                  <td>
                    {categories.find((category) => category.id === product.category_id)?.name || 'Sem categoria'}
                  </td>
                  <td>
                    {(product.sub_items || []).length > 0
                      ? 'Personalizado'
                      : `R$ ${(product.final_price ?? product.price ?? 0).toFixed(2)}`}
                  </td>
                  <td>R$ {(product.cost_total ?? 0).toFixed(2)}</td>
                  <td>R$ {(product.estimated_profit ?? 0).toFixed(2)}</td>
                  <td>
                    <StatusBadge tone={product.is_active ? 'success' : 'danger'}>
                      {product.is_active ? 'Ativo' : 'Inativo'}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="space-y-1">
                      <StatusBadge tone={getInstagramStatusTone(product.instagram_post_status)}>
                        {getInstagramStatusLabel(product.instagram_post_status)}
                      </StatusBadge>
                      {product.instagram_error_message ? (
                        <p className="max-w-[220px] text-xs text-rose-600">{product.instagram_error_message}</p>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="relative flex justify-end" ref={openActionMenuId === product.id ? actionMenuRef : null}>
                      <button
                        type="button"
                        onClick={() => setOpenActionMenuId((current) => (current === product.id ? null : product.id))}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Acoes
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="m5 8 5 5 5-5" />
                        </svg>
                      </button>
                      {openActionMenuId === product.id ? (
                        <div className="absolute right-0 top-11 z-20 min-w-[210px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            Editar produto
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(publishingInstagramById[product.id])}
                            onClick={() => {
                              publishOnInstagram(product.id);
                              setOpenActionMenuId(null);
                            }}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                          >
                            {publishingInstagramById[product.id] ? 'Publicando...' : 'Publicar no Instagram'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmTarget(product);
                              setOpenActionMenuId(null);
                            }}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            {product.is_active ? 'Inativar produto' : 'Ativar produto'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(product);
                              setOpenActionMenuId(null);
                            }}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                          >
                            Excluir produto
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )}
            />

            <div className="mt-3 admin-pagination-bar rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                Mostrando <strong>{filteredProducts.length ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> de <strong>{filteredProducts.length}</strong> produtos
              </p>
              <div className="admin-pagination-actions">
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Anterior</Button>
                <span className="text-xs text-slate-600">Pagina {currentPage} de {totalPages}</span>
                <Button variant="secondary" className="h-8 px-3 text-xs" disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Proxima</Button>
              </div>
            </div>
          </>
        ) : null}
      </DataCard>

      <Modal
        open={isModalOpen}
        title={editingId ? 'Editar produto' : 'Novo produto'}
        subtitle="Organize informacoes por bloco para cadastrar com mais clareza."
        onClose={() => setIsModalOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={submitForm}>
              {editingId ? 'Salvar alteracoes' : 'Criar produto'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={submitForm}>
          {selectedProduct?.generated_by_ai ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">
              Produto criado a partir de anuncio gerado por IA
              {selectedProduct?.source_ad_generation_id ? ` (geracao #${selectedProduct.source_ad_generation_id}).` : '.'}
            </div>
          ) : null}
          <ProductFormSection
            title="Informacoes basicas"
            subtitle="Dados principais do produto, descricao e configuracao base de preco."
          >
          <Input label="Titulo" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
          <Select label="Categoria" options={categoryOptions} value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })} />
          {(form.sub_items || []).length === 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Modo de preco</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, pricing_mode: 'calculated' })}
                  className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                    form.pricing_mode === 'calculated'
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                  }`}
                >
                  Calculo automatico
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, pricing_mode: 'manual' })}
                  className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                    form.pricing_mode === 'manual'
                      ? 'border-violet-600 bg-violet-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                  }`}
                >
                  Preco fixo
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Em calculo automatico, o preco final e calculado ao salvar com base nos custos.
              </p>
            </div>
          ) : (
            <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Com sub itens ativos, o preco principal do produto fica oculto e a venda sera pela composicao dos sub itens.
            </div>
          )}

          <Input
            label="Descricao curta"
            value={form.short_description}
            onChange={(event) => setForm({ ...form, short_description: event.target.value })}
            required
          />
          </ProductFormSection>

          <ProductFormSection
            title="Midia e conteudo"
            subtitle="Imagem de capa, galeria e descricao detalhada."
          >
          <Input
            label="URL da capa"
            value={form.cover_image}
            onChange={(event) => setForm({ ...form, cover_image: event.target.value })}
            onPaste={(event) => {
              void handleCoverPaste(event);
            }}
            required
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Upload de capa (opcional)</span>
            <input
              className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => uploadCoverFile(event.target.files?.[0] || null)}
            />
            <small className="text-xs text-slate-500">Voce pode colar URL, enviar arquivo ou colar imagem com Ctrl+V no campo URL.</small>
            {uploadingCover ? <small className="text-xs text-slate-500">Enviando imagem da capa...</small> : null}
          </label>

          <TextArea
            label="Descricao completa"
            rows="4"
            value={form.full_description}
            onChange={(event) => setForm({ ...form, full_description: event.target.value })}
            className="md:col-span-2"
            required
          />

          <TextArea
            label="Imagens extras (links, upload ou colar imagem)"
            rows="4"
            value={form.images}
            onChange={(event) => setForm({ ...form, images: event.target.value })}
            onPaste={(event) => {
              void handleExtraImagesPaste(event);
            }}
            className="md:col-span-2"
          />
          <label className="md:col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Upload de imagens extras (opcional)</span>
            <input
              className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => {
                void uploadExtraImageFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <small className="text-xs text-slate-500">Voce pode misturar links, upload do computador e Ctrl+V no campo acima.</small>
            {uploadingExtraImages ? <small className="text-xs text-slate-500">Enviando imagens extras...</small> : null}
          </label>
          </ProductFormSection>

          <ProductFormSection
            title="Producao, custo e personalizacao"
            subtitle="Controle de prazo, variacoes e calculo de preco."
          >
          <Input
            label="Tempo de producao (horas)"
            type="number"
            min="0"
            step="1"
            value={form.lead_time_hours}
            onChange={(event) => setForm({ ...form, lead_time_hours: event.target.value })}
          />
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.allow_colors}
              onChange={(event) => setForm({ ...form, allow_colors: event.target.checked })}
            />
            <span>Permitir escolha de cores neste produto</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.allow_name_personalization)}
              onChange={(event) => setForm({ ...form, allow_name_personalization: event.target.checked })}
            />
            <span>Permitir personalizacao com texto neste produto</span>
          </label>
          {form.allow_colors ? (
            <div className="md:col-span-2 rounded-[10px] border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paleta de cores do produto</p>
                <div className="flex items-center gap-2">
                  <input
                    id="product-color-picker"
                    type="color"
                    defaultValue="#FFFFFF"
                    className="h-9 w-11 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const input = document.getElementById('product-color-picker');
                      if (input) addProductColor(input.value);
                    }}
                    className="h-9 px-3"
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {parseColors(form.available_colors).length === 0 ? (
                  <small className="text-xs text-slate-500">Nenhuma cor adicionada.</small>
                ) : (
                  parseColors(form.available_colors).map((color) => (
                    <div key={color} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
                      <span className="inline-block h-5 w-5 rounded-full border border-slate-300" style={{ backgroundColor: color }} />
                      <code className="text-xs text-slate-700">{color}</code>
                      <button
                        type="button"
                        onClick={() => removeProductColor(color)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                        aria-label={`Remover cor ${color}`}
                      >
                        x
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 rounded-[10px] border border-slate-200 bg-white p-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.allow_secondary_color)}
                    onChange={(event) => setForm({ ...form, allow_secondary_color: event.target.checked })}
                  />
                  <span>Permitir furta cor neste produto</span>
                </label>

                {form.allow_secondary_color ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Combinacoes permitidas (principal + furta cor)</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ColorPickerField
                        label="Cor principal"
                        value={productPairDraft.primary}
                        onChange={(color) => setProductPairDraft((current) => ({ ...current, primary: color }))}
                      />
                      <ColorPickerField
                        label="Furta cor"
                        value={productPairDraft.secondary}
                        onChange={(color) => setProductPairDraft((current) => ({ ...current, secondary: color }))}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="secondary" className="h-10 px-4" onClick={addProductSecondaryPair}>
                        +
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parseSecondaryPairs(form.secondary_color_pairs).length === 0 ? (
                        <small className="text-xs text-slate-500">Nenhuma combinacao definida.</small>
                      ) : (
                        parseSecondaryPairs(form.secondary_color_pairs).map((pair) => (
                          <div key={`${pair.primary}-${pair.secondary}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                            <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: pair.primary }} />
                            <span className="text-xs text-slate-700">+</span>
                            <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: pair.secondary }} />
                            <code className="text-xs text-slate-700">{pair.primary} + {pair.secondary}</code>
                            <button
                              type="button"
                              onClick={() => removeProductSecondaryPair(pair)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              x
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {(form.sub_items || []).length === 0 && form.pricing_mode === 'manual' ? (
            <Input
              label="Preco do produto"
              type="number"
              min="0"
              step="0.01"
              value={form.manual_price}
              onChange={(event) => setForm({ ...form, manual_price: event.target.value })}
            />
          ) : null}
          {(form.sub_items || []).length === 0 && form.pricing_mode === 'calculated' ? (
            <>
              <Input label="Filamento (gramas)" type="number" min="0" step="0.01" value={form.grams_filament} onChange={(event) => setForm({ ...form, grams_filament: event.target.value })} />
              <Input label="Preco KG filamento" type="number" min="0" step="0.01" value={form.price_kg_filament} onChange={(event) => setForm({ ...form, price_kg_filament: event.target.value })} />
              <Input label="Horas de impressao" type="number" min="0" step="0.01" value={form.hours_printing} onChange={(event) => setForm({ ...form, hours_printing: event.target.value })} />
              <Input label="Potencia media (watts)" type="number" min="0" step="0.01" value={form.avg_power_watts} onChange={(event) => setForm({ ...form, avg_power_watts: event.target.value })} />
              <Input label="Preco kWh" type="number" min="0" step="0.01" value={form.price_kwh} onChange={(event) => setForm({ ...form, price_kwh: event.target.value })} />
              <Input label="Horas mao de obra" type="number" min="0" step="0.01" value={form.total_hours_labor} onChange={(event) => setForm({ ...form, total_hours_labor: event.target.value })} />
              <Input label="Preco hora mao de obra" type="number" min="0" step="0.01" value={form.price_hour_labor} onChange={(event) => setForm({ ...form, price_hour_labor: event.target.value })} />
              <Input label="Custos extras" type="number" min="0" step="0.01" value={form.extra_cost} onChange={(event) => setForm({ ...form, extra_cost: event.target.value })} />
              <Input label="Margem de lucro (%)" type="number" min="0" step="0.01" value={form.profit_margin} onChange={(event) => setForm({ ...form, profit_margin: event.target.value })} />
            </>
          ) : null}
          </ProductFormSection>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Sub itens do anuncio</h4>
              <Button type="button" variant="secondary" onClick={addSubItem}>Adicionar sub item</Button>
            </div>

            <div className="space-y-4">
              {(form.sub_items || []).length === 0 ? (
                <p className="text-sm text-slate-500">Sem sub itens. Produto sera tratado como item unico.</p>
              ) : null}

              {(form.sub_items || []).map((subItem, index) => (
                <div key={`sub-item-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-slate-900">Sub item {index + 1}</strong>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCollapsedSubItems((current) => ({ ...current, [index]: !current[index] }))}
                      >
                        {collapsedSubItems[index] ? 'Expandir' : 'Minimizar'}
                      </Button>
                      <Button type="button" variant="danger" onClick={() => removeSubItem(index)}>Remover</Button>
                    </div>
                  </div>

                  {collapsedSubItems[index] ? (
                    <p className="text-xs text-slate-500">Sub item minimizado.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input label="Titulo" value={subItem.title} onChange={(event) => updateSubItem(index, 'title', event.target.value)} required />
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Modo de preco</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateSubItem(index, 'pricing_mode', 'calculated')}
                          className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                            subItem.pricing_mode === 'calculated'
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                          }`}
                        >
                          Calculo automatico
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSubItem(index, 'pricing_mode', 'manual')}
                          className={`h-10 rounded-[10px] border px-4 text-sm font-medium transition ${
                            subItem.pricing_mode === 'manual'
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                          }`}
                        >
                          Preco fixo
                        </button>
                      </div>
                    </div>
                    <Input
                      label="Tempo de producao (horas)"
                      type="number"
                      min="0"
                      step="1"
                      value={subItem.lead_time_hours}
                      onChange={(event) => updateSubItem(index, 'lead_time_hours', event.target.value)}
                    />
                    <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(subItem.allow_colors)}
                        onChange={(event) => updateSubItem(index, 'allow_colors', event.target.checked)}
                      />
                      <span>Permitir escolha de cores no sub item</span>
                    </label>
                    {subItem.allow_colors ? (
                      <div className="md:col-span-2 rounded-[10px] border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paleta de cores do sub item</p>
                          <div className="flex items-center gap-2">
                            <input
                              id={`subitem-color-picker-${index}`}
                              type="color"
                              defaultValue="#FFFFFF"
                              className="h-9 w-11 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const input = document.getElementById(`subitem-color-picker-${index}`);
                                if (input) addSubItemColor(index, input.value);
                              }}
                              className="h-9 px-3"
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {parseColors(subItem.available_colors).length === 0 ? (
                            <small className="text-xs text-slate-500">Nenhuma cor adicionada.</small>
                          ) : (
                            parseColors(subItem.available_colors).map((color) => (
                              <div key={`${index}-${color}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                                <span className="inline-block h-5 w-5 rounded-full border border-slate-300" style={{ backgroundColor: color }} />
                                <code className="text-xs text-slate-700">{color}</code>
                                <button
                                  type="button"
                                  onClick={() => removeSubItemColor(index, color)}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                                  aria-label={`Remover cor ${color}`}
                                >
                                  x
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3 rounded-[10px] border border-slate-200 bg-slate-50 p-3">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(subItem.allow_secondary_color)}
                              onChange={(event) => updateSubItem(index, 'allow_secondary_color', event.target.checked)}
                            />
                            <span>Permitir furta cor neste sub item</span>
                          </label>

                          {subItem.allow_secondary_color ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Combinacoes permitidas (principal + furta cor)</p>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <ColorPickerField
                                  label="Cor principal"
                                  value={(subItemPairDrafts[index] || createEmptyPairDraft()).primary}
                                  onChange={(color) =>
                                    setSubItemPairDrafts((current) => ({
                                      ...current,
                                      [index]: { ...(current[index] || createEmptyPairDraft()), primary: color },
                                    }))
                                  }
                                />
                                <ColorPickerField
                                  label="Furta cor"
                                  value={(subItemPairDrafts[index] || createEmptyPairDraft()).secondary}
                                  onChange={(color) =>
                                    setSubItemPairDrafts((current) => ({
                                      ...current,
                                      [index]: { ...(current[index] || createEmptyPairDraft()), secondary: color },
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex justify-end">
                                <Button type="button" variant="secondary" className="h-10 px-4" onClick={() => addSubItemSecondaryPair(index)}>
                                  +
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {parseSecondaryPairs(subItem.secondary_color_pairs).length === 0 ? (
                                  <small className="text-xs text-slate-500">Nenhuma combinacao definida.</small>
                                ) : (
                                  parseSecondaryPairs(subItem.secondary_color_pairs).map((pair) => (
                                    <div key={`${index}-${pair.primary}-${pair.secondary}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
                                      <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: pair.primary }} />
                                      <span className="text-xs text-slate-700">+</span>
                                      <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: pair.secondary }} />
                                      <code className="text-xs text-slate-700">{pair.primary} + {pair.secondary}</code>
                                      <button
                                        type="button"
                                        onClick={() => removeSubItemSecondaryPair(index, pair)}
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                                      >
                                        x
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <Input
                      label="Imagem (URL)"
                      className="md:col-span-2"
                      value={subItem.image_url}
                      onChange={(event) => updateSubItem(index, 'image_url', event.target.value)}
                      onPaste={(event) => {
                        void handleSubItemPaste(index, event);
                      }}
                    />
                    <label className="md:col-span-2 flex flex-col gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Upload de imagem do sub item (opcional)</span>
                      <input
                        className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => uploadSubItemFile(index, event.target.files?.[0] || null)}
                      />
                      <small className="text-xs text-slate-500">Voce pode colar URL, enviar arquivo ou colar imagem com Ctrl+V no campo URL.</small>
                      {uploadingSubItems[index] ? <small className="text-xs text-slate-500">Enviando imagem do sub item...</small> : null}
                    </label>

                    {subItem.pricing_mode === 'manual' ? (
                      <Input label="Preco do sub item" type="number" min="0" step="0.01" value={subItem.manual_price} onChange={(event) => updateSubItem(index, 'manual_price', event.target.value)} />
                    ) : (
                      <>
                        <Input label="Filamento (gramas)" type="number" min="0" step="0.01" value={subItem.grams_filament} onChange={(event) => updateSubItem(index, 'grams_filament', event.target.value)} />
                        <Input label="Preco KG filamento" type="number" min="0" step="0.01" value={subItem.price_kg_filament} onChange={(event) => updateSubItem(index, 'price_kg_filament', event.target.value)} />
                        <Input label="Horas de impressao" type="number" min="0" step="0.01" value={subItem.hours_printing} onChange={(event) => updateSubItem(index, 'hours_printing', event.target.value)} />
                        <Input label="Potencia media (watts)" type="number" min="0" step="0.01" value={subItem.avg_power_watts} onChange={(event) => updateSubItem(index, 'avg_power_watts', event.target.value)} />
                        <Input label="Preco kWh" type="number" min="0" step="0.01" value={subItem.price_kwh} onChange={(event) => updateSubItem(index, 'price_kwh', event.target.value)} />
                        <Input label="Horas mao de obra" type="number" min="0" step="0.01" value={subItem.total_hours_labor} onChange={(event) => updateSubItem(index, 'total_hours_labor', event.target.value)} />
                        <Input label="Preco hora mao de obra" type="number" min="0" step="0.01" value={subItem.price_hour_labor} onChange={(event) => updateSubItem(index, 'price_hour_labor', event.target.value)} />
                        <Input label="Custos extras" type="number" min="0" step="0.01" value={subItem.extra_cost} onChange={(event) => updateSubItem(index, 'extra_cost', event.target.value)} />
                        <Input label="Margem de lucro (%)" type="number" min="0" step="0.01" value={subItem.profit_margin} onChange={(event) => updateSubItem(index, 'profit_margin', event.target.value)} />
                      </>
                    )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <ProductFormSection
            title="Publicacao e status"
            subtitle="Controle de envio ao Instagram e ativacao do produto."
          >
          <label className="md:col-span-2 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.publish_to_instagram)}
              onChange={(event) => setForm({ ...form, publish_to_instagram: event.target.checked })}
            />
            <span>Publicar tambem no Instagram</span>
          </label>

          <TextArea
            label="Legenda para Instagram (opcional)"
            className="md:col-span-2"
            rows="3"
            value={form.instagram_caption}
            onChange={(event) => setForm({ ...form, instagram_caption: event.target.value })}
            placeholder="Se vazio, o sistema usa legenda padrao + dados do produto."
          />

          <Input
            label="Hashtags extras para Instagram"
            className="md:col-span-2"
            value={form.instagram_hashtags}
            onChange={(event) => setForm({ ...form, instagram_hashtags: event.target.value })}
            placeholder="#3d #decoracao #organizacao"
          />

          {selectedProduct ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2">
                <StatusBadge tone={getInstagramStatusTone(selectedProduct.instagram_post_status)}>
                  Instagram: {getInstagramStatusLabel(selectedProduct.instagram_post_status)}
                </StatusBadge>
              </div>
              {selectedProduct.instagram_post_id ? (
                <p className="text-sm text-slate-600">Post ID: {selectedProduct.instagram_post_id}</p>
              ) : null}
              {selectedProduct.instagram_published_at ? (
                <p className="text-sm text-slate-600">Publicado em: {selectedProduct.instagram_published_at}</p>
              ) : null}
              {selectedProduct.instagram_error_message ? (
                <p className="text-sm text-rose-600">{selectedProduct.instagram_error_message}</p>
              ) : null}
            </div>
          ) : null}

          <label className="md:col-span-2 inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            <span>Produto ativo</span>
          </label>

          {selectedProduct ? (
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Custo total: R$ {(selectedProduct.cost_total ?? 0).toFixed(2)}</p>
              <p className="text-sm text-slate-600">Preco calculado: R$ {(selectedProduct.calculated_price ?? 0).toFixed(2)}</p>
              <p className="text-sm text-slate-600">Lucro estimado: R$ {(selectedProduct.estimated_profit ?? 0).toFixed(2)}</p>
              <p className="text-sm font-semibold text-slate-900">Preco final: R$ {(selectedProduct.final_price ?? selectedProduct.price ?? 0).toFixed(2)}</p>
            </div>
          ) : null}

          {error ? <p className="md:col-span-2 text-sm text-rose-600">{error}</p> : null}
          </ProductFormSection>
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        title="Confirmar alteracao"
        onClose={() => setConfirmTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmToggleStatus}>
              Confirmar
            </Button>
          </>
        }
      >
        <p>
          Deseja {confirmTarget?.is_active ? 'inativar' : 'ativar'} o produto <strong>{confirmTarget?.title}</strong>?
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Confirmar exclusao"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDeleteProduct}>
              Excluir
            </Button>
          </>
        }
      >
        <p>
          Deseja excluir o produto <strong>{deleteTarget?.title}</strong>? Essa acao nao pode ser desfeita.
        </p>
      </Modal>
    </section>
  );
}

export default AdminProductsPage;










