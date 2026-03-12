import React, { useContext } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AnalyticsTracker from './components/AnalyticsTracker';
import NavBar from './components/NavBar';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import AiPage from './pages/AiPage';
import AuthPage from './pages/AuthPage';
import BlogCreatePage from './pages/BlogCreatePage';
import BlogListPage from './pages/BlogListPage';
import BlogPostPage from './pages/BlogPostPage';
import DashboardPage from './pages/DashboardPage';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import RankingPage from './pages/RankingPage';
import TestsPage from './pages/TestsPage';
import AdminApp from './admin/AdminApp';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">Yuklanmoqda...</section>
      </div>
    );
  }

  return user ? children : <Navigate to="/auth" />;
};

const PublicApp = () => (
  <PublicAppLayout />
);

const PublicAppLayout = () => {
  const location = useLocation();
  const isAiRoute = location.pathname === '/ai';

  return (
    <div className={isAiRoute ? 'app-root ai-standalone' : 'app-root'}>
      {!isAiRoute && <NavBar />}

      <main className={isAiRoute ? 'app-main ai-standalone-main' : 'app-main'}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/tests" element={<TestsPage />} />
        <Route path="/tests/:category" element={<TestsPage />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route
          path="/blog/create"
          element={(
            <PrivateRoute>
              <BlogCreatePage />
            </PrivateRoute>
          )}
        />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route
          path="/dashboard"
          element={(
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          )}
        />
        <Route
          path="/ai"
          element={(
            <PrivateRoute>
              <AiPage />
            </PrivateRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </main>

      {!isAiRoute && (
        <footer className="app-footer">
          <div className="site-container app-footer-inner">
            <span>© 2026 Lawinate Digital. Barcha huquqlar himoyalangan.</span>
            <div className="footer-links">
              <span>Full-stack</span>
              <span>•</span>
              <span>React + Express + SQLite</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

const AppRouter = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  return isAdminRoute ? <AdminApp /> : <PublicApp />;
};

function App() {
  return (
    <AuthProvider>
      <AnalyticsTracker />
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
