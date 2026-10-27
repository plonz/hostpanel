const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const processManager = require('../services/processManager');

// GET /api/apps - List all apps
router.get('/', authMiddleware, (req, res) => {
  try {
    const apps = processManager.getApps();
    res.json({ apps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/apps/:id - Get single app
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const app = processManager.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'App not found' });
    res.json({ app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/apps - Add new app
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, type, cwd, command, port, env, autoRestart } = req.body;
    if (!name || !command) {
      return res.status(400).json({ error: 'Name and command are required' });
    }
    const app = processManager.addApp({ name, type, cwd, command, port, env, autoRestart });
    res.status(201).json({ message: 'App added successfully', app });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/apps/:id - Update app
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const updated = processManager.updateApp(req.params.id, req.body);
    res.json({ message: 'App updated successfully', app: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/apps/:id - Delete app
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const result = processManager.deleteApp(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/apps/:id/start - Start app
router.post('/:id/start', authMiddleware, (req, res) => {
  try {
    const result = processManager.startApp(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/apps/:id/stop - Stop app
router.post('/:id/stop', authMiddleware, (req, res) => {
  try {
    const result = processManager.stopApp(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/apps/:id/restart - Restart app
router.post('/:id/restart', authMiddleware, async (req, res) => {
  try {
    const result = await processManager.restartApp(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/apps/:id/logs - Get log history
router.get('/:id/logs', authMiddleware, (req, res) => {
  try {
    const logs = processManager.getLogs(req.params.id);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/apps/:id/logs - Clear logs
router.delete('/:id/logs', authMiddleware, (req, res) => {
  try {
    const result = processManager.clearLogs(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/apps/:id/nginx - Generate Nginx snippet for this app
router.get('/:id/nginx', authMiddleware, (req, res) => {
  try {
    const app = processManager.getApp(req.params.id);
    if (!app) return res.status(404).json({ error: 'App not found' });
    const domain = req.query.domain || 'yourdomain.com';
    const appPort = app.port || 3000;

    const nginxConfig = `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${appPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`;

    res.json({ domain, port: appPort, config: nginxConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
