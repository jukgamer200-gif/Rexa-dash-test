/**
 * RexaCloud Primary Sidebar Component
 * Dark purple sidebar with clear role separation.
 * Administrators have access to Admin Panel and Customer View. Customers only see Customer views.
 * No demo toggle.
 */

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  Server,
  Terminal,
  FolderTree,
  Database,
  HardDrive,
  Users,
  Settings,
  UserCheck,
  Cpu,
  MapPin,
  Layers,
  Activity,
  Plus,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const inAdminSection = location.pathname.startsWith('/admin');

  const customerNavItems = [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
    { label: 'Servers', to: '/servers', icon: Server },
    { label: 'Account Profile', to: '/account', icon: UserCheck },
  ];

  const adminNavItems = [
    { label: 'Admin Dashboard', to: '/admin', icon: LayoutDashboard },
    { label: 'User Management', to: '/admin/users', icon: Users },
    { label: 'Server Fleet', to: '/admin/servers', icon: Server },
    { label: 'Nodes', to: '/admin/nodes', icon: Cpu },
    { label: 'Locations', to: '/admin/locations', icon: MapPin },
    { label: 'Nests & Eggs', to: '/admin/nests', icon: Layers },
    { label: 'Activity Logs', to: '/admin/logs', icon: Activity },
    { label: 'Pterodactyl Settings', to: '/admin/settings', icon: Settings },
  ];

  const navItems = inAdminSection && role === 'admin' ? adminNavItems : customerNavItems;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-[#0A0711] border-r border-purple-900/20 flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-18 flex items-center px-6 border-b border-purple-950/40 gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-700 to-violet-500 shadow-md shadow-purple-900/40">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            </svg>
            <div className="absolute inset-0 rounded-xl bg-purple-500/20 blur-sm pointer-events-none" />
          </div>

          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-purple-100 to-purple-300 bg-clip-text text-transparent">
              RexaCloud
            </span>
            <span className="text-[10px] font-medium text-purple-400/80 -mt-0.5 tracking-wider uppercase">
              {inAdminSection && role === 'admin' ? 'Administration' : 'Customer Panel'}
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                onClick={onCloseMobile}
                end={item.to === '/' || item.to === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[#6D28D9] text-white shadow-lg shadow-purple-900/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-purple-950/30'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Admin Navigation Shortcuts for Administrator */}
        {role === 'admin' && (
          <div className="p-3 border-t border-purple-950/40 bg-[#0c0816]/70 space-y-2">
            <button
              onClick={() => {
                navigate(inAdminSection ? '/' : '/admin');
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-[#140e24] hover:bg-[#1a1230] text-purple-200 border border-purple-900/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>{inAdminSection ? 'Go to Customer View' : 'Go to Admin Panel'}</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
            </button>

            <button
              onClick={() => {
                navigate('/admin/create-server');
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deploy New Server</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
