import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RatingPill from './RatingPill';
import Button from './ui/Button';
import { getOptimizedImageSources, resolveAssetUrl, trackEvent } from '../services/api';

function ProductCard({ product, onAdd, highlightLabel = '', compact = false }) {
  const location = useLocation();
  const previewPrefix = location.pathname.startsWith('/preview') ? '/preview' : '';
  const productLink = `${previewPrefix}/product/${product.slug}`;
  const [isAdding, setIsAdding] = useState(false);
  const price = Number(product.final_price ?? product.price ?? 0);
  const originalPrice = Number(product.original_price ?? product.price ?? product.final_price ?? 0);
  const coverImageSources = getOptimizedImageSources(product.cover_image, {
    variant: 'medium',
    sizes: '(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw',
  });
  const coverImageUrl = coverImageSources.src || resolveAssetUrl(product.cover_image) || product.cover_image || '';
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
      <Link to={productLink} className="product-card-image-link" onClick={handleProductClick}>
        <div className="product-card-image-wrap">
          <img
            src={coverImageUrl}
            srcSet={coverImageSources.srcSet || undefined}
            sizes={coverImageSources.srcSet ? '(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw' : undefined}
            alt={product.title || 'Produto'}
            className="product-card-image h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            width="640"
            height="480"
          />
          {badgeLabel ? <span className="product-card-badge">{badgeLabel}</span> : null}
        </div>
      </Link>

      <div className="product-card-body">
        <Link to={productLink} className="product-card-title-link" onClick={handleProductClick}>
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

        <p className="product-card-installments">
          {hasSubItems ? 'Monte seu pedido com variacoes' : 'Compra segura e envio para todo o Brasil'}
        </p>

        <div className="product-card-actions">
          {hasSubItems ? (
            <Link to={productLink}>
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
