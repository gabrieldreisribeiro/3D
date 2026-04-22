import { useState } from 'react';
import { getOptimizedImageSources } from '../services/api';

function ImageGallery({ images }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] || images[0];
  const activeSources = getOptimizedImageSources(activeImage, {
    variant: 'large',
    sizes: '(max-width: 768px) 100vw, 900px',
  });

  return (
    <div className="gallery-block">
      <div className="gallery-main">
        {activeImage ? (
          <img
            src={activeSources.src || activeImage}
            srcSet={activeSources.srcSet || undefined}
            sizes={activeSources.srcSet ? '(max-width: 768px) 100vw, 900px' : undefined}
            alt="Imagem da galeria"
            className="h-full w-full object-contain"
            width="1200"
            height="900"
            decoding="async"
          />
        ) : null}
      </div>
      <div className="gallery-thumbs">
        {images.map((image, index) => {
          const thumb = getOptimizedImageSources(image, {
            variant: 'thumbnail',
            sizes: '(max-width: 768px) 18vw, 120px',
          });
          return (
            <button
              key={image}
              className={`gallery-thumb ${index === activeIndex ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Ver imagem ${index + 1}`}
            >
              <img
                src={thumb.src || image}
                srcSet={thumb.srcSet || undefined}
                sizes={thumb.srcSet ? '(max-width: 768px) 18vw, 120px' : undefined}
                alt={`Miniatura ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                width="240"
                height="180"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ImageGallery;
