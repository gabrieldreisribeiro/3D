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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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
      <NavLink to="/painel-interno/avaliacoes" className={navClassName}>
        Avaliacoes
      </NavLink>
      <NavLink to="/painel-interno/cupons" className={navClassName}>
        Cupons
      </NavLink>
      <NavLink to="/painel-interno/banners" className={navClassName}>
        Banners
      </NavLink>
      <NavLink to="/painel-interno/instagram" className={navClassName}>
        Instagram
      </NavLink>
      <NavLink to="/painel-interno/meta-pixel" className={navClassName}>
        Meta Pixel
      </NavLink>
      <NavLink to="/painel-interno/anuncios-ia" className={navClassName}>
        Anuncios com IA
      </NavLink>
      <NavLink to="/painel-interno/leads-conversao" className={navClassName}>
        Leads & Conversao
      </NavLink>
      <NavLink to="/painel-interno/banco" className={navClassName}>
        Banco de dados
      </NavLink>
      <NavLink to="/painel-interno/uploads" className={navClassName}>
        Uploads
      </NavLink>
      <NavLink to="/painel-interno/relatorios" className={navClassName}>
        Relatorios
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
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            {brand}
            <p className="text-xs text-slate-500">Painel interno</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-700"
            aria-label="Abrir menu"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

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
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="h-full w-[86vw] max-w-[320px] overflow-y-auto border-r border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <div className="min-w-0">
                {brand}
                <p className="text-xs text-slate-500">Painel interno</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                aria-label="Fechar menu"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1">{links}</nav>
            <div className="mt-6 border-t border-slate-200 pt-4">
              <Button variant="secondary" onClick={handleLogout} className="w-full">
                Sair
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <Outlet context={{ logoUrl, setLogoUrl, logoSizeKey, setLogoSizeKey: handleLogoSizeChange }} />
      </main>
    </div>
  );
}

export default AdminLayout;
