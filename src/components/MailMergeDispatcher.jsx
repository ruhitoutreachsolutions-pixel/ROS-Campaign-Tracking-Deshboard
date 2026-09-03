import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  RotateCcw,
  AlertTriangle,
  Zap,
  Search,
  ChevronDown,
  X
} from 'lucide-react';

// Helper to reliably get a lead's sender account
function getLeadSenderAccount(lead, workspace) {
  if (!lead) return '';
  const raw = lead.accountName || lead.sendingAccount || '';
  if (raw && typeof raw === 'string' && raw.trim() !== '') {
    return raw.replace(/^["']|["']$/g, '').trim();
  }
  return (workspace?.activeSendingAccount || workspace?.sendingAccounts?.[0] || 'Default Account').trim();
}

// Helper to get previous touch date based on active sequence
function getLeadPrevDate(lead, sequence) {
  if (!lead) return '—';
  if (sequence === 'email2') {
    return extractDateFromStatus(lead.email1) || (lead.email1 ? lead.email1.trim() : 'Unknown Date');
  } else if (sequence === 'email3') {
    return extractDateFromStatus(lead.email2) || (lead.email2 ? lead.email2.trim() : 'Unknown Date');
  }
  return lead.dateAdded || 'Standard Import';
}

export default function MailMergeDispatcher() {
  const { 
    currentWorkspace, 
    copyBatchForMailMerge, 
    applyBatchSentStatus,
    reassignLeadSenderAccounts
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
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState(null);

  // Searchable Sender Account Dropdown State
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef(null);
  const accountSearchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setIsAccountDropdownOpen(false);
      }
    }
    if (isAccountDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        accountSearchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountDropdownOpen]);

  const leads = currentWorkspace?.leads || [];

  // Extract unique campaign names
  const existingCampaigns = useMemo(() => {
    const set = new Set();
    if (currentWorkspace?.campaignName) set.add(currentWorkspace.campaignName.trim());
    leads.forEach(l => {
      if (l.campaignName && l.campaignName.trim()) set.add(l.campaignName.trim());
    });
    return Array.from(set);
  }, [leads, currentWorkspace]);

  // Compute total DNC / Unsubscribed leads in this workspace
  const totalDncInWorkspace = useMemo(() => {
    return leads.filter(l => isLeadDNC(l)).length;
  }, [leads]);

  // BASE LEADS FOR THIS SEQUENCE & CAMPAIGN (Excluding DNC)
  const { sequenceBaseLeads, dncExcludedInSequence } = useMemo(() => {
    let dncExcluded = 0;

    const filtered = leads.filter(l => {
      // Campaign filter
      if (selectedCampaign !== 'all') {
        const leadCamp = (l.campaignName || currentWorkspace?.campaignName || 'General Outbound').trim();
        if (leadCamp.toLowerCase() !== selectedCampaign.toLowerCase()) return false;
      }

      // Check sequence eligibility condition
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

      // DNC Exclusion
      if (isLeadDNC(l)) {
        dncExcluded++;
        return false;
      }

      return true;
    });

    return { sequenceBaseLeads: filtered, dncExcludedInSequence: dncExcluded };
  }, [leads, activeSequence, filterMode, selectedCampaign, currentWorkspace]);

  // DYNAMIC SENDER ACCOUNTS (CASCADED WITH SELECTED DATE)
  const availableSenderAccounts = useMemo(() => {
    const totalCounts = {};
    const dateMatchCounts = {};

    sequenceBaseLeads.forEach(l => {
      const acc = getLeadSenderAccount(l, currentWorkspace);
      totalCounts[acc] = (totalCounts[acc] || 0) + 1;

      if (selectedPrevDate !== 'all') {
        const d = getLeadPrevDate(l, activeSequence);
        if (d === selectedPrevDate) {
          dateMatchCounts[acc] = (dateMatchCounts[acc] || 0) + 1;
        }
      } else {
        dateMatchCounts[acc] = (dateMatchCounts[acc] || 0) + 1;
      }
    });

    return Object.keys(totalCounts).map(acc => ({
      account: acc,
      totalCount: totalCounts[acc],
      matchCount: dateMatchCounts[acc] || 0
    })).sort((a, b) => b.matchCount - a.matchCount || b.totalCount - a.totalCount);
  }, [sequenceBaseLeads, selectedPrevDate, currentWorkspace, activeSequence]);

  // Filter sender accounts by user search query in the search bar
  const filteredSenderAccounts = useMemo(() => {
    if (!accountSearchQuery.trim()) return availableSenderAccounts;
    const q = accountSearchQuery.toLowerCase().trim();
    return availableSenderAccounts.filter(item => item.account.toLowerCase().includes(q));
  }, [availableSenderAccounts, accountSearchQuery]);

  // DYNAMIC PREVIOUS TOUCH DATES (CASCADED WITH SELECTED SENDER ACCOUNT)
  const availablePrevDates = useMemo(() => {
    const totalCounts = {};
    const accMatchCounts = {};

    sequenceBaseLeads.forEach(l => {
      const d = getLeadPrevDate(l, activeSequence);
      totalCounts[d] = (totalCounts[d] || 0) + 1;

      if (selectedSenderAccount !== 'all') {
        const acc = getLeadSenderAccount(l, currentWorkspace);
        if (acc.toLowerCase() === selectedSenderAccount.toLowerCase()) {
          accMatchCounts[d] = (accMatchCounts[d] || 0) + 1;
        }
      } else {
        accMatchCounts[d] = (accMatchCounts[d] || 0) + 1;
      }
    });

    return Object.keys(totalCounts).map(dateStr => ({
      date: dateStr,
      totalCount: totalCounts[dateStr],
      matchCount: accMatchCounts[dateStr] || 0
    })).sort((a, b) => b.matchCount - a.matchCount || b.totalCount - a.totalCount);
  }, [sequenceBaseLeads, selectedSenderAccount, currentWorkspace, activeSequence]);

  // FINAL FILTERED ELIGIBLE LEADS
  const eligibleLeads = useMemo(() => {
    return sequenceBaseLeads.filter(l => {
      // 1. Sender account filter
      if (selectedSenderAccount !== 'all') {
        const acc = getLeadSenderAccount(l, currentWorkspace);
        if (acc.toLowerCase() !== selectedSenderAccount.toLowerCase()) return false;
      }

      // 2. Sent date filter
      if (selectedPrevDate !== 'all') {
        const d = getLeadPrevDate(l, activeSequence);
        if (d !== selectedPrevDate) return false;
      }

      return true;
    });
  }, [sequenceBaseLeads, selectedSenderAccount, selectedPrevDate, currentWorkspace, activeSequence]);

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

  // Quick batch re-assignment if user wants to match leads to an account
  const handleQuickReassignAccount = (targetAccount) => {
    if (!targetAccount || selectedPrevDate === 'all') return;
    const leadsOnDate = sequenceBaseLeads.filter(l => getLeadPrevDate(l, activeSequence) === selectedPrevDate);
    if (leadsOnDate.length === 0) return;

    const ids = leadsOnDate.map(l => l.id);
    const count = reassignLeadSenderAccounts(ids, targetAccount);
    if (count > 0) {
      setReassignSuccessMsg(`Reassigned ${count} leads sent on ${selectedPrevDate} to ${targetAccount}!`);
      setSelectedSenderAccount(targetAccount);
      setSelectedAccount(targetAccount);
      setTimeout(() => setReassignSuccessMsg(null), 5000);
    }
  };

  // Handle Quick Batch Copy
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
    
    // Explicitly use selectedSenderAccount or input selectedAccount
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

  // Leads that were sent on selectedPrevDate across all accounts (for diagnosis)
  const leadsOnSelectedDateAllAccounts = useMemo(() => {
    if (selectedPrevDate === 'all') return [];
    return sequenceBaseLeads.filter(l => getLeadPrevDate(l, activeSequence) === selectedPrevDate);
  }, [sequenceBaseLeads, selectedPrevDate, activeSequence]);

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
              1) Select sequence & campaign → 2) Target by <strong>Sending Account</strong> & <strong>Sent Date</strong> for follow-ups → 3) Click <strong>"Copy 4 Columns for Mail Merge"</strong> and paste into row 2 of Google Sheets → 4) Click <strong>"Auto-Apply Sent Status"</strong>.
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

      {/* DNC PROTECTION BANNER */}
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

      {/* REASSIGN SUCCESS MESSAGE */}
      {reassignSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-[#00E5A0]/15 border border-[#00E5A0]/40 flex items-center justify-between gap-3 text-xs text-[#00E5A0] shadow-lg green-glow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#00E5A0]" />
            <span>{reassignSuccessMsg}</span>
          </div>
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
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#00C2FF]" />
                  Filter by Campaign Pool:
                </span>
                <span className="text-[10px] text-[#7B7B7B] font-mono">
                  {sequenceBaseLeads.length} leads in stage
                </span>
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => {
                  setSelectedCampaign(e.target.value);
                  setSelectedSenderAccount('all');
                  setSelectedPrevDate('all');
                  setManualSelection([]);
                }}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              >
                <option value="all">All Campaigns Combined ({leads.length} leads total)</option>
                {existingCampaigns.map(camp => (
                  <option key={camp} value={camp}>Campaign: {camp}</option>
                ))}
              </select>
            </div>

            {/* DEDICATED FOLLOW-UP THREADING FILTERS */}
            {isFollowUp && (
              <div className="pt-2 border-t border-[#1E3A5F]/70 space-y-3 bg-[#0A0A0A]/60 p-3.5 rounded-xl border border-[#00C2FF]/20">
                <span className="text-[11px] font-bold text-[#00E5A0] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#00E5A0]" />
                  Follow-Up Match Settings ({sequenceLabels[activeSequence]})
                </span>

                {/* 1. Associated Sending Account Searchable Dropdown */}
                <div className="space-y-1 relative" ref={accountDropdownRef}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-[#00C2FF]" />
                      Filter by Associated Sender Account:
                    </label>
                    {selectedSenderAccount !== 'all' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#00E5A0] font-mono font-bold">Filtered</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSenderAccount('all');
                            setManualSelection([]);
                          }}
                          className="text-[10px] text-gray-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dropdown Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsAccountDropdownOpen(prev => !prev)}
                    className={`w-full px-3 py-2 bg-[#0A0A0A] border rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                      isAccountDropdownOpen 
                        ? 'border-[#00C2FF] ring-1 ring-[#00C2FF]/40 shadow-lg shadow-[#00C2FF]/10' 
                        : selectedSenderAccount !== 'all'
                          ? 'border-[#00C2FF]/60 text-white'
                          : 'border-[#1E3A5F] hover:border-gray-500 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Mail className={`w-3.5 h-3.5 flex-shrink-0 ${selectedSenderAccount !== 'all' ? 'text-[#00C2FF]' : 'text-gray-400'}`} />
                      <span className="font-mono text-xs truncate">
                        {selectedSenderAccount === 'all' 
                          ? `All Sender Accounts (${sequenceBaseLeads.length} leads in campaign)` 
                          : selectedSenderAccount}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isAccountDropdownOpen ? 'rotate-180 text-[#00C2FF]' : ''}`} />
                  </button>

                  {/* Searchable Floating Popover Menu */}
                  {isAccountDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#0A0A0A] border border-[#00C2FF]/40 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                      
                      {/* Search Bar Input */}
                      <div className="p-2 border-b border-[#1E3A5F] bg-[#111827]/80">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#00C2FF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            ref={accountSearchInputRef}
                            type="text"
                            value={accountSearchQuery}
                            onChange={(e) => setAccountSearchQuery(e.target.value)}
                            placeholder="Search email account (e.g. juned, amit, hello)..."
                            className="w-full pl-8 pr-7 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-lg text-white font-mono text-xs outline-none focus:border-[#00C2FF]"
                          />
                          {accountSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setAccountSearchQuery('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Options List */}
                      <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 divide-y divide-[#1E3A5F]/20 no-scrollbar">
                        {/* 'All Accounts' Option */}
                        {(!accountSearchQuery || 'all sender accounts'.includes(accountSearchQuery.toLowerCase())) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSenderAccount('all');
                              setIsAccountDropdownOpen(false);
                              setAccountSearchQuery('');
                              setManualSelection([]);
                            }}
                            className={`w-full px-2.5 py-2 rounded-lg text-left text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                              selectedSenderAccount === 'all'
                                ? 'bg-[#00C2FF]/15 text-[#00C2FF] font-bold'
                                : 'text-gray-300 hover:bg-[#111827] hover:text-white'
                            }`}
                          >
                            <span>All Sender Accounts</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#111827] border border-[#1E3A5F] text-gray-400 font-mono">
                              {sequenceBaseLeads.length} leads
                            </span>
                          </button>
                        )}

                        {/* Filtered Account Items */}
                        {filteredSenderAccounts.length === 0 && accountSearchQuery && (
                          <div className="py-6 text-center text-xs text-gray-400">
                            No sender accounts matching <span className="text-[#00C2FF]">"{accountSearchQuery}"</span>
                          </div>
                        )}

                        {filteredSenderAccounts.map(item => {
                          const isSelected = selectedSenderAccount.toLowerCase() === item.account.toLowerCase();
                          const matchLabel = selectedPrevDate === 'all'
                            ? `${item.totalCount} leads`
                            : item.matchCount > 0
                              ? `${item.matchCount} on ${selectedPrevDate}`
                              : `0 on ${selectedPrevDate}`;

                          return (
                            <button
                              key={item.account}
                              type="button"
                              onClick={() => {
                                setSelectedSenderAccount(item.account);
                                setSelectedAccount(item.account);
                                setIsAccountDropdownOpen(false);
                                setAccountSearchQuery('');
                                setManualSelection([]);
                              }}
                              className={`w-full px-2.5 py-2 rounded-lg text-left text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#00C2FF]/20 text-[#00C2FF] font-bold'
                                  : 'text-gray-300 hover:bg-[#111827] hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                {isSelected && <Check className="w-3 h-3 text-[#00C2FF] flex-shrink-0" />}
                                <span className="truncate">{item.account}</span>
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${
                                item.matchCount > 0 
                                  ? 'bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-[#00E5A0]' 
                                  : 'bg-[#111827] border border-[#1E3A5F] text-gray-500'
                              }`}>
                                {matchLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Previous Touch Sent Date Filter (Cascaded with Account) */}
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
                    <option value="all">
                      All {prevStepLabel} Sent Dates ({sequenceBaseLeads.length} leads in campaign)
                    </option>
                    {availablePrevDates.map(item => {
                      const label = selectedSenderAccount === 'all'
                        ? `Sent on ${item.date} (${item.totalCount} leads)`
                        : item.matchCount > 0
                          ? `Sent on ${item.date} (${item.matchCount} leads for ${selectedSenderAccount.split('@')[0]})`
                          : `Sent on ${item.date} (0 for this account · ${item.totalCount} total)`;
                      return (
                        <option key={item.date} value={item.date}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* DIAGNOSTIC RESOLUTION BOX WHEN INTERSECTION IS 0 */}
                {eligibleLeads.length === 0 && (selectedSenderAccount !== 'all' || selectedPrevDate !== 'all') && (
                  <div className="mt-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2.5">
                    <div className="flex items-start gap-2 text-amber-400 font-bold">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        0 leads match BOTH sender <span className="text-white">"{selectedSenderAccount}"</span> AND date <span className="text-white">"{selectedPrevDate}"</span>.
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-300 space-y-1.5 pl-1">
                      {/* Where selected account actually has leads */}
                      {selectedSenderAccount !== 'all' && (
                        <div>
                          • <strong className="text-white">{selectedSenderAccount}</strong> has leads on:
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {availablePrevDates.filter(d => d.matchCount > 0).map(d => (
                              <button
                                key={d.date}
                                type="button"
                                onClick={() => setSelectedPrevDate(d.date)}
                                className="px-2 py-0.5 rounded bg-[#0A0A0A] border border-[#00C2FF] text-[#00C2FF] hover:bg-[#00C2FF]/20 font-mono text-[10px] cursor-pointer"
                              >
                                Switch to {d.date} ({d.matchCount} leads)
                              </button>
                            ))}
                            {availablePrevDates.filter(d => d.matchCount > 0).length === 0 && (
                              <span className="text-gray-400">None in this campaign</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Where selected date actually has leads */}
                      {selectedPrevDate !== 'all' && (
                        <div className="pt-1">
                          • Leads sent on <strong className="text-white">{selectedPrevDate}</strong> were sent from:
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {availableSenderAccounts.filter(a => a.matchCount > 0).map(a => (
                              <button
                                key={a.account}
                                type="button"
                                onClick={() => {
                                  setSelectedSenderAccount(a.account);
                                  setSelectedAccount(a.account);
                                }}
                                className="px-2 py-0.5 rounded bg-[#0A0A0A] border border-[#00E5A0] text-[#00E5A0] hover:bg-[#00E5A0]/20 font-mono text-[10px] cursor-pointer"
                              >
                                Switch to {a.account} ({a.matchCount} leads)
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick 1-click Re-assign option */}
                      {selectedSenderAccount !== 'all' && selectedPrevDate !== 'all' && leadsOnSelectedDateAllAccounts.length > 0 && (
                        <div className="pt-2 border-t border-amber-500/20">
                          <button
                            type="button"
                            onClick={() => handleQuickReassignAccount(selectedSenderAccount)}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-[#00E5A0]/20 hover:bg-[#00E5A0]/30 text-[#00E5A0] border border-[#00E5A0]/40 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>
                              Re-assign all {leadsOnSelectedDateAllAccounts.length} leads on {selectedPrevDate} to {selectedSenderAccount}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSenderAccount('all');
                        setSelectedPrevDate('all');
                      }}
                      className="text-[11px] text-[#00C2FF] hover:underline cursor-pointer pt-1 block"
                    >
                      Clear filters to view all {sequenceBaseLeads.length} leads in this sequence
                    </button>
                  </div>
                )}
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
                              ? `Check the filter mismatch guidance on the left panel or reset filters.`
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
                              Show All {sequenceLabels[activeSequence]} Leads ({sequenceBaseLeads.length})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    batchLeads.map((lead) => {
                      const associatedAccount = getLeadSenderAccount(lead, currentWorkspace);
                      const prevDateDisplay = getLeadPrevDate(lead, activeSequence);

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
