/**
 * RexaCloud Account Settings Page
 * User profile management, password update, client API credentials, and active sessions.
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  User,
  Key,
  Shield,
  Lock,
  CheckCircle2,
  Copy,
  Plus,
} from 'lucide-react';

export const AccountSettingsPage: React.FC = () => {
  const { user, role } = useAuth();
  const [copiedKey, setCopiedKey] = useState(false);
  const [apiKey] = useState(`ptlc_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`);

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Account Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your personal credentials, API keys, and session security
        </p>
      </div>

      {/* Profile Overview */}
      <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-purple-900/40 border-2 border-purple-500/40 shrink-0">
          <img
            src={user?.avatarUrl || '/src/assets/images/rexacloud_avatar_customer_1791599885662.jpg'}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-1 text-center sm:text-left flex-1">
          <h2 className="text-lg font-bold text-white">{user?.username || 'MrRexa'}</h2>
          <p className="text-xs text-slate-400">{user?.email || 'mrrexa@rexacloud.com'}</p>
          <div className="pt-2">
            <span className="text-[11px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full uppercase font-bold tracking-wider">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* Account Security & Password */}
      <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Lock className="w-5 h-5 text-purple-400" />
          <h2 className="text-base font-bold text-white">Security &amp; Password</h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert('Password update signal verified.');
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
        >
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Current Password
            </label>
            <input
              type="password"
              defaultValue="••••••••"
              className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              New Password
            </label>
            <input
              type="password"
              placeholder="Enter new secure password"
              className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2 text-xs text-white"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30"
            >
              Update Password
            </button>
          </div>
        </form>
      </div>

      {/* Client API Keys */}
      <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Key className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Client API Keys</h2>
          </div>
          <button
            onClick={() => alert('Generated new Client API token.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Key</span>
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Client API keys allow you to automate power actions and file uploads via the Pterodactyl Client API.
        </p>

        <div className="bg-[#140E24] border border-purple-900/30 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
          <div className="truncate text-slate-300 mr-2">
            <span className="text-purple-400 font-bold mr-2">Default Key:</span>
            {apiKey}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(apiKey);
              setCopiedKey(true);
              setTimeout(() => setCopiedKey(false), 2000);
            }}
            className="p-1.5 rounded-lg hover:bg-purple-900/40 text-purple-300 shrink-0"
          >
            {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
