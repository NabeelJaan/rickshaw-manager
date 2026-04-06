import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User, AlertCircle, ArrowLeft, KeyRound, Eye, EyeOff, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const [view, setView] = useState<'login' | 'forgot' | 'reset' | 'register'>('login');
  const [canRegister, setCanRegister] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  
  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot password state
  const [fpUsername, setFpUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showResetToken, setShowResetToken] = useState(false);
  
  // Reset password state
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Registration state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Check if registration is available
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const res = await fetch('/api/auth/can-register');
        const data = await res.json();
        setCanRegister(data.canRegister);
        if (data.canRegister) {
          setView('register');
        }
      } catch (err) {
        console.error('Failed to check registration status');
      } finally {
        setCheckingRegistration(false);
      }
    };
    checkRegistration();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fpUsername }),
      });

      const data = await res.json();

      if (res.ok && data.resetToken) {
        setResetToken(data.resetToken);
        setShowResetToken(true);
        setSuccess('Reset token generated! Copy this token and use it below to reset your password.');
      } else if (res.ok) {
        setSuccess('If the user exists, a reset process has been initiated.');
      } else {
        setError(data.error || 'Failed to process request');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetTokenInput, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('Password reset successfully! You can now login with your new password.');
        setTimeout(() => {
          setView('login');
          setSuccess('');
          setNewPassword('');
          setConfirmPassword('');
          setResetTokenInput('');
        }, 3000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register-first', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUsername, password: regPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.token, data.user);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-6">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Username</label>
        <div className="relative">
          <User className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Enter username"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-12 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Enter password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-3.5 text-zinc-500 hover:text-zinc-400"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => { setView('forgot'); setError(''); setSuccess(''); }}
          className="text-sm text-zinc-500 hover:text-emerald-500 transition-colors"
        >
          Forgot password?
        </button>
      </div>
    </form>
  );

  const renderForgotForm = () => (
    <form onSubmit={handleForgotPassword} className="space-y-6">
      <button
        type="button"
        onClick={() => { setView('login'); setError(''); setSuccess(''); setShowResetToken(false); setResetToken(''); }}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-500 transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </button>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl text-sm">
          {success}
        </div>
      )}

      {showResetToken && resetToken && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
          <label className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-2 block">Your Reset Token</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={resetToken}
              className="flex-1 bg-zinc-950 border border-amber-500/30 text-amber-500 px-3 py-2 rounded-lg text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(resetToken)}
              className="px-3 py-2 bg-amber-500/20 text-amber-500 rounded-lg text-xs hover:bg-amber-500/30 transition-colors"
            >
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setView('reset')}
            className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 rounded-lg transition-all"
          >
            I have copied the token
          </button>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Username</label>
        <div className="relative">
          <User className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            required
            value={fpUsername}
            onChange={(e) => setFpUsername(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Enter your username"
          />
        </div>
      </div>

      {!showResetToken && (
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
        >
          {loading ? 'Processing...' : 'Generate Reset Token'}
        </button>
      )}
    </form>
  );

  const renderResetForm = () => (
    <form onSubmit={handleResetPassword} className="space-y-6">
      <button
        type="button"
        onClick={() => { setView('login'); setError(''); setSuccess(''); }}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-500 transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </button>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl text-sm">
          {success}
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Reset Token</label>
        <div className="relative">
          <KeyRound className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            required
            value={resetTokenInput}
            onChange={(e) => setResetTokenInput(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono text-sm"
            placeholder="Paste your reset token"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">New Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type={showNewPassword ? 'text' : 'password'}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-12 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Enter new password"
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-4 top-3.5 text-zinc-500 hover:text-zinc-400"
          >
            {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Confirm new password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
      >
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );

  const renderRegistrationForm = () => (
    <form onSubmit={handleRegistration} className="space-y-6">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm mb-4">
        <p className="font-medium">🎉 First Time Setup</p>
        <p className="text-emerald-300 text-xs mt-1">Create your super admin account to get started.</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Username</label>
        <div className="relative">
          <UserPlus className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            required
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Choose a username"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type={showRegPassword ? 'text' : 'password'}
            required
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-12 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Create password (min 6 chars)"
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowRegPassword(!showRegPassword)}
            className="absolute right-4 top-3.5 text-zinc-500 hover:text-zinc-400"
          >
            {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500" />
          <input
            type="password"
            required
            value={regConfirmPassword}
            onChange={(e) => setRegConfirmPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Confirm password"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
      >
        {loading ? 'Creating Account...' : 'Create Super Admin Account'}
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          {checkingRegistration ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-500 text-sm">Checking system status...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
                  {view === 'register' ? <UserPlus className="w-8 h-8 text-emerald-500" /> : <Lock className="w-8 h-8 text-emerald-500" />}
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {view === 'login' && 'Welcome Back'}
                  {view === 'register' && 'First Time Setup'}
                  {view === 'forgot' && 'Forgot Password'}
                  {view === 'reset' && 'Reset Password'}
                </h1>
                <p className="text-zinc-500 text-sm mt-2">
                  {view === 'login' && 'Rickshaw Manager Admin'}
                  {view === 'register' && 'Create your super admin account'}
                  {view === 'forgot' && 'Generate a reset token to recover your account'}
                  {view === 'reset' && 'Enter your token and new password'}
                </p>
              </div>

              {view === 'login' && renderLoginForm()}
              {view === 'register' && renderRegistrationForm()}
              {view === 'forgot' && renderForgotForm()}
              {view === 'reset' && renderResetForm()}
            </>
          )}
        </div>
        <p className="text-center text-zinc-600 text-xs mt-8">
          &copy; 2026 Rickshaw Manager. Secure Administration.
        </p>
      </div>
    </div>
  );
}

