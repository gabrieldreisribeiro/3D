import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchCategories, fetchPublicLogo, getCustomerToken, resolveAssetUrl, trackEvent } from '../services/api';
import { useCart } from '../services/cart';
import { getLogoSizeConfig, getLogoSizeKey } from '../services/logoSettings';

const fallbackMarketNav = [
  { label: 'Tudo', to: '/#catalogo', key: 'all' },
  { label: 'Promocoes', to: '/#catalogo', key: 'promocoes' },
  { label: 'Mais pedidos', to: '/#mais-pedidos', key: 'mais-pedidos' },
  { label: 'Personalizados', to: '/#catalogo', key: 'personalizados' },
];

function Header() {
  const { items } = useCart();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoSizeKey, setLogoSizePreference] = useState(getLogoSizeKey());
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/preview');
  const previewPrefix = isPreview ? '/preview' : '';

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasCustomerSession = Boolean(getCustomerToken());

  useEffect(() => {
    fetchPublicLogo()
      .then((data) => setLogoUrl(resolveAssetUrl(data?.url)))
      .catch(() => setLogoUrl(null));
    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const syncLogoSize = () => setLogoSizePreference(getLogoSizeKey());
    window.addEventListener('storage', syncLogoSize);
    window.addEventListener('logo-size-change', syncLogoSize);
    return () => {
      window.removeEventListener('storage', syncLogoSize);
      window.removeEventListener('logo-size-change', syncLogoSize);
    };
  }, []);

  const onSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    trackEvent({
      event_type: 'cta_click',
      cta_name: 'header_search_submit',
      metadata_json: { query: value },
    }).catch(() => {});
    navigate(value ? `${previewPrefix}/?q=${encodeURIComponent(value)}` : `${previewPrefix}/`);
  };

  const logoSize = getLogoSizeConfig(logoSizeKey);
  const categoryParam = searchParams.get('categoria') || 'all';
  const marketNav = categories.length
    ? [
      fallbackMarketNav[0],
      ...categories.map((category) => ({
        label: category.name,
        to: `/?categoria=${encodeURIComponent(category.slug)}#catalogo`,
        key: category.slug,
      })),
      ...fallbackMarketNav.slice(1),
    ]
    : fallbackMarketNav;

  return (
    <header className="sticky top-0 z-50 border-b border-[#E6EAF0] bg-white shadow-[0_3px_14px_rgba(15,23,42,0.06)]">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6 lg:h-[74px] lg:px-8 lg:py-0">
        <Link to={`${previewPrefix}/`} className="flex min-w-[62px] items-center sm:min-w-[124px]">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da loja"
              className="w-auto object-contain"
              style={{ height: `${Math.min(logoSize.headerHeight, 42)}px`, maxWidth: `${logoSize.headerMaxWidth}px` }}
            />
          ) : (
            <span className="text-xs font-bold tracking-tight text-[#111827] sm:text-base">Luma3D</span>
          )}
        </Link>

        <form onSubmit={onSearch} className="w-full">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produtos..."
              className="h-10 w-full rounded-[10px] border border-[#E6EAF0] bg-[#F5F7FA] pl-3 pr-11 text-[13px] text-[#111827] outline-none transition focus:border-[#6D28D9] focus:bg-white focus:ring-2 focus:ring-violet-100 sm:h-11 sm:pl-4 sm:text-sm"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] bg-[#6D28D9] text-white transition hover:bg-[#5B21B6]"
              aria-label="Buscar"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-2">
          <NavLink
            to={`${previewPrefix}/`}
            end
            className={({ isActive }) =>
              `hidden rounded-[10px] px-3 py-2 text-xs font-semibold transition md:inline-flex ${
                isActive ? 'bg-violet-50 text-[#6D28D9]' : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#111827]'
              }`
            }
          >
            Inicio
          </NavLink>
          <NavLink
            to={`${previewPrefix}/cart`}
            className={({ isActive }) =>
              `relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border text-xs font-semibold transition sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2 ${
                isActive
                  ? 'border-violet-200 bg-violet-50 text-[#6D28D9]'
                  : 'border-[#E6EAF0] bg-white text-[#475467] hover:border-violet-200 hover:text-[#6D28D9]'
              }`
            }
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="18" cy="20" r="1.5" />
              <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H7.2" />
            </svg>
            <span className="hidden sm:inline">Carrinho</span>
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6D28D9] px-1 text-[10px] font-semibold text-white sm:static">
              {itemCount}
            </span>
          </NavLink>
          <NavLink
            to={hasCustomerSession ? `${previewPrefix}/minha-conta` : `${previewPrefix}/minha-conta/login`}
            className={({ isActive }) =>
              `inline-flex h-10 items-center rounded-[10px] px-2 text-[11px] font-semibold transition sm:px-3 sm:py-2 sm:text-xs ${
                isActive ? 'bg-violet-50 text-[#6D28D9]' : 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#111827]'
              }`
            }
          >
            {hasCustomerSession ? 'Minha conta' : 'Entrar'}
          </NavLink>
        </div>
      </div>

      <div className="border-t border-[#E6EAF0] bg-[#F9FAFB]">
        <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-3 py-2 text-sm text-[#667085] [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
          {marketNav.map((item) => (
            <a
              key={`${item.key}-${item.label}`}
              href={isPreview && item.to.startsWith('/') ? `${previewPrefix}${item.to}` : item.to}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                categoryParam === item.key || (item.key === 'all' && !searchParams.get('categoria'))
                  ? 'bg-white text-[#6D28D9] shadow-sm ring-1 ring-violet-100'
                  : 'text-[#667085] hover:bg-white hover:text-[#111827]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}

export default Header;
