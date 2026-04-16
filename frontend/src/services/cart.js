import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { validateCoupon } from './api';

const CartContext = createContext();

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
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const discount = useMemo(
    () => (coupon ? (subtotal * coupon.value) / 100 : 0),
    [coupon, subtotal]
  );

  const total = subtotal - discount;

  const addToCart = (product, quantity = 1) => {
    setItems((current) => {
      const exists = current.find((item) => item.slug === product.slug);
      if (exists) {
        return current.map((item) =>
          item.slug === product.slug
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...current, { ...product, quantity }];
    });
  };

  const updateQuantity = (slug, quantity) => {
    setItems((current) =>
      current
        .map((item) => (item.slug === slug ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (slug) => {
    setItems((current) => current.filter((item) => item.slug !== slug));
  };

  const clearCart = () => {
    setItems([]);
    setCoupon(null);
    setCouponMessage('');
  };

  const applyCoupon = async (code) => {
    if (!code) {
      setCoupon(null);
      setCouponMessage('Informe um cupom válido');
      return;
    }
    try {
      const result = await validateCoupon(code);
      setCoupon(result);
      setCouponMessage(`Cupom aplicado: ${result.value}%`);
    } catch (error) {
      setCoupon(null);
      setCouponMessage(error.message || 'Cupom inválido');
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
