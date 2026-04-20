import { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminToken, fetchPublicLogo, getAdminToken, resolveAssetUrl } from '../services/api';
import Sidebar from './layout/Sidebar';
import Button from './ui/Button';
import { getLogoSizeConfig, getLogoSizeKey, setLogoSizeKey as persistLogoSizeKey } from '../services/logoSettings';

function NavIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      {
        to: '/painel-interno',
        label: 'Dashboard',
        end: true,
        icon: <path d="M3 13h8V3H3zm10 8h8V11h-8zm0-18v6h8V3zM3 21h8v-6H3z" />,
      },
      {
        to: '/painel-interno/produtos',
        label: 'Produtos',
        icon: <><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="M3 16l9 5 9-5" /><path d="M3 12l9 5 9-5" /></>,
      },
      {
        to: '/painel-interno/categorias',
        label: 'Categorias',
        icon: <><path d="M4 7h16" /><path d="M4 12h10" /><path d="M4 17h16" /></>,
      },
      {
        to: '/painel-interno/pedidos',
        label: 'Pedidos',
        icon: <><path d="M6 7h12" /><path d="M6 12h12" /><path d="M6 17h8" /><path d="M4 3h16v18H4z" /></>,
      },
      {
        to: '/painel-interno/avaliacoes',
        label: 'Avaliacoes',
        icon: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
      },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/painel-interno/cupons', label: 'Cupons', icon: <><path d="M20 12a2 2 0 0 0 0-4V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2Z" /><path d="M12 8v8" /></> },
      { to: '/painel-interno/promocoes', label: 'Promocoes', icon: <><path d="M12 2v20" /><path d="M17 7c0-1.7-2.2-3-5-3S7 5.3 7 7s2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3" /></> },
      { to: '/painel-interno/banners', label: 'Banners', icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 15 5-4 4 3 3-2 6 5" /></> },
      { to: '/painel-interno/highlights', label: 'Highlights', icon: <><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /></> },
      { to: '/painel-interno/instagram', label: 'Instagram', icon: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="3.5" /><circle cx="17" cy="7" r="1" /></> },
      { to: '/painel-interno/meta-pixel', label: 'Meta Pixel', icon: <><path d="M12 4 4 8l8 4 8-4-8-4Z" /><path d="M4 12l8 4 8-4" /><path d="M4 16l8 4 8-4" /></> },
      { to: '/painel-interno/publicacao', label: 'Publicacao', icon: <><path d="M5 5h14v14H5z" /><path d="M8 9h8M8 13h8M8 17h5" /></> },
      { to: '/painel-interno/anuncios-ia', label: 'Anuncios IA', icon: <><path d="M12 2v4" /><path d="M12 18v4" /><path d="m4.9 4.9 2.8 2.8" /><path d="m16.3 16.3 2.8 2.8" /><path d="M2 12h4" /><path d="M18 12h4" /><path d="m4.9 19.1 2.8-2.8" /><path d="m16.3 7.7 2.8-2.8" /></> },
    ],
  },
  {
    label: 'Dados',
    items: [
      { to: '/painel-interno/leads-conversao', label: 'Leads & Conversao', icon: <><path d="M3 3v18h18" /><path d="m7 14 3-3 3 2 4-5" /></> },
      { to: '/painel-interno/relatorios', label: 'Relatorios', icon: <><path d="M4 19h16" /><path d="M7 15V9" /><path d="M12 15V5" /><path d="M17 15v-3" /></> },
      { to: '/painel-interno/uploads', label: 'Uploads', icon: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" /></> },
      { to: '/painel-interno/banco', label: 'Banco de dados', icon: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></> },
      { to: '/painel-interno/configuracoes', label: 'Configuracoes', icon: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1Z" /></> },
    ],
  },
];

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
    `group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm'
        : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
    }`;

  const links = useMemo(
    () => (
      <>
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{section.label}</p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={Boolean(item.end)} className={navClassName}>
                  {({ isActive }) => (
                    <>
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                        isActive
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                      }`}>
                        <NavIcon path={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </>
    ),
    []
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 lg:flex">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            {brand}
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Painel interno</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
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
          <Button variant="ghost" onClick={handleLogout} className="w-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Sair
          </Button>
        }
      />
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/45 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <aside
            className="h-full w-[90vw] max-w-[332px] overflow-y-auto border-r border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="min-w-0">
                {brand}
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Painel interno</p>
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
            <nav className="flex flex-col gap-2">{links}</nav>
            <div className="mt-6 border-t border-slate-200 pt-4">
              <Button variant="ghost" onClick={handleLogout} className="w-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Sair
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1520px] flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <Outlet context={{ logoUrl, setLogoUrl, logoSizeKey, setLogoSizeKey: handleLogoSizeChange }} />
      </main>
    </div>
  );
}

export default AdminLayout;
