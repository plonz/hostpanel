const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { APPS_FILE } = require('../config');

// In-memory runtime instances
// id -> { childProcess, logs: [], subscribers: Set<ws>, restartCount, lastRestart }
const activeInstances = new Map();

function loadApps() {
  if (fs.existsSync(APPS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
    } catch (err) {
      console.error('Error reading apps.json:', err);
    }
  }
  return [];
}

function saveApps(apps) {
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2), 'utf8');
}

function getApps() {
  const apps = loadApps();
  return apps.map(app => {
    const instance = activeInstances.get(app.id);
    const isRunning = !!(instance && instance.childProcess && !instance.childProcess.killed);
    return {
      ...app,
      status: isRunning ? 'running' : (app.status === 'running' ? 'stopped' : (app.status || 'stopped')),
      pid: isRunning ? instance.childProcess.pid : null,
      startedAt: isRunning ? instance.startedAt : null
    };
  });
}

function getApp(id) {
  const apps = loadApps();
  const app = apps.find(a => a.id === id);
  if (!app) return null;
  const instance = activeInstances.get(id);
  const isRunning = !!(instance && instance.childProcess && !instance.childProcess.killed);
  return {
    ...app,
    status: isRunning ? 'running' : (app.status === 'running' ? 'stopped' : (app.status || 'stopped')),
    pid: isRunning ? instance.childProcess.pid : null,
    startedAt: isRunning ? instance.startedAt : null
  };
}

function addApp(appData) {
  const apps = loadApps();
  const id = 'app_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const newApp = {
    id,
    name: appData.name || 'My App',
    type: appData.type || 'node', // node | python | custom
    cwd: appData.cwd ? path.resolve(appData.cwd) : process.cwd(),
    command: appData.command || (appData.type === 'python' ? 'python3 main.py' : 'node index.js'),
    port: appData.port ? parseInt(appData.port, 10) : null,
    env: appData.env || {},
    autoRestart: appData.autoRestart !== false,
    status: 'stopped',
    createdAt: new Date().toISOString()
  };

  apps.push(newApp);
  saveApps(apps);
  return newApp;
}

function updateApp(id, updateData) {
  const apps = loadApps();
  const index = apps.findIndex(a => a.id === id);
  if (index === -1) throw new Error('App not found');

  const current = apps[index];
  const updated = {
    ...current,
    ...updateData,
    id: current.id, // prevent ID change
    cwd: updateData.cwd ? path.resolve(updateData.cwd) : current.cwd,
    updatedAt: new Date().toISOString()
  };

  apps[index] = updated;
  saveApps(apps);
  return updated;
}

function deleteApp(id) {
  stopApp(id);
  const apps = loadApps().filter(a => a.id !== id);
  saveApps(apps);
  activeInstances.delete(id);
  return { success: true };
}

function appendLog(id, text) {
  let instance = activeInstances.get(id);
  if (!instance) {
    instance = { logs: [], subscribers: new Set() };
    activeInstances.set(id, instance);
  }

  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().length > 0 || lines.length === 1) {
      const entry = {
        time: new Date().toISOString(),
        text: line
      };
      instance.logs.push(entry);
      if (instance.logs.length > 1000) {
        instance.logs.shift(); // retain last 1000 lines
      }

      // Broadcast to live log subscribers
      for (const ws of instance.subscribers) {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'log', appId: id, entry }));
        }
      }
    }
  }
}

function startApp(id) {
  const app = getApp(id);
  if (!app) throw new Error('App not found');

  // If already running
  if (activeInstances.has(id) && activeInstances.get(id).childProcess && !activeInstances.get(id).childProcess.killed) {
    return { message: 'App is already running', app: getApp(id) };
  }

  const customEnv = { ...process.env, ...app.env };
  if (app.port) {
    customEnv.PORT = String(app.port);
  }

  let instance = activeInstances.get(id);
  if (!instance) {
    instance = { logs: [], subscribers: new Set() };
    activeInstances.set(id, instance);
  }

  appendLog(id, `\x1b[36m[SYSTEM] Starting application "${app.name}"...\x1b[0m`);
  appendLog(id, `\x1b[36m[SYSTEM] Command: ${app.command}\x1b[0m`);
  appendLog(id, `\x1b[36m[SYSTEM] Directory: ${app.cwd}\x1b[0m`);

  const isWin = process.platform === 'win32';
  const child = spawn(app.command, [], {
    cwd: app.cwd,
    env: customEnv,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  instance.childProcess = child;
  instance.startedAt = Date.now();
  instance.intentStop = false;

  child.stdout.on('data', (data) => {
    appendLog(id, data.toString());
  });

  child.stderr.on('data', (data) => {
    appendLog(id, data.toString());
  });

  child.on('close', (code, signal) => {
    appendLog(id, `\x1b[33m[SYSTEM] Process exited with code ${code} (Signal: ${signal || 'none'})\x1b[0m`);
    
    // Auto restart if configured and not stopped intentionally
    if (app.autoRestart && !instance.intentStop) {
      const now = Date.now();
      instance.restartCount = (instance.restartCount || 0) + 1;
      
      // Prevent rapid crash loop (if crashed in < 2 seconds more than 5 times)
      if (instance.restartCount > 5 && (now - (instance.lastRestart || 0) < 10000)) {
        appendLog(id, `\x1b[31m[SYSTEM] Crash loop detected. Auto-restart paused. Please check error logs.\x1b[0m`);
        updateApp(id, { status: 'errored' });
        return;
      }

      instance.lastRestart = now;
      appendLog(id, `\x1b[35m[SYSTEM] Auto-restarting in 2 seconds... (attempt ${instance.restartCount})\x1b[0m`);
      setTimeout(() => {
        try {
          startApp(id);
        } catch (e) {
          console.error('Failed to auto-restart app:', e);
        }
      }, 2000);
    } else {
      updateApp(id, { status: 'stopped' });
    }
  });

  child.on('error', (err) => {
    appendLog(id, `\x1b[31m[SYSTEM] Process failed to spawn: ${err.message}\x1b[0m`);
  });

  updateApp(id, { status: 'running' });
  return { message: 'App started successfully', app: getApp(id) };
}

function stopApp(id) {
  const instance = activeInstances.get(id);
  if (!instance || !instance.childProcess || instance.childProcess.killed) {
    updateApp(id, { status: 'stopped' });
    return { message: 'App is already stopped', app: getApp(id) };
  }

  instance.intentStop = true;
  instance.restartCount = 0;
  appendLog(id, `\x1b[33m[SYSTEM] Stopping application...\x1b[0m`);

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', instance.childProcess.pid, '/f', '/t']);
    } else {
      instance.childProcess.kill('SIGTERM');
      setTimeout(() => {
        if (!instance.childProcess.killed) {
          instance.childProcess.kill('SIGKILL');
        }
      }, 3000);
    }
  } catch (err) {
    console.error('Error stopping child process:', err);
  }

  updateApp(id, { status: 'stopped' });
  return { message: 'App stopped', app: getApp(id) };
}

function restartApp(id) {
  stopApp(id);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(startApp(id));
    }, 1000);
  });
}

function getLogs(id) {
  const instance = activeInstances.get(id);
  return instance ? instance.logs : [];
}

function clearLogs(id) {
  const instance = activeInstances.get(id);
  if (instance) {
    instance.logs = [];
  }
  return { message: 'Logs cleared' };
}

function subscribeLogs(id, ws) {
  let instance = activeInstances.get(id);
  if (!instance) {
    instance = { logs: [], subscribers: new Set() };
    activeInstances.set(id, instance);
  }
  instance.subscribers.add(ws);

  // Send initial history
  ws.send(JSON.stringify({ type: 'history', appId: id, logs: instance.logs }));

  ws.on('close', () => {
    instance.subscribers.delete(ws);
  });
}

// Auto start running apps on panel startup
function initAutoStartApps() {
  const apps = loadApps();
  for (const app of apps) {
    if (app.status === 'running' || app.autoRestart) {
      console.log(`[ProcessManager] Auto-starting "${app.name}"...`);
      try {
        startApp(app.id);
      } catch (err) {
        console.error(`Failed to auto-start ${app.name}:`, err.message);
      }
    }
  }
}

module.exports = {
  getApps,
  getApp,
  addApp,
  updateApp,
  deleteApp,
  startApp,
  stopApp,
  restartApp,
  getLogs,
  clearLogs,
  subscribeLogs,
  initAutoStartApps
};
