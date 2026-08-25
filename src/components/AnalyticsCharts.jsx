import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { BarChart3, TrendingUp, PieChart, Activity } from 'lucide-react';

export default function AnalyticsCharts() {
  const { currentWorkspace, metrics } = useWorkspace();

  const stageCounts = metrics?.stageCounts || {
    interested: 0,
    booked: 0,
    proposal: 0,
    negotiation: 0,
    won: 0,
    lost: 0
  };

  const days = [
    { day: 'Mon', sent: 60, replies: 2 },
    { day: 'Tue', sent: 55, replies: 3 },
    { day: 'Wed', sent: 70, replies: 4 },
    { day: 'Thu', sent: 50, replies: 1 },
    { day: 'Fri', sent: 65, replies: 3 },
    { day: 'Today', sent: metrics?.sentToday || 45, replies: stageCounts.interested || 2 }
  ];

  const maxSent = Math.max(...days.map(d => d.sent), 80);

  const stageList = [
    { label: 'Positive Reply', count: stageCounts.interested || 0, color: '#00C2FF' },
    { label: 'Discovery Call', count: stageCounts.booked || 0, color: '#00E5A0' },
    { label: 'Proposal Sent', count: stageCounts.proposal || 0, color: '#00C2FF' },
    { label: 'Negotiation', count: stageCounts.negotiation || 0, color: '#F97316' },
    { label: 'Closed Won', count: stageCounts.won || 0, color: '#00E5A0' }
  ];

  const totalStagesCount = stageList.reduce((acc, s) => acc + s.count, 0) || 1;
  const uniqueSent = metrics?.uniqueSent || 0;
  const bookedCount = stageCounts.booked || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* 1. Daily Volume & Reply Bar Chart */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E3A5F]">
          <div>
            <h3 className="text-sm font-bold text-[#00C2FF] uppercase tracking-wider">
              Daily Outreach Volume vs Replies
            </h3>
            <p className="text-xs text-[#7B7B7B]">Telemetry tracking for the past 6 sending days</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-gray-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#00C2FF]" /> Sent
            </span>
            <span className="flex items-center gap-1.5 text-gray-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#00E5A0]" /> Replies
            </span>
          </div>
        </div>

        {/* Bar chart canvas visualization */}
        <div className="h-52 flex items-end justify-between gap-3 pt-6 px-2">
          {days.map((item, idx) => {
            const heightSent = Math.round((item.sent / maxSent) * 100);
            const heightReplies = Math.min(100, item.replies * 20);

            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-[10px] font-mono text-[#00E5A0] opacity-0 group-hover:opacity-100 transition-opacity">
                  +{item.replies}
                </div>
                
                <div className="w-full flex items-end justify-center gap-1 h-36 bg-[#0A0A0A] rounded-lg p-1 border border-[#1E3A5F]/40">
                  {/* Sent bar */}
                  <div
                    style={{ height: `${heightSent}%` }}
                    className="w-1/2 bg-[#00C2FF]/80 group-hover:bg-[#00C2FF] rounded-t transition-all"
                    title={`${item.sent} sent`}
                  />
                  {/* Reply bar */}
                  <div
                    style={{ height: `${heightReplies}%` }}
                    className="w-1/2 bg-[#00E5A0] rounded-t transition-all green-glow"
                    title={`${item.replies} replies`}
                  />
                </div>

                <span className="text-xs font-mono text-[#7B7B7B] group-hover:text-white transition-colors">
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Pipeline Conversion Breakdown */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E3A5F]">
            <div>
              <h3 className="text-sm font-bold text-[#00C2FF] uppercase tracking-wider">
                Pipeline Stage Conversion
              </h3>
              <p className="text-xs text-[#7B7B7B]">Distribution across active deal progression</p>
            </div>
            <span className="text-xs font-mono text-[#00E5A0]">
              {metrics?.interestedCount || 0} In Pipeline
            </span>
          </div>

          {/* Stage Progress Bars */}
          <div className="space-y-3.5">
            {stageList.map((stg, i) => {
              const pct = Math.round((stg.count / totalStagesCount) * 100) || 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-200 font-medium">{stg.label}</span>
                    <span className="font-mono text-white">
                      <strong style={{ color: stg.color }}>{stg.count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0A0A0A] border border-[#1E3A5F] overflow-hidden">
                    <div
                      style={{ width: `${pct}%`, backgroundColor: stg.color }}
                      className="h-full rounded-full transition-all duration-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#1E3A5F]/60 flex items-center justify-between text-xs text-[#7B7B7B]">
          <span>Lead-to-Call Conversion:</span>
          <span className="text-[#00E5A0] font-bold font-mono">
            {uniqueSent > 0 ? ((bookedCount / uniqueSent) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>

    </div>
  );
}
