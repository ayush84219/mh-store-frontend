export const getBackendUrl = () => {
  // If Vite environment variable is set (production deployment on Vercel)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') return 'http://localhost:5000';

  const hostname = window.location.hostname;
  const port = window.location.port;

  // If Vite dev server (port 5173 or other dev port), point to backend port 5000
  if (port && port !== '5000') {
    return `http://${hostname}:5000`;
  }

  // If served from backend or standard port (5000 / 80 / 443 / domain)
  return window.location.origin;
};

