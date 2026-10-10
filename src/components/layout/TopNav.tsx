/**
 * RexaCloud Top Navigation Component
 * Header navigation bar with search, notifications, live connection status, and user profile.
 * No demo role switcher or fake sandbox mode.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface TopNavProps {
  onOpenMobile: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onOpenMobile }) => {
  const { user, role, logout, systemStatus } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isConnected = systemStatus?.clientApiConnected || systemStatus?.appApiConnected;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/servers?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const username = user?.username || 'User';
  const roleDisplay = role === 'admin' ? 'Administrator' : 'Customer';

  return (
    <header className="sticky top-0 z-30 h-18 bg-[#090710]/90 backdrop-blur-md border-b border-purple-900/20 px-4 lg:px-8 flex items-center justify-between gap-4">
      {/* Left zone: Mobile toggle & Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <button
          onClick={onOpenMobile}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-purple-900/20 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search input with rounded capsule styling */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md hidden sm:block">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search servers..."
            className="w-full bg-[#130E20] border border-purple-900/30 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </form>
      </div>

      {/* Right zone: Connection Status Pill, Notifications, User Profile */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Pterodactyl Connection Indicator */}
        {role === 'admin' ? (
          <button
            onClick={() => navigate('/admin/settings')}
            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="Pterodactyl API Connection Status"
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pterodactyl Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Pterodactyl Disconnected</span>
              </>
            )}
          </button>
        ) : (
          <div
            className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Panel Online</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Panel Pending</span>
              </>
            )}
          </div>
        )}

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            onClick={() => {
              setNotifOpen(!notifOpen);
              setProfileOpen(false);
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-purple-900/20 relative transition-colors"
          >
            <Bell className="w-5 h-5" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#120D20] border border-purple-900/40 rounded-2xl shadow-xl shadow-purple-950/50 p-4 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-purple-900/20 mb-3">
                <span className="font-semibold text-white">System Status</span>
                <span className="text-[10px] text-purple-400">Live</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/20 text-slate-300 space-y-1">
                <p className="font-medium">
                  {isConnected ? 'Pterodactyl connection active.' : 'Pterodactyl connection not established.'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {isConnected
                    ? `Latency: ${systemStatus?.latencyMs || 0}ms`
                    : 'Configure panel API keys in Admin Settings.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-3 p-1.5 pr-2.5 rounded-2xl hover:bg-purple-900/20 border border-transparent hover:border-purple-900/30 transition-all text-left cursor-pointer"
          >
            <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-purple-900/50 border border-purple-500/30 shrink-0 flex items-center justify-center text-purple-200 font-bold text-xs uppercase">
              {username.substring(0, 2)}
            </div>

            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-bold text-white leading-tight">{username}</span>
              <span className="text-[10px] text-purple-400 leading-tight font-medium">{roleDisplay}</span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#120D20] border border-purple-900/40 rounded-2xl shadow-xl shadow-purple-950/50 py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-purple-900/20 mb-1">
                <p className="font-semibold text-white truncate">{username}</p>
                <p className="text-[10px] text-purple-400 truncate">{user?.email}</p>
              </div>

              <button
                onClick={() => {
                  setProfileOpen(false);
                  navigate('/account');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-300 hover:text-white hover:bg-purple-900/30 text-left transition-colors cursor-pointer"
              >
                <User className="w-4 h-4 text-purple-400" />
                <span>Account Profile</span>
              </button>

              {role === 'admin' && (
                <button
                  onClick={() => {
                  setProfileOpen(false);
                  navigate('/admin/settings');
                }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-slate-300 hover:text-white hover:bg-purple-900/30 text-left transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span>Pterodactyl Settings</span>
                </button>
              )}

              <div className="my-1 border-t border-purple-900/20" />

              <button
                onClick={async () => {
                  setProfileOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 text-left transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
