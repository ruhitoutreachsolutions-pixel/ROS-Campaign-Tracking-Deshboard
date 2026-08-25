import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Send, Users, MessageSquare, Target, TrendingUp, DollarSign, Calendar, CheckCircle2 } from 'lucide-react';

export default function MetricCards() {
  const { metrics } = useWorkspace();

  const sentToday = metrics?.sentToday || 0;
  const totalSent = metrics?.totalSent || 0;
  const uniqueSent = metrics?.uniqueSent || 0;
  const totalLeads = metrics?.totalLeads || 0;
  const pendingInitial = metrics?.sequenceStats?.email1?.pending || 0;
  const totalReplied = metrics?.totalReplied || 0;
  const replyRate = metrics?.replyRate || '0.0';
  const pipelineValue = metrics?.pipelineValue || 0;
  const callsBooked = metrics?.stageCounts?.booked || 0;
  const dealsWon = metrics?.stageCounts?.won || 0;

  const cards = [
    {
      id: 'sent_today',
      title: 'Sent Today',
      value: sentToday.toLocaleString(),
      subtitle: 'Outreach volume today',
      icon: Send,
      badge: 'Active Today',
      color: '#00E5A0',
      badgeBg: 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/30'
    },
    {
      id: 'total_sent',
      title: 'Total Emails Sent',
      value: totalSent.toLocaleString(),
      subtitle: `${uniqueSent} unique contacts touched`,
      icon: TrendingUp,
      badge: 'All Sequences',
      color: '#00E5A0',
      badgeBg: 'bg-[#00C2FF]/10 text-[#00C2FF] border-[#00C2FF]/30'
    },
    {
      id: 'total_leads',
      title: 'Total Leads',
      value: totalLeads.toLocaleString(),
      subtitle: `${pendingInitial} pending initial outreach`,
      icon: Users,
      badge: 'Campaign Pool',
      color: '#00E5A0',
      badgeBg: 'bg-[#1E3A5F]/60 text-gray-300 border-[#1E3A5F]'
    },
    {
      id: 'replies',
      title: 'Positive Replies',
      value: totalReplied.toLocaleString(),
      subtitle: `${callsBooked} discovery calls booked`,
      icon: MessageSquare,
      badge: `${replyRate}% Reply Rate`,
      color: '#00E5A0',
      badgeBg: 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/30'
    },
    {
      id: 'pipeline_value',
      title: 'Pipeline Value',
      value: `$${pipelineValue.toLocaleString()}`,
      subtitle: `${dealsWon} closed won deals`,
      icon: DollarSign,
      badge: 'Deal Pipeline ($)',
      color: '#00E5A0',
      badgeBg: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] relative overflow-hidden transition-all hover:border-[#00C2FF]/50 hover:shadow-lg group"
          >
            {/* Top Row: Title & Badge */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#00C2FF] tracking-wider uppercase">
                {card.title}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${card.badgeBg} uppercase tracking-wider`}>
                {card.badge}
              </span>
            </div>

            {/* Middle Row: Signal Green Big Number */}
            <div className="flex items-baseline justify-between">
              <div className="text-3xl sm:text-4xl font-bold text-[#00E5A0] font-['Space_Grotesk'] tracking-tight">
                {card.value}
              </div>
              <div className="p-2 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-[#7B7B7B] group-hover:text-[#00C2FF] transition-colors">
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            {/* Bottom Row: Context note */}
            <div className="mt-3 pt-2.5 border-t border-[#1E3A5F]/60 text-xs text-[#7B7B7B] font-medium flex items-center justify-between">
              <span>{card.subtitle}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
