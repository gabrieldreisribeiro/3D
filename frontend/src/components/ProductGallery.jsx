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
        className={`h-[320px] overflow-hidden rounded-[16px] border border-[#E6EAF0] bg-[#F3F4F6] transition-shadow sm:h-[420px] ${
          isZoomed ? 'shadow-md' : 'shadow-sm'
        }`}
        style={heroStyle}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      />

      <div className="flex gap-3 overflow-x-auto pb-1">
        {safeImages.map((image, index) => (
          <button
            key={`${image}-${index}`}
            type="button"
            className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[10px] border-2 bg-white transition-all duration-200 ${
              index === selected
                ? 'border-[#6D28D9] shadow-[0_4px_14px_rgba(109,40,217,0.2)]'
                : 'border-[#E6EAF0] hover:border-violet-300'
            }`}
            onClick={() => onSelect(index)}
          >
            <img
              src={image}
              alt={`Miniatura ${index + 1}`}
              className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default ProductGallery;
