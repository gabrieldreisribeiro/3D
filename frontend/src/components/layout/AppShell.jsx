import { NavLink, useLocation } from 'react-router-dom';
import { getCustomerToken } from '../../services/api';
import { useCart } from '../../services/cart';

function MobileBottomNav() {
  const { items } = useCart();
  const location = useLocation();
  const previewPrefix = location.pathname.startsWith('/preview') ? '/preview' : '';
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const accountPath = getCustomerToken() ? `${previewPrefix}/minha-conta` : `${previewPrefix}/minha-conta/login`;

  const linkClass = ({ isActive }) =>
    `mobile-bottom-nav-item ${isActive ? 'is-active' : ''}`;

  return (
    <nav className="mobile-bottom-nav" aria-label="Navegacao principal mobile">
      <NavLink to={`${previewPrefix}/`} end className={linkClass}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3V10.5Z" /></svg>
        <span>Inicio</span>
      </NavLink>
      <a href={`${previewPrefix}/#catalogo`} className="mobile-bottom-nav-item">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16" /></svg>
        <span>Categorias</span>
      </a>
      <NavLink to={`${previewPrefix}/cart`} className={({ isActive }) => `mobile-bottom-nav-item mobile-bottom-nav-cart ${isActive ? 'is-active' : ''}`}>
        <span className="mobile-bottom-nav-cart-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H7.2" /><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /></svg>
          <strong>{itemCount}</strong>
        </span>
        <span>Carrinho</span>
      </NavLink>
      <NavLink to={accountPath} className={linkClass}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" /></svg>
        <span>Conta</span>
      </NavLink>
      <a href={`${previewPrefix}/#mais-pedidos`} className="mobile-bottom-nav-item">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 9.7 8.2 4 8.8l4.3 3.8L7 18.2l5-2.9 5 2.9-1.3-5.6L20 8.8l-5.7-.6L12 3Z" /></svg>
        <span>Mais</span>
      </a>
    </nav>
  );
}

function AppShell({ header, footer, children }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900">
      {header}
      <main className="app-shell-main pb-24 pt-2 sm:pt-5 lg:pb-0">{children}</main>
      {footer}
      <MobileBottomNav />
    </div>
  );
}

export default AppShell;
