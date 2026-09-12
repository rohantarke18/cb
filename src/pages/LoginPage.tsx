import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { Shield, Phone, ArrowRight, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginAsCitizen } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [citizenName, setCitizenName] = useState('');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingCitizen, setIsLoadingCitizen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectPath = (location.state as any)?.from || '/dashboard';

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    setErrorMessage(null);
    try {
      const loggedUser = await loginWithGoogle('citizen');
      showToast(
        'success',
        'Google Authentication Successful',
        `Welcome, ${loggedUser.name}! Your citizen portal is ready.`
      );
      navigate(redirectPath);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      // If user closed popup or blocked
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in cancelled. Please click the button to try again.');
      } else {
        setErrorMessage(
          err?.message || 'Failed to authenticate with Google. Please try again or use direct Citizen login.'
        );
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleCitizenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenName.trim() && !phoneOrEmail.trim()) {
      setErrorMessage('Please enter your name or mobile/email to sign in.');
      return;
    }

    setIsLoadingCitizen(true);
    setErrorMessage(null);
    try {
      const loggedUser = await loginAsCitizen(phoneOrEmail, citizenName);
      showToast(
        'success',
        'Citizen Access Granted',
        `Logged in as ${loggedUser.name}. Ready to report and track grievances.`
      );
      navigate(redirectPath);
    } catch (err: any) {
      console.error('Citizen Sign-in error:', err);
      setErrorMessage(err?.message || 'Error logging in as citizen.');
    } finally {
      setIsLoadingCitizen(false);
    }
  };

  const handleOneClickCitizen = async () => {
    setIsLoadingCitizen(true);
    setErrorMessage(null);
    try {
      const loggedUser = await loginAsCitizen('+91 98200 12345', 'Verified Citizen');
      showToast('success', 'Citizen Access Active', 'Signed in as verified resident.');
      navigate(redirectPath);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Quick login failed.');
    } finally {
      setIsLoadingCitizen(false);
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
            onClick={handleGoogleSignIn}
            disabled={isLoadingGoogle || isLoadingCitizen}
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

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200" />
          <span className="flex-shrink mx-4 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            {language === 'mr' ? 'किंवा थेट नागरिक लॉगिन' : language === 'hi' ? 'या सीधा नागरिक लॉगिन' : 'Or Sign In As Citizen'}
          </span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        {/* Citizen Form Sign In */}
        <form onSubmit={handleCitizenSubmit} className="space-y-4">
          <div>
            <label htmlFor="citizen-name" className="block text-xs font-semibold text-slate-800 mb-1">
              {language === 'mr' ? 'आपले नाव' : language === 'hi' ? 'आपका नाम' : 'Your Full Name'}
            </label>
            <input
              id="citizen-name"
              type="text"
              value={citizenName}
              onChange={(e) => setCitizenName(e.target.value)}
              placeholder="e.g. Anand Deshmukh"
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
            />
          </div>

          <div>
            <label htmlFor="phone-email-input" className="block text-xs font-semibold text-slate-800 mb-1">
              {language === 'mr' ? 'मोबाईल नंबर किंवा ईमेल' : language === 'hi' ? 'मोबाइल नंबर या ईमेल' : 'Mobile Number or Email'}
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="phone-email-input"
                type="text"
                value={phoneOrEmail}
                onChange={(e) => setPhoneOrEmail(e.target.value)}
                placeholder="+91 98765 43210 or user@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-blue-600 bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoadingCitizen || isLoadingGoogle}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoadingCitizen ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            <span>
              {isLoadingCitizen
                ? 'Entering Portal...'
                : language === 'mr'
                ? 'नागरिक म्हणून साइन इन करा'
                : language === 'hi'
                ? 'नागरिक के रूप में लॉगिन करें'
                : 'Sign In As Citizen'}
            </span>
          </button>
        </form>

        {/* 1-Click Citizen Quick Access */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleOneClickCitizen}
            disabled={isLoadingCitizen || isLoadingGoogle}
            className="w-full py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>⚡ Instant Citizen Login (1-Click)</span>
          </button>
        </div>

        {/* Administrative Portal Link */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <Link
            to="/admin/login"
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
