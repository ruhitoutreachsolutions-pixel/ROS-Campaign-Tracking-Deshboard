import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportLeadsToCSV } from '../utils/helpers';
import BulkEditModal from './BulkEditModal';
import { 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Trash2, 
  Check, 
  Copy, 
  Send, 
  MoreVertical, 
  Edit3, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Mail,
  Building2,
  MapPin,
  ExternalLink,
  FolderOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  Cloud,
  RefreshCw,
  AlertCircle,
  Sliders
} from 'lucide-react';

export default function LeadsTable({ onOpenImportModal, onOpenLeadDetail, onOpenCloudSync }) {
  const {
    currentWorkspace,
    currentUser,
    copyBatchForMailMerge,
    applyBatchSentStatus,
    deleteLead,
    bulkDeleteLeads,
    updateLead,
    syncAllWorkspacesToCloud
  } = useWorkspace();

  const isAdmin = currentUser?.role === 'admin';
  const leads = currentWorkspace?.leads || [];

  // Global Search
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Column Filters State: { [colKey]: string[] | null } -> null or empty array means all selected
  const [columnFilters, setColumnFilters] = useState({});
  
  // Column Sort State: { key: string | null, direction: 'asc' | 'desc' | null }
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  
  // Active Filter Dropdown open: columnKey string or null
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  // Selected Leads for Batch Actions
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [copyToast, setCopyToast] = useState(false);
  const [applyToast, setApplyToast] = useState(false);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState(false);
  const [bulkEditToast, setBulkEditToast] = useState(null);

  // Cloud Sync Notification & Status State
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncToast, setCloudSyncToast] = useState(null); // { type: 'success' | 'warning' | 'error', message: string }

  // Close dropdown when clicking outside
  const dropdownRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveFilterCol(null);
        setFilterSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Columns Definition
  const columns = [
    { key: 'email', label: 'Email Address', type: 'text', color: '#00C2FF' },
    { key: 'firstName', label: 'First Name', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'companyName', label: 'Company Name', type: 'text' },
    { key: 'campaignName', label: 'Campaign', type: 'text' },
    { key: 'email1', label: 'Email 1', type: 'status' },
    { key: 'email2', label: 'Email 2', type: 'status' },
    { key: 'email3', label: 'Email 3', type: 'status' },
    { key: 'accountName', label: 'Account Name', type: 'text' },
    { key: 'stage', label: 'Pipeline Stage', type: 'stage' }
  ];

  // Helper to extract clean value for lead column
  const getLeadValue = (lead, key) => {
    if (key === 'campaignName') return lead.campaignName || currentWorkspace?.campaignName || 'General Outbound';
    if (key === 'accountName') return lead.accountName || currentWorkspace?.activeSendingAccount || '';
    if (key === 'stage') return lead.stage || (lead.status === 'interested' ? 'Interested' : 'In Progress');
    return lead[key] || '';
  };

  // Compute Unique Values and Counts for each column
  const columnUniqueValues = useMemo(() => {
    const map = {};
    columns.forEach(col => {
      const counts = {};
      leads.forEach(lead => {
        const val = getLeadValue(lead, col.key);
        const displayVal = val.trim() === '' ? '(Blanks / Unsent)' : val.trim();
        counts[displayVal] = (counts[displayVal] || 0) + 1;
      });
      map[col.key] = Object.entries(counts).map(([value, count]) => ({ value, count }));
    });
    return map;
  }, [leads, currentWorkspace]);

  // Apply Global Search, Column Filters, and Sorting
  const filteredAndSortedLeads = useMemo(() => {
    let result = leads.filter(lead => {
      // 1. Global Search
      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase();
        const matches = (lead.email || '').toLowerCase().includes(q) ||
                        (lead.firstName || '').toLowerCase().includes(q) ||
                        (lead.city || '').toLowerCase().includes(q) ||
                        (lead.companyName || '').toLowerCase().includes(q) ||
                        (lead.campaignName || '').toLowerCase().includes(q) ||
                        (lead.accountName || '').toLowerCase().includes(q) ||
                        (lead.notes || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 2. Column-by-Column Filters
      for (const [colKey, allowedValues] of Object.entries(columnFilters)) {
        if (!allowedValues || allowedValues.length === 0) continue;
        const val = getLeadValue(lead, colKey);
        const displayVal = val.trim() === '' ? '(Blanks / Unsent)' : val.trim();
        if (!allowedValues.includes(displayVal)) {
          return false;
        }
      }

      return true;
    });

    // 3. Sorting
    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const valA = getLeadValue(a, sortConfig.key).toLowerCase();
        const valB = getLeadValue(b, sortConfig.key).toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [leads, globalSearch, columnFilters, sortConfig, currentWorkspace]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedLeads.length / pageSize) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedLeads.slice(start, start + pageSize);
  }, [filteredAndSortedLeads, page, pageSize]);

  // Active filters count
  const activeFiltersCount = Object.values(columnFilters).filter(v => v && v.length > 0).length;

  // Toggle or Set Column Filter Values
  const handleToggleFilterValue = (colKey, val) => {
    const allValues = (columnUniqueValues[colKey] || []).map(item => item.value);
    const current = columnFilters[colKey] || allValues;
    
    let updated;
    if (current.includes(val)) {
      updated = current.filter(v => v !== val);
    } else {
      updated = [...current, val];
    }
    
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: updated.length === allValues.length ? null : updated
    }));
    setPage(1);
  };

  const handleSelectAllForCol = (colKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  };

  const handleClearAllForCol = (colKey) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: []
    }));
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setColumnFilters({});
    setGlobalSearch('');
    setSortConfig({ key: null, direction: null });
    setPage(1);
  };

  const handleSort = (colKey, direction) => {
    setSortConfig(prev => {
      if (prev.key === colKey && prev.direction === direction) {
        return { key: null, direction: null };
      }
      return { key: colKey, direction };
    });
  };

  // Multi-Selection
  const handleSelectAllOnPage = (e) => {
    if (e.target.checked) {
      const pageIds = paginatedLeads.map(l => l.id);
      setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...pageIds])));
    } else {
      const pageIds = new Set(paginatedLeads.map(l => l.id));
      setSelectedLeadIds(selectedLeadIds.filter(id => !pageIds.has(id)));
    }
  };

  const handleToggleSelectLead = (id) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter(i => i !== id));
    } else {
      setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  const handleSelectTopN = (n) => {
    const topIds = filteredAndSortedLeads.slice(0, n).map(l => l.id);
    setSelectedLeadIds(topIds);
  };

  // Batch Clipboard Copy
  const handleCopySelected = async () => {
    if (selectedLeadIds.length === 0) return;
    const res = await copyBatchForMailMerge(selectedLeadIds, false);
    if (res.success) {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 3000);
    }
  };

  // Batch Auto-Apply
  const handleApplySentSelected = (seqKey) => {
    if (selectedLeadIds.length === 0) return;
    const ok = applyBatchSentStatus(selectedLeadIds, seqKey);
    if (ok) {
      setApplyToast(true);
      setSelectedLeadIds([]);
      setTimeout(() => setApplyToast(false), 3000);
    }
  };

  const handleDeleteSelected = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedLeadIds.length} selected leads?`)) {
      bulkDeleteLeads(selectedLeadIds);
      setSelectedLeadIds([]);
    }
  };

  // Bulk Edit Complete Callback
  const handleBulkEditComplete = (count, updates) => {
    setBulkEditToast(`✅ Successfully bulk updated ${count} leads in "${currentWorkspace?.name}"!`);
    setTimeout(() => setBulkEditToast(null), 5000);
  };

  // Manual 1-Click Cloud Sync Handler
  const handleManualCloudSync = async () => {
    if (!syncAllWorkspacesToCloud) return;
    setIsSyncingCloud(true);
    setCloudSyncToast(null);

    const result = await syncAllWorkspacesToCloud();
    setIsSyncingCloud(false);

    if (result.success) {
      setCloudSyncToast({
        type: 'success',
        message: `✅ Success! Synced ${leads.length} leads in "${currentWorkspace?.name}" to Cloud Database. All clients can now view them live!`
      });
      setTimeout(() => setCloudSyncToast(null), 6000);
    } else if (!result.connected) {
      setCloudSyncToast({
        type: 'warning',
        message: `⚠️ Cloud Database not connected. Click "Setup Supabase" to enable worldwide sync.`,
        action: () => onOpenCloudSync && onOpenCloudSync()
      });
    } else {
      setCloudSyncToast({
        type: 'error',
        message: `❌ Sync Error: ${result.message}`
      });
      setTimeout(() => setCloudSyncToast(null), 6000);
    }
  };

  const isAllPageSelected = paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeadIds.includes(l.id));

  return (
    <div className="space-y-4">

      {/* BULK EDIT SUCCESS TOAST BANNER */}
      {bulkEditToast && (
        <div className="p-3.5 rounded-2xl border bg-[#00E5A0]/10 border-[#00E5A0]/40 text-[#00E5A0] text-xs flex items-center justify-between gap-3 shadow-2xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#00E5A0] flex-shrink-0" />
            <span className="font-semibold">{bulkEditToast}</span>
          </div>
          <button
            onClick={() => setBulkEditToast(null)}
            className="p-1 rounded hover:bg-white/10 text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CLOUD SYNC LIVE NOTIFICATION TOAST BANNER */}
      {cloudSyncToast && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-2xl animate-fade-in ${
          cloudSyncToast.type === 'success' 
            ? 'bg-[#00E5A0]/10 border-[#00E5A0]/40 text-[#00E5A0]' 
            : cloudSyncToast.type === 'warning'
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
            : 'bg-red-500/10 border-red-500/40 text-red-400'
        }`}>
          <div className="flex items-center gap-2.5">
            {cloudSyncToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#00E5A0] flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="font-semibold">{cloudSyncToast.message}</span>
          </div>

          <div className="flex items-center gap-2">
            {cloudSyncToast.action && (
              <button
                onClick={cloudSyncToast.action}
                className="px-3 py-1 rounded-xl bg-[#00C2FF] text-[#0A0A0A] font-bold text-xs hover:bg-[#00C2FF]/90 transition-all cursor-pointer"
              >
                Setup Supabase
              </button>
            )}
            <button
              onClick={() => setCloudSyncToast(null)}
              className="p-1 rounded hover:bg-white/10 text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      
      {/* Top Action & Filter Summary Bar */}
      <div className="p-4 rounded-2xl bg-[#111827] border border-[#1E3A5F] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        
        {/* Search & Active Filters Indicators */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          
          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#7B7B7B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Quick search all columns..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
            />
          </div>

          {/* Active Column Filter Indicators */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 bg-[#00E5A0]/10 border border-[#00E5A0]/30 px-2.5 py-1 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-[#00E5A0]" />
              <span className="text-[#00E5A0] font-bold font-mono">
                {activeFiltersCount} Column {activeFiltersCount === 1 ? 'Filter' : 'Filters'} Active
              </span>
              <button
                onClick={handleClearAllFilters}
                className="ml-1.5 p-0.5 rounded hover:bg-[#00E5A0]/20 text-[#00E5A0] transition-colors cursor-pointer"
                title="Clear all filters and reset table"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {sortConfig.key && (
            <div className="flex items-center gap-1 bg-[#00C2FF]/10 border border-[#00C2FF]/30 px-2.5 py-1 rounded-xl text-xs text-[#00C2FF]">
              <span>Sorted by {columns.find(c => c.key === sortConfig.key)?.label} ({sortConfig.direction === 'asc' ? 'A→Z' : 'Z→A'})</span>
              <button
                onClick={() => setSortConfig({ key: null, direction: null })}
                className="ml-1 p-0.5 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* Action Buttons: Sync to Cloud, Import, Export, Reset */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          
          {/* SYNC TO CLOUD BUTTON */}
          {isAdmin && (
            <button
              onClick={handleManualCloudSync}
              disabled={isSyncingCloud}
              className="px-3.5 py-1.5 rounded-xl bg-[#00E5A0]/10 hover:bg-[#00E5A0]/20 text-[#00E5A0] border border-[#00E5A0]/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md hover:shadow-[#00E5A0]/10 cursor-pointer disabled:opacity-50"
              title="Sync all leads and tracking data to Cloud Database so clients see them in real time"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span>{isSyncingCloud ? 'Syncing...' : 'Sync to Cloud'}</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-[#0A0A0A] font-mono text-white">
                {leads.length}
              </span>
            </button>
          )}

          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearAllFilters}
              className="px-2.5 py-1.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white border border-[#1E3A5F] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={onOpenImportModal}
              className="px-3 py-1.5 rounded-xl bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Leads</span>
            </button>
          )}

          <button
            onClick={() => exportLeadsToCSV(filteredAndSortedLeads, `${currentWorkspace?.name || 'ROS'}_Leads.csv`)}
            className="px-3 py-1.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 hover:text-white border border-[#1E3A5F] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

      </div>

      {/* MULTI-SELECT FLOATING BULK ACTIONS TOOLBAR */}
      {selectedLeadIds.length > 0 && isAdmin && (
        <div className="p-3.5 rounded-2xl bg-[#0A0A0A] border-2 border-[#00C2FF] flex flex-wrap items-center justify-between gap-3 shadow-2xl cyan-glow animate-fade-in">
          
          {/* Left: Lead Counter & Quick Select Shortcuts */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-[#00C2FF] font-mono px-2.5 py-1 rounded-xl bg-[#111827] border border-[#00C2FF]/40">
              {selectedLeadIds.length} Leads Selected
            </span>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#7B7B7B]">
              <span className="hidden sm:inline">Select:</span>
              {[10, 25, 50, 100, 500].map(cnt => (
                <button
                  key={cnt}
                  onClick={() => handleSelectTopN(cnt)}
                  className="px-2 py-0.5 rounded-lg bg-[#111827] hover:text-white hover:border-[#00C2FF] text-gray-300 font-mono border border-[#1E3A5F] transition-all cursor-pointer"
                >
                  {cnt}
                </button>
              ))}
              <button
                onClick={() => setSelectedLeadIds(filteredAndSortedLeads.map(l => l.id))}
                className="px-2 py-0.5 rounded-lg bg-[#111827] hover:text-white hover:border-[#00C2FF] text-gray-300 font-mono border border-[#1E3A5F] transition-all cursor-pointer"
              >
                All Filtered ({filteredAndSortedLeads.length})
              </button>
              <button
                onClick={() => setSelectedLeadIds([])}
                className="px-2 py-0.5 rounded-lg bg-[#111827] hover:text-red-400 text-gray-400 font-mono border border-[#1E3A5F] transition-all cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Right: Bulk Edit, Copy, Auto-Apply, and Delete Actions */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* 🌟 BULK EDIT BUTTON (PRIMARY) */}
            <button
              onClick={() => setBulkEditModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00C2FF] to-[#00E5A0] hover:brightness-110 text-[#0A0A0A] text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-[#00C2FF]/30 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Bulk Edit ({selectedLeadIds.length})</span>
            </button>

            {/* COPY 4 COLUMNS BUTTON */}
            <button
              onClick={handleCopySelected}
              className="px-3 py-1.5 rounded-xl bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 text-[#00C2FF] border border-[#00C2FF]/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copyToast ? <Check className="w-3.5 h-3.5 text-[#00E5A0]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copyToast ? 'Copied 4 Cols!' : 'Copy 4 Cols'}</span>
            </button>

            {/* AUTO APPLY EMAIL 1 */}
            <button
              onClick={() => handleApplySentSelected('email1')}
              className="px-2.5 py-1.5 rounded-xl bg-[#00E5A0]/15 hover:bg-[#00E5A0]/25 text-[#00E5A0] border border-[#00E5A0]/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Apply 'Email Sent - Today' to Email 1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Mark E1 Sent</span>
            </button>

            {/* AUTO APPLY EMAIL 2 */}
            <button
              onClick={() => handleApplySentSelected('email2')}
              className="px-2.5 py-1.5 rounded-xl bg-[#00E5A0]/15 hover:bg-[#00E5A0]/25 text-[#00E5A0] border border-[#00E5A0]/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Apply 'Email Sent - Today' to Email 2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Mark E2 Sent</span>
            </button>

            {/* DELETE BUTTON */}
            <button
              onClick={handleDeleteSelected}
              className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
              title="Delete Selected Leads"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* MASTER LEADS SPREADSHEET TABLE WITH COLUMN-BY-COLUMN FILTER ICONS */}
      <div className="rounded-2xl bg-[#111827] border border-[#1E3A5F] overflow-visible shadow-2xl relative">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-xs border-collapse">
            
            {/* Table Header with Interactive Google Sheets-style Filter Icons */}
            <thead className="bg-[#0A0A0A] text-[#7B7B7B] uppercase font-mono border-b border-[#1E3A5F] select-none sticky top-0 z-20">
              <tr>
                {isAdmin && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={handleSelectAllOnPage}
                      className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] cursor-pointer"
                    />
                  </th>
                )}

                {columns.map(col => {
                  const isFiltered = columnFilters[col.key] && columnFilters[col.key].length > 0;
                  const isSorted = sortConfig.key === col.key;
                  const isDropdownOpen = activeFilterCol === col.key;

                  return (
                    <th key={col.key} className="py-2.5 px-3 relative group">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={`font-semibold tracking-wider ${col.color ? 'text-[#00C2FF]' : 'text-gray-300'}`}>
                          {col.label}
                        </span>

                        {/* FILTER ICON BUTTON (MATCHING GOOGLE SHEETS) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterCol(isDropdownOpen ? null : col.key);
                            setFilterSearchQuery('');
                          }}
                          className={`p-1 rounded transition-all cursor-pointer flex items-center justify-center ${
                            isFiltered 
                              ? 'bg-[#00E5A0] text-[#0A0A0A] font-bold shadow-md shadow-[#00E5A0]/20' 
                              : isSorted
                              ? 'bg-[#00C2FF] text-[#0A0A0A]'
                              : 'text-gray-400 hover:text-white hover:bg-[#1E3A5F]'
                          }`}
                          title={`Filter & Sort ${col.label}`}
                        >
                          <Filter className={`w-3.5 h-3.5 ${isFiltered ? 'fill-[#0A0A0A]' : ''}`} />
                        </button>
                      </div>

                      {/* SPREADSHEET COLUMN FILTER DROPDOWN */}
                      {isDropdownOpen && (
                        <div
                          ref={dropdownRef}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-1.5 w-64 rounded-xl bg-[#111827] border border-[#00C2FF]/60 shadow-2xl p-3 z-50 cyan-glow text-xs normal-case font-sans animate-fade-in"
                        >
                          {/* Top: Sort Actions */}
                          <div className="pb-2 mb-2 border-b border-[#1E3A5F] space-y-1">
                            <button
                              onClick={() => {
                                handleSort(col.key, 'asc');
                                setActiveFilterCol(null);
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer ${
                                sortConfig.key === col.key && sortConfig.direction === 'asc'
                                  ? 'bg-[#00C2FF]/20 text-[#00C2FF] font-bold'
                                  : 'text-gray-300 hover:bg-[#1E3A5F] hover:text-white'
                              }`}
                            >
                              <ArrowUp className="w-3.5 h-3.5 text-[#00C2FF]" />
                              <span>Sort A → Z (Ascending)</span>
                            </button>

                            <button
                              onClick={() => {
                                handleSort(col.key, 'desc');
                                setActiveFilterCol(null);
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer ${
                                sortConfig.key === col.key && sortConfig.direction === 'desc'
                                  ? 'bg-[#00C2FF]/20 text-[#00C2FF] font-bold'
                                  : 'text-gray-300 hover:bg-[#1E3A5F] hover:text-white'
                              }`}
                            >
                              <ArrowDown className="w-3.5 h-3.5 text-[#00C2FF]" />
                              <span>Sort Z → A (Descending)</span>
                            </button>
                          </div>

                          {/* Middle: Value Filter Search */}
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-[#00C2FF] uppercase tracking-wider">
                              Filter by Values ({columnUniqueValues[col.key]?.length || 0})
                            </div>

                            <div className="relative">
                              <Search className="w-3 h-3 text-[#7B7B7B] absolute left-2 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                autoFocus
                                value={filterSearchQuery}
                                onChange={(e) => setFilterSearchQuery(e.target.value)}
                                placeholder="Search values..."
                                className="w-full pl-7 pr-2 py-1 bg-[#0A0A0A] border border-[#1E3A5F] rounded-lg text-white text-[11px] outline-none focus:border-[#00C2FF]"
                              />
                            </div>

                            {/* Select All / Clear All Shortcuts */}
                            <div className="flex items-center justify-between text-[10px] text-[#7B7B7B] px-0.5">
                              <button
                                onClick={() => handleSelectAllForCol(col.key)}
                                className="text-[#00C2FF] hover:underline cursor-pointer"
                              >
                                Select All
                              </button>
                              <button
                                onClick={() => handleClearAllForCol(col.key)}
                                className="text-gray-400 hover:text-red-400 hover:underline cursor-pointer"
                              >
                                Clear All
                              </button>
                            </div>

                            {/* Unique Values Checklist */}
                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-[#1E3A5F]/60 rounded-lg p-1.5 bg-[#0A0A0A]">
                              {(columnUniqueValues[col.key] || [])
                                .filter(item => item.value.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                                .map((item) => {
                                  const currentSelected = columnFilters[col.key] || (columnUniqueValues[col.key] || []).map(v => v.value);
                                  const isChecked = currentSelected.includes(item.value);

                                  return (
                                    <label
                                      key={item.value}
                                      className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-[#111827] text-xs cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleFilterValue(col.key, item.value)}
                                          className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] cursor-pointer"
                                        />
                                        <span className={`truncate text-[11px] ${isChecked ? 'text-white' : 'text-[#7B7B7B]'}`}>
                                          {item.value}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-mono text-[#7B7B7B] flex-shrink-0">
                                        ({item.count})
                                      </span>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Bottom Action Footer */}
                          <div className="pt-2 mt-2 border-t border-[#1E3A5F] flex items-center justify-between">
                            <button
                              onClick={() => {
                                handleSelectAllForCol(col.key);
                                setActiveFilterCol(null);
                              }}
                              className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                            >
                              Reset
                            </button>
                            <button
                              onClick={() => setActiveFilterCol(null)}
                              className="px-3 py-1 rounded-lg bg-[#00C2FF] text-[#0A0A0A] font-bold text-[11px] cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}

                <th className="py-2.5 px-3 text-right text-gray-400">Actions</th>
              </tr>
            </thead>

            {/* Table Rows Body */}
            <tbody className="divide-y divide-[#1E3A5F]/50 font-sans text-xs">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="py-16 text-center text-[#7B7B7B]">
                    <div className="flex flex-col items-center gap-2">
                      <Filter className="w-8 h-8 text-[#7B7B7B]/40" />
                      <span className="text-sm font-semibold text-gray-300">No leads match the active filters</span>
                      <span className="text-xs text-[#7B7B7B]">Try adjusting column filters or search criteria.</span>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleClearAllFilters}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-bold hover:bg-[#00C2FF]/20 transition-all cursor-pointer"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);

                  return (
                    <tr 
                      key={lead.id}
                      className={`hover:bg-[#1E3A5F]/20 transition-colors ${isSelected ? 'bg-[#00C2FF]/5' : ''}`}
                    >
                      {isAdmin && (
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectLead(lead.id)}
                            className="rounded border-[#1E3A5F] bg-[#111827] accent-[#00C2FF] cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Email Address */}
                      <td className="py-2.5 px-3 font-mono font-medium text-[#00C2FF] truncate max-w-[200px]">
                        {lead.email}
                      </td>

                      {/* First Name */}
                      <td className="py-2.5 px-3 font-bold text-white">
                        {lead.firstName || '—'}
                      </td>

                      {/* City */}
                      <td className="py-2.5 px-3 text-[#7B7B7B]">
                        {lead.city || '—'}
                      </td>

                      {/* Company Name */}
                      <td className="py-2.5 px-3 font-medium text-gray-200 truncate max-w-[180px]">
                        {lead.companyName || '—'}
                      </td>

                      {/* Campaign Name */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-[#1E3A5F]/60 text-[#00C2FF] font-mono text-[10px]">
                          {lead.campaignName || currentWorkspace?.campaignName || 'General'}
                        </span>
                      </td>

                      {/* Email 1 */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0] whitespace-nowrap">
                        {lead.email1 || <span className="text-[#7B7B7B]/50">—</span>}
                      </td>

                      {/* Email 2 */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0] whitespace-nowrap">
                        {lead.email2 || <span className="text-[#7B7B7B]/50">—</span>}
                      </td>

                      {/* Email 3 */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#00E5A0] whitespace-nowrap">
                        {lead.email3 || <span className="text-[#7B7B7B]/50">—</span>}
                      </td>

                      {/* Account Name */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#7B7B7B] truncate max-w-[150px]">
                        {lead.accountName || currentWorkspace?.activeSendingAccount || '—'}
                      </td>

                      {/* Pipeline Stage */}
                      <td className="py-2.5 px-3">
                        {lead.stage ? (
                          <span className="px-2 py-0.5 rounded bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 text-[10px] font-semibold">
                            {lead.stage}
                          </span>
                        ) : (
                          <span className="text-[#7B7B7B] text-[10px]">{lead.status || 'In Progress'}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onOpenLeadDetail && onOpenLeadDetail(lead)}
                          className="px-2 py-1 rounded bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#00C2FF] hover:text-white border border-[#1E3A5F] text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Pagination & Filter Statistics Footer */}
        <div className="p-3 bg-[#0A0A0A] border-t border-[#1E3A5F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7B7B7B]">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-white">{paginatedLeads.length}</strong> of <strong className="text-white">{filteredAndSortedLeads.length}</strong> leads
              {filteredAndSortedLeads.length !== leads.length && (
                <span className="text-[#00E5A0] ml-1">(filtered from {leads.length} total)</span>
              )}
            </span>
            <span className="text-[#1E3A5F]">|</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-[#111827] border border-[#1E3A5F] text-white rounded px-2 py-0.5 outline-none"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 rounded bg-[#111827] hover:bg-[#1E3A5F] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-white font-semibold">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded bg-[#111827] hover:bg-[#1E3A5F] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* BULK EDIT MODAL */}
      <BulkEditModal
        isOpen={bulkEditModalOpen}
        onClose={() => setBulkEditModalOpen(false)}
        selectedLeadIds={selectedLeadIds}
        onComplete={handleBulkEditComplete}
      />

    </div>
  );
}
