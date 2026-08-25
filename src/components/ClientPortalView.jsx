import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import MetricCards from './MetricCards';
import InterestedPipeline from './InterestedPipeline';
import SequenceTracker from './SequenceTracker';
import { 
  Building2, 
  Calendar, 
  Mail, 
  CheckCircle2, 
  Sparkles, 
  Search, 
  Clock, 
  Activity,
  Layers,
  Target,
  ShieldCheck,
  TrendingUp,
  Send,
  Zap,
  FolderOpen
} from 'lucide-react';

export default function ClientPortalView({ onOpenLeadDetail }) {
  const { currentWorkspace, metrics } = useWorkspace();
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline', 'sequences', 'campaigns', 'activity', 'leads'
  const [searchLead, setSearchLead] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('all');

  const leads = currentWorkspace?.leads || [];
  const activityLog = currentWorkspace?.activityLog || [];
  const campaignsBreakdown = metrics?.campaignsBreakdown || [];
  const todayCampaignStats = metrics?.todayCampaignStats || [];

  const filteredLeads = leads.filter(l => {
    if (selectedCampaignFilter !== 'all' && (l.campaignName || currentWorkspace?.campaignName) !== selectedCampaignFilter) {
      return false;
    }
    if (!searchLead.trim()) return true;
    const q = searchLead.toLowerCase();
    return (l.firstName || '').toLowerCase().includes(q) ||
           (l.companyName || '').toLowerCase().includes(q) ||
           (l.email || '').toLowerCase().includes(q) ||
           (l.city || '').toLowerCase().includes(q) ||
           (l.campaignName || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      
      {/* Client Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#111827] via-[#111827] to-[#1E3A5F]/40 border border-[#1E3A5F] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00C2FF]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 uppercase tracking-widest">
                Live Campaign Telemetry
              </span>
              <span className="text-xs text-[#7B7B7B] font-mono">
                Real-Time Telemetry Stream
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {currentWorkspace?.clientName || currentWorkspace?.name || 'Client Workspace'}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#7B7B7B]">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Target className="w-3.5 h-3.5 text-[#00C2FF]" />
                Primary Campaign: <strong className="text-white">{currentWorkspace?.campaignName || 'General Outbound'}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <Mail className="w-3.5 h-3.5 text-[#00E5A0]" />
                Sending Account: <strong className="text-white font-mono">{currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0]}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
                Started: <strong className="text-white font-mono">{currentWorkspace?.createdAt || 'Aug 2026'}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] text-right">
              <span className="text-[10px] uppercase text-[#7B7B7B] font-semibold block">Total Qualified Value</span>
              <span className="text-2xl font-bold text-[#00E5A0] font-mono">
                ${(metrics.pipelineValue || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TODAY'S CAMPAIGN-BY-CAMPAIGN SENDING TELEMETRY (REQUESTED WIDGET) */}
      <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-3.5 border-b border-[#1E3A5F] gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#00E5A0]/10 text-[#00E5A0]">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Today's Campaign Outreach Dispatch
              </h3>
              <p className="text-xs text-[#7B7B7B]">Live breakdown of campaigns and sequence steps sent today</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#7B7B7B]">Total Sent Today:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#00E5A0]/10 text-[#00E5A0] font-bold border border-[#00E5A0]/30">
              {metrics.sentToday || 0} Emails
            </span>
          </div>
        </div>

        {/* Campaign Sent Today Cards Grid */}
        {todayCampaignStats.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayCampaignStats.map((item, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-xl bg-[#0A0A0A] border border-[#00E5A0]/40 flex items-center justify-between gap-3 green-glow"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="p-2.5 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF] flex-shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {item.campaignName}
                    </span>
                    <span className="text-[11px] text-[#00C2FF] font-semibold">
                      {item.stepLabel}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-xl font-bold text-[#00E5A0] font-mono block">
                    {item.count}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-[#7B7B7B] font-semibold">
                    Sent Today
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {campaignsBreakdown.map((camp, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="p-2.5 rounded-lg bg-[#1E3A5F]/50 text-gray-300 flex-shrink-0">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold text-white block truncate">
                      {camp.name}
                    </span>
                    <span className="text-[11px] text-[#7B7B7B]">
                      {camp.totalLeads} Total Prospects Loaded
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-mono font-semibold text-[#00C2FF] block">
                    {camp.totalSent} Sent Total
                  </span>
                  <span className="text-[10px] text-[#00E5A0] font-mono">
                    {camp.replied} Replies
                  </span>
                </div>
              </div>
            ))}
            {campaignsBreakdown.length === 0 && (
              <div className="py-4 text-center text-xs text-[#7B7B7B] col-span-full">
                No active campaign dispatches recorded for today yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* High-Level Metric Cards */}
      <MetricCards />

      {/* Client View Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'pipeline', label: 'Interested Leads Pipeline', icon: Target, badge: `${metrics.interestedCount}` },
            { id: 'sequences', label: 'Sequence Funnel & Steps', icon: Layers, badge: '3 Steps' },
            { id: 'activity', label: 'Live Sending Activity', icon: Activity, badge: `${activityLog.length}` },
            { id: 'leads', label: 'All Campaign Leads', icon: Search, badge: `${leads.length}` }
          ].map(tab => {
            const IconComp = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                    : 'bg-[#111827] text-gray-400 hover:text-white border border-[#1E3A5F]'
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isSelected ? 'bg-[#0A0A0A] text-[#00C2FF]' : 'bg-[#0A0A0A] text-[#00E5A0]'}`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'pipeline' && (
        <InterestedPipeline onOpenLeadDetail={onOpenLeadDetail} />
      )}

      {activeTab === 'sequences' && (
        <SequenceTracker />
      )}

      {activeTab === 'activity' && (
        <div className="rounded-2xl bg-[#111827] border border-[#1E3A5F] p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E3A5F]">
            <div>
              <h3 className="text-base font-bold text-white">Live Campaign Dispatch & Reply Log</h3>
              <p className="text-xs text-[#7B7B7B]">Chronological record of outreach batches and positive inbound replies</p>
            </div>
            <span className="text-xs font-mono text-[#00E5A0] bg-[#0A0A0A] px-2.5 py-1 rounded-lg border border-[#1E3A5F]">
              Live Stream Active
            </span>
          </div>

          <div className="space-y-3">
            {activityLog.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#7B7B7B]">No activity recorded yet.</div>
            ) : (
              activityLog.map((act) => (
                <div 
                  key={act.id}
                  className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between gap-4 hover:border-[#00C2FF]/40 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${act.type === 'reply' ? 'bg-[#00E5A0]/10 text-[#00E5A0]' : 'bg-[#00C2FF]/10 text-[#00C2FF]'}`}>
                      {act.type === 'reply' ? <Sparkles className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{act.description}</div>
                      <div className="text-[11px] text-[#7B7B7B] flex items-center gap-2">
                        {act.campaignName && (
                          <span className="text-[#00C2FF]">Campaign: {act.campaignName}</span>
                        )}
                        {act.account ? <span>• Sent via {act.account}</span> : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-[#7B7B7B] whitespace-nowrap">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(act.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="rounded-2xl bg-[#111827] border border-[#1E3A5F] p-5 shadow-xl">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Full Outreach Directory</h3>
              <p className="text-xs text-[#7B7B7B]">Transparent record of all prospects loaded into your campaign</p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Campaign Filter */}
              {campaignsBreakdown.length > 1 && (
                <select
                  value={selectedCampaignFilter}
                  onChange={(e) => setSelectedCampaignFilter(e.target.value)}
                  className="bg-[#0A0A0A] border border-[#1E3A5F] text-xs text-white rounded-xl px-3 py-1.5 outline-none focus:border-[#00C2FF]"
                >
                  <option value="all">All Campaigns</option>
                  {campaignsBreakdown.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#7B7B7B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchLead}
                  onChange={(e) => setSearchLead(e.target.value)}
                  placeholder="Search leads, company, campaign..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0A0A0A] text-[#7B7B7B] uppercase font-semibold border-b border-[#1E3A5F]">
                <tr>
                  <th className="py-2.5 px-3">Lead Name</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Campaign</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Email 1 Status</th>
                  <th className="py-2.5 px-3">Email 2 Status</th>
                  <th className="py-2.5 px-3">Email 3 Status</th>
                  <th className="py-2.5 px-3">Pipeline Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E3A5F]/50">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#7B7B7B]">
                      No leads found in this campaign directory.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.slice(0, 50).map(lead => (
                    <tr key={lead.id} className="hover:bg-[#1E3A5F]/20">
                      <td className="py-2.5 px-3 font-bold text-white">{lead.firstName || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-200">{lead.companyName || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#1E3A5F]/60 text-[#00C2FF] font-mono text-[10px]">
                          {lead.campaignName || currentWorkspace?.campaignName || 'General'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#7B7B7B]">{lead.city || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0]">{lead.email1 || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0]">{lead.email2 || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0]">{lead.email3 || '—'}</td>
                      <td className="py-2.5 px-3">
                        {lead.stage ? (
                          <span className="px-2 py-0.5 rounded bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 text-[10px] font-semibold">
                            {lead.stage}
                          </span>
                        ) : (
                          <span className="text-[#7B7B7B] text-[10px]">{lead.status || 'In Progress'}</span>
                        )}
                      </td>
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
