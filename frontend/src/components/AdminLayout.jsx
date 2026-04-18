import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminToken, fetchPublicLogo, getAdminToken, resolveAssetUrl } from '../services/api';
import Sidebar from './layout/Sidebar';
import Button from './ui/Button';
import { getLogoSizeConfig, getLogoSizeKey, setLogoSizeKey as persistLogoSizeKey } from '../services/logoSettings';

function AdminLayout() {
  const token = getAdminToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoSizeKey, setLogoSizeKey] = useState(getLogoSizeKey());

  useEffect(() => {
    fetchPublicLogo()
      .then((data) => setLogoUrl(resolveAssetUrl(data?.url)))
      .catch(() => setLogoUrl(null));
  }, []);

  useEffect(() => {
    const syncLogoSize = () => setLogoSizeKey(getLogoSizeKey());
    window.addEventListener('storage', syncLogoSize);
    window.addEventListener('logo-size-change', syncLogoSize);
    return () => {
      window.removeEventListener('storage', syncLogoSize);
      window.removeEventListener('logo-size-change', syncLogoSize);
    };
  }, []);

  if (!token) {
    return <Navigate to="/painel-interno/login" state={{ from: location }} replace />;
  }

  const handleLogout = () => {
    clearAdminToken();
    navigate('/painel-interno/login', { replace: true });
  };

  const handleLogoSizeChange = (nextSize) => {
    persistLogoSizeKey(nextSize);
    setLogoSizeKey(getLogoSizeKey());
  };

  const navClassName = ({ isActive }) =>
    `rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${
      isActive ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const links = (
    <>
      <NavLink to="/painel-interno" end className={navClassName}>
        Dashboard
      </NavLink>
      <NavLink to="/painel-interno/produtos" className={navClassName}>
        Produtos
      </NavLink>
      <NavLink to="/painel-interno/categorias" className={navClassName}>
        Categorias
      </NavLink>
      <NavLink to="/painel-interno/pedidos" className={navClassName}>
        Pedidos
      </NavLink>
      <NavLink to="/painel-interno/cupons" className={navClassName}>
        Cupons
      </NavLink>
      <NavLink to="/painel-interno/banners" className={navClassName}>
        Banners
      </NavLink>
      <NavLink to="/painel-interno/configuracoes" className={navClassName}>
        Configuracoes
      </NavLink>
    </>
  );

  const logoSize = getLogoSizeConfig(logoSizeKey);
  const brand = logoUrl ? (
    <img
      src={logoUrl}
      className="w-auto object-contain"
      style={{ height: `${logoSize.adminHeight}px`, maxWidth: `${logoSize.adminMaxWidth}px` }}
      alt="Logo"
    />
  ) : (
    <strong className="text-base font-bold tracking-tight text-slate-900">PLA Studio</strong>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar
        brand={brand}
        subtitle="Painel interno"
        links={links}
        footer={
          <Button variant="secondary" onClick={handleLogout} className="w-full">
            Sair
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet context={{ logoUrl, setLogoUrl, logoSizeKey, setLogoSizeKey: handleLogoSizeChange }} />
      </main>
    </div>
  );
}

export default AdminLayout;
