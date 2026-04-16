import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuantitySelector from '../components/QuantitySelector';
import { createOrder } from '../services/api';
import { useCart } from '../services/cart';

function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    coupon,
    couponMessage,
    applyCoupon,
    subtotal,
    discount,
    total,
    clearCart,
  } = useCart();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const order = await createOrder({
        items: items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
        coupon: coupon?.code || null,
      });

      const number = import.meta.env.VITE_WHATSAPP_NUMBER;
      const lines = items.map((item) => `${item.quantity}x ${item.title} - R$ ${item.price.toFixed(2)}`).join('\n');
      const message = `Olá! Novo pedido:\n${lines}\nSubtotal: R$ ${subtotal.toFixed(2)}\nDesconto: R$ ${discount.toFixed(2)}\nTotal: R$ ${total.toFixed(2)}\nCódigo do pedido: ${order.id}`;
      clearCart();
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      alert(error.message || 'Erro ao finalizar pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="cart-page container">
      <div className="section-header">
        <div>
          <span className="eyebrow">Seu carrinho</span>
          <h1>Revisão do pedido</h1>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>Seu carrinho está vazio.</p>
          <button className="button button-primary" onClick={() => navigate('/')}>Voltar à loja</button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item) => (
              <div key={item.slug} className="cart-item-card">
                <div className="cart-item-image" style={{ backgroundImage: `url(${item.cover_image})` }} />
                <div className="cart-item-body">
                  <strong>{item.title}</strong>
                  <p>{item.short_description}</p>
                  <div className="cart-item-footer">
                    <QuantitySelector value={item.quantity} onChange={(value) => updateQuantity(item.slug, value)} />
                    <button className="button button-ghost small" onClick={() => removeItem(item.slug)}>
                      Remover
                    </button>
                  </div>
                </div>
                <div className="cart-item-price">R$ {item.price.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <aside className="cart-summary">
            <div className="summary-panel">
              <h2>Resumo do pedido</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>R$ {subtotal.toFixed(2)}</strong>
              </div>
              <div className="summary-row">
                <span>Desconto</span>
                <strong>R$ {discount.toFixed(2)}</strong>
              </div>
              <div className="summary-row total-row">
                <span>Total</span>
                <strong>R$ {total.toFixed(2)}</strong>
              </div>
              <div className="coupon-block">
                <label htmlFor="coupon">Cupom</label>
                <div className="coupon-field">
                  <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder="DESCONTO10" />
                  <button className="button button-secondary" onClick={() => applyCoupon(code)}>
                    Aplicar
                  </button>
                </div>
                {couponMessage && <p className="coupon-message">{couponMessage}</p>}
              </div>
              <button className="button button-primary wide" onClick={handleCheckout} disabled={loading}>
                {loading ? 'Finalizando...' : 'Finalizar pedido'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default CartPage;
