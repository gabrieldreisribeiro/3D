function ProductGallery({ images, selected, onSelect }) {
  const safeImages = images.filter(Boolean);
  const hero = safeImages[selected] || safeImages[0];

  return (
    <div className="product-gallery-pro">
      <div className="product-gallery-hero" style={{ backgroundImage: `url(${hero})` }} />
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
