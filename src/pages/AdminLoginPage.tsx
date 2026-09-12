import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { UserRole } from '../types';
import {
  Shield,
  Building2,
  HardHat,
  ChevronRight,
  UserCheck,
  AlertCircle,
  Loader2,
  Mail,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { loginWithGoogle, loginAsOfficial } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  // ONLY TWO ROLES:
  // 1. Boss (Supervisor / Manager who assigns tasks & tracks work)
  // 2. On-Site Worker (Field engineer / technician who works on site & submits photo proof)
  const [selectedAdminType, setSelectedAdminType] = useState<'boss' | 'worker'>('boss');

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const adminProfiles = {
    boss: {
      role: 'department_admin' as UserRole,
      title: 'Supervisor (Boss)',
      tag: 'Task Dispatcher & Tracker',
      summary: 'Assigns tasks to on-site workers, sets deadlines & monitors work progress.',
      name: 'Er. Rajesh Patil',
      email: 'supervisor.patil@civicbridge.gov.in',
      department: 'Central Municipal Ward Operations',
      icon: Building2,
      accentBorder: 'border-amber-500 bg-amber-500/10 text-amber-400',
      badgeClass: 'bg-amber-400 text-slate-950',
    },
    worker: {
      role: 'officer' as UserRole,
      title: 'On-Site Worker',
      tag: 'Ground Field Crew',
      summary: 'Fixes issues on site, completes repairs & uploads photographic proof.',
      name: 'Milind Salvi',
      email: 'worker.salvi@civicbridge.gov.in',
      department: 'Municipal Road & Civil Repair Crew',
      icon: HardHat,
      accentBorder: 'border-sky-400 bg-sky-500/10 text-sky-400',
      badgeClass: 'bg-sky-400 text-slate-950',
    },
  };

  const currentProfile = adminProfiles[selectedAdminType];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await loginAsOfficial(
        currentProfile.role,
        currentProfile.email,
        currentProfile.name
      );
      showToast(
        'success',
        `Welcome, ${user.name}`,
        selectedAdminType === 'boss'
          ? 'Signed in as Municipal Supervisor (Task Manager).'
          : 'Signed in as On-Site Field Worker.'
      );
      navigate(selectedAdminType === 'boss' ? '/admin' : '/admin/assignments');
    } catch (err: any) {
      console.error('Official login error:', err);
      setErrorMessage(err?.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAdminSignIn = async () => {
    setIsLoadingGoogle(true);
    setErrorMessage(null);

    try {
      const user = await loginWithGoogle(currentProfile.role);
      showToast(
        'success',
        'Official Account Verified',
        `Authorized as ${user.name} (${selectedAdminType === 'boss' ? 'Supervisor' : 'On-Site Worker'})`
      );
      navigate(selectedAdminType === 'boss' ? '/admin' : '/admin/assignments');
    } catch (err: any) {
      console.error('Google Admin Sign-in error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Sign-in cancelled.');
      } else {
        setErrorMessage(err?.message || 'Failed to authenticate.');
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-xl mx-auto shadow-lg shadow-amber-500/20 font-serif">
          CB
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          CivicBridge Portal
        </h1>
        <p className="text-xs text-amber-400 font-semibold tracking-wide">
          Choose your role to continue
        </p>
      </div>

      {/* Main Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800/90 py-7 px-5 sm:px-8 shadow-2xl rounded-2xl space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Simple 2-Role Selection (Boss vs On-Site Worker) */}
          <div className="space-y-2.5">
            <span className="block text-xs font-bold text-slate-300">
              Select who you are:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Card 1: The Boss */}
              <button
                type="button"
                onClick={() => setSelectedAdminType('boss')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                  selectedAdminType === 'boss'
                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedAdminType === 'boss'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  {selectedAdminType === 'boss' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                      Active
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1">
                    <span>Supervisor</span>
                    <span className="text-amber-400 text-xs font-semibold">(The Boss)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Assigns tasks & tracks field work
                  </p>
                </div>
              </button>

              {/* Card 2: The On-Site Worker */}
              <button
                type="button"
                onClick={() => setSelectedAdminType('worker')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                  selectedAdminType === 'worker'
                    ? 'border-sky-400 bg-sky-500/10 ring-2 ring-sky-500/40 shadow-lg shadow-sky-500/5'
                    : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedAdminType === 'worker'
                        ? 'bg-sky-400 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <HardHat className="w-4 h-4" />
                  </div>
                  {selectedAdminType === 'worker' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-400 text-slate-950">
                      Active
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1">
                    <span>On-Site Worker</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Fixes issues & uploads photo proof
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Selected Role Quick Summary Pill */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              selectedAdminType === 'boss'
                ? 'border-amber-500/30 bg-amber-500/5 text-amber-200'
                : 'border-sky-500/30 bg-sky-500/5 text-sky-200'
            }`}
          >
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Signing in as:
              </span>
              <strong className="text-white text-xs block">{currentProfile.name}</strong>
              <span className="text-[11px] text-slate-400">{currentProfile.email}</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${currentProfile.badgeClass}`}
            >
              {selectedAdminType === 'boss' ? 'Supervisor' : 'Field Crew'}
            </span>
          </div>

          {/* Direct Sign-In CTA */}
          <form onSubmit={handleLogin} className="space-y-3">
            <button
              type="submit"
              disabled={isLoading || isLoadingGoogle}
              className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                selectedAdminType === 'boss'
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-sky-400 hover:bg-sky-300 text-slate-950 shadow-sky-500/20'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              <span>
                Enter as {selectedAdminType === 'boss' ? 'Supervisor (Boss)' : 'On-Site Worker'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleAdminSignIn}
              disabled={isLoading || isLoadingGoogle}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-slate-200 font-medium text-xs flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoadingGoogle ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
              <span>Or sign in with Google</span>
            </button>
          </form>

          {/* Footer Back Link */}
          <div className="pt-3 text-center border-t border-slate-800 text-xs">
            <Link
              to="/login"
              className="text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1"
            >
              <span>&larr; Switch to Citizen Portal</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
