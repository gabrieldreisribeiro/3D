import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ImageGallery from '../components/ImageGallery';
import RatingPill from '../components/RatingPill';
import QuantitySelector from '../components/QuantitySelector';
import { fetchProduct, fetchProducts } from '../services/api';
import { useCart } from '../services/cart';

function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    setLoading(true);
    fetchProduct(slug)
      .then(setProduct)
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
    fetchProducts().then((items) => setRelated(items.slice(0, 3)));
  }, [slug, navigate]);

  if (loading) {
    return <div className="loading-state">Carregando produto...</div>;
  }

  if (!product) {
    return <div className="empty-state">Produto não encontrado.</div>;
  }

  const handleBuyNow = () => {
    const number = import.meta.env.VITE_WHATSAPP_NUMBER;
    const message = `Olá! Gostaria de comprar ${quantity}x ${product.title}.\nPreço unitário: R$ ${product.price.toFixed(2)}\nTotal: R$ ${(product.price * quantity).toFixed(2)}.`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <section className="product-page container">
      <div className="product-grid-page">
        <ImageGallery images={[product.cover_image, ...product.images]} />
        <div className="product-summary">
          <span className="eyebrow">Produto</span>
          <h1>{product.title}</h1>
          <RatingPill rating={product.rating_average} count={product.rating_count} />
          <p className="product-tagline">{product.short_description}</p>
          <div className="product-meta">
            <div>
              <strong>R$ {product.price.toFixed(2)}</strong>
            </div>
            <div className="detail-badge">Disponível</div>
          </div>
          <div className="detail-actions">
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button className="button button-primary" onClick={() => addToCart(product, quantity)}>
              Adicionar ao carrinho
            </button>
          </div>
          <button className="button button-ghost" onClick={handleBuyNow}>
            Comprar pelo WhatsApp
          </button>
          <div className="detail-section">
            <h2>Descrição</h2>
            <p>{product.full_description}</p>
          </div>
          <div className="detail-section review-box">
            <h2>Avaliações</h2>
            <p>Perfeito para projetos que exigem acabamento premium e detalhe técnico.</p>
            <ul>
              <li>Acabamento profissional</li>
              <li>Pronto para venda ou apresentação</li>
              <li>Design contemporâneo</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="related-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">Recomendado</span>
            <h2>Produtos relacionados</h2>
          </div>
        </div>
        <div className="related-grid">
          {related.map((item) => (
            <article key={item.id} className="related-card">
              <button className="related-image" onClick={() => navigate(`/product/${item.slug}`)} style={{ backgroundImage: `url(${item.cover_image})` }} />
              <div>
                <h3>{item.title}</h3>
                <span>R$ {item.price.toFixed(2)}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ProductPage;
