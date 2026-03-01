import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { NavBar } from './components/NavBar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectGroupListPage } from './pages/ProjectGroupListPage';
import { ProjectGroupDetailPage } from './pages/ProjectGroupDetailPage';
import { SyncPage } from './pages/SyncPage';
import { ReviewListPage } from './pages/ReviewListPage';
import { ReviewDetailPage } from './pages/ReviewDetailPage';

export function App() {
  const { isAuthenticated, login, logout, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <LoginPage onLogin={login} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <header style={{
          background: '#1a1a2e', color: '#fff', padding: '12px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <h1 style={{ margin: 0, fontSize: '18px' }}>AI Project Sync</h1>
            <NavBar />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>{user?.name || user?.email}</span>
            <button onClick={logout} style={{
              background: 'transparent', color: '#ccc', border: '1px solid #555',
              padding: '4px 12px', borderRadius: '4px', cursor: 'pointer',
            }}>
              退出
            </button>
          </div>
        </header>
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/project-groups" element={<ProjectGroupListPage />} />
            <Route path="/project-groups/:id" element={<ProjectGroupDetailPage />} />
            <Route path="/sync" element={<SyncPage />} />
            <Route path="/reviews" element={<ReviewListPage />} />
            <Route path="/reviews/:id" element={<ReviewDetailPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
