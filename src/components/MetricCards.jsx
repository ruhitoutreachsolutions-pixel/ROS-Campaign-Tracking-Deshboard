import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Send, Users, MessageSquare, Target, TrendingUp, DollarSign, Calendar, CheckCircle2, History } from 'lucide-react';

export default function MetricCards() {
  const { metrics } = useWorkspace();

  const sentToday = metrics?.sentToday || 0;
  const sentYesterday = metrics?.sentYesterday || 0;
  const lastDaySent = metrics?.lastDaySent || 0;
  const lastActiveDate = metrics?.lastActiveDate || 'Previous Batch';
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
      subtitle: sentToday > 0 ? 'Outreach volume active today' : 'No sends recorded yet today',
      icon: Send,
      badge: 'Active Today',
      color: '#00E5A0',
      badgeBg: sentToday > 0 ? 'bg-[#00E5A0]/10 text-[#00E5A0] border-[#00E5A0]/30' : 'bg-[#1E3A5F]/60 text-gray-400 border-[#1E3A5F]'
    },
    {
      id: 'last_day_sent',
      title: 'Last Day Sent',
      value: (sentYesterday > 0 ? sentYesterday : lastDaySent).toLocaleString(),
      subtitle: `Dispatched on ${lastActiveDate}`,
      icon: History,
      badge: sentYesterday > 0 ? 'Yesterday' : (lastActiveDate || 'Previous Batch'),
      color: '#00C2FF',
      badgeBg: 'bg-[#00C2FF]/10 text-[#00C2FF] border-[#00C2FF]/30'
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
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            className="p-4 sm:p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] relative overflow-hidden transition-all hover:border-[#00C2FF]/50 hover:shadow-lg group flex flex-col justify-between"
          >
            {/* Top Row: Title & Badge */}
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-1">
              <span className="text-[11px] sm:text-xs font-semibold text-[#00C2FF] tracking-wider uppercase truncate">
                {card.title}
              </span>
              <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border ${card.badgeBg} uppercase tracking-wider whitespace-nowrap`}>
                {card.badge}
              </span>
            </div>

            {/* Middle: Big Stat Number */}
            <div className="flex items-center justify-between my-1">
              <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#00E5A0] font-mono tracking-tight group-hover:scale-105 transition-transform">
                {card.value}
              </span>
              <span className="p-2 sm:p-2.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-[#7B7B7B] group-hover:text-[#00C2FF] group-hover:border-[#00C2FF]/40 transition-colors">
                <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            </div>

            {/* Bottom: Subtitle */}
            <div className="text-[10px] sm:text-xs text-[#7B7B7B] font-medium truncate mt-1">
              {card.subtitle}
            </div>

            {/* Subtle glow accent on hover */}
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-[#00C2FF]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#00C2FF]/10 transition-colors" />
          </div>
        );
      })}
    </div>
  );
}
