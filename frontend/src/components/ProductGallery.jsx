import { useMemo, useState } from 'react';
import { getOptimizedImageSources } from '../services/api';

function ProductGallery({ images, selected, onSelect }) {
  const safeImages = (images || []).map((item) => String(item || '').trim()).filter(Boolean);
  const hero = safeImages[selected] || safeImages[0] || '';
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const heroSources = useMemo(
    () =>
      getOptimizedImageSources(hero, {
        variant: 'large',
        sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 960px',
      }),
    [hero]
  );

  const handleMouseMove = (event) => {
    if (!hero || heroSources.isAnimated) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomPos({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
    });
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-sm transition-shadow sm:min-h-[420px] lg:min-h-[560px] ${
          isZoomed ? 'shadow-md' : ''
        }`}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      >
        {hero ? (
          <img
            src={heroSources.src || hero}
            srcSet={heroSources.srcSet || undefined}
            sizes={heroSources.srcSet ? '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 960px' : undefined}
            alt="Imagem principal do produto"
            className="h-full w-full object-contain object-center transition-transform duration-200"
            style={
              heroSources.isAnimated
                ? undefined
                : {
                    transform: isZoomed ? 'scale(1.7)' : 'scale(1)',
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                  }
            }
            decoding="async"
            width="1200"
            height="900"
          />
        ) : null}
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {safeImages.map((image, index) => {
          const sources = getOptimizedImageSources(image, {
            variant: 'thumbnail',
            sizes: '(max-width: 640px) 25vw, 160px',
          });
          return (
            <button
              key={`${image}-${index}`}
              className={`aspect-[4/3] overflow-hidden rounded-xl border bg-slate-50 shadow-sm transition hover:border-violet-200 ${
                index === selected ? 'border-violet-500 ring-2 ring-violet-100' : 'border-slate-200'
              }`}
              onClick={() => onSelect(index)}
            >
              <img
                src={sources.src || image}
                srcSet={sources.srcSet || undefined}
                sizes={sources.srcSet ? '(max-width: 640px) 25vw, 160px' : undefined}
                alt={`Miniatura ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                width="320"
                height="240"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ProductGallery;
