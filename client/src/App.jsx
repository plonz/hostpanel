import React, { useState, useEffect } from 'react';
import {
  Server,
  Folder,
  Terminal as TerminalIcon,
  Layers,
  Settings,
  LogOut,
  Cpu,
  Activity,
  HardDrive,
  Lock,
  User,
  Shield,
  Clock,
  Globe,
  Database
} from 'lucide-react';
import { api, getToken, setToken, clearToken, formatBytes, formatUptime } from './api';

import DashboardView from './views/DashboardView';
import FileManagerView from './views/FileManagerView';
import TerminalView from './views/TerminalView';
import ProcessManagerView from './views/ProcessManagerView';
import DomainsView from './views/DomainsView';
import DatabasesView from './views/DatabasesView';
import SettingsView from './views/SettingsView';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | domains | files | terminal | apps | settings
  const [customFilePath, setCustomFilePath] = useState(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Global system stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = async () => {
    if (!getToken()) return;
    try {
      setStatsLoading(true);
      const data = await api.getStats();
      setStats(data);
    } catch (e) {
      // ignore periodic poll failure
    } finally {
      setStatsLoading(false);
    }
  };

  const checkAuth = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setCheckingAuth(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
      fetchStats();
    } catch (e) {
      clearToken();
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth_expired', handleAuthExpired);

    return () => {
      window.removeEventListener('auth_expired', handleAuthExpired);
    };
  }, []);

  // Poll system stats every 6 seconds when logged in
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchStats, 6000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const data = await api.login(loginUsername, loginPassword);
      setToken(data.token);
      setUser(data.user);
      fetchStats();
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {}
    clearToken();
    setUser(null);
    setStats(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Server className="w-10 h-10 text-cyan-400 animate-pulse" />
          <p className="text-sm font-medium">Connecting to VPS Hosting Panel...</p>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400 mb-1">
              <Server className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">VPS Hosting Panel</h1>
            <p className="text-xs text-slate-400">Sign in to manage files, terminal & background apps</p>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-medium text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                  placeholder="admin"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-900/30 active:scale-[0.99] disabled:opacity-50"
            >
              {loginLoading ? 'Signing In...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 text-center">
            Default credentials: <span className="text-slate-200 font-mono">admin</span> / <span className="text-slate-200 font-mono">admin123</span>
          </div>
        </div>
      </div>
    );
  }

  // Quick stats summary
  const cpuLoad = stats?.load?.currentLoad ?? 0;
  const memUsedPercent = stats?.memory?.usedPercent ?? 0;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex flex-col">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-3">
          {/* Logo & Status */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">HostPanel</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  VPS Live
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate max-w-[150px] sm:max-w-none">
                {stats?.static?.os?.hostname || 'Connected'}
              </div>
            </div>
          </div>

          {/* Center Tabs Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${activeTab === 'dashboard' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('domains')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${activeTab === 'domains' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Websites</span>
            </button>
            <button
              onClick={() => setActiveTab('databases')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${activeTab === 'databases' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Databases</span>
            </button>
            <button
              onClick={() => {
                setCustomFilePath('');
                setActiveTab('files');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${activeTab === 'files' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${activeTab === 'terminal' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab('apps')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${activeTab === 'apps' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Apps (Node/Py)</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition shrink-0 ${activeTab === 'settings' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'}`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Right Resource Indicators & User */}
          <div className="flex items-center gap-2.5 shrink-0">
            {stats && (
              <div className="hidden xl:flex items-center gap-3 text-xs bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400">CPU:</span>
                  <span className={`font-mono font-semibold ${cpuLoad > 80 ? 'text-rose-400' : 'text-slate-200'}`}>{cpuLoad}%</span>
                </div>
                <div className="w-px h-3 bg-slate-800" />
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-400">RAM:</span>
                  <span className={`font-mono font-semibold ${memUsedPercent > 80 ? 'text-rose-400' : 'text-slate-200'}`}>{memUsedPercent}%</span>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-medium transition border border-slate-700/60 shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around bg-slate-950 border-t border-slate-800 px-2 py-1.5 text-[11px]">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded ${activeTab === 'dashboard' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('domains')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded ${activeTab === 'domains' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Globe className="w-4 h-4" />
            <span>Websites</span>
          </button>
          <button
            onClick={() => setActiveTab('databases')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded ${activeTab === 'databases' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Database className="w-4 h-4" />
            <span>SQL</span>
          </button>
          <button
            onClick={() => {
              setCustomFilePath('');
              setActiveTab('files');
            }}
            className={`flex flex-col items-center gap-0.5 p-1 rounded ${activeTab === 'files' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Folder className="w-4 h-4" />
            <span>Files</span>
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded ${activeTab === 'terminal' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <TerminalIcon className="w-4 h-4" />
            <span>Terminal</span>
          </button>
          <button
            onClick={() => setActiveTab('apps')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded ${activeTab === 'apps' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Layers className="w-4 h-4" />
            <span>Apps</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-0.5 p-1 rounded ${activeTab === 'settings' ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Main Content View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            loading={statsLoading}
            onRefresh={fetchStats}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'domains' && (
          <DomainsView
            onOpenFileManager={(dir) => {
              setCustomFilePath(dir);
              setActiveTab('files');
            }}
          />
        )}

        {activeTab === 'databases' && <DatabasesView />}

        {activeTab === 'files' && <FileManagerView initialPath={customFilePath} />}

        {activeTab === 'terminal' && <TerminalView />}

        {activeTab === 'apps' && <ProcessManagerView />}

        {activeTab === 'settings' && <SettingsView user={user} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        VPS Hosting Panel • Light & Fast Web Panel for Node.js & Python
      </footer>
    </div>
  );
}

