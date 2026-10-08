import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../AppContext';
import ShareModal from '../components/ShareModal';
import { listFiles, uploadFile, downloadFile, deleteFile } from '../api';
import type { FileEntry } from '../api';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getExt(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function getIconType(filename: string) {
  const ext = getExt(filename);
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx', 'odt'].includes(ext)) return 'doc';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'].includes(ext)) return 'img';
  if (['zip', 'rar', 'tar', 'gz', '7z', 'bz2'].includes(ext)) return 'zip';
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'].includes(ext)) return 'vid';
  return 'other';
}

export default function FilesPage() {
  const { health, addToast, searchQuery, isLockdown } = useApp();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [shareFile, setShareFile] = useState<FileEntry | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<FileEntry | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOnline = health?.status === 'online';

  const loadFiles = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const f = await listFiles();
      setFiles(f);
    } catch (err: any) {
      addToast(err.message || 'Failed to load files. Check that the server is running.', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOnline, addToast]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  async function handleUpload(file: File) {
    if (!isOnline) { addToast('Server offline — cannot upload', 'error'); return; }
    if (isLockdown) { addToast('SecureCloud is in Lockdown Mode — upload disabled', 'error'); return; }
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadFile(file, setUploadProgress);
      addToast(`"${file.name}" uploaded successfully`, 'success');
      await loadFiles();
    } catch (err: any) {
      addToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function handleDelete(file: FileEntry) {
    if (!isOnline) { addToast('Server offline — cannot delete', 'error'); return; }
    if (isLockdown) { addToast('SecureCloud is in Lockdown Mode — delete disabled', 'error'); setDeleteConfirm(null); return; }
    try {
      await deleteFile(file.filename);
      addToast(`"${file.filename}" deleted`, 'success');
      setFiles((f) => f.filter((x) => x.filename !== file.filename));
    } catch (err: any) {
      addToast(err.message || 'Delete failed', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  }

  async function handleDownload(file: FileEntry) {
    if (!isOnline) { addToast('Server offline — cannot download', 'error'); return; }
    setDownloadingFile(file.filename);
    try {
      // Auth token is sent via Authorization header — NOT in the URL
      const blob = await downloadFile(file.filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      addToast(err.message || 'Download failed', 'error');
    } finally {
      setDownloadingFile(null);
    }
  }

  const filteredFiles = files.filter((f) =>
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 className="page-title">My Files</h2>
          <p className="page-subtitle">
            Files stored on your private server — powered by Nextcloud WebDAV.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadFiles} disabled={!isOnline || loading}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            id="upload-file-btn"
            className="btn btn-primary btn-sm"
            disabled={!isOnline || uploading || isLockdown}
            onClick={() => fileInputRef.current?.click()}
            title={isLockdown ? 'Disabled: Security Lockdown Mode is active' : undefined}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload File
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>
      </div>

      {/* Lockdown banner */}
      {isLockdown && (
        <div className="sec-lockdown-banner" style={{ marginBottom: 16 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Security Lockdown Active</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Upload, delete, and share operations are disabled. Go to Security System to disable.</div>
          </div>
        </div>
      )}

      {/* Offline state */}
      {!isOnline && (
        <div className="card" style={{ border: '1px solid #fecaca', background: 'var(--color-error-bg)', textAlign: 'center', padding: '40px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔌</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#991b1b', marginBottom: 6 }}>Server Offline</div>
          <div style={{ fontSize: 13, color: '#b91c1c', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            Your SecureCloud server is unreachable. File operations are not available.<br />
            Turn on your server machine and ensure Docker services are running.
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="card card-sm" style={{ marginBottom: 16, border: '1px solid #bfdbfe', background: 'var(--color-accent-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-accent)', marginBottom: 8 }}>
            <span className="spinner spinner-sm" />
            Uploading… {uploadProgress}%
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Drop zone */}
      {isOnline && !isLockdown && (
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          style={{ marginBottom: 20 }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          id="file-drop-zone"
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--color-text-3)" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <div className="drop-zone-text">
            {dragging ? 'Drop file here to upload' : 'Drag & drop a file here, or click to browse'}
          </div>
        </div>
      )}


      {/* File table */}
      {isOnline && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <span className="spinner" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div className="empty-state-title">
                {searchQuery ? `No files matching "${searchQuery}"` : 'No files yet'}
              </div>
              <div className="empty-state-body">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Upload your first file using the button above or by dragging it into the drop zone.'}
              </div>
            </div>
          ) : (
            <table className="file-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>File</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => {
                  const ext = getExt(file.filename);
                  const iconType = getIconType(file.filename);
                  const isDownloading = downloadingFile === file.filename;
                  return (
                    <tr key={file.filename}>
                      <td style={{ paddingLeft: 20 }}>
                        <div className="file-name-cell">
                          <div className={`file-type-icon ${iconType}`}>{ext.slice(0, 3).toUpperCase() || '—'}</div>
                          <span className="file-name-text">{file.filename}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatBytes(file.size)}
                      </td>
                      <td>
                        <div className="file-actions">
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleDownload(file)}
                            disabled={isDownloading}
                            title="Download file"
                          >
                            {isDownloading
                              ? <span className="spinner spinner-sm" />
                              : <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>}
                            Download
                          </button>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              if (isLockdown) { return; }
                              setShareFile(file);
                            }}
                            title={isLockdown ? 'Disabled: Security Lockdown Mode' : 'Create share link'}
                            disabled={isLockdown}
                          >
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Share
                          </button>
                          <button
                            className="btn btn-danger btn-xs"
                            onClick={() => setDeleteConfirm(file)}
                            title="Delete file"
                          >
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Share modal */}
      {shareFile && <ShareModal file={shareFile} onClose={() => setShareFile(null)} />}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 380 }}>
            <div className="modal-header">
              <div className="modal-title">Confirm Delete</div>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.6 }}>
              Delete <strong>"{deleteConfirm.filename}"</strong> from your server?
              This action is permanent and cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(deleteConfirm)}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
