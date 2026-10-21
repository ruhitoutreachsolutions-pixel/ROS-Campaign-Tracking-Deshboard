import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { fetchDncRegistryFromCloud } from '../services/db';
import { isLeadUnsubscribedFromLink } from '../utils/helpers';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Mail, 
  Link2, 
  ShieldCheck, 
  Code2, 
  FileText, 
  Sparkles,
  Globe,
  Ban,
  Search,
  Download,
  RefreshCw,
  Clock,
  Building2,
  Calendar,
  UserX
} from 'lucide-react';

export default function UnsubscribeLinkModal({ isOpen, onClose, initialTab = 'generator' }) {
  const { currentWorkspace, workspaces } = useWorkspace();
  const [activeTab, setActiveTab] = useState(initialTab); // 'generator' | 'submissions'
  const [selectedWsId, setSelectedWsId] = useState(currentWorkspace?.id || 'ws_crewlixukltd');
  const [tagFormat, setTagFormat] = useState('sheets_email_address'); // 'sheets_email_address' | 'sheets_email' | 'cold_email'
  const [copiedKey, setCopiedKey] = useState(null);

  // Submissions Log State
  const [cloudDncList, setCloudDncList] = useState([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);

  // Fetch DNC records from cloud registry
  const loadSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const records = await fetchDncRegistryFromCloud();
      setCloudDncList(Array.isArray(records) ? records : []);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.warn('Failed to fetch DNC registry:', err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSubmissions();
    }
  }, [isOpen]);

  // Combined & Deduplicated Unsubscribe Log across Cloud Registry & Loaded Workspaces
  const allSubmissions = useMemo(() => {
    const map = new Map();

    // 1. Add records from cloud DNC registry
    (cloudDncList || []).forEach(record => {
      if (!record || !record.email) return;
      const clean = record.email.trim().toLowerCase();
      
      // Match with lead in workspaces to get contact name & company
      let matchedLead = null;
      let matchedWsName = '';
      for (const ws of (workspaces || [])) {
        if (!ws || !Array.isArray(ws.leads)) continue;
        const l = ws.leads.find(x => x && x.email && x.email.trim().toLowerCase() === clean);
        if (l) {
          matchedLead = l;
          matchedWsName = ws.name || 'Crewlix UK LTD';
          break;
        }
      }

      map.set(clean, {
        email: clean,
        leadId: record.leadId || matchedLead?.id || '',
        firstName: matchedLead?.firstName || '',
        companyName: matchedLead?.companyName || '',
        workspaceId: record.workspaceId || matchedLead?.workspaceId || '',
        workspaceName: matchedWsName || (record.workspaceId === 'ws_zrnl1fjb' ? 'CGE UK LTD' : 'Crewlix UK LTD'),
        reason: record.reason || 'Public unsubscribe link (unsub.crewlixhr.co.uk)',
        unsubscribedAt: record.unsubscribedAt || new Date().toISOString()
      });
    });

    // 2. Also incorporate any lead in workspaces marked with unsubscribedFromLink
    (workspaces || []).forEach(ws => {
      if (!ws || !Array.isArray(ws.leads)) return;
      ws.leads.forEach(l => {
        if (!l || !l.email) return;
        if (isLeadUnsubscribedFromLink(l)) {
          const clean = l.email.trim().toLowerCase();
          if (!map.has(clean)) {
            map.set(clean, {
              email: clean,
              leadId: l.id || '',
              firstName: l.firstName || '',
              companyName: l.companyName || '',
              workspaceId: ws.id,
              workspaceName: ws.name || 'Crewlix UK LTD',
              reason: l.unsubscribeReason || 'Public unsubscribe link',
              unsubscribedAt: l.unsubscribedAt || l.updatedAt || new Date().toISOString()
            });
          }
        }
      });
    });

    const list = Array.from(map.values());
    // Sort latest first
    list.sort((a, b) => new Date(b.unsubscribedAt || 0) - new Date(a.unsubscribedAt || 0));
    return list;
  }, [cloudDncList, workspaces]);

  // Filtered submissions based on search query
  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return allSubmissions;
    const q = searchQuery.toLowerCase().trim();
    return allSubmissions.filter(item => 
      (item.email || '').toLowerCase().includes(q) ||
      (item.firstName || '').toLowerCase().includes(q) ||
      (item.companyName || '').toLowerCase().includes(q) ||
      (item.reason || '').toLowerCase().includes(q) ||
      (item.workspaceName || '').toLowerCase().includes(q)
    );
  }, [allSubmissions, searchQuery]);

  if (!isOpen) return null;

  const targetWs = workspaces?.find(w => w.id === selectedWsId) || currentWorkspace;
  const subdomainBase = 'https://unsub.crewlixhr.co.uk';

  const emailTag = tagFormat === 'sheets_email_address' 
    ? '{{Email Address}}' 
    : tagFormat === 'sheets_email' 
      ? '{{Email}}' 
      : '{{email}}';

  const rawUrl = `${subdomainBase}/?email=${emailTag}&ws=${targetWs?.id || ''}`;
  const htmlSnippet = `<p style="font-size: 11px; color: #888888; margin-top: 24px;">If you would prefer not to receive future emails, you can <a href="${rawUrl}" style="color: #666666; text-decoration: underline;">unsubscribe here</a>.</p>`;
  const plainTextSnippet = `To unsubscribe from future emails, please visit: ${rawUrl}`;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleExportCSV = () => {
    if (allSubmissions.length === 0) return;
    const headers = ['Email Address', 'First Name', 'Company Name', 'Workspace', 'Unsubscribed At', 'Reason', 'Status'];
    const rows = allSubmissions.map(item => [
      `"${item.email}"`,
      `"${(item.firstName || '').replace(/"/g, '""')}"`,
      `"${(item.companyName || '').replace(/"/g, '""')}"`,
      `"${item.workspaceName}"`,
      `"${new Date(item.unsubscribedAt).toLocaleString()}"`,
      `"${(item.reason || '').replace(/"/g, '""')}"`,
      `"DNC / Excluded"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `unsubscribed-leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Space_Grotesk']">
      <div 
        className="w-full max-w-3xl bg-[#0F172A] border-2 border-[#00C2FF] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden cyan-glow"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E3A5F] flex items-center justify-between bg-[#0A0A0A]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00C2FF]/15 border border-[#00C2FF]/40 flex items-center justify-center text-[#00C2FF] shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Unsubscribe Operations Hub
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold uppercase">
                  unsub.crewlixhr.co.uk
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Generate email sequences links and track live public unsubscribe submissions.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[#1E3A5F] text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-4 sm:px-6 pt-3 pb-2 gap-2 border-b border-[#1E3A5F] bg-[#111827]">
          <button
            onClick={() => setActiveTab('generator')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'generator'
                ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                : 'text-gray-400 hover:text-white hover:bg-[#1E3A5F]/50'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Link Generator</span>
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-gray-400 hover:text-rose-300 hover:bg-rose-950/30'
            }`}
          >
            <Ban className="w-3.5 h-3.5 text-rose-400" />
            <span>Unsubscribed Contacts Log</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'submissions' 
                ? 'bg-black/30 text-white' 
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}>
              {allSubmissions.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          
          {/* ======================================================== */}
          {/* TAB 1: LINK GENERATOR */}
          {/* ======================================================== */}
          {activeTab === 'generator' && (
            <div className="space-y-5">
              {/* Workspace Selection & Domain Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">
                    Target Workspace
                  </label>
                  <select
                    value={selectedWsId}
                    onChange={(e) => setSelectedWsId(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#00C2FF]"
                  >
                    {workspaces.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.leads?.length || 0} leads)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">
                    Cloud Subdomain Status
                  </label>
                  <div className="flex items-center justify-between bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono">
                    <span className="flex items-center gap-1.5 truncate">
                      <Globe className="w-3.5 h-3.5 text-[#00C2FF]" />
                      <span>unsub.crewlixhr.co.uk</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Mail Merge Format / Tag Selector */}
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1.5">
                  Sending Tool / Variable Format:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTagFormat('sheets_email_address')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                      tagFormat === 'sheets_email_address'
                        ? 'bg-[#00C2FF]/15 border-[#00C2FF] text-white cyan-glow'
                        : 'bg-[#0A0A0A] border-[#1E3A5F] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-[#00C2FF]">Google Sheets / Mailer</span>
                    <span className="text-[10px] text-gray-200 font-mono">{'{{Email Address}}'}</span>
                    <span className="text-[9px] text-gray-400">Campaign Mailer / YAMM / ROS TSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagFormat('sheets_email')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                      tagFormat === 'sheets_email'
                        ? 'bg-[#00C2FF]/15 border-[#00C2FF] text-white cyan-glow'
                        : 'bg-[#0A0A0A] border-[#1E3A5F] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-[#00E5A0]">Google Sheets ("Email")</span>
                    <span className="text-[10px] text-gray-200 font-mono">{'{{Email}}'}</span>
                    <span className="text-[9px] text-gray-400">Sheets with header named "Email"</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTagFormat('cold_email')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                      tagFormat === 'cold_email'
                        ? 'bg-[#00C2FF]/15 border-[#00C2FF] text-white cyan-glow'
                        : 'bg-[#0A0A0A] border-[#1E3A5F] text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-amber-400">Cold Email Tools</span>
                    <span className="text-[10px] text-gray-200 font-mono">{'{{email}}'}</span>
                    <span className="text-[9px] text-gray-400">Instantly, Lemlist, Smartlead</span>
                  </button>
                </div>
              </div>

              {/* Explanation Box */}
              <div className="p-3 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 text-gray-300 text-xs flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#00C2FF] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-white text-[11px]">How Google Sheets Mail Merge replaces recipient emails:</p>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    In Google Sheets Mail Merge (Campaign Mailer), variables <strong>must match your sheet column header exactly</strong>. If your column is titled <span className="text-[#00C2FF] font-mono bg-black/60 px-1 py-0.5 rounded font-bold">Email Address</span>, use <span className="text-[#00E5A0] font-mono bg-black/60 px-1 py-0.5 rounded font-bold">{'{{Email Address}}'}</span> so the mailer automatically injects the recipient's email address upon sending.
                  </p>
                </div>
              </div>

              {/* Snippet 1: Raw URL Tag */}
              <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#00C2FF]" />
                    <span>1. Direct URL Tag (Mail Merge Variable)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(rawUrl, 'raw')}
                    className="px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] text-[#00C2FF] hover:text-white border border-[#00C2FF]/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    {copiedKey === 'raw' ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'raw' ? 'Copied!' : 'Copy URL'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-[#111827] border border-[#1E3A5F] text-gray-300 font-mono text-[11px] break-all select-all">
                  {rawUrl}
                </div>
                <p className="text-[11px] text-gray-500">
                  Paste this link into your email sequence. <code className="text-[#00C2FF] font-mono">{emailTag}</code> will be automatically replaced with each recipient's actual email.
                </p>
              </div>

              {/* Snippet 2: HTML Email Footer */}
              <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-[#00E5A0]" />
                    <span>2. Ready-to-Paste HTML Footer</span>
                  </span>
                  <button
                    onClick={() => handleCopy(htmlSnippet, 'html')}
                    className="px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] text-[#00E5A0] hover:text-white border border-[#00E5A0]/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    {copiedKey === 'html' ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'html' ? 'Copied!' : 'Copy HTML'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-[#111827] border border-[#1E3A5F] text-gray-300 font-mono text-[11px] break-all select-all">
                  {htmlSnippet}
                </div>
              </div>

              {/* Snippet 3: Plain Text Footer */}
              <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>3. Plain Text Email Footer</span>
                  </span>
                  <button
                    onClick={() => handleCopy(plainTextSnippet, 'text')}
                    className="px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] text-amber-400 hover:text-white border border-amber-400/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                  >
                    {copiedKey === 'text' ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'text' ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-[#111827] border border-[#1E3A5F] text-gray-300 font-mono text-[11px] break-all select-all">
                  {plainTextSnippet}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: UNREGISTERED CONTACTS LOG (AUDIT TRAIL) */}
          {/* ======================================================== */}
          {activeTab === 'submissions' && (
            <div className="space-y-4">
              {/* Metrics & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0A0A0A] border border-[#1E3A5F]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    <UserX className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">
                        {allSubmissions.length}
                      </span>
                      <span className="text-xs text-rose-300 font-medium">
                        Total Public Unsubscribes Recorded
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Cloud Registry synced · Auto-excluded from all Mail Merge dispatches
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadSubmissions}
                    disabled={isLoadingSubmissions}
                    className="px-2.5 py-1.5 rounded-xl bg-[#111827] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-gray-300 hover:text-white transition flex items-center gap-1 text-xs cursor-pointer"
                    title="Refresh data from Supabase cloud"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#00C2FF] ${isLoadingSubmissions ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    disabled={allSubmissions.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-[#00E5A0]/15 hover:bg-[#00E5A0]/25 border border-[#00E5A0]/40 text-[#00E5A0] font-bold transition flex items-center gap-1.5 text-xs cursor-pointer"
                    title="Export unsubscribed contacts to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search unsubscribed leads by email, company, or reason..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white placeholder-gray-500 text-xs outline-none focus:border-[#00C2FF]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Submissions Table */}
              <div className="rounded-2xl border border-[#1E3A5F] bg-[#0A0A0A] overflow-hidden">
                <div className="overflow-x-auto max-h-[350px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#1E3A5F] bg-[#111827]/80 text-[#7B7B7B] text-[10px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Recipient Email</th>
                        <th className="py-2.5 px-3">Contact & Company</th>
                        <th className="py-2.5 px-3">Unsubscribed At</th>
                        <th className="py-2.5 px-3">Reason Selected</th>
                        <th className="py-2.5 px-3">Workspace</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E3A5F]/40">
                      {filteredSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">
                            {searchQuery ? (
                              <span>No unsubscribed leads match "{searchQuery}"</span>
                            ) : (
                              <div className="space-y-1">
                                <p className="font-semibold text-gray-300">No public unsubscribes recorded yet</p>
                                <p className="text-[11px] text-gray-500">
                                  When a recipient clicks unsubscribe on your sequences, their submission will appear here instantly.
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map((sub, idx) => (
                          <tr key={sub.email + idx} className="hover:bg-[#111827]/60 transition-colors">
                            {/* Email */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-white select-all font-semibold">
                                  {sub.email}
                                </span>
                                <button
                                  onClick={() => handleCopy(sub.email, `email_${idx}`)}
                                  className="text-gray-500 hover:text-[#00C2FF] p-0.5 rounded cursor-pointer"
                                  title="Copy email"
                                >
                                  {copiedKey === `email_${idx}` ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>

                            {/* Contact & Company */}
                            <td className="py-2.5 px-3 text-gray-300">
                              {sub.companyName || sub.firstName ? (
                                <div>
                                  <div className="font-semibold text-white">{sub.companyName || '—'}</div>
                                  {sub.firstName && <div className="text-[10px] text-gray-400">{sub.firstName}</div>}
                                </div>
                              ) : (
                                <span className="text-gray-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Unsubscribed Date */}
                            <td className="py-2.5 px-3 text-gray-300 font-mono text-[11px] whitespace-nowrap">
                              {sub.unsubscribedAt ? (
                                <div className="flex items-center gap-1 text-rose-300">
                                  <Clock className="w-3 h-3 text-rose-400" />
                                  <span>{new Date(sub.unsubscribedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>

                            {/* Reason */}
                            <td className="py-2.5 px-3 text-gray-300 max-w-[200px] truncate" title={sub.reason}>
                              <span className="italic text-gray-300">"{sub.reason || 'Public unsubscribe link'}"</span>
                            </td>

                            {/* Workspace */}
                            <td className="py-2.5 px-3 text-gray-300 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full bg-[#111827] border border-[#1E3A5F] text-[10px] text-gray-300 font-medium">
                                {sub.workspaceName}
                              </span>
                            </td>

                            {/* Protection Status */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold uppercase tracking-wider font-mono">
                                ⛔ DNC
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#1E3A5F] bg-[#0A0A0A]/90 flex items-center justify-between">
          <a
            href={`${subdomainBase}/?email=test.recipient@example.com&ws=${targetWs?.id || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#00C2FF] hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Test Landing Page in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/85 text-[#0A0A0A] font-bold text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
