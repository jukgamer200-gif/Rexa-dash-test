/**
 * RexaCloud Administrator Server Management
 * Full infrastructure overview of all provisioned servers across nodes.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { PterodactylServer } from '@/shared/types';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  Server,
  Plus,
  Trash2,
  Pause,
  Play,
  Search,
  Loader2,
  Terminal,
  AlertTriangle,
} from 'lucide-react';

export const ServerManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    setIsLoading(true);
    try {
      const res = await api.listServers();
      setServers(res.servers);
    } catch (err) {
      console.error('Failed to load fleet servers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSuspend = async (server: PterodactylServer) => {
    try {
      if (server.isSuspended) {
        await api.unsuspendServer(server.id);
      } else {
        await api.suspendServer(server.id);
      }
      await loadServers();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently destroy server "${name}"? This deletes all files and databases.`)) return;
    try {
      await api.deleteServer(id);
      await loadServers();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  const filtered = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.node.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Fleet Servers</h1>
          <p className="text-xs text-slate-400 mt-1">
            Global container inventory across all compute nodes
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/create-server')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Provision Server</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by server name, node, or identifier..."
          className="w-full bg-[#100D1A] border border-purple-900/30 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-xs">Querying fleet instances...</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-purple-900/25 text-slate-400 font-semibold bg-[#130E22]/60">
                <th className="py-3.5 px-5">Server</th>
                <th className="py-3.5 px-5">Node</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Allocated Limits</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/15">
              {filtered.map((s) => (
                <tr key={s.identifier} className="hover:bg-purple-950/20 transition-colors">
                  <td className="py-3.5 px-5">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{s.name}</span>
                        {s.isSuspended && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-medium">
                            Suspended
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {s.ip}:{s.port} · {s.identifier}
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-5 text-slate-300">
                    {s.node}
                  </td>

                  <td className="py-3.5 px-5">
                    <StatusBadge status={s.isSuspended ? 'offline' : s.utilization.state} size="sm" />
                  </td>

                  <td className="py-3.5 px-5 font-mono text-slate-400">
                    {(s.limits.memory / 1024).toFixed(0)} GB RAM · {s.limits.cpu}% CPU · {(s.limits.disk / 1024).toFixed(0)} GB SSD
                  </td>

                  <td className="py-3.5 px-5 text-right space-x-1">
                    <button
                      onClick={() => navigate(`/server/${s.identifier}/console`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-950/40"
                      title="Open Console"
                    >
                      <Terminal className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleSuspend(s)}
                      className={`p-1.5 rounded-lg ${
                        s.isSuspended
                          ? 'text-emerald-400 hover:bg-emerald-950/30'
                          : 'text-amber-400 hover:bg-amber-950/30'
                      }`}
                      title={s.isSuspended ? 'Unsuspend' : 'Suspend Server'}
                    >
                      {s.isSuspended ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30"
                      title="Destroy Server"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
