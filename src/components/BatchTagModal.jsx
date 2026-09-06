import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getTodayFormatted } from '../utils/helpers';
import { 
  X, 
  CheckCircle2, 
  Send, 
  Calendar, 
  Mail, 
  Layers, 
  FileText, 
  AlertCircle,
  Sparkles,
  ClipboardList
} from 'lucide-react';

export default function BatchTagModal({ isOpen, onClose }) {
  const { currentWorkspace, applyBatchSentStatus } = useWorkspace();

  const [rawEmails, setRawEmails] = useState('');
  const [sequenceKey, setSequenceKey] = useState('email2'); // 'email1', 'email2', 'email3'
  const [customDate, setCustomDate] = useState('05/09/26'); // Defaults to yesterday
  const [senderAccount, setSenderAccount] = useState(
    currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || 'hello@crewlixglobal.com'
  );
  const [isApplying, setIsApplying] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);

  const leads = currentWorkspace?.leads || [];

  // Parse pasted emails (handles Google Sheet column copy-paste, commas, newlines)
  const parsedEmails = useMemo(() => {
    if (!rawEmails.trim()) return [];
    const lines = rawEmails.split(/[\r\n,;\t]+/);
    const emails = [];
    const seen = new Set();

    lines.forEach(line => {
      const trimmed = line.trim().toLowerCase();
      // Basic email pattern extraction
      const match = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (match && !seen.has(match[0])) {
        seen.add(match[0]);
        emails.push(match[0]);
      }
    });

    return emails;
  }, [rawEmails]);

  // Match with existing leads in current workspace
  const matchedLeads = useMemo(() => {
    if (parsedEmails.length === 0) return [];
    const emailSet = new Set(parsedEmails);
    return leads.filter(l => l.email && emailSet.has(l.email.trim().toLowerCase()));
  }, [parsedEmails, leads]);

  if (!isOpen) return null;

  const handleApply = async () => {
    if (matchedLeads.length === 0) return;

    setIsApplying(true);
    const matchedIds = matchedLeads.map(l => l.id);

    try {
      const ok = applyBatchSentStatus(
        matchedIds,
        sequenceKey,
        customDate,
        senderAccount,
        currentWorkspace?.campaignName
      );

      if (ok) {
        setResultMsg(`✓ Successfully applied "Email Sent - ${customDate}" to all ${matchedIds.length} leads!`);
        setTimeout(() => {
          setResultMsg(null);
          onClose();
        }, 3000);
      }
    } catch (err) {
      console.error('Batch tag error:', err);
    } finally {
      setIsApplying(false);
    }
  };

  const sequenceLabels = {
    email1: 'Email 1 (Initial Outreach)',
    email2: 'Email 2 (Follow-up 1)',
    email3: 'Email 3 (Follow-up 2)'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-xl my-8 bg-[#111827] border border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0A0A0A] border-b border-[#1E3A5F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Quick Re-Tag Leads from Google Sheet
              </h2>
              <p className="text-xs text-[#7B7B7B]">
                Paste the column of sent emails from yesterday's Google Sheet to re-apply follow-up sent tags in 1 click.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1E3A5F] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {resultMsg && (
            <div className="p-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/40 text-[#00E5A0] text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{resultMsg}</span>
            </div>
          )}

          {/* Paste Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#00C2FF]" />
                Paste Emails from Google Sheet (Column A):
              </label>
              <span className="text-[11px] font-mono text-[#00C2FF]">
                {parsedEmails.length} emails detected
              </span>
            </div>
            <textarea
              rows={5}
              value={rawEmails}
              onChange={(e) => setRawEmails(e.target.value)}
              placeholder="Paste email column from Google Sheet here (Ctrl + V)...&#10;john@example.com&#10;sarah@company.co.uk&#10;..."
              className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#00C2FF] resize-none"
            />
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Sequence */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">
                Sequence Touch:
              </label>
              <select
                value={sequenceKey}
                onChange={(e) => setSequenceKey(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              >
                <option value="email2">Email 2 (Follow-up 1)</option>
                <option value="email3">Email 3 (Follow-up 2)</option>
                <option value="email1">Email 1 (Initial Outreach)</option>
              </select>
            </div>

            {/* Sent Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#F97316]" />
                Sent Date Tag:
              </label>
              <input
                type="text"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                placeholder="DD/MM/YY"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#F97316]"
              />
            </div>

            {/* Sender Account */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                <Mail className="w-3 h-3 text-[#00E5A0]" />
                Sending Account:
              </label>
              <input
                type="text"
                value={senderAccount}
                onChange={(e) => setSenderAccount(e.target.value)}
                placeholder="sender@domain.com"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#00E5A0]"
              />
            </div>
          </div>

          {/* Match Summary Badge */}
          {parsedEmails.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between">
              <div className="text-xs text-gray-300">
                Found <strong className="text-[#00E5A0] font-mono">{matchedLeads.length}</strong> matching leads in <strong className="text-white">{currentWorkspace?.name}</strong> out of <strong className="text-[#00C2FF] font-mono">{parsedEmails.length}</strong> pasted.
              </div>
              <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30">
                Tag: "Email Sent - {customDate}"
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={matchedLeads.length === 0 || isApplying}
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/90 text-[#0A0A0A] text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#00E5A0]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              <span>{isApplying ? 'Applying...' : `Apply Tags to ${matchedLeads.length} Leads`}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
