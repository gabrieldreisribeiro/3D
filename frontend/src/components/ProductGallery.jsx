function ProductGallery({ images, selected, onSelect }) {
  const safeImages = (images || []).map((item) => String(item || '').trim()).filter(Boolean);
  const hero = safeImages[selected] || safeImages[0];

  return (
    <div className="space-y-3">
      <div className="group relative h-[320px] overflow-hidden rounded-[16px] border border-[#E6EAF0] bg-[#F3F4F6] sm:h-[420px]">
        <img
          src={hero}
          alt="Imagem principal do produto"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

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
