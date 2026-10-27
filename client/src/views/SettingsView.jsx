import React, { useState } from 'react';
import { 
  Key, 
  ShieldCheck, 
  Server, 
  Check, 
  AlertTriangle, 
  Copy, 
  Terminal,
  ExternalLink
} from 'lucide-react';
import { api } from '../api';

export default function SettingsView({ user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showNotification('New password and confirmation do not match', true);
      return;
    }
    if (newPassword.length < 6) {
      showNotification('New password must be at least 6 characters long', true);
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      showNotification('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showNotification(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const installCommand = `bash <(curl -sSL https://raw.githubusercontent.com/username/panel-hosting/main/install.sh)`;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition ${notification.isError ? 'bg-rose-950 border border-rose-500/50 text-rose-200' : 'bg-emerald-950 border border-emerald-500/50 text-emerald-200'}`}>
          {notification.isError ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <Check className="w-4 h-4 text-emerald-400" />}
          {notification.msg}
        </div>
      )}

      {/* Change Password Card */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Key className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base">Change Administrator Password</h3>
        </div>
        <p className="text-xs text-slate-400">
          Logged in as <strong className="text-slate-200 font-mono">{user?.username || 'admin'}</strong>. Keep your password strong to protect terminal and file access.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Minimum 6 characters"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition shadow"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Deployment & VPS Info Card */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Server className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base">VPS Installation & Service Info</h3>
        </div>
        <p className="text-xs text-slate-400">
          This panel is designed to run natively as a Linux systemd background service on any Ubuntu/Debian/CentOS VPS.
        </p>

        <div className="space-y-3">
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-3 text-xs space-y-2">
            <div className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              Manage Panel Service via SSH:
            </div>
            <pre className="text-slate-300 font-mono text-[11px] leading-relaxed select-all">
              sudo systemctl status panel     # Check status{'\n'}
              sudo systemctl restart panel    # Restart panel{'\n'}
              sudo systemctl stop panel       # Stop panel{'\n'}
              sudo journalctl -u panel -f     # View live panel server logs
            </pre>
          </div>

          <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-3 text-xs space-y-2">
            <div className="text-slate-400 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Security Tips:
            </div>
            <ul className="list-disc list-inside text-slate-400 space-y-1 text-[11px]">
              <li>Change the default admin password immediately after installation.</li>
              <li>Always configure a domain with an SSL certificate using Nginx and Certbot.</li>
              <li>Only expose port 80/443 publicly and restrict port 3000 to internal or proxy if desired.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
