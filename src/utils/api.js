export const getBackendUrl = () => {
  // 1. If Vite environment variable is set (Vercel, Render, local .env)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }

  if (typeof window === 'undefined') return 'https://acessories-backend.onrender.com';

  const hostname = window.location.hostname;
  const port = window.location.port;

  // 2. If running locally on localhost/127.0.0.1
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (port && port !== '5000') {
      return `http://${hostname}:5000`;
    }
    return window.location.origin;
  }

  // 3. In production deployments (Vercel, Netlify, Custom Domain), route to Render live backend
  return 'https://acessories-backend.onrender.com';
};
