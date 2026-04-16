import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuantitySelector from '../components/QuantitySelector';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import SectionHeader from '../components/ui/SectionHeader';
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

  const getItemPrice = (item) => Number(item.final_price ?? item.price ?? 0);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const order = await createOrder({
        items: items.map((item) => ({ slug: item.slug, quantity: item.quantity })),
        coupon: coupon?.code || null,
      });

      const number = import.meta.env.VITE_WHATSAPP_NUMBER;
      const lines = items.map((item) => `${item.quantity}x ${item.title} - R$ ${getItemPrice(item).toFixed(2)}`).join('\n');
      const message = `Ola! Novo pedido:\n${lines}\nSubtotal: R$ ${subtotal.toFixed(2)}\nDesconto: R$ ${discount.toFixed(2)}\nTotal: R$ ${total.toFixed(2)}\nCodigo do pedido: ${order.id}`;
      clearCart();
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      alert(error.message || 'Erro ao finalizar pedido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="container cart-page-pro">
      <SectionHeader title="Carrinho" subtitle="Revise os itens antes de concluir" />

      {items.length === 0 ? (
        <EmptyState
          title="Seu carrinho esta vazio"
          description="Adicione produtos da vitrine para continuar"
          action={<Button onClick={() => navigate('/')}>Voltar para loja</Button>}
        />
      ) : (
        <div className="cart-layout-pro">
          <div className="cart-items-pro">
            {items.map((item) => (
              <Card key={item.slug} className="cart-item-pro">
                <div className="cart-item-image" style={{ backgroundImage: `url(${item.cover_image})` }} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.short_description}</p>
                  <div className="cart-item-controls">
                    <QuantitySelector value={item.quantity} onChange={(value) => updateQuantity(item.slug, value)} />
                    <Button variant="ghost" onClick={() => removeItem(item.slug)}>
                      Remover
                    </Button>
                  </div>
                </div>
                <strong className="cart-item-price">R$ {getItemPrice(item).toFixed(2)}</strong>
              </Card>
            ))}
          </div>

          <Card className="cart-summary-pro">
            <h3>Resumo do pedido</h3>
            <div className="summary-line">
              <span>Subtotal</span>
              <strong>R$ {subtotal.toFixed(2)}</strong>
            </div>
            <div className="summary-line">
              <span>Desconto</span>
              <strong>R$ {discount.toFixed(2)}</strong>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <strong>R$ {total.toFixed(2)}</strong>
            </div>

            <Input label="Cupom" value={code} onChange={(event) => setCode(event.target.value)} placeholder="DESCONTO10" />
            <Button variant="secondary" onClick={() => applyCoupon(code)}>
              Aplicar cupom
            </Button>
            {couponMessage ? <small className="helper-text">{couponMessage}</small> : null}

            <Button loading={loading} onClick={handleCheckout}>
              Finalizar pedido
            </Button>
          </Card>
        </div>
      )}
    </section>
  );
}

export default CartPage;
