import { useState } from 'react';
import { Link } from 'react-router-dom';
import RatingPill from './RatingPill';
import Button from './ui/Button';
import { resolveAssetUrl, trackEvent } from '../services/api';

function ProductCard({ product, onAdd, highlightLabel = '', compact = false }) {
  const [isAdding, setIsAdding] = useState(false);
  const price = Number(product.final_price ?? product.price ?? 0);
  const originalPrice = Number(product.original_price ?? product.price ?? product.final_price ?? 0);
  const coverImageUrl = resolveAssetUrl(product.cover_image) || product.cover_image || '';
  const hasSubItems = (product.sub_items || []).length > 0;
  const isOnSale = Boolean(product.is_on_sale && originalPrice > price);
  const ratingCount = Number(product.rating_count || 0);
  const ratingAverage = ratingCount > 0 ? Number(product.rating_average || 0) : 0;
  const badgeLabel = product?.promotion_badge || highlightLabel || (hasSubItems ? 'Personalizado' : '');
  const handleProductClick = () => {
    trackEvent({
      event_type: 'product_click',
      product_id: product?.id ?? null,
      category_id: product?.category_id ?? null,
      cta_name: 'product_card_click',
      metadata_json: {
        slug: product?.slug || null,
        source: compact ? 'compact_card' : 'product_card',
      },
    }).catch(() => {});
  };

  const handleAdd = async () => {
    if (isAdding) return;
    const startAt = Date.now();
    setIsAdding(true);
    try {
      trackEvent({
        event_type: 'cta_click',
        product_id: product?.id ?? null,
        category_id: product?.category_id ?? null,
        cta_name: 'add_to_cart_button',
        metadata_json: { slug: product?.slug || null, source: 'product_card' },
      }).catch(() => {});
      await Promise.resolve(onAdd(product));
    } finally {
      const elapsed = Date.now() - startAt;
      const delay = Math.max(0, 380 - elapsed);
      window.setTimeout(() => setIsAdding(false), delay);
    }
  };

  return (
    <article className={`product-card-pro ${compact ? 'product-card-pro-compact' : ''}`}>
      <Link to={`/product/${product.slug}`} className="product-card-image-link" onClick={handleProductClick}>
        <div className="product-card-image-wrap">
          <div className="product-card-image" style={{ backgroundImage: `url(${coverImageUrl})` }} />
          {badgeLabel ? <span className="product-card-badge">{badgeLabel}</span> : null}
        </div>
      </Link>

      <div className="product-card-body">
        <Link to={`/product/${product.slug}`} className="product-card-title-link" onClick={handleProductClick}>
          <h3>{product.title}</h3>
        </Link>
        <p className="product-card-desc">{product.short_description}</p>

        <div className="product-card-rating-row">
          <RatingPill rating={ratingAverage} count={ratingCount} />
        </div>

        <div className="product-card-price-row">
          {hasSubItems ? (
            <strong className="is-custom">
              {isOnSale ? `A partir de R$ ${price.toFixed(2)}` : 'Personalizado'}
            </strong>
          ) : (
            <>
              {isOnSale ? <span className="product-card-old-price">R$ {originalPrice.toFixed(2)}</span> : null}
              <strong className={isOnSale ? 'is-sale' : ''}>R$ {price.toFixed(2)}</strong>
            </>
          )}
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
