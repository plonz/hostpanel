const os = require('os');
const path = require('path');
const { verifyWsToken } = require('../middleware/auth');
const { config } = require('../config');

let nodePty = null;
try {
  nodePty = require('node-pty');
} catch (e) {
  console.warn('node-pty could not be loaded, fallback mode will be used:', e.message);
}

function getDefaultShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function setupTerminalWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    // Parse URL for token and cwd
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const userCwd = url.searchParams.get('cwd');

    // Authenticate
    const user = verifyWsToken(token);
    if (!user) {
      ws.send('\r\n\x1b[31mAuthentication failed. Disconnecting...\x1b[0m\r\n');
      ws.close(4001, 'Unauthorized');
      return;
    }

    let startCwd = process.cwd();
    if (userCwd) {
      try {
        startCwd = path.resolve(userCwd);
      } catch (e) {}
    } else if (config.rootPath) {
      startCwd = config.rootPath;
    }

    const shell = getDefaultShell();
    let ptyProcess = null;

    if (nodePty) {
      try {
        ptyProcess = nodePty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: startCwd,
          env: {
            ...process.env,
            COLORTERM: 'truecolor',
            TERM: 'xterm-256color'
          }
        });

        ptyProcess.onData((data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(data);
          }
        });

        ptyProcess.onExit(({ exitCode, signal }) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
            ws.close();
          }
        });
      } catch (err) {
        console.error('Failed to spawn pty process:', err);
        ws.send(`\r\n\x1b[31mFailed to start terminal: ${err.message}\x1b[0m\r\n`);
        ws.close();
        return;
      }
    } else {
      // Fallback using child_process spawn
      const { spawn } = require('child_process');
      const cp = spawn(shell, [], {
        cwd: startCwd,
        env: process.env,
        shell: true
      });

      cp.stdout.on('data', (d) => ws.readyState === ws.OPEN && ws.send(d.toString()));
      cp.stderr.on('data', (d) => ws.readyState === ws.OPEN && ws.send(d.toString()));
      cp.on('close', (code) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(`\r\n[Exited ${code}]\r\n`);
          ws.close();
        }
      });

      ptyProcess = {
        write: (d) => cp.stdin.write(d),
        resize: () => {},
        kill: () => cp.kill()
      };
    }

    // Message handler from frontend xterm
    ws.on('message', (message) => {
      try {
        // Check if message is a JSON control packet (e.g. resize)
        const str = message.toString();
        if (str.startsWith('{') && str.endsWith('}')) {
          try {
            const parsed = JSON.parse(str);
            if (parsed.type === 'resize' && typeof parsed.cols === 'number' && typeof parsed.rows === 'number') {
              if (ptyProcess && ptyProcess.resize) {
                ptyProcess.resize(Math.max(10, parsed.cols), Math.max(5, parsed.rows));
              }
              return;
            }
          } catch (e) {
            // Not a control packet, treat as raw input
          }
        }

        // Send raw characters to pty
        if (ptyProcess) {
          ptyProcess.write(message.toString());
        }
      } catch (err) {
        console.error('Terminal write error:', err);
      }
    });

    ws.on('close', () => {
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch (e) {}
      }
    });

    ws.on('error', (err) => {
      console.error('Terminal WS error:', err);
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch (e) {}
      }
    });
  });
}

module.exports = {
  setupTerminalWebSocket
};
