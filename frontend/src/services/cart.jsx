import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { validateCoupon } from './api';

const CartContext = createContext();

function toNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getBaseItemPrice(item) {
  return toNumber(item.base_unit_price ?? item.final_price ?? item.price ?? 0);
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  return color || null;
}

function normalizeSelectedSubItems(selectedSubItems = []) {
  return selectedSubItems
    .map((item, index) => {
      const quantity = Math.max(1, Math.floor(toNumber(item.quantity || 1)));
      const unitPrice = toNumber(item.unit_price ?? item.final_price ?? item.price ?? 0);
      const key = item.id ?? item.slug ?? item.title ?? `sub-item-${index}`;
      return {
        id: item.id ?? null,
        slug: item.slug ?? null,
        title: item.title || `Subitem ${index + 1}`,
        image_url: item.image_url || '',
        unit_price: unitPrice,
        quantity,
        selected_color: normalizeColor(item.selected_color),
        selected_secondary_color: normalizeColor(item.selected_secondary_color),
        lead_time_hours: toNumber(item.lead_time_hours),
        line_total: unitPrice * quantity,
        key: String(key),
      };
    })
    .filter((item) => item.quantity > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}

function createSelectionSignature(selectedSubItems) {
  if (!selectedSubItems.length) return 'base';
  return selectedSubItems
    .map((item) => `${item.key}:${item.quantity}:${item.selected_color || '-'}:${item.selected_secondary_color || '-'}`)
    .join('|');
}

function getItemPrice(item) {
  if (item.unit_price != null) {
    return toNumber(item.unit_price);
  }

  if (Array.isArray(item.selected_sub_items) && item.selected_sub_items.length > 0) {
    const selectedSubItemsTotal = item.selected_sub_items.reduce((sum, subItem) => {
      const quantity = Math.max(1, Math.floor(toNumber(subItem.quantity || 1)));
      return sum + toNumber(subItem.unit_price ?? subItem.final_price ?? subItem.price ?? 0) * quantity;
    }, 0);
    return getBaseItemPrice(item) + selectedSubItemsTotal;
  }

  return Number(item.final_price ?? item.price ?? 0);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cart_items')) || [];
    } catch {
      return [];
    }
  });
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');

  useEffect(() => {
    localStorage.setItem('cart_items', JSON.stringify(items));
  }, [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0),
    [items]
  );

  const discount = useMemo(
    () => {
      if (!coupon) return 0;
      if (coupon.type === 'percent') return (subtotal * coupon.value) / 100;
      if (coupon.type === 'fixed') return Math.min(coupon.value, subtotal);
      return 0;
    },
    [coupon, subtotal]
  );

  const total = subtotal - discount;

  const addToCart = (product, quantity = 1, options = {}) => {
    const safeQuantity = Math.max(1, Math.floor(toNumber(quantity || 1)));
    const normalizedSubItems = normalizeSelectedSubItems(options.selectedSubItems || []);
    const selectedColor = normalizeColor(options.selectedColor);
    const selectedSecondaryColor = normalizeColor(options.selectedSecondaryColor);
    const baseUnitPrice = getBaseItemPrice(product);
    const selectedSubItemsTotal = normalizedSubItems.reduce((sum, item) => sum + item.line_total, 0);
    const unitPrice = normalizedSubItems.length > 0 ? baseUnitPrice + selectedSubItemsTotal : baseUnitPrice;
    const signature = createSelectionSignature(normalizedSubItems);
    const colorSignature = `${selectedColor || '-'}:${selectedSecondaryColor || '-'}`;
    const cartKey = `${product.slug}::${colorSignature}::${signature}`;
    const nextItem = {
      ...product,
      quantity: safeQuantity,
      cart_key: cartKey,
      base_unit_price: baseUnitPrice,
      selected_color: selectedColor,
      selected_secondary_color: selectedSecondaryColor,
      selected_sub_items: normalizedSubItems,
      unit_price: unitPrice,
    };

    setItems((current) => {
      const exists = current.find((item) => (item.cart_key || `${item.slug}::base`) === cartKey);
      if (exists) {
        return current.map((item) =>
          (item.cart_key || `${item.slug}::base`) === cartKey
            ? { ...item, quantity: item.quantity + safeQuantity }
            : item
        );
      }
      return [...current, nextItem];
    });
  };

  const updateQuantity = (cartKey, quantity) => {
    setItems((current) =>
      current
        .map((item) => {
          const itemKey = item.cart_key || `${item.slug}::base`;
          return itemKey === cartKey ? { ...item, quantity } : item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (cartKey) => {
    setItems((current) => current.filter((item) => (item.cart_key || `${item.slug}::base`) !== cartKey));
  };

  const clearCart = () => {
    setItems([]);
    setCoupon(null);
    setCouponMessage('');
  };

  const applyCoupon = async (code) => {
    if (!code) {
      setCoupon(null);
      setCouponMessage('Informe um cupom valido');
      return;
    }
    try {
      const result = await validateCoupon(code);
      setCoupon(result);
      if (result.type === 'percent') {
        setCouponMessage(`Cupom aplicado: ${result.value}%`);
      } else {
        setCouponMessage(`Cupom aplicado: R$ ${Number(result.value).toFixed(2)}`);
      }
    } catch (error) {
      setCoupon(null);
      setCouponMessage(error.message || 'Cupom invalido');
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        coupon,
        couponMessage,
        applyCoupon,
        subtotal,
        discount,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
