const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('panel_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('panel_token', token);
  } else {
    localStorage.removeItem('panel_token');
  }
}

export function clearToken() {
  localStorage.removeItem('panel_token');
}

export async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, default content-type is json
  if (!(options.body instanceof FormData) && !headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('auth_expired'));
    throw new Error('Session expired. Please log in again.');
  }

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : (typeof data === 'string' ? data : 'Request failed');
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  getMe: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // System
  getStats: () => request('/system/stats'),

  // Files
  listDrives: () => request('/files/drives'),
  listFiles: (path) => request(`/files/list${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  readFile: (path) => request(`/files/read?path=${encodeURIComponent(path)}`),
  saveFile: (path, content) => request('/files/save', {
    method: 'POST',
    body: JSON.stringify({ path, content })
  }),
  createFile: (parentDir, name) => request('/files/create-file', {
    method: 'POST',
    body: JSON.stringify({ parentDir, name })
  }),
  createFolder: (parentDir, name) => request('/files/create-folder', {
    method: 'POST',
    body: JSON.stringify({ parentDir, name })
  }),
  renameItem: (oldPath, newPath) => request('/files/rename', {
    method: 'POST',
    body: JSON.stringify({ oldPath, newPath })
  }),
  deleteItem: (path) => request('/files/delete', {
    method: 'POST',
    body: JSON.stringify({ path })
  }),
  uploadFiles: (destination, fileList) => {
    const formData = new FormData();
    formData.append('destination', destination);
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }
    return request('/files/upload', {
      method: 'POST',
      body: formData
    });
  },
  extractZip: (zipPath, destination) => request('/files/extract', {
    method: 'POST',
    body: JSON.stringify({ zipPath, destination })
  }),
  compressZip: (sourcePath, outputZipPath) => request('/files/compress', {
    method: 'POST',
    body: JSON.stringify({ sourcePath, outputZipPath })
  }),
  getDownloadUrl: (path) => {
    const token = getToken();
    return `${API_BASE}/files/download?path=${encodeURIComponent(path)}&token=${token}`;
  },

  // Apps
  listApps: () => request('/apps'),
  getApp: (id) => request(`/apps/${id}`),
  createApp: (data) => request('/apps', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateApp: (id, data) => request(`/apps/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteApp: (id) => request(`/apps/${id}`, { method: 'DELETE' }),
  startApp: (id) => request(`/apps/${id}/start`, { method: 'POST' }),
  stopApp: (id) => request(`/apps/${id}/stop`, { method: 'POST' }),
  restartApp: (id) => request(`/apps/${id}/restart`, { method: 'POST' }),
  getAppLogs: (id) => request(`/apps/${id}/logs`),
  clearAppLogs: (id) => request(`/apps/${id}/logs`, { method: 'DELETE' }),
  getAppNginx: (id, domain) => request(`/apps/${id}/nginx${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`),

  // Domains & Websites
  listDomains: () => request('/domains'),
  createDomain: (data) => request('/domains', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  toggleDomain: (id) => request(`/domains/${id}/toggle`, {
    method: 'PATCH'
  }),
  issueDomainSsl: (id, email) => request(`/domains/${id}/ssl`, {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  deleteDomain: (id, deleteFiles = false) => request(`/domains/${id}?deleteFiles=${deleteFiles ? 'true' : 'false'}`, {
    method: 'DELETE'
  }),

  // Databases (SQL)
  getDatabaseStatus: () => request('/database/status'),
  listDatabases: () => request('/database/list'),
  createDatabase: (data) => request('/database/create', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteDatabase: (name) => request(`/database/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  }),
  listDbUsers: () => request('/database/users'),
  createDbUser: (data) => request('/database/users/create', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteDbUser: (username, host = 'localhost') => request(`/database/users/${encodeURIComponent(username)}?host=${encodeURIComponent(host)}`, {
    method: 'DELETE'
  }),
  changeDbUserPassword: (username, host, password) => request('/database/users/password', {
    method: 'POST',
    body: JSON.stringify({ username, host, password })
  }),
  executeSqlQuery: (query, database) => request('/database/query', {
    method: 'POST',
    body: JSON.stringify({ query, database })
  }),
  backupDatabase: (name) => request(`/database/backup/${encodeURIComponent(name)}`, {
    method: 'POST'
  }),
  listDbBackups: () => request('/database/backups'),
  getDbBackupDownloadUrl: (filename) => {
    const token = getToken();
    return `${API_BASE}/database/backups/download/${encodeURIComponent(filename)}?token=${token}`;
  },
  restoreDatabase: (database, sqlContent) => request('/database/restore', {
    method: 'POST',
    body: JSON.stringify({ database, sqlContent })
  })
};

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatUptime(seconds) {
  if (!seconds) return '0m';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}
