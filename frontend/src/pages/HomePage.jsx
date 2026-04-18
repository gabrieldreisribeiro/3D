import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ProductCard from '../components/ProductCard';
import { fetchCategories, fetchMostOrderedProducts, fetchProducts, fetchPublicBanners, resolveAssetUrl } from '../services/api';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [draftMinPrice, setDraftMinPrice] = useState('');
  const [draftMaxPrice, setDraftMaxPrice] = useState('');
  const [draftSortBy, setDraftSortBy] = useState('relevance');
  const [banners, setBanners] = useState(fallbackSlides);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [mostOrdered, setMostOrdered] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [isAddedModalOpen, setIsAddedModalOpen] = useState(false);
  const [addedProductTitle, setAddedProductTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const filterPopoverRef = useRef(null);

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
    fetchMostOrderedProducts(4).then(setMostOrdered).catch(() => setMostOrdered([]));
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
  const getProductPrice = (product) => Number(product.final_price ?? product.price ?? 0);

  const filteredProducts = useMemo(() => {
    const min = minPrice === '' ? null : Number(minPrice);
    const max = maxPrice === '' ? null : Number(maxPrice);

    let next = products.filter((product) =>
      [product.title, product.short_description, product.slug].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query)
      )
    );

    next = next.filter((product) => {
      const price = getProductPrice(product);
      if (min !== null && Number.isFinite(min) && price < min) return false;
      if (max !== null && Number.isFinite(max) && price > max) return false;
      return true;
    });

    const sorted = [...next];
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => getProductPrice(a) - getProductPrice(b));
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => getProductPrice(b) - getProductPrice(a));
    } else if (sortBy === 'votes') {
      sorted.sort((a, b) => {
        const votesDiff = Number(b.rating_count || 0) - Number(a.rating_count || 0);
        if (votesDiff !== 0) return votesDiff;
        return Number(b.rating_average || 0) - Number(a.rating_average || 0);
      });
    } else if (sortBy === 'name_asc') {
      sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    }

    return sorted;
  }, [products, query, minPrice, maxPrice, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, query, itemsPerPage, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    if (!isFiltersModalOpen) return;
    setDraftMinPrice(minPrice);
    setDraftMaxPrice(maxPrice);
    setDraftSortBy(sortBy);
  }, [isFiltersModalOpen, minPrice, maxPrice, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isFiltersModalOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!filterPopoverRef.current) return;
      if (!filterPopoverRef.current.contains(event.target)) {
        setIsFiltersModalOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsFiltersModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isFiltersModalOpen]);

  const visibleBanner = banners[currentBanner] || fallbackSlides[0];
  const mostOrderedProducts = useMemo(() => mostOrdered.slice(0, 4), [mostOrdered]);

  const chips = [
    { key: 'main', label: 'Inicio' },
    { key: 'all', label: 'Todos os produtos' },
    ...categories.map((category) => ({ key: category.slug, label: category.name })),
  ];

  const onChipClick = (key) => {
    if (key === 'main') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveCategory(key);
  };

  const rangeStart = filteredProducts.length ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredProducts.length);
  const hasActiveFilters = minPrice !== '' || maxPrice !== '' || sortBy !== 'relevance';
  const handleAddToCart = (product) => {
    addToCart(product);
    setAddedProductTitle(product?.title || 'Produto');
    setIsAddedModalOpen(true);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:gap-10 lg:px-8">
      <section className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden">
        <img
          src={visibleBanner.image_url}
          alt={visibleBanner.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/40 via-fuchsia-500/15 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/58 via-slate-900/24 to-transparent" />

        <div className="relative mx-auto flex min-h-[360px] w-full max-w-7xl flex-col justify-between px-4 py-8 sm:min-h-[390px] sm:px-6 lg:px-8">
          <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-100">Luma 3D</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{visibleBanner.title}</h1>
            <p className="mt-2 text-sm text-slate-100/90 sm:text-base">{visibleBanner.subtitle}</p>
            <div className="pt-4">
              <Link
                to={visibleBanner.target_url || '/#produtos'}
                className="inline-flex h-10 items-center justify-center rounded-[10px] bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 text-sm font-semibold text-white shadow-glow transition-all duration-300 hover:brightness-110"
              >
                Explorar catalogo
              </Link>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {banners.map((item, index) => (
                <button
                  key={item.id || index}
                  type="button"
                  onClick={() => setCurrentBanner(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentBanner === index ? 'w-6 bg-white' : 'w-2 bg-white/65 hover:bg-white/85'
                  }`}
                  aria-label={`Ir para slide ${index + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/15 text-sm text-white backdrop-blur transition hover:bg-white/25"
                aria-label="Slide anterior"
              >
                {'<'}
              </button>
              <button
                type="button"
                onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/15 text-sm text-white backdrop-blur transition hover:bg-white/25"
                aria-label="Proximo slide"
              >
                {'>'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {mostOrderedProducts.length ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Mais pedidos</h2>
            <p className="text-sm text-slate-500">Os produtos mais escolhidos pelos clientes</p>
          </div>
          <div className="market-products-grid">
            {mostOrderedProducts.map((product) => (
              <ProductCard
                key={`most-ordered-${product.id}`}
                product={product}
                onAdd={handleAddToCart}
                highlightLabel={'\uD83D\uDD25 Mais vendido'}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section id="produtos" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="space-y-2 border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Catalogo tecnico em PLA</h2>
          <p className="text-sm text-slate-500">Acessorios personalizados para escritorio, setup e decoracao funcional.</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => onChipClick(chip.key)}
                className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition-all duration-300 sm:text-sm ${
                  activeCategory === chip.key
                    ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-white hover:text-violet-700'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-[60] flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div ref={filterPopoverRef} className="relative z-[70]">
            <button
              type="button"
              onClick={() => setIsFiltersModalOpen((prev) => !prev)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
              </svg>
              Filtros
            </button>

            {isFiltersModalOpen ? (
              <div className="absolute left-0 top-[calc(100%+8px)] z-[90] w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs text-slate-600">
                      Preco minimo
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftMinPrice}
                        onChange={(event) => setDraftMinPrice(event.target.value)}
                        className="h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-violet-300"
                        placeholder="0.00"
                      />
                    </label>

                    <label className="grid gap-1 text-xs text-slate-600">
                      Preco maximo
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draftMaxPrice}
                        onChange={(event) => setDraftMaxPrice(event.target.value)}
                        className="h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-violet-300"
                        placeholder="999.99"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1 text-xs text-slate-600">
                    Ordenar
                    <select
                      value={draftSortBy}
                      onChange={(event) => setDraftSortBy(event.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-violet-300"
                    >
                      <option value="relevance">Relevancia</option>
                      <option value="votes">Mais votados</option>
                      <option value="price_asc">Menor preco</option>
                      <option value="price_desc">Maior preco</option>
                      <option value="name_asc">Nome A-Z</option>
                    </select>
                  </label>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftMinPrice('');
                        setDraftMaxPrice('');
                        setDraftSortBy('relevance');
                      }}
                      className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMinPrice(draftMinPrice);
                        setMaxPrice(draftMaxPrice);
                        setSortBy(draftSortBy);
                        setIsFiltersModalOpen(false);
                      }}
                      className="h-9 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-700"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
              setMinPrice('');
              setMaxPrice('');
              setSortBy('relevance');
            }}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
          >
              Limpar filtros
            </button>
          ) : null}

              <p className="text-xs text-slate-500">
            {hasActiveFilters ? 'Filtros ativos aplicados' : 'Sem filtros ativos'}
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Carregando produtos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Nenhum produto encontrado para esse filtro.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                Mostrando <strong>{rangeStart}</strong> - <strong>{rangeEnd}</strong> de <strong>{filteredProducts.length}</strong> itens
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                Itens por pagina
                <select
                  value={itemsPerPage}
                  onChange={(event) => setItemsPerPage(Number(event.target.value))}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-violet-300"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={36}>36</option>
                  <option value={48}>48</option>
                </select>
              </label>
            </div>

            <div className="market-products-grid">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={handleAddToCart} />
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition ${
                      page === currentPage
                        ? 'border-violet-600 bg-violet-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:text-violet-700'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <Modal
        open={isAddedModalOpen}
        title="Item adicionado ao carrinho"
        onClose={() => setIsAddedModalOpen(false)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddedModalOpen(false)}>
              Voltar as compras
            </Button>
            <Button
              onClick={() => {
                setIsAddedModalOpen(false);
                navigate('/cart');
              }}
            >
              Finalizar compra
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <strong>{addedProductTitle}</strong> foi adicionado com sucesso. Deseja finalizar agora ou continuar comprando?
        </p>
      </Modal>

    </div>
  );
}

export default HomePage;
