/**
 * SecureCloud API client
 * All calls go through the bot's /api/web endpoints.
 * Credentials live on the server — never in the browser source.
 *
 * Auth token is stored in sessionStorage after login.
 * It is a shared secret configured on the server via SECURECLOUD_WEB_TOKEN.
 * It is NOT a Nextcloud password, database credential, or API key.
 */

// In development, keep BASE empty so all /api/* requests go through the
// Vite proxy (configured in vite.config.ts using VITE_API_BASE_URL).
// In a production static build where no proxy exists, set BASE to the
// full API origin via VITE_API_BASE_URL.
const BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
const getToken = () => sessionStorage.getItem('sc_token') || '';

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error || errMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg);
  }
  return res.json();
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface FileEntry {
  filename: string;
  path: string;
  size: number;
  isFolder: boolean;
}

export interface StorageInfo {
  usedBytes: number;
  totalBytes: number | null;
  freeBytes: number | null;
}

export interface ShareResult {
  url: string;
  password?: string;
  expireDate?: string;
}

export interface NcShare {
  id: number;
  file_target: string;
  url: string;
  share_type: number;
  permissions: number;
  expiration: string | null;
  share_time: number;
  stime: number;
  token: string;
  has_password: boolean;
}

export interface HealthResult {
  status: 'online' | 'degraded' | 'offline';
  nextcloud: boolean;
  server?: string;
  checkedAt: string;
}

export interface ActivityEntry {
  id: number;
  timestamp: string;
  action: string;
  filename: string;
  result: 'success' | 'failure';
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function login(password: string): Promise<string> {
  const data = await request<{ token: string }>('/api/web/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  sessionStorage.setItem('sc_token', data.token);
  return data.token;
}

export function logout() {
  sessionStorage.removeItem('sc_token');
}

export function isLoggedIn() {
  return !!getToken();
}

// ─── Health ──────────────────────────────────────────────────────────────────
export async function fetchHealth(): Promise<HealthResult> {
  return request<HealthResult>('/api/web/health');
}

// ─── Files ───────────────────────────────────────────────────────────────────
export async function listFiles(): Promise<FileEntry[]> {
  const data = await request<{ files: FileEntry[] }>('/api/web/files');
  return data.files;
}

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<FileEntry> {
  const token = getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.file);
        } catch {
          reject(new Error('Invalid server response'));
        }
      } else {
        let errMsg = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          errMsg = body.error || errMsg;
        } catch {
          // ignore
        }
        reject(new Error(errMsg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled')));
    xhr.open('POST', `${BASE}/api/web/files/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
}

/**
 * Download a file. Returns a Blob so we can trigger a browser download
 * without exposing the auth token in a URL query string.
 */
export async function downloadFile(filename: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/web/files/download/${encodeURIComponent(filename)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let errMsg = `Download failed (${res.status})`;
    try {
      const body = await res.json();
      errMsg = body.error || errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.blob();
}

export async function deleteFile(filename: string): Promise<void> {
  await request(`/api/web/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
}

// ─── Shares ──────────────────────────────────────────────────────────────────
export async function createShare(
  filename: string,
  opts: { password?: boolean; expiryDays?: number }
): Promise<ShareResult> {
  const data = await request<{ share: ShareResult }>('/api/web/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, ...opts }),
  });
  return data.share;
}

export async function listShares(): Promise<NcShare[]> {
  const data = await request<{ shares: NcShare[] }>('/api/web/shares');
  return data.shares;
}

export async function deleteShare(shareId: number): Promise<void> {
  await request(`/api/web/shares/${shareId}`, { method: 'DELETE' });
}

// ─── Storage ─────────────────────────────────────────────────────────────────
export async function fetchStorage(): Promise<StorageInfo> {
  const data = await request<{ storage: StorageInfo }>('/api/web/storage');
  return data.storage;
}

// ─── Activity ─────────────────────────────────────────────────────────────────
export async function fetchActivity(): Promise<ActivityEntry[]> {
  const data = await request<{ activity: ActivityEntry[] }>('/api/web/activity');
  return data.activity;
}
