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
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminBannersPage from './pages/AdminBannersPage';
import AdminCouponsPage from './pages/AdminCouponsPage';

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/painel-interno');

  if (isAdminRoute) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <Routes>
          <Route path="/painel-interno/login" element={<AdminLoginPage />} />
          <Route path="/painel-interno" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="produtos" element={<AdminProductsPage />} />
            <Route path="pedidos" element={<AdminOrdersPage />} />
            <Route path="cupons" element={<AdminCouponsPage />} />
            <Route path="banners" element={<AdminBannersPage />} />
            <Route path="configuracoes" element={<AdminSettingsPage />} />
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
