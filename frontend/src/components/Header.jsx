import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../services/cart';

function Header() {
  const { items } = useCart();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="topbar">
      <div className="topbar-inner container">
        <Link to="/" className="brand">
          3D Studio Shop
        </Link>
        <nav className="nav-links">
          <NavLink to="/" end>
            Loja
          </NavLink>
          <NavLink to="/cart" className="cart-link">
            Carrinho
            {itemCount > 0 && <span className="badge">{itemCount}</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Header;
