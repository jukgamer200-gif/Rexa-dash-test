/**
 * RexaCloud Server Databases Management
 * Lists databases attached to the server container with connection strings.
 * Real Pterodactyl API integration.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { DatabaseItem } from '@/shared/types';
import {
  Database,
  Key,
  Copy,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';

export const DatabasesPage: React.FC = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const [databases, setDatabases] = useState<DatabaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (identifier) {
      loadDatabases();
    }
  }, [identifier]);

  const loadDatabases = async () => {
    if (!identifier) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.listDatabases(identifier);
      setDatabases(res.databases || []);
    } catch (err: any) {
      console.error('Failed to load databases:', err);
      setErrorMessage(err.message || 'Failed to list databases');
      setDatabases([]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!identifier) {
    return (
      <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl p-8 text-center text-slate-400">
        No server selected. Please choose a server to view databases.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/servers" className="hover:text-purple-300">Servers</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <Link to={`/server/${identifier}/console`} className="hover:text-purple-300 font-mono">{identifier}</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-purple-400 font-semibold">Databases</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Databases</h1>
          <p className="text-xs text-slate-400 mt-1">
            Database credentials and host allocations for this container
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-7 h-7 text-purple-500 animate-spin" />
          <p className="text-xs">Loading databases...</p>
        </div>
      ) : databases.length === 0 ? (
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Database className="w-10 h-10 text-purple-400/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Databases Configured</h3>
          <p className="text-xs max-w-sm mx-auto">
            This server does not currently have any allocated relational databases in Pterodactyl.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {databases.map((db) => (
            <div key={db.id} className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{db.name}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{db.host}:{db.port}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs bg-purple-950/20 p-3 rounded-xl border border-purple-900/20 font-mono">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Username:</span>
                  <span className="text-slate-200">{db.username}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Host:</span>
                  <span className="text-slate-200">{db.host}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Port:</span>
                  <span className="text-slate-200">{db.port}</span>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(`${db.username}@${db.host}:${db.port}/${db.name}`, db.id)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-[#171026] hover:bg-[#221838] text-purple-300 border border-purple-900/30 transition-colors cursor-pointer"
              >
                {copiedId === db.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === db.id ? 'Copied URI' : 'Copy Connection URI'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
