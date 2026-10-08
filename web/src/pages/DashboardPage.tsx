import { useState } from 'react';
import { useApp } from '../AppContext';
import { listFiles, fetchStorage, listShares } from '../api';

interface Props {
  onNav: (page: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function DashboardPage({ onNav }: Props) {
  const { health, healthLoading, refreshHealth } = useApp();
  const [storageInfo, setStorageInfo] = useState<{ usedBytes: number; totalBytes: number | null; freeBytes: number | null } | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [sharesCount, setSharesCount] = useState<number | null>(null);
  const [recentFiles, setRecentFiles] = useState<Array<{ filename: string; size: number; path: string; isFolder: boolean }>>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load dashboard data when health is online
  const loadData = async () => {
    if (health?.status !== 'online') return;
    if (dataLoaded) return;
    setStorageLoading(true);
    setFilesLoading(true);
    try {
      const [files, storage, shares] = await Promise.allSettled([
        listFiles(),
        fetchStorage(),
        listShares(),
      ]);
      if (files.status === 'fulfilled') {
        setFileCount(files.value.length);
        setRecentFiles(files.value.slice(-5).reverse());
      }
      if (storage.status === 'fulfilled') setStorageInfo(storage.value);
      if (shares.status === 'fulfilled') setSharesCount(shares.value.length);
      setDataLoaded(true);
    } finally {
      setStorageLoading(false);
      setFilesLoading(false);
    }
  };

  // Trigger load when health becomes online
  if (health?.status === 'online' && !dataLoaded && !storageLoading) {
    loadData();
  }

  const isOnline = health?.status === 'online';
  const storageUsedPct =
    storageInfo && storageInfo.totalBytes
      ? Math.min(100, (storageInfo.usedBytes / storageInfo.totalBytes) * 100)
      : null;

  return (
    <div className="page-content">
      {/* ── Offline banner ── */}
      {!healthLoading && health?.status !== 'online' && (
        <div className="offline-banner">
          <div className="offline-banner-icon">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="offline-banner-title">Server Offline</div>
            <div className="offline-banner-body">
              Your Kali Linux server is currently unreachable. Turn on your server to access files.<br />
              {health?.checkedAt && (
                <span style={{ fontSize: 11.5, opacity: 0.8 }}>
                  Last checked: {new Date(health.checkedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={refreshHealth}>
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="hero-card">
        <div className="hero-content">
          <div className="hero-eyebrow">Private Infrastructure</div>
          <h1 className="hero-title">Turn Your Laptop<br />Into a Private Cloud.</h1>
          <p className="hero-subtitle">
            Securely store your important files on your own device and access them anywhere through SecureCloud.
            No third-party dependency. No subscription.
          </p>
          <div className="feature-pills">
            <span className="feature-pill">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Private &amp; Secure
            </span>
            <span className="feature-pill">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
              Powered by Nextcloud
            </span>
            <span className="feature-pill">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Controlled Sharing
            </span>
            <span className="feature-pill">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
              Docker-Containerised
            </span>
          </div>
          <div className="hero-actions">
            <button
              id="hero-upload-btn"
              className="btn btn-primary"
              disabled={!isOnline}
              onClick={() => onNav('files')}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Upload File
            </button>
            <button className="btn btn-secondary" onClick={() => onNav('files')}>
              My Files →
            </button>
          </div>
        </div>
        <div className="hero-image">
          <img src="/hero.jpg" alt="Your laptop as a private cloud server" />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Files</div>
          <div className="stat-value">
            {!isOnline ? '—' : filesLoading ? <span className="spinner" /> : (fileCount ?? '—')}
          </div>
          <div className="stat-sub">
            {isOnline ? 'on your server' : 'server offline'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Storage Used</div>
          <div className="stat-value">
            {!isOnline ? '—' : storageLoading ? <span className="spinner" /> :
              storageInfo ? formatBytes(storageInfo.usedBytes) : '—'}
          </div>
          <div className="stat-sub">
            {storageInfo?.totalBytes ? `of ${formatBytes(storageInfo.totalBytes)}` : 'your server storage'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Shares</div>
          <div className="stat-value">
            {!isOnline ? '—' : filesLoading ? <span className="spinner" /> : (sharesCount ?? '—')}
          </div>
          <div className="stat-sub">public share links</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Server</div>
          <div className="stat-value" style={{ fontSize: 16, paddingTop: 4 }}>
            {healthLoading ? (
              <span className="spinner" />
            ) : isOnline ? (
              <span className="badge badge-green">● Online</span>
            ) : (
              <span className="badge badge-red">● Offline</span>
            )}
          </div>
          <div className="stat-sub">Kali Linux</div>
        </div>
      </div>

      {/* ── Storage bar + Quick actions row ── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Storage */}
        <div className="card">
          <div className="card-title">Server Storage</div>
          {!isOnline ? (
            <div style={{ color: 'var(--color-text-3)', fontSize: 13 }}>
              Storage information unavailable while server is offline.
            </div>
          ) : storageLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-3)', fontSize: 13 }}>
              <span className="spinner spinner-sm" /> Loading storage info…
            </div>
          ) : storageInfo ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-2)' }}>
                  {formatBytes(storageInfo.usedBytes)} used
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                  {storageInfo.totalBytes ? formatBytes(storageInfo.totalBytes) : '∞'} total
                </span>
              </div>
              <div className="storage-bar-track">
                <div
                  className="storage-bar-fill"
                  style={{ width: `${storageUsedPct ?? 0}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--color-text-3)' }}>
                  {storageUsedPct !== null ? `${storageUsedPct.toFixed(1)}% used` : ''}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--color-success)', fontWeight: 600 }}>
                  {storageInfo.freeBytes ? `${formatBytes(storageInfo.freeBytes)} available` : ''}
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>Storage data unavailable.</div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-title">Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn btn-primary"
              disabled={!isOnline}
              onClick={() => onNav('files')}
              id="quick-upload-btn"
              style={{ justifyContent: 'flex-start' }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Upload File
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNav('files')}
              id="quick-files-btn"
              style={{ justifyContent: 'flex-start' }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              Open My Files
            </button>
            <button
              className="btn btn-secondary"
              disabled={!isOnline}
              onClick={() => onNav('shares')}
              id="quick-share-btn"
              style={{ justifyContent: 'flex-start' }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Manage Share Links
            </button>
          </div>
        </div>
      </div>

      {/* ── Recent files ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>Recent Files</div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNav('files')}>View all →</button>
        </div>

        {!isOnline ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a5 5 0 010-7.07M6.343 17.657a9 9 0 010-12.728m3.536 3.536a5 5 0 010 7.07" /></svg>
            </div>
            <div className="empty-state-title">Files Unavailable</div>
            <div className="empty-state-body">Your SecureCloud server is offline. Turn on your Kali laptop to retrieve your files.</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={refreshHealth}>
              Retry Connection
            </button>
          </div>
        ) : filesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
            <span className="spinner" />
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No files yet</div>
            <div className="empty-state-body">Upload your first file to get started.</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => onNav('files')}>
              Upload File
            </button>
          </div>
        ) : (
          <table className="file-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {recentFiles.map((f) => {
                const ext = f.filename.split('.').pop()?.toLowerCase() || '';
                const iconType = ['pdf'].includes(ext) ? 'pdf'
                  : ['doc', 'docx', 'txt', 'md'].includes(ext) ? 'doc'
                  : ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext) ? 'img'
                  : ['zip', 'rar', 'tar', 'gz'].includes(ext) ? 'zip'
                  : ['mp4', 'mkv', 'avi', 'mov'].includes(ext) ? 'vid'
                  : 'other';
                return (
                  <tr key={f.filename}>
                    <td>
                      <div className="file-name-cell">
                        <div className={`file-type-icon ${iconType}`}>{ext.slice(0, 3).toUpperCase()}</div>
                        <span className="file-name-text">{f.filename}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-text-3)', fontSize: 12 }}>{formatBytes(f.size)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
