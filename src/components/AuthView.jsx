import { getBackendUrl } from '../utils/api';
import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Layers3, ArrowRight, ShieldAlert, Check, X } from 'lucide-react';

const API_BASE_URL = `${getBackendUrl()}/api/auth`;

export default function AuthView({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login');

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState('Designer');
  const [adminCode, setAdminCode] = useState('');
  const [securityCode, setSecurityCode] = useState('');

  // UI Helpers
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auto-dismiss toast after 15 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Clear alerts on tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
    setShowPassword(false);
  };

  // Login Handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!loginEmail || !loginPassword) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid credentials.');
        setLoading(false);
        return;
      }

      setSuccess('Login successful! Redirecting...');
      localStorage.setItem('gpdms_jwt_token', data.token);

      setTimeout(() => {
        onLoginSuccess(data.user);
      }, 800);
    } catch (err) {
      console.error('Login error:', err);
      setError('Cannot connect to the backend server. Please verify it is running.');
      setLoading(false);
    }
  };

  // Pre-Register submit (posts details to server, directly verifies with Security Code)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!regName || !regEmail || !regPassword || !regConfirmPassword || !securityCode) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    if (securityCode.trim() !== 'MHSTORE2026@') {
      setError('Invalid Security Code. Use MHSTORE2026@ to register.');
      setLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
          securityCode: securityCode,
          adminCode: regRole === 'Admin' ? adminCode : undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }

      setSuccess('Registration successful! You can now log in.');
      const tempEmail = regEmail;

      // Clear fields
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirmPassword('');
      setSecurityCode('');
      setAdminCode('');
      setLoading(false);

      // Shift to login
      setTimeout(() => {
        setActiveTab('login');
        setLoginEmail(tempEmail);
        setSuccess('');
      }, 1500);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Cannot connect to the backend server. Please verify it is running.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Floating System Toast Simulation */}
      {toast && (
        <div className="notification-toast">
          <Mail size={24} style={{ color: '#60a5fa', flexShrink: 0 }} />
          <div className="notification-content">
            <div className="notification-title">{toast.type}</div>
            <div className="notification-body">
              A secure verification code has been sent to <strong style={{ color: '#60a5fa' }}>{toast.to}</strong>. Please check your email inbox to get the code.
              {toast.simulatedOtp && (
                <div style={{ marginTop: '8px', padding: '6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', color: '#fbbf24', fontSize: '12px' }}>
                  <strong>[Demo Mode]</strong> Simulated OTP code: <strong style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '13px' }}>{toast.simulatedOtp}</strong>
                </div>
              )}
            </div>
          </div>
          <button className="notification-close" onClick={() => setToast(null)}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="auth-card">
        {/* Branding Logo */}
        <div className="auth-logo">
          <Layers3 size={32} style={{ color: 'var(--accent-color)' }} />
          <span>G-PDMS</span>
        </div>

        {/* Tab Selection */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabChange('login')}
            disabled={loading}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => handleTabChange('register')}
            disabled={loading}
          >
            Register
          </button>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="auth-alert error">
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert success">
            <Check size={18} style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Sign in to manage product specifications</p>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. name@gpdms.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-input-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit}>
            <h2 className="auth-title">Create Account</h2>
            <p className="auth-subtitle">Get started with design & materials control</p>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. john@gpdms.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Professional Role</label>
              <select
                className="form-input"
                value={regRole}
                onChange={(e) => { setRegRole(e.target.value); setAdminCode(''); }}
                disabled={loading}
              >
                <option value="Designer">Designer</option>
                <option value="Store">Store</option>
                <option value="Admin">🛡️ Admin (Requires Secret Code)</option>
              </select>

              {/* Admin Secret Code — only shown when Admin role is selected */}
              {regRole === 'Admin' && (
                <div style={{
                  marginTop: '12px',
                  padding: '14px 16px',
                  backgroundColor: 'rgba(124, 58, 237, 0.06)',
                  border: '1.5px solid rgba(124, 58, 237, 0.3)',
                  borderRadius: 'var(--border-radius-sm)'
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '12px', fontWeight: '700',
                    color: '#7c3aed', marginBottom: '8px'
                  }}>
                    <ShieldAlert size={14} />
                    Admin privileges grant full system access. Enter the Admin Secret Code to proceed.
                  </div>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon-left">
                      <Lock size={16} style={{ color: '#7c3aed' }} />
                    </span>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter Admin Secret Code"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      required
                      disabled={loading}
                      style={{ borderColor: 'rgba(124,58,237,0.4)' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-input-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {regPassword && (
              <div className={`password-requirements ${regPassword.length >= 6 ? 'valid' : ''}`}>
                <Check size={14} />
                <span>Password length: {regPassword.length}/6 characters</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left">
                  <Lock size={18} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Re-enter password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label">Security Code</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon-left">
                  <Lock size={18} style={{ color: 'var(--accent-color)' }} />
                </span>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter signup security code"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  required
                  disabled={loading}
                  style={{ borderColor: 'var(--accent-color)' }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary auth-submit-btn" style={{ marginTop: '20px' }} disabled={loading}>
              <span>{loading ? 'Registering...' : 'Sign Up'}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
