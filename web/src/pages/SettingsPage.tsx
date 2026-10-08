import { useState } from 'react';
import { useApp } from '../AppContext';
import { logout } from '../api';

interface Props {
  onLogout: () => void;
}

export default function SettingsPage({ onLogout }: Props) {
  const { health, refreshHealth, addToast } = useApp();
  const [showToken, setShowToken] = useState(false);
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin;

  function handleLogout() {
    logout();
    onLogout();
  }

  async function handleCheckHealth() {
    await refreshHealth();
    addToast('Server status refreshed', 'info');
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">Connection settings, session management, and system information.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Connection */}
        <div className="card">
          <div className="card-title">Connection</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'API Server', value: apiBase },
              { label: 'Server Status', value: health?.status === 'online' ? '● Online' : '● Offline' },
              { label: 'Last Health Check', value: health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : '—' },
              { label: 'Nextcloud Status', value: health?.nextcloud ? 'Connected' : 'Not detected' },
            ].map((row) => (
              <div key={row.label} className="server-detail-row">
                <span className="server-detail-key">{row.label}</span>
                <span className="server-detail-value"
                  style={{
                    color: row.label === 'Server Status'
                      ? (health?.status === 'online' ? 'var(--color-success)' : 'var(--color-error)')
                      : 'var(--color-text)',
                    fontFamily: row.label === 'API Server' ? 'monospace' : undefined,
                    fontSize: row.label === 'API Server' ? 12 : undefined,
                  }}>
                  {row.value}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleCheckHealth}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Server Status
              </button>
            </div>
          </div>
        </div>

        {/* Session */}
        <div className="card">
          <div className="card-title">Session</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 12, lineHeight: 1.6 }}>
            You are currently authenticated to this SecureCloud instance.
            Your session token is stored in browser sessionStorage — it will be automatically
            cleared when you close this tab.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button id="settings-logout-btn" className="btn btn-danger btn-sm" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Environment Info */}
        <div className="card">
          <div className="card-title">Environment</div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', lineHeight: 1.8, color: 'var(--color-text-2)' }}>
            <div><span style={{ color: 'var(--color-text-3)' }}>VITE_API_BASE_URL</span> = {apiBase}</div>
            <div><span style={{ color: 'var(--color-text-3)' }}>Frontend Version</span> = 1.0.0</div>
            <div><span style={{ color: 'var(--color-text-3)' }}>Storage Engine</span> = Nextcloud 29 (WebDAV)</div>
            <div><span style={{ color: 'var(--color-text-3)' }}>Auth Method</span> = Bearer Token (sessionStorage)</div>
          </div>
        </div>

        {/* Reconfiguration help */}
        <div className="card">
          <div className="card-title">Changing Server Address</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 10, lineHeight: 1.6 }}>
            To connect this frontend to a different server (e.g. moving from LAN IP to a domain name):
          </p>
          <ol style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.8, paddingLeft: 20, marginBottom: 0 }}>
            <li>Open <code style={{ fontSize: 12 }}>web/.env.local</code></li>
            <li>Update <code style={{ fontSize: 12 }}>VITE_API_BASE_URL</code> to your new server address</li>
            <li>Run <code style={{ fontSize: 12 }}>npm run build</code> to rebuild the frontend</li>
            <li>No other source-code changes needed</li>
          </ol>
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
            # LAN deployment example<br />
            VITE_API_BASE_URL=http://192.168.1.50:3000<br />
            <br />
            # Future domain/HTTPS deployment<br />
            VITE_API_BASE_URL=https://securecloud.example.com
          </div>
        </div>
      </div>
    </div>
  );
}
