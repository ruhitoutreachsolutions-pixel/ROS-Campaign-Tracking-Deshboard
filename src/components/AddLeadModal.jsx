import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getTodayFormatted, isLeadDNC } from '../utils/helpers';
import { 
  X, 
  UserPlus, 
  Mail, 
  User, 
  Building2, 
  MapPin, 
  Target, 
  DollarSign, 
  Calendar, 
  Check, 
  Send, 
  Sparkles,
  FileText,
  AlertCircle
} from 'lucide-react';

export default function AddLeadModal({ isOpen, onClose, onLeadAdded }) {
  const { currentWorkspace, addSingleLead } = useWorkspace();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [campaignName, setCampaignName] = useState(currentWorkspace?.campaignName || 'General Outbound');
  const [customCampaign, setCustomCampaign] = useState('');
  const [accountName, setAccountName] = useState(
    currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || 'hello@crewlixglobal.com'
  );
  const [customAccount, setCustomAccount] = useState('');
  const [stage, setStage] = useState('');
  const [dealValue, setDealValue] = useState('0');
  const [dateAdded, setDateAdded] = useState(getTodayFormatted());
  const [notes, setNotes] = useState('');
  
  // Quick Outreach Send Status
  const [email1SentToday, setEmail1SentToday] = useState(false);
  const [email1, setEmail1] = useState('');
  const [email2, setEmail2] = useState('');
  const [email3, setEmail3] = useState('');

  const [createAnother, setCreateAnother] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Extract unique campaigns
  const existingCampaigns = useMemo(() => {
    const set = new Set();
    if (currentWorkspace?.campaignName) set.add(currentWorkspace.campaignName.trim());
    (currentWorkspace?.leads || []).forEach(l => {
      if (l.campaignName && l.campaignName.trim()) set.add(l.campaignName.trim());
    });
    return Array.from(set);
  }, [currentWorkspace]);

  // Extract unique accounts
  const existingAccounts = useMemo(() => {
    const set = new Set();
    if (currentWorkspace?.activeSendingAccount) set.add(currentWorkspace.activeSendingAccount.trim());
    (currentWorkspace?.sendingAccounts || []).forEach(a => set.add(a.trim()));
    (currentWorkspace?.leads || []).forEach(l => {
      if (l.accountName && l.accountName.trim()) set.add(l.accountName.trim());
    });
    return Array.from(set);
  }, [currentWorkspace]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Email address is required.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const todayStr = getTodayFormatted();
    const finalCampaign = (customCampaign.trim() || campaignName || currentWorkspace?.campaignName || 'General Outbound').trim();
    const finalAccount = (customAccount.trim() || accountName || currentWorkspace?.activeSendingAccount || '').trim();

    let finalEmail1 = email1.trim();
    if (email1SentToday && !finalEmail1) {
      finalEmail1 = `Email Sent - ${dateAdded || todayStr}`;
    }

    const isDnc = stage.toLowerCase().includes('dnc') || 
                  stage.toLowerCase().includes('unsub') || 
                  stage.toLowerCase().includes('not interested');

    const isPositiveStage = stage && 
                            !stage.toLowerCase().includes('lost') && 
                            !stage.toLowerCase().includes('not a') && 
                            !isDnc;

    const newLead = addSingleLead({
      email: cleanEmail,
      firstName: firstName.trim(),
      companyName: companyName.trim(),
      city: city.trim(),
      campaignName: finalCampaign,
      accountName: finalAccount,
      email1: finalEmail1,
      email2: email2.trim(),
      email3: email3.trim(),
      stage: stage.trim(),
      status: isDnc ? 'dnc' : (isPositiveStage ? 'interested' : 'pending'),
      isDNC: isDnc,
      dealValue: Number(dealValue) || 0,
      dateAdded: dateAdded.trim() || todayStr,
      replyDate: isPositiveStage ? todayStr : '',
      notes: notes.trim()
    });

    if (newLead) {
      if (onLeadAdded) onLeadAdded(newLead);

      if (createAnother) {
        // Reset fields for another lead
        setEmail('');
        setFirstName('');
        setCompanyName('');
        setCity('');
        setNotes('');
        setDealValue('0');
        setEmail1SentToday(false);
        setEmail1('');
        setEmail2('');
        setEmail3('');
        setSuccessToast(`✓ Added ${cleanEmail}! Ready for next lead.`);
        setTimeout(() => setSuccessToast(''), 3500);
      } else {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl my-8 bg-[#111827] border border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#0A0A0A] border-b border-[#1E3A5F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Add Single Lead to Sheet
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30">
                  {currentWorkspace?.name}
                </span>
              </h2>
              <p className="text-xs text-[#7B7B7B]">
                Manually record a new prospect into the leads database with real-time tracking tags.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Validation & Success Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3 rounded-xl bg-[#00E5A0]/15 border border-[#00E5A0]/40 text-[#00E5A0] text-xs flex items-center gap-2 green-glow">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Core Prospect Details */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-[#00C2FF] uppercase tracking-wider block">
              1. Contact Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Email Address */}
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#00C2FF]" />
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              {/* First Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. John"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              {/* Company Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Health Ltd"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              {/* City / Location */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  City / Location
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. London"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              {/* Date Added */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
                  Date Added
                </label>
                <input
                  type="text"
                  value={dateAdded}
                  onChange={(e) => setDateAdded(e.target.value)}
                  placeholder="DD/MM/YY"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-[#F97316] font-mono text-xs outline-none focus:border-[#F97316]"
                />
              </div>
            </div>
          </div>

          {/* Campaign & Sending Mailbox Configuration */}
          <div className="space-y-3 pt-2 border-t border-[#1E3A5F]/60">
            <span className="text-[11px] font-bold text-[#00E5A0] uppercase tracking-wider block">
              2. Campaign & Sender Mailbox Setup
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Campaign Pool */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#00C2FF]" />
                  Campaign Pool
                </label>
                <select
                  value={campaignName}
                  onChange={(e) => {
                    setCampaignName(e.target.value);
                    if (e.target.value !== 'custom') setCustomCampaign('');
                  }}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                >
                  {existingCampaigns.map(camp => (
                    <option key={camp} value={camp}>{camp}</option>
                  ))}
                  <option value="custom">+ Type New Campaign...</option>
                </select>
                {campaignName === 'custom' && (
                  <input
                    type="text"
                    value={customCampaign}
                    onChange={(e) => setCustomCampaign(e.target.value)}
                    placeholder="Enter new campaign name..."
                    className="w-full mt-1.5 px-3 py-1.5 bg-[#0A0A0A] border border-[#00C2FF] rounded-lg text-white text-xs outline-none"
                  />
                )}
              </div>

              {/* Sender Email Account */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#00E5A0]" />
                  Sending Mailbox Account
                </label>
                <select
                  value={accountName}
                  onChange={(e) => {
                    setAccountName(e.target.value);
                    if (e.target.value !== 'custom') setCustomAccount('');
                  }}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#00E5A0]"
                >
                  {existingAccounts.map(acc => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                  <option value="custom">+ Type Custom Mailbox...</option>
                </select>
                {accountName === 'custom' && (
                  <input
                    type="text"
                    value={customAccount}
                    onChange={(e) => setCustomAccount(e.target.value)}
                    placeholder="e.g. sender@domain.com"
                    className="w-full mt-1.5 px-3 py-1.5 bg-[#0A0A0A] border border-[#00E5A0] rounded-lg text-white font-mono text-xs outline-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Pipeline Stage & Deal Value */}
          <div className="space-y-3 pt-2 border-t border-[#1E3A5F]/60">
            <span className="text-[11px] font-bold text-[#F97316] uppercase tracking-wider block">
              3. Conversion Stage & Initial Outreach
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Pipeline Stage */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">
                  Pipeline Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                >
                  <option value="">In Progress (Active Lead)</option>
                  <option value="Interested">🎯 Positive Reply / Interested</option>
                  <option value="Call Booked">📅 Discovery Call Booked</option>
                  <option value="Proposal Sent">📑 Proposal / Audit Sent</option>
                  <option value="Negotiation">🤝 Negotiation</option>
                  <option value="Closed Won">🏆 Closed Won Deal</option>
                  <option value="DNC / Unsubscribed">⛔ DNC / Unsubscribed</option>
                  <option value="Not Interested">🚫 Not Interested</option>
                  <option value="Not a Fit">❌ Disqualified / Not a Fit</option>
                </select>
              </div>

              {/* Deal Value */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-[#00E5A0]" />
                  Deal Value ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-[#00E5A0] font-mono text-xs outline-none focus:border-[#00E5A0]"
                />
              </div>
            </div>

            {/* Quick Email 1 Sent Toggle */}
            <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 select-none">
                <input
                  type="checkbox"
                  checked={email1SentToday}
                  onChange={(e) => setEmail1SentToday(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00E5A0] accent-[#00E5A0]"
                />
                <span>Mark <strong>Email 1 (Initial Outreach)</strong> as already sent today ({dateAdded})</span>
              </label>
              {email1SentToday && (
                <span className="text-[10px] font-mono text-[#00E5A0] px-2 py-0.5 rounded bg-[#00E5A0]/10 border border-[#00E5A0]/30">
                  Email Sent - {dateAdded}
                </span>
              )}
            </div>
          </div>

          {/* Notes / Context */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              Notes / Context
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key insights, custom outreach angle, or contact phone..."
              className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF] resize-none"
            />
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-[#1E3A5F] flex flex-col sm:flex-row items-center justify-between gap-3">
            
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createAnother}
                onChange={(e) => setCreateAnother(e.target.checked)}
                className="w-4 h-4 rounded text-[#00E5A0] accent-[#00E5A0]"
              />
              <span>Keep modal open to add another lead</span>
            </label>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/90 text-[#0A0A0A] text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#00E5A0]/20 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>+ Add Lead to Sheet</span>
              </button>
            </div>

          </div>

        </form>

      </div>
    </div>
  );
}
