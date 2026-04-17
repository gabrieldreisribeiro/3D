const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_URL || 'http://localhost:8000');
export const WHATSAPP_NUMBER = String(import.meta.env.VITE_WHATSAPP_NUMBER || '').trim();

export const API_ENDPOINTS = {
  public: {
    logo: '/public/logo',
    banners: '/public/banners',
    settings: '/public/settings',
  },
  categories: '/categories',
  products: '/products',
  coupons: {
    validate: '/coupons/validate',
  },
  orders: '/orders',
  admin: {
    login: '/admin/auth/login',
    logoUpload: '/admin/logo/upload',
    settings: '/admin/settings',
    summary: '/admin/dashboard/summary',
    products: '/admin/products',
    orders: '/admin/orders',
    coupons: '/admin/coupons',
    banners: '/admin/banners',
    bannerUploadImage: '/admin/banners/upload-image',
    productUploadImage: '/admin/products/upload-image',
  },
};

export function buildApiUrl(path) {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
