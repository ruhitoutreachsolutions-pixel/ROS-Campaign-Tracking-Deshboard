import React, { useState, useMemo, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  computeCycleDates, 
  calculateMonthCycleMetrics, 
  formatDateToISO, 
  formatDateToDisplay, 
  parseAnyDateToMidnight 
} from '../utils/cycleHelpers';
import { 
  Calendar, 
  CalendarRange, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Send, 
  Users, 
  Sparkles, 
  Sliders, 
  Save, 
  Check, 
  Clock, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Layers
} from 'lucide-react';

export default function MonthlyCycleTracker() {
  const { currentWorkspace, updateWorkspace } = useWorkspace();
  const leads = currentWorkspace?.leads || [];

  // Determine initial preset based on workspace ID or existing saved config
  const isCrewlix = currentWorkspace?.id === 'ws_crewlixukltd' || 
                    (currentWorkspace?.name || '').toLowerCase().includes('crewlix');

  // Load saved config or fall back to sensible defaults
  const savedConfig = currentWorkspace?.monthCycleConfig || {};
  const defaultStartDay = savedConfig.cycleStartDay || (isCrewlix ? 22 : 1);
  const defaultEndDay = savedConfig.cycleEndDay || (isCrewlix ? 21 : 31);
  const defaultPreset = savedConfig.preset || (isCrewlix ? 'crewlix' : (defaultStartDay === 1 ? 'calendar' : 'custom'));

  const [preset, setPreset] = useState(defaultPreset);
  const [cycleStartDay, setCycleStartDay] = useState(defaultStartDay);
  const [cycleEndDay, setCycleEndDay] = useState(defaultEndDay);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current active cycle, -1 = previous, +1 = next

  // Custom manual dates (if user toggles custom date picker)
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(defaultPreset === 'custom_dates');
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Sync state whenever workspace changes
  useEffect(() => {
    const isCr = currentWorkspace?.id === 'ws_crewlixukltd' || 
                 (currentWorkspace?.name || '').toLowerCase().includes('crewlix');
    const cfg = currentWorkspace?.monthCycleConfig || {};
    const sDay = cfg.cycleStartDay || (isCr ? 22 : 1);
    const eDay = cfg.cycleEndDay || (isCr ? 21 : 31);
    const pr = cfg.preset || (isCr ? 'crewlix' : (sDay === 1 ? 'calendar' : 'custom'));

    setPreset(pr);
    setCycleStartDay(sDay);
    setCycleEndDay(eDay);
    setMonthOffset(0);
    setIsCustomMode(pr === 'custom_dates');

    if (cfg.customStartDate && cfg.customEndDate) {
      setCustomStartDate(cfg.customStartDate);
      setCustomEndDate(cfg.customEndDate);
    } else {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  }, [currentWorkspace?.id]);

  // Compute Active Cycle Start and End Dates
  const { activeStartDate, activeEndDate } = useMemo(() => {
    if (isCustomMode && customStartDate && customEndDate) {
      const s = parseAnyDateToMidnight(customStartDate);
      const e = parseAnyDateToMidnight(customEndDate);
      if (s && e) {
        return { 
          activeStartDate: s, 
          activeEndDate: new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999) 
        };
      }
    }

    const computed = computeCycleDates(new Date(), cycleStartDay, cycleEndDay, monthOffset);
    return {
      activeStartDate: computed.startDate,
      activeEndDate: computed.endDate
    };
  }, [isCustomMode, customStartDate, customEndDate, cycleStartDay, cycleEndDay, monthOffset]);

  // Calculate live metrics within the active cycle directly from workspace leads
  const cycleMetrics = useMemo(() => {
    return calculateMonthCycleMetrics(leads, activeStartDate, activeEndDate);
  }, [leads, activeStartDate, activeEndDate]);

  // Preset Handlers
  const handleSelectPreset = (newPreset) => {
    setPreset(newPreset);
    setMonthOffset(0);

    if (newPreset === 'crewlix') {
      setIsCustomMode(false);
      setCycleStartDay(22);
      setCycleEndDay(21);
    } else if (newPreset === 'calendar') {
      setIsCustomMode(false);
      setCycleStartDay(1);
      setCycleEndDay(31);
    } else if (newPreset === 'midmonth') {
      setIsCustomMode(false);
      setCycleStartDay(15);
      setCycleEndDay(14);
    } else if (newPreset === 'custom_dates') {
      setIsCustomMode(true);
      if (!customStartDate || !customEndDate) {
        setCustomStartDate(formatDateToISO(activeStartDate));
        setCustomEndDate(formatDateToISO(activeEndDate));
      }
    }
  };

  // Save current cycle settings as workspace default
  const handleSaveWorkspaceDefault = () => {
    if (!currentWorkspace?.id) return;

    const newConfig = {
      preset,
      cycleStartDay,
      cycleEndDay,
      isCustomMode,
      customStartDate: isCustomMode ? customStartDate : null,
      customEndDate: isCustomMode ? customEndDate : null,
      savedAt: new Date().toISOString()
    };

    updateWorkspace(currentWorkspace.id, {
      monthCycleConfig: newConfig
    });

    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  return (
    <div className="w-full bg-[#111827] border border-[#1E3A5F] rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden transition-all font-['Space_Grotesk']">
      
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-[#00C2FF]/5 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER: Title, Cycle Navigator & Settings Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#1E3A5F]">
        
        {/* Left: Title & Active Cycle Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF] shrink-0">
            <CalendarRange className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Monthly Outreach & Lead Generation
              </h2>
              {cycleMetrics.isCurrentCycle && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 font-mono uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E5A0] animate-ping" />
                  Live Cycle
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Tracking cycle for <strong className="text-white">{currentWorkspace?.name}</strong>: {' '}
              <span className="text-[#00C2FF] font-mono">
                {preset === 'crewlix' ? 'Crewlix Standard (22nd – 21st)' : 
                 preset === 'calendar' ? 'Calendar Month (1st – End)' : 
                 isCustomMode ? 'Custom Date Range' : 
                 `Cycle: Day ${cycleStartDay} to ${cycleEndDay}`}
              </span>
            </p>
          </div>
        </div>

        {/* Center / Right: Interactive Cycle Navigator & Settings Button */}
        <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
          
          {/* Month Step Navigator */}
          {!isCustomMode && (
            <div className="flex items-center bg-[#0A0A0A] border border-[#1E3A5F] rounded-2xl p-1 shadow-inner">
              <button
                onClick={() => setMonthOffset(prev => prev - 1)}
                className="p-1.5 rounded-xl hover:bg-[#1E3A5F] text-gray-400 hover:text-white transition cursor-pointer"
                title="View Previous Month Cycle"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 py-0.5 text-center min-w-[170px]">
                <span className="text-xs font-mono font-bold text-[#00C2FF] block">
                  {formatDateToDisplay(activeStartDate)} – {formatDateToDisplay(activeEndDate)}
                </span>
                <span className="text-[10px] text-gray-400 block font-mono">
                  {monthOffset === 0 ? 'Current Month Cycle' : 
                   monthOffset === -1 ? 'Previous Month' : 
                   monthOffset < -1 ? `${Math.abs(monthOffset)} Months Ago` : 
                   `${monthOffset} Month Ahead`}
                </span>
              </div>

              <button
                onClick={() => setMonthOffset(prev => prev + 1)}
                className="p-1.5 rounded-xl hover:bg-[#1E3A5F] text-gray-400 hover:text-white transition cursor-pointer"
                title="View Next Month Cycle"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {monthOffset !== 0 && (
                <button
                  onClick={() => setMonthOffset(0)}
                  className="ml-1 px-2 py-1 rounded-lg bg-[#00C2FF]/15 text-[#00C2FF] hover:bg-[#00C2FF]/25 text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Reset to Current Active Cycle"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Today</span>
                </button>
              )}
            </div>
          )}

          {isCustomMode && (
            <div className="flex items-center gap-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-2xl px-3 py-1.5 font-mono text-xs text-[#00C2FF]">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDateToDisplay(activeStartDate)} – {formatDateToDisplay(activeEndDate)}</span>
            </div>
          )}

          {/* Toggle Cycle Settings Panel */}
          <button
            onClick={() => setShowConfigPanel(prev => !prev)}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showConfigPanel 
                ? 'bg-[#00C2FF] text-[#0A0A0A] border-[#00C2FF] shadow-lg shadow-[#00C2FF]/20' 
                : 'bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 hover:text-white border-[#1E3A5F]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showConfigPanel ? 'Close Settings' : 'Cycle Dates'}</span>
          </button>

        </div>

      </div>

      {/* COLLAPSIBLE CYCLE CONFIGURATION & DATE PICKER PANEL */}
      {showConfigPanel && (
        <div className="p-4 sm:p-5 mb-5 rounded-2xl bg-[#0A0A0A] border border-[#00C2FF]/40 shadow-2xl animate-fade-in space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1E3A5F]">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#00C2FF]" />
                <span>Configure Month Cycle Dates for {currentWorkspace?.name}</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Select your billing/outreach month start and end dates. Data updates automatically from all leads.
              </p>
            </div>

            {saveToast && (
              <span className="text-xs text-[#00E5A0] font-bold flex items-center gap-1 animate-pulse">
                <Check className="w-3.5 h-3.5" />
                <span>Saved for this Workspace!</span>
              </span>
            )}
          </div>

          {/* Presets Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-gray-400 font-semibold">Presets:</span>
            
            <button
              onClick={() => handleSelectPreset('crewlix')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                preset === 'crewlix'
                  ? 'bg-[#00C2FF]/20 text-[#00C2FF] border-[#00C2FF] shadow-md shadow-[#00C2FF]/20'
                  : 'bg-[#111827] text-gray-300 hover:text-white border-[#1E3A5F]'
              }`}
            >
              ⭐ Crewlix Standard (22nd – 21st)
            </button>

            <button
              onClick={() => handleSelectPreset('calendar')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                preset === 'calendar'
                  ? 'bg-[#00C2FF]/20 text-[#00C2FF] border-[#00C2FF] shadow-md shadow-[#00C2FF]/20'
                  : 'bg-[#111827] text-gray-300 hover:text-white border-[#1E3A5F]'
              }`}
            >
              📅 Calendar Month (1st – End)
            </button>

            <button
              onClick={() => handleSelectPreset('midmonth')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                preset === 'midmonth'
                  ? 'bg-[#00C2FF]/20 text-[#00C2FF] border-[#00C2FF] shadow-md shadow-[#00C2FF]/20'
                  : 'bg-[#111827] text-gray-300 hover:text-white border-[#1E3A5F]'
              }`}
            >
              🗓️ Mid-Month (15th – 14th)
            </button>

            <button
              onClick={() => handleSelectPreset('custom_dates')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isCustomMode
                  ? 'bg-[#00E5A0]/20 text-[#00E5A0] border-[#00E5A0] shadow-md shadow-[#00E5A0]/20'
                  : 'bg-[#111827] text-gray-300 hover:text-white border-[#1E3A5F]'
              }`}
            >
              🎯 Custom Date Range Picker
            </button>
          </div>

          {/* Granular Selection Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            
            {!isCustomMode ? (
              <>
                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">
                    Cycle Start Day of Month
                  </label>
                  <select
                    value={cycleStartDay}
                    onChange={(e) => {
                      setCycleStartDay(Number(e.target.value));
                      setPreset('custom');
                    }}
                    className="w-full bg-[#111827] border border-[#1E3A5F] rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#00C2FF]"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of month</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">
                    Cycle End Day of Month
                  </label>
                  <select
                    value={cycleEndDay}
                    onChange={(e) => {
                      setCycleEndDay(Number(e.target.value));
                      setPreset('custom');
                    }}
                    className="w-full bg-[#111827] border border-[#1E3A5F] rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#00C2FF]"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of month</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">
                    Start Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={customStartDate || formatDateToISO(activeStartDate)}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-[#111827] border border-[#1E3A5F] rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#00C2FF]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">
                    End Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={customEndDate || formatDateToISO(activeEndDate)}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-[#111827] border border-[#1E3A5F] rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-[#00C2FF]"
                  />
                </div>
              </>
            )}

            <div className="flex items-end sm:col-span-2 gap-2">
              <button
                onClick={handleSaveWorkspaceDefault}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/85 text-[#0A0A0A] font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-[#00E5A0]/20 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Save as Default for {currentWorkspace?.name}</span>
              </button>

              <button
                onClick={() => {
                  setMonthOffset(0);
                  setIsCustomMode(false);
                  setPreset(isCrewlix ? 'crewlix' : 'calendar');
                  setCycleStartDay(isCrewlix ? 22 : 1);
                  setCycleEndDay(isCrewlix ? 21 : 31);
                }}
                className="px-3 py-2 rounded-xl bg-[#111827] hover:bg-[#1E3A5F] text-gray-300 hover:text-white border border-[#1E3A5F] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CORE MONTHLY STATS: TOTAL EMAILS SENT + TOTAL LEADS ADDED */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* CARD 1: THIS MONTH'S TOTAL EMAIL SENT */}
        <div className="p-5 rounded-2xl bg-[#0A0A0A] border border-[#00C2FF]/40 relative overflow-hidden flex flex-col justify-between group hover:border-[#00C2FF] transition-all shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#00C2FF] uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              <span>This Month's Total Email Sent</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 font-mono">
              Cycle Sends
            </span>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-bold font-mono text-[#00E5A0] tracking-tight group-hover:scale-105 transition-transform">
              {cycleMetrics.totalEmailsSent.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {cycleMetrics.uniqueLeadsContacted.toLocaleString()} leads touched
            </span>
          </div>

          {/* Sequence breakdown badges */}
          <div className="pt-3 border-t border-[#1E3A5F] flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-md bg-[#111827] text-gray-300 border border-[#1E3A5F]">
              Email 1: <strong className="text-white">{cycleMetrics.email1Sent.toLocaleString()}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#111827] text-gray-300 border border-[#1E3A5F]">
              Email 2: <strong className="text-white">{cycleMetrics.email2Sent.toLocaleString()}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[#111827] text-gray-300 border border-[#1E3A5F]">
              Email 3: <strong className="text-white">{cycleMetrics.email3Sent.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* CARD 2: THIS MONTH'S TOTAL LEAD ADDED */}
        <div className="p-5 rounded-2xl bg-[#0A0A0A] border border-[#00E5A0]/40 relative overflow-hidden flex flex-col justify-between group hover:border-[#00E5A0] transition-all shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#00E5A0] uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>This Month's Total Lead Added</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30 font-mono">
              New Leads
            </span>
          </div>

          <div className="my-2 flex items-baseline justify-between">
            <span className="text-3xl sm:text-4xl font-bold font-mono text-white tracking-tight group-hover:scale-105 transition-transform">
              {cycleMetrics.totalLeadsAdded.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              of {leads.length.toLocaleString()} total pool
            </span>
          </div>

          <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-between text-[11px] font-mono text-gray-400">
            <span>
              {leads.length > 0 
                ? `${((cycleMetrics.totalLeadsAdded / leads.length) * 100).toFixed(1)}% of total workspace database`
                : 'No leads in workspace'}
            </span>
            <span className="text-[#00E5A0] font-bold">Live Data</span>
          </div>
        </div>

        {/* CARD 3: CYCLE TIMELINE & DISPATCH VELOCITY */}
        <div className="p-5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00C2FF]" />
              <span>Cycle Timeline & Pace</span>
            </span>
            <span className="text-[10px] font-mono text-[#00C2FF] font-bold">
              {formatDateToDisplay(activeStartDate)} – {formatDateToDisplay(activeEndDate)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="my-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-gray-400">
                {cycleMetrics.daysRemaining > 0 
                  ? `${cycleMetrics.daysRemaining} days remaining in cycle` 
                  : 'Cycle period completed'}
              </span>
              <span className="text-white font-bold">{cycleMetrics.cycleProgressPercent}% elapsed</span>
            </div>

            <div className="w-full h-2 bg-[#111827] rounded-full overflow-hidden border border-[#1E3A5F]">
              <div 
                className="h-full bg-gradient-to-r from-[#00C2FF] to-[#00E5A0] transition-all duration-500 ease-out"
                style={{ width: `${cycleMetrics.cycleProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-between text-[11px] font-mono text-gray-400">
            <span>Duration: <strong className="text-white">{cycleMetrics.daysInCycle} Days</strong></span>
            <span>
              Avg: <strong className="text-[#00E5A0]">{Math.round(cycleMetrics.totalEmailsSent / Math.max(cycleMetrics.daysInCycle - cycleMetrics.daysRemaining, 1)).toLocaleString()}</strong> sent/day
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
