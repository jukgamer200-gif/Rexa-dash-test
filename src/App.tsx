/**
 * RexaCloud React Application Entry & Router
 * Assembles authentication context, layout shell, customer pages, and administrator dashboard.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';

// Customer Pages
import { OverviewDashboard } from './pages/customer/OverviewDashboard.js';
import { ServerList } from './pages/customer/ServerList.js';
import { ServerConsolePage } from './pages/customer/ServerConsolePage.js';
import { FileManagerPage } from './pages/customer/FileManagerPage.js';
import { BackupsPage } from './pages/customer/BackupsPage.js';
import { DatabasesPage } from './pages/customer/DatabasesPage.js';
import { ServerSettingsPage } from './pages/customer/ServerSettingsPage.js';
import { AccountSettingsPage } from './pages/customer/AccountSettingsPage.js';

// Administrator Pages
import { AdminDashboard } from './pages/admin/AdminDashboard.js';
import { CreateServerWizard } from './pages/admin/CreateServerWizard.js';
import { UserManagementPage } from './pages/admin/UserManagementPage.js';
import { ServerManagementPage } from './pages/admin/ServerManagementPage.js';
import { NodeManagementPage } from './pages/admin/NodeManagementPage.js';
import { LocationManagementPage } from './pages/admin/LocationManagementPage.js';
import { NestEggManagementPage } from './pages/admin/NestEggManagementPage.js';
import { ActivityLogsPage } from './pages/admin/ActivityLogsPage.js';
import { PanelSettingsPage } from './pages/admin/PanelSettingsPage.js';

// Auth
import { LoginPage } from './pages/auth/LoginPage.js';
import { SignupPage } from './pages/auth/SignupPage.js';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Main App Layout */}

          <Route element={<AppLayout />}>
            {/* Customer Routes */}
            <Route path="/" element={<OverviewDashboard />} />
            <Route path="/servers" element={<ServerList />} />
            <Route path="/server/:identifier/console" element={<ServerConsolePage />} />
            <Route path="/server/:identifier/files" element={<FileManagerPage />} />
            <Route path="/server/:identifier/backups" element={<BackupsPage />} />
            <Route path="/server/:identifier/databases" element={<DatabasesPage />} />
            <Route path="/server/:identifier/settings" element={<ServerSettingsPage />} />
            <Route path="/server/:identifier/network" element={<ServerSettingsPage />} />
            <Route path="/server/:identifier/users" element={<UserManagementPage />} />
            <Route path="/server/:identifier/schedules" element={<BackupsPage />} />
            <Route path="/create-server" element={<CreateServerWizard />} />
            <Route path="/account" element={<AccountSettingsPage />} />
            <Route path="/billing" element={<AccountSettingsPage />} />
            <Route path="/support" element={<PanelSettingsPage />} />

            {/* Administrator Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/servers" element={<ServerManagementPage />} />
            <Route path="/admin/create-server" element={<CreateServerWizard />} />
            <Route path="/admin/nodes" element={<NodeManagementPage />} />
            <Route path="/admin/locations" element={<LocationManagementPage />} />
            <Route path="/admin/nests" element={<NestEggManagementPage />} />
            <Route path="/admin/eggs" element={<NestEggManagementPage />} />
            <Route path="/admin/databases" element={<DatabasesPage />} />
            <Route path="/admin/backups" element={<BackupsPage />} />
            <Route path="/admin/logs" element={<ActivityLogsPage />} />
            <Route path="/admin/settings" element={<PanelSettingsPage />} />
            <Route path="/admin/api" element={<PanelSettingsPage />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
