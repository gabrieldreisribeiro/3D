import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import AppShell from './components/layout/AppShell';
import AdminLayout from './components/AdminLayout';
import { CartProvider } from './services/cart';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminProductsPage from './pages/AdminProductsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminBannersPage from './pages/AdminBannersPage';
import AdminCouponsPage from './pages/AdminCouponsPage';
import AdminInstagramPage from './pages/AdminInstagramPage';
import AdminAdsPage from './pages/AdminAdsPage';
import AdminReviewsPage from './pages/AdminReviewsPage';
import AdminDatabasePage from './pages/AdminDatabasePage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminLeadsConversionPage from './pages/AdminLeadsConversionPage';
import { trackEvent } from './services/api';

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/painel-interno');

  useEffect(() => {
    if (isAdminRoute) return;
    trackEvent({
      event_type: 'page_view',
      metadata_json: {
        pathname: location.pathname,
        query: location.search || '',
      },
    }).catch(() => {});
  }, [isAdminRoute, location.pathname, location.search]);

  if (isAdminRoute) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Routes>
          <Route path="/painel-interno/login" element={<AdminLoginPage />} />
          <Route path="/painel-interno" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="produtos" element={<AdminProductsPage />} />
            <Route path="categorias" element={<AdminCategoriesPage />} />
            <Route path="pedidos" element={<AdminOrdersPage />} />
            <Route path="avaliacoes" element={<AdminReviewsPage />} />
            <Route path="cupons" element={<AdminCouponsPage />} />
            <Route path="banners" element={<AdminBannersPage />} />
            <Route path="configuracoes" element={<AdminSettingsPage />} />
            <Route path="instagram" element={<AdminInstagramPage />} />
            <Route path="anuncios-ia" element={<AdminAdsPage />} />
            <Route path="leads-conversao" element={<AdminLeadsConversionPage />} />
            <Route path="banco" element={<AdminDatabasePage />} />
            <Route path="relatorios" element={<AdminReportsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/painel-interno" replace />} />
        </Routes>
      </main>
    );
  }

  return (
    <AppShell header={<Header />} footer={<Footer />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
