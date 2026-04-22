import { API_BASE_URL, buildApiUrl } from '../config/endpoints';
import { trackMetaPixelFromInternalEvent } from './metaPixelService';

const API_BASE = API_BASE_URL;
const ADMIN_TOKEN_KEY = 'admin_token';
const ADMIN_PROFILE_KEY = 'admin_profile';
const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_PROFILE_KEY = 'customer_profile';
const CLIENT_FP_KEY = 'client_fingerprint';
const SESSION_ID_KEY = 'session_id';

const FIELD_LABELS = {
  title: 'Titulo',
  slug: 'Slug',
  short_description: 'Descricao curta',
  full_description: 'Descricao completa',
  cover_image: 'Imagem de capa',
  category_id: 'Categoria',
  manual_price: 'Preco manual',
  lead_time_hours: 'Prazo de producao (horas)',
  available_colors: 'Cores disponiveis',
  secondary_color_pairs: 'Combinacoes de cores',
  publish_to_instagram: 'Publicar no Instagram',
  instagram_caption: 'Legenda do Instagram',
  instagram_hashtags: 'Hashtags do Instagram',
  name: 'Nome',
  email: 'E-mail',
  password: 'Senha',
  role: 'Tipo de usuario',
  sub_items: 'Sub itens',
};

function formatFieldPath(loc = []) {
  const parts = (Array.isArray(loc) ? loc : [])
    .filter((item) => !['body', 'query', 'path', 'response'].includes(String(item)));
  if (!parts.length) return 'Campo';

  const formatted = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (typeof part === 'number') {
      const previous = String(parts[i - 1] || '');
      if (previous === 'sub_items') {
        formatted.push(`Sub item ${part + 1}`);
      } else {
        formatted.push(`Item ${part + 1}`);
      }
      continue;
    }
    formatted.push(FIELD_LABELS[String(part)] || String(part).replaceAll('_', ' '));
  }
  return formatted.join(' > ');
}

function getApiErrorMessage(data, fallback = 'Erro na requisicao') {
  if (!data) return fallback;
  if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
  if (typeof data.message === 'string' && data.message.trim()) return data.message;

  if (Array.isArray(data.detail)) {
    const messages = data.detail
      .map((issue) => {
        if (!issue || typeof issue !== 'object') return '';
        const fieldPath = formatFieldPath(issue.loc);
        const issueType = String(issue.type || '');
        if (issueType.includes('missing')) return `Falta preencher: ${fieldPath}`;
        if (issue.msg) return `${fieldPath}: ${issue.msg}`;
        return '';
      })
      .filter(Boolean);

    if (messages.length) {
      return Array.from(new Set(messages)).slice(0, 8).join(' | ');
    }
  }

  return fallback;
}

function isPreviewMode() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/preview');
}

function previewPath(path, adminPreviewPath) {
  if (!isPreviewMode()) return path;
  return adminPreviewPath || path;
}

function getClientFingerprint() {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(CLIENT_FP_KEY);
    if (existing) return existing;
    const generated = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `fp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_FP_KEY, generated);
    return generated;
  } catch {
    return '';
  }
}

export function getSessionId() {
  if (typeof window === 'undefined') return '';
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const generated = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_ID_KEY, generated);
    return generated;
  } catch {
    return '';
  }
}
async function request(path, options = {}) {
  const fingerprint = getClientFingerprint();
  const sessionId = getSessionId();
  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  const customerToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  const isPreviewRequest = isPreviewMode();
  const authHeader = isPreviewRequest
    ? (adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
    : (customerToken ? { Authorization: `Bearer ${customerToken}` } : {});
  const response = await fetch(buildApiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...authHeader,
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Erro na requisicao'));
  }
  return data;
}

async function adminRequest(path, options = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const fingerprint = getClientFingerprint();
  const sessionId = getSessionId();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  });

  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
    throw new Error(getApiErrorMessage(data, 'Erro na requisicao'));
  }
  return data;
}

export function resolveAssetUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

export function fetchPublicLogo() {
  return request('/public/logo');
}

export function fetchPublicBanners() {
  return request(previewPath('/public/banners', '/admin/publication/preview/banners'));
}

export function fetchPublicSettings() {
  return request('/public/settings');
}

export function fetchPublicMetaPixelConfig() {
  return request('/public/meta-pixel/config');
}

export function fetchPublicHighlightItems() {
  return request(previewPath('/public/highlight-items', '/admin/publication/preview/highlight-items'));
}

export function fetchMostOrderedProducts(limit = 4) {
  const defaultPath = `/public/most-ordered?limit=${encodeURIComponent(limit)}`;
  const previewEndpoint = `/admin/publication/preview/most-ordered?limit=${encodeURIComponent(limit)}`;
  return request(previewPath(defaultPath, previewEndpoint));
}

export function fetchCategories() {
  return request('/categories');
}

export function fetchProducts(category = null) {
  const baseProductsPath = previewPath('/products', '/admin/publication/preview/products');
  if (category) {
    return request(`${baseProductsPath}?category=${encodeURIComponent(category)}`);
  }
  return request(baseProductsPath);
}

export function fetchProduct(slug) {
  return request(previewPath(`/products/${slug}`, `/admin/publication/preview/products/${slug}`));
}

export function trackEvent(payload) {
  const referrer = typeof document !== 'undefined' ? document.referrer || null : null;
  const pageUrl = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null;
  const sourceFromUrl = (() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('utm_source') || params.get('source') || null;
  })();
  const normalizedEventType = (() => {
    const type = String(payload?.event_type || '').trim();
    if (type === 'view_product') return 'product_view';
    if (type === 'click_product') return 'product_click';
    if (type === 'update_cart') return 'update_cart_quantity';
    if (type === 'send_whatsapp') return 'whatsapp_click';
    return type;
  })();
  trackMetaPixelFromInternalEvent({
    ...payload,
    event_type: normalizedEventType,
  });
  return request('/events', {
    method: 'POST',
    body: JSON.stringify({
      session_id: getSessionId(),
      event_type: normalizedEventType,
      product_id: payload?.product_id ?? null,
      category_id: payload?.category_id ?? null,
      user_identifier: payload?.user_identifier ?? null,
      page_url: payload?.page_url ?? pageUrl,
      source_channel: payload?.source_channel ?? sourceFromUrl,
      referrer: payload?.referrer ?? referrer,
      cta_name: payload?.cta_name ?? null,
      metadata_json: payload?.metadata_json || {},
    }),
  });
}

export function fetchProductReviews(productId, params = {}) {
  const search = new URLSearchParams();
  if (params.sort) search.set('sort', params.sort);
  if (params.with_media) search.set('with_media', 'true');
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  const query = search.toString();
  return request(`/products/${productId}/reviews${query ? `?${query}` : ''}`);
}

export function fetchProductReviewSummary(productId) {
  return request(`/products/${productId}/reviews/summary`);
}

export async function createProductReview(productId, payload) {
  const formData = new FormData();
  formData.append('author_name', payload.author_name || '');
  formData.append('rating', String(payload.rating || ''));
  formData.append('comment', payload.comment || '');

  (payload.images || []).forEach((file) => {
    formData.append('images', file);
  });

  if (payload.video) {
    formData.append('video', payload.video);
  }

  const fingerprint = getClientFingerprint();
  const response = await fetch(buildApiUrl(`/products/${productId}/reviews`), {
    method: 'POST',
    headers: fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Erro ao enviar avaliacao'));
  }
  return data;
}

export function validateCoupon(code) {
  return request('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function createOrder(payload) {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createInfinitePayCheckout(payload) {
  return request('/payments/infinitepay/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function checkInfinitePayStatus(payload) {
  return request('/payments/infinitepay/status-check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchPublicInfinitePayReturnStatus(params = {}) {
  const search = new URLSearchParams();
  if (params.order_nsu) search.set('order_nsu', String(params.order_nsu));
  if (params.slug) search.set('slug', String(params.slug));
  if (params.transaction_nsu) search.set('transaction_nsu', String(params.transaction_nsu));
  const query = search.toString();
  return request(`/public/payments/infinitepay/return${query ? `?${query}` : ''}`);
}

export function customerRegister(payload) {
  return request('/customer/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function customerLogin(payload) {
  return request('/customer/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function customerForgotPassword(payload) {
  return request('/customer/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function customerResetPassword(payload) {
  return request('/customer/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchCustomerMe() {
  return customerRequest('/customer/auth/me');
}

export function customerLogout() {
  return customerRequest('/customer/auth/logout', { method: 'POST' });
}

export function linkLegacyCustomerOrders() {
  return customerRequest('/customer/orders/link-legacy', { method: 'POST' });
}

export function fetchCustomerOrders(params = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  const query = search.toString();
  return customerRequest(`/customer/orders${query ? `?${query}` : ''}`);
}

export function fetchCustomerOrderById(orderId) {
  return customerRequest(`/customer/orders/${orderId}`);
}

export function updateCustomerProfile(payload) {
  return customerRequest('/customer/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function changeCustomerPassword(payload) {
  return customerRequest('/customer/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function saveAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function saveAdminSession(session) {
  if (!session?.token) return;
  localStorage.setItem(ADMIN_TOKEN_KEY, session.token);
  if (session.admin) {
    localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(session.admin));
  }
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminProfile() {
  try {
    const raw = localStorage.getItem(ADMIN_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_PROFILE_KEY);
}

export function saveCustomerSession(session) {
  if (!session?.token) return;
  localStorage.setItem(CUSTOMER_TOKEN_KEY, session.token);
  if (session.customer) {
    localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(session.customer));
  }
}

export function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function getCustomerProfile() {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_PROFILE_KEY);
}

export function saveAdminProfile(profile) {
  if (!profile) {
    localStorage.removeItem(ADMIN_PROFILE_KEY);
    return;
  }
  localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(profile));
}

export function adminLogin(payload) {
  return request('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminMe() {
  return adminRequest('/admin/auth/me');
}

export function fetchAdminUsers() {
  return adminRequest('/admin/users');
}

export function createAdminUser(payload) {
  return adminRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminUser(userId, payload) {
  return adminRequest(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updateAdminUserPassword(userId, payload) {
  return adminRequest(`/admin/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function setAdminUserBlocked(userId, isBlocked) {
  return adminRequest(`/admin/users/${userId}/blocked?is_blocked=${isBlocked}`, {
    method: 'PATCH',
  });
}

export function deleteAdminUser(userId) {
  return adminRequest(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

export async function uploadAdminLogo(file) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(buildApiUrl('/admin/logo/upload'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro no upload da logo'));
  }
  return data;
}

export async function uploadAdminBannerImage(file) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(buildApiUrl('/admin/banners/upload-image'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro no upload da imagem'));
  }
  return data;
}

export async function uploadAdminProductImage(file) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(buildApiUrl('/admin/products/upload-image'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro no upload da imagem'));
  }
  return data;
}

export async function uploadAdmin3DOriginalFile(file, fileName = null) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file);
  if (fileName && String(fileName).trim()) {
    formData.append('file_name', String(fileName).trim());
  }
  const response = await fetch(buildApiUrl('/admin/products/3d/upload-original'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro no upload do arquivo original 3D'));
  }
  return data;
}

export async function uploadAdmin3DPreviewFile(file, fileName = null) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file);
  if (fileName && String(fileName).trim()) {
    formData.append('file_name', String(fileName).trim());
  }
  const response = await fetch(buildApiUrl('/admin/products/3d/upload-preview'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro no upload do preview 3D'));
  }
  return data;
}

export function fetchAdminUploadFiles(folder = 'all') {
  const query = new URLSearchParams();
  query.set('folder', folder || 'all');
  return adminRequest(`/admin/uploads/files?${query.toString()}`);
}

export async function uploadAdminFiles(folder, files) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('folder', String(folder || 'products'));
  Array.from(files || []).forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(buildApiUrl('/admin/uploads/upload'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro no upload de arquivos'));
  }
  return data;
}

export async function renameAdminUploadFile(folder, currentName, newName) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('folder', String(folder || 'products'));
  formData.append('current_name', String(currentName || ''));
  formData.append('new_name', String(newName || ''));

  const response = await fetch(buildApiUrl('/admin/uploads/rename'), {
    method: 'PATCH',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro ao renomear arquivo'));
  }
  return data;
}

export async function downloadAdminUploadsZip() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const fingerprint = getClientFingerprint();
  const response = await fetch(buildApiUrl('/admin/uploads/download-all'), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
    },
  });

  if (!response.ok) {
    let detail = 'Erro ao baixar arquivos';
    try {
      const body = await response.json();
      detail = body?.detail || body?.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'uploads-gallery.zip';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function fetchAdminSummary(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  const query = search.toString();
  return adminRequest(`/admin/dashboard/summary${query ? `?${query}` : ''}`);
}

export function fetchAdminAnalyticsSummary() {
  return adminRequest('/admin/analytics/summary');
}

export function fetchAdminAnalyticsFunnel() {
  return adminRequest('/admin/analytics/funnel');
}

export function fetchAdminAnalyticsProducts() {
  return adminRequest('/admin/analytics/products');
}

export function fetchAdminReportSales(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.payment_method) search.set('payment_method', params.payment_method);
  const query = search.toString();
  return adminRequest(`/admin/reports/sales${query ? `?${query}` : ''}`);
}

export async function uploadAdminFavicon(file) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(buildApiUrl('/admin/settings/favicon'), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) localStorage.removeItem(ADMIN_TOKEN_KEY);
    throw new Error(getApiErrorMessage(data, 'Erro no upload do favicon'));
  }
  return data;
}

async function customerRequest(path, options = {}) {
  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  const fingerprint = getClientFingerprint();
  const sessionId = getSessionId();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  });

  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_PROFILE_KEY);
    }
    throw new Error(getApiErrorMessage(data, 'Erro na requisicao'));
  }
  return data;
}

export function removeAdminFavicon() {
  return adminRequest('/admin/settings/favicon', {
    method: 'DELETE',
  });
}

export function fetchAdminReportTopProducts(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.payment_method) search.set('payment_method', params.payment_method);
  const query = search.toString();
  return adminRequest(`/admin/reports/top-products${query ? `?${query}` : ''}`);
}

export function fetchAdminReportLeads(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  const query = search.toString();
  return adminRequest(`/admin/reports/leads${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionSummary(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/summary${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionFunnel(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/funnel${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionProducts(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/products${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionCtas(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/ctas${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionLeads(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  if (params.lead_level) search.set('lead_level', params.lead_level);
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/leads${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionSources(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/sources${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionLocations(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/locations${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionAbandonment(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
  if (params.country) search.set('country', params.country);
  if (params.state) search.set('state', params.state);
  if (params.city) search.set('city', params.city);
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/abandonment${query ? `?${query}` : ''}`);
}

export function fetchAdminSettings() {
  return adminRequest('/admin/settings');
}

export function updateAdminSettings(payload) {
  return adminRequest('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminInstagramSettings() {
  return adminRequest('/admin/integrations/instagram');
}

export function updateAdminInstagramSettings(payload) {
  return adminRequest('/admin/integrations/instagram', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function testAdminInstagramConnection() {
  return adminRequest('/admin/integrations/instagram/test', {
    method: 'POST',
  });
}

export function fetchAdminInfinitePayConfig() {
  return adminRequest('/admin/integrations/infinitepay');
}

export function updateAdminInfinitePayConfig(payload) {
  return adminRequest('/admin/integrations/infinitepay', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function testAdminInfinitePayConfig() {
  return adminRequest('/admin/integrations/infinitepay/test', {
    method: 'POST',
  });
}

export function fetchAdminEmailConfig() {
  return adminRequest('/admin/email/config');
}

export function updateAdminEmailConfig(payload) {
  return adminRequest('/admin/email/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function testAdminEmailSend(payload) {
  return adminRequest('/admin/email/test-send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminEmailTemplates() {
  return adminRequest('/admin/email/templates');
}

export function updateAdminEmailTemplate(templateKey, payload) {
  return adminRequest(`/admin/email/templates/${encodeURIComponent(templateKey)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function previewAdminEmailTemplate(templateKey, payload) {
  return adminRequest(`/admin/email/templates/${encodeURIComponent(templateKey)}/preview`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminEmailLogs(params = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  if (params.status) search.set('status', String(params.status));
  if (params.template_key) search.set('template_key', String(params.template_key));
  if (params.text) search.set('text', String(params.text));
  const query = search.toString();
  return adminRequest(`/admin/email/logs${query ? `?${query}` : ''}`);
}

export function fetchAdminEmailLogById(logId) {
  return adminRequest(`/admin/email/logs/${logId}`);
}

export function fetchAdminLogSettings() {
  return adminRequest('/admin/logs/settings');
}

export function updateAdminLogSettings(payload) {
  return adminRequest('/admin/logs/settings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminLogs(params = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  if (params.level) search.set('level', String(params.level));
  if (params.category) search.set('category', String(params.category));
  if (params.path) search.set('path', String(params.path));
  if (params.admin_user_id) search.set('admin_user_id', String(params.admin_user_id));
  if (params.status_code) search.set('status_code', String(params.status_code));
  if (params.source_system) search.set('source_system', String(params.source_system));
  if (params.text) search.set('text', String(params.text));
  if (params.date_from) search.set('date_from', String(params.date_from));
  if (params.date_to) search.set('date_to', String(params.date_to));
  const query = search.toString();
  return adminRequest(`/admin/logs${query ? `?${query}` : ''}`);
}

export function fetchAdminLogById(logId) {
  return adminRequest(`/admin/logs/${logId}`);
}

export function fetchAdminMetaPixelConfig() {
  return adminRequest('/admin/meta-pixel/config');
}

export function saveAdminMetaPixelConfig(payload) {
  return adminRequest('/admin/meta-pixel/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function testAdminMetaPixelConfig() {
  return adminRequest('/admin/meta-pixel/config/test', {
    method: 'POST',
  });
}

export function fetchAdminHighlightItems() {
  return adminRequest('/admin/highlight-items');
}

export function createAdminHighlightItem(payload) {
  return adminRequest('/admin/highlight-items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminHighlightItem(itemId, payload) {
  return adminRequest(`/admin/highlight-items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function setAdminHighlightItemStatus(itemId, isActive) {
  return adminRequest(`/admin/highlight-items/${itemId}/toggle?is_active=${isActive}`, {
    method: 'PATCH',
  });
}

export function deleteAdminHighlightItem(itemId) {
  return adminRequest(`/admin/highlight-items/${itemId}`, {
    method: 'DELETE',
  });
}

export function fetchAdminAdsConfig() {
  return adminRequest('/admin/ads/config');
}

export function saveAdminAdsConfig(payload) {
  return adminRequest('/admin/ads/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function testAdminAdsConfig() {
  return adminRequest('/admin/ads/config/test', {
    method: 'POST',
  });
}

export function generateAdminAds(payload = {}) {
  return adminRequest('/admin/ads/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminAdsHistory(params = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  const query = search.toString();
  return adminRequest(`/admin/ads/history${query ? `?${query}` : ''}`);
}

export function createAdminProductFromAdCopy(payload) {
  return adminRequest('/admin/ads/create-product-from-copy', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminProducts() {
  return adminRequest('/admin/products');
}

export function fetchAdminProduct3DModels(productId) {
  return adminRequest(`/admin/products/${productId}/3d-models`);
}

export function fetchAdmin3DModels(params = {}) {
  const search = new URLSearchParams();
  if (params.search) search.set('search', params.search);
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.created_from) search.set('created_from', params.created_from);
  if (params.created_to) search.set('created_to', params.created_to);
  if (params.is_active !== undefined && params.is_active !== null && params.is_active !== 'all') {
    search.set('is_active', String(params.is_active));
  }
  if (params.allow_download !== undefined && params.allow_download !== null && params.allow_download !== 'all') {
    search.set('allow_download', String(params.allow_download));
  }
  const query = search.toString();
  return adminRequest(`/admin/3d-models${query ? `?${query}` : ''}`);
}

export function fetchAdmin3DModelById(modelId) {
  return adminRequest(`/admin/3d-models/${modelId}`);
}

export function createAdmin3DModel(payload) {
  return adminRequest('/admin/3d-models', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdmin3DModel(modelId, payload) {
  return adminRequest(`/admin/3d-models/${modelId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteAdmin3DModel(modelId) {
  return adminRequest(`/admin/3d-models/${modelId}`, {
    method: 'DELETE',
  });
}

export function createAdminProduct3DModel(productId, payload) {
  return adminRequest(`/admin/products/${productId}/3d-models`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminProduct3DModel(productId, modelId, payload) {
  return adminRequest(`/admin/products/${productId}/3d-models/${modelId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function setAdminProduct3DModelStatus(productId, modelId, isActive) {
  return adminRequest(`/admin/products/${productId}/3d-models/${modelId}/status?is_active=${isActive}`, {
    method: 'PATCH',
  });
}

export function deleteAdminProduct3DModel(productId, modelId) {
  return adminRequest(`/admin/products/${productId}/3d-models/${modelId}`, {
    method: 'DELETE',
  });
}

export function fetchAdminCategories() {
  return adminRequest('/admin/categories');
}

export function createAdminCategory(payload) {
  return adminRequest('/admin/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminCategory(categoryId, payload) {
  return adminRequest(`/admin/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminCategory(categoryId) {
  return adminRequest(`/admin/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

export function createAdminProduct(payload) {
  return adminRequest('/admin/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminProduct(productId, payload) {
  return adminRequest(`/admin/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function publishAdminProductInstagram(productId) {
  return adminRequest(`/admin/products/${productId}/instagram/publish`, {
    method: 'POST',
  });
}

export function setAdminProductStatus(productId, isActive) {
  return adminRequest(`/admin/products/${productId}/status?is_active=${isActive}`, {
    method: 'PATCH',
  });
}

export function deleteAdminProduct(productId) {
  return adminRequest(`/admin/products/${productId}`, {
    method: 'DELETE',
  });
}

export function fetchAdminOrders() {
  return adminRequest('/admin/orders');
}

export function fetchAdminReviews(params = {}) {
  const search = new URLSearchParams();
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.status) search.set('status', params.status);
  if (params.rating) search.set('rating', String(params.rating));
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  const query = search.toString();
  return adminRequest(`/admin/reviews${query ? `?${query}` : ''}`);
}

export function approveAdminReview(reviewId) {
  return adminRequest(`/admin/reviews/${reviewId}/approve`, {
    method: 'PATCH',
  });
}

export function rejectAdminReview(reviewId) {
  return adminRequest(`/admin/reviews/${reviewId}/reject`, {
    method: 'PATCH',
  });
}

export function deleteAdminReview(reviewId) {
  return adminRequest(`/admin/reviews/${reviewId}`, {
    method: 'DELETE',
  });
}

export function fetchAdminCoupons() {
  return adminRequest('/admin/coupons');
}

export function createAdminCoupon(payload) {
  return adminRequest('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminCoupon(couponId, payload) {
  return adminRequest(`/admin/coupons/${couponId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function setAdminCouponStatus(couponId, isActive) {
  return adminRequest(`/admin/coupons/${couponId}/status?is_active=${isActive}`, {
    method: 'PATCH',
  });
}

export function deleteAdminCoupon(couponId) {
  return adminRequest(`/admin/coupons/${couponId}`, {
    method: 'DELETE',
  });
}

export function fetchAdminPromotions() {
  return adminRequest('/admin/promotions');
}

export function createAdminPromotion(payload) {
  return adminRequest('/admin/promotions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminPromotion(promotionId, payload) {
  return adminRequest(`/admin/promotions/${promotionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function setAdminPromotionStatus(promotionId, isActive) {
  return adminRequest(`/admin/promotions/${promotionId}/toggle?is_active=${isActive}`, {
    method: 'PATCH',
  });
}

export function deleteAdminPromotion(promotionId) {
  return adminRequest(`/admin/promotions/${promotionId}`, {
    method: 'DELETE',
  });
}

export function fetchAdminBanners() {
  return adminRequest('/admin/banners');
}

export function createAdminBanner(payload) {
  return adminRequest('/admin/banners', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateAdminBanner(id, payload) {
  return adminRequest(`/admin/banners/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminBanner(id) {
  return adminRequest(`/admin/banners/${id}`, {
    method: 'DELETE',
  });
}

export function fetchAdminPublicationPending() {
  return adminRequest('/admin/publication/pending');
}

export function fetchAdminPublicationPreviewData() {
  return adminRequest('/admin/publication/preview-data');
}

export function publishAllAdminDrafts() {
  return adminRequest('/admin/publication/publish', {
    method: 'POST',
  });
}

export function publishAdminDraft(entityType, entityId) {
  return adminRequest(`/admin/publication/publish/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
    method: 'POST',
  });
}

export function discardAdminDraft(entityType, entityId) {
  return adminRequest(`/admin/publication/discard/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
    method: 'POST',
  });
}

export function fetchAdminDatabaseTables() {
  return adminRequest('/admin/database/tables');
}

export function fetchAdminDatabaseQueryLogs(params = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.page_size) search.set('page_size', String(params.page_size));
  const query = search.toString();
  return adminRequest(`/admin/database/query/logs${query ? `?${query}` : ''}`);
}

export function executeAdminDatabaseQuery(payload) {
  return adminRequest('/admin/database/query', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function downloadAdminDatabaseExport(path, filename) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const fingerprint = getClientFingerprint();
  const response = await fetch(buildApiUrl(path), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
    },
  });

  if (!response.ok) {
    let detail = 'Erro ao baixar arquivo';
    try {
      const body = await response.json();
      detail = body?.detail || body?.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  const basicMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
  const headerFileName = utf8Match?.[1]
    ? decodeURIComponent(utf8Match[1])
    : basicMatch?.[1];

  const blob = await response.blob();
  const inferExtension = () => {
    const mime = String(blob.type || '').toLowerCase();
    if (mime.includes('stl')) return '.stl';
    if (mime.includes('gltf') || mime.includes('glb')) return '.glb';
    if (mime.includes('model/obj') || mime.includes('text/plain')) return '.obj';
    if (mime.includes('step')) return '.step';
    if (mime.includes('3mf')) return '.3mf';
    if (mime.includes('gcode')) return '.gcode';
    if (mime.includes('zip')) return '.zip';
    if (mime.includes('octet-stream')) return '';
    return '';
  };
  const normalizeName = (rawName) => {
    const value = String(rawName || '').trim();
    if (!value) return 'arquivo';
    if (/\.[a-z0-9]{2,10}$/i.test(value)) return value;
    const ext = inferExtension();
    return `${value}${ext}`;
  };
  const finalName = normalizeName(headerFileName || filename);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = finalName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadAdmin3DModelOriginal(modelId, filename = null) {
  const fallbackName = String(filename || '').trim() || `modelo_${modelId}_original`;
  return downloadAdminDatabaseExport(`/admin/3d-models/${modelId}/download/original`, fallbackName);
}

export async function downloadAdmin3DModelPreview(modelId, filename = null) {
  const fallbackName = String(filename || '').trim() || `modelo_${modelId}_preview`;
  return downloadAdminDatabaseExport(`/admin/3d-models/${modelId}/download/preview`, fallbackName);
}

export async function downloadAllAdmin3DModels(params = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const fingerprint = getClientFingerprint();
  const search = new URLSearchParams();
  if (params.search) search.set('search', params.search);
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.created_from) search.set('created_from', params.created_from);
  if (params.created_to) search.set('created_to', params.created_to);
  if (params.is_active !== undefined && params.is_active !== null && params.is_active !== 'all') {
    search.set('is_active', String(params.is_active));
  }
  if (params.allow_download !== undefined && params.allow_download !== null && params.allow_download !== 'all') {
    search.set('allow_download', String(params.allow_download));
  }
  if (params.include_preview !== undefined) {
    search.set('include_preview', String(Boolean(params.include_preview)));
  }
  const query = search.toString();
  const response = await fetch(buildApiUrl(`/admin/3d-models/download/all${query ? `?${query}` : ''}`), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
    },
  });

  if (!response.ok) {
    let detail = 'Erro ao baixar modelos 3D';
    try {
      const body = await response.json();
      detail = body?.detail || body?.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  const contentDisposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  const fileName = fileNameMatch?.[1] || 'modelos_3d.zip';
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

