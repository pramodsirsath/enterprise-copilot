export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

/** Fired when the server rejects our token so the app can log out. */
export const UNAUTHORIZED_EVENT = 'ec:unauthorized';

/**
 * Small fetch wrapper: JSON in/out, bearer token, readable errors.
 */
export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is the API running on ' + API_URL + '?');
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    if (res.status === 401 && auth) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ───────────── File helpers ───────────── */

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Browsers (esp. on Windows) report unreliable MIME types — e.g. CSV as
// "application/vnd.ms-excel" or an empty string for .md — so map by extension.
const EXT_TO_MIME = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export const ACCEPT_ATTR = Object.keys(EXT_TO_MIME).map((e) => `.${e}`).join(',');

export const mimeForFile = (file) => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return EXT_TO_MIME[ext] || null;
};

export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};

export const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(date).toLocaleDateString();
};
