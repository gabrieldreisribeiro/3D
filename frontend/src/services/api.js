const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Erro na requisição');
  }
  return data;
}

export function fetchProducts() {
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
