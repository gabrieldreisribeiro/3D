import { API_BASE_URL, buildApiUrl } from '../config/endpoints';

const API_BASE = API_BASE_URL;
const ADMIN_TOKEN_KEY = 'admin_token';
const CLIENT_FP_KEY = 'client_fingerprint';

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

async function request(path, options = {}) {
  const fingerprint = getClientFingerprint();
  const response = await fetch(buildApiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}) },
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
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fingerprint ? { 'X-Client-Fingerprint': fingerprint } : {}),
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

export function fetchAdminSettings() {
  return adminRequest('/admin/settings');
}

export function updateAdminSettings(payload) {
  return adminRequest('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function fetchAdminProducts() {
  return adminRequest('/admin/products');
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

export function setAdminProductStatus(productId, isActive) {
  return adminRequest(`/admin/products/${productId}/status?is_active=${isActive}`, {
    method: 'PATCH',
  });
}

export function fetchAdminOrders() {
  return adminRequest('/admin/orders');
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
