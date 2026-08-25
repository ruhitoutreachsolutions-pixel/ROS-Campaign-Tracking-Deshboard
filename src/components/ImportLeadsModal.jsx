import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { parsePastedLeadsText } from '../utils/helpers';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Sparkles, FolderOpen } from 'lucide-react';

export default function ImportLeadsModal({ isOpen, onClose }) {
  const { currentWorkspace, addLeadsBulk } = useWorkspace();
  const [campaignName, setCampaignName] = useState(currentWorkspace?.campaignName || 'Care Campaign');
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState([]);
  const [importedCount, setImportedCount] = useState(null);

  if (!isOpen) return null;

  const handleTextChange = (text, campName = campaignName) => {
    setRawText(text);
    const parsed = parsePastedLeadsText(
      text, 
      currentWorkspace?.activeSendingAccount || '', 
      campName || currentWorkspace?.campaignName || 'General Outbound'
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
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className="p-2.5 rounded-xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Import Leads to Campaign</h3>
            <p className="text-xs text-[#7B7B7B]">
              Upload or paste leads for <strong>{currentWorkspace?.clientName || currentWorkspace?.name}</strong>.
            </p>
          </div>
        </div>

        {importedCount !== null ? (
          <div className="py-12 flex flex-col items-center text-center space-y-3">
            <div className="p-4 rounded-full bg-[#00E5A0]/20 text-[#00E5A0] green-glow animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-lg font-bold text-white">
              Successfully Imported {importedCount} Leads into "{campaignName}"!
            </h4>
            <p className="text-xs text-[#7B7B7B]">
              All leads have been added and are ready for batch dispatching and client telemetry.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Campaign Name Tag */}
            <div>
              <label className="block text-xs font-semibold text-[#00C2FF] uppercase tracking-wider mb-1">
                Assign Campaign Name *
              </label>
              <div className="relative">
                <FolderOpen className="w-4 h-4 text-[#7B7B7B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={(e) => handleCampaignChange(e.target.value)}
                  placeholder="e.g. Care Campaign or NHS Staffing"
                  className="w-full pl-9 pr-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>
              <p className="text-[10px] text-[#7B7B7B] mt-1">
                Clients will see this exact campaign name on their tracking dashboard (e.g. <em>"{campaignName} Follow Up Sent: 50"</em>).
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Option 1: Paste Table Data (Ctrl+V)
                </label>
                <span className="text-[11px] text-[#7B7B7B]">
                  Email, First Name, City, Company Name...
                </span>
              </div>
              <textarea
                rows={4}
                value={rawText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="dominic@company.com	Dominic	London	1 Four 1 Recruitment&#10;denise@company.co.uk	Denise	Manchester	121 HR Solutions"
                className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs font-mono outline-none focus:border-[#00C2FF] transition-all placeholder:text-[#7B7B7B]/50"
              />
            </div>

            <div className="flex items-center justify-center p-3 rounded-xl border border-dashed border-[#1E3A5F] hover:border-[#00C2FF]/60 bg-[#0A0A0A]/50 transition-all text-center">
              <label className="cursor-pointer flex flex-col items-center gap-1">
                <Upload className="w-4 h-4 text-[#00C2FF]" />
                <span className="text-xs font-semibold text-white">
                  Or click to upload CSV file
                </span>
                <span className="text-[10px] text-[#7B7B7B]">Supports .csv and tab-separated text</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Parsed Preview Table */}
            {parsedPreview.length > 0 && (
              <div className="rounded-xl border border-[#1E3A5F] overflow-hidden bg-[#0A0A0A]">
                <div className="px-3.5 py-2 border-b border-[#1E3A5F] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#00E5A0]">
                    Parsed {parsedPreview.length} Leads for Campaign "{campaignName}"
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-[#111827] text-[#7B7B7B] uppercase font-mono border-b border-[#1E3A5F]">
                      <tr>
                        <th className="py-1.5 px-3">Email</th>
                        <th className="py-1.5 px-3">Name</th>
                        <th className="py-1.5 px-3">Company</th>
                        <th className="py-1.5 px-3">Campaign</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1E3A5F]/40 font-mono">
                      {parsedPreview.slice(0, 10).map((l, i) => (
                        <tr key={i} className="hover:bg-[#1E3A5F]/20">
                          <td className="py-1.5 px-3 text-[#00C2FF]">{l.email}</td>
                          <td className="py-1.5 px-3 text-white">{l.firstName}</td>
                          <td className="py-1.5 px-3 text-gray-300">{l.companyName}</td>
                          <td className="py-1.5 px-3 text-[#00E5A0]">{l.campaignName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={parsedPreview.length === 0}
                onClick={handleImport}
                className="px-5 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Import {parsedPreview.length} Leads
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
