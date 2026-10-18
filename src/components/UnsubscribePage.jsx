import React, { useState, useEffect, useMemo } from 'react';
import { processUnsubscribeRequest } from '../services/unsubscribeService';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Building2, 
  Lock, 
  RefreshCw, 
  X, 
  ChevronRight,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function UnsubscribePage() {
  const [email, setEmail] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [reason, setReason] = useState('I am no longer interested in these services');
  const [customReason, setCustomReason] = useState('');
  
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationData, setConfirmationData] = useState(null);

  // Extract query parameters on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      let queryEmail = params.get('email') || params.get('e') || '';
      const queryWs = params.get('ws') || params.get('workspace') || '';

      // Support base64 encoded emails (safe parameter transport)
      if (queryEmail && !queryEmail.includes('@') && queryEmail.length > 5) {
        try {
          const decoded = atob(queryEmail);
          if (decoded && decoded.includes('@')) {
            queryEmail = decoded;
          }
        } catch (e) {}
      }

      if (queryEmail) setEmail(queryEmail.trim());
      if (queryWs) setWorkspaceId(queryWs.trim());
    } catch (err) {
      console.warn('URL param parse error:', err);
    }
  }, []);

  const reasons = [
    'I am no longer interested in these services',
    'Not relevant to my current role or organisation',
    'I never requested this information',
    'Too many emails received',
    'Other reason'
  ];

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !email.trim()) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    const finalReason = reason === 'Other reason' && customReason.trim() 
      ? `Other: ${customReason.trim()}` 
      : reason;

    const res = await processUnsubscribeRequest({
      email: email.trim(),
      workspaceId: workspaceId || null,
      reason: finalReason
    });

    if (res.success) {
      setConfirmationData(res);
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMessage(res.error || 'Failed to process unsubscribe request. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070B13] text-white flex flex-col justify-between font-['Space_Grotesk'] selection:bg-[#00C2FF] selection:text-[#0A0A0A]">
      
      {/* Top Professional Header */}
      <header className="border-b border-[#1E3A5F]/70 bg-[#0F172A]/80 backdrop-blur-md py-4 px-6 sm:px-12">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00C2FF] to-[#00E5A0] flex items-center justify-center text-[#0A0A0A] font-black text-sm shadow-md">
              C
            </div>
            <div>
              <span className="font-bold tracking-tight text-white text-sm sm:text-base block">
                Crewlix HR & Outreach
              </span>
              <span className="text-[11px] text-[#7B7B7B] block font-mono">
                Communication Preferences Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full font-mono">
            <Lock className="w-3 h-3" />
            <span className="hidden sm:inline">Secure Opt-Out</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl bg-[#0F172A] border border-[#1E3A5F] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          
          {/* Subtle Cyber Glow Background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00C2FF]/10 rounded-full blur-3xl pointer-events-none" />

          {status !== 'success' ? (
            <div className="space-y-6 relative z-10">
              
              {/* Header Title */}
              <div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 uppercase tracking-widest font-mono">
                  Email Preferences
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2">
                  Unsubscribe from Campaigns
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-2 leading-relaxed">
                  We respect your privacy and email boundaries. Confirm your email address below to permanently stop all cold email communications from our team.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Email Address Display / Input */}
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1.5 flex items-center justify-between">
                    <span>Email Address to Unsubscribe:</span>
                    <span className="text-[10px] text-gray-500 font-mono">Instant DNC Registry</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#00C2FF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. yourname@company.com"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-[#070B13] border border-[#1E3A5F] rounded-2xl text-white font-mono text-sm focus:border-[#00C2FF] focus:outline-none transition shadow-inner"
                    />
                  </div>
                </div>

                {/* Optional Feedback Reason */}
                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-gray-300 block">
                    Reason for Unsubscribing <span className="text-gray-500 font-normal">(Optional):</span>
                  </label>
                  <div className="space-y-1.5">
                    {reasons.map((r, i) => (
                      <label 
                        key={i} 
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                          reason === r 
                            ? 'bg-[#1E3A5F]/40 border-[#00C2FF] text-white' 
                            : 'bg-[#070B13]/60 border-[#1E3A5F]/70 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="unsub_reason"
                          checked={reason === r}
                          onChange={() => setReason(r)}
                          className="accent-[#00C2FF]"
                        />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>

                  {reason === 'Other reason' && (
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Please specify reason..."
                      className="w-full mt-2 p-2.5 bg-[#070B13] border border-[#1E3A5F] rounded-xl text-xs text-white outline-none focus:border-[#00C2FF]"
                    />
                  )}
                </div>

                {/* Error Banner */}
                {status === 'error' && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-sm tracking-wide transition shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {status === 'loading' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Do-Not-Contact Registry...</span>
                    </>
                  ) : (
                    <>
                      <span>Unsubscribe from All Communications</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </form>

              {/* GDPR Compliance Guarantee */}
              <div className="pt-2 border-t border-[#1E3A5F]/60 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                <span>0-Day Permanent Removal</span>
                <span>GDPR & CAN-SPAM Compliant</span>
              </div>

            </div>
          ) : (
            // ============================================
            // SUCCESS CONFIRMATION STATE
            // ============================================
            <div className="py-6 space-y-6 text-center animate-fade-in relative z-10">
              
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest font-mono">
                  Opt-Out Confirmed
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2">
                  You Have Been Unsubscribed
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 mt-2 max-w-md mx-auto leading-relaxed">
                  Your email address <strong className="text-emerald-400 font-mono">{email}</strong> has been permanently added to our global Do-Not-Contact list.
                </p>
              </div>

              {/* Summary Details */}
              <div className="p-4 rounded-2xl bg-[#070B13] border border-[#1E3A5F] text-left text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-bold">Permanently Blacklisted (DNC)</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Effective Date:</span>
                  <span className="text-white">{new Date().toLocaleDateString('en-GB')}</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Outreach Network:</span>
                  <span className="text-white">Crewlix HR & Campaigns</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
                You will not receive any further emails, automated follow-ups, or campaign messages from this organization. You may safely close this window.
              </p>

            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E3A5F]/70 bg-[#0F172A]/80 py-4 px-6 sm:px-12 text-center text-xs text-gray-500 font-mono">
        <span>© {new Date().getFullYear()} Crewlix HR · Outbound Communication Preferences · All Rights Reserved</span>
      </footer>

    </div>
  );
}
