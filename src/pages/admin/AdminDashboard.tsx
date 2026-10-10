/**
 * RexaCloud Administrator Dashboard
 * Fleet monitoring, node health, and user governance from live Pterodactyl panel and database.
 * No mock statistics.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  Users,
  Server,
  Cpu,
  Clock,
  Loader2,
  AlertCircle,
  Settings,
  Plus,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAdminOverview();
      setData(res);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-sm font-medium">Loading infrastructure fleet overview...</p>
      </div>
    );
  }

  const { stats, recentServers, recentActivity, configured } = data;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete fleet monitoring, node health, and user governance
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/admin/create-server"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Server</span>
          </Link>
          <Link
            to="/admin/settings"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#181028] hover:bg-[#221838] text-purple-300 border border-purple-900/30 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* Disconnected Notice if Pterodactyl is not linked */}
      {!configured && (
        <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-800/40 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Pterodactyl Panel Integration Required</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                To retrieve live server nodes, locations, and container statistics from your existing Pterodactyl Panel,
                configure your Pterodactyl Panel URL, Client API Key, and Application API Key in Settings.
              </p>
            </div>
          </div>
          <div className="pt-2">
            <Link
              to="/admin/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span>Configure Pterodactyl API Keys</span>
            </Link>
          </div>
        </div>
      )}

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5">
        {/* Users */}
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 flex flex-col justify-between">
          <p className="text-[11px] font-medium text-slate-400">Registered Users</p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {stats.users.total}
          </p>
          <p className="text-[10px] text-purple-400 font-medium mt-2">
            Database persistent accounts
          </p>
        </div>

        {/* Servers */}
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 flex flex-col justify-between">
          <p className="text-[11px] font-medium text-slate-400">Pterodactyl Servers</p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {stats.servers.total}
          </p>
          <p className="text-[10px] text-emerald-400 font-medium mt-2">
            {stats.servers.diff}
          </p>
        </div>

        {/* Nodes */}
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 flex flex-col justify-between">
          <p className="text-[11px] font-medium text-slate-400">Wings Nodes</p>
          <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
            {stats.nodes.total}
          </p>
          <p className="text-[10px] text-emerald-400 font-medium mt-2">
            {stats.nodes.label}
          </p>
        </div>
      </div>

      {/* 3. Split Grid: Recent Servers (Left) vs Recent Activity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent Servers */}
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white tracking-tight">Pterodactyl Servers</h2>
              <Server className="w-4 h-4 text-purple-400" />
            </div>

            {recentServers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <p>No servers available.</p>
                <p className="text-[11px] text-slate-500">
                  {configured ? 'No game servers found in your Pterodactyl Panel.' : 'Connect Pterodactyl to display servers.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentServers.map((srv: any) => (
                  <div
                    key={srv.id}
                    className="bg-[#140E24] hover:bg-[#1a1230] border border-purple-900/20 rounded-xl p-3.5 flex items-center justify-between transition-colors cursor-pointer group"
                    onClick={() => navigate('/admin/servers')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                          {srv.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{srv.identifier || srv.ip}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <StatusBadge status={srv.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/admin/servers')}
            className="w-full text-center text-xs font-semibold text-purple-400 hover:text-purple-300 py-2.5 rounded-xl bg-purple-950/30 border border-purple-900/30 transition-colors mt-5 cursor-pointer"
          >
            View Fleet Management
          </button>
        </div>

        {/* Right Column: Recent Activity Audit Logs */}
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white tracking-tight">Recent Activity</h2>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>

            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No activity logs recorded yet.
              </div>
            ) : (
              <div className="space-y-3.5">
                {recentActivity.slice(0, 5).map((act: any) => (
                  <div key={act.id} className="flex items-start justify-between gap-3 text-xs">
                    <div>
                      <p className="text-slate-300">
                        <strong className="text-purple-300">{act.username}</strong>: {act.details}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/admin/logs')}
            className="w-full text-center text-xs font-semibold text-purple-400 hover:text-purple-300 py-2 rounded-xl bg-purple-950/30 border border-purple-900/30 transition-colors mt-4 cursor-pointer"
          >
            View Full Audit Logs
          </button>
        </div>
      </div>
    </div>
  );
};
