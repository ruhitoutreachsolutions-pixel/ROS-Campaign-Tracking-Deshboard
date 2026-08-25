import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Layers, 
  Send, 
  ArrowRight, 
  MessageSquare, 
  Target, 
  Clock, 
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Trophy
} from 'lucide-react';

export default function SequenceTracker({ onSelectSequenceForDispatch }) {
  const { currentWorkspace, metrics, currentUser } = useWorkspace();
  const isAdmin = currentUser?.role === 'admin';

  const sequenceConfig = currentWorkspace?.sequenceConfig || {
    email1Name: 'Initial Outreach',
    email2Name: 'Follow-up 1',
    email3Name: 'Follow-up 2',
    daysBetween1and2: 3,
    daysBetween2and3: 4
  };

  const stats = metrics?.sequenceStats || {
    email1: { sent: 0, replied: 0, pending: 0 },
    email2: { sent: 0, replied: 0, pending: 0 },
    email3: { sent: 0, replied: 0, pending: 0 }
  };
  
  const totalLeads = metrics?.totalLeads || 1;

  const email1Sent = stats.email1?.sent || 0;
  const email2Sent = stats.email2?.sent || 0;
  const email3Sent = stats.email3?.sent || 0;
  const totalReplied = metrics?.totalReplied || 0;
  const replyRate = metrics?.replyRate || '0.0';
  const pipelineValue = metrics?.pipelineValue || 0;
  const stageCounts = metrics?.stageCounts || { booked: 0, won: 0, interested: 0, proposal: 0, negotiation: 0, lost: 0 };

  // Percentage calculations
  const email1Pct = totalLeads > 0 ? Math.round((email1Sent / totalLeads) * 100) : 0;
  const email2Pct = email1Sent > 0 ? Math.round((email2Sent / email1Sent) * 100) : 0;
  const email3Pct = email2Sent > 0 ? Math.round((email3Sent / email2Sent) * 100) : 0;

  const sequences = [
    {
      id: 'email1',
      title: 'Email 1 — Initial Outreach',
      subtitle: sequenceConfig.email1Name || 'Initial Outreach',
      sentCount: email1Sent,
      pendingCount: stats.email1?.pending || 0,
      percentOfTotal: email1Pct,
      color: '#00C2FF',
      bgColor: 'bg-[#00C2FF]/10',
      borderColor: 'border-[#00C2FF]/40',
      delayTag: 'Day 0 (Launch)'
    },
    {
      id: 'email2',
      title: 'Email 2 — Follow-Up 1',
      subtitle: sequenceConfig.email2Name || 'Value Add Follow-up',
      sentCount: email2Sent,
      pendingCount: stats.email2?.pending || 0,
      percentOfTotal: email2Pct,
      color: '#00E5A0',
      bgColor: 'bg-[#00E5A0]/10',
      borderColor: 'border-[#00E5A0]/40',
      delayTag: `+${sequenceConfig.daysBetween1and2 || 3} Days Delay`
    },
    {
      id: 'email3',
      title: 'Email 3 — Follow-Up 2',
      subtitle: sequenceConfig.email3Name || 'Breakup / Case Study',
      sentCount: email3Sent,
      pendingCount: stats.email3?.pending || 0,
      percentOfTotal: email3Pct,
      color: '#F97316',
      bgColor: 'bg-[#F97316]/10',
      borderColor: 'border-[#F97316]/40',
      delayTag: `+${sequenceConfig.daysBetween2and3 || 4} Days Delay`
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Funnel Overview Container */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-[#1E3A5F] gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#00C2FF] uppercase tracking-wider">
                Multi-Touch Campaign Engine
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 font-mono">
                3 Automated Steps
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
              Sequence Conversion & Dispatch Funnel
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#7B7B7B] bg-[#0A0A0A] px-3 py-1.5 rounded-xl border border-[#1E3A5F]">
              <ShieldCheck className="w-4 h-4 text-[#00E5A0]" />
              <span>Deliverability Score:</span>
              <span className="font-mono text-[#00E5A0] font-bold">99.4% Primary Inbox</span>
            </div>
          </div>
        </div>

        {/* 3 Step Funnel Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6 relative">
          
          {sequences.map((seq) => (
            <div
              key={seq.id}
              className={`p-5 rounded-2xl bg-[#0A0A0A] border ${seq.borderColor} relative transition-all hover:scale-[1.01] flex flex-col justify-between`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {seq.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1E3A5F] text-[#00C2FF] border border-[#00C2FF]/30">
                    {seq.delayTag}
                  </span>
                </div>

                <div className="text-xs text-[#7B7B7B] mb-4">
                  "{seq.subtitle}"
                </div>

                {/* Sent Count Metric */}
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <span className="text-3xl font-bold text-[#00E5A0] font-['Space_Grotesk']">
                      {seq.sentCount}
                    </span>
                    <span className="text-xs text-[#7B7B7B] ml-1.5 font-medium">Sent</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-[#00C2FF]">
                      {seq.percentOfTotal}%
                    </span>
                    <span className="text-[10px] text-[#7B7B7B] block">Progression</span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-2 rounded-full bg-[#111827] overflow-hidden mb-3 border border-[#1E3A5F]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(5, seq.percentOfTotal))}%`,
                      backgroundColor: seq.color
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#7B7B7B] pt-2 border-t border-[#1E3A5F]/60">
                  <span>Eligible Pending:</span>
                  <span className="font-mono text-white font-bold">{seq.pendingCount} leads</span>
                </div>
              </div>

              {/* Action */}
              {isAdmin && (
                <div className="mt-4 pt-3 border-t border-[#1E3A5F]/60">
                  <button
                    onClick={() => onSelectSequenceForDispatch && onSelectSequenceForDispatch(seq.id)}
                    className="w-full py-2 px-3 rounded-xl bg-[#111827] hover:bg-[#00C2FF] text-[#00C2FF] hover:text-[#0A0A0A] font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-[#1E3A5F] hover:border-[#00C2FF]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Batch for {seq.title.split('—')[0]}</span>
                  </button>
                </div>
              )}
            </div>
          ))}

        </div>

        {/* Funnel End Result: Replies & Deals */}
        <div className="mt-6 p-4 rounded-2xl bg-[#0A0A0A] border border-[#00E5A0]/40 flex flex-col sm:flex-row items-center justify-between gap-4 green-glow">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#00E5A0] text-[#0A0A0A]">
              <Trophy className="w-5 h-5 font-bold" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                Total Campaign Conversion: {totalReplied} High-Intent Replies ({replyRate}%)
              </div>
              <div className="text-xs text-gray-300">
                Generated {stageCounts.booked || 0} Discovery Calls & {stageCounts.won || 0} Closed Deals for this client.
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-[#7B7B7B] uppercase block">Total Pipeline Value</span>
            <span className="text-2xl font-bold text-[#00E5A0] font-mono">
              £{pipelineValue.toLocaleString()}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
