import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  X, 
  Database, 
  Cloud, 
  Check, 
  Copy, 
  ShieldCheck, 
  RefreshCw, 
  Sparkles, 
  Server, 
  Download, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  KeyRound, 
  Layers, 
  ExternalLink,
  AlertTriangle 
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  getSupabaseClient, 
  isCloudDatabaseConnected, 
  saveWorkspacesToCloud, 
  fetchWorkspacesFromCloud, 
  getLastCloudError 
} from '../services/db';
import {
  getGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  testGoogleSheetsConnection,
  pushAllToGoogleSheet,
  isGoogleSheetsConfigured,
  getPendingSyncQueue,
  clearPendingSyncQueue,
  GOOGLE_APPS_SCRIPT_CODE
} from '../services/googleSheetsService';

export default function CloudSyncModal({ isOpen, onClose, initialTab = 'supabase' }) {
  const { 
    workspaces, 
    warriors,
    currentWorkspace, 
    restorePreviousBackup, 
    forceSyncFromCloud,
    sheetsSyncStatus,
    pendingSheetsChangesCount,
    refreshSheetsStatus,
    saveSheetsConfigGlobally
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState(initialTab); // 'supabase' | 'sheets'

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // Supabase state
  const existingConfig = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(existingConfig.url || '');
  const [supabaseKey, setSupabaseKey] = useState(existingConfig.key || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Google Sheets state
  const existingSheetsConfig = getGoogleSheetsConfig();
  const [sheetsUrl, setSheetsUrl] = useState(existingSheetsConfig.url || '');
  const [sheetsToken, setSheetsToken] = useState(existingSheetsConfig.token || 'ROS_SHEET_SECRET_2026');
  const [isTestingSheets, setIsTestingSheets] = useState(false);
  const [isPushingAllSheets, setIsPushingAllSheets] = useState(false);
  const [sheetsProgress, setSheetsProgress] = useState('');
  const [sheetsMessage, setSheetsMessage] = useState('');
  const [sheetsError, setSheetsError] = useState('');
  const [copiedGasCode, setCopiedGasCode] = useState(false);

  if (!isOpen) return null;

  const isConnected = isCloudDatabaseConnected();
  const isSheetsConnected = isGoogleSheetsConfigured();

  // Supabase actions
  const handleRestoreSession = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    const res = await restorePreviousBackup();
    setIsSaving(false);
    if (res.success) {
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(''), 4000);
    } else {
      setErrorMessage(res.message || 'No previous session backup found.');
    }
  };

  const handleForcePullCloud = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    const res = await forceSyncFromCloud(currentWorkspace?.id);
    setIsSaving(false);
    if (res.success) {
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(''), 5000);
    } else {
      setErrorMessage(res.message || 'Failed to pull cloud database.');
    }
  };

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

    if (!supabaseKey.trim().startsWith('eyJ')) {
      setErrorMessage('Invalid Supabase Anon Key. Anon keys must be a JWT starting with "eyJ...". Make sure you did not autofill a password.');
      return;
    }

    setIsSaving(true);
    saveSupabaseConfig(supabaseUrl, supabaseKey);

    try {
      const ok = await saveWorkspacesToCloud(workspaces);
      if (ok) {
        setStatusMessage(`Successfully connected to Supabase! Uploaded ${workspaces.length} workspace(s) and ${workspaces.reduce((acc, w) => acc + (w.leads?.length || 0), 0)} leads to the cloud database.`);
      } else {
        const err = getLastCloudError();
        setErrorMessage(err ? `Supabase sync error: ${err}` : 'Supabase credentials saved. Please make sure you ran the SQL Table Setup in Supabase.');
      }
    } catch (err) {
      setErrorMessage(`Connection error: ${err.message || 'Please check your Supabase URL, Key, and SQL Table.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSyncNow = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    const targetId = currentWorkspace?.id;
    const ok = await saveWorkspacesToCloud(workspaces, targetId);
    setIsSaving(false);
    if (ok) {
      setStatusMessage(`All leads for ${currentWorkspace?.name || 'workspace'} (${currentWorkspace?.leads?.length || 0} leads) are synchronized with Supabase!`);
      setTimeout(() => setStatusMessage(''), 4000);
    } else {
      const err = getLastCloudError();
      setErrorMessage(err ? `Cloud sync failed: ${err}` : 'Cloud sync failed. Make sure Supabase is connected and the SQL table is created.');
    }
  };

  // Google Sheets Actions
  const handleCopyGasCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedGasCode(true);
    setTimeout(() => setCopiedGasCode(false), 3000);
  };

  const handleSaveSheetsConfig = async (e) => {
    if (e) e.preventDefault();
    setSheetsMessage('');
    setSheetsError('');

    if (!sheetsUrl.trim()) {
      setSheetsError('Please enter your Google Apps Script Web App URL.');
      return;
    }

    if (!sheetsUrl.includes('script.google.com')) {
      setSheetsError('Invalid Web App URL. It must be a Google Apps Script URL starting with "https://script.google.com/macros/s/.../exec"');
      return;
    }

    const sharedOk = await saveSheetsConfigGlobally(sheetsUrl.trim(), sheetsToken.trim());
    if (sharedOk) {
      setSheetsMessage('Google Sheets configuration saved and applied to all Admin, Warrior & Client portals.');
    } else {
      setSheetsError('Saved on this device only — could not publish to the cloud, so other portals will not pick it up yet. Check the Supabase connection and save again.');
    }
    if (refreshSheetsStatus) refreshSheetsStatus();
    setTimeout(() => setSheetsMessage(''), 4000);
  };

  const handleTestSheetsConnection = async () => {
    if (!sheetsUrl.trim()) {
      setSheetsError('Please enter your Google Apps Script Web App URL before testing.');
      return;
    }

    setIsTestingSheets(true);
    setSheetsMessage('');
    setSheetsError('');

    try {
      const res = await testGoogleSheetsConnection(sheetsUrl.trim(), sheetsToken.trim());
      if (res.success) {
        await saveSheetsConfigGlobally(sheetsUrl.trim(), sheetsToken.trim());
        setSheetsMessage(res.message);
        if (refreshSheetsStatus) refreshSheetsStatus();
      } else {
        setSheetsError(res.message || 'Connection failed.');
      }
    } catch (err) {
      setSheetsError(`Test error: ${err.message}`);
    } finally {
      setIsTestingSheets(false);
    }
  };

  const handlePushAllToSheets = async () => {
    if (!sheetsUrl.trim()) {
      setSheetsError('Please enter and save your Google Apps Script Web App URL first.');
      return;
    }

    setIsPushingAllSheets(true);
    setSheetsProgress('Starting dual-cloud sync...');
    setSheetsMessage('');
    setSheetsError('');

    try {
      await saveSheetsConfigGlobally(sheetsUrl.trim(), sheetsToken.trim());
      const res = await pushAllToGoogleSheet(workspaces, warriors, (prog) => {
        setSheetsProgress(prog);
      });

      if (res.success) {
        setSheetsMessage(res.message);
        if (refreshSheetsStatus) refreshSheetsStatus();
      } else {
        setSheetsError(res.message || 'Failed to push all data to Google Sheets.');
      }
    } catch (err) {
      setSheetsError(`Push failed: ${err.message}`);
    } finally {
      setIsPushingAllSheets(false);
      setSheetsProgress('');
    }
  };

  const handleClearSheetsQueue = () => {
    clearPendingSyncQueue();
    if (refreshSheetsStatus) refreshSheetsStatus();
    setSheetsMessage('Pending sync queue cleared.');
    setTimeout(() => setSheetsMessage(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className="p-2.5 rounded-xl bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Dual-Cloud Database & Redundancy Settings</h3>
            <p className="text-xs text-[#7B7B7B]">
              Real-time synchronization between Supabase PostgreSQL and Google Sheets.
            </p>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex border-b border-[#1E3A5F] mb-5 gap-2">
          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'supabase'
                ? 'bg-[#1E3A5F]/40 text-[#00C2FF] border-[#00C2FF]'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Primary: Supabase Cloud</span>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00E5A0]' : 'bg-gray-500'}`} />
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 relative ${
              activeTab === 'sheets'
                ? 'bg-[#1E3A5F]/40 text-[#00E5A0] border-[#00E5A0]'
                : 'text-gray-400 hover:text-white border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Secondary: Google Sheets (Redundant)</span>
            <span className={`w-2 h-2 rounded-full ${isSheetsConnected ? 'bg-[#00E5A0]' : 'bg-amber-400'}`} />
            {pendingSheetsChangesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
                {pendingSheetsChangesCount}
              </span>
            )}
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: SUPABASE CLOUD DATABASE                                    */}
        {/* ================================================================= */}
        {activeTab === 'supabase' && (
          <div className="space-y-4">
            {statusMessage && (
              <div className="p-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* CONNECTION STATUS */}
            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleForcePullCloud}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    title="Pull authoritative data directly from Supabase Cloud"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Pull from Cloud</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleManualSyncNow}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg bg-[#00E5A0]/10 hover:bg-[#00E5A0]/20 text-[#00E5A0] border border-[#00E5A0]/30 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  >
                    {isSaving ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              )}
            </div>

            {/* DURABLE LOCAL DATABASE (INDEXEDDB) */}
            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#00C2FF]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span>Durable Local Database (IndexedDB)</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] font-mono">
                    Active & Unlimited
                  </span>
                </div>
                <div className="text-[11px] text-[#7B7B7B] mt-0.5">
                  Protects up to 50,000+ leads and prevents browser refreshes from wiping your work.
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestoreSession}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
              >
                ↺ Check / Restore Backup
              </button>
            </div>

            {/* CONFIG FORM */}
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
                    autoComplete="new-password"
                    spellCheck={false}
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
            <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex flex-wrap items-center justify-between gap-3 text-xs">
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
        )}

        {/* ================================================================= */}
        {/* TAB 2: GOOGLE SHEETS LIVE REDUNDANCY & FAILOVER ENGINE            */}
        {/* ================================================================= */}
        {activeTab === 'sheets' && (
          <div className="space-y-4">
            
            {/* Feedback Notifications */}
            {sheetsMessage && (
              <div className="p-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{sheetsMessage}</span>
              </div>
            )}

            {sheetsError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sheetsError}</span>
              </div>
            )}

            {sheetsProgress && (
              <div className="p-3 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-[#00C2FF] text-xs flex items-center gap-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>{sheetsProgress}</span>
              </div>
            )}

            {/* STATUS CARD */}
            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-3.5 h-3.5 rounded-full ${
                  isSheetsConnected 
                    ? (pendingSheetsChangesCount > 0 ? 'bg-amber-400 animate-pulse' : 'bg-[#00E5A0] shadow-lg shadow-[#00E5A0]/40') 
                    : 'bg-gray-500'
                }`} />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>
                      {isSheetsConnected 
                        ? (pendingSheetsChangesCount > 0 ? '⚠️ Google Sheet Out of Sync' : '🟢 Google Sheet Dual-Cloud Synced') 
                        : '⚪ Google Sheet Redundancy Pending'}
                    </span>
                    {pendingSheetsChangesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono">
                        {pendingSheetsChangesCount} changes queued
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#7B7B7B] mt-0.5">
                    {isSheetsConnected 
                      ? 'Every update automatically updates your Google Sheet tabs. If Supabase fails, data pulls instantly from here.'
                      : 'Deploy the Google Apps Script Web App below to enable transparent secondary cloud backup.'}
                  </div>
                </div>
              </div>

              {pendingSheetsChangesCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearSheetsQueue}
                  className="px-2.5 py-1 text-[10px] text-gray-400 hover:text-white border border-[#1E3A5F] hover:bg-[#1E3A5F]/40 rounded-lg transition"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {/* QUICK SETUP GUIDE & COPY SCRIPT */}
            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#00E5A0]/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#00E5A0] uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>1. Setup Google Sheet Web App (2 Minutes)</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyGasCode}
                  className="px-2.5 py-1 rounded-lg bg-[#00E5A0]/10 hover:bg-[#00E5A0]/20 text-[#00E5A0] text-xs font-bold border border-[#00E5A0]/30 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedGasCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedGasCode ? 'Copied Apps Script!' : '📋 Copy Apps Script Code'}</span>
                </button>
              </div>

              <ol className="text-xs text-gray-300 space-y-1.5 list-decimal pl-4 leading-relaxed font-sans">
                <li>Create a Google Sheet (e.g. named <strong>"ROS Campaign Master Database"</strong>).</li>
                <li>In Google Sheet, click <strong>Extensions &gt; Apps Script</strong>.</li>
                <li>Delete any default code, paste the copied code from the button above, and click <strong>Save</strong>.</li>
                <li>Click <strong>Deploy &gt; New deployment</strong>. Select <strong>Web app</strong> (gear icon).</li>
                <li>Set <strong>Execute as: "Me"</strong> and <strong>Who has access: "Anyone"</strong>. Click <strong>Deploy</strong> and copy the Web App URL.</li>
              </ol>
            </div>

            {/* CONNECTION INPUT FORM */}
            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-3">
              <div className="text-xs font-bold text-[#00C2FF] uppercase tracking-wider">
                2. Connect Web App Endpoint
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                  Google Apps Script Web App URL
                </label>
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00E5A0] rounded-lg text-white text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                  Shared Secret Token
                </label>
                <input
                  type="text"
                  value={sheetsToken}
                  onChange={(e) => setSheetsToken(e.target.value)}
                  placeholder="ROS_SHEET_SECRET_2026"
                  className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00E5A0] rounded-lg text-white text-xs font-mono outline-none"
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleTestSheetsConnection}
                  disabled={isTestingSheets || isPushingAllSheets}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#111827] hover:bg-[#1E3A5F] border border-[#1E3A5F] hover:border-[#00C2FF] text-[#00C2FF] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingSheets ? 'animate-spin' : ''}`} />
                  <span>{isTestingSheets ? 'Testing Connection...' : 'Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushAllToSheets}
                  disabled={isTestingSheets || isPushingAllSheets}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#00E5A0] to-[#00C2FF] hover:opacity-90 text-black text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow cursor-pointer"
                >
                  <Upload className={`w-3.5 h-3.5 ${isPushingAllSheets ? 'animate-spin' : ''}`} />
                  <span>{isPushingAllSheets ? 'Pushing All Data...' : '⚡ Push All Workspaces to Sheet'}</span>
                </button>
              </div>
            </div>

            {/* TAB-BY-TAB SCHEMA EXPLANATION */}
            <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-[11px] text-[#7B7B7B] space-y-1">
              <div className="font-semibold text-gray-300">Automatic Sheet Tabs Created:</div>
              <div>• <strong className="text-white">_Auth_Credentials</strong>: Stores all login accounts for Admin, Warriors, and Clients.</div>
              <div>• <strong className="text-white">_Workspaces_Meta</strong>: Stores high-level metrics, active emails, and sequence settings.</div>
              <div>• <strong className="text-white">_Activity_Log</strong>: Audit history of email dispatches and notes.</div>
              <div>• <strong className="text-white">WS_[WorkspaceName]</strong>: Tab-by-tab lead rosters (e.g. <code>WS_CGE_UK_LTD</code>, <code>WS_Crewlix_UK_Ltd</code>) with 16 standardized columns.</div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
