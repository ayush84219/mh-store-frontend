// Session constants for tokenization security
export const TOKEN_STORAGE_KEY = 'gpdms_jwt_token';
export const TOKEN_EXPIRES_AT_KEY = 'gpdms_token_expires_at';
export const SESSION_EXPIRED_MSG_KEY = 'gpdms_session_expired_msg';

// 12 hours in milliseconds (12h * 60m * 60s * 1000ms)
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export const getBackendUrl = () => {
  // 1. If running locally in browser (localhost / 127.0.0.1), use local backend port 5000
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const port = window.location.port;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (port && port !== '5000') {
        return `http://${hostname}:5000`;
      }
      return window.location.origin;
    }
  }

  // 2. If Vite environment variable is set for production (Vercel, Netlify, Custom Hosting)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }

  // 3. Fallback to live Render backend
  return 'https://acessories-backend.onrender.com';
};

/**
 * Safely parse a JWT payload in the browser
 */
export const parseJwt = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

/**
 * Retrieve current JWT token from localStorage
 */
export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

/**
 * Store authenticated session with 12-hour expiration tracking
 */
export const setAuthSession = (token, explicitExpiresAt = null) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);

  let expiresAt = explicitExpiresAt;
  if (!expiresAt) {
    const payload = parseJwt(token);
    if (payload && payload.exp) {
      expiresAt = payload.exp * 1000;
    } else {
      expiresAt = Date.now() + SESSION_DURATION_MS;
    }
  }
  localStorage.setItem(TOKEN_EXPIRES_AT_KEY, expiresAt.toString());
  sessionStorage.removeItem(SESSION_EXPIRED_MSG_KEY);
};

/**
 * Clear stored auth session
 */
export const clearAuthSession = (expiredMessage = null) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
  if (expiredMessage) {
    sessionStorage.setItem(SESSION_EXPIRED_MSG_KEY, expiredMessage);
  }
};

/**
 * Check if the current token has expired (12-hour limit reached)
 */
export const isTokenExpired = () => {
  if (typeof window === 'undefined') return true;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return true;

  // 1. Check expiration timestamp stored at login
  const storedExpiresAt = localStorage.getItem(TOKEN_EXPIRES_AT_KEY);
  if (storedExpiresAt) {
    const expNum = Number(storedExpiresAt);
    if (!isNaN(expNum) && Date.now() >= expNum) {
      return true;
    }
  }

  // 2. Validate against JWT internal exp claim
  const payload = parseJwt(token);
  if (payload && payload.exp) {
    const jwtExpMs = payload.exp * 1000;
    if (Date.now() >= jwtExpMs) {
      return true;
    }
  }

  return false;
};

/**
 * Get remaining session time in milliseconds
 */
export const getSessionRemainingMs = () => {
  if (typeof window === 'undefined') return 0;
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return 0;

  const payload = parseJwt(token);
  if (payload && payload.exp) {
    const remaining = (payload.exp * 1000) - Date.now();
    return Math.max(0, remaining);
  }

  const storedExpiresAt = localStorage.getItem(TOKEN_EXPIRES_AT_KEY);
  if (storedExpiresAt) {
    const remaining = Number(storedExpiresAt) - Date.now();
    return Math.max(0, remaining);
  }

  return 0;
};

/**
 * Authenticated Fetch wrapper: automatically injects Authorization header
 * and detects session expiration (HTTP 401) to cleanly handle logout
 */
export const authFetch = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearAuthSession('Your 12-hour secure session has expired. Please log in again to continue.');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired', {
        detail: { message: 'Your 12-hour session has expired. Please log in again to secure your application.' }
      }));
    }
  }

  return response;
};
