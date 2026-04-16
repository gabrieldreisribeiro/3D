import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchProducts } from '../services/api';
import { useCart } from '../services/cart';

function HomePage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section className="home-page container">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">Impressão 3D Premium</span>
          <h1>Modelos sofisticados para ambientes criativos e projetos profissionais</h1>
          <p>Descubra peças com acabamento pensado para designers, arquitetura e entusiastas do 3D.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/cart">
              Ver carrinho
            </Link>
            <Link className="button button-secondary" to="#produtos">
              Ver produtos
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card">
            <span>Top peça</span>
            <strong>Estatueta Orgânica</strong>
          </div>
        </div>
      </div>

      <div className="highlight-grid">
        <article>
          <h2>Design pensado para venda</h2>
          <p>Texturas limpas, formas modernas e coleção preparada para impressionar clientes.</p>
        </article>
        <article>
          <h2>Produção local</h2>
          <p>Entrega rápida e montagem segura para peças de alto valor.</p>
        </article>
        <article>
          <h2>Acabamento premium</h2>
          <p>Opções de acabamento detalhado em cada modelo.</p>
        </article>
      </div>

      <div className="section-header" id="produtos">
        <div>
          <span className="eyebrow">Coleção em destaque</span>
          <h2>Produtos selecionados para seu próximo projeto</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">Carregando produtos...</div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={addToCart} />
          ))}
        </div>
      )}
    </section>
  );
}

export default HomePage;
