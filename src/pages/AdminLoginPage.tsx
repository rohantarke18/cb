import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Shield,
  Lock,
  Mail,
  Building2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkPrivilegesAndRedirect = (user: any) => {
    const privilegedRoles = ['super_admin', 'department_admin', 'officer', 'expert'];
    if (!privilegedRoles.includes(user.role)) {
      setErrorMessage(
        `Access Denied: "${user.email || user.name}" is registered as a Citizen. The Municipal Administrative Portal requires an authorized Officer, Department Administrator, or Super Admin account.`
      );
      return false;
    }

    showToast(
      'success',
      'Official Access Authorized',
      `Welcome, ${user.name} (${user.designation || user.role})`
    );

    if (user.role === 'officer') {
      navigate('/admin/assignments');
    } else {
      navigate('/admin');
    }
    return true;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both municipal email address and security password.');
      return;
    }

    setIsLoadingSubmit(true);
    try {
      const authenticatedUser = await loginWithEmail(email, password);
      checkPrivilegesAndRedirect(authenticatedUser);
    } catch (err: any) {
      console.error('Official Email Auth error:', err);
      if (
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/invalid-credential'
      ) {
        setErrorMessage('Invalid official email or password. Please verify credentials with your department administrator.');
      } else {
        setErrorMessage(err?.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    setErrorMessage(null);

    try {
      const authenticatedUser = await loginWithGoogle();
      checkPrivilegesAndRedirect(authenticatedUser);
    } catch (err: any) {
      console.error('Google Official Login Error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in cancelled. Please try again.');
      } else {
        setErrorMessage(err?.message || 'Failed to authenticate with Google.');
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-amber-500/20 font-serif">
          CB
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Restricted Municipal Administrative Desk</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Government & Officer Portal
        </h1>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Authorized access point for Field Officers, Department Engineers, Supervisors, and Central Municipal Administrators.
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/90 py-7 px-5 sm:px-8 shadow-2xl rounded-2xl space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/70 border border-rose-800/90 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Authorized Google SSO */}
          <div>
            <button
              type="button"
              id="admin-google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={isLoadingGoogle || isLoadingSubmit}
              className="w-full py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs hover:border-slate-600 disabled:opacity-50"
            >
              {isLoadingGoogle ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>
                {isLoadingGoogle ? 'Authenticating Official...' : 'Sign In with Authorized Google Account'}
              </span>
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Or official credentials
            </span>
          </div>

          {/* Email / Password Official Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-300 mb-1">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@civicbridge.gov.in"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-700 bg-slate-950/70 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-300 mb-1">
                Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="admin-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-700 bg-slate-950/70 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              id="admin-submit-btn"
              disabled={isLoadingSubmit || isLoadingGoogle}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-3"
            >
              {isLoadingSubmit ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              <span>{isLoadingSubmit ? 'Verifying Authorization...' : 'Access Municipal Desk'}</span>
            </button>
          </form>

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Role-Based Access Enforcement</span>
            </div>
            <p className="leading-snug">
              Official roles are strictly assigned by the municipal administrator. Self-assignment of administrative roles is prohibited.
            </p>
          </div>

          {/* Return to Citizen Portal */}
          <div className="pt-2 text-center border-t border-slate-800">
            <Link
              to="/login"
              id="back-citizen-portal-link"
              className="text-xs text-sky-400 hover:text-sky-300 font-medium inline-flex items-center justify-center gap-1.5"
            >
              <span>Return to Public Citizen Portal</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
