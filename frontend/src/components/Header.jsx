import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../services/cart';
import { fetchPublicLogo, resolveAssetUrl } from '../services/api';
import Button from './ui/Button';
import Input from './ui/Input';

function Header() {
  const { items } = useCart();
  const [logoUrl, setLogoUrl] = useState(null);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    fetchPublicLogo()
      .then((data) => setLogoUrl(resolveAssetUrl(data?.url)))
      .catch(() => setLogoUrl(null));
  }, []);

  const onSearch = (event) => {
    event.preventDefault();
    navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : '/');
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="container header-grid">
        <Link to="/" className="brand-link" onClick={() => setMenuOpen(false)}>
          {logoUrl ? <img src={logoUrl} className="brand-logo" alt="Logo da loja" /> : <strong>3D Studio Shop</strong>}
        </Link>

        <form className="header-search" onSubmit={onSearch}>
          <Input
            aria-label="Buscar produtos"
            placeholder="Buscar produtos, colecoes e novidades"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>

        <button className="hamburger-btn" type="button" onClick={() => setMenuOpen((current) => !current)}>
          ☰
        </button>

        <nav className={`header-actions ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" end className="ghost-link" onClick={() => setMenuOpen(false)}>
            Loja
          </NavLink>
          <NavLink to="/cart" className="cart-pill" onClick={() => setMenuOpen(false)}>
            Carrinho
            <span>{itemCount}</span>
          </NavLink>
          <Button variant="ghost" onClick={onSearch} type="button" className="header-search-btn">
            Buscar
          </Button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
