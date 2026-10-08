import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { login } from '../api';

interface Props {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: Props) {
  const { addToast } = useApp();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(password);
      addToast('Welcome to SecureCloud', 'success');
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.jpg" alt="SecureCloud logo" />
          <div className="login-brand-name">SecureCloud</div>
          <div className="login-brand-tagline">Your Device. Your Cloud.</div>
        </div>

        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
            Sign in to access your private cloud server hosted on your Kali Linux machine.
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--color-error-bg)',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-error)',
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="sc-password">Access Token</label>
            <input
              id="sc-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your SecureCloud access token"
              required
              autoFocus
            />
          </div>

          <button
            id="sc-login-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '10px 16px' }}
          >
            {loading ? (
              <>
                <span className="spinner spinner-sm" />
                Signing in…
              </>
            ) : 'Sign In →'}
          </button>
        </form>

        <div className="divider" />

        <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', textAlign: 'center', lineHeight: 1.6 }}>
          Files are stored on your own Kali Linux server.<br />
          No third-party cloud dependency.
        </div>
      </div>
    </div>
  );
}
