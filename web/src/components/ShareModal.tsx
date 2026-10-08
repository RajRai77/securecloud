import { useState } from 'react';
import { useApp } from '../AppContext';
import { createShare } from '../api';
import type { FileEntry, ShareResult } from '../api';

interface Props {
  file: FileEntry;
  onClose: () => void;
}

type AccessType = 'view' | 'download';

export default function ShareModal({ file, onClose }: Props) {
  const { addToast } = useApp();
  const [accessType, setAccessType] = useState<AccessType>('view');
  const [enablePassword, setEnablePassword] = useState(true);
  const [expiryDays, setExpiryDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setLoading(true);
    try {
      const share = await createShare(file.filename, {
        password: enablePassword,
        expiryDays,
      });
      setResult(share);
      addToast('Share link created', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to create share link', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Link copied to clipboard', 'success');
  }

  const ext = file.filename.split('.').pop()?.toLowerCase() || '';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" id="share-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {result ? 'Share Link Created' : 'Create Share Link'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>
              Share this file without giving account access
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* File info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
          border: '1px solid var(--color-border)',
        }}>
          <div className={`file-type-icon ${['pdf'].includes(ext) ? 'pdf' : ['doc','docx'].includes(ext) ? 'doc' : ['png','jpg','jpeg'].includes(ext) ? 'img' : 'other'}`}
            style={{ width: 36, height: 36 }}>
            {ext.slice(0, 3).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{file.filename}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-3)' }}>
              {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Size unknown'}
            </div>
          </div>
        </div>

        {!result ? (
          <>
            {/* Access type */}
            <div className="modal-section-label">Access Type</div>
            <div className="radio-group">
              <label className={`radio-option ${accessType === 'view' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="access"
                  checked={accessType === 'view'}
                  onChange={() => setAccessType('view')}
                />
                <div>
                  <div className="radio-option-title">View Only</div>
                  <div className="radio-option-desc">Recipient can view and download the file</div>
                </div>
              </label>
              <label className={`radio-option ${accessType === 'download' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="access"
                  checked={accessType === 'download'}
                  onChange={() => setAccessType('download')}
                />
                <div>
                  <div className="radio-option-title">Download</div>
                  <div className="radio-option-desc">Allow direct download access</div>
                </div>
              </label>
            </div>

            {/* Options */}
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Password Protection</div>
                <div className="toggle-desc">A random password will be generated</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.checked)}
                />
                <div className="toggle-track" />
                <div className="toggle-thumb" />
              </label>
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">Link Expiry</div>
                <div className="toggle-desc">Link becomes inactive after selected period</div>
              </div>
              <select
                className="select"
                value={expiryDays}
                onChange={(e) => setExpiryDays(parseInt(e.target.value, 10))}
              >
                <option value={1}>1 Day</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
              <button
                id="create-share-link-btn"
                className="btn btn-primary btn-sm"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? <><span className="spinner spinner-sm" /> Creating…</> : 'Create Share Link →'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Result */}
            <div style={{
              padding: '12px 14px',
              background: 'var(--color-success-bg)',
              border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--color-success)',
              fontWeight: 600,
            }}>
              ✓ Share link is ready
            </div>

            <div className="modal-section-label">Share URL</div>
            <div className="share-link-box">
              <span className="share-link-url">{result.url}</span>
              <button
                id="copy-share-link-btn"
                className="btn btn-primary btn-xs"
                onClick={copyLink}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.password && (
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-3)' }}>Password</span>
                  <code style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{result.password}</code>
                </div>
              )}
              {result.expireDate && (
                <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-3)' }}>Expires</span>
                  <span style={{ fontWeight: 600 }}>{result.expireDate}</span>
                </div>
              )}
              <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-3)' }}>Access</span>
                <span style={{ fontWeight: 600 }}>View Only (read-only)</span>
              </div>
            </div>

            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-md)',
              fontSize: 11.5,
              color: 'var(--color-text-3)',
              lineHeight: 1.5,
            }}>
              💡 The recipient can access this specific file without needing your SecureCloud credentials.
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => window.open(result.url, '_blank')}>
                Open Link
              </button>
              <button className="btn btn-primary btn-sm" onClick={copyLink}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
