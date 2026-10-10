/**
 * RexaCloud Server Management and Live Console
 * Screen 2 in reference image:
 * Breadcrumbs, power action buttons (Start, Restart, Stop, Kill), server tabs,
 * live terminal stream via official Pterodactyl Wings WebSocket / Client API,
 * command prompt, and live telemetry cards.
 * No hardcoded fake logs.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { PterodactylServer, ServerUtilization } from '@/shared/types';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  Play,
  RotateCw,
  Square,
  Zap,
  Terminal as TerminalIcon,
  Send,
  Trash2,
  Pause,
  Loader2,
  ChevronRight,
  HardDrive,
  Database,
  FolderTree,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';

export const ServerConsolePage: React.FC = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();

  const [server, setServer] = useState<PterodactylServer | null>(null);
  const [resources, setResources] = useState<ServerUtilization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [powerPending, setPowerPending] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [isSendingCmd, setIsSendingCmd] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Real terminal logs stream
  const [logs, setLogs] = useState<string[]>([]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!identifier) return;

    loadServerData();
    connectWebsocket();

    const interval = setInterval(loadResources, 6000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [identifier]);

  useEffect(() => {
    if (autoScroll && !isPaused && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isPaused]);

  const loadServerData = async () => {
    if (!identifier) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.getServer(identifier);
      setServer(data.server);
      setResources(data.server.utilization);
    } catch (err: any) {
      console.error('Failed to load server:', err);
      setErrorMessage(err.message || 'Failed to load server details from Pterodactyl');
    } finally {
      setIsLoading(false);
    }
  };

  const loadResources = async () => {
    if (!identifier) return;
    try {
      const res = await api.getServerResources(identifier);
      setResources(res.resources);
      if (server) {
        setServer((prev) => (prev ? { ...prev, utilization: res.resources } : null));
      }
    } catch {
      // transient poll
    }
  };

  const connectWebsocket = async () => {
    if (!identifier) return;
    try {
      const { token, socket } = await api.getWebsocketCredentials(identifier);
      if (!socket || !token) return;

      const ws = new WebSocket(socket);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        // Authenticate with Pterodactyl Wings daemon
        ws.send(JSON.stringify({ event: 'auth', args: [token] }));
        setLogs((prev) => [...prev, `[RexaCloud]: Connected to server daemon console stream.`]);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'console output') {
            const line = Array.isArray(msg.args) ? msg.args.join(' ') : String(msg.args || '');
            setLogs((prev) => [...prev.slice(-500), line]);
          } else if (msg.event === 'status') {
            const state = msg.args?.[0];
            if (state) {
              setResources((prev) => (prev ? { ...prev, state } : null));
            }
          } else if (msg.event === 'stats') {
            try {
              const stats = JSON.parse(msg.args?.[0]);
              setResources((prev) =>
                prev
                  ? {
                      ...prev,
                      cpuAbsolute: Math.round(stats.cpu_absolute || 0),
                      memoryBytes: stats.memory_bytes || 0,
                      diskBytes: stats.disk_bytes || 0,
                      uptime: stats.uptime || 0,
                    }
                  : null
              );
            } catch {}
          } else if (msg.event === 'token expiring') {
            api.getWebsocketCredentials(identifier).then(({ token: newToken }) => {
              ws.send(JSON.stringify({ event: 'auth', args: [newToken] }));
            });
          }
        } catch {
          setLogs((prev) => [...prev.slice(-500), event.data]);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onclose = () => {
        setWsConnected(false);
      };
    } catch (err: any) {
      // If websocket credentials fail (e.g. wings unreachable), notify cleanly in console
      setLogs((prev) => [
        ...prev,
        `[Notice]: Live WebSocket stream not available (${err.message || 'offline'}). Standard API command execution active.`,
      ]);
    }
  };

  const handlePowerAction = async (signal: 'start' | 'stop' | 'restart' | 'kill') => {
    if (!identifier) return;
    setPowerPending(signal);
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'set state', args: [signal] }));
      }
      await api.sendPowerAction(identifier, signal);
      setLogs((prev) => [...prev, `[System]: Dispatched power signal "${signal.toUpperCase()}"`]);
      await loadResources();
    } catch (err: any) {
      setLogs((prev) => [...prev, `[Error]: Failed to send power action: ${err.message}`]);
    } finally {
      setPowerPending(null);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !identifier) return;

    const cmd = commandInput.trim();
    setCommandInput('');
    setIsSendingCmd(true);

    setLogs((prev) => [...prev, `> ${cmd}`]);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'send command', args: [cmd] }));
      } else {
        await api.sendCommand(identifier, cmd);
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, `[Error]: Failed to dispatch command: ${err.message}`]);
    } finally {
      setIsSendingCmd(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-sm font-medium">Connecting to server instance...</p>
      </div>
    );
  }

  if (errorMessage || !server) {
    return (
      <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white">Server Connection Error</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {errorMessage || `Server with identifier "${identifier}" could not be found in Pterodactyl.`}
        </p>
        <button
          onClick={() => navigate('/servers')}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer"
        >
          Back to Server List
        </button>
      </div>
    );
  }

  const util = resources || server.utilization;
  const isOnline = util.state === 'running';

  const ramUsedGB = (util.memoryBytes / (1024 * 1024 * 1024)).toFixed(2);
  const ramLimitGB = server.limits.memory ? (server.limits.memory / 1024).toFixed(1) : 'Unlimited';
  const diskUsedGB = (util.diskBytes / (1024 * 1024 * 1024)).toFixed(2);
  const diskLimitGB = server.limits.disk ? (server.limits.disk / 1024).toFixed(0) : 'Unlimited';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header & Navigation Breadcrumbs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link to="/servers" className="hover:text-purple-400 transition-colors">
              Servers
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-200 font-medium">{server.name}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-purple-400">Console</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{server.name}</h1>
            <StatusBadge status={util.state} size="md" />
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-purple-950/40 border border-purple-800/30 text-purple-300">
              {wsConnected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-slate-400" />}
              <span>{wsConnected ? 'Daemon Stream' : 'REST Mode'}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            {server.ip}:{server.port} · Node: {server.node}
          </p>
        </div>

        {/* Power Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePowerAction('start')}
            disabled={isOnline || !!powerPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-all cursor-pointer"
          >
            {powerPending === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>Start</span>
          </button>

          <button
            onClick={() => handlePowerAction('restart')}
            disabled={!isOnline || !!powerPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#2A1E4A] hover:bg-purple-700 text-purple-200 hover:text-white border border-purple-700/40 disabled:opacity-40 transition-all cursor-pointer"
          >
            {powerPending === 'restart' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            <span>Restart</span>
          </button>

          <button
            onClick={() => handlePowerAction('stop')}
            disabled={!isOnline || !!powerPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 disabled:opacity-40 transition-all cursor-pointer"
          >
            {powerPending === 'stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
            <span>Stop</span>
          </button>

          <button
            onClick={() => handlePowerAction('kill')}
            disabled={!isOnline || !!powerPending}
            className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/40 disabled:opacity-40 transition-all cursor-pointer"
            title="Force Kill Process"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Server Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-purple-900/25 pb-2 overflow-x-auto">
        <Link
          to={`/server/${server.identifier}/console`}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white shadow-md shadow-purple-900/30 shrink-0"
        >
          <TerminalIcon className="w-3.5 h-3.5" />
          <span>Console</span>
        </Link>

        <Link
          to={`/server/${server.identifier}/files`}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-purple-950/30 transition-colors shrink-0"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Files</span>
        </Link>

        <Link
          to={`/server/${server.identifier}/databases`}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-purple-950/30 transition-colors shrink-0"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Databases</span>
        </Link>

        <Link
          to={`/server/${server.identifier}/backups`}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-purple-950/30 transition-colors shrink-0"
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Backups</span>
        </Link>
      </div>

      {/* 3. Live Console Terminal Shell */}
      <div className="bg-[#0A0711] border border-purple-900/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[460px]">
        {/* Terminal Header */}
        <div className="h-10 bg-[#100D1A] border-b border-purple-900/20 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[11px] font-mono text-slate-400 ml-2">container/{server.identifier}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                isPaused ? 'text-amber-400 bg-amber-500/20' : 'text-slate-400 hover:text-white'
              }`}
              title={isPaused ? 'Resume Scroll' : 'Pause Scroll'}
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLogs([])}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Clear Terminal Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Log Output Window */}
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 selection:bg-purple-600 selection:text-white">
          {logs.length === 0 ? (
            <div className="text-slate-500 italic py-4">
              Terminal stream ready. Output will appear here as container processes execute.
            </div>
          ) : (
            logs.map((line, idx) => (
              <div key={idx} className="break-all whitespace-pre-wrap leading-relaxed text-slate-300">
                {line}
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Command Dispatch Form */}
        <form
          onSubmit={handleSendCommand}
          className="h-12 bg-[#100D1A] border-t border-purple-900/25 px-3 flex items-center gap-2"
        >
          <span className="text-purple-400 font-mono text-sm pl-1 font-bold">&gt;</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type a server command and press Enter..."
            disabled={isSendingCmd}
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={!commandInput.trim() || isSendingCmd}
            className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white transition-colors cursor-pointer"
          >
            {isSendingCmd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
      </div>

      {/* 4. Live Resource Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[11px] font-medium text-slate-400">CPU Usage</p>
          <p className="text-xl font-extrabold text-white font-mono">{util.cpuAbsolute}%</p>
          <p className="text-[10px] text-slate-500">Allocation: {server.limits.cpu}%</p>
        </div>

        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[11px] font-medium text-slate-400">Memory (RAM)</p>
          <p className="text-xl font-extrabold text-white font-mono">{ramUsedGB} GB</p>
          <p className="text-[10px] text-slate-500">Limit: {ramLimitGB} GB</p>
        </div>

        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[11px] font-medium text-slate-400">Disk Storage</p>
          <p className="text-xl font-extrabold text-white font-mono">{diskUsedGB} GB</p>
          <p className="text-[10px] text-slate-500">Limit: {diskLimitGB} GB</p>
        </div>

        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 space-y-1 shadow-sm">
          <p className="text-[11px] font-medium text-slate-400">Uptime</p>
          <p className="text-xl font-extrabold text-white font-mono">
            {util.uptime ? `${Math.floor(util.uptime / 3600000)}h ${Math.floor((util.uptime % 3600000) / 60000)}m` : 'Offline'}
          </p>
          <p className="text-[10px] text-slate-500">Container status: {util.state}</p>
        </div>
      </div>
    </div>
  );
};
