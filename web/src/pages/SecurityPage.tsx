export default function SecurityPage() {
  return (
    <div className="page-content">
      <div className="page-header">
        <h2 className="page-title">Security</h2>
        <p className="page-subtitle">How SecureCloud protects your files and data.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          {
            title: 'Private Infrastructure',
            icon: '🏠',
            color: 'var(--color-accent)',
            bg: 'var(--color-accent-bg)',
            desc: 'Your files are stored exclusively on your own Kali Linux machine. No data is sent to Amazon, Google, Microsoft, or any third-party cloud provider. You own and control the physical hardware where your data lives.',
          },
          {
            title: 'Authenticated Access',
            icon: '🔑',
            color: 'var(--color-success)',
            bg: 'var(--color-success-bg)',
            desc: 'Access to the SecureCloud web interface requires a valid session token. File operations via the bot require a dedicated Nextcloud app password — your main credentials are never exposed.',
          },
          {
            title: 'Controlled Sharing',
            icon: '🔗',
            color: '#7c3aed',
            bg: '#faf5ff',
            desc: 'Public share links are generated through Nextcloud\'s OCS Share API. Each link is scoped to a single file with optional password protection and expiry date. Sharing one file does not expose your entire account.',
          },
          {
            title: 'Containerised Services',
            icon: '📦',
            color: '#0891b2',
            bg: '#ecfeff',
            desc: 'All services (Nextcloud, MariaDB, Redis, SecureCloud Bot) run inside Docker containers. Container isolation provides process separation and makes it easier to update individual services without affecting others.',
          },
          {
            title: 'Secrets Never Exposed',
            icon: '🛡️',
            color: 'var(--color-warning)',
            bg: 'var(--color-warning-bg)',
            desc: 'Database passwords, Redis credentials, Nextcloud admin password, and API tokens are never sent to the browser. All sensitive operations are performed server-side. Environment variables are never committed to version control.',
          },
          {
            title: 'Path Traversal Protection',
            icon: '🚫',
            color: 'var(--color-error)',
            bg: 'var(--color-error-bg)',
            desc: 'File operations sanitize and validate all filenames before passing them to Nextcloud WebDAV. Directory traversal sequences (../) are rejected. User file selections are resolved against server-side session state — never raw user input.',
          },
        ].map((item) => (
          <div key={item.title} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 44, height: 44,
              background: item.bg,
              border: `1px solid ${item.color}25`,
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)', marginBottom: 6 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.65, maxWidth: 560 }}>
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card card-sm" style={{ marginTop: 20, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--color-text-2)' }}>Honest Security Statement:</strong>
          {' '}SecureCloud provides private, self-hosted file storage. Security depends on your network configuration,
          physical device security, and keeping software up to date. We do not claim invulnerability.
          For highly sensitive data, additional network-level controls (VPN, firewall rules) are recommended.
        </div>
      </div>
    </div>
  );
}
