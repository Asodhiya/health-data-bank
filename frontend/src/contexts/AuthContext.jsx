import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);
const ACTIVE_ROLE_STORAGE_KEY = 'hdb:active-role';

function normalizeRoles(list) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map((role) => String(role || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function resolveActiveRole(data) {
  const roles = normalizeRoles(data?.Role);
  if (roles.length === 0) return null;

  const savedRole = window.localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY);
  if (savedRole && roles.includes(savedRole)) return savedRole;
  return roles[0];
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [roles, setRoles]     = useState([]);
  const [role, setRole]       = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    try {
      const data = await api.me();
      const availableRoles = normalizeRoles(data?.Role);
      const activeRole = resolveActiveRole(data);
      setUser(data);
      setRoles(availableRoles);
      setRole(activeRole);
      setMaintenance(null);
      if (activeRole) {
        window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, activeRole);
      }
      return data;
    } catch (error) {
      setUser(null);
      setRoles([]);
      setRole(null);
      setMaintenance(error?.status === 503 && error?.maintenance ? error.maintenance : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { hydrate(); }, [hydrate]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
    setRoles([]);
    setRole(null);
    setMaintenance(null);
    window.localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
  }, []);

  const switchRole = useCallback((nextRole) => {
    const normalized = String(nextRole || '').trim().toLowerCase();
    if (!normalized || !roles.includes(normalized)) return false;
    setRole(normalized);
    window.localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, normalized);
    return true;
  }, [roles]);

  return (
    <AuthContext.Provider value={{ user, role, roles, loading, maintenance, refetch: hydrate, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
