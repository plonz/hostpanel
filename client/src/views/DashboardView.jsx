import React from 'react';
import { 
  Cpu, 
  HardDrive, 
  Server, 
  Clock, 
  Terminal as TerminalIcon, 
  Folder, 
  Layers, 
  RefreshCw,
  Activity,
  Code,
  Globe,
  Database
} from 'lucide-react';
import { formatBytes, formatUptime } from '../api';

export default function DashboardView({ stats, loading, onRefresh, onNavigate }) {
  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-cyan-400" />
        <p>Loading system statistics...</p>
      </div>
    );
  }

  const cpuLoad = stats?.load?.currentLoad ?? 0;
  const memUsedPercent = stats?.memory?.usedPercent ?? 0;
  const mainDisk = stats?.disks?.[0];
  const diskPercent = mainDisk ? Math.round(mainDisk.use) : 0;

  const getLoadColor = (percent) => {
    if (percent > 85) return 'text-rose-400 bg-rose-500';
    if (percent > 65) return 'text-amber-400 bg-amber-500';
    return 'text-emerald-400 bg-emerald-500';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            {stats?.static?.os?.hostname || 'VPS Server'}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {stats?.static?.os?.distro || stats?.static?.os?.platform} ({stats?.static?.os?.arch}) • Kernel {stats?.static?.os?.release}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 px-3 py-1.5 rounded-lg text-xs text-slate-300">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Uptime: <strong className="text-white">{formatUptime(stats?.uptime)}</strong></span>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Resource Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CPU Card */}
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>CPU Usage</span>
            </div>
            <span className={`text-xl font-bold ${getLoadColor(cpuLoad).split(' ')[0]}`}>
              {cpuLoad}%
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-700/40">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getLoadColor(cpuLoad).split(' ')[1]}`}
              style={{ width: `${Math.min(100, Math.max(0, cpuLoad))}%` }}
            />
          </div>
          <div className="mt-3 text-xs text-slate-400 flex justify-between">
            <span className="truncate pr-2">{stats?.static?.cpu?.brand || 'CPU'}</span>
            <span className="whitespace-nowrap font-medium text-slate-300">
              {stats?.static?.cpu?.cores || 1} Cores
            </span>
          </div>
        </div>

        {/* Memory Card */}
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span>RAM Memory</span>
            </div>
            <span className={`text-xl font-bold ${getLoadColor(memUsedPercent).split(' ')[0]}`}>
              {memUsedPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-700/40">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getLoadColor(memUsedPercent).split(' ')[1]}`}
              style={{ width: `${Math.min(100, Math.max(0, memUsedPercent))}%` }}
            />
          </div>
          <div className="mt-3 text-xs text-slate-400 flex justify-between">
            <span>Used: <strong className="text-slate-200">{formatBytes(stats?.memory?.used)}</strong></span>
            <span>Total: <strong className="text-slate-200">{formatBytes(stats?.memory?.total)}</strong></span>
          </div>
        </div>

        {/* Disk Card */}
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <HardDrive className="w-5 h-5 text-emerald-400" />
              <span>Disk Storage</span>
            </div>
            <span className={`text-xl font-bold ${getLoadColor(diskPercent).split(' ')[0]}`}>
              {diskPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-700/40">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getLoadColor(diskPercent).split(' ')[1]}`}
              style={{ width: `${Math.min(100, Math.max(0, diskPercent))}%` }}
            />
          </div>
          <div className="mt-3 text-xs text-slate-400 flex justify-between">
            <span>Used: <strong className="text-slate-200">{formatBytes(mainDisk?.used)}</strong></span>
            <span>Total: <strong className="text-slate-200">{formatBytes(mainDisk?.size)}</strong></span>
          </div>
        </div>
      </div>

      {/* Quick Launch & Runtime info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Quick Launch Shortcuts */}
        <div className="md:col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Quick Navigation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => onNavigate('domains')}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/40 transition text-left group"
            >
              <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-slate-200 text-sm">Domains & Sites</div>
                <div className="text-xs text-slate-400">DNS, SSL & Virtual hosts</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('databases')}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/40 transition text-left group"
            >
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-slate-200 text-sm">SQL Databases</div>
                <div className="text-xs text-slate-400">MariaDB/MySQL & Users</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('files')}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/40 transition text-left group"
            >
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-slate-200 text-sm">File Manager</div>
                <div className="text-xs text-slate-400">Browse & edit files</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('terminal')}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/40 transition text-left group"
            >
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                <TerminalIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-slate-200 text-sm">Web Terminal</div>
                <div className="text-xs text-slate-400">Run shell commands</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('apps')}
              className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/40 transition text-left group"
            >
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-slate-950 transition">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="font-medium text-slate-200 text-sm">Process Manager</div>
                <div className="text-xs text-slate-400">Node & Python apps</div>
              </div>
            </button>
          </div>
        </div>

        {/* Installed Runtimes */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Code className="w-4 h-4 text-emerald-400" />
            Detected Runtimes
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
              <span className="text-sm font-medium text-slate-300">Node.js</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono px-2 py-0.5 rounded">
                {stats?.static?.runtimes?.node || 'Detected'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40">
              <span className="text-sm font-medium text-slate-300">Python</span>
              <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono px-2 py-0.5 rounded">
                {stats?.static?.runtimes?.python || 'Detected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Disks Table */}
      {stats?.disks && stats.disks.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            Mounted Filesystems & Disks
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Filesystem / Mount</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Total Size</th>
                  <th className="py-2.5 px-3">Used</th>
                  <th className="py-2.5 px-3">Available</th>
                  <th className="py-2.5 px-3">Usage Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-slate-300">
                {stats.disks.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-700/30 transition">
                    <td className="py-2.5 px-3 font-mono font-medium text-white">{d.mount || d.fs}</td>
                    <td className="py-2.5 px-3">{d.type || 'local'}</td>
                    <td className="py-2.5 px-3 font-mono">{formatBytes(d.size)}</td>
                    <td className="py-2.5 px-3 font-mono text-amber-300">{formatBytes(d.used)}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-300">{formatBytes(d.available)}</td>
                    <td className="py-2.5 px-3 w-48">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                          <div
                            className={`h-full rounded-full ${d.use > 85 ? 'bg-rose-500' : d.use > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, d.use)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs w-10 text-right">{Math.round(d.use)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
