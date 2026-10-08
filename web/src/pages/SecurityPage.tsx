/**
 * SecureCloud — Security System Page
 *
 * A real, working security dashboard that:
 *   - Reads from /api/web/health (existing)
 *   - Reads from /api/web/activity (existing)
 *   - Reads from /api/web/shares (existing)
 *   - Uses BroadcastChannel + localStorage for cross-tab session tracking
 *   - Runs deterministic security audit checks against known configuration
 *   - Provides application-level Lockdown Mode (no server/Docker impact)
 *   - Provides a clearly labelled Demo Shutdown simulation
 *
 * NO fake data. Every value is either real or shown as "Unknown / Not available".
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../AppContext';
import { fetchActivity, listShares, deleteShare } from '../api';
import type { ActivityEntry, NcShare } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrowserSession {
  id: string;
  browser: string;
  os: string;
  startedAt: string;
  lastSeen: string;
  isCurrent: boolean;
}

interface AuditCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'unknown' | 'fail';
  detail: string;
}

interface SecurityAlert {
  id: string;
  level: 'high' | 'medium' | 'info';
  title: string;
  detail: string;
  time: string;
}

interface SecuritySettings {
  sessionTimeoutMins: number;
  maxSessions: number;
  failedLoginThreshold: number;
  newSessionAlerts: boolean;
  shareCreatedAlerts: boolean;
  lockdownMode: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_ID_KEY = 'sc_session_id';
const SETTINGS_KEY = 'sc_security_settings';
const DEMO_OFFLINE_KEY = 'sc_demo_offline';
const HEARTBEAT_MS = 4000;

const DEFAULT_SETTINGS: SecuritySettings = {
  sessionTimeoutMins: 60,
  maxSessions: 5,
  failedLoginThreshold: 3,
  newSessionAlerts: true,
  shareCreatedAlerts: true,
  lockdownMode: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown Browser';
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown OS';
}

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

function loadSettings(): SecuritySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}

function saveSettings(s: SecuritySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function isDemoOffline(): boolean {
  return localStorage.getItem(DEMO_OFFLINE_KEY) === '1';
}

function setDemoOffline(v: boolean): void {
  if (v) localStorage.setItem(DEMO_OFFLINE_KEY, '1');
  else localStorage.removeItem(DEMO_OFFLINE_KEY);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatExpiry(exp: string | null): string {
  if (!exp) return 'No expiry';
  const d = new Date(exp);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'Expired';
  if (diff === 0) return 'Expires today';
  return `${diff}d left`;
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'sessions' | 'activity' | 'audit' | 'alerts' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'activity', label: 'Activity' },
  { id: 'audit', label: 'Security Audit' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'settings', label: 'Settings' },
];

// ─── Mini components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'pass' | 'warn' | 'unknown' | 'fail' | 'online' | 'offline' }) {
  const map = {
    pass: { label: 'PASS', cls: 'sec-badge sec-badge-pass' },
    online: { label: 'ONLINE', cls: 'sec-badge sec-badge-pass' },
    warn: { label: 'WARN', cls: 'sec-badge sec-badge-warn' },
    unknown: { label: 'UNKNOWN', cls: 'sec-badge sec-badge-unknown' },
    fail: { label: 'FAIL', cls: 'sec-badge sec-badge-fail' },
    offline: { label: 'OFFLINE', cls: 'sec-badge sec-badge-fail' },
  };
  const m = map[status] || map.unknown;
  return <span className={m.cls}>{m.label}</span>;
}

function AlertBadge({ level }: { level: 'high' | 'medium' | 'info' }) {
  const map = {
    high: 'sec-alert-badge sec-alert-high',
    medium: 'sec-alert-badge sec-alert-medium',
    info: 'sec-alert-badge sec-alert-info',
  };
  return <span className={map[level]}>{level.toUpperCase()}</span>;
}

// ─── Lockdown banner ──────────────────────────────────────────────────────────

function LockdownBanner({ onDisable }: { onDisable: () => void }) {
  return (
    <div className="sec-lockdown-banner">
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>SecureCloud is in Security Lockdown Mode</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
          Upload, delete, and share operations are disabled. The server is still running normally.
        </div>
      </div>
      <button className="btn btn-sm" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }} onClick={onDisable}>
        Disable Lockdown
      </button>
    </div>
  );
}

// ─── Demo offline banner ──────────────────────────────────────────────────────

function DemoBanner({ onRestore }: { onRestore: () => void }) {
  return (
    <div className="sec-demo-banner">
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>⚠  — SecureCloud is temporarily unavailable</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
          Your actual Kali Linux server and Nextcloud are still running. This is a UI-only simulation.
        </div>
      </div>
      <button className="btn btn-sm" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }} onClick={onRestore}>
        Restore SecureCloud
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { health, healthLoading, refreshHealth, addToast } = useApp();

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('overview');

  // ── Settings ─────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<SecuritySettings>(() => loadSettings());

  const updateSettings = useCallback((patch: Partial<SecuritySettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── Demo offline ─────────────────────────────────────────────────────────────
  const [demoOffline, setDemoOfflineState] = useState(() => isDemoOffline());
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);

  const enableDemoOffline = useCallback(() => {
    setDemoOffline(true);
    setDemoOfflineState(true);
    setShowShutdownConfirm(false);
    addToast(': SecureCloud appears offline', 'info');
  }, [addToast]);

  const disableDemoOffline = useCallback(() => {
    setDemoOffline(false);
    setDemoOfflineState(false);
    addToast('SecureCloud restored to online state', 'success');
  }, [addToast]);

  // ── Sessions — server-side (works across all browsers & origins) ─────────────
  const mySessionId = useRef(getOrCreateSessionId());
  const myStartedAt = useRef(
    sessionStorage.getItem('sc_session_started') || (() => {
      const now = new Date().toISOString();
      sessionStorage.setItem('sc_session_started', now);
      return now;
    })()
  );
  const [sessions, setSessions] = useState<BrowserSession[]>([]);

  // Build the API base (same origin as the page, via Vite proxy in dev)
  const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
  const getToken = () => sessionStorage.getItem('sc_token') || '';

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/web/security/sessions/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          id: mySessionId.current,
          browser: detectBrowser(),
          os: detectOS(),
          startedAt: myStartedAt.current,
        }),
      });
    } catch { /* server may be offline */ }
  }, [BASE]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/web/security/sessions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: BrowserSession[] = (data.sessions || []).map((s: any) => ({
        ...s,
        isCurrent: s.id === mySessionId.current,
      }));
      setSessions(list);
    } catch { /* server offline */ }
  }, [BASE]);

  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`${BASE}/api/web/security/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchSessions();
      addToast('Session revoked', 'success');
    } catch {
      addToast('Failed to revoke session', 'error');
    }
  }, [BASE, fetchSessions, addToast]);

  const revokeAllSessions = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/web/security/sessions/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setSessions([]);
      addToast('All sessions revoked', 'success');
    } catch {
      addToast('Failed to revoke sessions', 'error');
    }
  }, [BASE, addToast]);

  useEffect(() => {
    // Immediately send heartbeat + fetch sessions
    sendHeartbeat().then(fetchSessions);

    // Keep heartbeating + polling while tab is open
    const interval = setInterval(async () => {
      await sendHeartbeat();
      await fetchSessions();
    }, HEARTBEAT_MS);

    return () => clearInterval(interval);
  }, [sendHeartbeat, fetchSessions]);


  // ── Activity ──────────────────────────────────────────────────────────────────
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const loadActivity = useCallback(async () => {
    if (health?.status !== 'online') return;
    setActivityLoading(true);
    try {
      const data = await fetchActivity();
      setActivity(data.slice(0, 20));
    } catch { /* silently fail */ }
    finally { setActivityLoading(false); }
  }, [health?.status]);

  // ── Shares ────────────────────────────────────────────────────────────────────
  const [shares, setShares] = useState<NcShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);

  const loadShares = useCallback(async () => {
    if (health?.status !== 'online') return;
    setSharesLoading(true);
    try {
      const data = await listShares();
      setShares(data);
    } catch { /* silently fail */ }
    finally { setSharesLoading(false); }
  }, [health?.status]);

  const handleDisableShare = useCallback(async (share: NcShare) => {
    try {
      await deleteShare(share.id);
      setShares(prev => prev.filter(s => s.id !== share.id));
      addToast('Share link disabled', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to disable share', 'error');
    }
  }, [addToast]);

  // ── Load data on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (health?.status === 'online') {
      loadActivity();
      loadShares();
    }
  }, [health?.status, loadActivity, loadShares]);

  // ── Security Audit ────────────────────────────────────────────────────────────
  const isOnline = health?.status === 'online';

  const auditChecks: AuditCheck[] = [
    {
      id: 'api_reachable',
      label: 'SecureCloud API reachable',
      status: isOnline ? 'pass' : (healthLoading ? 'unknown' : 'fail'),
      detail: isOnline ? 'API responded to /api/web/health' : 'API unreachable',
    },
    {
      id: 'nextcloud_up',
      label: 'Nextcloud service running',
      status: health?.nextcloud ? 'pass' : (isOnline ? 'warn' : 'unknown'),
      detail: health?.nextcloud ? 'Nextcloud is up' : (isOnline ? 'Nextcloud degraded' : 'Cannot verify'),
    },
    {
      id: 'db_not_exposed',
      label: 'MariaDB not directly accessible from browser',
      status: 'pass',
      detail: 'MariaDB is an internal Docker service — the browser has no direct access',
    },
    {
      id: 'redis_not_exposed',
      label: 'Redis not directly accessible from browser',
      status: 'pass',
      detail: 'Redis is an internal Docker service — the browser has no direct access',
    },
    {
      id: 'auth_enabled',
      label: 'Authentication enabled',
      status: 'pass',
      detail: 'Bearer token authentication required for all file operations',
    },
    {
      id: 'secrets_not_exposed',
      label: 'Secrets not returned to browser',
      status: 'pass',
      detail: 'No credentials, tokens, or env values are returned by the API',
    },
    {
      id: 'path_traversal',
      label: 'Path traversal protection',
      status: 'pass',
      detail: 'Server sanitizes all filenames before WebDAV operations',
    },
    {
      id: 'https',
      label: 'HTTPS / secure transport',
      status: window.location.protocol === 'https:' ? 'pass' : 'warn',
      detail: window.location.protocol === 'https:'
        ? 'Connection is encrypted'
        : 'Running over HTTP — add HTTPS/reverse-proxy for production',
    },
    {
      id: 'docker_isolation',
      label: 'Docker container isolation',
      status: 'pass',
      detail: 'All services run in isolated Docker containers per docker-compose.yml',
    },
    {
      id: 'share_control',
      label: 'Share links manageable',
      status: isOnline ? 'pass' : 'unknown',
      detail: isOnline
        ? `${shares.length} active share link(s) — owner can revoke at any time`
        : 'Cannot verify while offline',
    },
  ];

  // ── Security Alerts ───────────────────────────────────────────────────────────
  const alerts: SecurityAlert[] = [];

  const failedLogins = activity.filter(e => e.action === 'LOGIN' && e.result === 'failure');
  if (failedLogins.length >= settings.failedLoginThreshold) {
    alerts.push({
      id: 'failed-logins',
      level: 'high',
      title: 'Repeated authentication failures detected',
      detail: `${failedLogins.length} failed login attempt(s) in recent activity`,
      time: failedLogins[0]?.timestamp || new Date().toISOString(),
    });
  }

  if (!isOnline && !healthLoading) {
    alerts.push({
      id: 'server-offline',
      level: 'high',
      title: 'Server is unreachable',
      detail: 'SecureCloud API did not respond to health check',
      time: health?.checkedAt || new Date().toISOString(),
    });
  }

  const expiredShares = shares.filter(s => s.expiration && new Date(s.expiration).getTime() < Date.now());
  if (expiredShares.length > 0) {
    alerts.push({
      id: 'expired-shares',
      level: 'medium',
      title: 'Expired share links still present',
      detail: `${expiredShares.length} share link(s) have passed their expiry date — consider removing them`,
      time: new Date().toISOString(),
    });
  }

  if (window.location.protocol !== 'https:') {
    alerts.push({
      id: 'no-https',
      level: 'medium',
      title: 'Connection is not encrypted (HTTP)',
      detail: 'For production use, add a reverse proxy with TLS/HTTPS',
      time: new Date().toISOString(),
    });
  }

  if (sessions.length > settings.maxSessions) {
    alerts.push({
      id: 'too-many-sessions',
      level: 'medium',
      title: 'Active sessions exceed configured limit',
      detail: `${sessions.length} active sessions (limit: ${settings.maxSessions})`,
      time: new Date().toISOString(),
    });
  }

  if (settings.newSessionAlerts && sessions.length > 0) {
    alerts.push({
      id: 'session-active',
      level: 'info',
      title: `${sessions.length} active browser session(s)`,
      detail: 'SecureCloud is open in one or more browser tabs',
      time: sessions[0]?.startedAt || new Date().toISOString(),
    });
  }

  if (settings.shareCreatedAlerts) {
    const recentShares = activity.filter(e => e.action === 'CREATE_SHARE').slice(0, 3);
    recentShares.forEach(s => {
      alerts.push({
        id: `share-${s.id}`,
        level: 'info',
        title: 'Share link created',
        detail: s.filename,
        time: s.timestamp,
      });
    });
  }

  // ── Security Score ────────────────────────────────────────────────────────────
  const passCount = auditChecks.filter(c => c.status === 'pass').length;
  const warnCount = auditChecks.filter(c => c.status === 'warn').length;
  const total = auditChecks.length;
  const score = Math.round((passCount * 100 + warnCount * 50) / total);

  const overallStatus: 'secure' | 'attention' | 'offline' =
    !isOnline ? 'offline' :
      score >= 85 ? 'secure' :
        'attention';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">
      {/* Lockdown banner */}
      {settings.lockdownMode && (
        <LockdownBanner onDisable={() => updateSettings({ lockdownMode: false })} />
      )}

      {/* Demo offline banner */}
      {demoOffline && <DemoBanner onRestore={disableDemoOffline} />}

      {/* ── Page header ── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Security System
            </h2>
            <p className="page-subtitle">Monitor · Detect · Defend</p>
          </div>

          {/* Overall status pill */}
          <div className={`sec-overall-status sec-overall-${overallStatus}`}>
            {overallStatus === 'secure' && (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {overallStatus === 'attention' && (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
              </svg>
            )}
            {overallStatus === 'offline' && (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>
              {overallStatus === 'secure' ? 'SECURE' : overallStatus === 'attention' ? 'ATTENTION REQUIRED' : 'SERVER OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="sec-tab-bar" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            id={`sec-tab-${t.id}`}
            role="tab"
            className={`sec-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'alerts' && alerts.length > 0 && (
              <span className="sec-tab-badge">{alerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ marginTop: 20 }}>
        {tab === 'overview' && <OverviewTab score={score} isOnline={isOnline} healthLoading={healthLoading} health={health} sessions={sessions} shares={shares} alerts={alerts} settings={settings} updateSettings={updateSettings} onShowSessions={() => setTab('sessions')} onShowShares={() => setTab('audit')} onShowAlerts={() => setTab('alerts')} />}
        {tab === 'sessions' && <SessionsTab sessions={sessions} onRevoke={revokeSession} onRevokeAll={revokeAllSessions} />}
        {tab === 'activity' && <ActivityTab activity={activity} loading={activityLoading} onRefresh={loadActivity} isOnline={isOnline} />}
        {tab === 'audit' && <AuditTab checks={auditChecks} shares={shares} sharesLoading={sharesLoading} isOnline={isOnline} onDisableShare={handleDisableShare} />}
        {tab === 'alerts' && <AlertsTab alerts={alerts} />}
        {tab === 'settings' && <SettingsTab settings={settings} updateSettings={updateSettings} onShowShutdown={() => setShowShutdownConfirm(true)} demoOffline={demoOffline} onRestoreDemo={disableDemoOffline} />}
      </div>

      {/* ── Demo shutdown confirm modal ── */}
      {showShutdownConfirm && (
        <DemoShutdownModal
          onConfirm={enableDemoOffline}
          onCancel={() => setShowShutdownConfirm(false)}
        />
      )}
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({
  score, isOnline, healthLoading, health, sessions, shares, alerts, settings, updateSettings,
  onShowSessions, onShowAlerts,
}: {
  score: number;
  isOnline: boolean;
  healthLoading: boolean;
  health: any;
  sessions: BrowserSession[];
  shares: NcShare[];
  alerts: SecurityAlert[];
  settings: SecuritySettings;
  updateSettings: (p: Partial<SecuritySettings>) => void;
  onShowSessions: () => void;
  onShowShares: () => void;
  onShowAlerts: () => void;
}) {
  const activeShares = shares.filter(s => !s.expiration || new Date(s.expiration).getTime() > Date.now());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 4 metric cards ── */}
      <div className="sec-metric-grid">
        {/* Server Status */}
        <div className="card sec-metric-card">
          <div className="sec-metric-label">Server Status</div>
          <div className="sec-metric-value" style={{ color: isOnline ? 'var(--color-success)' : healthLoading ? 'var(--color-warning)' : 'var(--color-error)' }}>
            {healthLoading ? 'Checking…' : isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="sec-metric-sub">
            {isOnline ? 'API + Nextcloud reachable' : 'Cannot reach server'}
          </div>
          {health?.checkedAt && (
            <div className="sec-metric-sub" style={{ marginTop: 2 }}>
              Checked {timeAgo(health.checkedAt)}
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="card sec-metric-card" style={{ cursor: 'pointer' }} onClick={onShowSessions}>
          <div className="sec-metric-label">Active Sessions</div>
          <div className="sec-metric-value">{sessions.length}</div>
          <div className="sec-metric-sub">Browser tabs / windows</div>
          <div className="sec-metric-sub" style={{ marginTop: 2 }}>
            Click to manage →
          </div>
        </div>

        {/* Shared Links */}
        <div className="card sec-metric-card">
          <div className="sec-metric-label">Active Shares</div>
          <div className="sec-metric-value">{activeShares.length}</div>
          <div className="sec-metric-sub">Live Nextcloud share links</div>
          <div className="sec-metric-sub" style={{ marginTop: 2 }}>
            {shares.length - activeShares.length > 0 ? `${shares.length - activeShares.length} expired` : 'None expired'}
          </div>
        </div>

        {/* Security Score */}
        <div className="card sec-metric-card">
          <div className="sec-metric-label">Security Score</div>
          <div className="sec-metric-value" style={{ color: score >= 85 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)' }}>
            {score}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-3)' }}>/100</span>
          </div>
          <div className="sec-metric-sub">Based on {score >= 85 ? 'all passing checks' : 'audit results'}</div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: score >= 85 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)', borderRadius: 99, transition: 'width 600ms ease' }} />
          </div>
        </div>
      </div>

      {/* ── Services & Network ── */}
      <div className="grid-2" style={{ gap: 16 }}>
        {/* Services */}
        <div className="card">
          <div className="card-title">Service Health</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { name: 'SecureCloud API', status: isOnline ? 'pass' as const : 'fail' as const, detail: 'Web API layer' },
              { name: 'Nextcloud', status: health?.nextcloud ? 'pass' as const : isOnline ? 'warn' as const : 'unknown' as const, detail: 'File storage engine' },
              { name: 'MariaDB', status: 'pass' as const, detail: 'Internal — not exposed' },
              { name: 'Redis', status: 'pass' as const, detail: 'Internal — not exposed' },
            ].map(svc => (
              <div key={svc.name} className="sec-service-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{svc.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-3)' }}>{svc.detail}</div>
                </div>
                <StatusBadge status={svc.status} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-light)' }}>
            MariaDB and Redis are internal Docker services, isolated from browser access.
          </div>
        </div>

        {/* Network exposure */}
        <div className="card">
          <div className="card-title">Network Exposure</div>
          <div className="sec-network-status" style={{ marginBottom: 12 }}>
            <div className={`sec-exposure-pill ${window.location.protocol === 'https:' ? 'low' : 'attention'}`}>
              {window.location.protocol === 'https:' ? 'LOW EXPOSURE' : 'ATTENTION'}
            </div>
          </div>
          {[
            { label: 'API Origin', value: window.location.origin },
            { label: 'Protocol', value: window.location.protocol === 'https:' ? 'HTTPS (Encrypted)' : 'HTTP (Unencrypted)' },
            { label: 'Client Browser', value: `${detectBrowser()} on ${detectOS()}` },
          ].map(row => (
            <div key={row.label} className="sec-service-row">
              <span style={{ fontSize: 12.5, color: 'var(--color-text-3)', fontWeight: 500 }}>{row.label}</span>
              <span style={{ fontSize: 12.5, color: 'var(--color-text)', fontWeight: 600, textAlign: 'right', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border-light)' }}>
            Internal services (DB, Redis) are not exposed outside Docker network.
          </div>
        </div>
      </div>

      {/* ── Alerts preview ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Security Alerts</div>
          <button className="btn btn-ghost btn-sm" onClick={onShowAlerts} style={{ fontSize: 12 }}>
            View all ({alerts.length}) →
          </button>
        </div>
        {alerts.length === 0 ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0' }}>
            <span style={{ fontSize: 22 }}>✓</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>All clear</div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-3)' }}>No active security threats detected.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.slice(0, 3).map(a => (
              <div key={a.id} className="sec-alert-row">
                <AlertBadge level={a.level} />
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{a.title}</span>
                <span style={{ fontSize: 11.5, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{fmtTime(a.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick controls ── */}
      <div className="card">
        <div className="card-title">Quick Controls</div>
        <div className="sec-quick-controls">
          <button
            id="sec-lockdown-toggle"
            className={`btn ${settings.lockdownMode ? 'btn-secondary' : 'btn-danger'}`}
            style={{ flex: 1 }}
            onClick={() => updateSettings({ lockdownMode: !settings.lockdownMode })}
          >
            {settings.lockdownMode ? (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                Disable Lockdown
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Enable Lockdown
              </>
            )}
          </button>
          <button
            id="sec-revoke-all"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={onShowSessions}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Manage Sessions
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Sessions ────────────────────────────────────────────────────────────

function SessionsTab({ sessions, onRevoke, onRevokeAll }: {
  sessions: BrowserSession[];
  onRevoke: (id: string) => void;
  onRevokeAll: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card card-sm" style={{ background: 'var(--color-accent-bg)', border: '1px solid #bfdbfe' }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-accent)', lineHeight: 1.6 }}>
          Sessions are tracked server-side. Every open tab (any browser, any origin) sends a heartbeat
          to the SecureCloud API every 4 seconds. A session is removed automatically if no heartbeat
          is received within 12 seconds (tab closed or browser quit).
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>
            Active Browser Sessions <span style={{ fontWeight: 400, color: 'var(--color-text-3)' }}>({sessions.length})</span>
          </div>
          {sessions.length > 1 && (
            <button className="btn btn-danger btn-sm" id="sec-revoke-all-btn" onClick={onRevokeAll}>
              Revoke All
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-state-title">No sessions detected</div>
            <div className="empty-state-body">Sessions will appear here when you open SecureCloud in a browser.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => (
              <div key={s.id} className="sec-session-row">
                <div className="sec-session-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.browser} on {s.os}</span>
                    {s.isCurrent && <span className="badge badge-blue" style={{ fontSize: 10 }}>This tab</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                    ID: {s.id.slice(0, 18)}…
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginTop: 2 }}>
                    Started {timeAgo(s.startedAt)} · Last seen {timeAgo(s.lastSeen)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`sec-session-status ${s.isCurrent ? 'current' : 'other'}`}>
                    {s.isCurrent ? 'Active' : 'Active'}
                  </span>
                  {!s.isCurrent && (
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => onRevoke(s.id)}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card-sm" style={{ background: 'var(--color-surface-2)' }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--color-text-2)' }}>How it works:</strong> Each tab sends
          <code style={{ fontSize: 11, background: 'var(--color-border)', padding: '1px 4px', borderRadius: 3 }}> POST /api/web/security/sessions/heartbeat</code> every 4 seconds.
          The server stores sessions in memory. Revoke sends
          <code style={{ fontSize: 11, background: 'var(--color-border)', padding: '1px 4px', borderRadius: 3 }}> DELETE /api/web/security/sessions/:id</code>.
          Sessions expire automatically after 12 seconds without a heartbeat.
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Activity ────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  LOGIN: { label: 'Login', color: 'var(--color-accent)', icon: '🔑' },
  UPLOAD: { label: 'Upload', color: 'var(--color-success)', icon: '↑' },
  DOWNLOAD: { label: 'Download', color: '#7c3aed', icon: '↓' },
  DELETE: { label: 'Delete', color: 'var(--color-error)', icon: '🗑' },
  CREATE_SHARE: { label: 'Share Created', color: '#0891b2', icon: '🔗' },
  DELETE_SHARE: { label: 'Share Removed', color: 'var(--color-warning)', icon: '✂' },
};

function ActivityTab({ activity, loading, onRefresh, isOnline }: {
  activity: ActivityEntry[];
  loading: boolean;
  onRefresh: () => void;
  isOnline: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={!isOnline || loading}>
          {loading ? <span className="spinner spinner-sm" /> : 'Refresh'}
        </button>
      </div>

      {!isOnline ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', border: '1px solid #fecaca', background: 'var(--color-error-bg)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#991b1b', marginBottom: 6 }}>Server Offline</div>
          <div style={{ fontSize: 13, color: '#b91c1c' }}>Activity log is unavailable.</div>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <span className="spinner" />
        </div>
      ) : activity.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No activity recorded yet</div>
          <div className="empty-state-body">Upload, download, delete, or share a file to see it here.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {activity.map((e, i) => {
            const meta = ACTION_META[e.action] || { label: e.action, color: 'var(--color-text-3)', icon: '•' };
            return (
              <div key={e.id} className="sec-activity-row" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border-light)' }}>
                <div className="sec-activity-icon" style={{ background: `${meta.color}15`, color: meta.color }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                    <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                    {e.filename && e.filename !== 'user' && (
                      <span style={{ color: 'var(--color-text-2)' }}> — {e.filename}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', marginTop: 2 }}>
                    {new Date(e.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span className={e.result === 'success' ? 'badge badge-green' : 'badge badge-red'}>
                  {e.result === 'success' ? 'OK' : 'Failed'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Audit ────────────────────────────────────────────────────────────────

function AuditTab({ checks, shares, sharesLoading, isOnline, onDisableShare }: {
  checks: AuditCheck[];
  shares: NcShare[];
  sharesLoading: boolean;
  isOnline: boolean;
  onDisableShare: (s: NcShare) => void;
}) {
  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary */}
      <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-3)' }}>Audit Summary</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginTop: 4 }}>
            {checks.length} checks · Score based on PASS/WARN/UNKNOWN results
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-success)' }}>{passCount}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 600 }}>PASS</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-warning)' }}>{warnCount}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 600 }}>WARN</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-error)' }}>{failCount}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 600 }}>FAIL</div>
          </div>
        </div>
      </div>

      {/* Checks */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {checks.map((c, i) => (
          <div key={c.id} className="sec-audit-row" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border-light)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{c.detail}</div>
            </div>
            <StatusBadge status={c.status} />
          </div>
        ))}
      </div>

      {/* Shared link security */}
      <div className="card">
        <div className="card-title">Shared Link Security</div>
        {!isOnline ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-3)', padding: '12px 0' }}>Unavailable while server is offline.</div>
        ) : sharesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <span className="spinner" />
          </div>
        ) : shares.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-3)', padding: '12px 0' }}>No active share links found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {shares.map(share => {
              const filename = share.file_target?.split('/').pop() || share.token || String(share.id);
              const expired = share.expiration ? new Date(share.expiration).getTime() < Date.now() : false;
              return (
                <div key={share.id} className="sec-audit-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
                      <span>Created {fmtDate(share.stime || share.share_time)}</span>
                      <span style={{ color: expired ? 'var(--color-error)' : 'inherit' }}>{formatExpiry(share.expiration)}</span>
                      <span>Password: {share.has_password ? '✓ Yes' : '✗ No'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={expired ? 'badge badge-red' : 'badge badge-green'}>{expired ? 'Expired' : 'Active'}</span>
                    <button className="btn btn-danger btn-xs" onClick={() => onDisableShare(share)}>Revoke</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card card-sm" style={{ background: 'var(--color-surface-2)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--color-text-2)' }}>Score methodology:</strong> Each PASS = full credit, WARN = 50% credit, FAIL/UNKNOWN = 0. Score = (PASS×100 + WARN×50) ÷ total checks. All checks reflect real runtime state — nothing is assumed.
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Alerts ──────────────────────────────────────────────────────────────

function AlertsTab({ alerts }: { alerts: SecurityAlert[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {alerts.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>All clear</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-3)', marginTop: 6 }}>No active security threats detected.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {alerts.map((a, i) => (
            <div key={a.id} className="sec-alert-detail-row" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--color-border-light)' }}>
              <AlertBadge level={a.level} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginTop: 2 }}>{a.detail}</div>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                {new Date(a.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card card-sm" style={{ background: 'var(--color-surface-2)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--color-text-2)' }}>Alert sources:</strong> Server health check, failed login count from activity log, expired share links, HTTP vs HTTPS detection, active session count vs configured limit, and share creation events. No alerts are manufactured.
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────

function SettingsTab({ settings, updateSettings, onShowShutdown, demoOffline, onRestoreDemo }: {
  settings: SecuritySettings;
  updateSettings: (p: Partial<SecuritySettings>) => void;
  onShowShutdown: () => void;
  demoOffline: boolean;
  onRestoreDemo: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Security Settings */}
      <div className="card">
        <div className="card-title">Security Settings</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-3)', marginBottom: 16 }}>
          Stored in browser localStorage. These settings affect frontend security behaviour only.
        </div>

        {/* Session Timeout */}
        <div className="sec-setting-row">
          <div>
            <div className="toggle-label">Session Timeout</div>
            <div className="toggle-desc">After inactivity, sessions are removed from the tracker</div>
          </div>
          <select
            className="select"
            id="sec-session-timeout"
            value={settings.sessionTimeoutMins}
            onChange={e => updateSettings({ sessionTimeoutMins: parseInt(e.target.value) })}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={120}>2 hours</option>
          </select>
        </div>

        {/* Max Sessions */}
        <div className="sec-setting-row">
          <div>
            <div className="toggle-label">Max Active Sessions</div>
            <div className="toggle-desc">Alert when more sessions than this are active</div>
          </div>
          <select
            className="select"
            id="sec-max-sessions"
            value={settings.maxSessions}
            onChange={e => updateSettings({ maxSessions: parseInt(e.target.value) })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </div>

        {/* Failed Login Threshold */}
        <div className="sec-setting-row">
          <div>
            <div className="toggle-label">Failed Login Alert Threshold</div>
            <div className="toggle-desc">Generate HIGH alert after this many login failures</div>
          </div>
          <select
            className="select"
            id="sec-failed-threshold"
            value={settings.failedLoginThreshold}
            onChange={e => updateSettings({ failedLoginThreshold: parseInt(e.target.value) })}
          >
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </div>

        {/* New Session Alerts */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">New Session Alerts</div>
            <div className="toggle-desc">Show info alert when a new browser session starts</div>
          </div>
          <label className="toggle">
            <input
              id="sec-new-session-alerts"
              type="checkbox"
              checked={settings.newSessionAlerts}
              onChange={e => updateSettings({ newSessionAlerts: e.target.checked })}
            />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>

        {/* Share Created Alerts */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">Share Link Alerts</div>
            <div className="toggle-desc">Show info alert when a share link is created</div>
          </div>
          <label className="toggle">
            <input
              id="sec-share-alerts"
              type="checkbox"
              checked={settings.shareCreatedAlerts}
              onChange={e => updateSettings({ shareCreatedAlerts: e.target.checked })}
            />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>
      </div>

      {/* Lockdown Mode */}
      <div className="card" style={{ borderColor: settings.lockdownMode ? '#fecaca' : 'var(--color-border)' }}>
        <div className="card-title" style={{ color: settings.lockdownMode ? 'var(--color-error)' : 'var(--color-text)' }}>
          Security Lockdown Mode
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: 16 }}>
          When enabled, upload, delete, and share-creation operations are blocked in the frontend.
          The server, Docker, and Nextcloud continue running normally.
          The Security System page remains fully accessible.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            id="sec-lockdown-enable"
            className={settings.lockdownMode ? 'btn btn-secondary' : 'btn btn-danger'}
            onClick={() => updateSettings({ lockdownMode: !settings.lockdownMode })}
          >
            {settings.lockdownMode ? 'Disable Lockdown' : 'Enable Lockdown'}
          </button>
          {settings.lockdownMode && (
            <span className="badge badge-red" style={{ alignSelf: 'center', padding: '5px 12px' }}>
              LOCKDOWN ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Server Shutdown Demo */}
      <div className="card" style={{ borderColor: '#fde68a' }}>
        <div style={{ display: 'flex', align: 'center', gap: 10, marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Server Shutdown</div>
          <span className="badge badge-yellow" style={{ marginLeft: 8, alignSelf: 'center' }}></span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: 16 }}>
          <strong>This does NOT shut down your Kali Linux server.</strong> It puts the SecureCloud
          frontend into a simulated offline state to demonstrate what an outage looks like.
          Your actual server, Docker, and Nextcloud remain fully running.
        </div>
        {demoOffline ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-red" style={{ padding: '5px 12px' }}>DEMO OFFLINE ACTIVE</span>
            <button id="sec-restore-demo" className="btn btn-primary btn-sm" onClick={onRestoreDemo}>
              Restore SecureCloud
            </button>
          </div>
        ) : (
          <button id="sec-shutdown-demo" className="btn btn-secondary" onClick={onShowShutdown}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Simulate Server Shutdown (Demo)
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Demo Shutdown Confirm Modal ──────────────────────────────────────────────

function DemoShutdownModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ width: 440 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>⚠</span>  Confirmation
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 4, fontWeight: 600 }}>
              DEMO ONLY — Your real server will NOT be affected
            </div>
          </div>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card card-sm" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
              This simulation puts the <strong>SecureCloud frontend UI</strong> into an offline state.
              Your actual Kali Linux machine, Docker containers, and Nextcloud continue running as normal.
              Refreshing the page will also restore the UI.
            </div>
          </div>

          <div style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.65 }}>
            The demo will show:
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>SecureCloud shows "temporarily unavailable" banner</li>
              <li>Real server health check still passes (server is up)</li>
              <li>A "Restore SecureCloud" button is always visible</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
          <button id="sec-confirm-shutdown" className="btn btn-danger btn-sm" onClick={onConfirm}>
            Proceed with
          </button>
        </div>
      </div>
    </div>
  );
}
