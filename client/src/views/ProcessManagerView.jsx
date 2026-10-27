import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Play,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  FileText,
  Globe,
  Settings,
  Activity,
  Check,
  AlertTriangle,
  RefreshCw,
  Terminal,
  Copy,
  X
} from 'lucide-react';
import { api, getToken, formatUptime } from '../api';

export default function ProcessManagerView() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [logModalApp, setLogModalApp] = useState(null);
  const [logs, setLogs] = useState([]);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const [nginxModal, setNginxModal] = useState(null); // { app, domain, config }

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'node',
    cwd: '',
    command: 'node index.js',
    port: '',
    autoRestart: true,
    envText: ''
  });

  const logWsRef = useRef(null);
  const logsEndRef = useRef(null);

  const showNotification = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadApps = async () => {
    setLoading(true);
    try {
      const data = await api.listApps();
      setApps(data.apps || []);
    } catch (err) {
      showNotification(`Failed to load apps: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
    const interval = setInterval(loadApps, 5000); // Poll status every 5s
    return () => clearInterval(interval);
  }, []);

  // Handle Form Type change presets
  const handleTypeChange = (newType) => {
    let defaultCmd = 'node index.js';
    if (newType === 'python') defaultCmd = 'python3 main.py';
    else if (newType === 'custom') defaultCmd = 'bash start.sh';

    setFormData({
      ...formData,
      type: newType,
      command: defaultCmd
    });
  };

  const handleOpenCreate = () => {
    setEditingApp(null);
    setFormData({
      name: '',
      type: 'node',
      cwd: '',
      command: 'node index.js',
      port: '',
      autoRestart: true,
      envText: ''
    });
    setCreateModal(true);
  };

  const handleOpenEdit = (app) => {
    setEditingApp(app);
    const envLines = Object.entries(app.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    setFormData({
      name: app.name,
      type: app.type || 'node',
      cwd: app.cwd || '',
      command: app.command || '',
      port: app.port ? String(app.port) : '',
      autoRestart: app.autoRestart !== false,
      envText: envLines
    });
    setCreateModal(true);
  };

  const handleSaveApp = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.command.trim()) {
      showNotification('App name and command are required', true);
      return;
    }

    // Parse env text into key-value map
    const env = {};
    formData.envText.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        env[k.trim()] = v.join('=').trim();
      }
    });

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      cwd: formData.cwd.trim() || undefined,
      command: formData.command.trim(),
      port: formData.port ? parseInt(formData.port, 10) : null,
      autoRestart: formData.autoRestart,
      env
    };

    try {
      if (editingApp) {
        await api.updateApp(editingApp.id, payload);
        showNotification('App updated successfully!');
      } else {
        await api.createApp(payload);
        showNotification('App created successfully!');
      }
      setCreateModal(false);
      loadApps();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleStart = async (id) => {
    try {
      await api.startApp(id);
      showNotification('App started!');
      loadApps();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleStop = async (id) => {
    try {
      await api.stopApp(id);
      showNotification('App stopped');
      loadApps();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleRestart = async (id) => {
    try {
      await api.restartApp(id);
      showNotification('App restarted!');
      loadApps();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete app "${name}"?`)) return;
    try {
      await api.deleteApp(id);
      showNotification('App deleted');
      loadApps();
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  // Open Live Logs WebSocket
  const handleOpenLogs = (app) => {
    setLogModalApp(app);
    setLogs([]);

    if (logWsRef.current) {
      try { logWsRef.current.close(); } catch (e) {}
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getToken();
    const wsUrl = `${protocol}//${host}/ws/logs?appId=${encodeURIComponent(app.id)}&token=${encodeURIComponent(token || '')}`;

    const ws = new WebSocket(wsUrl);
    logWsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'history') {
          setLogs(msg.logs || []);
        } else if (msg.type === 'log') {
          setLogs(prev => [...prev, msg.entry]);
        }
      } catch (e) {}
    };

    ws.onerror = (e) => console.error('Log WS error', e);
  };

  const handleCloseLogs = () => {
    if (logWsRef.current) {
      try { logWsRef.current.close(); } catch (e) {}
      logWsRef.current = null;
    }
    setLogModalApp(null);
  };

  const handleClearLogs = async () => {
    if (!logModalApp) return;
    try {
      await api.clearAppLogs(logModalApp.id);
      setLogs([]);
      showNotification('Logs cleared');
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleOpenNginx = async (app) => {
    try {
      const data = await api.getAppNginx(app.id, 'yourdomain.com');
      setNginxModal({ app, domain: 'yourdomain.com', config: data.config });
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleUpdateNginxDomain = async (newDomain) => {
    if (!nginxModal) return;
    try {
      const data = await api.getAppNginx(nginxModal.app.id, newDomain);
      setNginxModal({ ...nginxModal, domain: newDomain, config: data.config });
    } catch (err) {}
  };

  useEffect(() => {
    if (autoScrollLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScrollLogs]);

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition ${notification.isError ? 'bg-rose-950 border border-rose-500/50 text-rose-200' : 'bg-emerald-950 border border-emerald-500/50 text-emerald-200'}`}>
          {notification.isError ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <Check className="w-4 h-4 text-emerald-400" />}
          {notification.msg}
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 shadow-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Process & Application Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Run, supervise, and auto-restart your Node.js & Python background apps
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadApps}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            Add Application
          </button>
        </div>
      </div>

      {/* Apps Grid */}
      {apps.length === 0 && !loading ? (
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-12 text-center text-slate-400">
          <Layers className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No applications registered yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Add your Node.js server, Express API, Discord Bot, Python script, or FastAPI app to run it automatically in the background.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Create Your First App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {apps.map((app) => {
            const isRunning = app.status === 'running';
            const isErrored = app.status === 'errored';

            return (
              <div
                key={app.id}
                className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-600 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{app.name}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          {app.type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-1 truncate max-w-sm">
                        {app.command}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      {isRunning ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Running {app.pid && `(PID ${app.pid})`}
                        </span>
                      ) : isErrored ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 border border-rose-500/40 text-rose-300">
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                          Crash Paused
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900 border border-slate-700 text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-slate-500" />
                          Stopped
                        </span>
                      )}
                    </div>
                  </div>

                  {/* App Metadata Info */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-900/60 rounded-lg p-2.5 text-xs border border-slate-700/40 mt-3">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Working Directory:</span>
                      <span className="text-slate-300 font-mono truncate block" title={app.cwd}>
                        {app.cwd}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Port / Uptime:</span>
                      <div className="flex items-center gap-2">
                        {app.port ? (
                          <span className="font-mono text-cyan-400 font-semibold">:{app.port}</span>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                        {isRunning && app.startedAt && (
                          <span className="text-slate-400">• {formatUptime(Math.floor((Date.now() - app.startedAt) / 1000))}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <>
                        <button
                          onClick={() => handleRestart(app.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
                          title="Restart Application"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restart
                        </button>
                        <button
                          onClick={() => handleStop(app.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
                          title="Stop Application"
                        >
                          <Square className="w-3.5 h-3.5" />
                          Stop
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStart(app.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow"
                        title="Start Application"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Start
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenLogs(app)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition"
                      title="View Live Logs"
                    >
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                      Logs
                    </button>

                    {app.port && (
                      <button
                        onClick={() => handleOpenNginx(app)}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                        title="Nginx Reverse Proxy Config"
                      >
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        Domain
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(app)}
                      className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                      title="Edit Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(app.id, app.name)}
                      className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                      title="Delete App"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit App Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveApp}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                {editingApp ? 'Edit Application' : 'Add New Application'}
              </h3>
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Application Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. My Express API, Telegram Bot"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Runtime Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="node">Node.js (node / npm)</option>
                  <option value="python">Python (python3 / pip)</option>
                  <option value="custom">Custom Shell Command</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Web Port (Optional)</label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="e.g. 3000, 8000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Execution Command</label>
              <input
                type="text"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                placeholder="e.g. node index.js, python3 main.py, npm start"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Working Directory (Absolute Path)</label>
              <input
                type="text"
                value={formData.cwd}
                onChange={(e) => setFormData({ ...formData, cwd: e.target.value })}
                placeholder="Leave blank to use current folder"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Environment Variables (.env format)</label>
              <textarea
                value={formData.envText}
                onChange={(e) => setFormData({ ...formData, envText: e.target.value })}
                placeholder="NODE_ENV=production&#10;DATABASE_URL=mongodb://...&#10;SECRET_KEY=123"
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 font-mono resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoRestart"
                checked={formData.autoRestart}
                onChange={(e) => setFormData({ ...formData, autoRestart: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="autoRestart" className="text-xs text-slate-300 select-none cursor-pointer">
                Auto-restart application on crash and on server reboot
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium transition"
              >
                {editingApp ? 'Update App' : 'Create & Register'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Live Logs Modal */}
      {logModalApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-800 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-sm text-white">Live Logs: {logModalApp.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                  {logModalApp.command}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScrollLogs}
                    onChange={(e) => setAutoScrollLogs(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  Auto-scroll
                </label>
                <button
                  onClick={handleClearLogs}
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition"
                >
                  Clear Logs
                </button>
                <button
                  onClick={handleCloseLogs}
                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#090d16] p-4 font-mono text-xs overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">Waiting for process logs...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300 leading-relaxed break-all">
                    <span className="text-slate-600 text-[10px] select-none whitespace-nowrap">
                      {log.time ? new Date(log.time).toLocaleTimeString() : ''}
                    </span>
                    <span className="whitespace-pre-wrap">{log.text}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Nginx Configuration Modal */}
      {nginxModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                Nginx Reverse Proxy Config
              </h3>
              <button onClick={() => setNginxModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste this block into <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">/etc/nginx/sites-available/{nginxModal.domain}</code> on your VPS to connect your domain with port {nginxModal.app.port}:
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Your Domain Name</label>
              <input
                type="text"
                value={nginxModal.domain}
                onChange={(e) => handleUpdateNginxDomain(e.target.value)}
                placeholder="e.g. api.domain.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
              />
            </div>

            <div className="relative">
              <pre className="bg-[#090d16] border border-slate-700 rounded-lg p-3 text-xs text-emerald-300 font-mono overflow-x-auto max-h-60">
                {nginxModal.config}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(nginxModal.config);
                  showNotification('Nginx config copied to clipboard!');
                }}
                className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Copy Config"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
              💡 <strong>Next step for SSL:</strong> Run <code className="text-cyan-400">certbot --nginx -d {nginxModal.domain}</code> in the Web Terminal to get a free HTTPS SSL certificate.
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setNginxModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
