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
