import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminToken, fetchPublicLogo, getAdminToken, resolveAssetUrl } from '../services/api';
import Sidebar from './layout/Sidebar';
import Button from './ui/Button';

function AdminLayout() {
  const token = getAdminToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    fetchPublicLogo()
      .then((data) => setLogoUrl(resolveAssetUrl(data?.url)))
      .catch(() => setLogoUrl(null));
  }, []);

  if (!token) {
    return <Navigate to="/painel-interno/login" state={{ from: location }} replace />;
  }

  const handleLogout = () => {
    clearAdminToken();
    navigate('/painel-interno/login', { replace: true });
  };

  const links = (
    <>
      <NavLink to="/painel-interno" end>
        Dashboard
      </NavLink>
      <NavLink to="/painel-interno/produtos">Produtos</NavLink>
      <NavLink to="/painel-interno/pedidos">Pedidos</NavLink>
      <NavLink to="/painel-interno/banners">Banners</NavLink>
      <NavLink to="/painel-interno/configuracoes">Configuracoes</NavLink>
    </>
  );

  const brand = logoUrl ? <img src={logoUrl} className="admin-brand-logo" alt="Logo" /> : <strong>3D Marketplace</strong>;

  return (
    <div className="admin-shell-pro">
      <Sidebar
        brand={brand}
        subtitle="Painel de gestao"
        links={links}
        footer={
          <Button variant="secondary" onClick={handleLogout} className="wide-btn">
            Sair
          </Button>
        }
      />
      <main className="admin-main-pro">
        <Outlet context={{ logoUrl, setLogoUrl }} />
      </main>
    </div>
  );
}

export default AdminLayout;
