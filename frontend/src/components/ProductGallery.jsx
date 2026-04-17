import { useMemo, useState } from 'react';

function ProductGallery({ images, selected, onSelect }) {
  const safeImages = (images || []).map((item) => String(item || '').trim()).filter(Boolean);
  const hero = safeImages[selected] || safeImages[0];
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const heroStyle = useMemo(
    () => ({
      backgroundImage: `url(${hero})`,
      backgroundSize: isZoomed ? '190%' : 'cover',
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
    <div className="product-gallery-pro">
      <div
        className={`product-gallery-hero ${isZoomed ? 'is-zoomed' : ''}`}
        style={heroStyle}
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      />
      <div className="product-gallery-thumbs">
        {safeImages.map((image, index) => (
          <button
            key={`${image}-${index}`}
            className={index === selected ? 'active' : ''}
            style={{ backgroundImage: `url(${image})` }}
            onClick={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}

export default ProductGallery;
