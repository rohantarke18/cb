import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Shield, User, X, ChevronUp, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RoleSwitcherBanner: React.FC = () => {
  const { role, switchRoleForDemo, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const navigate = useNavigate();

  const personas: {
    key: UserRole;
    name: string;
    designation: string;
    badgeColor: string;
    description: string;
    defaultRoute: string;
  }[] = [
    {
      key: 'citizen',
      name: 'Aarav Deshmukh',
      designation: 'Citizen User',
      badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
      description: 'Reports problems, verifies photo proofs & tracks live municipal progress',
      defaultRoute: '/dashboard',
    },
    {
      key: 'department_admin',
      name: 'Er. Rajesh Patil',
      designation: 'Supervisor (The Boss)',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      description: 'Assigns tasks to on-site workers, sets deadlines, and tracks field execution',
      defaultRoute: '/admin',
    },
    {
      key: 'officer',
      name: 'Milind Salvi',
      designation: 'On-Site Worker (Field Crew)',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
      description: 'Works on site, fixes assigned problems & uploads photographic repair proof',
      defaultRoute: '/admin/assignments',
    },
  ];

  if (isDismissed) {
    return (
      <button
        type="button"
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-3 right-3 z-50 p-2 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white shadow-lg border border-slate-700 backdrop-blur transition-transform hover:scale-105 cursor-pointer"
        title="Open Persona Simulator"
      >
        <Shield className="w-4 h-4 text-amber-400" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans">
      {/* Popover Card */}
      {isOpen && (
        <div className="mb-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-100 leading-tight">
                  Prototype Persona Simulator
                </h3>
                <p className="text-[10px] text-slate-400">
                  Switch roles to test different permissions and views
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 max-h-[380px] overflow-y-auto space-y-2 divide-y divide-slate-100">
            {personas.map((p) => {
              const isCurrent = role === p.key;
              return (
                <div
                  key={p.key}
                  className={`pt-2 first:pt-0 p-2 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-blue-50/70 border border-blue-200/80 shadow-2xs'
                      : 'hover:bg-slate-50 border border-transparent cursor-pointer'
                  }`}
                  onClick={() => {
                    if (!isCurrent) {
                      switchRoleForDemo(p.key);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {p.name}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${p.badgeColor}`}
                        >
                          {p.key.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600">
                        {p.designation}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
                        {p.description}
                      </p>
                    </div>

                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                        <Check className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          switchRoleForDemo(p.key);
                        }}
                        className="text-[11px] font-semibold text-slate-700 hover:text-blue-600 px-2 py-1 rounded bg-white hover:bg-blue-50 border border-slate-200 shrink-0 transition-colors shadow-2xs"
                      >
                        Select
                      </button>
                    )}
                  </div>

                  {isCurrent && (
                    <div className="mt-2 pt-2 border-t border-blue-100/80 flex items-center justify-between text-[11px]">
                      <span className="text-blue-700 font-medium">Currently viewing as {p.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(p.defaultRoute);
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-800 hover:underline"
                      >
                        <span>Open Workspace</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>Prototype evaluation helper</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsDismissed(true);
              }}
              className="text-slate-400 hover:text-slate-600 underline text-[10px]"
            >
              Hide widget
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Pill */}
      <div className="flex items-center gap-1.5 shadow-xl rounded-full p-1 bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur border border-slate-700 transition-all">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1 text-xs cursor-pointer focus:outline-hidden"
          title="Click to switch evaluation persona"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-200 text-[11px]">
            Demo Persona: <strong className="text-white font-bold">{user?.name?.split(' ')[0] || 'Aarav'}</strong>
          </span>
          <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-700/60">
            {role.replace('_', ' ')}
          </span>
          <ChevronUp className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Dismiss widget"
          aria-label="Dismiss prototype widget"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
