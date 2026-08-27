import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { isLeadDNC, getTodayFormatted } from '../utils/helpers';
import { 
  X, 
  User, 
  Building2, 
  MapPin, 
  Mail, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Check, 
  FolderOpen,
  Ban,
  ShieldCheck,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

export default function LeadDetailModal({ lead, isOpen, onClose }) {
  const { updateLead, deleteLead, markLeadAsDNC, currentUser, currentWorkspace } = useWorkspace();
  const isAdmin = currentUser?.role === 'admin';

  const [firstName, setFirstName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [email1, setEmail1] = useState('');
  const [email2, setEmail2] = useState('');
  const [email3, setEmail3] = useState('');
  const [accountName, setAccountName] = useState('');
  const [stage, setStage] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [replyDate, setReplyDate] = useState('');
  const [dateAdded, setDateAdded] = useState('');
  const [notes, setNotes] = useState('');
  const [isDncState, setIsDncState] = useState(false);

  useEffect(() => {
    if (lead) {
      setFirstName(lead.firstName || '');
      setCompanyName(lead.companyName || '');
      setCity(lead.city || '');
      setEmail(lead.email || '');
      setCampaignName(lead.campaignName || currentWorkspace?.campaignName || 'General Outbound');
      setEmail1(lead.email1 || '');
      setEmail2(lead.email2 || '');
      setEmail3(lead.email3 || '');
      setAccountName(lead.accountName || '');
      setStage(lead.stage || '');
      setDealValue(lead.dealValue !== undefined && lead.dealValue !== null ? String(lead.dealValue) : '0');
      setReplyDate(lead.replyDate || '');
      setDateAdded(lead.dateAdded || (lead.importedAt ? new Date(lead.importedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '25/08/26'));
      setNotes(lead.notes || '');
      setIsDncState(isLeadDNC(lead));
    }
  }, [lead, currentWorkspace]);

  if (!isOpen || !lead) return null;

  const handleToggleDNC = () => {
    const nextDnc = !isDncState;
    setIsDncState(nextDnc);
    if (nextDnc) {
      setStage('DNC / Unsubscribed');
    } else {
      setStage('In Progress');
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const isNowDnc = isDncState || 
                     stage.toLowerCase().includes('dnc') || 
                     stage.toLowerCase().includes('unsub') || 
                     stage.toLowerCase().includes('not interested');

    updateLead(lead.id, {
      firstName,
      companyName,
      city,
      email,
      campaignName: campaignName || currentWorkspace?.campaignName || 'General Outbound',
      email1,
      email2,
      email3,
      accountName,
      stage,
      status: isNowDnc ? 'dnc' : (stage && !stage.toLowerCase().includes('lost') ? 'interested' : lead.status),
      isDNC: isNowDnc,
      dealValue: Number(dealValue) || 0,
      replyDate,
      dateAdded: dateAdded.trim() || getTodayFormatted(),
      notes
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Delete lead ${lead.email}?`)) {
      deleteLead(lead.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className={`p-2.5 rounded-2xl border ${isDncState ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-[#00C2FF]/10 text-[#00C2FF] border-[#00C2FF]/30'}`}>
            {isDncState ? <Ban className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Lead Details & Deal Telemetry</h3>
              {isDncState && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase tracking-widest font-mono">
                  ⛔ DNC / Excluded
                </span>
              )}
            </div>
            <p className="text-xs text-[#7B7B7B] font-mono">{lead.email}</p>
          </div>
        </div>

        {/* DNC / UNSUBSCRIBE QUICK ACTION BANNER */}
        <div className={`p-3.5 rounded-2xl border mb-4 flex items-center justify-between gap-3 text-xs transition-all ${
          isDncState 
            ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' 
            : 'bg-[#0A0A0A] border-[#1E3A5F] text-gray-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {isDncState ? (
              <Ban className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <div>
              <span className="font-semibold block">
                {isDncState 
                  ? 'This lead is marked as DNC / Unsubscribed.' 
                  : 'Follow-up Status: Active'}
              </span>
              <span className="text-[11px] text-[#7B7B7B]">
                {isDncState 
                  ? 'Automatically excluded from follow-up dispatches.' 
                  : 'Will receive sequence follow-ups until marked DNC.'}
              </span>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={handleToggleDNC}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isDncState
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600'
                  : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
              }`}
            >
              {isDncState ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Active</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Mark as DNC / Unsub</span>
                </>
              )}
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">First Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Company Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">City</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Campaign</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
              />
            </div>
          </div>

          {/* Sequence Status Strings */}
          <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-2.5">
            <span className="text-xs font-bold text-[#00C2FF] uppercase tracking-wider block">
              Multi-Touch Outreach Status
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[11px] text-[#7B7B7B] mb-1">Email 1 Status</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={email1}
                  onChange={(e) => setEmail1(e.target.value)}
                  placeholder="e.g. Email Sent - 10/08/26"
                  className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1E3A5F] rounded-xl text-[#00E5A0] font-mono text-[11px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#7B7B7B] mb-1">Email 2 Status</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={email2}
                  onChange={(e) => setEmail2(e.target.value)}
                  placeholder="e.g. Email Sent - 13/08/26"
                  className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1E3A5F] rounded-xl text-[#00E5A0] font-mono text-[11px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#7B7B7B] mb-1">Email 3 Status</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={email3}
                  onChange={(e) => setEmail3(e.target.value)}
                  placeholder="e.g. Email Sent - 16/08/26"
                  className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1E3A5F] rounded-xl text-[#00E5A0] font-mono text-[11px] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Pipeline Stage & Deal Value ($) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#00C2FF] uppercase tracking-wider mb-1">
                Pipeline Stage
              </label>
              <select
                value={stage}
                onChange={(e) => {
                  const val = e.target.value;
                  setStage(val);
                  if (val.includes('DNC') || val.includes('Unsub') || val.includes('Not Interested')) {
                    setIsDncState(true);
                  } else {
                    setIsDncState(false);
                  }
                }}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              >
                <option value="">In Progress (Active)</option>
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

            <div>
              <label className="block text-xs font-semibold text-[#00E5A0] uppercase tracking-wider mb-1">
                Deal Value ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#00E5A0]">$</span>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full pl-7 pr-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00E5A0] rounded-xl text-white text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#F97316] uppercase tracking-wider mb-1">
                Date Added
              </label>
              <input
                type="text"
                value={dateAdded}
                onChange={(e) => setDateAdded(e.target.value)}
                placeholder="DD/MM/YY (e.g. 27/08/26)"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-[#F97316] text-xs font-mono font-bold outline-none focus:border-[#F97316]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Reply Date</label>
              <input
                type="text"
                value={replyDate}
                onChange={(e) => setReplyDate(e.target.value)}
                placeholder="DD/MM/YY"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs font-mono outline-none focus:border-[#00C2FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Lead Notes / Context
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Requested removal from list, or asked for pricing, call booked..."
              className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF] resize-none"
            />
          </div>

          <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-between gap-3">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Lead</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300 transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
