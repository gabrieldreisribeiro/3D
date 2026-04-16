import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard';
import Carousel from '../components/ui/Carousel';
import EmptyState from '../components/ui/EmptyState';
import SectionHeader from '../components/ui/SectionHeader';
import {
  fetchCategories,
  fetchProducts,
  fetchPublicBanners,
  resolveAssetUrl,
} from '../services/api';
import { useCart } from '../services/cart';

const fallbackSlides = [
  {
    id: 'fallback-1',
    title: 'Colecao premium para criadores',
    subtitle: 'Design moderno para ambientes comerciais e residenciais',
    image_url: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1800&q=70',
    target_url: '/#produtos',
  },
];

function HomePage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    fetchPublicBanners().then((bannerItems) => {
      const parsedBanners = bannerItems.map((item) => ({
        ...item,
        image_url: resolveAssetUrl(item.image_url) || item.image_url,
      }));
      setBanners(parsedBanners.length ? parsedBanners : fallbackSlides);
    });

    fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const categorySlug = activeCategory === 'all' ? null : activeCategory;
    fetchProducts(categorySlug)
      .then(setProducts)
      .finally(() => setIsLoading(false));
  }, [activeCategory]);

  const categoryChips = useMemo(
    () => [
      { key: 'all', label: 'All products' },
      ...categories.map((category) => ({ key: category.slug, label: category.name })),
    ],
    [categories]
  );

  const onCategoryClick = (key) => {
    if (key === 'main') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveCategory(key);
  };

  return (
    <section className="container home-page-pro">
      <Carousel slides={banners} />

      <section id="produtos" className="catalog-section">
        <SectionHeader
          eyebrow="Colecao"
          title="Produtos em destaque"
          subtitle="Selecao com foco em design, utilidade e qualidade de impressao"
        />

        <div className="category-chip-row">
          {categoryChips.map((chip) => (
            <button
              key={chip.key}
              className={`category-chip ${activeCategory === chip.key ? 'active' : ''}`}
              onClick={() => onCategoryClick(chip.key)}
              type="button"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="loading-state-pro">Carregando produtos...</div>
        ) : products.length === 0 ? (
          <EmptyState
            title="Nenhum produto encontrado"
            description="Tente outra categoria para ver mais itens."
          />
        ) : (
          <div className="product-grid-pro">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={addToCart} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default HomePage;
