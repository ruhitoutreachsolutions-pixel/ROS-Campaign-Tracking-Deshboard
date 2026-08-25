import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Target, 
  Calendar, 
  FileText, 
  Handshake, 
  Trophy, 
  XCircle, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  DollarSign, 
  Building2, 
  Mail, 
  Edit3,
  Columns,
  List,
  Sparkles,
  Search,
  Check
} from 'lucide-react';

export default function InterestedPipeline({ onOpenLeadDetail }) {
  const { currentWorkspace, updateLeadStage, updateLeadDealValue, currentUser } = useWorkspace();
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('all');

  // Inline value editing state: { leadId: string, value: string }
  const [editingValueLeadId, setEditingValueLeadId] = useState(null);
  const [tempValue, setTempValue] = useState('');

  const isAdmin = currentUser?.role === 'admin';
  const leads = currentWorkspace?.leads || [];

  // Filter for leads that are interested or have a stage
  const interestedLeads = leads.filter(l => {
    const isInterested = l.status === 'interested' || (l.stage && l.stage.trim() !== '');
    if (!isInterested) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = (l.firstName || '').toLowerCase().includes(q) ||
                    (l.companyName || '').toLowerCase().includes(q) ||
                    (l.email || '').toLowerCase().includes(q) ||
                    (l.city || '').toLowerCase().includes(q) ||
                    (l.notes || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (selectedStageFilter !== 'all' && l.stage !== selectedStageFilter) {
      return false;
    }

    return true;
  });

  const stageColumns = [
    {
      id: 'Interested / Positive Reply',
      label: 'Positive Reply',
      color: '#00C2FF',
      bgColor: 'bg-[#00C2FF]/10',
      borderColor: 'border-[#00C2FF]/30',
      icon: Target
    },
    {
      id: 'Discovery Call Booked',
      label: 'Call Booked',
      color: '#00E5A0',
      bgColor: 'bg-[#00E5A0]/10',
      borderColor: 'border-[#00E5A0]/30',
      icon: Calendar
    },
    {
      id: 'Proposal / Audit Sent',
      label: 'Proposal / Audit',
      color: '#00C2FF',
      bgColor: 'bg-[#00C2FF]/10',
      borderColor: 'border-[#00C2FF]/30',
      icon: FileText
    },
    {
      id: 'Negotiation',
      label: 'Negotiation',
      color: '#F97316',
      bgColor: 'bg-[#F97316]/10',
      borderColor: 'border-[#F97316]/30',
      icon: Handshake
    },
    {
      id: 'Closed Won',
      label: 'Closed Won',
      color: '#00E5A0',
      bgColor: 'bg-[#00E5A0]/20',
      borderColor: 'border-[#00E5A0]/40',
      icon: Trophy
    },
    {
      id: 'Not a Fit',
      label: 'Not a Fit',
      color: '#7B7B7B',
      bgColor: 'bg-[#7B7B7B]/10',
      borderColor: 'border-[#7B7B7B]/30',
      icon: XCircle
    }
  ];

  // Helper to move lead to adjacent stage
  const handleMoveStage = (lead, direction) => {
    const currentIndex = stageColumns.findIndex(col => col.id === (lead.stage || 'Interested / Positive Reply'));
    if (currentIndex === -1) return;
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < stageColumns.length) {
      updateLeadStage(lead.id, stageColumns[newIndex].id, lead.notes, lead.dealValue);
    }
  };

  const handleStartEditingValue = (lead) => {
    if (!isAdmin) return;
    setEditingValueLeadId(lead.id);
    setTempValue(lead.dealValue !== undefined && lead.dealValue !== null ? String(lead.dealValue) : '200');
  };

  const handleSaveValue = (leadId) => {
    updateLeadDealValue(leadId, tempValue);
    setEditingValueLeadId(null);
  };

  // Calculate totals
  const totalPipelineValue = interestedLeads.reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
  const totalCallsBooked = interestedLeads.filter(l => (l.stage || '').includes('Booked')).length;
  const totalClosedWon = interestedLeads.filter(l => (l.stage || '').includes('Won')).length;

  return (
    <div className="space-y-6">
      
      {/* Header & Pipeline Summary Banner */}
      <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#00C2FF] uppercase tracking-wider">
              Lead Conversion Telemetry
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 font-mono">
              {interestedLeads.length} Total Opportunities
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
            Interested Leads Pipeline & Stages
          </h2>
          <p className="text-xs text-[#7B7B7B] mt-0.5">
            Track qualified responses and manage deal values ($) across discovery call, proposal, and closed revenue stages.
          </p>
        </div>

        {/* Quick KPI stats in header */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-center">
            <span className="text-[10px] text-[#7B7B7B] uppercase block">Calls Booked</span>
            <span className="text-lg font-bold text-[#00E5A0] font-mono">{totalCallsBooked}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-center">
            <span className="text-[10px] text-[#7B7B7B] uppercase block">Closed Won</span>
            <span className="text-lg font-bold text-[#00E5A0] font-mono">{totalClosedWon}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-center">
            <span className="text-[10px] text-[#7B7B7B] uppercase block">Pipeline Value</span>
            <span className="text-lg font-bold text-[#00E5A0] font-mono">${totalPipelineValue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111827] p-3 rounded-2xl border border-[#1E3A5F]">
        
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#7B7B7B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lead, company, notes..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          
          {/* Stage filter dropdown */}
          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="bg-[#0A0A0A] border border-[#1E3A5F] text-xs text-gray-300 rounded-xl px-3 py-1.5 outline-none focus:border-[#00C2FF]"
          >
            <option value="all">All Stages ({interestedLeads.length})</option>
            {stageColumns.map(col => (
              <option key={col.id} value={col.id}>{col.label}</option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0A0A0A] p-0.5 rounded-xl border border-[#1E3A5F]">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban' ? 'bg-[#00C2FF] text-[#0A0A0A]' : 'text-[#7B7B7B] hover:text-white'
              }`}
              title="Kanban Board View"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list' ? 'bg-[#00C2FF] text-[#0A0A0A]' : 'text-[#7B7B7B] hover:text-white'
              }`}
              title="Table List View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

        </div>

      </div>

      {/* VIEW 1: KANBAN BOARD */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {stageColumns.map((col, colIdx) => {
            const colLeads = interestedLeads.filter(l => (l.stage || 'Interested / Positive Reply') === col.id);
            const colValue = colLeads.reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
            const IconComponent = col.icon;

            return (
              <div 
                key={col.id}
                className="flex flex-col rounded-2xl bg-[#111827] border border-[#1E3A5F] min-h-[460px] overflow-hidden shadow-lg"
              >
                {/* Column Header */}
                <div className={`p-3 border-b border-[#1E3A5F] ${col.bgColor} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-4 h-4" style={{ color: col.color }} />
                    <span className="text-xs font-bold text-white tracking-wide truncate">
                      {col.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#0A0A0A] font-mono text-white border border-[#1E3A5F]">
                    {colLeads.length}
                  </span>
                </div>

                {colValue > 0 && (
                  <div className="px-3 py-1 bg-[#0A0A0A]/40 border-b border-[#1E3A5F]/50 text-[10px] font-mono text-[#00E5A0] text-right font-medium">
                    ${colValue.toLocaleString()} pipeline
                  </div>
                )}

                {/* Lead Cards List */}
                <div className="p-2 space-y-2.5 flex-1 overflow-y-auto max-h-[600px]">
                  {colLeads.length === 0 ? (
                    <div className="py-12 text-center text-[11px] text-[#7B7B7B]">
                      No leads in this stage
                    </div>
                  ) : (
                    colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-3 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] hover:border-[#00C2FF]/60 transition-all shadow-md group relative flex flex-col justify-between"
                      >
                        <div>
                          {/* Lead Name & Editable Deal Value */}
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <div className="font-bold text-white text-xs group-hover:text-[#00C2FF] transition-colors truncate">
                              {lead.firstName || 'Lead'}
                            </div>

                            {/* Deal Value Badge / Inline Edit */}
                            {editingValueLeadId === lead.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[#00E5A0] font-mono text-xs">$</span>
                                <input
                                  type="number"
                                  autoFocus
                                  value={tempValue}
                                  onChange={(e) => setTempValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveValue(lead.id);
                                    if (e.key === 'Escape') setEditingValueLeadId(null);
                                  }}
                                  className="w-16 px-1.5 py-0.5 bg-[#111827] border border-[#00E5A0] rounded text-white text-[11px] font-mono outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveValue(lead.id)}
                                  className="p-1 rounded bg-[#00E5A0] text-[#0A0A0A]"
                                >
                                  <Check className="w-3 h-3 font-bold" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEditingValue(lead)}
                                title={isAdmin ? "Click to edit deal value" : ""}
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all ${
                                  lead.dealValue > 0
                                    ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/30 hover:border-[#00E5A0]'
                                    : 'bg-[#1E3A5F]/50 text-[#7B7B7B] border-[#1E3A5F] hover:text-[#00C2FF] hover:border-[#00C2FF]'
                                }`}
                              >
                                {lead.dealValue > 0 ? `$${Number(lead.dealValue).toLocaleString()}` : (isAdmin ? '+ Set $' : '$0')}
                              </button>
                            )}
                          </div>

                          {/* Company Name */}
                          <div className="text-xs text-gray-300 font-medium flex items-center gap-1 mb-1 truncate">
                            <Building2 className="w-3 h-3 text-[#7B7B7B] flex-shrink-0" />
                            <span className="truncate">{lead.companyName}</span>
                          </div>

                          {/* Email & City */}
                          <div className="text-[10px] text-[#7B7B7B] font-mono truncate mb-2">
                            {lead.email} {lead.city ? `· ${lead.city}` : ''}
                          </div>

                          {/* Notes snippet */}
                          {lead.notes && (
                            <div className="p-2 rounded-lg bg-[#111827] border border-[#1E3A5F]/60 text-[11px] text-gray-300 mb-2.5 leading-relaxed line-clamp-2">
                              "{lead.notes}"
                            </div>
                          )}

                          {/* Replied Date Tag */}
                          {lead.replyDate && (
                            <div className="text-[9px] text-[#00E5A0] font-mono mb-2 flex items-center gap-1">
                              <span>Replied on: {lead.replyDate}</span>
                            </div>
                          )}
                        </div>

                        {/* Stage Controls */}
                        {isAdmin && (
                          <div className="pt-2 border-t border-[#1E3A5F]/70 flex items-center justify-between text-xs">
                            <button
                              disabled={colIdx === 0}
                              onClick={() => handleMoveStage(lead, -1)}
                              className="p-1 rounded bg-[#111827] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move to Previous Stage"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>

                            <button
                              onClick={() => onOpenLeadDetail && onOpenLeadDetail(lead)}
                              className="text-[10px] text-[#00C2FF] hover:underline font-medium flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>

                            <button
                              disabled={colIdx === stageColumns.length - 1}
                              onClick={() => handleMoveStage(lead, 1)}
                              className="p-1 rounded bg-[#111827] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Move to Next Stage"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW 2: PIPELINE TABLE VIEW */
        <div className="rounded-2xl bg-[#111827] border border-[#1E3A5F] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0A0A0A] text-[#7B7B7B] uppercase font-semibold border-b border-[#1E3A5F]">
                <tr>
                  <th className="py-3 px-4 text-white">Lead Name</th>
                  <th className="py-3 px-4 text-white">Company</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-white">Stage</th>
                  <th className="py-3 px-4 text-right">Deal Value ($)</th>
                  <th className="py-3 px-4">Replied Date</th>
                  <th className="py-3 px-4">Latest Notes</th>
                  {isAdmin && <th className="py-3 px-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]/50 font-sans">
                {interestedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-[#7B7B7B]">
                      No interested leads found matching query.
                    </td>
                  </tr>
                ) : (
                  interestedLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#1E3A5F]/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        {lead.firstName || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-200">
                        {lead.companyName || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#00C2FF]">
                        {lead.email}
                      </td>
                      <td className="py-3 px-4">
                        {isAdmin ? (
                          <select
                            value={lead.stage || 'Interested / Positive Reply'}
                            onChange={(e) => updateLeadStage(lead.id, e.target.value, lead.notes, lead.dealValue)}
                            className="bg-[#0A0A0A] border border-[#1E3A5F] text-xs text-white rounded-lg px-2 py-1 outline-none focus:border-[#00C2FF]"
                          >
                            {stageColumns.map(col => (
                              <option key={col.id} value={col.id}>{col.id}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 font-semibold text-[11px]">
                            {lead.stage || 'Interested / Positive Reply'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#00E5A0]">
                        {editingValueLeadId === lead.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span>$</span>
                            <input
                              type="number"
                              autoFocus
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveValue(lead.id);
                                if (e.key === 'Escape') setEditingValueLeadId(null);
                              }}
                              className="w-20 px-2 py-1 bg-[#0A0A0A] border border-[#00E5A0] rounded text-white text-xs font-mono outline-none"
                            />
                            <button
                              onClick={() => handleSaveValue(lead.id)}
                              className="p-1 rounded bg-[#00E5A0] text-[#0A0A0A]"
                            >
                              <Check className="w-3.5 h-3.5 font-bold" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditingValue(lead)}
                            title={isAdmin ? "Click to edit value" : ""}
                            className="hover:underline"
                          >
                            {lead.dealValue ? `$${Number(lead.dealValue).toLocaleString()}` : (isAdmin ? '$0 (Edit)' : '$0')}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">
                        {lead.replyDate || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-300 max-w-xs truncate">
                        {lead.notes || '—'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => onOpenLeadDetail && onOpenLeadDetail(lead)}
                            className="px-2.5 py-1 rounded bg-[#0A0A0A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-[#00C2FF] text-[11px] font-semibold transition-all"
                          >
                            Details
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
