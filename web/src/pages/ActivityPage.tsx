import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../AppContext';
import { fetchActivity } from '../api';
import type { ActivityEntry } from '../api';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN:        { label: 'Login',         color: 'var(--color-accent)' },
  UPLOAD:       { label: 'Upload',        color: 'var(--color-success)' },
  DOWNLOAD:     { label: 'Download',      color: '#7c3aed' },
  DELETE:       { label: 'Delete',        color: 'var(--color-error)' },
  CREATE_SHARE: { label: 'Share Created', color: '#0891b2' },
  DELETE_SHARE: { label: 'Share Deleted', color: 'var(--color-warning)' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function ActivityPage() {
  const { health, addToast } = useApp();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const isOnline = health?.status === 'online';

  const load = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const data = await fetchActivity();
      setEntries(data.reverse()); // newest first
    } catch (err: any) {
      addToast(err.message || 'Failed to load activity log', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOnline, addToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 className="page-title">Activity Log</h2>
          <p className="page-subtitle">Audit trail of file operations performed through SecureCloud.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={!isOnline || loading}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Privacy note */}
      <div className="card card-sm" style={{ marginBottom: 20, background: 'var(--color-accent-bg)', border: '1px solid #bfdbfe' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="var(--color-accent)" strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div style={{ fontSize: 12.5, color: 'var(--color-accent)', lineHeight: 1.6 }}>
            Only action metadata is logged — no passwords, tokens, or file contents.
            Logs record: timestamp, action type, filename, and result.
          </div>
        </div>
      </div>

      {!isOnline ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', border: '1px solid #fecaca', background: 'var(--color-error-bg)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#991b1b', marginBottom: 6 }}>Server Offline</div>
          <div style={{ fontSize: 13, color: '#b91c1c' }}>Activity log is unavailable while the server is offline.</div>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <span className="spinner" />
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="empty-state-title">No activity yet</div>
          <div className="empty-state-body">
            Actions like uploads, downloads, shares, and deletions will appear here.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="file-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20, width: 180 }}>Time</th>
                <th style={{ width: 130 }}>Action</th>
                <th>Resource</th>
                <th style={{ width: 90 }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta = ACTION_LABELS[e.action] || { label: e.action, color: 'var(--color-text-3)' };
                return (
                  <tr key={e.id}>
                    <td style={{ paddingLeft: 20, fontSize: 12, color: 'var(--color-text-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {formatTime(e.timestamp)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: `${meta.color}15`,
                        border: `1px solid ${meta.color}30`,
                        fontSize: 11,
                        fontWeight: 700,
                        color: meta.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--color-text)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.filename || '—'}
                    </td>
                    <td>
                      {e.result === 'success'
                        ? <span className="badge badge-green">OK</span>
                        : <span className="badge badge-red">Failed</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
