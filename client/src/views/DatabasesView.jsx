import React, { useState, useEffect } from 'react';
import {
  Database,
  Users,
  Terminal,
  Download,
  Upload,
  Play,
  Trash2,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Server,
  Plus,
  Shield,
  Clock,
  Copy,
  Check,
  Search,
  FileText
} from 'lucide-react';
import { api, formatBytes } from '../api';

export default function DatabasesView() {
  const [activeSubTab, setActiveSubTab] = useState('databases'); // 'databases' | 'users' | 'console' | 'backups'
  const [status, setStatus] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbCharset, setNewDbCharset] = useState('utf8mb4');
  const [newDbCollation, setNewDbCollation] = useState('utf8mb4_unicode_ci');

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserHost, setNewUserHost] = useState('localhost');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDb, setNewUserDb] = useState('*');
  const [newUserPrivileges, setNewUserPrivileges] = useState('ALL PRIVILEGES');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [updatedPassword, setUpdatedPassword] = useState('');

  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreDbTarget, setRestoreDbTarget] = useState('');
  const [restoreSqlContent, setRestoreSqlContent] = useState('');

  // SQL Console state
  const [consoleDb, setConsoleDb] = useState('');
  const [consoleQuery, setConsoleQuery] = useState('SHOW TABLES;');
  const [consoleResult, setConsoleResult] = useState(null);
  const [consoleRunning, setConsoleRunning] = useState(false);
  const [consoleError, setConsoleError] = useState('');

  const [copiedText, setCopiedText] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [statusData, dbsData, usersData, backupsData] = await Promise.all([
        api.getDatabaseStatus(),
        api.listDatabases(),
        api.listDbUsers(),
        api.listDbBackups()
      ]);
      setStatus(statusData);
      setDatabases(dbsData);
      setUsers(usersData);
      setBackups(backupsData);

      // set default console db
      if (!consoleDb && dbsData.length > 0) {
        const nonSystem = dbsData.find(d => !d.isSystem);
        setConsoleDb(nonSystem ? nonSystem.name : dbsData[0].name);
      }
    } catch (err) {
      setError(err.message || 'Failed to load databases information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  // Database Handlers
  const handleCreateDatabase = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api.createDatabase({
        name: newDbName,
        charset: newDbCharset,
        collation: newDbCollation
      });
      setShowCreateDbModal(false);
      setNewDbName('');
      showSuccess(`Database "${newDbName}" berhasil dibuat!`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDatabase = async (name) => {
    if (!window.confirm(`Yakin ingin menghapus database "${name}"? Semua data dan tabel di dalamnya akan hilang permanen!`)) {
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.deleteDatabase(name);
      showSuccess(`Database "${name}" berhasil dihapus.`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackupDatabase = async (name) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.backupDatabase(name);
      showSuccess(`Backup berhasil dibuat: ${res.fileName} (${formatBytes(res.size)})`);
      await fetchData();
      setActiveSubTab('backups');
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // User Handlers
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api.createDbUser({
        username: newUsername,
        host: newUserHost,
        password: newUserPassword,
        database: newUserDb,
        privileges: newUserPrivileges
      });
      setShowCreateUserModal(false);
      setNewUsername('');
      setNewUserPassword('');
      showSuccess(`User SQL "${newUsername}"@'${newUserHost}' berhasil dibuat!`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Hapus user "${user.username}"@'${user.host}'?`)) return;
    setActionLoading(true);
    setError('');
    try {
      await api.deleteDbUser(user.username, user.host);
      showSuccess(`User "${user.username}" berhasil dihapus.`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await api.changeDbUserPassword(targetUser.username, targetUser.host, updatedPassword);
      setShowPasswordModal(false);
      setUpdatedPassword('');
      showSuccess(`Password untuk ${targetUser.username} berhasil diubah.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // SQL Console Execution
  const handleExecuteQuery = async (customQuery) => {
    const queryToRun = customQuery || consoleQuery;
    if (!queryToRun.trim()) return;

    setConsoleRunning(true);
    setConsoleError('');
    try {
      const res = await api.executeSqlQuery(queryToRun, consoleDb);
      setConsoleResult(res);
    } catch (err) {
      setConsoleError(err.message);
      setConsoleResult(null);
    } finally {
      setConsoleRunning(false);
    }
  };

  // Restore Handler
  const handleRestoreDatabase = async (e) => {
    e.preventDefault();
    if (!restoreSqlContent.trim()) {
      setError('File SQL atau query restore tidak boleh kosong');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.restoreDatabase(restoreDbTarget, restoreSqlContent);
      setShowRestoreModal(false);
      setRestoreSqlContent('');
      showSuccess(`Database "${restoreDbTarget}" berhasil di-restore!`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setRestoreSqlContent(event.target.result);
    };
    reader.readAsText(file);
  };

  const filteredDatabases = databases.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Databases (SQL)</h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-indigo-950 border border-indigo-500/40 text-indigo-400">
              MariaDB / MySQL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Kelola database MySQL/MariaDB, user & hak akses, backup .sql, dan jalankan query interaktif
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setNewUsername('');
              setNewUserPassword(generatePassword());
              setShowCreateUserModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            + User SQL
          </button>
          <button
            onClick={() => {
              setNewDbName('');
              setShowCreateDbModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-cyan-900/30"
          >
            <Plus className="w-4 h-4" />
            + Buat Database
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Status & Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Service Status */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Database Engine</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-bold text-white">Online (Port 3306)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {status?.isDevMode ? 'Emulated (Auto-MariaDB on VPS)' : (status?.version || 'MariaDB 10.11')}
            </p>
          </div>
        </div>

        {/* Total Databases */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Database</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-white">
              {databases.filter(d => !d.isSystem).length} <span className="text-xs font-normal text-slate-400">aktif</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              + {databases.filter(d => d.isSystem).length} system database
            </p>
          </div>
        </div>

        {/* Total Users */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">User Akses DB</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-white">{users.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">User lokal & remote</p>
          </div>
        </div>

        {/* Backups */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">File Dump Backup</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Download className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-white">{backups.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">Siap unduh & restore</p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('databases')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'databases'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Databases ({databases.length})
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'users'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            User & Privileges ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('console')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'console'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            SQL Web Console
          </button>
          <button
            onClick={() => setActiveSubTab('backups')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeSubTab === 'backups'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Backup & Restore ({backups.length})
          </button>
        </div>

        {activeSubTab === 'databases' && (
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cari database..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none w-36"
            />
          </div>
        )}
      </div>

      {/* SUB-TAB 1: DATABASES LIST */}
      {activeSubTab === 'databases' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Nama Database</th>
                  <th className="px-5 py-3">Charset / Collation</th>
                  <th className="px-5 py-3">Jumlah Tabel</th>
                  <th className="px-5 py-3">Ukuran Disk</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredDatabases.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-slate-500">
                      Tidak ada database yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredDatabases.map((db) => (
                    <tr key={db.name} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-medium flex items-center gap-2.5">
                        <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <span className="text-white font-mono">{db.name}</span>
                          {db.isSystem && (
                            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                              System
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                        {db.collation || 'utf8mb4_unicode_ci'}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {db.tablesCount || 0} tabel
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-300">
                        {formatBytes(db.sizeBytes || 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setConsoleDb(db.name);
                            setConsoleQuery(`SHOW TABLES;`);
                            setActiveSubTab('console');
                            handleExecuteQuery(`SHOW TABLES;`);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium transition"
                          title="Buka di SQL Web Console"
                        >
                          SQL Console
                        </button>
                        <button
                          onClick={() => handleBackupDatabase(db.name)}
                          disabled={actionLoading || db.isSystem}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium transition disabled:opacity-40"
                          title="Export Dump .sql"
                        >
                          Backup .sql
                        </button>
                        <button
                          onClick={() => handleDeleteDatabase(db.name)}
                          disabled={actionLoading || db.isSystem}
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition disabled:opacity-20"
                          title="Hapus Database"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: USERS & PRIVILEGES */}
      {activeSubTab === 'users' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Host</th>
                  <th className="px-5 py-3">Database Terkait</th>
                  <th className="px-5 py-3">Hak Akses</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {users.map((u) => (
                  <tr key={`${u.username}_${u.host}`} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5 font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-white font-mono font-semibold">{u.username}</span>
                      {u.username === 'root' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 font-normal">
                          Superuser
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">{u.host}</td>
                    <td className="px-5 py-3.5 font-mono text-cyan-400">
                      {u.database === '*' ? 'Semua Database (*)' : u.database}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px] text-slate-300">
                        {u.privileges}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setTargetUser(u);
                          setUpdatedPassword(generatePassword());
                          setShowPasswordModal(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 font-medium transition"
                        title="Ubah Password"
                      >
                        Ganti Password
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.username === 'root'}
                        className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition disabled:opacity-20"
                        title="Hapus User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SQL WEB CONSOLE */}
      {activeSubTab === 'console' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-white">Target Database:</span>
                <select
                  value={consoleDb}
                  onChange={(e) => setConsoleDb(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  {databases.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} {d.isSystem ? '(system)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sample Queries */}
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-500 mr-1">Contoh:</span>
                <button
                  onClick={() => {
                    setConsoleQuery('SHOW TABLES;');
                    handleExecuteQuery('SHOW TABLES;');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
                >
                  SHOW TABLES
                </button>
                <button
                  onClick={() => {
                    setConsoleQuery('SELECT * FROM users LIMIT 10;');
                    handleExecuteQuery('SELECT * FROM users LIMIT 10;');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
                >
                  SELECT *
                </button>
                <button
                  onClick={() => {
                    setConsoleQuery('SHOW DATABASES;');
                    handleExecuteQuery('SHOW DATABASES;');
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
                >
                  SHOW DATABASES
                </button>
              </div>
            </div>

            {/* Query Editor */}
            <div className="relative">
              <textarea
                value={consoleQuery}
                onChange={(e) => setConsoleQuery(e.target.value)}
                placeholder="Tulis perintah SQL di sini (contoh: SELECT * FROM table_name;)..."
                rows="4"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-cyan-300 outline-none focus:border-cyan-500 transition resize-y"
              />
              <button
                onClick={() => handleExecuteQuery()}
                disabled={consoleRunning}
                className="absolute right-3 bottom-4 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {consoleRunning ? 'Menjalankan...' : 'Jalankan Query (Run)'}
              </button>
            </div>

            {consoleError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-mono">
                {consoleError}
              </div>
            )}
          </div>

          {/* Query Results Table */}
          {consoleResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">Hasil Query</span>
                  <span>{consoleResult.rowCount} baris ditemukan</span>
                  <span>• {consoleResult.durationMs} ms</span>
                </div>
                {consoleResult.rows && consoleResult.rows.length > 0 && (
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(consoleResult.rows, null, 2))}
                    className="flex items-center gap-1 text-[11px] hover:text-white transition"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedText ? 'Tersalin' : 'Salin JSON'}
                  </button>
                )}
              </div>

              {consoleResult.columns && consoleResult.columns.length > 0 ? (
                <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 sticky top-0 border-b border-slate-800 text-slate-400">
                      <tr>
                        {consoleResult.columns.map((col, idx) => (
                          <th key={idx} className="px-4 py-2.5 font-semibold text-cyan-400 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 text-slate-200">
                      {consoleResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/30">
                          {consoleResult.columns.map((col, cIdx) => (
                            <td key={cIdx} className="px-4 py-2 whitespace-nowrap">
                              {row[col] !== null ? String(row[col]) : <span className="text-slate-600 italic">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Query berhasil dieksekusi tanpa hasil baris (misal INSERT / UPDATE / CREATE).
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: BACKUPS & RESTORE */}
      {activeSubTab === 'backups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Daftar file dump `.sql` yang dihasilkan saat Anda menekan tombol "Backup .sql" pada menu Databases.
            </p>
            <button
              onClick={() => {
                setRestoreDbTarget(databases.length > 0 ? databases[0].name : '');
                setRestoreSqlContent('');
                setShowRestoreModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Restore Database (.sql)
            </button>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3">Nama File Backup</th>
                    <th className="px-5 py-3">Ukuran File</th>
                    <th className="px-5 py-3">Waktu Pembuatan</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-slate-500">
                        Belum ada file backup. Buka tab "Databases" lalu klik "Backup .sql" pada database yang ingin dicadangkan.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.fileName} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-3.5 font-medium flex items-center gap-2 font-mono text-cyan-300">
                          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                          {b.fileName}
                        </td>
                        <td className="px-5 py-3.5 font-mono">{formatBytes(b.sizeBytes)}</td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {new Date(b.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <a
                            href={api.getDbBackupDownloadUrl(b.fileName)}
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Unduh File
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE DATABASE */}
      {showCreateDbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                Buat Database Baru
              </h3>
              <button onClick={() => setShowCreateDbModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateDatabase} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nama Database</label>
                <input
                  type="text"
                  required
                  placeholder="contoh: db_toko_online"
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Hanya huruf kecil, angka, dan garis bawah (_).
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Character Set</label>
                  <select
                    value={newDbCharset}
                    onChange={(e) => setNewDbCharset(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="utf8mb4">utf8mb4 (Rekomendasi)</option>
                    <option value="utf8">utf8</option>
                    <option value="latin1">latin1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Collation</label>
                  <select
                    value={newDbCollation}
                    onChange={(e) => setNewDbCollation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                  >
                    <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
                    <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateDbModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-50"
                >
                  {actionLoading ? 'Membuat...' : 'Buat Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Buat User Database Baru
              </h3>
              <button onClick={() => setShowCreateUserModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="user_toko"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Host</label>
                  <input
                    type="text"
                    required
                    value={newUserHost}
                    onChange={(e) => setNewUserHost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setNewUserPassword(generatePassword())}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Acak Password
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Hak Akses ke Database</label>
                <select
                  value={newUserDb}
                  onChange={(e) => setNewUserDb(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="*">Semua Database (*)</option>
                  {databases.filter(d => !d.isSystem).map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Privileges</label>
                <select
                  value={newUserPrivileges}
                  onChange={(e) => setNewUserPrivileges(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="ALL PRIVILEGES">ALL PRIVILEGES (Akses Penuh)</option>
                  <option value="SELECT, INSERT, UPDATE, DELETE">Read & Write (SELECT, INSERT, UPDATE, DELETE)</option>
                  <option value="SELECT">Read Only (SELECT)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  {actionLoading ? 'Menyimpan...' : 'Buat User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE PASSWORD */}
      {showPasswordModal && targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                Ubah Password User: {targetUser.username}
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Password Baru</label>
                  <button
                    type="button"
                    onClick={() => setUpdatedPassword(generatePassword())}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    Acak Password
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={updatedPassword}
                  onChange={(e) => setUpdatedPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
                >
                  {actionLoading ? 'Memperbarui...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESTORE DATABASE */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                Restore Database dari File SQL
              </h3>
              <button onClick={() => setShowRestoreModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRestoreDatabase} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Database</label>
                <select
                  value={restoreDbTarget}
                  onChange={(e) => setRestoreDbTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500"
                >
                  {databases.filter(d => !d.isSystem).map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Pilih File .sql dari Komputer</label>
                <input
                  type="file"
                  accept=".sql,.txt"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Atau Tempel (Paste) Konten SQL</label>
                <textarea
                  value={restoreSqlContent}
                  onChange={(e) => setRestoreSqlContent(e.target.value)}
                  rows="6"
                  placeholder="CREATE TABLE ... INSERT INTO ..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500 resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !restoreSqlContent.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                >
                  {actionLoading ? 'Mengeksekusi...' : 'Jalankan Restore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
