import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getTodayFormatted } from '../utils/helpers';
import { 
  Copy, 
  Send, 
  Check, 
  Sparkles, 
  Layers, 
  Filter, 
  Calendar, 
  Mail, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Info,
  RefreshCw,
  Clock,
  Target,
  FolderOpen
} from 'lucide-react';

export default function MailMergeDispatcher() {
  const { 
    currentWorkspace, 
    copyBatchForMailMerge, 
    applyBatchSentStatus 
  } = useWorkspace();

  const [activeSequence, setActiveSequence] = useState('email1'); // 'email1', 'email2', 'email3'
  const [filterMode, setFilterMode] = useState('pending'); // 'pending', 'all'
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [customCampaignInput, setCustomCampaignInput] = useState('');
  const [batchCount, setBatchCount] = useState(25);
  const [customDate, setCustomDate] = useState(getTodayFormatted());
  const [selectedAccount, setSelectedAccount] = useState(
    currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || 'hello@crewlixglobal.com'
  );
  
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyDetails, setCopyDetails] = useState(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [manualSelection, setManualSelection] = useState([]);

  const leads = currentWorkspace?.leads || [];

  // Extract unique campaign names
  const existingCampaigns = useMemo(() => {
    const set = new Set();
    if (currentWorkspace?.campaignName) set.add(currentWorkspace.campaignName);
    leads.forEach(l => {
      if (l.campaignName && l.campaignName.trim()) set.add(l.campaignName.trim());
    });
    return Array.from(set);
  }, [leads, currentWorkspace]);

  // Filter leads based on sequence, campaign, and status
  const eligibleLeads = useMemo(() => {
    return leads.filter(l => {
      // Campaign filter
      if (selectedCampaign !== 'all') {
        const leadCamp = l.campaignName || currentWorkspace?.campaignName || 'General Outbound';
        if (leadCamp !== selectedCampaign) return false;
      }

      // Sequence status filter
      if (filterMode === 'pending') {
        if (activeSequence === 'email1') {
          return !l.email1 || l.email1.trim() === '';
        }
        if (activeSequence === 'email2') {
          return l.email1 && l.email1.trim() !== '' && (!l.email2 || l.email2.trim() === '');
        }
        if (activeSequence === 'email3') {
          return l.email2 && l.email2.trim() !== '' && (!l.email3 || l.email3.trim() === '');
        }
      }
      return true;
    });
  }, [leads, activeSequence, filterMode, selectedCampaign, currentWorkspace]);

  // Selected batch leads (either manually selected or top N of eligible)
  const batchLeads = useMemo(() => {
    if (manualSelection.length > 0) {
      return eligibleLeads.filter(l => manualSelection.includes(l.id));
    }
    const count = Math.min(Number(batchCount) || 0, eligibleLeads.length);
    return eligibleLeads.slice(0, count);
  }, [eligibleLeads, batchCount, manualSelection]);

  const selectedIds = batchLeads.map(l => l.id);

  // Handle Quick Batch Copy
  const handleCopyForSheets = async () => {
    if (selectedIds.length === 0) return;
    const res = await copyBatchForMailMerge(selectedIds, false);
    if (res.success) {
      setCopySuccess(true);
      setCopyDetails(res);
      setTimeout(() => setCopySuccess(false), 3500);
    }
  };

  // Handle Auto-Apply Sent Status
  const handleApplySentStatus = () => {
    if (selectedIds.length === 0) return;
    const campaignToApply = customCampaignInput.trim() || (selectedCampaign !== 'all' ? selectedCampaign : currentWorkspace?.campaignName) || 'General Outbound';
    const ok = applyBatchSentStatus(selectedIds, activeSequence, customDate, selectedAccount, campaignToApply);
    if (ok) {
      setAppliedCount(selectedIds.length);
      setApplySuccess(true);
      setManualSelection([]);
      setTimeout(() => setApplySuccess(false), 4000);
    }
  };

  const sequenceLabels = {
    email1: 'Email 1 (Initial Outreach)',
    email2: 'Email 2 (Follow-up 1)',
    email3: 'Email 3 (Follow-up 2)'
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: 2-Step Mail Merge Command Center */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E3A5F] relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 uppercase tracking-widest">
                Mail Merge Fast Dispatcher
              </span>
              <span className="text-xs text-[#7B7B7B] font-mono">
                Workspace: <strong className="text-white">{currentWorkspace?.name}</strong>
              </span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Google Mail Merge Batch Dispatcher
            </h2>
            <p className="text-xs text-[#7B7B7B] mt-1 max-w-2xl leading-relaxed">
              1) Select sequence & batch count → 2) Click <strong>"Copy 4 Columns for Mail Merge"</strong> and paste into your Google Sheet row 2 → 3) Click <strong>"Auto-Apply Sent Status"</strong> to automatically mark leads with <code>Email Sent - {customDate}</code> and update client campaign telemetry.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-[#0A0A0A] p-3 rounded-xl border border-[#1E3A5F]">
            <div className="text-center px-3 border-r border-[#1E3A5F]">
              <span className="text-[10px] uppercase text-[#7B7B7B] font-semibold block">Eligible Pool</span>
              <span className="text-lg font-bold text-[#00E5A0] font-mono">{eligibleLeads.length}</span>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] uppercase text-[#7B7B7B] font-semibold block">Batch Selected</span>
              <span className="text-lg font-bold text-[#00C2FF] font-mono">{selectedIds.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT CONFIGURATION PANEL (Col 1-5) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* STEP 1: Select Sequence Step & Campaign */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <span className="text-xs font-bold text-[#00C2FF] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" />
                1. Select Sequence & Campaign
              </span>
            </div>

            {/* Sequence Selector Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'email1', label: 'Email 1', sub: 'Initial Outreach' },
                { id: 'email2', label: 'Email 2', sub: 'Follow-Up 1' },
                { id: 'email3', label: 'Email 3', sub: 'Follow-Up 2' }
              ].map(seq => (
                <button
                  key={seq.id}
                  onClick={() => {
                    setActiveSequence(seq.id);
                    setManualSelection([]);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    activeSequence === seq.id
                      ? 'bg-[#00C2FF]/10 border-[#00C2FF] text-white shadow-md'
                      : 'bg-[#0A0A0A] border-[#1E3A5F] text-[#7B7B7B] hover:text-white hover:border-[#1E3A5F]/80'
                  }`}
                >
                  <div className="text-xs font-bold">{seq.label}</div>
                  <div className="text-[10px] text-[#7B7B7B] truncate">{seq.sub}</div>
                </button>
              ))}
            </div>

            {/* Campaign Name Filter & Tagging */}
            <div className="pt-2 border-t border-[#1E3A5F]/60 space-y-2">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Target Campaign Name
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                >
                  <option value="all">All Campaigns ({leads.length} leads)</option>
                  {existingCampaigns.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={customCampaignInput}
                  onChange={(e) => setCustomCampaignInput(e.target.value)}
                  placeholder="Or custom: e.g. Care Campaign"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF] placeholder:text-[#7B7B7B]/60"
                />
              </div>
              <p className="text-[10px] text-[#7B7B7B]">
                Leads dispatched will be tagged with this campaign name so the client sees <strong>"{customCampaignInput || (selectedCampaign !== 'all' ? selectedCampaign : currentWorkspace?.campaignName) || 'Care Campaign'} Follow Up Sent: {selectedIds.length}"</strong> on their dashboard.
              </p>
            </div>

            {/* Batch Size Selector */}
            <div className="pt-2 border-t border-[#1E3A5F]/60 space-y-2">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Batch Size to Dispatch
              </label>
              
              <div className="flex items-center gap-2">
                {[10, 25, 50, 100].map(cnt => (
                  <button
                    key={cnt}
                    onClick={() => {
                      setBatchCount(cnt);
                      setManualSelection([]);
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                      batchCount === cnt && manualSelection.length === 0
                        ? 'bg-[#00E5A0] text-[#0A0A0A] border-[#00E5A0]'
                        : 'bg-[#0A0A0A] text-gray-300 border-[#1E3A5F] hover:border-[#00E5A0]'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setBatchCount(eligibleLeads.length);
                    setManualSelection([]);
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                    batchCount === eligibleLeads.length && manualSelection.length === 0
                      ? 'bg-[#00E5A0] text-[#0A0A0A] border-[#00E5A0]'
                      : 'bg-[#0A0A0A] text-gray-300 border-[#1E3A5F] hover:border-[#00E5A0]'
                  }`}
                >
                  All ({eligibleLeads.length})
                </button>
              </div>
            </div>

            {/* Date & Account Settings */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1E3A5F]/60">
              <div>
                <label className="block text-[11px] text-[#7B7B7B] uppercase mb-1">Status Date</label>
                <input
                  type="text"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  placeholder="DD/MM/YY"
                  className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-lg text-white font-mono text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#7B7B7B] uppercase mb-1">Sending Account</label>
                <input
                  type="email"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  placeholder="hello@domain.com"
                  className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-lg text-white font-mono text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>
            </div>

          </div>

          {/* STEP 2: DISPATCH ACTIONS BUTTONS */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] space-y-3 shadow-xl">
            <span className="text-xs font-bold text-[#00E5A0] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              2. Execute Batch Dispatch
            </span>

            {/* ACTION 1: COPY TSV FOR GOOGLE SHEETS */}
            <button
              onClick={handleCopyForSheets}
              disabled={selectedIds.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#00C2FF]/20 active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 text-[#0A0A0A]" />
                  <span>Copied {selectedIds.length} Leads to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#0A0A0A]" />
                  <span>📋 Copy 4 Columns for Mail Merge ({selectedIds.length} Leads)</span>
                </>
              )}
            </button>

            {/* ACTION 2: AUTO-APPLY SENT STATUS */}
            <button
              onClick={handleApplySentStatus}
              disabled={selectedIds.length === 0}
              className="w-full py-3 px-4 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/90 text-[#0A0A0A] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#00E5A0]/20 active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {applySuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#0A0A0A]" />
                  <span>Applied "Email Sent - {customDate}" to {appliedCount} Leads!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#0A0A0A]" />
                  <span>⚡ Auto-Apply Sent Status ({sequenceLabels[activeSequence].split(' ')[0]})</span>
                </>
              )}
            </button>
            
            <p className="text-[10px] text-[#7B7B7B] text-center">
              Copies <code>Email Address | First Name | City | Company Name</code> ready for instant Google Sheets paste.
            </p>
          </div>

        </div>

        {/* RIGHT PREVIEW TABLE (Col 6-12) */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl bg-[#111827] border border-[#1E3A5F] p-5 shadow-xl flex flex-col h-full">
            
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1E3A5F]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Batch Preview ({batchLeads.length} Selected)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1E3A5F] text-[#00C2FF]">
                    {sequenceLabels[activeSequence]}
                  </span>
                </h3>
                <p className="text-[11px] text-[#7B7B7B]">
                  Live inspection of columns that will be copied to your clipboard
                </p>
              </div>

              <div className="text-xs text-[#00E5A0] font-mono font-bold">
                {batchLeads.length} / {eligibleLeads.length} leads
              </div>
            </div>

            {/* Leads Table Container */}
            <div className="flex-1 overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0A0A0A] text-[#7B7B7B] uppercase font-mono border-b border-[#1E3A5F] sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-[#00C2FF]">Email Address</th>
                    <th className="py-2 px-3 text-white">First Name</th>
                    <th className="py-2 px-3 text-white">City</th>
                    <th className="py-2 px-3 text-white">Company Name</th>
                    <th className="py-2 px-3 text-gray-400">Campaign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3A5F]/50 font-mono text-[11px]">
                  {batchLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[#7B7B7B] font-sans">
                        No leads available for {sequenceLabels[activeSequence]}. Import leads or switch sequence step.
                      </td>
                    </tr>
                  ) : (
                    batchLeads.map((lead, idx) => (
                      <tr key={lead.id} className="hover:bg-[#1E3A5F]/20 transition-colors">
                        <td className="py-2 px-3 text-[#00C2FF] font-medium truncate max-w-[180px]">
                          {lead.email}
                        </td>
                        <td className="py-2 px-3 text-white">
                          {lead.firstName || '—'}
                        </td>
                        <td className="py-2 px-3 text-[#7B7B7B]">
                          {lead.city || '—'}
                        </td>
                        <td className="py-2 px-3 text-gray-300 truncate max-w-[150px]">
                          {lead.companyName || '—'}
                        </td>
                        <td className="py-2 px-3 text-[#7B7B7B] truncate">
                          {lead.campaignName || currentWorkspace?.campaignName || 'General'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
