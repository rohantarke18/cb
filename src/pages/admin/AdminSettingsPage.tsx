import React from 'react';
import { Settings, Shield, Bell, Lock, Globe, Clock } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Administrative & System Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure SLA thresholds, automated triage rules, and role permissions.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>SLA Target Deadlines (Hours)</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Critical Priority</label>
              <input type="number" defaultValue={24} className="w-full p-2 border rounded bg-slate-50 font-mono" />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">High Priority</label>
              <input type="number" defaultValue={48} className="w-full p-2 border rounded bg-slate-50 font-mono" />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Medium Priority</label>
              <input type="number" defaultValue={96} className="w-full p-2 border rounded bg-slate-50 font-mono" />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Low Priority</label>
              <input type="number" defaultValue={168} className="w-full p-2 border rounded bg-slate-50 font-mono" />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Citizen Verification Safeguards</span>
          </h2>
          <div className="space-y-3 mt-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-blue-600" />
              <span className="text-slate-800">Enforce mandatory completion photos before allowing officer resolution submission.</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-blue-600" />
              <span className="text-slate-800">Auto-reopen case if citizen dispute is lodged within 7 calendar days.</span>
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
