import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { getTodayFormatted, getYesterdayFormatted } from '../utils/helpers';
import { 
  Edit3, 
  X, 
  Check, 
  Layers, 
  Send, 
  Target, 
  DollarSign, 
  Building2, 
  Mail, 
  MapPin, 
  FileText, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

export default function BulkEditModal({ isOpen, onClose, selectedLeadIds, onComplete }) {
  const { currentWorkspace, bulkUpdateLeads } = useWorkspace();

  if (!isOpen || !selectedLeadIds || selectedLeadIds.length === 0) return null;

  const todayStr = getTodayFormatted();
  const yesterdayStr = getYesterdayFormatted();
  const leads = currentWorkspace?.leads || [];
  const selectedCount = selectedLeadIds.length;

  // Extract existing unique campaigns and accounts for suggestions
  const existingCampaigns = useMemo(() => {
    const set = new Set();
    if (currentWorkspace?.campaignName) set.add(currentWorkspace.campaignName);
    leads.forEach(l => {
      if (l.campaignName && l.campaignName.trim()) set.add(l.campaignName.trim());
    });
    return Array.from(set);
  }, [leads, currentWorkspace]);

  const existingAccounts = useMemo(() => {
    const set = new Set();
    (currentWorkspace?.sendingAccounts || []).forEach(a => set.add(a));
    if (currentWorkspace?.activeSendingAccount) set.add(currentWorkspace.activeSendingAccount);
    leads.forEach(l => {
      if (l.accountName && l.accountName.trim()) set.add(l.accountName.trim());
    });
    return Array.from(set);
  }, [leads, currentWorkspace]);

  // Field Enabled States (Only checked fields are applied)
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    campaignName: false,
    stage: false,
    dealValue: false,
    accountName: false,
    city: false,
    email1: false,
    email2: false,
    email3: false,
    notes: false
  });

  // Form Values
  const [campaignName, setCampaignName] = useState(currentWorkspace?.campaignName || 'Care Campaign');
  const [stage, setStage] = useState('Interested');
  const [dealValue, setDealValue] = useState('');
  const [accountName, setAccountName] = useState(currentWorkspace?.activeSendingAccount || '');
  const [city, setCity] = useState('');
  const [email1Option, setEmail1Option] = useState(`Email Sent - ${todayStr}`);
  const [email2Option, setEmail2Option] = useState(`Email Sent - ${todayStr}`);
  const [email3Option, setEmail3Option] = useState(`Email Sent - ${todayStr}`);
  const [customEmail1, setCustomEmail1] = useState('');
  const [customEmail2, setCustomEmail2] = useState('');
  const [customEmail3, setCustomEmail3] = useState('');
  const [notes, setNotes] = useState('');
  const [notesMode, setNotesMode] = useState('append'); // 'append' | 'replace'

  const toggleField = (field) => {
    setFieldsToUpdate(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const activeFieldCount = Object.values(fieldsToUpdate).filter(Boolean).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeFieldCount === 0) {
      alert('Please check at least one field to update.');
      return;
    }

    const updates = {};

    if (fieldsToUpdate.campaignName) {
      updates.campaignName = campaignName;
    }

    if (fieldsToUpdate.stage) {
      updates.stage = stage;
    }

    if (fieldsToUpdate.dealValue) {
      updates.dealValue = dealValue;
    }

    if (fieldsToUpdate.accountName) {
      updates.accountName = accountName;
    }

    if (fieldsToUpdate.city) {
      updates.city = city;
    }

    if (fieldsToUpdate.email1) {
      updates.email1 = email1Option === 'custom' ? customEmail1 : email1Option === '__clear__' ? '' : email1Option;
    }

    if (fieldsToUpdate.email2) {
      updates.email2 = email2Option === 'custom' ? customEmail2 : email2Option === '__clear__' ? '' : email2Option;
    }

    if (fieldsToUpdate.email3) {
      updates.email3 = email3Option === 'custom' ? customEmail3 : email3Option === '__clear__' ? '' : email3Option;
    }

    if (fieldsToUpdate.notes) {
      updates.notes = notes;
      updates.notesMode = notesMode;
    }

    const count = bulkUpdateLeads(selectedLeadIds, updates);
    if (onComplete) onComplete(count, updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#111827] border border-[#00C2FF]/50 rounded-3xl shadow-2xl overflow-hidden my-8 cyan-glow flex flex-col max-h-[90vh]">
        
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-[#1E3A5F] flex items-center justify-between bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Bulk Edit Selected Leads</span>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/40">
                  {selectedCount} Leads
                </span>
              </h2>
              <p className="text-xs text-[#7B7B7B]">
                Check the fields you want to update across all {selectedCount} selected leads.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#1E3A5F] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* SECTION 1: CAMPAIGN & SENDER ACCOUNT */}
          <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E3A5F]/60">
              <span className="font-bold text-[#00C2FF] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Campaign & Sender Settings
              </span>
            </div>

            {/* Campaign Name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.campaignName}
                  onChange={() => toggleField('campaignName')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.campaignName ? 'text-white' : 'text-gray-400'}`}>
                  Update Campaign Name
                </span>
              </label>

              {fieldsToUpdate.campaignName && (
                <div className="pl-6 pt-1 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {existingCampaigns.map(camp => (
                      <button
                        type="button"
                        key={camp}
                        onClick={() => setCampaignName(camp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          campaignName === camp
                            ? 'bg-[#00C2FF] text-[#0A0A0A] font-bold'
                            : 'bg-[#111827] text-gray-300 hover:text-white border border-[#1E3A5F]'
                        }`}
                      >
                        {camp}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Enter campaign name..."
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  />
                </div>
              )}
            </div>

            {/* Sender Account */}
            <div className="space-y-1.5 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.accountName}
                  onChange={() => toggleField('accountName')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.accountName ? 'text-white' : 'text-gray-400'}`}>
                  Update Sending Email Account
                </span>
              </label>

              {fieldsToUpdate.accountName && (
                <div className="pl-6 pt-1 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {existingAccounts.map(acc => (
                      <button
                        type="button"
                        key={acc}
                        onClick={() => setAccountName(acc)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                          accountName === acc
                            ? 'bg-[#00C2FF] text-[#0A0A0A] font-bold'
                            : 'bg-[#111827] text-gray-300 hover:text-white border border-[#1E3A5F]'
                        }`}
                      >
                        {acc}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. hello@crewlixglobal.com"
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  />
                </div>
              )}
            </div>

            {/* City */}
            <div className="space-y-1.5 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.city}
                  onChange={() => toggleField('city')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.city ? 'text-white' : 'text-gray-400'}`}>
                  Update / Standardize City
                </span>
              </label>

              {fieldsToUpdate.city && (
                <div className="pl-6 pt-1">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. London, Wolverhampton, etc."
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: PIPELINE STAGE & DEAL VALUE */}
          <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E3A5F]/60">
              <span className="font-bold text-[#00E5A0] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Pipeline Stage & Deal Value
              </span>
            </div>

            {/* Pipeline Stage */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.stage}
                  onChange={() => toggleField('stage')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.stage ? 'text-white' : 'text-gray-400'}`}>
                  Set Pipeline Stage
                </span>
              </label>

              {fieldsToUpdate.stage && (
                <div className="pl-6 pt-1">
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  >
                    <option value="Interested">Interested / Positive Reply</option>
                    <option value="Call Booked">Discovery Call Booked</option>
                    <option value="Proposal Sent">Proposal Sent / Audit</option>
                    <option value="Negotiation">In Negotiation</option>
                    <option value="Closed Won">Closed Won Deal</option>
                    <option value="Not a Fit">Disqualified / Not a Fit</option>
                    <option value="In Progress">In Progress (Outreach Active)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Deal Value */}
            <div className="space-y-1.5 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.dealValue}
                  onChange={() => toggleField('dealValue')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.dealValue ? 'text-white' : 'text-gray-400'}`}>
                  Set Deal Value ($)
                </span>
              </label>

              {fieldsToUpdate.dealValue && (
                <div className="pl-6 pt-1">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">$</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={dealValue}
                      onChange={(e) => setDealValue(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full pl-8 pr-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: EMAIL SEQUENCE DISPATCH STATUSES */}
          <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E3A5F]/60">
              <span className="font-bold text-[#F97316] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                Email Sequence Dispatches & Dates
              </span>
            </div>

            {/* Email 1 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.email1}
                  onChange={() => toggleField('email1')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.email1 ? 'text-white' : 'text-gray-400'}`}>
                  Update Email 1 (Initial Outreach)
                </span>
              </label>

              {fieldsToUpdate.email1 && (
                <div className="pl-6 pt-1 space-y-2">
                  <select
                    value={email1Option}
                    onChange={(e) => setEmail1Option(e.target.value)}
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  >
                    <option value={`Email Sent - ${todayStr}`}>Email Sent - Today ({todayStr})</option>
                    <option value={`Email Sent - ${yesterdayStr}`}>Email Sent - Yesterday ({yesterdayStr})</option>
                    <option value="__clear__">Clear / Mark Blank (Unsent)</option>
                    <option value="custom">Custom text string...</option>
                  </select>
                  {email1Option === 'custom' && (
                    <input
                      type="text"
                      value={customEmail1}
                      onChange={(e) => setCustomEmail1(e.target.value)}
                      placeholder="e.g. Email Sent - 18/08/26"
                      className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Email 2 */}
            <div className="space-y-1.5 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.email2}
                  onChange={() => toggleField('email2')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.email2 ? 'text-white' : 'text-gray-400'}`}>
                  Update Email 2 (Follow-up 1)
                </span>
              </label>

              {fieldsToUpdate.email2 && (
                <div className="pl-6 pt-1 space-y-2">
                  <select
                    value={email2Option}
                    onChange={(e) => setEmail2Option(e.target.value)}
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  >
                    <option value={`Email Sent - ${todayStr}`}>Email Sent - Today ({todayStr})</option>
                    <option value={`Email Sent - ${yesterdayStr}`}>Email Sent - Yesterday ({yesterdayStr})</option>
                    <option value="__clear__">Clear / Mark Blank (Unsent)</option>
                    <option value="custom">Custom text string...</option>
                  </select>
                  {email2Option === 'custom' && (
                    <input
                      type="text"
                      value={customEmail2}
                      onChange={(e) => setCustomEmail2(e.target.value)}
                      placeholder="e.g. Email Sent - 25/08/26"
                      className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Email 3 */}
            <div className="space-y-1.5 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.email3}
                  onChange={() => toggleField('email3')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.email3 ? 'text-white' : 'text-gray-400'}`}>
                  Update Email 3 (Follow-up 2 / Breakup)
                </span>
              </label>

              {fieldsToUpdate.email3 && (
                <div className="pl-6 pt-1 space-y-2">
                  <select
                    value={email3Option}
                    onChange={(e) => setEmail3Option(e.target.value)}
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  >
                    <option value={`Email Sent - ${todayStr}`}>Email Sent - Today ({todayStr})</option>
                    <option value={`Email Sent - ${yesterdayStr}`}>Email Sent - Yesterday ({yesterdayStr})</option>
                    <option value="__clear__">Clear / Mark Blank (Unsent)</option>
                    <option value="custom">Custom text string...</option>
                  </select>
                  {email3Option === 'custom' && (
                    <input
                      type="text"
                      value={customEmail3}
                      onChange={(e) => setCustomEmail3(e.target.value)}
                      placeholder="e.g. Email Sent - 26/08/26"
                      className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: NOTES */}
          <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E3A5F]/60">
              <span className="font-bold text-gray-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#00C2FF]" />
                Notes & Intelligence
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fieldsToUpdate.notes}
                  onChange={() => toggleField('notes')}
                  className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] w-4 h-4 cursor-pointer"
                />
                <span className={`font-semibold ${fieldsToUpdate.notes ? 'text-white' : 'text-gray-400'}`}>
                  Update Lead Notes
                </span>
              </label>

              {fieldsToUpdate.notes && (
                <div className="pl-6 pt-1 space-y-2">
                  <div className="flex items-center gap-4 text-xs text-gray-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="notesMode"
                        value="append"
                        checked={notesMode === 'append'}
                        onChange={() => setNotesMode('append')}
                        className="accent-[#00C2FF]"
                      />
                      <span>Append to existing notes</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="notesMode"
                        value="replace"
                        checked={notesMode === 'replace'}
                        onChange={() => setNotesMode('replace')}
                        className="accent-[#00C2FF]"
                      />
                      <span>Replace entire note</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter notes to apply..."
                    className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SUMMARY INFO */}
          <div className="p-3.5 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 flex items-center justify-between text-xs text-[#00C2FF]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>{activeFieldCount}</strong> {activeFieldCount === 1 ? 'field' : 'fields'} selected to update across <strong>{selectedCount}</strong> leads.
              </span>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#1E3A5F]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 hover:text-white border border-[#1E3A5F] text-xs font-semibold transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={activeFieldCount === 0}
              className="px-5 py-2.5 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#00C2FF]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Apply Bulk Updates ({selectedCount} Leads)</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
