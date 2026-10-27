import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { 
  Terminal as TerminalIcon, 
  RotateCcw, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import { getToken } from '../api';

export default function TerminalView() {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonInstance = useRef(null);
  const wsInstance = useRef(null);
  const containerRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const connectTerminal = () => {
    if (wsInstance.current) {
      try {
        wsInstance.current.close();
      } catch (e) {}
    }

    setConnecting(true);
    setConnected(false);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const token = getToken();
    const wsUrl = `${protocol}//${host}/ws/terminal?token=${encodeURIComponent(token || '')}`;

    const ws = new WebSocket(wsUrl);
    wsInstance.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      if (xtermInstance.current && fitAddonInstance.current) {
        fitAddonInstance.current.fit();
        const { cols, rows } = xtermInstance.current;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };

    ws.onmessage = (event) => {
      if (xtermInstance.current) {
        xtermInstance.current.write(event.data);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      if (xtermInstance.current) {
        xtermInstance.current.write('\r\n\x1b[31m[Connection to terminal closed]\x1b[0m\r\n');
      }
    };

    ws.onerror = (err) => {
      console.error('Terminal WebSocket error:', err);
      setConnected(false);
      setConnecting(false);
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
        background: '#090d16',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#1e293b',
        red: '#f43f5e',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#64748b',
        brightRed: '#fb7185',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#e879f9',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // On user keyboard input, send to WebSocket
    term.onData((data) => {
      if (wsInstance.current && wsInstance.current.readyState === WebSocket.OPEN) {
        wsInstance.current.send(data);
      }
    });

    connectTerminal();

    const handleResize = () => {
      if (fitAddonInstance.current && xtermInstance.current) {
        fitAddonInstance.current.fit();
        const { cols, rows } = xtermInstance.current;
        if (wsInstance.current && wsInstance.current.readyState === WebSocket.OPEN) {
          wsInstance.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsInstance.current) {
        wsInstance.current.close();
      }
      term.dispose();
    };
  }, []);

  const handleClear = () => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
    }
  };

  const handleSendCommand = (cmd) => {
    if (wsInstance.current && wsInstance.current.readyState === WebSocket.OPEN) {
      wsInstance.current.send(cmd + '\r');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (fitAddonInstance.current) {
        fitAddonInstance.current.fit();
        if (xtermInstance.current && wsInstance.current && wsInstance.current.readyState === WebSocket.OPEN) {
          const { cols, rows } = xtermInstance.current;
          wsInstance.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }
    }, 150);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl transition-all ${isFullscreen ? 'fixed inset-4 z-50 rounded-xl' : 'h-[75vh]'}`}
    >
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold pl-2">
            <TerminalIcon className="w-4 h-4 text-cyan-400" />
            <span>VPS Interactive Terminal</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {connected ? (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px]">
                <Wifi className="w-3 h-3" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded text-[11px]">
                <WifiOff className="w-3 h-3" /> {connecting ? 'Connecting...' : 'Disconnected'}
              </span>
            )}
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2">
          {/* Quick shortcuts */}
          <div className="hidden md:flex items-center gap-1 text-[11px] pr-2 border-r border-slate-700">
            <button
              onClick={() => handleSendCommand('node -v')}
              className="px-2 py-0.5 rounded bg-slate-700/70 hover:bg-slate-700 text-slate-300 font-mono transition"
            >
              node -v
            </button>
            <button
              onClick={() => handleSendCommand('python3 --version || python --version')}
              className="px-2 py-0.5 rounded bg-slate-700/70 hover:bg-slate-700 text-slate-300 font-mono transition"
            >
              python --version
            </button>
            <button
              onClick={() => handleSendCommand('npm -v')}
              className="px-2 py-0.5 rounded bg-slate-700/70 hover:bg-slate-700 text-slate-300 font-mono transition"
            >
              npm -v
            </button>
          </div>

          <button
            onClick={connectTerminal}
            disabled={connecting}
            className="flex items-center gap-1 p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition"
            title="Reconnect Terminal"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition"
            title="Clear Terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Screen */}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full h-full p-2 bg-[#090d16] overflow-hidden" 
      />
    </div>
  );
}
