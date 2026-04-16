import { Link } from 'react-router-dom';
import RatingPill from './RatingPill';

function ProductCard({ product, onAdd }) {
  return (
    <article className="product-card">
      <div className="product-image" style={{ backgroundImage: `url(${product.cover_image})` }} />
      <div className="product-body">
        <div>
          <h3>{product.title}</h3>
          <p>{product.short_description}</p>
        </div>
        <div className="product-details">
          <RatingPill rating={product.rating_average} count={product.rating_count} />
          <strong className="product-price">R$ {product.price.toFixed(2)}</strong>
        </div>
        <div className="product-actions">
          <Link className="button button-secondary" to={`/product/${product.slug}`}>
            Ver detalhes
          </Link>
          <button className="button button-primary" onClick={() => onAdd(product)}>
            Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
