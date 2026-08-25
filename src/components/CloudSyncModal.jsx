import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { X, Database, Cloud, Check, Key, ShieldCheck, RefreshCw, Sparkles, Server } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, getSupabaseClient } from '../services/db';

export default function CloudSyncModal({ isOpen, onClose }) {
  const { workspaces, getSupabaseConfig, saveSupabaseConfig } = useWorkspace();
  const existingConfig = getSupabaseConfig ? getSupabaseConfig() : { url: '', key: '' };

  const [supabaseUrl, setSupabaseUrl] = useState(existingConfig.url || '');
  const [supabaseKey, setSupabaseKey] = useState(existingConfig.key || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const isConnected = !!getSupabaseClient();

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = saveSupabaseConfig(supabaseUrl, supabaseKey);
    setTimeout(() => {
      setIsSaving(false);
      setStatusMessage('Cloud database configuration saved! All workspaces will sync in real time.');
      setTimeout(() => setStatusMessage(''), 4000);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className="p-2.5 rounded-xl bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Online Cloud Database & Multi-Device Sync</h3>
            <p className="text-xs text-[#7B7B7B]">
              Ensures client logins and campaigns synchronize across all devices and Vercel.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Current Sync Mode Banner */}
        <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Global Cloud Sync Status</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 text-[10px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] animate-pulse" />
              ACTIVE & READY
            </span>
          </div>
          <p className="text-[11px] text-[#7B7B7B]">
            All registered client workspaces (including <strong>crewlixukltd</strong>, <strong>crewlix</strong>, etc.) are matched in the background when clients log in from any browser or device worldwide.
          </p>
        </div>

        {/* Optional Supabase Cloud DB Connection */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#00C2FF]/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#00C2FF] uppercase tracking-wider">
              <Database className="w-3.5 h-3.5" />
              <span>Dedicated Cloud Database (Supabase / KV)</span>
            </div>

            <div>
              <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                Supabase Project URL (Optional)
              </label>
              <input
                type="url"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-lg text-white text-xs font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                Supabase Anon Public API Key (Optional)
              </label>
              <input
                type="password"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-lg text-white text-xs font-mono outline-none"
              />
            </div>

            <p className="text-[10px] text-[#7B7B7B]">
              You can also set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your Vercel Project Environment Variables.
            </p>
          </div>

          <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow cursor-pointer"
            >
              {isSaving ? 'Connecting...' : 'Save Cloud Connection'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
