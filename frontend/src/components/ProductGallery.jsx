import { useMemo, useState } from 'react';

function ProductGallery({ images, selected, onSelect }) {
  const safeImages = (images || []).map((item) => String(item || '').trim()).filter(Boolean);
  const hero = safeImages[selected] || safeImages[0];
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const heroStyle = useMemo(
    () => ({
      backgroundImage: `url(${hero})`,
      backgroundSize: isZoomed ? '170%' : 'contain',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
      cursor: isZoomed ? 'zoom-out' : 'zoom-in',
    }),
    [hero, isZoomed, zoomPos.x, zoomPos.y]
  );

  const handleMouseMove = (event) => {
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
        className={`min-h-[320px] rounded-2xl border border-slate-100 bg-slate-50 shadow-sm transition-shadow sm:min-h-[420px] lg:min-h-[560px] ${
          isZoomed ? 'shadow-md' : ''
        }`}
        style={heroStyle}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      />
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {safeImages.map((image, index) => (
          <button
            key={`${image}-${index}`}
            className={`aspect-[4/3] overflow-hidden rounded-xl border bg-slate-50 shadow-sm transition hover:border-violet-200 ${
              index === selected ? 'border-violet-500 ring-2 ring-violet-100' : 'border-slate-200'
            }`}
            onClick={() => onSelect(index)}
          >
            <img
              src={image}
              alt={`Miniatura ${index + 1}`}
              className="h-full w-full object-contain object-center p-1"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default ProductGallery;
