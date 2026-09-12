import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { Shield, Mail, Lock, Phone, User as UserIcon, ArrowRight, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectPath = (location.state as any)?.from || '/dashboard';

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    setErrorMessage(null);
    try {
      const loggedUser = await loginWithGoogle();
      showToast(
        'success',
        'Google Authentication Successful',
        `Welcome, ${loggedUser.name}! Your citizen portal is ready.`
      );
      navigate(redirectPath);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in cancelled. Please click the button to try again.');
      } else {
        setErrorMessage(
          err?.message || 'Failed to authenticate with Google. Please try again with email and password.'
        );
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (authMode === 'register' && !fullName.trim()) {
      setErrorMessage('Please enter your full name for citizen registration.');
      return;
    }

    setIsLoadingSubmit(true);
    try {
      if (authMode === 'register') {
        const newUser = await registerWithEmail(email, password, fullName, phoneNumber);
        showToast('success', 'Account Registered', `Welcome to CivicBridge, ${newUser.name}!`);
      } else {
        const logged = await loginWithEmail(email, password);
        showToast('success', 'Signed In', `Welcome back, ${logged.name}!`);
      }
      navigate(redirectPath);
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setErrorMessage('Invalid email or password. Please verify credentials or create a new account.');
      } else if (err?.code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email already exists. Please switch to Sign In.');
      } else if (err?.code === 'auth/weak-password') {
        setErrorMessage('Password must be at least 6 characters long.');
      } else {
        setErrorMessage(err?.message || 'Authentication failed.');
      }
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md font-serif">
          CB
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          {language === 'mr' ? 'नागरिक पोर्टल प्रवेश' : language === 'hi' ? 'नागरिक पोर्टल लॉगिन' : 'Citizen Portal Access'}
        </h1>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          {language === 'mr'
            ? 'आपल्या समस्यांची नोंदणी करा, वास्तविक-वेळ स्थिती ट्रॅक करा आणि नवकल्पना सादर करा.'
            : language === 'hi'
            ? 'अपनी समस्याओं की शिकायत दर्ज करें, लाइव स्थिति ट्रैक करें और नवाचार साझा करें।'
            : 'Report civic issues, track live docket resolutions, and co-create urban solutions.'}
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {/* Direct Google Authentication Button */}
        <div>
          <button
            type="button"
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle || isLoadingSubmit}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs hover:border-slate-400 disabled:opacity-50"
          >
            {isLoadingGoogle ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
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
              {isLoadingGoogle
                ? 'Connecting to Google...'
                : language === 'mr'
                ? 'गुगल सह पुढे जा (Continue with Google)'
                : language === 'hi'
                ? 'गूगल के साथ जारी रखें (Continue with Google)'
                : 'Continue with Google'}
            </span>
          </button>
        </div>

        {/* Mode Tabs: Sign In vs Create Account */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            id="tab-signin"
            onClick={() => setAuthMode('signin')}
            className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              authMode === 'signin'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Email Sign In
          </button>
          <button
            type="button"
            id="tab-register"
            onClick={() => setAuthMode('register')}
            className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
              authMode === 'register'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5">
          {authMode === 'register' && (
            <div>
              <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-800 mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Anand Deshmukh"
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email-input" className="block text-xs font-semibold text-slate-800 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password-input" className="block text-xs font-semibold text-slate-800 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="password-input"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
              />
            </div>
          </div>

          {authMode === 'register' && (
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-800 mb-1">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="reg-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 98200 12345"
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={isLoadingSubmit || isLoadingGoogle}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {isLoadingSubmit ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            <span>
              {isLoadingSubmit
                ? 'Processing...'
                : authMode === 'register'
                ? 'Create Citizen Account'
                : 'Sign In to Citizen Portal'}
            </span>
          </button>
        </form>

        {/* Administrative Portal Link */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <Link
            to="/admin/login"
            id="switch-admin-login-link"
            className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center justify-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Switch to Government / Officer Portal</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
};
