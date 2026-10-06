import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../AppContext';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function StoragePage() {
  const { health, addToast } = useApp();
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number; totalBytes: number | null; freeBytes: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const isOnline = health?.status === 'online';

  const loadStorage = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const { fetchStorage } = await import('../api');
      setStorageInfo(await fetchStorage());
    } catch (err: any) {
      addToast(err.message || 'Failed to load storage info', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOnline, addToast]);

  useEffect(() => { loadStorage(); }, [loadStorage]);

  const usedPct = storageInfo && storageInfo.totalBytes
    ? Math.min(100, (storageInfo.usedBytes / storageInfo.totalBytes) * 100)
    : null;

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Server Storage</h2>
        <p className="page-subtitle">Storage on your Kali Linux machine, powered by Nextcloud.</p>
      </div>

      {!isOnline ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', border: '1px solid #fecaca', background: 'var(--color-error-bg)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#991b1b', marginBottom: 6 }}>Server Offline</div>
          <div style={{ fontSize: 13, color: '#b91c1c', maxWidth: 360, margin: '0 auto' }}>
            Storage information cannot be retrieved while your server is offline.
          </div>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><span className="spinner" /></div>
      ) : storageInfo ? (
        <>
          {/* Overview card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Your Server Storage</div>
            <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>
                  {formatBytes(storageInfo.usedBytes)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Used</div>
              </div>
              <div style={{ width: 1, background: 'var(--color-border-light)' }} />
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-success)' }}>
                  {storageInfo.freeBytes ? formatBytes(storageInfo.freeBytes) : '∞'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Available</div>
              </div>
              <div style={{ width: 1, background: 'var(--color-border-light)' }} />
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text-2)' }}>
                  {storageInfo.totalBytes ? formatBytes(storageInfo.totalBytes) : '∞'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>Total</div>
              </div>
            </div>

            <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                {usedPct !== null ? `${usedPct.toFixed(1)}% used` : ''}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                {storageInfo.totalBytes ? formatBytes(storageInfo.totalBytes) : 'Unlimited'}
              </span>
            </div>
            <div className="storage-bar-track" style={{ height: 10 }}>
              <div
                className="storage-bar-fill"
                style={{
                  width: `${usedPct ?? 0}%`,
                  background: usedPct && usedPct > 85
                    ? 'var(--color-error)'
                    : usedPct && usedPct > 65
                    ? 'var(--color-warning)'
                    : 'var(--color-accent)',
                }}
              />
            </div>
          </div>

          {/* Info cards */}
          <div className="grid-3">
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-3)', marginBottom: 8 }}>
                Storage Source
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Kali Linux HDD/SSD</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>Your physical device storage</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-3)', marginBottom: 8 }}>
                Storage Manager
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Nextcloud 29</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>Open-source private cloud</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-3)', marginBottom: 8 }}>
                Data Residency
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Your Device</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>No third-party dependency</div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-title">Storage data unavailable</div>
          <div className="empty-state-body">Could not retrieve storage information from the server.</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={loadStorage}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
