import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { X, Database, Cloud, Check, Copy, ShieldCheck, RefreshCw, Sparkles, Server, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, getSupabaseClient, isCloudDatabaseConnected, saveWorkspacesToCloud, fetchWorkspacesFromCloud } from '../services/db';

export default function CloudSyncModal({ isOpen, onClose }) {
  const { workspaces, currentWorkspace } = useWorkspace();
  const existingConfig = getSupabaseConfig();

  const [supabaseUrl, setSupabaseUrl] = useState(existingConfig.url || '');
  const [supabaseKey, setSupabaseKey] = useState(existingConfig.key || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen) return null;

  const isConnected = isCloudDatabaseConnected();

  const sqlSchema = `-- Run this once in Supabase SQL Editor:
create table if not exists workspaces (
  id text primary key,
  name text,
  client_name text,
  client_email text,
  campaign_name text,
  active_sending_account text,
  sending_accounts jsonb default '[]'::jsonb,
  client_credentials jsonb default '{}'::jsonb,
  sequence_config jsonb default '{}'::jsonb,
  activity_log jsonb default '[]'::jsonb,
  leads jsonb default '[]'::jsonb,
  created_at text,
  updated_at timestamp with time zone default now()
);

-- Enable access
alter table workspaces enable row level security;
create policy "Allow all access" on workspaces for all using (true) with check (true);`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workspaces, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ROS_Workspaces_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(workspaces, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setErrorMessage('Please enter both Supabase Project URL and Anon Public API Key.');
      return;
    }

    if (!supabaseUrl.includes('.supabase.co')) {
      setErrorMessage('Invalid Supabase URL. It should look like: https://xxxx.supabase.co');
      return;
    }

    setIsSaving(true);
    saveSupabaseConfig(supabaseUrl, supabaseKey);

    try {
      // Test saving all current workspaces and leads to Supabase
      const ok = await saveWorkspacesToCloud(workspaces);
      if (ok) {
        setStatusMessage(`Successfully connected to Supabase! Uploaded ${workspaces.length} workspace(s) and ${workspaces.reduce((acc, w) => acc + (w.leads?.length || 0), 0)} leads to the cloud database.`);
      } else {
        setStatusMessage('Supabase credentials saved. Please make sure you ran the SQL Table Setup in Supabase.');
      }
    } catch (err) {
      setErrorMessage('Connection error. Please check your Supabase URL, Key, and SQL Table.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSyncNow = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    const ok = await saveWorkspacesToCloud(workspaces);
    setIsSaving(false);
    if (ok) {
      setStatusMessage(`All ${workspaces.length} workspaces and leads are synchronized with Supabase!`);
      setTimeout(() => setStatusMessage(''), 4000);
    } else {
      setErrorMessage('Cloud sync failed. Make sure Supabase is connected and the SQL table is created.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className="p-2.5 rounded-xl bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Online Database & Multi-Device Lead Sync</h3>
            <p className="text-xs text-[#7B7B7B]">
              Connect Supabase (100% Free) so clients on any computer or phone see all your uploaded leads in real time.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CONNECTION STATUS */}
        <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-[#00E5A0] animate-pulse shadow-lg shadow-[#00E5A0]/50' : 'bg-amber-400'}`} />
            <div>
              <div className="text-xs font-bold text-white">
                {isConnected ? '🟢 Supabase Cloud Database Connected' : '🟡 Browser Storage Mode (Local Only)'}
              </div>
              <div className="text-[11px] text-[#7B7B7B]">
                {isConnected 
                  ? 'All leads and client credentials are synchronized live in Supabase PostgreSQL.' 
                  : 'Connect your free Supabase database below so clients can see your uploaded leads from their computers.'}
              </div>
            </div>
          </div>

          {isConnected && (
            <button
              onClick={handleManualSyncNow}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-[#00E5A0]/10 hover:bg-[#00E5A0]/20 text-[#00E5A0] border border-[#00E5A0]/30 text-xs font-bold transition-all cursor-pointer"
            >
              {isSaving ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>

        {/* STEP-BY-STEP SUPABASE SETUP */}
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#00C2FF]/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00C2FF] uppercase tracking-wider">
                <Cloud className="w-3.5 h-3.5" />
                <span>Supabase Cloud Connection (Free Tier)</span>
              </div>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#00C2FF] hover:underline"
              >
                Open Supabase Dashboard →
              </a>
            </div>

            <div>
              <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                1. Project URL (from Project Settings → API)
              </label>
              <input
                type="url"
                required
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xyzabcdefghijklm.supabase.co"
                className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-lg text-white text-xs font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                2. Project API Anon Key (from Project Settings → API)
              </label>
              <input
                type="password"
                required
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-lg text-white text-xs font-mono outline-none"
              />
            </div>

            {/* SQL Table Copy Tool */}
            <div className="pt-2 border-t border-[#1E3A5F]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-300 font-semibold">
                  3. SQL Setup (Paste in Supabase SQL Editor):
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-2 py-1 rounded bg-[#111827] hover:bg-[#1E3A5F] text-[#00C2FF] text-[10px] font-bold border border-[#1E3A5F] flex items-center gap-1 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-[#111827] border border-[#1E3A5F] font-mono text-[10px] text-gray-400 max-h-20 overflow-y-auto">
                create table workspaces (id text primary key, name text, leads jsonb, ...);
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow cursor-pointer mt-2"
            >
              {isSaving ? 'Connecting & Uploading Leads...' : 'Connect Supabase & Sync Leads to Cloud'}
            </button>
          </div>
        </form>

        {/* OFFLINE JSON BACKUP & RESTORE */}
        <div className="mt-4 p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-bold text-white">Offline Database Backup</div>
            <div className="text-[11px] text-[#7B7B7B]">
              Currently tracking <strong>{workspaces.reduce((acc, w) => acc + (w.leads?.length || 0), 0)}</strong> leads across {workspaces.length} workspace(s).
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-2.5 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] text-gray-300 text-xs font-semibold border border-[#1E3A5F] flex items-center gap-1 cursor-pointer"
            >
              {copiedJson ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
              <span>Copy JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] text-[#00E5A0] text-xs font-semibold border border-[#00E5A0]/30 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Backup</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
