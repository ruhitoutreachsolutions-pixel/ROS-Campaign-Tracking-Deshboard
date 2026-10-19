import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
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
  Globe
} from 'lucide-react';

export default function UnsubscribeLinkModal({ isOpen, onClose }) {
  const { currentWorkspace, workspaces } = useWorkspace();
  const [selectedWsId, setSelectedWsId] = useState(currentWorkspace?.id || 'ws_crewlixukltd');
  const [tagFormat, setTagFormat] = useState('sheets_email_address'); // 'sheets_email_address' | 'sheets_email' | 'cold_email'
  const [copiedKey, setCopiedKey] = useState(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Space_Grotesk']">
      <div 
        className="w-full max-w-2xl bg-[#0F172A] border-2 border-[#00C2FF] rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden cyan-glow"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#1E3A5F] flex items-center justify-between bg-[#0A0A0A]/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00C2FF]/15 border border-[#00C2FF]/40 flex items-center justify-center text-[#00C2FF] shrink-0">
              <Link2 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Unsubscribe Link Generator
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00E5A0]/20 text-[#00E5A0] border border-[#00E5A0]/40 font-bold uppercase">
                  unsub.crewlixhr.co.uk
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Copy automated unsubscribe links to paste into cold email sequences.
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          
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
