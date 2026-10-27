const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { WebSocketServer } = require('ws');

const { config } = require('./src/config');
const authRoutes = require('./src/routes/auth');
const systemRoutes = require('./src/routes/system');
const filesRoutes = require('./src/routes/files');
const appsRoutes = require('./src/routes/apps');
const domainsRoutes = require('./src/routes/domains');
const databaseRoutes = require('./src/routes/database');
const { setupTerminalWebSocket } = require('./src/services/terminal');
const { subscribeLogs, initAutoStartApps } = require('./src/services/processManager');
const { verifyWsToken } = require('./src/middleware/auth');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/domains', domainsRoutes);
app.use('/api/database', databaseRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Setup WebSockets
const wssTerminal = new WebSocketServer({ noServer: true });
const wssLogs = new WebSocketServer({ noServer: true });

setupTerminalWebSocket(wssTerminal);

// Setup Live Log WebSocket
wssLogs.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  const appId = url.searchParams.get('appId');

  const user = verifyWsToken(token);
  if (!user) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  if (appId) {
    subscribeLogs(appId, ws);
  }
});

// Upgrade handler for multiple WS paths
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, 'http://localhost');

  if (pathname === '/ws/terminal') {
    wssTerminal.handleUpgrade(request, socket, head, (ws) => {
      wssTerminal.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/logs') {
    wssLogs.handleUpgrade(request, socket, head, (ws) => {
      wssLogs.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Serve Frontend Static Files (from dist/)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA (React Router / Tabs)
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>VPS Hosting Panel</title>
        <style>
          body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 8px; max-width: 500px; text-align: center; }
          a { color: #38bdf8; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🚀 VPS Hosting Panel Backend Running</h2>
          <p>Frontend is currently building or not yet compiled.</p>
          <p>Run <code>npm run build</code> to compile the frontend interface.</p>
          <p><a href="/api/health">Check API Health</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = config.port || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  🚀 VPS Hosting Panel is running on port ${PORT}`);
  console.log(`  📍 Local: http://localhost:${PORT}`);
  console.log(`  🔑 Default Username: ${config.username}`);
  console.log(`=======================================================`);

  // Initialize auto-starting apps
  initAutoStartApps();
});
