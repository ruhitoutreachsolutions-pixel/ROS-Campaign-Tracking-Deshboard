import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { parsePastedLeadsText, getTodayFormatted } from '../utils/helpers';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  FolderOpen,
  Calendar,
  Layers,
  Check,
  Columns
} from 'lucide-react';

export default function ImportLeadsModal({ isOpen, onClose }) {
  const { currentWorkspace, addLeadsBulk } = useWorkspace();
  const [campaignName, setCampaignName] = useState(currentWorkspace?.campaignName || 'Care Campaign');
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState([]);
  const [importedCount, setImportedCount] = useState(null);
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const todayStr = getTodayFormatted();

  const handleTextChange = (text, campName = campaignName) => {
    setRawText(text);
    const parsed = parsePastedLeadsText(
      text, 
      campName || currentWorkspace?.campaignName || 'General Outbound',
      currentWorkspace?.activeSendingAccount || ''
    );
    setParsedPreview(parsed);
  };

  const handleCampaignChange = (cName) => {
    setCampaignName(cName);
    if (rawText.trim()) {
      handleTextChange(rawText, cName);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        handleTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (parsedPreview.length === 0) return;
    const count = addLeadsBulk(parsedPreview, campaignName);
    setImportedCount(count);
    setTimeout(() => {
      setImportedCount(null);
      setRawText('');
      setParsedPreview([]);
      setFileName('');
      onClose();
    }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl rounded-3xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[92vh] flex flex-col cyan-glow">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Import Leads into Workspace</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#00E5A0]/10 text-[#00E5A0] border border-[#00E5A0]/30">
                  Auto-Column Mapping Active
                </span>
              </h3>
              <p className="text-xs text-[#7B7B7B]">
                Upload CSV or paste table data for <strong>{currentWorkspace?.clientName || currentWorkspace?.name}</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        {importedCount !== null ? (
          <div className="py-16 flex flex-col items-center text-center space-y-3">
            <div className="p-4 rounded-full bg-[#00E5A0]/20 text-[#00E5A0] green-glow animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h4 className="text-xl font-bold text-white">
              Successfully Imported {importedCount} Leads into "{campaignName}"!
            </h4>
            <p className="text-xs text-[#7B7B7B]">
              All leads have been recorded with <strong>Date Added: {todayStr}</strong> and are ready for live mail merge dispatching.
            </p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
            
            {/* Top Inputs: Campaign Assignment & Date Added Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#00C2FF] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Assign Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={(e) => handleCampaignChange(e.target.value)}
                  placeholder="e.g. Care Campaign or NHS Staffing"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white outline-none focus:border-[#00C2FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#F97316] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Auto Date Added Tag
                </label>
                <div className="px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-[#F97316] font-mono font-bold flex items-center justify-between">
                  <span>{todayStr} (Today)</span>
                  <span className="text-[10px] text-[#7B7B7B] font-normal font-sans">Auto-assigned per lead</span>
                </div>
              </div>
            </div>

            {/* CSV File Upload Box */}
            <div className="p-3.5 rounded-2xl border-2 border-dashed border-[#1E3A5F] hover:border-[#00C2FF] bg-[#0A0A0A]/60 transition-all text-center">
              <label className="cursor-pointer flex flex-col items-center gap-1 py-1">
                <Upload className="w-5 h-5 text-[#00C2FF]" />
                <span className="text-xs font-bold text-white">
                  {fileName ? `Selected: ${fileName}` : 'Click to Browse & Upload CSV / Spreadsheet File'}
                </span>
                <span className="text-[10px] text-[#7B7B7B]">
                  Supports all standard CSV headers: Email, First Name, City, Company Name, Campaign, Email 1, Email 2, Email 3, Account Name, Stage, Deal Value, Date Added, Notes
                </span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Or Paste TSV Text Area */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Or Paste Data (Ctrl + V):
                </label>
                <span className="text-[11px] text-[#7B7B7B]">
                  Tab or comma-separated rows from Google Sheets / Excel
                </span>
              </div>
              <textarea
                rows={3}
                value={rawText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="dominic@company.com	Dominic	London	1 Four 1 Recruitment	Care Campaign	Email Sent - 18/08/26	Email Sent - 25/08/26	-	hello@crewlixglobal.com	Interested	500	27/08/26"
                className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs font-mono outline-none focus:border-[#00C2FF] transition-all placeholder:text-[#7B7B7B]/50"
              />
            </div>

            {/* FULL MAPPED PREVIEW TABLE (SHOWS ALL COLUMNS DYNAMICALLY) */}
            {parsedPreview.length > 0 && (
              <div className="rounded-2xl border border-[#00C2FF]/40 overflow-hidden bg-[#0A0A0A] shadow-xl">
                <div className="px-4 py-2.5 bg-[#111827] border-b border-[#1E3A5F] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Columns className="w-4 h-4 text-[#00E5A0]" />
                    <span className="text-xs font-bold text-[#00E5A0]">
                      All Mapped Columns Preview ({parsedPreview.length} Leads Detected)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#7B7B7B]">
                    Showing first 10 rows of {parsedPreview.length} total
                  </span>
                </div>

                <div className="overflow-x-auto max-h-52">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-[#0A0A0A] text-[#7B7B7B] uppercase font-mono border-b border-[#1E3A5F] sticky top-0 z-10 whitespace-nowrap">
                      <tr>
                        <th className="py-2 px-3 text-[#00C2FF]">Email Address</th>
                        <th className="py-2 px-3 text-white">First Name</th>
                        <th className="py-2 px-3">City</th>
                        <th className="py-2 px-3">Company Name</th>
                        <th className="py-2 px-3 text-[#00C2FF]">Campaign</th>
                        <th className="py-2 px-3 text-[#00E5A0]">Email 1</th>
                        <th className="py-2 px-3 text-[#00E5A0]">Email 2</th>
                        <th className="py-2 px-3 text-[#00E5A0]">Email 3</th>
                        <th className="py-2 px-3">Account Name</th>
                        <th className="py-2 px-3">Stage</th>
                        <th className="py-2 px-3 text-[#F97316]">Date Added</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E3A5F]/40 font-sans whitespace-nowrap">
                      {parsedPreview.slice(0, 10).map((l, i) => (
                        <tr key={i} className="hover:bg-[#1E3A5F]/20 transition-colors">
                          <td className="py-2 px-3 font-mono font-semibold text-[#00C2FF]">{l.email}</td>
                          <td className="py-2 px-3 font-bold text-white">{l.firstName || '—'}</td>
                          <td className="py-2 px-3 text-[#7B7B7B]">{l.city || '—'}</td>
                          <td className="py-2 px-3 text-gray-200">{l.companyName || '—'}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-[#1E3A5F] text-[#00C2FF] font-mono text-[10px]">
                              {l.campaignName}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[#00E5A0]">{l.email1 || '—'}</td>
                          <td className="py-2 px-3 font-mono text-[#00E5A0]">{l.email2 || '—'}</td>
                          <td className="py-2 px-3 font-mono text-[#00E5A0]">{l.email3 || '—'}</td>
                          <td className="py-2 px-3 text-[#7B7B7B] font-mono">{l.accountName || '—'}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-[#00C2FF]/10 text-[#00C2FF] text-[10px]">
                              {l.stage || 'In Progress'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[#F97316] font-bold">
                            {l.dateAdded || todayStr}
                          </td>
                          <td className="py-2 px-3 text-gray-400 max-w-[150px] truncate">{l.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-between">
              <span className="text-[11px] text-[#7B7B7B] font-mono">
                {parsedPreview.length > 0 ? `Ready to import ${parsedPreview.length} leads` : 'Waiting for file or text input...'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={parsedPreview.length === 0}
                  onClick={handleImport}
                  className="px-5 py-2.5 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow-lg shadow-[#00C2FF]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Import All {parsedPreview.length} Leads</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
