import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { AlertTriangle, RefreshCw, CheckCircle2, Settings, ExternalLink, X, ShieldAlert, Sparkles, Database } from 'lucide-react';

export default function GoogleSheetsSyncBanner({ onOpenSettings }) {
  const {
    sheetsSyncStatus,
    pendingSheetsChangesCount,
    lastSheetsSyncTime,
    pushPendingToGoogleSheet,
    isGoogleSheetsConfigured,
    currentWorkspace,
    dismissSheetsAlert,
    showSheetsAlert
  } = useWorkspace();

  const [isPushing, setIsPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState('');
  const [pushError, setPushError] = useState('');

  // Only display if out of sync, has pending queue, or alert is flagged
  const isOutOfSync = sheetsSyncStatus === 'out_of_sync' || pendingSheetsChangesCount > 0;
  const isUnconfigured = !isGoogleSheetsConfigured();

  if (!isOutOfSync && !showSheetsAlert) {
    return null;
  }

  const handlePush = async () => {
    setIsPushing(true);
    setPushSuccess('');
    setPushError('');

    try {
      const res = await pushPendingToGoogleSheet();
      if (res && res.success) {
        setPushSuccess(res.message || 'Successfully synchronized with Google Sheet!');
        setTimeout(() => {
          setPushSuccess('');
          if (dismissSheetsAlert) dismissSheetsAlert();
        }, 4000);
      } else {
        setPushError(res?.message || 'Failed to push to Google Sheet. Check your Web App URL in settings.');
      }
    } catch (err) {
      setPushError(err.message || 'Failed to push to Google Sheet.');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <>
      {/* 1. STICKY HIGH-VISIBILITY ALERT BANNER */}
      <div className="w-full bg-gradient-to-r from-amber-950/80 via-[#1A1205] to-amber-950/80 border-y border-amber-500/40 px-4 sm:px-6 py-2.5 sm:py-3 shadow-lg backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          
          {/* Left: Status & Warning Message */}
          <div className="flex items-center gap-3 text-left w-full md:w-auto">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-300 text-xs sm:text-sm tracking-wide">
                  ⚠️ Google Sheet Out of Sync
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pendingSheetsChangesCount > 0 ? `${pendingSheetsChangesCount} Unsaved Change${pendingSheetsChangesCount > 1 ? 's' : ''}` : 'Pending Setup'}
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-0.5 line-clamp-1">
                {isUnconfigured 
                  ? 'Google Sheets Web App URL is not yet connected. Deploy Apps Script to enable instant secondary cloud backup.'
                  : `Recent changes in ${currentWorkspace?.name || 'workspace'} are not yet pushed to Google Sheet secondary store.`
                }
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0">
            {pushSuccess && (
              <span className="text-xs font-semibold text-[#00E5A0] flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                <span>Synced!</span>
              </span>
            )}

            {pushError && (
              <span className="text-xs text-red-400 font-medium truncate max-w-xs" title={pushError}>
                {pushError}
              </span>
            )}

            {/* PUSH BUTTON */}
            <button
              onClick={handlePush}
              disabled={isPushing}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                isPushing
                  ? 'bg-amber-500/40 text-amber-200 cursor-wait'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20 active:scale-95'
              }`}
              title="Push unsynced changes to Google Sheet now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
              <span>{isPushing ? 'Pushing to Sheet...' : '⚡ Push to Google Sheet'}</span>
            </button>

            {/* SETTINGS SHORTCUT */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111827] border border-[#1E3A5F] hover:border-amber-400/50 text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
                title="Configure Google Sheet Web App URL & Apps Script"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Sheet Settings</span>
              </button>
            )}

            {/* DISMISS BUTTON */}
            {dismissSheetsAlert && (
              <button
                onClick={dismissSheetsAlert}
                className="p-1 rounded-lg text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 transition cursor-pointer"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
