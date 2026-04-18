import { API_BASE_URL, buildApiUrl } from '../config/endpoints';

const API_BASE = API_BASE_URL;
const ADMIN_TOKEN_KEY = 'admin_token';
const CLIENT_FP_KEY = 'client_fingerprint';
const SESSION_ID_KEY = 'session_id';

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
  const response = await fetch(buildApiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Erro na requisicao');
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
    throw new Error(data?.detail || data?.message || 'Erro na requisicao');
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
  return request('/public/banners');
}

export function fetchPublicSettings() {
  return request('/public/settings');
}

export function fetchMostOrderedProducts(limit = 4) {
  return request(`/public/most-ordered?limit=${encodeURIComponent(limit)}`);
}

export function fetchCategories() {
  return request('/categories');
}

export function fetchProducts(category = null) {
  if (category) {
    return request(`/products?category=${encodeURIComponent(category)}`);
  }
  return request('/products');
}

export function fetchProduct(slug) {
  return request(`/products/${slug}`);
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
    throw new Error(data.detail || data.message || 'Erro ao enviar avaliacao');
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

export function saveAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function adminLogin(payload) {
  return request('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
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
    throw new Error(data.detail || data.message || 'Erro no upload da logo');
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
    throw new Error(data.detail || data.message || 'Erro no upload da imagem');
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
    throw new Error(data.detail || data.message || 'Erro no upload da imagem');
  }
  return data;
}

export function fetchAdminSummary() {
  return adminRequest('/admin/dashboard/summary');
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
  const query = search.toString();
  return adminRequest(`/admin/reports/sales${query ? `?${query}` : ''}`);
}

export function fetchAdminReportTopProducts(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
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
  const query = search.toString();
  return adminRequest(`/admin/leads-conversion/sources${query ? `?${query}` : ''}`);
}

export function fetchAdminLeadsConversionAbandonment(params = {}) {
  const search = new URLSearchParams();
  if (params.date_from) search.set('date_from', params.date_from);
  if (params.date_to) search.set('date_to', params.date_to);
  if (params.category_id) search.set('category_id', String(params.category_id));
  if (params.product_id) search.set('product_id', String(params.product_id));
  if (params.source_channel) search.set('source_channel', params.source_channel);
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

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

