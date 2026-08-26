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
  FolderOpen,
  History,
  ArrowRight,
  Filter
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
  const yesterdayCampaignStats = metrics?.yesterdayCampaignStats || [];
  const lastDayCampaignStats = metrics?.lastDayCampaignStats || [];
  const lastActiveDate = metrics?.lastActiveDate || '25/08/26';

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
    <div className="w-full space-y-6 sm:space-y-8">
      
      {/* Client Welcome Banner */}
      <div className="p-5 sm:p-8 rounded-3xl bg-gradient-to-r from-[#111827] via-[#111827] to-[#1E3A5F]/40 border border-[#1E3A5F] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00C2FF]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 uppercase tracking-widest">
                Live Client Portal
              </span>
              <span className="text-xs text-[#7B7B7B] font-mono">
                Real-Time Campaign Telemetry
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {currentWorkspace?.clientName || currentWorkspace?.name || 'Client Workspace'}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs text-[#7B7B7B]">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Target className="w-3.5 h-3.5 text-[#00C2FF]" />
                Primary Campaign: <strong className="text-white">{currentWorkspace?.campaignName || 'Care Campaign'}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <Mail className="w-3.5 h-3.5 text-[#00E5A0]" />
                Sending Account: <strong className="text-white font-mono">{currentWorkspace?.activeSendingAccount || currentWorkspace?.sendingAccounts?.[0] || 'Active'}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
                Tracking System: <strong className="text-white font-mono">ROS Automated Dispatch</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] text-right w-full sm:w-auto">
              <span className="text-[10px] uppercase text-[#7B7B7B] font-semibold block">Total Qualified Deal Value</span>
              <span className="text-2xl font-bold text-[#00E5A0] font-mono">
                ${(metrics.pipelineValue || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS (INCLUDING TODAY VS LAST DAY SEPARATION) */}
      <MetricCards />

      {/* DUAL OUTREACH TELEMETRY: TODAY'S SENDS + LAST ACTIVE DAY BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* CARD 1: TODAY'S OUTREACH DISPATCH */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#1E3A5F]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#00E5A0]/10 text-[#00E5A0]">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Today's Campaign Outreach
                  </h3>
                  <p className="text-xs text-[#7B7B7B]">Live telemetry for today's dispatches</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="px-2.5 py-0.5 rounded-md bg-[#00E5A0]/10 text-[#00E5A0] font-bold border border-[#00E5A0]/30">
                  {metrics.sentToday || 0} Sent Today
                </span>
              </div>
            </div>

            {/* Content for Today */}
            {todayCampaignStats.length > 0 ? (
              <div className="space-y-2.5">
                {todayCampaignStats.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#00E5A0]/40 flex items-center justify-between gap-3 green-glow"
                  >
                    <div className="truncate">
                      <span className="text-xs font-bold text-white block truncate">
                        {item.campaignName}
                      </span>
                      <span className="text-[11px] text-[#00C2FF] font-semibold">
                        {item.details}
                      </span>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-bold text-[#00E5A0] font-mono block">
                        {item.sentToday}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-[#7B7B7B] font-semibold">
                        Sent Today
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-center text-xs text-[#7B7B7B] py-6">
                <Send className="w-5 h-5 mx-auto mb-1.5 text-[#7B7B7B]/50" />
                <span>No emails scheduled/dispatched yet today. Next batch will appear here in real time.</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: LAST ACTIVE DAY / YESTERDAY OUTREACH SUMMARY */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#1E3A5F]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF]">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Last Day Outreach Summary
                  </h3>
                  <p className="text-xs text-[#7B7B7B]">
                    Recorded on <strong className="text-gray-300 font-mono">{lastActiveDate}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="px-2.5 py-0.5 rounded-md bg-[#00C2FF]/10 text-[#00C2FF] font-bold border border-[#00C2FF]/30">
                  {(metrics.sentYesterday > 0 ? metrics.sentYesterday : metrics.lastDaySent || 0).toLocaleString()} Total Sent
                </span>
              </div>
            </div>

            {/* Content for Last Day Breakdown */}
            {lastDayCampaignStats.length > 0 ? (
              <div className="space-y-2.5">
                {lastDayCampaignStats.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#00C2FF]/40 flex items-center justify-between gap-3 cyan-glow"
                  >
                    <div className="truncate">
                      <span className="text-xs font-bold text-white block truncate">
                        {item.campaignName}
                      </span>
                      <span className="text-[11px] text-[#00E5A0] font-semibold">
                        {item.details}
                      </span>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-bold text-[#00C2FF] font-mono block">
                        {item.totalSent.toLocaleString()}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-[#7B7B7B] font-semibold">
                        Dispatched
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {campaignsBreakdown.map((camp, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{camp.name}</span>
                    <span className="text-[#00C2FF] font-mono font-bold">{camp.totalSent} Total Sent</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CLIENT PORTAL INTERACTIVE NAVIGATION TABS */}
      <div className="space-y-4">
        
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#111827] p-1.5 rounded-2xl border border-[#1E3A5F] overflow-x-auto max-w-full no-scrollbar">
          {[
            { id: 'pipeline', label: 'Interested Leads Pipeline', icon: Target, badge: `${metrics.interestedCount || 0}` },
            { id: 'sequences', label: 'Sequence Funnel & Steps', icon: Layers, badge: '3 Steps' },
            { id: 'activity', label: 'Live Sending Activity', icon: Activity, badge: `${activityLog.length}` },
            { id: 'leads', label: 'All Campaign Leads', icon: FolderOpen, badge: `${leads.length}` }
          ].map(tab => {
            const IconComponent = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                    : 'text-gray-400 hover:text-white hover:bg-[#0A0A0A]'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isSelected ? 'bg-[#0A0A0A] text-[#00C2FF]' : 'bg-[#0A0A0A] text-[#00E5A0]'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: INTERESTED PIPELINE (KANBAN & STAGES) */}
        {activeTab === 'pipeline' && (
          <InterestedPipeline onOpenLeadDetail={onOpenLeadDetail} />
        )}

        {/* TAB 2: SEQUENCE FUNNEL & PROGRESSION */}
        {activeTab === 'sequences' && (
          <SequenceTracker />
        )}

        {/* TAB 3: LIVE ACTIVITY STREAM */}
        {activeTab === 'activity' && (
          <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00E5A0]" />
              <span>Real-Time Outreach Dispatch Feed</span>
            </h3>

            {activityLog.length === 0 ? (
              <div className="p-8 text-center text-[#7B7B7B] text-xs">
                No campaign dispatches recorded yet for this workspace.
              </div>
            ) : (
              <div className="space-y-3">
                {activityLog.map((act) => (
                  <div 
                    key={act.id} 
                    className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="p-2 rounded-lg bg-[#00E5A0]/10 text-[#00E5A0]">
                        <Send className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <span className="font-semibold text-white block">{act.description}</span>
                        <span className="text-[11px] text-[#7B7B7B] font-mono">
                          Campaign: <strong className="text-[#00C2FF]">{act.campaignName || currentWorkspace?.campaignName || 'Care Campaign'}</strong>
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-[#7B7B7B] font-mono">
                      {act.timestamp ? new Date(act.timestamp).toLocaleDateString() : 'Today'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CLIENT DIRECTORY OF ALL LEADS (READ ONLY) */}
        {activeTab === 'leads' && (
          <div className="rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl p-4 sm:p-5 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E3A5F]">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#7B7B7B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchLead}
                  onChange={(e) => setSearchLead(e.target.value)}
                  placeholder="Search prospect name, company, email..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              <div className="text-xs text-[#7B7B7B] font-mono">
                Showing <strong className="text-white">{filteredLeads.length}</strong> of <strong className="text-white">{leads.length}</strong> prospects
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0A0A0A] text-[#7B7B7B] uppercase font-mono border-b border-[#1E3A5F]">
                  <tr>
                    <th className="py-2.5 px-3">Prospect Name</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3">Campaign</th>
                    <th className="py-2.5 px-3">Email 1 (Initial)</th>
                    <th className="py-2.5 px-3">Email 2 (Follow-up)</th>
                    <th className="py-2.5 px-3">Email 3 (Breakup)</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3A5F]/50">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#7B7B7B]">
                        No prospects match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.slice(0, 100).map(lead => (
                      <tr key={lead.id} className="hover:bg-[#1E3A5F]/20">
                        <td className="py-2.5 px-3 font-bold text-white">{lead.firstName} ({lead.email})</td>
                        <td className="py-2.5 px-3 text-gray-300">{lead.companyName}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#1E3A5F] text-[#00C2FF] font-mono text-[10px]">
                            {lead.campaignName || currentWorkspace?.campaignName || 'Care Campaign'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0]">{lead.email1 || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0]">{lead.email2 || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0]">{lead.email3 || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#00C2FF]/10 text-[#00C2FF] font-semibold text-[10px]">
                            {lead.stage || lead.status || 'Active'}
                          </span>
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

    </div>
  );
}
