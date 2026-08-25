import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import RosLogo from './RosLogo';
import { Lock, User, ArrowRight, KeyRound, AlertCircle } from 'lucide-react';

export default function LoginScreen() {
  const { login } = useWorkspace();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      const res = login(username, password);
      if (!res.success) {
        setError(res.message || 'Invalid username or password.');
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-[#00C2FF] selection:text-[#0A0A0A]">
      
      {/* Background Futuristic Glow Gradients */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#00C2FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#00E5A0]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1E3A5F15_1px,transparent_1px),linear-gradient(to_bottom,#1E3A5F15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3 rounded-2xl bg-[#111827] border border-[#1E3A5F] mb-4 cyan-glow">
            <RosLogo size="large" showTagline={false} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Campaign Tracking <span className="text-[#00C2FF]">Dashboard</span>
          </h1>
          <p className="text-xs text-[#7B7B7B] mt-1.5 font-medium">
            Ruhit Outreach Solutions · High-Performance Outbound Systems
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#111827] border border-[#1E3A5F] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-[#1E3A5F]">
            <div>
              <h2 className="text-base font-bold text-white">Client & Admin Portal</h2>
              <p className="text-xs text-[#7B7B7B]">Enter your credentials to access campaign telemetry</p>
            </div>
            <span className="p-2 rounded-lg bg-[#1E3A5F]/50 text-[#00E5A0]">
              <KeyRound className="w-4 h-4" />
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B7B7B]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username or email"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-white text-sm outline-none transition-all placeholder:text-[#7B7B7B]/50 focus:ring-1 focus:ring-[#00C2FF]"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7B7B7B]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-white text-sm outline-none transition-all placeholder:text-[#7B7B7B]/50 focus:ring-1 focus:ring-[#00C2FF]"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#00C2FF]/20 active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-[#7B7B7B]">
          © 2026 Ruhit Outreach Solutions · All Rights Reserved
          <div className="text-[11px] text-[#7B7B7B]/70 mt-1">
            "Building pipeline, not just sending emails."
          </div>
        </div>

      </div>
    </div>
  );
}
