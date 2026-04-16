import { useEffect, useState } from 'react';

function BannerSlide({ banner, isActive }) {
  return (
    <article
      className={`carousel-slide ${isActive ? 'is-active' : ''}`}
      style={{ backgroundImage: `url(${banner.image_url})` }}
      aria-hidden={!isActive}
    >
      <div className="banner-overlay" />
      <div className="banner-content">
        {banner.title ? <h1>{banner.title}</h1> : null}
        {banner.subtitle ? <p>{banner.subtitle}</p> : null}
        {banner.target_url ? (
          <a className="btn btn-primary hero-cta" href={banner.target_url}>
            Ver destaque
          </a>
        ) : null}
      </div>
    </article>
  );
}

function Carousel({ slides, autoPlay = true, interval = 6000 }) {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  useEffect(() => {
    if (!autoPlay || total <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, total]);

  if (!total) return null;

  return (
    <section className="carousel-root" aria-label="Banners principais">
      <div className="carousel-track">
        {slides.map((slide, slideIndex) => (
          <BannerSlide key={slide.id || slideIndex} banner={slide} isActive={slideIndex === index} />
        ))}
      </div>

      {total > 1 ? (
        <>
          <button
            className="carousel-arrow left"
            onClick={() => setIndex((current) => (current - 1 + total) % total)}
            aria-label="Slide anterior"
          >
            ‹
          </button>
          <button
            className="carousel-arrow right"
            onClick={() => setIndex((current) => (current + 1) % total)}
            aria-label="Próximo slide"
          >
            ›
          </button>
          <div className="carousel-dots">
            {slides.map((slide, dotIndex) => (
              <button
                key={`${slide.id || dotIndex}-dot`}
                className={dotIndex === index ? 'active' : ''}
                onClick={() => setIndex(dotIndex)}
                aria-label={`Ir para slide ${dotIndex + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export default Carousel;
export { BannerSlide };
