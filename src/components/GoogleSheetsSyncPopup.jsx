import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { AlertCircle, RefreshCw, CheckCircle2, X, ExternalLink, Database, ShieldAlert, ArrowRight } from 'lucide-react';

export default function GoogleSheetsSyncPopup({ isOpen, onClose, onOpenSettings }) {
  const {
    currentWorkspace,
    pendingSheetsChangesCount,
    pushPendingToGoogleSheet,
    isGoogleSheetsConfigured,
    sheetsSyncError
  } = useWorkspace();

  const [isPushing, setIsPushing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  if (!isOpen) return null;

  const handlePush = async () => {
    setIsPushing(true);
    setSuccessMsg('');
    setErrMsg('');

    try {
      const res = await pushPendingToGoogleSheet();
      if (res && res.success) {
        setSuccessMsg(res.message || 'Successfully synced data to Google Sheet!');
        setTimeout(() => {
          setSuccessMsg('');
          if (onClose) onClose();
        }, 3000);
      } else {
        setErrMsg(res?.message || 'Failed to push to Google Sheet. Check connection settings.');
      }
    } catch (err) {
      setErrMsg(err.message || 'Failed to push to Google Sheet.');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#111827] border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl shadow-amber-500/10 text-white relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1E3A5F]/40 transition"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Google Sheet Out of Sync
            </h3>
            <p className="text-xs text-amber-300/80 font-mono">
              Action Required · Secondary Store Pending
            </p>
          </div>
        </div>

        {/* Body Text */}
        <div className="bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl p-4 mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-400">
            <span>Workspace:</span>
            <span className="font-semibold text-white">{currentWorkspace?.name || 'Current Workspace'}</span>
          </div>
          <div className="flex items-center justify-between text-gray-400">
            <span>Pending Updates:</span>
            <span className="font-mono text-amber-400 font-bold">
              {pendingSheetsChangesCount > 0 ? `${pendingSheetsChangesCount} change(s)` : 'Connection issue'}
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-400">
            <span>Primary Store (Supabase):</span>
            <span className="text-[#00E5A0] font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved Securely
            </span>
          </div>
          <div className="flex items-center justify-between text-gray-400">
            <span>Secondary Store (Google Sheet):</span>
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Out of Sync
            </span>
          </div>

          {sheetsSyncError && (
            <div className="pt-2 border-t border-[#1E3A5F]/60 text-amber-300 text-[11px] leading-relaxed">
              <strong>Notice:</strong> {sheetsSyncError}
            </div>
          )}
        </div>

        {/* Success or Error Alert */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={handlePush}
            disabled={isPushing}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer ${
              isPushing
                ? 'bg-amber-500/40 text-amber-200 cursor-wait'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20 active:scale-98'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isPushing ? 'animate-spin' : ''}`} />
            <span>{isPushing ? 'Pushing Data...' : '⚡ Push to Google Sheet Now'}</span>
          </button>

          {onOpenSettings && (
            <button
              onClick={() => {
                if (onClose) onClose();
                onOpenSettings();
              }}
              className="px-3.5 py-2.5 rounded-xl bg-[#111827] border border-[#1E3A5F] hover:border-[#00C2FF] text-gray-300 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              Configure
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
