import { useState } from 'react';
import { useApp } from './AppContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FilesPage from './pages/FilesPage';
import SharedLinksPage from './pages/SharedLinksPage';
import StoragePage from './pages/StoragePage';
import DevicesPage from './pages/DevicesPage';
import SecurityPage from './pages/SecurityPage';
import { isLoggedIn, logout } from './api';

type Page = 'dashboard' | 'files' | 'shares' | 'devices' | 'storage' | 'security';

function StatusDot({ status }: { status: string }) {
  return <span className={`status-dot ${status}`} />;
}

function ServerStatusChip({ onClick }: { onClick: () => void }) {
  const { health, healthLoading } = useApp();

  const statusClass = healthLoading ? 'checking' : health?.status === 'online' ? 'online' : 'offline';
  const label = healthLoading
    ? 'Checking…'
    : health?.status === 'online'
    ? 'Server Online'
    : 'Server Offline';

  return (
    <button className={`server-status-chip ${statusClass}`} onClick={onClick} id="server-status-chip">
      <StatusDot status={healthLoading ? 'checking' : health?.status === 'online' ? 'online' : 'offline'} />
      {label}
    </button>
  );
}

function ServerDetailModal({ onClose }: { onClose: () => void }) {
  const { health, healthLoading, refreshHealth } = useApp();
  const isOnline = health?.status === 'online';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 400 }}>
        <div className="modal-header">
          <div className="modal-title">Server Status</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {[
          { key: 'Server', value: 'Kali Linux' },
          { key: 'Status', value: healthLoading ? 'Checking…' : isOnline ? 'Online ✓' : 'Offline ✗' },
          { key: 'SecureCloud', value: isOnline ? 'Running' : 'Unreachable' },
          { key: 'Nextcloud', value: health?.nextcloud ? 'Running' : (isOnline ? 'Degraded' : 'Unknown') },
          { key: 'Database', value: 'MariaDB 11.4' },
          { key: 'Cache / Session', value: 'Redis 7' },
          { key: 'Storage', value: isOnline ? 'Available' : 'Unavailable' },
          { key: 'Last Checked', value: health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : '—' },
        ].map((row) => (
          <div key={row.key} className="server-detail-row">
            <span className="server-detail-key">{row.key}</span>
            <span className="server-detail-value"
              style={{ color: row.key === 'Status' ? (isOnline ? 'var(--color-success)' : 'var(--color-error)') : 'var(--color-text)' }}>
              {row.value}
            </span>
          </div>
        ))}

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={refreshHealth} disabled={healthLoading}>
            {healthLoading ? <><span className="spinner spinner-sm" /> Checking…</> : 'Check Now'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts, removeToast } = useApp();
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)}>
          {t.type === 'success' && '✓ '}
          {t.type === 'error' && '✕ '}
          {t.message}
        </div>
      ))}
    </div>
  );
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ReactElement }[] = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    id: 'files', label: 'My Files',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  },
  {
    id: 'shares', label: 'Shared Links',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
  },
  {
    id: 'devices', label: 'Devices',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" /></svg>,
  },
  {
    id: 'storage', label: 'Storage',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
  },
  {
    id: 'security', label: 'Security',
    icon: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [page, setPage] = useState<Page>('dashboard');
  const [showServerModal, setShowServerModal] = useState(false);
  const { health, setSearchQuery, searchQuery } = useApp();

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  function handleLogout() {
    logout();
    setLoggedIn(false);
  }

  const isOnline = health?.status === 'online';

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.jpg" alt="SecureCloud logo" />
          <div>
            <div className="sidebar-brand-name">SecureCloud</div>
            <div className="sidebar-brand-tagline">Your Device. Your Cloud.</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`sidebar-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Server badge in sidebar */}
          <div className="sidebar-server-badge">
            <StatusDot status={isOnline ? 'online' : 'offline'} />
            <div>
              <div className="sidebar-server-name">Kali Linux</div>
              <div className="sidebar-server-label">Your Server</div>
            </div>
          </div>

          <button
            id="nav-settings"
            className="sidebar-item"
            style={{ width: '100%' }}
            onClick={() => setPage('security')}
          >
            <span className="sidebar-item-icon">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </span>
            Settings
          </button>
          <button id="nav-logout" className="sidebar-item" onClick={handleLogout} style={{ width: '100%' }}>
            <span className="sidebar-item-icon">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-search">
            <svg className="topbar-search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              id="global-search"
              type="text"
              placeholder="Search files…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="topbar-spacer" />

          <div className="topbar-right">
            <ServerStatusChip onClick={() => setShowServerModal(true)} />
            <div className="topbar-avatar" title="Logged in" onClick={handleLogout}>
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        {page === 'dashboard' && <DashboardPage onNav={(p) => setPage(p as Page)} />}
        {page === 'files' && <FilesPage />}
        {page === 'shares' && <SharedLinksPage />}
        {page === 'devices' && <DevicesPage />}
        {page === 'storage' && <StoragePage />}
        {page === 'security' && <SecurityPage />}
      </div>

      {/* Server detail modal */}
      {showServerModal && <ServerDetailModal onClose={() => setShowServerModal(false)} />}

      {/* Toast notifications */}
      <Toasts />
    </div>
  );
}
