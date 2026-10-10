/**
 * RexaCloud Application Layout Shell
 * Wraps dashboard screens with consistent dark purple atmosphere, sidebar, and topbar.
 * Enforces real authentication; redirects unauthenticated visitors to /login.
 * No demo banners.
 */

import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { TopNav } from './TopNav.js';
import { useAuth } from '../../context/AuthContext.js';

export const AppLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08070D] flex flex-col items-center justify-center text-slate-300 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-pulse">
          <svg
            className="w-6 h-6 text-purple-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-purple-300 tracking-wider uppercase font-mono">
          Connecting to RexaCloud Panel...
        </p>
      </div>
    );
  }

  // Real authentication boundary: unauthenticated users must sign in
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#08070D] text-[#F8FAFC] flex relative overflow-x-hidden">
      {/* Background radial purple ambient lighting */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[450px] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-10 w-[500px] h-[500px] bg-violet-950/15 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav onOpenMobile={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
