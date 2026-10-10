/**
 * RexaCloud Customer Overview Dashboard
 * Screen 1 in reference image:
 * Welcome banner, metric counter cards, Your Servers grid, and Recent Activity.
 * Genuine data from Pterodactyl and database. No mock numbers.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { PterodactylServer, ActivityLog } from '@/shared/types';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  Server,
  PlayCircle,
  PauseCircle,
  HardDrive,
  Users,
  Plus,
  Terminal,
  Loader2,
  AlertCircle,
  Settings,
  ShieldAlert,
} from 'lucide-react';

export const OverviewDashboard: React.FC = () => {
  const { user, role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      loadDashboard();
    }
  }, [authLoading]);

  const loadDashboard = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getDashboardSummary();
      setConfigured(data.configured);
      setServers(data.servers || []);
      setSummary(data.summary);
      setRecentActivity(data.recentActivity || []);
    } catch (err: any) {
      console.error('Failed to load customer dashboard:', err);
      setErrorMsg(err.message || 'Unable to connect to dashboard API');
    } finally {
      setIsLoading(false);
    }
  };

  const username = user?.username || 'User';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-sm font-medium">Loading your server fleet...</p>
      </div>
    );
  }

  const runningCount = summary?.runningServers ?? servers.filter((s) => s.utilization.state === 'running').length;
  const stoppedCount = summary?.stoppedServers ?? servers.filter((s) => s.utilization.state === 'offline').length;
  const totalCount = summary?.totalServers ?? servers.length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Welcome back, {username}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time status of your game servers and infrastructure.
          </p>
        </div>

        {role === 'admin' && (
          <button
            onClick={() => navigate('/admin/create-server')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Server</span>
          </button>
        )}
      </div>

      {/* Disconnected Notice if Pterodactyl is not linked */}
      {!configured && (
        <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-800/40 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Pterodactyl Panel Not Connected</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                RexaCloud connects to an existing Pterodactyl installation via its official Client and Application APIs.
                Pterodactyl remains responsible for actual game server containers and Wings operations.
              </p>
            </div>
          </div>

          {role === 'admin' ? (
            <div className="pt-2">
              <Link
                to="/admin/settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40 transition-all"
              >
                <Settings className="w-4 h-4" />
                <span>Configure Pterodactyl API Keys in Settings</span>
              </Link>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Please contact your system administrator to configure the Pterodactyl Panel connection.
            </p>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-xs text-rose-300 flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Total Servers</p>
            <p className="text-xl font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
              {totalCount}
            </p>
          </div>
        </div>

        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Running</p>
            <p className="text-xl font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
              {runningCount}
            </p>
          </div>
        </div>

        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <PauseCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Stopped</p>
            <p className="text-xl font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
              {stoppedCount}
            </p>
          </div>
        </div>

        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-600/15 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Registered Users</p>
            <p className="text-xl font-extrabold text-white tracking-tight mt-0.5 tabular-nums">
              {summary?.totalUsers ?? 1}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Your Servers Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight">Your Servers</h2>
          <span className="text-xs text-slate-400">{servers.length} assigned servers</span>
        </div>

        {servers.length === 0 ? (
          <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/30 flex items-center justify-center mx-auto text-purple-400">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No Game Servers Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {configured
                ? 'There are currently no game servers assigned to your account. Deploy a new server or contact your administrator.'
                : 'Connect your Pterodactyl Panel in Admin Settings to retrieve active game servers.'}
            </p>
            {role === 'admin' && (
              <div className="pt-2">
                <Link
                  to="/admin/create-server"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Server</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {servers.map((server) => {
              const isOnline = server.utilization.state === 'running';
              const ramGB = (server.utilization.memoryBytes / (1024 * 1024 * 1024)).toFixed(1);
              const ramLimitGB = server.limits.memory ? (server.limits.memory / 1024).toFixed(0) : '0';
              const ramPercent = server.limits.memory
                ? Math.min(100, Math.round((server.utilization.memoryBytes / (server.limits.memory * 1024 * 1024)) * 100))
                : 0;

              return (
                <div
                  key={server.identifier}
                  className="bg-[#100D1A] border border-purple-900/25 hover:border-purple-600/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all hover:shadow-lg hover:shadow-purple-950/40 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                            {server.name}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {server.identifier}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={server.utilization.state} size="sm" />
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 bg-purple-950/20 px-2.5 py-1 rounded-lg border border-purple-900/20 flex items-center justify-between">
                      <span>{server.ip}:{server.port}</span>
                      <span className="text-[10px] text-purple-400">{server.node}</span>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>CPU Usage</span>
                        <span className="text-white font-mono font-medium">
                          {server.utilization.cpuAbsolute}%
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>RAM</span>
                          <span className="text-white font-mono font-medium">
                            {ramGB} GB / {ramLimitGB} GB
                          </span>
                        </div>
                        <div className="w-full bg-[#181228] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${isOnline ? ramPercent : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-purple-900/20">
                    <button
                      onClick={() => navigate(`/server/${server.identifier}/console`)}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 transition-all cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Manage & Console</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Recent Activity Log */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white tracking-tight">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 text-center text-xs text-slate-400">
            No recent activity recorded yet.
          </div>
        ) : (
          <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl divide-y divide-purple-900/20 overflow-hidden shadow-sm">
            {recentActivity.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">{log.action}</p>
                  <p className="text-slate-400">{log.details}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-purple-300 font-mono text-[11px]">{log.resource}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
