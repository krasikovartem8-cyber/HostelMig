import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import axios from 'axios';
import * as localApi from '../services/hostelDeskLocal';
import { isLocalApi } from '../lib/hostelClient';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').trim().replace(/\/$/, '');

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      if (isLocalApi()) {
        const userData = localApi.request('GET', '/auth/me', null, {
          Authorization: `Bearer ${token}`,
        });
        setUser(userData);
        return;
      }
      const response = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    loadUser();
  }, [token, loadUser]);

  const login = useCallback(async (email, password) => {
    if (isLocalApi()) {
      const out = localApi.login(email, password);
      localStorage.setItem('token', out.access_token);
      setToken(out.access_token);
      setUser(out.user);
      return out;
    }

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await axios.post(`${API_BASE}/auth/login`, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const out = response.data;
    localStorage.setItem('token', out.access_token);
    setToken(out.access_token);
    setUser(out.user);
    return out;
  }, []);

  const getAuthHeader = useCallback(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const isAdmin = useMemo(() => Boolean(user?.role?.admin), [user?.role?.admin]);
  const isAccountant = useMemo(
    () => Boolean(user?.role?.accountant),
    [user?.role?.accountant]
  );
  const isMigrationOfficer = useMemo(
    () => Boolean(user?.role?.migration_officer),
    [user?.role?.migration_officer]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        getAuthHeader,
        loading,
        isAdmin,
        isAccountant,
        isMigrationOfficer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
