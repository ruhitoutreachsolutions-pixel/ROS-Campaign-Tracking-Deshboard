import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { X, User, Building2, MapPin, Mail, DollarSign, Calendar, Trash2, Check, FolderOpen } from 'lucide-react';

export default function LeadDetailModal({ lead, isOpen, onClose }) {
  const { updateLead, updateLeadStage, deleteLead, currentUser, currentWorkspace } = useWorkspace();
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
  const [notes, setNotes] = useState('');

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
      setNotes(lead.notes || '');
    }
  }, [lead, currentWorkspace]);

  if (!isOpen || !lead) return null;

  const handleSave = (e) => {
    e.preventDefault();
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
      status: stage && !stage.toLowerCase().includes('lost') ? 'interested' : lead.status,
      dealValue: Number(dealValue) || 0,
      replyDate,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className="p-2.5 rounded-xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Lead Details & Deal Telemetry</h3>
            <p className="text-xs text-[#7B7B7B] font-mono">{lead.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">First Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Company Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF] disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                disabled={!isAdmin}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs font-mono outline-none focus:border-[#00C2FF] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Campaign Name</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Care Campaign"
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-[#00C2FF] text-xs font-mono outline-none focus:border-[#00C2FF] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">City / Region</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF] disabled:opacity-60"
              />
            </div>
          </div>

          {/* Sequence Status Strings */}
          <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-2.5">
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
                  className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1E3A5F] rounded-lg text-[#00E5A0] font-mono text-[11px] outline-none"
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
                  className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1E3A5F] rounded-lg text-[#00E5A0] font-mono text-[11px] outline-none"
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
                  className="w-full px-2.5 py-1.5 bg-[#111827] border border-[#1E3A5F] rounded-lg text-[#00E5A0] font-mono text-[11px] outline-none"
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
                onChange={(e) => setStage(e.target.value)}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              >
                <option value="">None (Standard Lead)</option>
                <option value="Interested / Positive Reply">🎯 Positive Reply</option>
                <option value="Discovery Call Booked">📅 Discovery Call Booked</option>
                <option value="Proposal / Audit Sent">📑 Proposal / Audit Sent</option>
                <option value="Negotiation">🤝 Negotiation</option>
                <option value="Closed Won">🏆 Closed Won</option>
                <option value="Not a Fit">❌ Not a Fit</option>
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
                  placeholder="e.g. 200"
                  className="w-full pl-7 pr-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00E5A0] rounded-xl text-white text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Reply Date</label>
              <input
                type="text"
                value={replyDate}
                onChange={(e) => setReplyDate(e.target.value)}
                placeholder="YYYY-MM-DD"
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
              placeholder="e.g. Asked for pricing, agreed to $200 trial setup, call booked..."
              className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF] resize-none"
            />
          </div>

          <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-between gap-3">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Lead</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300"
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
