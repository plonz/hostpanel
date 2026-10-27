const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { DATA_DIR } = require('../config');

const execAsync = promisify(exec);
const DOMAINS_FILE = path.join(DATA_DIR, 'domains.json');
const IS_LINUX = process.platform === 'linux';

class DomainService {
  constructor() {
    this.ensureDataFile();
  }

  ensureDataFile() {
    if (!fs.existsSync(DOMAINS_FILE)) {
      fs.writeFileSync(DOMAINS_FILE, JSON.stringify([], null, 2));
    }
  }

  getDomains() {
    this.ensureDataFile();
    try {
      const data = fs.readFileSync(DOMAINS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      return [];
    }
  }

  saveDomains(domains) {
    fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
  }

  getNginxPaths(domainName) {
    if (IS_LINUX && fs.existsSync('/etc/nginx')) {
      return {
        available: `/etc/nginx/sites-available/${domainName}.conf`,
        enabled: `/etc/nginx/sites-enabled/${domainName}.conf`,
        isRealNginx: true
      };
    }
    // Fallback for Windows or non-root dev environments
    const fallbackDir = path.join(DATA_DIR, 'nginx');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return {
      available: path.join(fallbackDir, `${domainName}.conf`),
      enabled: path.join(fallbackDir, `${domainName}.enabled.conf`),
      isRealNginx: false
    };
  }

  generateNginxConfig({ domain, type, port, documentRoot }) {
    if (type === 'proxy') {
      return `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port || 3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
`;
    }

    if (type === 'php') {
      return `server {
    listen 80;
    server_name ${domain};
    root ${documentRoot};
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
    }

    location ~ /\\.ht {
        deny all;
    }
}
`;
    }

    // Default: static website (HTML / React Build / Vue / Static Site)
    return `server {
    listen 80;
    server_name ${domain};
    root ${documentRoot};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\\.ht {
        deny all;
    }
}
`;
  }

  createDefaultIndexHtml(targetPath, domain) {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const indexPath = path.join(targetPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Selamat Datang di ${domain}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; text-align: center; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        h1 { color: #38bdf8; margin-top: 0; font-size: 1.8rem; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
        .badge { display: inline-block; background: #0369a1; color: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; }
        .footer { margin-top: 1.5rem; font-size: 0.8rem; color: #64748b; border-top: 1px solid #334155; padding-top: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">Situs Aktif</span>
        <h1>${domain}</h1>
        <p>Website Anda telah berhasil dibuat dan terhubung ke VPS melalui <strong>HostPanel</strong>.</p>
        <p>Silakan upload file HTML, PHP, atau build aplikasi Anda ke folder ini melalui menu <strong>File Manager</strong> di panel.</p>
        <div class="footer">Ditenagai oleh HostPanel VPS Control Panel</div>
    </div>
</body>
</html>`;
      fs.writeFileSync(indexPath, htmlContent);
    }
  }

  async reloadNginx() {
    if (!IS_LINUX) return { success: true, message: 'Skipped on non-linux' };
    try {
      await execAsync('nginx -t');
      await execAsync('systemctl reload nginx || nginx -s reload');
      return { success: true };
    } catch (err) {
      console.error('Nginx reload error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async addDomain({ domain, type = 'static', port = 3000, documentRoot = '', email = '' }) {
    if (!domain || !domain.trim()) {
      throw new Error('Nama domain wajib diisi');
    }

    const cleanDomain = domain.trim().toLowerCase();
    const domains = this.getDomains();

    if (domains.find((d) => d.domain === cleanDomain)) {
      throw new Error(`Domain ${cleanDomain} sudah terdaftar di panel`);
    }

    // Default documentRoot
    let finalDocRoot = documentRoot;
    if (type !== 'proxy') {
      if (!finalDocRoot) {
        finalDocRoot = IS_LINUX
          ? `/var/www/${cleanDomain}`
          : path.join(DATA_DIR, 'websites', cleanDomain);
      }
      this.createDefaultIndexHtml(finalDocRoot, cleanDomain);
    }

    const nginxPaths = this.getNginxPaths(cleanDomain);
    const nginxConfig = this.generateNginxConfig({
      domain: cleanDomain,
      type,
      port: Number(port) || 3000,
      documentRoot: finalDocRoot
    });

    // Write Nginx config
    try {
      fs.writeFileSync(nginxPaths.available, nginxConfig, 'utf8');

      if (nginxPaths.isRealNginx) {
        // Create symlink to sites-enabled
        if (!fs.existsSync(nginxPaths.enabled)) {
          fs.symlinkSync(nginxPaths.available, nginxPaths.enabled);
        }
        await this.reloadNginx();
      }
    } catch (e) {
      console.error('Error writing nginx config:', e.message);
    }

    const newDomain = {
      id: Date.now().toString(),
      domain: cleanDomain,
      type, // 'static' | 'proxy' | 'php'
      port: type === 'proxy' ? Number(port) || 3000 : null,
      documentRoot: type !== 'proxy' ? finalDocRoot : null,
      enabled: true,
      ssl: false,
      sslEmail: email || null,
      createdAt: new Date().toISOString()
    };

    domains.push(newDomain);
    this.saveDomains(domains);

    return newDomain;
  }

  async toggleDomain(id) {
    const domains = this.getDomains();
    const domain = domains.find((d) => d.id === id);
    if (!domain) throw new Error('Domain tidak ditemukan');

    domain.enabled = !domain.enabled;
    const nginxPaths = this.getNginxPaths(domain.domain);

    if (nginxPaths.isRealNginx) {
      try {
        if (domain.enabled) {
          if (!fs.existsSync(nginxPaths.enabled) && fs.existsSync(nginxPaths.available)) {
            fs.symlinkSync(nginxPaths.available, nginxPaths.enabled);
          }
        } else {
          if (fs.existsSync(nginxPaths.enabled)) {
            fs.unlinkSync(nginxPaths.enabled);
          }
        }
        await this.reloadNginx();
      } catch (e) {
        console.error('Error toggling nginx site:', e);
      }
    }

    this.saveDomains(domains);
    return domain;
  }

  async deleteDomain(id, deleteFiles = false) {
    const domains = this.getDomains();
    const domain = domains.find((d) => d.id === id);
    if (!domain) throw new Error('Domain tidak ditemukan');

    const nginxPaths = this.getNginxPaths(domain.domain);

    if (nginxPaths.isRealNginx) {
      try {
        if (fs.existsSync(nginxPaths.enabled)) fs.unlinkSync(nginxPaths.enabled);
        if (fs.existsSync(nginxPaths.available)) fs.unlinkSync(nginxPaths.available);
        await this.reloadNginx();
      } catch (e) {
        console.error('Error removing nginx site:', e);
      }
    } else {
      if (fs.existsSync(nginxPaths.available)) fs.unlinkSync(nginxPaths.available);
    }

    if (deleteFiles && domain.documentRoot && fs.existsSync(domain.documentRoot)) {
      try {
        fs.rmSync(domain.documentRoot, { recursive: true, force: true });
      } catch (e) {
        console.error('Error removing document root:', e);
      }
    }

    const updated = domains.filter((d) => d.id !== id);
    this.saveDomains(updated);
    return { success: true };
  }

  async issueSsl(id, email = '') {
    const domains = this.getDomains();
    const domain = domains.find((d) => d.id === id);
    if (!domain) throw new Error('Domain tidak ditemukan');

    if (!IS_LINUX) {
      // Mock for development
      domain.ssl = true;
      domain.sslIssuedAt = new Date().toISOString();
      domain.sslEmail = email || domain.sslEmail;
      this.saveDomains(domains);
      return { success: true, message: 'SSL diaktifkan (Mode Simulasi)' };
    }

    const targetEmail = email || domain.sslEmail || 'admin@' + domain.domain;

    try {
      // Run certbot with nginx plugin
      const cmd = `certbot --nginx -d ${domain.domain} --non-interactive --agree-tos --email ${targetEmail} --redirect`;
      const { stdout, stderr } = await execAsync(cmd);

      domain.ssl = true;
      domain.sslIssuedAt = new Date().toISOString();
      domain.sslEmail = targetEmail;
      this.saveDomains(domains);

      return { success: true, stdout, message: 'Sertifikat SSL Let\'s Encrypt berhasil dipasang!' };
    } catch (err) {
      console.error('Certbot error:', err);
      throw new Error(`Gagal memasang SSL via Certbot: ${err.message}. Pastikan DNS record domain sudah mengarah ke IP VPS ini.`);
    }
  }
}

module.exports = new DomainService();
