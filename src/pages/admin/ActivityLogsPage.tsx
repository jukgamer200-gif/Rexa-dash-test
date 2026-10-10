/**
 * RexaCloud Activity & Audit Logs
 * Comprehensive chronological record of all administrative and customer operations.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { ActivityLog } from '@/shared/types';
import { Activity, Clock, Search, ShieldAlert, Loader2 } from 'lucide-react';

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getActivityLogs(100);
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = logs.filter(
    (l) =>
      l.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Audit Activity Logs</h1>
        <p className="text-xs text-slate-400 mt-1">
          Immutable audit record of all authentication events, power signals, and server provisioning
        </p>
      </div>

      <div className="relative max-w-md">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by user, action type, or resource..."
          className="w-full bg-[#100D1A] border border-purple-900/30 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <p className="text-xs">Fetching audit trail...</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-purple-900/25 text-slate-400 font-semibold bg-[#130E22]/60">
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">User</th>
                <th className="py-3.5 px-5">Action</th>
                <th className="py-3.5 px-5">Target Resource</th>
                <th className="py-3.5 px-5">Details</th>
                <th className="py-3.5 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/15">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-purple-950/20 transition-colors">
                  <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>

                  <td className="py-3.5 px-5 font-semibold text-white">
                    {log.username}
                  </td>

                  <td className="py-3.5 px-5">
                    <span className="font-mono text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/30 text-[10px]">
                      {log.action}
                    </span>
                  </td>

                  <td className="py-3.5 px-5 font-medium text-slate-200">
                    {log.resource}
                  </td>

                  <td className="py-3.5 px-5 text-slate-400 max-w-xs truncate">
                    {log.details}
                  </td>

                  <td className="py-3.5 px-5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        log.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : log.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
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
