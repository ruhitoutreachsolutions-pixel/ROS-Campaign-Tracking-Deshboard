import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getTodayFormatted, isLeadDNC, extractDateFromStatus } from '../utils/helpers';
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
  FolderOpen,
  ShieldCheck,
  Ban,
  AtSign,
  UserCheck,
  RotateCcw
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
  const [selectedSenderAccount, setSelectedSenderAccount] = useState('all');
  const [selectedPrevDate, setSelectedPrevDate] = useState('all');
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

  // Compute total DNC / Unsubscribed leads in this workspace
  const totalDncInWorkspace = useMemo(() => {
    return leads.filter(l => isLeadDNC(l)).length;
  }, [leads]);

  // Extract available Associated Sending Accounts for the active sequence stage
  const availableSenderAccounts = useMemo(() => {
    const counts = {};
    leads.forEach(l => {
      if (isLeadDNC(l)) return;

      // Check sequence eligibility
      let matches = false;
      if (activeSequence === 'email1') {
        matches = !l.email1 || l.email1.trim() === '';
      } else if (activeSequence === 'email2') {
        matches = l.email1 && l.email1.trim() !== '' && (!l.email2 || l.email2.trim() === '');
      } else if (activeSequence === 'email3') {
        matches = l.email2 && l.email2.trim() !== '' && (!l.email3 || l.email3.trim() === '');
      }

      if (matches) {
        const acc = (l.accountName || currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || 'Default Account').trim();
        counts[acc] = (counts[acc] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads, activeSequence, currentWorkspace]);

  // Extract available Initial / Previous Sent Dates for the active sequence stage
  const availablePrevDates = useMemo(() => {
    const counts = {};
    leads.forEach(l => {
      if (isLeadDNC(l)) return;

      let matches = false;
      let dateFound = null;

      if (activeSequence === 'email1') {
        matches = !l.email1 || l.email1.trim() === '';
        dateFound = l.dateAdded || 'Standard Import';
      } else if (activeSequence === 'email2') {
        matches = l.email1 && l.email1.trim() !== '' && (!l.email2 || l.email2.trim() === '');
        dateFound = extractDateFromStatus(l.email1) || 'Unknown Date';
      } else if (activeSequence === 'email3') {
        matches = l.email2 && l.email2.trim() !== '' && (!l.email3 || l.email3.trim() === '');
        dateFound = extractDateFromStatus(l.email2) || 'Unknown Date';
      }

      if (matches && dateFound) {
        counts[dateFound] = (counts[dateFound] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads, activeSequence]);

  // Filter leads based on sequence, campaign, sending account, date, and status (AUTOMATICALLY AVOIDS DNC & NOT INTERESTED)
  const { eligibleLeads, dncExcludedInSequence } = useMemo(() => {
    let dncExcluded = 0;

    const filtered = leads.filter(l => {
      // 1. Campaign filter
      if (selectedCampaign !== 'all') {
        const leadCamp = l.campaignName || currentWorkspace?.campaignName || 'General Outbound';
        if (leadCamp !== selectedCampaign) return false;
      }

      // 2. Check sequence eligibility condition
      let matchesSequence = true;
      if (filterMode === 'pending') {
        if (activeSequence === 'email1') {
          matchesSequence = !l.email1 || l.email1.trim() === '';
        } else if (activeSequence === 'email2') {
          matchesSequence = l.email1 && l.email1.trim() !== '' && (!l.email2 || l.email2.trim() === '');
        } else if (activeSequence === 'email3') {
          matchesSequence = l.email2 && l.email2.trim() !== '' && (!l.email3 || l.email3.trim() === '');
        }
      }

      if (!matchesSequence) return false;

      // 3. Associated Sending Account filter (Critical for Follow-ups Email 2 & Email 3)
      if (selectedSenderAccount !== 'all') {
        const leadAcc = (l.accountName || currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || '').trim().toLowerCase();
        if (leadAcc !== selectedSenderAccount.toLowerCase()) return false;
      }

      // 4. Initial / Previous Sent Date filter
      if (selectedPrevDate !== 'all') {
        let dateOfLead = null;
        if (activeSequence === 'email1') {
          dateOfLead = l.dateAdded || 'Standard Import';
        } else if (activeSequence === 'email2') {
          dateOfLead = extractDateFromStatus(l.email1) || 'Unknown Date';
        } else if (activeSequence === 'email3') {
          dateOfLead = extractDateFromStatus(l.email2) || 'Unknown Date';
        }
        if (dateOfLead !== selectedPrevDate) return false;
      }

      // 5. 🛡️ DNC / Unsubscribe / Not Interested Exclusion
      if (isLeadDNC(l)) {
        dncExcluded++;
        return false;
      }

      return true;
    });

    return { eligibleLeads: filtered, dncExcludedInSequence: dncExcluded };
  }, [leads, activeSequence, filterMode, selectedCampaign, selectedSenderAccount, selectedPrevDate, currentWorkspace]);

  // Selected batch leads (either manually selected or top N of eligible)
  const batchLeads = useMemo(() => {
    if (manualSelection.length > 0) {
      return eligibleLeads.filter(l => manualSelection.includes(l.id));
    }
    const count = Math.min(Number(batchCount) || 0, eligibleLeads.length);
    return eligibleLeads.slice(0, count);
  }, [eligibleLeads, batchCount, manualSelection]);

  const selectedIds = batchLeads.map(l => l.id);

  // Handle sequence switch
  const handleSequenceChange = (seqId) => {
    setActiveSequence(seqId);
    setSelectedSenderAccount('all');
    setSelectedPrevDate('all');
    setManualSelection([]);
    if (seqId === 'email1') {
      setSelectedAccount(currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || 'hello@crewlixglobal.com');
    }
  };

  // Handle Quick Batch Copy (with DNC protection)
  const handleCopyForSheets = async () => {
    if (selectedIds.length === 0) return;
    const res = await copyBatchForMailMerge(selectedIds, false, true);
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
    
    // For follow-ups, preserve the associated sender account or use selectedAccount
    const senderToApply = (selectedSenderAccount !== 'all' ? selectedSenderAccount : selectedAccount).trim();
    
    const ok = applyBatchSentStatus(selectedIds, activeSequence, customDate, senderToApply, campaignToApply);
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

  const isFollowUp = activeSequence === 'email2' || activeSequence === 'email3';
  const prevStepLabel = activeSequence === 'email3' ? 'Email 2' : 'Email 1';

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
              1) Select sequence & batch count → 2) Filter by <strong>Sending Account</strong> & <strong>Sent Date</strong> for follow-ups → 3) Click <strong>"Copy 4 Columns for Mail Merge"</strong> and paste into your Google Sheet row 2 → 4) Click <strong>"Auto-Apply Sent Status"</strong>.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-[#0A0A0A] p-3 rounded-xl border border-[#1E3A5F] flex-wrap sm:flex-nowrap">
            <div className="text-center px-3 border-r border-[#1E3A5F]">
              <span className="text-[10px] uppercase text-[#7B7B7B] font-semibold block">Eligible Pool</span>
              <span className="text-lg font-bold text-[#00E5A0] font-mono">{eligibleLeads.length}</span>
            </div>
            {isFollowUp && (
              <div className="text-center px-3 border-r border-[#1E3A5F]">
                <span className="text-[10px] uppercase text-[#00C2FF] font-semibold block">Sender Mailbox</span>
                <span className="text-xs font-bold text-white font-mono truncate max-w-[120px] block" title={selectedSenderAccount}>
                  {selectedSenderAccount === 'all' ? 'All Mailboxes' : selectedSenderAccount.split('@')[0]}
                </span>
              </div>
            )}
            <div className="text-center px-3 border-r border-[#1E3A5F]">
              <span className="text-[10px] uppercase text-rose-400 font-semibold block">DNC Excluded</span>
              <span className="text-lg font-bold text-rose-400 font-mono">{dncExcludedInSequence}</span>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] uppercase text-[#7B7B7B] font-semibold block">Batch Selected</span>
              <span className="text-lg font-bold text-[#00C2FF] font-mono">{selectedIds.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DNC / UNSUBSCRIBE PROTECTION SHIELD BANNER */}
      {dncExcludedInSequence > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300 shadow-lg">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>
              <strong>DNC Protection Active:</strong> {dncExcludedInSequence} contact(s) labeled as <strong>DNC / Not Interested / Unsubscribed</strong> are automatically excluded from this {sequenceLabels[activeSequence]} batch.
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#0A0A0A] border border-rose-500/40 text-rose-400">
            {dncExcludedInSequence} Avoided
          </span>
        </div>
      )}

      {/* FOLLOW-UP THREADING NOTICE FOR EMAIL 2 & EMAIL 3 */}
      {isFollowUp && (
        <div className="p-3.5 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 flex items-center justify-between gap-3 text-xs text-[#00C2FF] shadow-md">
          <div className="flex items-center gap-2.5">
            <AtSign className="w-4 h-4 text-[#00C2FF] flex-shrink-0" />
            <span>
              <strong>Follow-Up Threading Active:</strong> For {sequenceLabels[activeSequence]}, filter by the <strong>associated sending email account</strong> and <strong>{prevStepLabel} sent date</strong> to ensure follow-up emails are sent from the exact same mailbox that contacted them previously.
            </span>
          </div>
          {(selectedSenderAccount !== 'all' || selectedPrevDate !== 'all') && (
            <button
              onClick={() => {
                setSelectedSenderAccount('all');
                setSelectedPrevDate('all');
              }}
              className="px-2.5 py-1 rounded-lg bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 hover:text-white border border-[#1E3A5F] font-mono text-[10px] flex items-center gap-1 cursor-pointer flex-shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      )}

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
                { id: 'email2', label: 'Email 2', sub: 'Follow-up 1' },
                { id: 'email3', label: 'Email 3', sub: 'Follow-up 2' }
              ].map(seq => {
                const isSelected = activeSequence === seq.id;
                return (
                  <button
                    key={seq.id}
                    onClick={() => handleSequenceChange(seq.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#00C2FF]/10 border-[#00C2FF] cyan-glow text-white'
                        : 'bg-[#0A0A0A] border-[#1E3A5F] text-[#7B7B7B] hover:border-gray-500'
                    }`}
                  >
                    <span className={`text-xs font-bold ${isSelected ? 'text-[#00C2FF]' : 'text-gray-300'}`}>
                      {seq.label}
                    </span>
                    <span className="text-[10px] text-[#7B7B7B] mt-1">{seq.sub}</span>
                  </button>
                );
              })}
            </div>

            {/* Campaign Filter Dropdown */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#00C2FF]" />
                Filter by Campaign Pool:
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => {
                  setSelectedCampaign(e.target.value);
                  setManualSelection([]);
                }}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              >
                <option value="all">All Campaigns Combined ({leads.length} leads)</option>
                {existingCampaigns.map(camp => (
                  <option key={camp} value={camp}>Campaign: {camp}</option>
                ))}
              </select>
            </div>

            {/* DEDICATED FOLLOW-UP THREADING FILTERS: ASSOCIATED SENDER ACCOUNT & INITIAL SENT DATE */}
            {isFollowUp && (
              <div className="pt-2 border-t border-[#1E3A5F]/70 space-y-3 bg-[#0A0A0A]/40 p-3 rounded-xl border border-[#00C2FF]/20">
                <span className="text-[11px] font-bold text-[#00E5A0] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#00E5A0]" />
                  Follow-Up Match Settings ({sequenceLabels[activeSequence]})
                </span>

                {/* 1. Associated Sending Account Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-[#00C2FF]" />
                      Filter by Associated Sender Account:
                    </span>
                    {selectedSenderAccount !== 'all' && (
                      <span className="text-[10px] text-[#00E5A0] font-mono font-bold">Filtered</span>
                    )}
                  </label>
                  <select
                    value={selectedSenderAccount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSenderAccount(val);
                      if (val !== 'all') {
                        setSelectedAccount(val);
                      }
                      setManualSelection([]);
                    }}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#00C2FF]/50 rounded-xl text-white font-mono text-xs outline-none focus:border-[#00C2FF]"
                  >
                    <option value="all">All Sender Accounts ({availableSenderAccounts.reduce((acc, a) => acc + a[1], 0)} leads)</option>
                    {availableSenderAccounts.map(([acc, count]) => (
                      <option key={acc} value={acc}>
                        {acc} ({count} leads)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Initial / Previous Touch Sent Date Filter */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#F97316]" />
                      Filter by {prevStepLabel} Sent Date:
                    </span>
                    {selectedPrevDate !== 'all' && (
                      <span className="text-[10px] text-[#F97316] font-mono font-bold">Filtered</span>
                    )}
                  </label>
                  <select
                    value={selectedPrevDate}
                    onChange={(e) => {
                      setSelectedPrevDate(e.target.value);
                      setManualSelection([]);
                    }}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#F97316]/50 rounded-xl text-white font-mono text-xs outline-none focus:border-[#F97316]"
                  >
                    <option value="all">All {prevStepLabel} Sent Dates ({availablePrevDates.reduce((acc, d) => acc + d[1], 0)} leads)</option>
                    {availablePrevDates.map(([dateVal, count]) => (
                      <option key={dateVal} value={dateVal}>
                        Sent on {dateVal} ({count} leads)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Batch Size & Sending Account */}
          <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <span className="text-xs font-bold text-[#00E5A0] uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4" />
                2. Batch Volume & Sender Setup
              </span>
            </div>

            {/* Batch Count Quick Select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">
                  Batch Size (Number of leads to dispatch):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBatchCount(eligibleLeads.length);
                    setManualSelection([]);
                  }}
                  className="text-[10px] font-mono text-[#00C2FF] hover:underline cursor-pointer"
                >
                  All Eligible ({eligibleLeads.length})
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map(cnt => (
                  <button
                    key={cnt}
                    onClick={() => {
                      setBatchCount(cnt);
                      setManualSelection([]);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                      batchCount === cnt && manualSelection.length === 0
                        ? 'bg-[#00E5A0] text-[#0A0A0A]'
                        : 'bg-[#0A0A0A] border border-[#1E3A5F] text-gray-300 hover:text-white'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Batch Count Input */}
            <div className="space-y-1">
              <input
                type="number"
                min="1"
                max={eligibleLeads.length || 1000}
                value={batchCount}
                onChange={(e) => {
                  setBatchCount(Number(e.target.value));
                  setManualSelection([]);
                }}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#00E5A0]"
                placeholder="Or enter custom count..."
              />
            </div>

            {/* Sending Account */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#00E5A0]" />
                  {isFollowUp ? 'Sending Mailbox (Follow-up Sender):' : 'Sending Email Account:'}
                </span>
                {isFollowUp && selectedSenderAccount !== 'all' && (
                  <span className="text-[10px] text-[#00C2FF] font-mono">Matched to {prevStepLabel}</span>
                )}
              </label>
              <input
                type="text"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#00E5A0]"
                placeholder="hello@crewlixglobal.com"
              />
              {isFollowUp && (
                <p className="text-[10px] text-[#7B7B7B]">
                  Follow-ups will be sent from this mailbox, maintaining thread continuity for recipients.
                </p>
              )}
            </div>

            {/* Dispatch Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
                Today's Dispatch Date Tag:
              </label>
              <input
                type="text"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#F97316]"
                placeholder="DD/MM/YY (e.g. 26/08/26)"
              />
            </div>
          </div>

          {/* ACTION BUTTONS: 1-CLICK COPY & AUTO-APPLY */}
          <div className="p-5 rounded-2xl bg-[#0A0A0A] border border-[#00C2FF] space-y-3 shadow-2xl">
            
            {/* Step A: Copy 4 Columns */}
            <button
              onClick={handleCopyForSheets}
              disabled={selectedIds.length === 0}
              className="w-full py-3.5 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#00C2FF]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copied {selectedIds.length} Leads to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>1. Copy 4 Columns for Mail Merge ({selectedIds.length})</span>
                </>
              )}
            </button>

            {/* Step B: Auto-Apply Status */}
            <button
              onClick={handleApplySentStatus}
              disabled={selectedIds.length === 0}
              className="w-full py-3 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/90 text-[#0A0A0A] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#00E5A0]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applySuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  <span>Applied Sent Status to {appliedCount} Leads!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>2. Auto-Apply "Email Sent - {customDate}"</span>
                </>
              )}
            </button>

            <div className="text-[11px] text-[#7B7B7B] text-center pt-1">
              Copies TSV formatted data ready for instant <code>Ctrl + V</code> into Google Sheets.
            </div>
          </div>

        </div>

        {/* RIGHT PREVIEW TABLE (Col 6-12) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="p-4 rounded-2xl bg-[#111827] border border-[#1E3A5F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Batch Queue Preview
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30">
                {batchLeads.length} Selected
              </span>
              {selectedSenderAccount !== 'all' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 truncate max-w-[160px]">
                  {selectedSenderAccount}
                </span>
              )}
              {selectedPrevDate !== 'all' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/30">
                  {prevStepLabel}: {selectedPrevDate}
                </span>
              )}
            </div>

            <div className="text-xs text-[#7B7B7B] font-mono">
              Sequence: <strong className="text-[#00E5A0]">{sequenceLabels[activeSequence]}</strong>
            </div>
          </div>

          {/* Table Container with Sender Account & Previous Sent Date Columns */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E3A5F] overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0A0A0A] text-[#7B7B7B] uppercase font-mono sticky top-0 border-b border-[#1E3A5F] z-10 whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">First Name</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3 text-[#00C2FF]">Sender Mailbox</th>
                    <th className="py-2.5 px-3 text-[#00E5A0]">
                      {activeSequence === 'email1' ? 'Date Added' : `${prevStepLabel} Date`}
                    </th>
                    <th className="py-2.5 px-3">Campaign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3A5F]/50 whitespace-nowrap">
                  {batchLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-[#7B7B7B]">
                        <div className="flex flex-col items-center gap-2">
                          <Filter className="w-7 h-7 text-[#7B7B7B]/40" />
                          <span className="text-xs font-semibold text-gray-300">
                            No eligible leads match the current filters.
                          </span>
                          <span className="text-[11px] text-[#7B7B7B]">
                            {isFollowUp
                              ? `Try changing the Sender Account or ${prevStepLabel} Sent Date filter.`
                              : 'All leads may already be sent or marked as DNC.'}
                          </span>
                          {isFollowUp && (selectedSenderAccount !== 'all' || selectedPrevDate !== 'all') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSenderAccount('all');
                                setSelectedPrevDate('all');
                              }}
                              className="mt-1 px-3 py-1 rounded-xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-semibold hover:bg-[#00C2FF]/20 transition-all cursor-pointer"
                            >
                              Show All {sequenceLabels[activeSequence]} Leads
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    batchLeads.map((lead) => {
                      const associatedAccount = (lead.accountName || currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || '—').trim();
                      
                      let prevDateDisplay = '—';
                      if (activeSequence === 'email2') {
                        prevDateDisplay = extractDateFromStatus(lead.email1) || lead.email1 || '—';
                      } else if (activeSequence === 'email3') {
                        prevDateDisplay = extractDateFromStatus(lead.email2) || lead.email2 || '—';
                      } else {
                        prevDateDisplay = lead.dateAdded || '—';
                      }

                      return (
                        <tr key={lead.id} className="hover:bg-[#1E3A5F]/20 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-medium text-[#00C2FF]">{lead.email}</td>
                          <td className="py-2.5 px-3 font-bold text-white">{lead.firstName || '—'}</td>
                          <td className="py-2.5 px-3 text-gray-300 truncate max-w-[150px]">{lead.companyName || '—'}</td>
                          
                          {/* Associated Sender Account Column */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-[#111827] border border-[#1E3A5F] text-gray-300 font-mono text-[10px] flex items-center gap-1 inline-flex">
                              <Mail className="w-2.5 h-2.5 text-[#00C2FF]" />
                              <span>{associatedAccount}</span>
                            </span>
                          </td>

                          {/* Previous Touch Sent Date / Date Added Column */}
                          <td className="py-2.5 px-3">
                            {isFollowUp ? (
                              <span className="px-2 py-0.5 rounded bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0] font-mono text-[10px] font-semibold">
                                {prevDateDisplay}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-[#F97316]/10 border border-[#F97316]/30 text-[#F97316] font-mono text-[10px]">
                                {prevDateDisplay}
                              </span>
                            )}
                          </td>

                          {/* Campaign Column */}
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-[#1E3A5F] text-[#00C2FF] font-mono text-[10px]">
                              {lead.campaignName || currentWorkspace?.campaignName || 'General'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
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
