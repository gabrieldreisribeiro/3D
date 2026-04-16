import { useState } from 'react';

function ImageGallery({ images }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] || images[0];

  return (
    <div className="gallery-block">
      <div className="gallery-main" style={{ backgroundImage: `url(${activeImage})` }} />
      <div className="gallery-thumbs">
        {images.map((image, index) => (
          <button
            key={image}
            className={`gallery-thumb ${index === activeIndex ? 'active' : ''}`}
            style={{ backgroundImage: `url(${image})` }}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`Ver imagem ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default ImageGallery;
