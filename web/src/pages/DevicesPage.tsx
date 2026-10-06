import { useApp } from '../AppContext';

export default function DevicesPage() {
  const { health, healthLoading, refreshHealth } = useApp();
  const isOnline = health?.status === 'online';

  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Devices & Infrastructure</h2>
        <p className="page-subtitle">Your private cloud infrastructure overview.</p>
      </div>

      {/* Primary server card */}
      <div className="card" style={{ marginBottom: 20, borderTop: '3px solid var(--color-accent)' }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{
            width: 56, height: 56,
            background: 'var(--color-accent-bg)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-accent)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)' }}>Kali Linux Server</div>
              {healthLoading ? (
                <span className="badge badge-yellow">Checking…</span>
              ) : isOnline ? (
                <span className="badge badge-green">● Online</span>
              ) : (
                <span className="badge badge-red">● Offline</span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 99,
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--color-text-3)',
              }}>
                PRIMARY SERVER
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6, maxWidth: 500 }}>
              This is your private cloud server — an old laptop / PC running Kali Linux.
              SecureCloud stores all your files on this machine's local storage.
              No data is sent to any third-party cloud service.
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={refreshHealth}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Check Now
          </button>
        </div>
      </div>

      {/* Services grid */}
      <div className="card-title" style={{ marginBottom: 14 }}>Running Services</div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {[
          {
            name: 'Nextcloud',
            role: 'File Storage & Sharing',
            desc: 'Open-source private cloud platform. Handles file management, WebDAV access, and public link generation.',
            port: '8080',
            color: 'var(--color-accent)',
            icon: (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>
            ),
          },
          {
            name: 'MariaDB',
            role: 'Relational Database',
            desc: "Nextcloud's database backend. Stores file metadata, user data, sharing records, and configuration.",
            port: '3306 (internal)',
            color: '#c0392b',
            icon: (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125S3.75 11.278 3.75 9m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125S3.75 16.903 3.75 14.625" /></svg>
            ),
          },
          {
            name: 'Redis',
            role: 'Cache & Session Store',
            desc: 'High-performance in-memory store. Used for Nextcloud caching and the bot session management.',
            port: '6379 (internal)',
            color: '#e53e3e',
            icon: (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 00.9 2.7M15 11.25a3 3 0 100-6H9a3 3 0 000 6m6 0h.008v.008H15V11.25zm-6 0h.008v.008H9V11.25z" /></svg>
            ),
          },
          {
            name: 'SecureCloud Bot',
            role: 'WhatsApp API Bridge',
            desc: 'Node.js/TypeScript service. Handles WhatsApp webhooks and bridges to Nextcloud via WebDAV.',
            port: '3000',
            color: 'var(--color-success)',
            icon: (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
            ),
          },
        ].map((svc) => (
          <div key={svc.name} className="card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40,
                background: `${svc.color}15`,
                border: `1px solid ${svc.color}30`,
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, color: svc.color,
              }}>
                {svc.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{svc.name}</div>
                  {isOnline
                    ? <span className="badge badge-green" style={{ fontSize: 10 }}>Running</span>
                    : <span className="badge badge-gray" style={{ fontSize: 10 }}>Unknown</span>}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-3)', marginBottom: 6 }}>{svc.role}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-2)', lineHeight: 1.5 }}>{svc.desc}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                  Port: {svc.port}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Architecture note */}
      <div className="card card-sm" style={{ background: 'var(--color-surface-2)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--color-text-2)' }}>Architecture:</strong>
          {' '}All services run inside Docker containers on your Kali Linux machine.
          Nextcloud stores files on the device's local HDD/SSD.
          MariaDB manages metadata. Redis handles caching and session data.
          The SecureCloud Bot provides the WhatsApp interface and this web API.
          {' '}<strong style={{ color: 'var(--color-text-2)' }}>No data leaves your machine.</strong>
        </div>
      </div>
    </div>
  );
}
