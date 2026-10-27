import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Folder,
  Server,
  RefreshCw,
  Power,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  Lock,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';

export default function DomainsView({ onOpenFileManager }) {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('domain'); // 'domain' | 'subdomain'
  const [formDomain, setFormDomain] = useState('');
  const [subPrefix, setSubPrefix] = useState('');
  const [parentDomain, setParentDomain] = useState('');
  const [formType, setFormType] = useState('static'); // 'static' | 'proxy' | 'php'
  const [formPort, setFormPort] = useState('3000');
  const [formDocRoot, setFormDocRoot] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // SSL Issuance State
  const [issuingSslId, setIssuingSslId] = useState(null);
  const [sslError, setSslError] = useState('');
  const [sslSuccess, setSslSuccess] = useState('');

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteFiles, setDeleteFiles] = useState(false);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const data = await api.listDomains();
      setDomains(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApps = async () => {
    try {
      const data = await api.listApps();
      setApps(data.apps || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchDomains();
    fetchApps();
  }, []);

  const openModal = (mode = 'domain') => {
    setModalMode(mode);
    setFormError('');
    setFormDomain('');
    setSubPrefix('');
    // Pick first non-subdomain or first domain as default parent
    const defaultParent = domains.find(d => d.domain.split('.').length <= 2)?.domain || domains[0]?.domain || '';
    setParentDomain(defaultParent);
    if (mode === 'subdomain' && defaultParent) {
      setFormDocRoot(`/var/www/sub.${defaultParent}`);
    } else {
      setFormDocRoot('');
    }
    setIsModalOpen(true);
  };

  const handleDomainChange = (e) => {
    const val = e.target.value.toLowerCase();
    setFormDomain(val);
    if (!formDocRoot || formDocRoot.startsWith('/var/www/')) {
      setFormDocRoot(`/var/www/${val}`);
    }
  };

  const handleSubdomainChange = (prefix, parent) => {
    const cleanPrefix = (prefix || '').trim().toLowerCase();
    const cleanParent = (parent || '').trim().toLowerCase();
    setSubPrefix(cleanPrefix);
    setParentDomain(cleanParent);

    if (cleanPrefix && cleanParent) {
      const full = `${cleanPrefix}.${cleanParent}`;
      setFormDocRoot(`/var/www/${full}`);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    let targetDomain = formDomain.trim().toLowerCase();
    if (modalMode === 'subdomain') {
      const cleanPrefix = subPrefix.trim().toLowerCase();
      const cleanParent = parentDomain.trim().toLowerCase();
      if (!cleanPrefix || !cleanParent) {
        setFormError('Nama subdomain dan domain induk harus diisi');
        setFormSubmitting(false);
        return;
      }
      targetDomain = `${cleanPrefix}.${cleanParent}`;
    }

    try {
      await api.createDomain({
        domain: targetDomain,
        type: formType,
        port: formPort,
        documentRoot: formDocRoot,
        email: formEmail
      });
      setIsModalOpen(false);
      setFormDomain('');
      setSubPrefix('');
      setFormDocRoot('');
      setFormEmail('');
      fetchDomains();
    } catch (err) {
      setFormError(err.message || 'Gagal menambahkan domain');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.toggleDomain(id);
      fetchDomains();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDomain(deleteTarget.id, deleteFiles);
      setDeleteTarget(null);
      fetchDomains();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleIssueSsl = async (domainObj) => {
    setIssuingSslId(domainObj.id);
    setSslError('');
    setSslSuccess('');

    try {
      const res = await api.issueDomainSsl(domainObj.id, domainObj.sslEmail || '');
      setSslSuccess(res.message || 'SSL Let\'s Encrypt berhasil dipasang!');
      fetchDomains();
    } catch (err) {
      setSslError(err.message || 'Gagal memasang SSL');
    } finally {
      setIssuingSslId(null);
    }
  };

  const totalDomains = domains.length;
  const activeDomains = domains.filter((d) => d.enabled).length;
  const sslDomains = domains.filter((d) => d.ssl).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Globe className="w-6 h-6 text-cyan-400" />
            Websites & Domain Hosting
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Hubungkan domain Anda ke VPS dengan Nginx virtual host, static HTML, reverse proxy Node/Python, dan SSL otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchDomains}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => openModal('subdomain')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 font-medium text-xs sm:text-sm transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            + Subdomain
          </button>
          <button
            onClick={() => openModal('domain')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs sm:text-sm transition shadow-lg shadow-cyan-900/30"
          >
            <Plus className="w-4 h-4" />
            + Domain Utama
          </button>
        </div>
      </div>

      {/* Alert Notifications */}
      {sslSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{sslSuccess}</span>
          </div>
          <button onClick={() => setSslSuccess('')} className="text-slate-400 hover:text-white font-bold">×</button>
        </div>
      )}

      {sslError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{sslError}</span>
          </div>
          <button onClick={() => setSslError('')} className="text-slate-400 hover:text-white font-bold">×</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{totalDomains}</div>
            <div className="text-xs text-slate-400">Total Website Terdaftar</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{activeDomains}</div>
            <div className="text-xs text-slate-400">Website Aktif (Nginx)</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{sslDomains}</div>
            <div className="text-xs text-slate-400">Sertifikat SSL Aktif (HTTPS)</div>
          </div>
        </div>
      </div>

      {/* Domains List */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Daftar Website & Virtual Host</span>
          <span className="text-xs text-slate-500">{domains.length} domain terpasang</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
            Memuat data domain...
          </div>
        ) : domains.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <Globe className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-base text-slate-300 font-semibold mb-1">Belum ada website yang ditambahkan</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              Klik tombol di bawah untuk menghubungkan domain pertama Anda ke VPS ini.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition"
            >
              + Tambah Website Sekarang
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {domains.map((item) => {
              const siteUrl = `${item.ssl ? 'https' : 'http'}://${item.domain}`;

              return (
                <div key={item.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-800/20 transition">
                  {/* Left Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-bold text-white hover:text-cyan-400 flex items-center gap-1.5 transition group"
                      >
                        {item.domain}
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
                      </a>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.enabled
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {item.enabled ? 'Aktif' : 'Nonaktif'}
                      </span>

                      {/* Domain / Subdomain Badge */}
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          item.domain.split('.').length > 2
                            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
                            : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                        }`}
                      >
                        {item.domain.split('.').length > 2 ? 'Subdomain' : 'Domain Utama'}
                      </span>

                      {/* Type Badge */}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {item.type === 'proxy' ? `Proxy → Port ${item.port}` : item.type === 'php' ? 'PHP Website' : 'Static Website'}
                      </span>

                      {/* SSL Badge */}
                      {item.ssl ? (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          <Lock className="w-3 h-3" />
                          SSL Aktif
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/40">
                          <ShieldAlert className="w-3 h-3" />
                          Belum Ada SSL
                        </span>
                      )}
                    </div>

                    {/* Path / Details */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                      {item.type !== 'proxy' && item.documentRoot && (
                        <div className="flex items-center gap-1 font-mono text-[11px] bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                          <Folder className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{item.documentRoot}</span>
                        </div>
                      )}
                      {item.type === 'proxy' && (
                        <div className="flex items-center gap-1 font-mono text-[11px] bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                          <Server className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Forward to http://127.0.0.1:{item.port}</span>
                        </div>
                      )}
                      <span className="text-[11px] text-slate-500">
                        Ditambahkan: {new Date(item.createdAt).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                    {/* Open in File Manager if static/php */}
                    {item.type !== 'proxy' && onOpenFileManager && item.documentRoot && (
                      <button
                        onClick={() => onOpenFileManager(item.documentRoot)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700"
                        title="Buka folder website di File Manager"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                        <span>File Manager</span>
                      </button>
                    )}

                    {/* Issue SSL Button */}
                    {!item.ssl && (
                      <button
                        onClick={() => handleIssueSsl(item)}
                        disabled={issuingSslId === item.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-medium transition disabled:opacity-50"
                        title="Pasang SSL Let's Encrypt Otomatis"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{issuingSslId === item.id ? 'Memasang SSL...' : 'Pasang SSL'}</span>
                      </button>
                    )}

                    {/* Toggle Button */}
                    <button
                      onClick={() => handleToggle(item.id)}
                      className={`p-1.5 rounded-lg border transition ${
                        item.enabled
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border-emerald-500/40'
                      }`}
                      title={item.enabled ? 'Nonaktifkan Website' : 'Aktifkan Website'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteTarget(item)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                      title="Hapus Website"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Card: Cara Setting DNS */}
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          Petunjuk Menghubungkan Domain ke VPS
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Agar domain Anda bisa diakses dan dipasang SSL, pastikan Anda sudah menambahkan <strong>A Record</strong> di pengelola DNS domain Anda (Cloudflare / Niagahoster / Namecheap / DomaiNesia):
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="font-semibold text-cyan-300 block mb-1">Domain Utama (contoh.com)</span>
            <div className="font-mono text-slate-300 space-y-0.5 text-[11px]">
              <div>Type: <span className="text-amber-300">A</span></div>
              <div>Name: <span className="text-amber-300">@</span></div>
              <div>Value: <span className="text-emerald-300">&lt;IP_VPS_ANDA&gt;</span></div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="font-semibold text-cyan-300 block mb-1">Subdomain (misal: api.contoh.com / panel.contoh.com)</span>
            <div className="font-mono text-slate-300 space-y-0.5 text-[11px]">
              <div>Type: <span className="text-amber-300">A</span></div>
              <div>Name: <span className="text-amber-300">api</span> (atau nama subdomain Anda)</div>
              <div>Value: <span className="text-emerald-300">&lt;IP_VPS_ANDA&gt;</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Website / Subdomain Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <Globe className="w-5 h-5 text-cyan-400" />
                <span>{modalMode === 'subdomain' ? 'Tambah Subdomain Baru' : 'Tambah Domain Utama Baru'}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setModalMode('domain');
                  setFormError('');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  modalMode === 'domain'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌐 Domain Utama
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('subdomain');
                  setFormError('');
                  const defaultParent = domains.find(d => d.domain.split('.').length <= 2)?.domain || domains[0]?.domain || '';
                  setParentDomain(defaultParent);
                  if (subPrefix && defaultParent) {
                    setFormDocRoot(`/var/www/${subPrefix}.${defaultParent}`);
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  modalMode === 'subdomain'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🏷️ Subdomain
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Subdomain Input vs Domain Input */}
              {modalMode === 'subdomain' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-300">
                    Konfigurasi Subdomain <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1/3">
                      <input
                        type="text"
                        required
                        value={subPrefix}
                        onChange={(e) => handleSubdomainChange(e.target.value, parentDomain)}
                        placeholder="api / blog / dev"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition text-right font-medium"
                      />
                    </div>
                    <span className="text-slate-400 font-bold">.</span>
                    <div className="flex-1">
                      {domains.length > 0 ? (
                        <select
                          value={parentDomain}
                          onChange={(e) => handleSubdomainChange(subPrefix, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition"
                        >
                          <option value="">-- Pilih Domain Induk --</option>
                          {domains.map((d) => (
                            <option key={d.id} value={d.domain}>
                              {d.domain}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          value={parentDomain}
                          onChange={(e) => handleSubdomainChange(subPrefix, e.target.value)}
                          placeholder="domainanda.com"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 transition"
                        />
                      )}
                    </div>
                  </div>

                  {/* Preview Full Subdomain */}
                  {subPrefix && parentDomain && (
                    <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-1">
                      <div className="text-slate-400">Subdomain lengkap:</div>
                      <div className="font-mono text-indigo-300 font-semibold text-sm">
                        {subPrefix.trim().toLowerCase()}.{parentDomain.trim().toLowerCase()}
                      </div>
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-indigo-500/20">
                        Pastikan menambah <strong>A-Record</strong>: Name = <code className="text-amber-300">{subPrefix.trim().toLowerCase()}</code>, Target = <code className="text-emerald-300">&lt;IP_VPS&gt;</code> di DNS domain Anda.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nama Domain Utama <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formDomain}
                    onChange={handleDomainChange}
                    placeholder="contoh: domainanda.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Untuk domain utama, arahkan A-Record (@) ke IP VPS Anda.
                  </p>
                </div>
              )}

              {/* Website Type Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Tipe Website <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('static')}
                    className={`p-3 rounded-xl border text-left transition ${
                      formType === 'static'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white mb-0.5">Static Website</div>
                    <div className="text-[11px] text-slate-400">HTML, CSS, JS, atau React/Vue Build</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('proxy')}
                    className={`p-3 rounded-xl border text-left transition ${
                      formType === 'proxy'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs text-white mb-0.5">Reverse Proxy</div>
                    <div className="text-[11px] text-slate-400">Node.js / Python (Port Internal)</div>
                  </button>
                </div>
              </div>

              {/* Dynamic inputs based on type */}
              {formType === 'proxy' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target Port Internal <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      value={formPort}
                      onChange={(e) => setFormPort(e.target.value)}
                      placeholder="3000"
                      className="w-32 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 transition"
                    />
                    {apps.length > 0 && (
                      <select
                        onChange={(e) => {
                          const app = apps.find((a) => a.id === e.target.value);
                          if (app && app.port) setFormPort(app.port);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
                      >
                        <option value="">-- Pilih dari App Berjalan --</option>
                        {apps.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} (Port: {a.port || 'N/A'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Trafik dari domain akan otomatis diforward ke http://127.0.0.1:{formPort || 3000} lengkap dengan WebSocket.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Document Root Folder <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formDocRoot}
                    onChange={(e) => setFormDocRoot(e.target.value)}
                    placeholder="/var/www/domainanda.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-200 outline-none focus:border-cyan-500 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Folder tempat Anda menyimpan berkas HTML/build website. Template `index.html` awal akan otomatis dibuat jika folder baru.
                  </p>
                </div>
              )}

              {/* Email for SSL */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Pemberitahuan SSL (Opsional)
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="admin@domainanda.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500 transition"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition shadow-lg shadow-cyan-900/30 disabled:opacity-50"
                >
                  {formSubmitting ? 'Menyimpan...' : 'Buat Website & Pasang Nginx'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              Hapus Website {deleteTarget.domain}?
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Konfigurasi virtual host Nginx untuk domain ini akan dinonaktifkan dan dihapus dari server.
            </p>

            {deleteTarget.type !== 'proxy' && deleteTarget.documentRoot && (
              <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteFiles}
                  onChange={(e) => setDeleteFiles(e.target.checked)}
                  className="rounded border-slate-700 text-rose-500 focus:ring-0"
                />
                <span>Hapus juga folder file website ({deleteTarget.documentRoot})</span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition"
              >
                Hapus Website
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
