import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import SectionHeader from '../components/ui/SectionHeader';
import StatusBadge from '../components/ui/StatusBadge';
import {
  createAdmin3DModel,
  deleteAdmin3DModel,
  downloadAdmin3DModelOriginal,
  downloadAdmin3DModelPreview,
  downloadAllAdmin3DModels,
  fetchAdmin3DModelById,
  fetchAdmin3DModels,
  fetchAdminProducts,
  resolveAssetUrl,
  uploadAdmin3DOriginalFile,
  uploadAdmin3DPreviewFile,
  updateAdmin3DModel,
} from '../services/api';

const PAGE_SIZE = 24;
const MODEL3D_PREVIEW_EXTENSIONS = new Set(['.stl', '.glb']);
const MODEL3D_ORIGINAL_EXTENSIONS = new Set(['.3mf', '.stl', '.gcode', '.glb', '.obj', '.step', '.stp']);

const emptyForm = {
  product_id: '',
  sub_item_id: '',
  name: '',
  description: '',
  sort_order: 1,
  original_file_url: '',
  original_file_name: '',
  preview_file_url: '',
  preview_file_name: '',
  width_mm: '',
  height_mm: '',
  depth_mm: '',
  dimensions_source: 'auto',
  allow_download: false,
  is_active: true,
};

const isPreviewImage = (url) => {
  const value = String(url || '').toLowerCase().split('?')[0].split('#')[0];
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif'].some((ext) => value.endsWith(ext));
};

const is3DPreviewFile = (url) => {
  const ext = fileExtensionFromUrl(url);
  return ext === '.stl' || ext === '.glb' || ext === '.gltf';
};

function toOptionalNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDims(item) {
  return `${item.width_mm ?? '-'} x ${item.height_mm ?? '-'} x ${item.depth_mm ?? '-'} mm`;
}

function ModelCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 aspect-square rounded-xl bg-slate-100" />
      <div className="h-4 w-2/3 rounded bg-slate-100" />
      <div className="mt-2 h-3 w-full rounded bg-slate-100" />
      <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
      <div className="mt-3 h-8 w-full rounded bg-slate-100" />
    </div>
  );
}

function fileExtensionFromUrl(url) {
  const value = String(url || '').toLowerCase().split('?')[0].split('#')[0];
  const index = value.lastIndexOf('.');
  if (index < 0) return '';
  return value.slice(index);
}

function fileNameFromUrl(url) {
  const value = String(url || '').split('?')[0].split('#')[0].trim();
  if (!value) return '';
  const parts = value.split('/');
  return parts[parts.length - 1] || '';
}

function fileExtensionFromName(name) {
  const value = String(name || '').toLowerCase();
  const index = value.lastIndexOf('.');
  if (index < 0) return '';
  return value.slice(index);
}

function fileBaseName(name) {
  return String(name || '').replace(/\.[^/.]+$/, '');
}

function isPreviewExtension(ext) {
  return MODEL3D_PREVIEW_EXTENSIONS.has(String(ext || '').toLowerCase());
}

function isOriginalExtension(ext) {
  return MODEL3D_ORIGINAL_EXTENSIONS.has(String(ext || '').toLowerCase());
}

function createBatchQueueItem(file, defaultProductId = '') {
  const extension = fileExtensionFromName(file?.name || '');
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    file,
    file_name: String(file?.name || '').trim(),
    extension,
    signature: `${file?.name || 'file'}|${file?.size || 0}|${file?.lastModified || 0}`,
    product_id: defaultProductId ? String(defaultProductId) : '',
    sub_item_id: '',
    name: fileBaseName(file?.name || ''),
    description: '',
    sort_order: '',
    original_file_url: '',
    preview_file_url: '',
    width_mm: '',
    height_mm: '',
    depth_mm: '',
    dimensions_source: 'auto',
    allow_download: false,
    is_active: true,
    status: 'pending',
    error_message: '',
  };
}

function batchStatusLabel(status) {
  if (status === 'uploading') return 'Enviando';
  if (status === 'ready') return 'Pronto';
  if (status === 'saving') return 'Salvando';
  if (status === 'saved') return 'Salvo';
  if (status === 'needs_preview') return 'Falta preview';
  if (status === 'error') return 'Erro';
  return 'Pendente';
}

function batchStatusClass(status) {
  if (status === 'ready' || status === 'saved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'needs_preview') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'error') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function filterSelectOptions(options, query, selectedValue = '') {
  const text = String(query || '').trim().toLowerCase();
  if (!text) return options;
  const selected = String(selectedValue || '').trim();
  const filtered = options.filter((option) => String(option.label || '').toLowerCase().includes(text));
  if (!selected) return filtered;
  if (filtered.some((option) => String(option.value) === selected)) return filtered;
  const selectedOption = options.find((option) => String(option.value) === selected);
  return selectedOption ? [selectedOption, ...filtered] : filtered;
}

function Model3DPreview({ src, className = '', interactive = false }) {
  const mountRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!src || !mountRef.current || !is3DPreviewFile(src)) return undefined;

    let disposed = false;
    let animationId = null;
    let cleanup = null;

    const setup = async () => {
      try {
        const THREE = await import('three');
        const [{ OrbitControls }, { GLTFLoader }, { STLLoader }] = await Promise.all([
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/loaders/STLLoader.js'),
        ]);
        if (disposed || !mountRef.current) return;

        const container = mountRef.current;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#f8fafc');

        const camera = new THREE.PerspectiveCamera(40, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 2000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight('#ffffff', 0.9);
        const key = new THREE.DirectionalLight('#ffffff', 1);
        key.position.set(2, 4, 6);
        const fill = new THREE.DirectionalLight('#ffffff', 0.45);
        fill.position.set(-4, -2, 3);
        scene.add(ambient, key, fill);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = Boolean(interactive);
        controls.enableZoom = Boolean(interactive);
        controls.enableRotate = true;
        controls.enableDamping = Boolean(interactive);
        controls.dampingFactor = 0.08;
        controls.autoRotate = !interactive;
        controls.autoRotateSpeed = 1.2;

        const ext = fileExtensionFromUrl(src);
        const applyObject = (object) => {
          const group = new THREE.Group();
          group.add(object);
          scene.add(group);

          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          group.position.sub(center);

          const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
          const distance = maxDim * 1.9;
          camera.position.set(distance, distance * 0.7, distance);
          camera.lookAt(0, 0, 0);
          controls.target.set(0, 0, 0);
          controls.update();

          const renderFrame = () => {
            if (disposed) return;
            if (interactive) {
              controls.update();
              renderer.render(scene, camera);
              animationId = window.requestAnimationFrame(renderFrame);
              return;
            }
            controls.update();
            renderer.render(scene, camera);
          };
          renderFrame();
        };

        if (ext === '.stl') {
          const loader = new STLLoader();
          loader.load(
            src,
            (geometry) => {
              if (disposed) return;
              geometry.computeVertexNormals();
              const material = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.35, metalness: 0.1 });
              const mesh = new THREE.Mesh(geometry, material);
              applyObject(mesh);
            },
            undefined,
            () => setFailed(true),
          );
        } else {
          const loader = new GLTFLoader();
          loader.load(
            src,
            (gltf) => {
              if (disposed) return;
              applyObject(gltf.scene);
            },
            undefined,
            () => setFailed(true),
          );
        }

        const handleResize = () => {
          if (!container || !renderer || !camera) return;
          const w = container.clientWidth;
          const h = Math.max(container.clientHeight, 1);
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        };
        const observer = new ResizeObserver(handleResize);
        observer.observe(container);

        cleanup = () => {
          observer.disconnect();
          controls.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          if (renderer.domElement && renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        };
      } catch {
        setFailed(true);
      }
    };

    setup();

    return () => {
      disposed = true;
      if (animationId) window.cancelAnimationFrame(animationId);
      if (cleanup) cleanup();
    };
  }, [src, interactive]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${className}`.trim()}>
      <div ref={mountRef} className="h-full w-full" />
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/95 text-xs font-semibold text-slate-500">
          Nao foi possivel renderizar
        </div>
      ) : null}
    </div>
  );
}

function ModelThumbnail({ item }) {
  const previewUrl = resolveAssetUrl(item.preview_file_url || '') || item.preview_file_url || '';
  const isImage = isPreviewImage(previewUrl);

  if (isImage && previewUrl) {
    return (
      <div className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <img
          src={previewUrl}
          alt={item.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
    );
  }
  if (is3DPreviewFile(previewUrl)) {
    return <Model3DPreview src={previewUrl} className="aspect-square" />;
  }
  return (
    <div className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex flex-col items-center gap-2 text-slate-500 transition duration-300 group-hover:scale-[1.03]">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
        <span className="px-2 text-center text-[11px] font-medium">Preview 3D</span>
      </div>
    </div>
  );
}

function Admin3DModelsPage() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloadFilter, setDownloadFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailModel, setDetailModel] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [sortOrderTouched, setSortOrderTouched] = useState(false);
  const [originalUploadFile, setOriginalUploadFile] = useState(null);
  const [previewUploadFile, setPreviewUploadFile] = useState(null);
  const [uploadingOriginal, setUploadingOriginal] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [batchQueue, setBatchQueue] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState('');
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProductSearch, setBatchProductSearch] = useState('');
  const [batchSubItemSearch, setBatchSubItemSearch] = useState('');
  const [modalProductSearch, setModalProductSearch] = useState('');
  const [modalSubItemSearch, setModalSubItemSearch] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  const flashNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetchAdminProducts(),
      fetchAdmin3DModels({
        search: search || undefined,
        product_id: productFilter !== 'all' ? Number(productFilter) : undefined,
        is_active: statusFilter === 'all' ? 'all' : statusFilter === 'active',
        allow_download: downloadFilter === 'all' ? 'all' : downloadFilter === 'yes',
      }),
    ])
      .then(([productRows, modelRows]) => {
        setProducts(Array.isArray(productRows) ? productRows : []);
        setRows(Array.isArray(modelRows) ? modelRows : []);
      })
      .catch((requestError) => setError(requestError.message || 'Falha ao carregar modelos 3D.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const text = String(search || '').trim().toLowerCase();
    return rows.filter((item) => {
      const isSubItem = Boolean(item.sub_item_id);
      if (typeFilter === 'subitem' && !isSubItem) return false;
      if (typeFilter === 'product' && isSubItem) return false;
      if (statusFilter === 'active' && !item.is_active) return false;
      if (statusFilter === 'inactive' && item.is_active) return false;
      if (downloadFilter === 'yes' && !item.allow_download) return false;
      if (downloadFilter === 'no' && item.allow_download) return false;
      if (productFilter !== 'all' && String(item.product_id) !== String(productFilter)) return false;
      if (!text) return true;
      const blob = `${item.name || ''} ${item.product_title || ''} ${item.product_slug || ''} ${item.sub_item_title || ''}`.toLowerCase();
      return blob.includes(text);
    });
  }, [rows, search, productFilter, statusFilter, downloadFilter, typeFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, productFilter, statusFilter, downloadFilter, typeFilter, rows]);

  const visibleRows = useMemo(() => filteredRows.slice(0, visibleCount), [filteredRows, visibleCount]);
  const hasMore = visibleRows.length < filteredRows.length;
  const selectedRowIdSet = useMemo(
    () => new Set((selectedRowIds || []).map((item) => String(item))),
    [selectedRowIds]
  );
  const selectedInFilterCount = useMemo(
    () => filteredRows.filter((item) => selectedRowIdSet.has(String(item.id))).length,
    [filteredRows, selectedRowIdSet]
  );
  const areAllFilteredSelected = filteredRows.length > 0 && selectedInFilterCount === filteredRows.length;

  const groupedRows = useMemo(() => {
    const map = new Map();
    visibleRows.forEach((item) => {
      const key = item.product_id == null ? 'unassigned' : `${item.product_id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          productId: item.product_id,
          productTitle: item.product_title || (item.product_id == null ? 'Nao atribuido' : `Produto #${item.product_id}`),
          items: [],
        });
      }
      map.get(key).items.push(item);
    });
    return Array.from(map.values()).sort((a, b) => a.productTitle.localeCompare(b.productTitle));
  }, [visibleRows]);

  useEffect(() => {
    setSelectedRowIds((current) => {
      const available = new Set((rows || []).map((item) => String(item.id)));
      const next = current.filter((id) => available.has(String(id)));
      return next.length === current.length ? current : next;
    });
  }, [rows]);

  const productOptions = useMemo(
    () => products.filter((item) => Number(item.id) > 0).map((item) => ({ value: String(item.id), label: item.title })),
    [products]
  );

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === String(form.product_id || '')),
    [products, form.product_id]
  );

  const subItemOptions = useMemo(() => {
    if (!selectedProduct || !Array.isArray(selectedProduct.sub_items)) return [];
    return selectedProduct.sub_items
      .map((item) => ({
        value: String(item?.id || '').trim(),
        label: item?.title || 'Sub item',
      }))
      .filter((item) => item.value);
  }, [selectedProduct]);

  const activeBatchItem = batchQueue.find((item) => item.id === activeBatchId) || null;
  const batchProduct = products.find((item) => String(item.id) === String(activeBatchItem?.product_id || '')) || null;
  const batchSubItemOptions = Array.isArray(batchProduct?.sub_items)
    ? batchProduct.sub_items
      .map((item) => ({ value: String(item?.id || '').trim(), label: item?.title || 'Sub item' }))
      .filter((item) => item.value)
    : [];

  const filteredBatchProductOptions = useMemo(
    () => filterSelectOptions(productOptions, batchProductSearch, activeBatchItem?.product_id),
    [productOptions, batchProductSearch, activeBatchItem?.product_id]
  );

  const filteredBatchSubItemOptions = useMemo(
    () => filterSelectOptions(batchSubItemOptions, batchSubItemSearch, activeBatchItem?.sub_item_id),
    [batchSubItemOptions, batchSubItemSearch, activeBatchItem?.sub_item_id]
  );

  const filteredModalProductOptions = useMemo(
    () => filterSelectOptions(productOptions, modalProductSearch, form.product_id),
    [productOptions, modalProductSearch, form.product_id]
  );

  const filteredModalSubItemOptions = useMemo(
    () => filterSelectOptions(subItemOptions, modalSubItemSearch, form.sub_item_id),
    [subItemOptions, modalSubItemSearch, form.sub_item_id]
  );

  const computeNextSortOrder = (productId, subItemId) => {
    const hasProduct = Number(productId || 0) > 0;
    const targetSubItem = String(subItemId || '').trim();
    const candidates = rows.filter((item) => {
      const sameProduct = hasProduct ? Number(item.product_id || 0) === Number(productId) : item.product_id == null;
      if (!sameProduct) return false;
      const rowSub = String(item.sub_item_id || '').trim();
      return rowSub === targetSubItem;
    });
    const maxOrder = candidates.reduce((max, item) => Math.max(max, Number(item.sort_order || 0)), 0);
    return Math.max(1, maxOrder + 1);
  };

  const updateBatchItem = (itemId, patch) => {
    setBatchQueue((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const nextPatch = typeof patch === 'function' ? patch(item) : patch;
        return { ...item, ...(nextPatch || {}) };
      })
    );
  };

  const removeBatchItem = (itemId) => {
    setBatchQueue((current) => current.filter((item) => item.id !== itemId));
    setActiveBatchId((current) => (current === itemId ? '' : current));
  };

  const handleBatchFilesSelected = async (incomingFiles) => {
    const files = Array.from(incomingFiles || []);
    if (!files.length) return;
    const defaultProductId = productFilter !== 'all' ? String(productFilter) : '';
    const signatures = new Set(batchQueue.map((item) => item.signature));
    const queueItems = files
      .map((file) => createBatchQueueItem(file, defaultProductId))
      .filter((item) => isOriginalExtension(item.extension) && !signatures.has(item.signature));

    if (!queueItems.length) {
      setError('Nenhum arquivo novo valido para upload em lote.');
      return;
    }

    setBatchQueue((current) => [...current, ...queueItems]);
    if (!activeBatchId) setActiveBatchId(queueItems[0].id);
    setBatchUploading(true);
    setError('');

    for (const item of queueItems) {
      updateBatchItem(item.id, { status: 'uploading', error_message: '' });
      try {
        const original = await uploadAdmin3DOriginalFile(item.file, item.file_name);
        const nextPatch = {
          original_file_url: original?.url || '',
          status: 'ready',
          error_message: '',
        };

        if (isPreviewExtension(item.extension)) {
          const preview = await uploadAdmin3DPreviewFile(item.file, item.file_name);
          nextPatch.preview_file_url = preview?.url || '';
          nextPatch.width_mm = preview?.width_mm == null ? '' : String(preview.width_mm);
          nextPatch.height_mm = preview?.height_mm == null ? '' : String(preview.height_mm);
          nextPatch.depth_mm = preview?.depth_mm == null ? '' : String(preview.depth_mm);
          nextPatch.dimensions_source = preview?.dimensions_extracted ? 'auto' : 'manual';
          if (!nextPatch.preview_file_url) {
            nextPatch.status = 'error';
            nextPatch.error_message = 'Preview nao retornou URL.';
          }
        } else {
          nextPatch.status = 'needs_preview';
          nextPatch.error_message = 'Envie um arquivo preview (.stl/.glb) para este item.';
        }

        updateBatchItem(item.id, nextPatch);
      } catch (uploadError) {
        updateBatchItem(item.id, {
          status: 'error',
          error_message: uploadError?.message || 'Falha no upload.',
        });
      }
    }

    setBatchUploading(false);
    flashNotice('Upload em lote concluido. Clique no card para vincular ao produto.');
  };

  const uploadBatchPreview = async (itemId, file) => {
    if (!file) return;
    updateBatchItem(itemId, { status: 'uploading', error_message: '' });
    setError('');
    try {
      const result = await uploadAdmin3DPreviewFile(file, file.name);
      updateBatchItem(itemId, (current) => ({
        preview_file_url: result?.url || current.preview_file_url,
        width_mm: result?.width_mm == null ? current.width_mm : String(result.width_mm),
        height_mm: result?.height_mm == null ? current.height_mm : String(result.height_mm),
        depth_mm: result?.depth_mm == null ? current.depth_mm : String(result.depth_mm),
        dimensions_source: result?.dimensions_extracted ? 'auto' : current.dimensions_source,
        status: result?.url ? 'ready' : 'error',
        error_message: result?.url ? '' : 'Falha ao gerar preview.',
      }));
    } catch (uploadError) {
      updateBatchItem(itemId, {
        status: 'error',
        error_message: uploadError?.message || 'Falha no upload do preview.',
      });
    }
  };

  const saveBatchQueue = async () => {
    const readyItems = batchQueue.filter(
      (item) => item.status === 'ready' && item.preview_file_url
    );
    if (!readyItems.length) {
      setError('Nenhum item pronto para salvar. Verifique o preview.');
      return;
    }

    setBatchSaving(true);
    setError('');

    const sortMap = new Map();
    rows.forEach((row) => {
      const key = `${Number(row.product_id || 0)}|${String(row.sub_item_id || '').trim()}`;
      sortMap.set(key, Math.max(Number(sortMap.get(key) || 0), Number(row.sort_order || 0)));
    });

    let ok = 0;
    let fail = 0;
    for (const item of readyItems) {
      updateBatchItem(item.id, { status: 'saving', error_message: '' });
      try {
        const productId = Number(item.product_id || 0) > 0 ? Number(item.product_id) : null;
        const subItemId = productId ? String(item.sub_item_id || '').trim() : '';
        const key = `${productId}|${subItemId}`;
        const maxSort = Number(sortMap.get(key) || 0);
        const providedSort = Number(item.sort_order || 0);
        const nextSort = providedSort > 0 ? providedSort : maxSort + 1;
        sortMap.set(key, Math.max(maxSort, nextSort));

        await createAdmin3DModel({
          product_id: productId,
          sub_item_id: subItemId || null,
          name: String(item.name || '').trim() || fileBaseName(item.file_name),
          description: String(item.description || '').trim() || null,
          sort_order: nextSort,
          original_file_url: String(item.original_file_url || '').trim() || null,
          preview_file_url: String(item.preview_file_url || '').trim(),
          width_mm: toOptionalNumber(item.width_mm),
          height_mm: toOptionalNumber(item.height_mm),
          depth_mm: toOptionalNumber(item.depth_mm),
          dimensions_source: item.dimensions_source === 'manual' ? 'manual' : 'auto',
          allow_download: Boolean(item.allow_download),
          is_active: Boolean(item.is_active),
        });
        ok += 1;
        updateBatchItem(item.id, { status: 'saved', sort_order: nextSort, error_message: '' });
      } catch (saveError) {
        fail += 1;
        updateBatchItem(item.id, {
          status: 'error',
          error_message: saveError?.message || 'Falha ao salvar item.',
        });
      }
    }

    setBatchSaving(false);
    flashNotice(`Lote salvo: ${ok} sucesso, ${fail} erro(s).`);
    loadData();
  };

  useEffect(() => {
    if (!modalOpen || editingId || sortOrderTouched) return;
    const nextOrder = computeNextSortOrder(form.product_id, form.sub_item_id);
    setForm((current) => ({ ...current, sort_order: nextOrder }));
  }, [modalOpen, editingId, sortOrderTouched, form.product_id, form.sub_item_id, rows]);

  const openCreate = () => {
    setEditingId(null);
    setSortOrderTouched(false);
    setOriginalUploadFile(null);
    setPreviewUploadFile(null);
    setModalProductSearch('');
    setModalSubItemSearch('');
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setSortOrderTouched(true);
    setOriginalUploadFile(null);
    setPreviewUploadFile(null);
    setModalProductSearch('');
    setModalSubItemSearch('');
    setForm({
      product_id: item.product_id == null ? '' : String(item.product_id),
      sub_item_id: String(item.sub_item_id || ''),
      name: item.name || '',
      description: item.description || '',
      sort_order: Number(item.sort_order || 1),
      original_file_url: item.original_file_url || '',
      original_file_name: item.original_file_name || fileNameFromUrl(item.original_file_url),
      preview_file_url: item.preview_file_url || '',
      preview_file_name: item.preview_file_name || fileNameFromUrl(item.preview_file_url),
      width_mm: item.width_mm == null ? '' : String(item.width_mm),
      height_mm: item.height_mm == null ? '' : String(item.height_mm),
      depth_mm: item.depth_mm == null ? '' : String(item.depth_mm),
      dimensions_source: item.dimensions_source || 'auto',
      allow_download: Boolean(item.allow_download),
      is_active: Boolean(item.is_active),
    });
    setModalOpen(true);
  };

  const openDetail = async (id) => {
    setError('');
    try {
      const data = await fetchAdmin3DModelById(id);
      setDetailModel(data);
      setDetailOpen(true);
    } catch (detailError) {
      setError(detailError.message || 'Falha ao carregar detalhe do modelo.');
    }
  };

  const saveModel = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const normalizedProductId = Number(form.product_id || 0) > 0 ? Number(form.product_id) : null;
      const payload = {
        product_id: normalizedProductId,
        sub_item_id: normalizedProductId ? (String(form.sub_item_id || '').trim() || null) : null,
        name: String(form.name || '').trim(),
        description: String(form.description || '').trim() || null,
        sort_order: Number(form.sort_order || 1),
        original_file_url: String(form.original_file_url || '').trim() || null,
        preview_file_url: String(form.preview_file_url || '').trim(),
        width_mm: toOptionalNumber(form.width_mm),
        height_mm: toOptionalNumber(form.height_mm),
        depth_mm: toOptionalNumber(form.depth_mm),
        dimensions_source: form.dimensions_source === 'manual' ? 'manual' : 'auto',
        allow_download: Boolean(form.allow_download),
        is_active: Boolean(form.is_active),
      };
      if (!payload.preview_file_url) throw new Error('Arquivo preview e obrigatorio.');

      if (editingId) {
        await updateAdmin3DModel(editingId, payload);
        flashNotice('Modelo atualizado com sucesso.');
      } else {
        await createAdmin3DModel(payload);
        flashNotice('Modelo criado com sucesso.');
      }
      setModalOpen(false);
      setSortOrderTouched(false);
      setOriginalUploadFile(null);
      setPreviewUploadFile(null);
      setForm(emptyForm);
      setEditingId(null);
      loadData();
    } catch (saveError) {
      setError(saveError.message || 'Falha ao salvar modelo 3D.');
    } finally {
      setSaving(false);
    }
  };

  const handleOriginalFileSelected = (file) => {
    setOriginalUploadFile(file || null);
    if (!file) return;
    const suggested = String(file.name || '').trim();
    setForm((current) => ({
      ...current,
      original_file_name: suggested || current.original_file_name,
      name: current.name || suggested.replace(/\.[^/.]+$/, ''),
    }));
  };

  const handlePreviewFileSelected = (file) => {
    setPreviewUploadFile(file || null);
    if (!file) return;
    const suggested = String(file.name || '').trim();
    setForm((current) => ({
      ...current,
      preview_file_name: suggested || current.preview_file_name,
      name: current.name || suggested.replace(/\.[^/.]+$/, ''),
    }));
  };

  const handleUploadOriginal = async () => {
    if (!originalUploadFile) {
      setError('Selecione um arquivo original para enviar.');
      return;
    }
    setUploadingOriginal(true);
    setError('');
    try {
      const result = await uploadAdmin3DOriginalFile(originalUploadFile, form.original_file_name || originalUploadFile.name);
      setForm((current) => ({
        ...current,
        original_file_url: result?.url || current.original_file_url,
        original_file_name: fileNameFromUrl(result?.url) || current.original_file_name,
      }));
      flashNotice('Arquivo original enviado com sucesso.');
    } catch (uploadError) {
      setError(uploadError.message || 'Falha no upload do arquivo original.');
    } finally {
      setUploadingOriginal(false);
    }
  };

  const handleUploadPreview = async () => {
    if (!previewUploadFile) {
      setError('Selecione um arquivo de preview para enviar.');
      return;
    }
    setUploadingPreview(true);
    setError('');
    try {
      const result = await uploadAdmin3DPreviewFile(previewUploadFile, form.preview_file_name || previewUploadFile.name);
      setForm((current) => ({
        ...current,
        preview_file_url: result?.url || current.preview_file_url,
        preview_file_name: fileNameFromUrl(result?.url) || current.preview_file_name,
        width_mm: result?.width_mm == null ? current.width_mm : String(result.width_mm),
        height_mm: result?.height_mm == null ? current.height_mm : String(result.height_mm),
        depth_mm: result?.depth_mm == null ? current.depth_mm : String(result.depth_mm),
        dimensions_source: result?.dimensions_extracted ? 'auto' : current.dimensions_source,
      }));
      flashNotice('Preview enviado com sucesso.');
    } catch (uploadError) {
      setError(uploadError.message || 'Falha no upload do preview.');
    } finally {
      setUploadingPreview(false);
    }
  };

  const toggleRowSelection = (rowId) => {
    const id = String(rowId);
    setSelectedRowIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredRows.map((item) => String(item.id));
    if (!filteredIds.length) {
      setSelectedRowIds([]);
      return;
    }
    setSelectedRowIds((current) => {
      const currentSet = new Set(current.map((item) => String(item)));
      const allSelected = filteredIds.every((id) => currentSet.has(id));
      if (allSelected) {
        return current.filter((id) => !filteredIds.includes(String(id)));
      }
      const next = new Set(currentSet);
      filteredIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const removeManyModels = async (modelIds, label) => {
    const ids = Array.from(new Set((modelIds || []).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)));
    if (!ids.length) return;
    const confirmed = window.confirm(`Tem certeza que deseja excluir ${ids.length} ${label}?`);
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
        try {
          await deleteAdmin3DModel(id);
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      if (fail > 0) {
        setError(`Exclusao parcial: ${ok} removido(s), ${fail} com erro.`);
      } else {
        flashNotice(`${ok} modelo(s) excluido(s) com sucesso.`);
      }
      setSelectedRowIds((current) => current.filter((id) => !ids.includes(Number(id))));
      loadData();
    } catch (deleteError) {
      setError(deleteError.message || 'Falha ao excluir modelo 3D.');
    } finally {
      setSaving(false);
    }
  };

  const removeModel = async (item) => removeManyModels([item?.id], 'modelo(s)');

  const removeSelectedModels = async () => {
    if (!selectedRowIds.length) return;
    await removeManyModels(selectedRowIds, 'modelo(s) selecionado(s)');
  };

  const removeAllFilteredModels = async () => {
    if (!filteredRows.length) return;
    await removeManyModels(filteredRows.map((item) => item.id), 'modelo(s) filtrado(s)');
  };

  const handleDownloadOriginal = async (item) => {
    try {
      const name = String(item.original_file_name || fileNameFromUrl(item.original_file_url) || '').trim();
      await downloadAdmin3DModelOriginal(item.id, name || null);
      flashNotice(`Download original: ${item.name}`);
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar arquivo original.');
    }
  };

  const handleDownloadPreview = async (item) => {
    try {
      const name = String(item.preview_file_name || fileNameFromUrl(item.preview_file_url) || '').trim();
      await downloadAdmin3DModelPreview(item.id, name || null);
      flashNotice(`Download preview: ${item.name}`);
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar preview.');
    }
  };

  const handleDownloadAll = async () => {
    try {
      await downloadAllAdmin3DModels({
        search: search || undefined,
        product_id: productFilter !== 'all' ? Number(productFilter) : undefined,
        is_active: statusFilter === 'all' ? 'all' : statusFilter === 'active',
        allow_download: downloadFilter === 'all' ? 'all' : downloadFilter === 'yes',
      });
      flashNotice('Download em lote iniciado.');
    } catch (downloadError) {
      setError(downloadError.message || 'Falha ao baixar modelos.');
    }
  };

  const quickPillClass = (active) =>
    `h-9 rounded-full border px-3 text-xs font-semibold transition ${
      active
        ? 'border-violet-600 bg-violet-600 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
    }`;

  return (
    <section className="admin-page space-y-6">
      <SectionHeader
        eyebrow="Interno"
        title="Modelos 3D"
        subtitle="Gerencie todos os modelos 3D e atribua depois quando estiverem sem vinculo."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              Total: {filteredRows.length} modelos
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
              Selecionados: {selectedInFilterCount}
            </span>
            <Button variant="ghost" onClick={toggleSelectAllFiltered} disabled={!filteredRows.length}>
              {areAllFilteredSelected ? 'Desmarcar filtrados' : 'Selecionar filtrados'}
            </Button>
            <Button variant="danger" onClick={removeSelectedModels} disabled={!selectedRowIds.length || saving}>
              Excluir selecionados
            </Button>
            <Button variant="danger" onClick={removeAllFilteredModels} disabled={!filteredRows.length || saving}>
              Excluir todos filtrados
            </Button>
            <Button variant="secondary" onClick={handleDownloadAll}>Baixar todos</Button>
            <Button onClick={openCreate}>+ Novo modelo</Button>
          </div>
        )}
      />

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-violet-200 hover:text-violet-700">
            <input
              type="file"
              multiple
              accept=".3mf,.stl,.gcode,.glb,.obj,.step,.stp"
              className="hidden"
              onChange={(event) => {
                void handleBatchFilesSelected(event.target.files);
                event.target.value = '';
              }}
            />
            Upload em lote 3D
          </label>
          <Button
            variant="secondary"
            onClick={saveBatchQueue}
            loading={batchSaving}
            disabled={!batchQueue.some((item) => item.status === 'ready') || batchUploading}
          >
            Salvar lote
          </Button>
          <Button
            variant="ghost"
            onClick={() => setBatchQueue((current) => current.filter((item) => item.status !== 'saved'))}
            disabled={!batchQueue.some((item) => item.status === 'saved')}
          >
            Limpar salvos
          </Button>
          {batchUploading ? <small className="text-xs text-slate-500">Processando uploads da fila...</small> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {batchQueue.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                Envie varios arquivos. Depois clique no card para vincular ao produto.
              </p>
            ) : (
              batchQueue.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    activeBatchId === item.id
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-violet-200'
                  }`}
                  onClick={() => setActiveBatchId(item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name || item.file_name}</p>
                      <p className="text-xs text-slate-500">{item.file_name}</p>
                      <p className="text-xs text-slate-500">
                        {item.width_mm || '-'} x {item.height_mm || '-'} x {item.depth_mm || '-'} mm
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${batchStatusClass(item.status)}`}>
                      {batchStatusLabel(item.status)}
                    </span>
                  </div>
                  {item.error_message ? <p className="mt-2 text-xs text-rose-600">{item.error_message}</p> : null}
                </button>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            {activeBatchItem ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Vincular card selecionado</p>
                <Input
                  label="Nome"
                  value={activeBatchItem.name}
                  onChange={(event) => updateBatchItem(activeBatchItem.id, { name: event.target.value })}
                />
                <Input
                  label="Buscar produto"
                  value={batchProductSearch}
                  onChange={(event) => setBatchProductSearch(event.target.value)}
                  placeholder="Digite para filtrar produtos"
                />
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Produto</span>
                  <select
                    value={activeBatchItem.product_id}
                    onChange={(event) => {
                      setBatchSubItemSearch('');
                      updateBatchItem(activeBatchItem.id, { product_id: event.target.value, sub_item_id: '' });
                    }}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    <option value="">Nao atribuido</option>
                    {filteredBatchProductOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <Input
                  label="Buscar subitem"
                  value={batchSubItemSearch}
                  onChange={(event) => setBatchSubItemSearch(event.target.value)}
                  placeholder="Digite para filtrar subitens"
                />
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Subitem (opcional)</span>
                  <select
                    value={activeBatchItem.sub_item_id}
                    onChange={(event) => updateBatchItem(activeBatchItem.id, { sub_item_id: event.target.value })}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                    disabled={!batchProduct}
                  >
                    <option value="">{batchProduct ? 'Principal do produto' : 'Sem produto vinculado'}</option>
                    {filteredBatchSubItemOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <Input
                  label="Ordem (opcional)"
                  type="number"
                  min="1"
                  step="1"
                  value={activeBatchItem.sort_order}
                  onChange={(event) => updateBatchItem(activeBatchItem.id, { sort_order: event.target.value })}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Input
                    label="Largura (mm)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={activeBatchItem.width_mm}
                    onChange={(event) => updateBatchItem(activeBatchItem.id, { width_mm: event.target.value, dimensions_source: 'manual' })}
                  />
                  <Input
                    label="Altura (mm)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={activeBatchItem.height_mm}
                    onChange={(event) => updateBatchItem(activeBatchItem.id, { height_mm: event.target.value, dimensions_source: 'manual' })}
                  />
                  <Input
                    label="Profundidade (mm)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={activeBatchItem.depth_mm}
                    onChange={(event) => updateBatchItem(activeBatchItem.id, { depth_mm: event.target.value, dimensions_source: 'manual' })}
                  />
                </div>
                <Input
                  label="Descricao"
                  value={activeBatchItem.description}
                  onChange={(event) => updateBatchItem(activeBatchItem.id, { description: event.target.value })}
                />
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Preview manual (.glb/.stl)</span>
                  <input
                    type="file"
                    accept=".glb,.stl"
                    onChange={(event) => {
                      void uploadBatchPreview(activeBatchItem.id, event.target.files?.[0] || null);
                      event.target.value = '';
                    }}
                    className="max-w-full text-sm"
                  />
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(activeBatchItem.allow_download)}
                      onChange={(event) => updateBatchItem(activeBatchItem.id, { allow_download: event.target.checked })}
                    />
                    Permitir download
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(activeBatchItem.is_active)}
                      onChange={(event) => updateBatchItem(activeBatchItem.id, { is_active: event.target.checked })}
                    />
                    Modelo ativo
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button variant="danger" onClick={() => removeBatchItem(activeBatchItem.id)}>Remover card</Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Selecione um card da fila para vincular ao produto.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              label="Busca"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, produto ou subitem"
              className="min-w-[220px]"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Produto</span>
              <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
                <option value="all">Todos</option>
                {productOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <Button variant="secondary" onClick={loadData}>Atualizar</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={quickPillClass(typeFilter === 'all')} onClick={() => setTypeFilter('all')}>Tipo: todos</button>
            <button type="button" className={quickPillClass(typeFilter === 'product')} onClick={() => setTypeFilter('product')}>Produto</button>
            <button type="button" className={quickPillClass(typeFilter === 'subitem')} onClick={() => setTypeFilter('subitem')}>Subitem</button>
            <button type="button" className={quickPillClass(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>Status: todos</button>
            <button type="button" className={quickPillClass(statusFilter === 'active')} onClick={() => setStatusFilter('active')}>Ativos</button>
            <button type="button" className={quickPillClass(statusFilter === 'inactive')} onClick={() => setStatusFilter('inactive')}>Inativos</button>
            <button type="button" className={quickPillClass(downloadFilter === 'all')} onClick={() => setDownloadFilter('all')}>Download: todos</button>
            <button type="button" className={quickPillClass(downloadFilter === 'yes')} onClick={() => setDownloadFilter('yes')}>Download ativo</button>
            <button type="button" className={quickPillClass(downloadFilter === 'no')} onClick={() => setDownloadFilter('no')}>Sem download</button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Carregando modelos...</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => <ModelCardSkeleton key={`skeleton-${index}`} />)}
          </div>
        </section>
      ) : groupedRows.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
              <path d="m4 7.5 8 4.5 8-4.5" />
              <path d="M12 12v9" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-800">Nenhum modelo 3D cadastrado ainda</h3>
          <p className="mt-1 text-sm text-slate-500">Crie o primeiro modelo para comecar a organizar sua biblioteca.</p>
          <div className="mt-4">
            <Button onClick={openCreate}>Criar primeiro modelo</Button>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          {groupedRows.map((group) => (
            <article key={group.key} className="space-y-3">
              <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">
                  {group.productTitle} <span className="text-slate-500">({group.items.length} modelos)</span>
                </h3>
              </header>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.items.map((item) => {
                  const isPrincipal = !item.sub_item_id && Number(item.sort_order || 9999) === 1;
                  const isSelected = selectedRowIdSet.has(String(item.id));
                  return (
                    <div
                      key={item.id}
                      className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                        isSelected ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200'
                      }`}
                      onClick={() => openDetail(item.id)}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <label
                          className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelection(item.id)}
                          />
                          <span>Selecionar</span>
                        </label>
                        {item.product_id == null ? <StatusBadge tone="warning">Atribuir depois</StatusBadge> : null}
                      </div>
                      <ModelThumbnail item={item} />

                      <div className="mt-3 space-y-2">
                        <h4 className="line-clamp-1 text-sm font-semibold text-slate-900">{item.name}</h4>
                        <p className="line-clamp-1 text-xs text-slate-500">
                          {item.product_title || (item.product_id == null ? 'Nao atribuido' : `Produto #${item.product_id}`)}
                        </p>
                        <p className="line-clamp-1 text-xs text-slate-500">
                          {item.sub_item_title ? `Subitem: ${item.sub_item_title}` : (item.product_id == null ? 'Vinculo: nao atribuido' : 'Vinculo: produto principal')}
                        </p>
                        <p className="text-xs font-medium text-slate-700">Dimensoes: {formatDims(item)}</p>
                        <p className="text-xs text-slate-500">Ordem: {item.sort_order}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {isPrincipal ? <StatusBadge tone="info">Principal</StatusBadge> : null}
                        <StatusBadge tone={item.sub_item_id ? 'info' : (item.product_id == null ? 'danger' : 'neutral')}>
                          {item.sub_item_id ? 'Subitem' : (item.product_id == null ? 'Nao atribuido' : 'Produto')}
                        </StatusBadge>
                        {item.allow_download ? <StatusBadge tone="success">Download ativo</StatusBadge> : null}
                        {!item.is_active ? <StatusBadge tone="danger">Inativo</StatusBadge> : null}
                      </div>

                      <div className="mt-4 grid grid-cols-5 gap-1" onClick={(event) => event.stopPropagation()}>
                        <button type="button" title="Detalhes" onClick={() => openDetail(item.id)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">i</button>
                        <button type="button" title="Baixar original" onClick={() => handleDownloadOriginal(item)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">O</button>
                        <button type="button" title="Baixar preview" onClick={() => handleDownloadPreview(item)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">P</button>
                        <button type="button" title={item.product_id == null ? 'Atribuir / editar' : 'Editar'} onClick={() => openEdit(item)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
                          {item.product_id == null ? 'A' : 'E'}
                        </button>
                        <button type="button" title="Excluir" onClick={() => removeModel(item)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100">X</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}

          {hasMore ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>Carregar mais</Button>
            </div>
          ) : null}
        </section>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? 'Editar modelo 3D' : 'Novo modelo 3D'}
        onClose={() => setModalOpen(false)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveModel}>{editingId ? 'Salvar alteracoes' : 'Criar modelo'}</Button>
          </>
        )}
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={saveModel}>
          <Input
            label="Buscar produto na lista"
            className="md:col-span-2"
            value={modalProductSearch}
            onChange={(event) => setModalProductSearch(event.target.value)}
            placeholder="Digite para filtrar produtos"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Produto vinculado</span>
            <select
              value={form.product_id}
              onChange={(event) => {
                setSortOrderTouched(false);
                setModalSubItemSearch('');
                setForm({ ...form, product_id: event.target.value });
              }}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Nao atribuido</option>
              {filteredModalProductOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </label>
          <Input
            label="Buscar subitem na lista"
            value={modalSubItemSearch}
            onChange={(event) => setModalSubItemSearch(event.target.value)}
            placeholder="Digite para filtrar subitens"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Subitem vinculado (opcional)</span>
            <select
              value={form.sub_item_id}
              onChange={(event) => {
                setSortOrderTouched(false);
                setForm({ ...form, sub_item_id: event.target.value });
              }}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
              disabled={!selectedProduct}
            >
              <option value="">{selectedProduct ? 'Principal do produto' : 'Sem produto vinculado'}</option>
              {filteredModalSubItemOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </label>
          <Input label="Nome" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <Input
            label="Ordem"
            type="number"
            min="1"
            step="1"
            value={form.sort_order}
            onChange={(event) => {
              setSortOrderTouched(true);
              setForm({ ...form, sort_order: event.target.value });
            }}
          />
          <Input label="Preview URL" value={form.preview_file_url} onChange={(event) => setForm({ ...form, preview_file_url: event.target.value })} required />
          <Input label="Original URL" value={form.original_file_url} onChange={(event) => setForm({ ...form, original_file_url: event.target.value })} />
          <Input
            label="Nome arquivo original"
            value={form.original_file_name}
            onChange={(event) => setForm({ ...form, original_file_name: event.target.value })}
            placeholder="Mesmo nome enviado, editavel"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Upload original (.3mf/.stl/.gcode...)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".3mf,.stl,.gcode,.glb,.obj,.step,.stp"
                onChange={(event) => handleOriginalFileSelected(event.target.files?.[0] || null)}
                className="max-w-full text-sm"
              />
              <Button type="button" variant="secondary" loading={uploadingOriginal} onClick={handleUploadOriginal}>Enviar</Button>
            </div>
          </div>
          <Input
            label="Nome arquivo preview"
            value={form.preview_file_name}
            onChange={(event) => setForm({ ...form, preview_file_name: event.target.value })}
            placeholder="Mesmo nome enviado, editavel"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Upload preview (.glb/.stl)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".glb,.stl"
                onChange={(event) => handlePreviewFileSelected(event.target.files?.[0] || null)}
                className="max-w-full text-sm"
              />
              <Button type="button" variant="secondary" loading={uploadingPreview} onClick={handleUploadPreview}>Enviar</Button>
            </div>
          </div>
          <Input label="Largura (mm)" type="number" min="0" step="0.01" value={form.width_mm} onChange={(event) => setForm({ ...form, width_mm: event.target.value, dimensions_source: 'manual' })} />
          <Input label="Altura (mm)" type="number" min="0" step="0.01" value={form.height_mm} onChange={(event) => setForm({ ...form, height_mm: event.target.value, dimensions_source: 'manual' })} />
          <Input label="Profundidade (mm)" type="number" min="0" step="0.01" value={form.depth_mm} onChange={(event) => setForm({ ...form, depth_mm: event.target.value, dimensions_source: 'manual' })} />
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.allow_download} onChange={(event) => setForm({ ...form, allow_download: event.target.checked })} />
            Permitir download
          </label>
          <label className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
            Modelo ativo
          </label>
          <Input label="Descricao" className="md:col-span-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </form>
      </Modal>

      <Modal
        open={detailOpen}
        title="Detalhes do modelo 3D"
        onClose={() => setDetailOpen(false)}
        footer={<Button variant="secondary" onClick={() => setDetailOpen(false)}>Fechar</Button>}
      >
        {detailModel ? (
          <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div className="md:col-span-2">
              {isPreviewImage(detailModel.preview_file_url) ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img
                    src={resolveAssetUrl(detailModel.preview_file_url) || detailModel.preview_file_url}
                    alt={detailModel.name}
                    className="h-[320px] w-full object-contain"
                  />
                </div>
              ) : (
                <Model3DPreview
                  src={resolveAssetUrl(detailModel.preview_file_url) || detailModel.preview_file_url}
                  interactive
                  className="h-[320px]"
                />
              )}
            </div>
            <p><strong>Nome:</strong> {detailModel.name}</p>
            <p><strong>Produto:</strong> {detailModel.product_title || (detailModel.product_id == null ? 'Nao atribuido' : `#${detailModel.product_id}`)}</p>
            <p><strong>Subitem:</strong> {detailModel.sub_item_title || (detailModel.product_id == null ? '-' : 'Principal do produto')}</p>
            <p><strong>Ordem:</strong> {detailModel.sort_order}</p>
            <p className="md:col-span-2"><strong>Descricao:</strong> {detailModel.description || '-'}</p>
            <p className="md:col-span-2"><strong>Dimensoes:</strong> {formatDims(detailModel)} ({detailModel.dimensions_source})</p>
            <p><strong>Original:</strong> {detailModel.original_file_name || '-'}</p>
            <p><strong>Preview:</strong> {detailModel.preview_file_name || '-'}</p>
            <p><strong>Download:</strong> {detailModel.allow_download ? 'Permitido' : 'Bloqueado'}</p>
            <p><strong>Status:</strong> {detailModel.is_active ? 'Ativo' : 'Inativo'}</p>
            <p><strong>Criado em:</strong> {detailModel.created_at ? new Date(detailModel.created_at).toLocaleString('pt-BR') : '-'}</p>
            <p><strong>Atualizado em:</strong> {detailModel.updated_at ? new Date(detailModel.updated_at).toLocaleString('pt-BR') : '-'}</p>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default Admin3DModelsPage;
