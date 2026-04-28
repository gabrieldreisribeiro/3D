import { useMemo, useState } from 'react';
import { getOptimizedImageSources } from '../services/api';

function ProductGallery({
  images,
  selected,
  onSelect,
  show3dPreview = false,
  onOpen3dPreview = null,
}) {
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
        className={`relative h-[320px] overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-sm transition-shadow sm:h-[420px] lg:h-[560px] ${
          isZoomed ? 'shadow-md' : ''
        }`}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      >
        {hero ? (
          <>
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
            {show3dPreview && typeof onOpen3dPreview === 'function' ? (
              <div className="pointer-events-none absolute left-3 top-3">
                <button
                  type="button"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-[10px] border border-emerald-700 bg-[#10B41F] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(16,180,31,0.42)] transition hover:brightness-105"
                  onClick={onOpen3dPreview}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3 3 8l9 5 9-5-9-5z" />
                    <path d="m3 8 9 5 9-5" />
                    <path d="M12 13v8" />
                  </svg>
                  Pre-visualizacao 3D
                </button>
              </div>
            ) : null}
          </>
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
