import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProductGallery from '../components/ProductGallery';
import ProductCard from '../components/ProductCard';
import QuantitySelector from '../components/QuantitySelector';
import PriceBlock from '../components/ui/PriceBlock';
import SectionHeader from '../components/ui/SectionHeader';
import Button from '../components/ui/Button';
import { fetchProduct, fetchProducts } from '../services/api';
import { useCart } from '../services/cart';

function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    setLoading(true);
    fetchProduct(slug)
      .then((item) => {
        setProduct(item);
        setSelectedImage(0);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));

    fetchProducts().then((items) => setRelated(items.filter((item) => item.slug !== slug).slice(0, 3)));
  }, [slug, navigate]);

  if (loading) {
    return <div className="loading-state-pro container">Carregando produto...</div>;
  }

  if (!product) {
    return <div className="empty-state-pro container">Produto nao encontrado.</div>;
  }

  const galleryImages = [product.cover_image, ...(product.images || [])];
  const finalPrice = Number(product.final_price ?? product.price ?? 0);

  return (
    <section className="container product-page-pro">
      <div className="product-layout-pro">
        <ProductGallery images={galleryImages} selected={selectedImage} onSelect={setSelectedImage} />

        <div className="product-info-pro">
          <span className="eyebrow">Produto</span>
          <h1>{product.title}</h1>
          <p>{product.short_description}</p>
          <PriceBlock price={finalPrice} helper="Preco unitario" />

          <div className="product-buy-actions">
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <Button onClick={() => addToCart(product, quantity)}>Adicionar ao carrinho</Button>
            <Button variant="secondary" onClick={() => navigate('/cart')}>
              Comprar agora
            </Button>
          </div>

          <div className="detail-card">
            <h3>Descricao completa</h3>
            <p>{product.full_description}</p>
          </div>
        </div>
      </div>

      <section className="related-products">
        <SectionHeader title="Relacionados" subtitle="Sugestoes para complementar seu pedido" />
        <div className="product-grid-pro">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} onAdd={addToCart} />
          ))}
        </div>
      </section>
    </section>
  );
}

export default ProductPage;
