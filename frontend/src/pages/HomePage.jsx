import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchCategories, fetchProducts, fetchPublicBanners, resolveAssetUrl } from '../services/api';
import { useCart } from '../services/cart';

const fallbackSlides = [
  {
    id: 'fallback-1',
    title: 'Precisao tecnica em PLA premium',
    subtitle: 'Pecas funcionais com acabamento limpo para escritorio, setup e decoracao',
    image_url: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1800&q=70',
    target_url: '/#produtos',
  },
  {
    id: 'fallback-2',
    title: 'Linha de suportes e organizadores 3D',
    subtitle: 'Projetados para durar e valorizar seu ambiente de trabalho',
    image_url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1800&q=70',
    target_url: '/#produtos',
  },
];

function HomePage() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [banners, setBanners] = useState(fallbackSlides);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchPublicBanners()
      .then((items) => {
        if (!items?.length) return;
        setBanners(
          items.map((item) => ({
            ...item,
            image_url: resolveAssetUrl(item.image_url) || item.image_url,
          }))
        );
      })
      .catch(() => setBanners(fallbackSlides));

    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const category = activeCategory === 'all' ? null : activeCategory;
    fetchProducts(category)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [activeCategory]);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [banners]);

  const query = (searchParams.get('q') || '').trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    if (!query) return products;
    return products.filter((product) =>
      [product.title, product.short_description, product.slug].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [products, query]);

  const visibleBanner = banners[currentBanner] || fallbackSlides[0];

  const chips = [
    { key: 'main', label: 'Main page' },
    { key: 'all', label: 'All products' },
    ...categories.map((category) => ({ key: category.slug, label: category.name })),
  ];

  const onChipClick = (key) => {
    if (key === 'main') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveCategory(key);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:gap-10 lg:px-8">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-sm">
        <img
          src={visibleBanner.image_url}
          alt={visibleBanner.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/55 to-slate-900/25" />

        <div className="relative z-10 flex min-h-[340px] flex-col justify-between gap-8 p-6 sm:min-h-[380px] sm:p-8 lg:p-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">PLA Engineering Collection</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{visibleBanner.title}</h1>
            <p className="text-sm text-slate-200/90 sm:text-base">{visibleBanner.subtitle}</p>
            <div className="pt-2">
              <Link
                to={visibleBanner.target_url || '/#produtos'}
                className="inline-flex h-11 items-center justify-center rounded-[10px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 text-sm font-semibold text-white shadow-glow transition-all duration-300 hover:scale-[1.02] hover:brightness-110"
              >
                Explorar catalogo
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {banners.map((item, index) => (
                <button
                  key={item.id || index}
                  type="button"
                  onClick={() => setCurrentBanner(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentBanner === index ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'
                  }`}
                  aria-label={`Ir para slide ${index + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm text-white backdrop-blur transition hover:bg-white/20"
                aria-label="Slide anterior"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm text-white backdrop-blur transition hover:bg-white/20"
                aria-label="Proximo slide"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="produtos" className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Catalogo tecnico em PLA</h2>
          <p className="text-sm text-slate-500">Acessorios personalizados para escritorio, setup e decoracao funcional.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onChipClick(chip.key)}
              className={`h-8 rounded-full border px-3 text-xs font-medium transition-all duration-300 ${
                activeCategory === chip.key
                  ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Carregando produtos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Nenhum produto encontrado para esse filtro.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const productPrice = Number(product.final_price ?? product.price ?? 0);
              const hasSubItems = (product.sub_items || []).length > 0;
              return (
                <article
                  key={product.id}
                  className="group rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-[1.015] hover:shadow-md"
                >
                  <Link to={`/product/${product.slug}`} className="block">
                    <div className="mb-4 flex h-56 items-center justify-center overflow-hidden rounded-lg bg-slate-50 p-4">
                      <img
                        src={product.cover_image}
                        alt={product.title}
                        className="h-full w-full rounded-md object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                  </Link>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-base font-semibold tracking-tight text-slate-900">{product.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.short_description}</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                        ★ {Number(product.rating_average || 0).toFixed(1)}
                      </span>
                      <strong className="text-lg font-bold text-slate-900">
                        {hasSubItems ? 'Personalizado' : `R$ ${productPrice.toFixed(2)}`}
                      </strong>
                    </div>

                    {hasSubItems ? (
                      <Link
                        to={`/product/${product.slug}`}
                        className="inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-gradient-to-r from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:shadow-glow"
                      >
                        Monte o seu
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(product)}
                        className="h-11 w-full rounded-[10px] bg-gradient-to-r from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:shadow-glow"
                      >
                        Adicionar ao carrinho
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default HomePage;
