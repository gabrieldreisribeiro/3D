import { Link } from 'react-router-dom';
import RatingPill from './RatingPill';
import Button from './ui/Button';

function ProductCard({ product, onAdd }) {
  const price = Number(product.final_price ?? product.price ?? 0);

  return (
    <article className="product-card-pro">
      <div className="product-card-image" style={{ backgroundImage: `url(${product.cover_image})` }} />
      <div className="product-card-body">
        <h3>{product.title}</h3>
        <p>{product.short_description}</p>
        <div className="product-card-meta">
          <RatingPill rating={product.rating_average} count={product.rating_count} />
          <strong>R$ {price.toFixed(2)}</strong>
        </div>
        <div className="product-card-actions">
          <Link to={`/product/${product.slug}`}>
            <Button variant="secondary">Detalhes</Button>
          </Link>
          <Button onClick={() => onAdd(product)}>Adicionar</Button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
