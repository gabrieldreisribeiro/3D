import { useState } from 'react';
import { Link } from 'react-router-dom';
import RatingPill from './RatingPill';
import Button from './ui/Button';

function ProductCard({ product, onAdd, highlightLabel = '', compact = false }) {
  const [isAdding, setIsAdding] = useState(false);
  const price = Number(product.final_price ?? product.price ?? 0);
  const hasSubItems = (product.sub_items || []).length > 0;
  const ratingCount = Number(product.rating_count || 0);
  const ratingAverage = ratingCount > 0 ? Number(product.rating_average || 0) : 0;
  const badgeLabel = highlightLabel || (hasSubItems ? 'Personalizado' : '');

  const handleAdd = async () => {
    if (isAdding) return;
    const startAt = Date.now();
    setIsAdding(true);
    try {
      await Promise.resolve(onAdd(product));
    } finally {
      const elapsed = Date.now() - startAt;
      const delay = Math.max(0, 380 - elapsed);
      window.setTimeout(() => setIsAdding(false), delay);
    }
  };

  return (
    <article className={`product-card-pro ${compact ? 'product-card-pro-compact' : ''}`}>
      <Link to={`/product/${product.slug}`} className="product-card-image-link">
        <div className="product-card-image-wrap">
          <div className="product-card-image" style={{ backgroundImage: `url(${product.cover_image})` }} />
          {badgeLabel ? <span className="product-card-badge">{badgeLabel}</span> : null}
        </div>
      </Link>

      <div className="product-card-body">
        <Link to={`/product/${product.slug}`} className="product-card-title-link">
          <h3>{product.title}</h3>
        </Link>
        <p className="product-card-desc">{product.short_description}</p>

        <div className="product-card-rating-row">
          <RatingPill rating={ratingAverage} count={ratingCount} />
        </div>

        <div className="product-card-price-row">
          <strong className={hasSubItems ? 'is-custom' : ''}>{hasSubItems ? 'Personalizado' : `R$ ${price.toFixed(2)}`}</strong>
        </div>

        {/* <p className="product-card-installments">em ate 12x sem juros</p> */}

        <div className="product-card-actions">
          {hasSubItems ? (
            <Link to={`/product/${product.slug}`}>
              <Button className="product-card-cta">Monte o seu</Button>
            </Link>
          ) : (
            <Button className="product-card-cta" loading={isAdding} loadingText="Adicionando..." onClick={handleAdd}>
              Adicionar ao carrinho
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
