/**
 * RexaCloud Authentication Context
 * Manages authenticated user session, persistent token verification, and system status.
 * Strictly uses real credentials and persistent session tokens.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, SystemConnectionStatus } from '@/shared/types';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  systemStatus: SystemConnectionStatus | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemConnectionStatus | null>(null);

  const refreshStatus = async () => {
    try {
      const res = await api.getSystemStatus();
      setSystemStatus(res.status);
    } catch (err) {
      console.warn('Could not fetch system connection status:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = api.getToken();
        if (token) {
          const res = await api.getCurrentUser();
          setUser(res.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        // Expired or invalid token
        api.setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
    refreshStatus();
  }, []);

  const login = async (username: string, password: string) => {
    const { session } = await api.login(username, password);
    setUser(session.user);
    await refreshStatus();
  };

  const signup = async (username: string, email: string, password: string) => {
    const { session } = await api.signup(username, email, password);
    setUser(session.user);
    await refreshStatus();
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    setUser(null);
  };

  const role = user?.role || 'customer';
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isLoading,
        systemStatus,
        login,
        signup,
        logout,
        refreshStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
