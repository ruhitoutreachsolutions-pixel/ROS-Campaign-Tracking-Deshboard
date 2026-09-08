import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Globe, 
  CheckSquare, 
  Square, 
  ExternalLink, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Edit3, 
  UploadCloud, 
  Download, 
  Search, 
  Filter, 
  TrendingUp, 
  Clock, 
  Building2, 
  X, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { copyToClipboard, getTodayFormatted } from '../utils/helpers';

export default function FormSubmissions() {
  const { 
    currentWorkspace, 
    currentWorkspaceId,
    workspaces,
    formSubmissions, 
    addFormSubmission, 
    bulkAddFormSubmissions, 
    toggleFormSubmissionStatus, 
    updateFormSubmission, 
    deleteFormSubmission,
    currentUser,
    effectiveRole,
    isAutoSyncing,
    lastSyncedTime
  } = useWorkspace();

  const isAdmin = effectiveRole === 'admin';
  const isWarrior = effectiveRole === 'warrior';
  const isReadOnly = isWarrior && currentUser?.accessLevel === 'view';

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'submitted'
  const [workspaceFilter, setWorkspaceFilter] = useState(currentWorkspaceId || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Single form input state
  const [singleUrl, setSingleUrl] = useState('');
  const [singleWsId, setSingleWsId] = useState(currentWorkspaceId || (workspaces[0]?.id || ''));
  const [singleNotes, setSingleNotes] = useState('');

  // Bulk import input state
  const [bulkUrlsText, setBulkUrlsText] = useState('');
  const [bulkWsId, setBulkWsId] = useState(currentWorkspaceId || (workspaces[0]?.id || ''));

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return (formSubmissions || []).filter(item => {
      if (!item) return false;

      // Workspace filter
      if (workspaceFilter !== 'all' && item.workspaceId !== workspaceFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'submitted' && !item.submitted) return false;
      if (statusFilter === 'pending' && item.submitted) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUrl = (item.formUrl || '').toLowerCase().includes(q);
        const matchesDate = (item.submissionDate || '').toLowerCase().includes(q);
        const matchesUser = (item.submittedBy || '').toLowerCase().includes(q);
        const matchesNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchesUrl && !matchesDate && !matchesUser && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [formSubmissions, workspaceFilter, statusFilter, searchQuery]);

  // Metrics for current filter context
  const metrics = useMemo(() => {
    const relevant = (formSubmissions || []).filter(item => {
      if (!item) return false;
      if (workspaceFilter !== 'all' && item.workspaceId !== workspaceFilter) return false;
      return true;
    });

    const total = relevant.length;
    const submitted = relevant.filter(i => i.submitted).length;
    const pending = total - submitted;
    const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;

    return { total, submitted, pending, rate };
  }, [formSubmissions, workspaceFilter]);

  // Copy URL to clipboard
  const handleCopyUrl = (url, id) => {
    copyToClipboard(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Add single form submission
  const handleAddSingle = (e) => {
    e.preventDefault();
    if (!singleUrl.trim()) return;

    let cleanUrl = singleUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    addFormSubmission({
      formUrl: cleanUrl,
      workspaceId: singleWsId || currentWorkspaceId,
      notes: singleNotes
    });

    setSingleUrl('');
    setSingleNotes('');
    setAddModalOpen(false);
  };

  // Bulk import form submissions
  const handleBulkImport = (e) => {
    e.preventDefault();
    if (!bulkUrlsText.trim()) return;

    const lines = bulkUrlsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Strip leading numbers or bullets (e.g. "1. http://..." or "- http://...")
        const stripped = line.replace(/^[\d\.\-\*\s]+/, '').trim();
        if (!stripped) return null;
        if (!/^https?:\/\//i.test(stripped)) {
          return 'https://' + stripped;
        }
        return stripped;
      })
      .filter(Boolean);

    if (lines.length > 0) {
      bulkAddFormSubmissions(lines, bulkWsId || currentWorkspaceId);
    }

    setBulkUrlsText('');
    setBulkModalOpen(false);
  };

  // Export submissions to CSV/TSV
  const handleExportTSV = () => {
    const headers = ['Contact Form', 'Submission Status', 'Date', 'Submitted By', 'Workspace ID', 'Notes'];
    const rows = filteredSubmissions.map(item => [
      item.formUrl || '',
      item.submitted ? 'Submitted' : 'Pending',
      item.submissionDate || '',
      item.submittedBy || '',
      item.workspaceId || '',
      (item.notes || '').replace(/[\r\n\t]+/g, ' ')
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    copyToClipboard(tsvContent);
    alert(`Copied ${rows.length} rows to clipboard in spreadsheet TSV format! You can paste directly into Google Sheets or Excel.`);
  };

  // Find workspace display name
  const getWorkspaceName = (wsId) => {
    const ws = (workspaces || []).find(w => w.id === wsId);
    return ws ? (ws.clientName || ws.name) : wsId;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* 1. Header Banner matching ROS Cyberpunk Style */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111827] via-[#0F2238] to-[#111827] border border-[#1E3A5F] text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00C2FF]/15 border border-[#00C2FF]/30 rounded-full text-[#00C2FF] text-xs font-semibold mb-2">
            <Globe className="w-3.5 h-3.5" />
            <span>Web Outreach Automation · Contact Form Submissions</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-white">
            Contact Form Submissions Tracker
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Track outbound contact form submissions, record completion timestamps in real time, and audit manager workflow.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setSingleWsId(currentWorkspaceId);
              setAddModalOpen(true);
            }}
            disabled={isReadOnly}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00C2FF] hover:bg-[#00C2FF]/80 disabled:opacity-50 text-[#0A0A0A] rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-[#00C2FF]/20 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Single URL</span>
          </button>

          <button
            onClick={() => {
              setBulkWsId(currentWorkspaceId);
              setBulkModalOpen(true);
            }}
            disabled={isReadOnly}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111827] hover:bg-[#1E3A5F] border border-[#00C2FF]/40 text-[#00C2FF] rounded-xl text-xs sm:text-sm font-bold shadow transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Bulk Import URLs</span>
          </button>

          <button
            onClick={handleExportTSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#0A0A0A] hover:bg-[#111827] border border-[#1E3A5F] text-gray-300 hover:text-white rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer"
            title="Export to Spreadsheet (TSV format)"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Sheet</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Forms */}
        <div className="bg-[#111827] border border-[#1E3A5F] p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Contact Forms</span>
            <div className="w-8 h-8 rounded-xl bg-[#00C2FF]/10 text-[#00C2FF] flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {metrics.total.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <span>In current workspace view</span>
          </div>
        </div>

        {/* Submitted */}
        <div className="bg-[#111827] border border-[#1E3A5F] p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Submitted Status</span>
            <div className="w-8 h-8 rounded-xl bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#EF4444] font-mono mt-2">
            {metrics.submitted.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#EF4444]/80 mt-1 flex items-center gap-1 font-medium">
            <span>✓ Verified form submissions</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-[#111827] border border-[#1E3A5F] p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Outbound</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-2">
            {metrics.pending.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1 font-medium">
            <span>Awaiting warrior submission</span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-[#111827] border border-[#1E3A5F] p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Completion Rate</span>
            <div className="w-8 h-8 rounded-xl bg-[#00E5A0]/15 text-[#00E5A0] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#00E5A0] font-mono mt-2">
            {metrics.rate}%
          </div>
          <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
            <span>Progress through queue</span>
          </div>
        </div>
      </div>

      {/* 3. Controls & Filter Bar */}
      <div className="bg-[#111827] border border-[#1E3A5F] p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#00C2FF] text-[#0A0A0A] shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({metrics.total})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-[#0A0A0A] shadow'
                : 'text-gray-400 hover:text-amber-400'
            }`}
          >
            Pending ({metrics.pending})
          </button>
          <button
            onClick={() => setStatusFilter('submitted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'submitted'
                ? 'bg-[#EF4444] text-white shadow'
                : 'text-gray-400 hover:text-[#EF4444]'
            }`}
          >
            Submitted ({metrics.submitted})
          </button>
        </div>

        {/* Right side: Workspace select & search bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Workspace Select */}
          <div className="relative">
            <select
              value={workspaceFilter}
              onChange={(e) => setWorkspaceFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-xs text-white outline-none cursor-pointer"
            >
              <option value="all">All Workspaces</option>
              {(workspaces || []).map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.clientName || ws.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search URLs, dates, submitter..."
              className="w-full pl-9 pr-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-xs text-white placeholder:text-gray-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 4. Interactive Spreadsheet Table (Matching Screenshot Design) */}
      <div className="bg-[#111827] border border-[#1E3A5F] rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Spreadsheet Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Table Header */}
            <thead>
              <tr className="bg-[#0A0A0A] border-b border-[#1E3A5F] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {/* Column A */}
                <th className="py-3 px-4 border-r border-[#1E3A5F]/60 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#00C2FF] bg-[#00C2FF]/10 px-1.5 py-0.5 rounded">A</span>
                    <span>Contact Form</span>
                  </div>
                </th>

                {/* Column B */}
                <th className="py-3 px-4 border-r border-[#1E3A5F]/60 text-center min-w-[150px]">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-mono text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded">B</span>
                    <span>Submission Status</span>
                  </div>
                </th>

                {/* Column C */}
                <th className="py-3 px-4 border-r border-[#1E3A5F]/60 text-center min-w-[130px]">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-mono text-[#00E5A0] bg-[#00E5A0]/10 px-1.5 py-0.5 rounded">C</span>
                    <span>Date</span>
                  </div>
                </th>

                {/* Column D: Metadata / Submitter */}
                <th className="py-3 px-4 border-r border-[#1E3A5F]/60 min-w-[160px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">D</span>
                    <span>Submitted By / Client</span>
                  </div>
                </th>

                {/* Actions */}
                <th className="py-3 px-4 text-center min-w-[90px]">
                  <span>Actions</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#1E3A5F]/40 text-xs font-mono">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-500 font-sans">
                    <Globe className="w-12 h-12 mx-auto mb-3 text-[#1E3A5F] animate-pulse" />
                    <h3 className="text-sm font-bold text-gray-300">No Contact Forms Found</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'No submissions match your current filters. Try resetting the search or filter.' 
                        : 'No contact form URLs added yet. Click "Add Single URL" or "Bulk Import URLs" to start tracking.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((item, idx) => {
                  const isSubmitted = Boolean(item.submitted);
                  const isCopied = copiedId === item.id;

                  return (
                    <tr 
                      key={item.id || idx}
                      className={`transition group ${
                        isSubmitted ? 'bg-[#111827]/40 hover:bg-[#111827]' : 'hover:bg-[#111827]/80'
                      }`}
                    >
                      {/* Column A: Contact Form URL */}
                      <td className="py-3 px-4 border-r border-[#1E3A5F]/50 font-sans">
                        <div className="flex items-center gap-2">
                          <a
                            href={item.formUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#00C2FF] hover:text-[#00E5A0] hover:underline font-medium text-xs break-all flex items-center gap-1.5 transition"
                            title={item.formUrl}
                          >
                            <span className="truncate max-w-xs sm:max-w-md lg:max-w-lg">{item.formUrl}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                          </a>

                          <button
                            onClick={() => handleCopyUrl(item.formUrl, item.id)}
                            className="p-1 rounded text-gray-500 hover:text-white hover:bg-[#1E3A5F] shrink-0 opacity-0 group-hover:opacity-100 transition"
                            title="Copy URL"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-gray-400 mt-0.5 italic truncate max-w-md">
                            Note: {item.notes}
                          </div>
                        )}
                      </td>

                      {/* Column B: Submission Status (Interactive Red Checkbox matching Screenshot) */}
                      <td className="py-3 px-4 border-r border-[#1E3A5F]/50 text-center">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => !isReadOnly && toggleFormSubmissionStatus(item.id)}
                            disabled={isReadOnly}
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all transform active:scale-95 cursor-pointer disabled:cursor-not-allowed ${
                              isSubmitted
                                ? 'bg-[#EF4444] border-2 border-[#EF4444] shadow-md shadow-[#EF4444]/30 text-white'
                                : 'bg-transparent border-2 border-[#EF4444] hover:bg-[#EF4444]/15'
                            }`}
                            title={isSubmitted ? 'Mark as Pending' : 'Mark as Submitted'}
                          >
                            {isSubmitted && (
                              <svg 
                                className="w-4 h-4 text-white stroke-[3.5]" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Column C: Date (DD/MM/YY format matching screenshot) */}
                      <td className="py-3 px-4 border-r border-[#1E3A5F]/50 text-center font-mono text-xs">
                        {isSubmitted ? (
                          <span className="text-gray-200 font-semibold bg-[#0A0A0A] px-2.5 py-1 rounded-lg border border-[#1E3A5F]">
                            {item.submissionDate || getTodayFormatted()}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Column D: Submitted By / Client */}
                      <td className="py-3 px-4 border-r border-[#1E3A5F]/50 font-sans text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-300">
                            {getWorkspaceName(item.workspaceId)}
                          </span>
                          {isSubmitted && item.submittedBy && (
                            <span className="text-[10px] text-[#00C2FF] font-mono">
                              by {item.submittedBy}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column E: Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingItem(item)}
                            disabled={isReadOnly}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1E3A5F] transition disabled:opacity-40"
                            title="Edit notes or details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {(isAdmin || !isReadOnly) && (
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this contact form submission entry?')) {
                                  deleteFormSubmission(item.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-4 bg-[#0A0A0A] border-t border-[#1E3A5F] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 font-mono">
          <div>
            Showing <span className="text-white font-bold">{filteredSubmissions.length}</span> of <span className="text-white font-bold">{metrics.total}</span> records
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#EF4444] font-bold">✓ Red box = Submitted</span>
            <span className="text-gray-500">|</span>
            <span className="text-[#00C2FF]">Real-Time Cloud Synced</span>
          </div>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 5. MODAL: ADD SINGLE FORM URL */}
      {/* ===================================================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E3A5F]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Contact Form URL</h3>
                  <p className="text-xs text-gray-400">Queue a new website contact form for outreach</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingle} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Contact Form URL *
                </label>
                <input
                  type="text"
                  value={singleUrl}
                  onChange={(e) => setSingleUrl(e.target.value)}
                  placeholder="https://example.com/contact-us"
                  className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-sm text-white placeholder:text-gray-500 outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Client Workspace
                </label>
                <select
                  value={singleWsId}
                  onChange={(e) => setSingleWsId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-sm text-white outline-none cursor-pointer"
                >
                  {(workspaces || []).map(ws => (
                    <option key={ws.id} value={ws.id}>
                      {ws.clientName || ws.name} ({ws.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Internal Notes / Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={singleNotes}
                  onChange={(e) => setSingleNotes(e.target.value)}
                  placeholder="e.g. Inquire about marketing partnerships"
                  className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-sm text-white placeholder:text-gray-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2.5 border border-[#1E3A5F] rounded-xl text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!singleUrl.trim()}
                  className="px-5 py-2.5 bg-[#00C2FF] hover:bg-[#00C2FF]/80 disabled:opacity-40 text-[#0A0A0A] rounded-xl text-sm font-bold shadow-lg shadow-[#00C2FF]/20 transition cursor-pointer"
                >
                  Add Form URL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL: BULK IMPORT CONTACT FORM URLS */}
      {/* ===================================================================== */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E3A5F]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF]">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Bulk Import Contact Form URLs</h3>
                  <p className="text-xs text-gray-400">Paste a list of URLs directly from Google Sheets or Excel</p>
                </div>
              </div>
              <button
                onClick={() => setBulkModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkImport} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Target Client Workspace
                </label>
                <select
                  value={bulkWsId}
                  onChange={(e) => setBulkWsId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-sm text-white outline-none cursor-pointer"
                >
                  {(workspaces || []).map(ws => (
                    <option key={ws.id} value={ws.id}>
                      {ws.clientName || ws.name} ({ws.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-300">
                    Paste URLs (One URL per line)
                  </label>
                  <span className="text-[11px] text-[#00C2FF] font-mono">
                    {bulkUrlsText.split('\n').filter(l => l.trim().length > 0).length} URLs detected
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={bulkUrlsText}
                  onChange={(e) => setBulkUrlsText(e.target.value)}
                  placeholder={`https://famraed.wixsite.com\nhttps://elitedigitalcoach.com\nhttps://www.facebook.com\nhttps://salalem.com\nhttp://www.manhal.com`}
                  className="w-full p-4 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-2xl text-xs font-mono text-white placeholder:text-gray-600 outline-none leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2.5 border border-[#1E3A5F] rounded-xl text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkUrlsText.trim()}
                  className="px-5 py-2.5 bg-[#00C2FF] hover:bg-[#00C2FF]/80 disabled:opacity-40 text-[#0A0A0A] rounded-xl text-sm font-bold shadow-lg shadow-[#00C2FF]/20 transition cursor-pointer"
                >
                  Import URLs into Tracker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. MODAL: EDIT FORM SUBMISSION DETAILS */}
      {/* ===================================================================== */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E3A5F]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#00C2FF]" />
                <span>Edit Contact Form Details</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateFormSubmission(editingItem.id, editingItem);
                setEditingItem(null);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Contact Form URL</label>
                <input
                  type="text"
                  value={editingItem.formUrl || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, formUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs font-mono text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Submission Date (DD/MM/YY)</label>
                  <input
                    type="text"
                    value={editingItem.submissionDate || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, submissionDate: e.target.value })}
                    placeholder="DD/MM/YY"
                    className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs font-mono text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Submitted By</label>
                  <input
                    type="text"
                    value={editingItem.submittedBy || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, submittedBy: e.target.value })}
                    placeholder="Warrior Name"
                    className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  placeholder="Notes..."
                  className="w-full px-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 border border-[#1E3A5F] rounded-xl text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-[#0A0A0A] rounded-xl text-sm font-bold shadow transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
