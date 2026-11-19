import { createContext, useCallback, useEffect, useState } from 'react';
import { api, UNAUTHORIZED_EVENT } from '../lib/api';

export const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  // Initialise synchronously so protected pages never render with a null user on refresh.
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(readStoredUser);
  const [organization, setOrganization] = useState(null);

  const login = useCallback((userData, jwtToken) => {
    if (jwtToken) {
      localStorage.setItem('token', jwtToken);
      setToken(jwtToken);
    }
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setOrganization(null);
  }, []);

  /** Pull the latest user + org from the server (role may have changed). */
  const refresh = useCallback(async () => {
    const data = await api('/api/auth/me');
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setOrganization(data.organization);
    return data;
  }, []);

  useEffect(() => {
    if (token) refresh().catch(() => {});
  }, [token, refresh]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{ user, token, organization, setOrganization, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
};
