import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { saveDncRecordToCloud } from '../services/db';
import { broadcastRealtimeEvent } from '../services/cloudStorage';
import { 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Trash2, 
  FileText, 
  Code2, 
  Download, 
  Filter, 
  Mail, 
  Search, 
  Sparkles 
} from 'lucide-react';

export default function BounceQuarantineModal({ isOpen, onClose }) {
  const { currentWorkspace, updateLead, addActivityLog } = useWorkspace();
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'script'
  const [rawInput, setRawInput] = useState('');
  const [bounceReason, setBounceReason] = useState('Bounced / Undeliverable (550 Mailbox Not Found)');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedList, setCopiedList] = useState(false);

  // Regex extractor for emails, filtering out system/daemon addresses
  const parsedEmails = useMemo(() => {
    if (!rawInput.trim()) return [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = rawInput.match(emailRegex) || [];
    
    const ignoredDomains = [
      'google.com',
      'googlemail.com',
      'gmail.com', // ignore mailer-daemon from google
      'mimecast.org',
      'mimecast.com',
      'sendgrid.net',
      'mailgun.org',
      'crewlixteam.co.uk', // central bounce forwarder
      'crewlixhr.co.uk'
    ];

    const ignoredPrefixes = [
      'mailer-daemon',
      'postmaster',
      'bounce',
      'bounces',
      'noreply',
      'no-reply',
      'notifications'
    ];

    const unique = new Set();
    matches.forEach(m => {
      const clean = m.toLowerCase().trim();
      const [prefix, domain] = clean.split('@');
      
      const isSystemPrefix = ignoredPrefixes.some(p => prefix === p || prefix.startsWith(p + '+'));
      const isSystemDomain = ignoredDomains.some(d => domain === d || domain.endsWith('.' + d));

      if (!isSystemPrefix && !isSystemDomain) {
        unique.add(clean);
      }
    });

    return Array.from(unique);
  }, [rawInput]);

  if (!isOpen) return null;

  const handleQuarantine = async () => {
    if (parsedEmails.length === 0) return;
    setIsProcessing(true);
    setSuccessResult(null);

    try {
      const nowIso = new Date().toISOString();
      const recordsToSave = parsedEmails.map(email => ({
        email,
        workspaceId: currentWorkspace?.id || 'ws_crewlixukltd',
        reason: bounceReason,
        unsubscribedAt: nowIso
      }));

      // 1. Save to cloud DNC registry (resilient bulk update)
      await saveDncRecordToCloud(recordsToSave);

      // 2. Mark matching leads in current workspace as DNC / Bounced
      let matchedCount = 0;
      if (currentWorkspace?.leads && Array.isArray(currentWorkspace.leads)) {
        const parsedSet = new Set(parsedEmails);
        currentWorkspace.leads.forEach(lead => {
          if (lead && lead.email && parsedSet.has(lead.email.toLowerCase().trim())) {
            matchedCount++;
            updateLead(lead.id, {
              status: 'dnc',
              stage: 'DNC / Bounced',
              isDNC: true,
              unsubscribedAt: nowIso,
              unsubscribeReason: bounceReason,
              notes: lead.notes 
                ? `${lead.notes} | [Quarantined as Bounced on ${new Date().toLocaleDateString('en-GB')}]` 
                : `[Quarantined as Bounced on ${new Date().toLocaleDateString('en-GB')}]`
            });
          }
        });
      }

      // 3. Broadcast realtime events across all devices & team members
      recordsToSave.forEach(rec => {
        broadcastRealtimeEvent('DNC_RECORD_ADDED', {
          email: rec.email,
          workspaceId: rec.workspaceId,
          reason: bounceReason,
          unsubscribedAt: nowIso
        }).catch(() => {});
      });

      broadcastRealtimeEvent('WORKSPACE_RECONCILE_NEEDED', {
        workspaceId: currentWorkspace?.id,
        updatedAt: nowIso
      }).catch(() => {});

      // 4. Log activity
      if (addActivityLog) {
        addActivityLog({
          id: 'act_bounce_' + Date.now(),
          type: 'dnc',
          count: parsedEmails.length,
          description: `Quarantined ${parsedEmails.length} bounced email(s) (${matchedCount} matched in active workspace)`
        });
      }

      setSuccessResult({
        total: parsedEmails.length,
        matched: matchedCount
      });
      setRawInput('');
    } catch (err) {
      console.error('Error quarantining bounces:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyList = () => {
    if (parsedEmails.length === 0) return;
    navigator.clipboard.writeText(parsedEmails.join('\n'));
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2500);
  };

  const todayIsoDate = new Date().toISOString().split('T')[0].replace(/-/g, '/');

  const appsScriptCode = `/**
 * Daily Central Bounce Harvester (bounces@crewlixteam.co.uk)
 * Gathers today's bounce threads and extracts recipient addresses.
 */
function harvestTodayBounces() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Today Bounces");
  if (!sheet) {
    sheet = ss.insertSheet("Today Bounces");
    sheet.appendRow(["Bounced Email", "Subject", "Date", "Error Snippet"]);
    sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#fee2e2");
  }

  // Searches today's bounced emails across all folders
  // Date format in Gmail: after:YYYY/MM/DD
  const query = 'in:anywhere (from:mailer-daemon OR "Delivery Status Notification" OR "Address not found" OR "Delivery incomplete") after:${todayIsoDate}';
  
  const threads = GmailApp.search(query, 0, 100);
  const existingRows = sheet.getDataRange().getValues();
  const existingSet = new Set(existingRows.map(r => String(r[0]).toLowerCase().trim()));
  const newRows = [];

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    const lastMsg = messages[messages.length - 1];
    const body = lastMsg.getPlainBody();
    const subj = lastMsg.getSubject();
    const dateStr = Utilities.formatDate(lastMsg.getDate(), "GMT", "yyyy-MM-dd HH:mm:ss");

    // Match recipient email from bounce notice
    const emailMatches = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g) || [];
    let recipient = null;

    for (let e = 0; e < emailMatches.length; e++) {
      const cand = emailMatches[e].toLowerCase().trim();
      if (!cand.includes('mailer-daemon') && 
          !cand.includes('googlemail') && 
          !cand.includes('google.com') && 
          !cand.includes('crewlix') && 
          !cand.includes('mimecast') && 
          !cand.includes('postmaster')) {
        recipient = cand;
        break;
      }
    }

    if (recipient && !existingSet.has(recipient)) {
      existingSet.add(recipient);
      const snippet = body.substring(0, 150).replace(/\\n/g, ' ');
      newRows.push([recipient, subj, dateStr, snippet]);
    }
  }

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
  }

  SpreadsheetApp.getUi().alert("✅ Done! Extracted " + newRows.length + " today bounces into 'Today Bounces' sheet.");
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0F172A] border border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E3A5F] bg-[#111C33]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Bulk Bounce Quarantine & Suppressor</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                  DNC SYNC ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Instantly suppress hard bounces from follow-ups and register them in Cloud DNC.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-[#1E3A5F] bg-[#0A0F1D]/80 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'paste'
                ? 'border-red-400 text-red-400 bg-red-500/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1-Click Paste & Quarantine</span>
            {parsedEmails.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 text-[10px] font-mono">
                {parsedEmails.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'script'
                ? 'border-[#00C2FF] text-[#00C2FF] bg-[#00C2FF]/10'
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Daily Central Bounce Script</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {successResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-start gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Quarantine Successful!</p>
                <p className="text-slate-300">
                  Registered <strong>{successResult.total}</strong> bounced email(s) into the Global DNC Registry.
                  {successResult.matched > 0 && (
                    <span> <strong>{successResult.matched}</strong> matching leads in the active workspace were updated to <em>DNC / Bounced</em>.</span>
                  )}
                </p>
                <p className="text-[11px] text-emerald-400/80">
                  All Mail Merge dispatches and follow-up sequences will automatically skip these addresses.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'paste' ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-red-400" />
                    <span>Paste Raw Bounces, Email Lists, or Gmail Error Logs</span>
                  </label>
                  {parsedEmails.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        {parsedEmails.length} valid recipient{parsedEmails.length > 1 ? 's' : ''} detected
                      </span>
                      <button
                        onClick={handleCopyList}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedList ? 'Copied' : 'Copy Clean List'}</span>
                      </button>
                    </div>
                  )}
                </div>

                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Paste anything here:&#10;• A column of emails from Google Sheets&#10;• A raw Mailer-Daemon error message from Gmail&#10;• A list of bounced email addresses separated by commas, spaces, or lines..."
                  rows={7}
                  className="w-full px-3.5 py-2.5 bg-[#0A0F1D] border border-[#1E3A5F] focus:border-red-400 rounded-xl text-white text-xs font-mono placeholder:text-slate-600 outline-none transition-colors"
                />
              </div>

              {/* Detected Chips Preview */}
              {parsedEmails.length > 0 && (
                <div className="p-3 bg-[#0A0F1D] border border-red-500/20 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Parsed Recipients to Quarantine:</span>
                    <span className="font-mono text-red-400 font-bold">{parsedEmails.length} Total</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                    {parsedEmails.map((email, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/30 text-[11px] font-mono"
                      >
                        <span>{email}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quarantine Category / Reason:
                </label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0F1D] border border-[#1E3A5F] focus:border-red-400 rounded-xl text-white text-xs outline-none"
                >
                  <option value="Bounced / Undeliverable (550 Mailbox Not Found)">
                    Bounced / Undeliverable (550 Mailbox Not Found / Invalid Recipient)
                  </option>
                  <option value="Bounced / Rejected (Spam Filter / SPF / DMARC)">
                    Bounced / Rejected (Spam Filter / Policy Rejection)
                  </option>
                  <option value="Bounced / Mailer-Daemon (Central Bounces Catch-All)">
                    Bounced / Mailer-Daemon (Central Bounces Catch-All)
                  </option>
                  <option value="Manual DNC / Opt-Out">
                    Manual DNC / Opt-Out
                  </option>
                </select>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setRawInput(''); setSuccessResult(null); }}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>

                <button
                  onClick={handleQuarantine}
                  disabled={parsedEmails.length === 0 || isProcessing}
                  className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>
                    {isProcessing 
                      ? 'Quarantining...' 
                      : `Quarantine ${parsedEmails.length > 0 ? `${parsedEmails.length} Email(s)` : 'Bounces'}`}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Tab 2: Daily Apps Script */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#0A0F1D] border border-[#1E3A5F] text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Sparkles className="w-4 h-4 text-[#00C2FF]" />
                  <span>Why Did Today Show 1 Instead of 37?</span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  When searching without a strict date filter or when Google searches 500 threads, older messages fill the quota before reaching today's batches. 
                  By using <code>after:{todayIsoDate}</code>, Gmail searches <strong>only today's forwarded messages</strong> in under 2 seconds.
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-300">
                    Apps Script for <code>bounces@crewlixteam.co.uk</code>:
                  </span>
                  <button
                    onClick={handleCopyScript}
                    className="px-3 py-1 rounded-lg bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedScript ? 'Copied to Clipboard!' : 'Copy Apps Script'}</span>
                  </button>
                </div>

                <pre className="p-3 bg-[#0A0F1D] border border-[#1E3A5F] rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                  {appsScriptCode}
                </pre>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-white">How to run in 30 seconds:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Open your Google Sheet in <code>bounces@crewlixteam.co.uk</code>.</li>
                  <li>Click <strong>Extensions</strong> → <strong>Apps Script</strong>.</li>
                  <li>Paste the script above and click <strong>Run</strong>.</li>
                  <li>Copy Column A from the created "Today Bounces" tab and paste it into the <strong>1-Click Paste & Quarantine</strong> tab!</li>
                </ol>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
