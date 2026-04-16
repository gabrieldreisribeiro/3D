import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchPublicLogo, resolveAssetUrl } from '../services/api';
import { useCart } from '../services/cart';

function Header() {
  const { items } = useCart();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [logoUrl, setLogoUrl] = useState(null);
  const navigate = useNavigate();

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    fetchPublicLogo()
      .then((data) => setLogoUrl(resolveAssetUrl(data?.url)))
      .catch(() => setLogoUrl(null));
  }, []);

  const onSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/?q=${encodeURIComponent(value)}` : '/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[70px] w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-[160px] items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da loja" className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-sm font-semibold tracking-tight text-slate-900">PLA Studio</span>
          )}
        </Link>

        <form onSubmit={onSearch} className="hidden flex-1 md:block">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar suporte, organizador, acessorio..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-full px-3 py-2 text-xs font-medium transition ${
                isActive ? 'bg-violet-50 text-violet-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`
            }
          >
            Inicio
          </NavLink>
          <NavLink
            to="/cart"
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
              }`
            }
          >
            <span className="text-sm leading-none">🛒</span>
            <span>Carrinho</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white">
              {itemCount}
            </span>
          </NavLink>
        </nav>
      </div>

      <form onSubmit={onSearch} className="border-t border-slate-100 px-4 py-3 md:hidden">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar produtos PLA"
          className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
        />
      </form>
    </header>
  );
}

export default Header;
