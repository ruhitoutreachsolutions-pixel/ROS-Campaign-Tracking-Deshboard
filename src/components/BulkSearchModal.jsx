import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Check, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Sparkles, 
  Layers, 
  RotateCcw, 
  Filter, 
  ArrowRight,
  ClipboardPaste,
  ShieldCheck,
  FileText
} from 'lucide-react';

/**
 * BulkSearchModal
 * High-performance bulk email matching modal with interactive scanning animation.
 * Allows users to paste any custom list of email addresses (comma, newline, space separated),
 * parses them, matches against all leads in the active workspace, and provides one-click
 * selection & filtering for instant bulk editing.
 */
export default function BulkSearchModal({ 
  isOpen, 
  onClose, 
  leads = [], 
  currentWorkspaceName = '',
  onApplyMatches 
}) {
  const [inputText, setInputText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStageText, setScanStageText] = useState('');
  const [scanResults, setScanResults] = useState(null);
  const [activeResultTab, setActiveResultTab] = useState('matched'); // 'matched' | 'unmatched'
  const [copyToast, setCopyToast] = useState(false);
  const textareaRef = useRef(null);

  // Auto-focus textarea on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
      }, 100);
    } else {
      // Reset state when modal closes
      setIsScanning(false);
      setScanProgress(0);
      setScanStageText('');
    }
  }, [isOpen]);

  // Fast parser for email addresses from raw text (handles newlines, commas, semicolons, tabs, whitespace)
  const parsedEmails = useMemo(() => {
    if (!inputText || !inputText.trim()) return [];
    
    // Split by common delimiters: newlines, commas, semicolons, tabs, spaces
    const tokens = inputText
      .split(/[\r\n,;\t\s]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    // Keep unique valid or semi-valid email candidates (must have @ and .)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seen = new Set();
    const valid = [];

    for (const token of tokens) {
      // Clean leading/trailing punctuation (like quotes, brackets)
      const clean = token.replace(/^[<"'(]+|[>"')]+$/g, '').trim();
      if (clean && clean.includes('@') && clean.includes('.')) {
        if (!seen.has(clean)) {
          seen.add(clean);
          valid.push(clean);
        }
      }
    }
    return valid;
  }, [inputText]);

  // Run the interactive scan animation and compute matches
  const handleStartScan = () => {
    if (parsedEmails.length === 0) return;

    setIsScanning(true);
    setScanProgress(0);
    setScanResults(null);

    // Build fast lookup map from leads
    // Leads can match by email (lowercase)
    const leadEmailMap = new Map();
    (leads || []).forEach(l => {
      const email = (l.email || '').trim().toLowerCase();
      if (email) {
        // In case of multiple leads with same email, collect them
        if (!leadEmailMap.has(email)) {
          leadEmailMap.set(email, []);
        }
        leadEmailMap.get(email).push(l);
      }
    });

    const totalToScan = parsedEmails.length;
    const totalWorkspaceLeads = (leads || []).length;

    // Interactive Multi-Stage Progression for Cyberpunk Feel
    // Stage 1: Parsing & Sanitizing (0% -> 30%)
    setScanStageText(`Normalizing & indexing ${totalToScan} input emails...`);
    setScanProgress(25);

    setTimeout(() => {
      // Stage 2: Querying workspace index (30% -> 65%)
      setScanStageText(`Scanning ${totalWorkspaceLeads.toLocaleString()} leads in ${currentWorkspaceName || 'workspace'}...`);
      setScanProgress(60);

      setTimeout(() => {
        // Stage 3: Cross-referencing & matching (65% -> 90%)
        setScanStageText(`Cross-referencing matches & compiling reports...`);
        setScanProgress(88);

        setTimeout(() => {
          // Perform exact & fuzzy matching
          const matchedLeads = [];
          const matchedEmailsSet = new Set();
          const unmatchedEmails = [];

          for (const email of parsedEmails) {
            const hits = leadEmailMap.get(email);
            if (hits && hits.length > 0) {
              hits.forEach(hit => {
                if (!matchedLeads.some(m => m.id === hit.id)) {
                  matchedLeads.push(hit);
                }
              });
              matchedEmailsSet.add(email);
            } else {
              unmatchedEmails.push(email);
            }
          }

          setScanProgress(100);
          setScanStageText(`Match Complete: ${matchedLeads.length} leads found!`);

          setTimeout(() => {
            setIsScanning(false);
            setScanResults({
              inputCount: parsedEmails.length,
              matchedLeads,
              matchedLeadIds: matchedLeads.map(l => l.id),
              matchedEmails: Array.from(matchedEmailsSet),
              unmatchedEmails,
              matchRate: Math.round((matchedEmailsSet.size / (parsedEmails.length || 1)) * 100)
            });
            setActiveResultTab(matchedLeads.length > 0 ? 'matched' : 'unmatched');
          }, 350);

        }, 300);
      }, 350);
    }, 300);
  };

  // Copy unmatched emails to clipboard
  const handleCopyUnmatched = () => {
    if (!scanResults?.unmatchedEmails?.length) return;
    const text = scanResults.unmatchedEmails.join('\n');
    navigator.clipboard.writeText(text);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2500);
  };

  // Paste from clipboard helper
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(prev => prev ? `${prev}\n${text}` : text);
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  // Load sample demo emails for quick test
  const handleLoadDemo = () => {
    const sampleLeads = (leads || []).slice(0, 5).map(l => l.email).filter(Boolean);
    const demo = [
      ...sampleLeads,
      'demo_non_existing_1@example.com',
      'demo_non_existing_2@example.com'
    ].join('\n');
    setInputText(demo);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Space_Grotesk']">
      <div 
        className="w-full max-w-2xl bg-[#0F172A] border-2 border-[#00C2FF] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden cyan-glow"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E3A5F] flex items-center justify-between bg-[#0A0A0A]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/40 flex items-center justify-center text-[#00C2FF] shrink-0">
              <Search className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Bulk Email Search & Match
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/40 font-bold uppercase">
                  Multi-Query
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Paste any list of email addresses to locate and batch-select leads in seconds.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#1E3A5F] text-gray-400 hover:text-white transition cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* If no scan results yet, show input textarea */}
          {!scanResults && !isScanning && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span>Target Email Addresses List</span>
                  <span className="text-[10px] text-gray-400 font-normal font-mono">
                    (Separated by new lines, commas, or spaces)
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-[11px] text-[#00C2FF] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>Paste</span>
                  </button>
                  <span className="text-[#1E3A5F]">|</span>
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    className="text-[11px] text-gray-400 hover:text-white transition cursor-pointer"
                  >
                    Load Sample
                  </button>
                  {inputText && (
                    <>
                      <span className="text-[#1E3A5F]">|</span>
                      <button
                        type="button"
                        onClick={() => setInputText('')}
                        className="text-[11px] text-red-400 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Paste email list here (10, 50, 100+ emails)...\n\nExample:\njohn.doe@acme.com\nsarah.smith@healthuk.org\ncontact@crewlix.co.uk\nalex@innovate.io`}
                  rows={8}
                  className="w-full p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] text-white font-mono text-xs focus:border-[#00C2FF] focus:outline-none placeholder:text-gray-600 transition-all leading-relaxed"
                />
              </div>

              {/* Status and Parsed Stats Pill */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#111827] border border-[#1E3A5F]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Detected valid emails:</span>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                    parsedEmails.length > 0 
                      ? 'bg-[#00E5A0]/20 text-[#00E5A0] border border-[#00E5A0]/30' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {parsedEmails.length} Emails
                  </span>
                </div>

                <span className="text-[11px] text-[#7B7B7B] font-mono">
                  Searching across {(leads || []).length.toLocaleString()} leads in workspace
                </span>
              </div>
            </div>
          )}

          {/* Interactive Scanning Loading Experience */}
          {isScanning && (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-5 animate-fade-in">
              {/* Radar pulse scanner animation */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#00C2FF]/30 animate-ping opacity-75" />
                <div className="absolute inset-2 rounded-full border border-[#00E5A0]/50 animate-pulse" />
                <div className="w-12 h-12 rounded-full bg-[#00C2FF]/20 border-2 border-[#00C2FF] flex items-center justify-center text-[#00C2FF] shadow-lg shadow-[#00C2FF]/30">
                  <Search className="w-6 h-6 animate-spin" />
                </div>
              </div>

              <div className="space-y-2 max-w-md w-full">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#00C2FF] font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>SCANNING LEADS DATABASE</span>
                  </span>
                  <span className="text-white font-bold">{scanProgress}%</span>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full h-2.5 bg-[#0A0A0A] rounded-full overflow-hidden border border-[#1E3A5F]">
                  <div 
                    className="h-full bg-gradient-to-r from-[#00C2FF] to-[#00E5A0] transition-all duration-300 ease-out"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>

                <p className="text-xs text-gray-300 font-mono pt-1 animate-pulse">
                  {scanStageText}
                </p>
              </div>
            </div>
          )}

          {/* Match Results Display */}
          {scanResults && !isScanning && (
            <div className="space-y-4 animate-fade-in">
              {/* Results Summary Metrics Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                
                {/* Matched Count */}
                <div className="p-3 rounded-xl bg-[#00E5A0]/10 border border-[#00E5A0]/30 text-center">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                    Found in Leads
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-[#00E5A0] block mt-0.5">
                    {scanResults.matchedLeads.length}
                  </span>
                  <span className="text-[10px] text-[#00E5A0]/80 font-mono">
                    {scanResults.matchedEmails.length} unique emails
                  </span>
                </div>

                {/* Unmatched Count */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                    Not Found
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-amber-400 block mt-0.5">
                    {scanResults.unmatchedEmails.length}
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-mono">
                    missing from list
                  </span>
                </div>

                {/* Match Rate */}
                <div className="p-3 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-center">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
                    Match Rate
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-[#00C2FF] block mt-0.5">
                    {scanResults.matchRate}%
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    of {scanResults.inputCount} inputs
                  </span>
                </div>

              </div>

              {/* Tabs for Matched vs Unmatched */}
              <div className="border border-[#1E3A5F] rounded-xl overflow-hidden bg-[#0A0A0A]">
                <div className="flex items-center border-b border-[#1E3A5F] bg-[#111827]">
                  <button
                    onClick={() => setActiveResultTab('matched')}
                    className={`flex-1 py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeResultTab === 'matched' 
                        ? 'text-[#00E5A0] border-b-2 border-[#00E5A0] bg-[#0A0A0A]' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Matched Leads ({scanResults.matchedLeads.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveResultTab('unmatched')}
                    className={`flex-1 py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeResultTab === 'unmatched' 
                        ? 'text-amber-400 border-b-2 border-amber-400 bg-[#0A0A0A]' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Unmatched Emails ({scanResults.unmatchedEmails.length})</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-3 max-h-48 overflow-y-auto">
                  {activeResultTab === 'matched' ? (
                    scanResults.matchedLeads.length > 0 ? (
                      <div className="space-y-1.5">
                        {scanResults.matchedLeads.map((lead, idx) => (
                          <div 
                            key={lead.id || idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-[#111827]/80 hover:bg-[#1E3A5F]/40 border border-[#1E3A5F]/60 text-xs font-mono"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-[#00E5A0] font-bold">#{idx + 1}</span>
                              <span className="text-white truncate font-medium">{lead.email}</span>
                              {lead.firstName && (
                                <span className="text-gray-400 text-[11px] truncate">({lead.firstName})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[#0A0A0A] text-[#00C2FF] border border-[#00C2FF]/30">
                                {lead.stage || lead.status || 'Active'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-gray-500">
                        No matching leads found in this workspace.
                      </div>
                    )
                  ) : (
                    scanResults.unmatchedEmails.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[11px] text-gray-400">
                            The following {scanResults.unmatchedEmails.length} emails do not exist in the current workspace:
                          </span>
                          <button
                            onClick={handleCopyUnmatched}
                            className="px-2 py-1 rounded bg-[#111827] hover:bg-[#1E3A5F] text-[#00C2FF] border border-[#00C2FF]/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            {copyToast ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                            <span>{copyToast ? 'Copied!' : 'Copy Missing List'}</span>
                          </button>
                        </div>
                        <div className="space-y-1">
                          {scanResults.unmatchedEmails.map((email, idx) => (
                            <div 
                              key={idx}
                              className="p-1.5 rounded bg-amber-500/5 border border-amber-500/20 text-amber-300 font-mono text-[11px] flex items-center gap-2"
                            >
                              <span className="text-amber-500/60">#{idx + 1}</span>
                              <span>{email}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-[#00E5A0] font-medium flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>All {scanResults.inputCount} emails were successfully matched!</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#1E3A5F] bg-[#0A0A0A]/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Left Action: Reset / Back */}
          {scanResults && !isScanning ? (
            <button
              onClick={() => {
                setScanResults(null);
                setScanProgress(0);
              }}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#111827] hover:bg-[#1E3A5F] text-gray-300 hover:text-white border border-[#1E3A5F] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Modify Email List</span>
            </button>
          ) : (
            <div className="text-[11px] text-gray-500 font-mono hidden sm:block">
              {parsedEmails.length > 0 ? `${parsedEmails.length} emails ready to search` : 'Paste list to begin'}
            </div>
          )}

          {/* Right Action: Run Scan OR Apply to Table */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white transition text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            {!scanResults ? (
              <button
                onClick={handleStartScan}
                disabled={parsedEmails.length === 0 || isScanning}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/85 text-[#0A0A0A] font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-[#00C2FF]/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Search className="w-4 h-4 stroke-[2.5]" />
                <span>Run Bulk Match ({parsedEmails.length})</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Apply Filter Only */}
                <button
                  onClick={() => {
                    onApplyMatches({
                      emails: scanResults.matchedEmails,
                      leadIds: scanResults.matchedLeadIds,
                      autoSelect: false,
                      totalSearched: scanResults.inputCount,
                      unmatchedCount: scanResults.unmatchedEmails.length,
                      unmatchedList: scanResults.unmatchedEmails
                    });
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#111827] hover:bg-[#1E3A5F] text-white border border-[#1E3A5F] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Filter the All Leads Sheet to these matches without selecting checkboxes"
                >
                  <Filter className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span>Filter Only</span>
                </button>

                {/* Primary: Apply & Select All for Immediate Bulk Edit */}
                <button
                  onClick={() => {
                    onApplyMatches({
                      emails: scanResults.matchedEmails,
                      leadIds: scanResults.matchedLeadIds,
                      autoSelect: true,
                      totalSearched: scanResults.inputCount,
                      unmatchedCount: scanResults.unmatchedEmails.length,
                      unmatchedList: scanResults.unmatchedEmails
                    });
                    onClose();
                  }}
                  disabled={scanResults.matchedLeads.length === 0}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/85 text-[#0A0A0A] font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-[#00E5A0]/20 cursor-pointer disabled:opacity-40"
                  title="Filter table and select all checkboxes so you can immediately bulk edit"
                >
                  <Sparkles className="w-4 h-4 stroke-[2.5]" />
                  <span>Filter & Select All ({scanResults.matchedLeads.length})</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
