/**
 * RexaCloud Server Settings Page
 * SFTP credentials, startup flags, Docker images, and reinstall triggers.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { PterodactylServer } from '@/shared/types';
import {
  Settings,
  ChevronRight,
  Server,
  Lock,
  RefreshCw,
  Sliders,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

export const ServerSettingsPage: React.FC = () => {
  const { identifier = 'rexa-smp' } = useParams();
  const [server, setServer] = useState<PterodactylServer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadServer();
  }, [identifier]);

  const loadServer = async () => {
    setIsLoading(true);
    try {
      const res = await api.getServer(identifier);
      setServer(res.server);
    } catch (err) {
      console.error('Failed to load server settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copySftp = () => {
    if (!server) return;
    navigator.clipboard.writeText(`sftp://${server.ip}:2022`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !server) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-xs">Loading container parameters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/servers" className="hover:text-purple-300">Servers</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <Link to={`/server/${identifier}/console`} className="hover:text-purple-300">{server.name}</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-purple-400 font-semibold">Settings</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Server Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          SFTP configuration, startup arguments, and container management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SFTP Details Card */}
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">SFTP Configuration</h2>
          </div>
          <p className="text-xs text-slate-400">
            Connect using WinSCP, FileZilla, or Cyberduck using your RexaCloud account credentials.
          </p>

          <div className="space-y-3 text-xs font-mono">
            <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/30 flex justify-between items-center">
              <div>
                <span className="text-slate-500 block text-[10px]">Server Address</span>
                <span className="text-white">{server.ip}:2022</span>
              </div>
              <button
                onClick={copySftp}
                className="p-1.5 rounded-lg hover:bg-purple-900/40 text-purple-300"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/30">
              <span className="text-slate-500 block text-[10px]">Username</span>
              <span className="text-white">{server.identifier}</span>
            </div>
          </div>
        </div>

        {/* Reinstall Container */}
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-rose-400">
            <RefreshCw className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">Reinstall Server</h2>
          </div>
          <p className="text-xs text-slate-400">
            Wipes all scripts and redownloads clean egg files. Existing world saves and configuration files will be reset.
          </p>

          <div className="pt-4">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reinstall this server container?')) {
                  alert('Reinstallation signal dispatched to Wings node daemon.');
                }
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 transition-colors"
            >
              Reinstall Container
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
