import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import RosLogo from './RosLogo';
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  Eye, 
  ShieldCheck, 
  LogOut, 
  Share2, 
  Sparkles,
  Check,
  Mail,
  KeyRound,
  Settings,
  Cloud
} from 'lucide-react';

export default function Navbar({ onOpenNewWorkspace, onOpenWorkspaceSettings, onOpenCloudSync }) {
  const {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    currentUser,
    adminViewingAsClient,
    setAdminViewingAsClient,
    switchWorkspace,
    logout
  } = useWorkspace();

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const handleCopyShare = () => {
    if (!currentWorkspace) return;
    const creds = currentWorkspace.clientCredentials || {};
    const text = `ROS Campaign Tracking Dashboard\nClient: ${currentWorkspace.clientName || currentWorkspace.name}\nPortal URL: ${window.location.origin}\nUsername: ${creds.username}\nPassword: ${creds.password}`;
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1E3A5F] bg-[#0A0A0A]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* LEFT: BRAND LOGO */}
        <div className="flex items-center gap-6">
          <RosLogo showTagline={false} />
          
          <div className="hidden md:block h-6 w-px bg-[#1E3A5F]" />

          {/* WORKSPACE SWITCHER (ADMIN & MULTI-CLIENT) */}
          {isAdmin ? (
            <div className="relative">
              <button
                onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E3A5F] hover:border-[#00C2FF]/60 transition-all text-left group cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-[#00C2FF]" />
                <div className="flex flex-col">
                  <span className="text-xs text-[#7B7B7B] font-medium leading-none">Client Workspace</span>
                  <span className="text-sm font-semibold text-white group-hover:text-[#00C2FF] transition-colors leading-tight flex items-center gap-1.5">
                    {currentWorkspace?.name || 'Select Workspace'}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1E3A5F] text-[#00E5A0] font-mono">
                      {currentWorkspace?.leads?.length || 0} leads
                    </span>
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#7B7B7B] transition-transform ${wsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENU */}
              {wsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setWsDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-72 rounded-xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-2 z-20 cyan-glow">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-[#7B7B7B]">
                      Active Client Workspaces ({workspaces.length})
                    </div>

                    <div className="space-y-1 my-1 max-h-60 overflow-y-auto">
                      {workspaces.map(ws => {
                        const isSelected = ws.id === currentWorkspaceId;
                        return (
                          <button
                            key={ws.id}
                            onClick={() => {
                              switchWorkspace(ws.id);
                              setWsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-[#1E3A5F]/70 text-[#00C2FF] border border-[#00C2FF]/40 font-semibold' 
                                : 'text-gray-300 hover:bg-[#1E3A5F]/40 hover:text-white'
                            }`}
                          >
                            <div className="flex flex-col truncate pr-2">
                              <span className="text-sm truncate">{ws.name}</span>
                              <span className="text-[11px] text-[#7B7B7B] truncate flex items-center gap-1">
                                <Mail className="w-3 h-3 text-[#00E5A0]" />
                                {ws.activeSendingAccount || ws.sendingAccounts?.[0] || 'No account'}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-[#00E5A0] bg-[#0A0A0A] px-1.5 py-0.5 rounded border border-[#1E3A5F]">
                              {ws.leads?.length || 0}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-[#1E3A5F]/80 flex flex-col gap-1">
                      <button
                        onClick={() => {
                          setWsDropdownOpen(false);
                          if (onOpenNewWorkspace) onOpenNewWorkspace();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF] hover:bg-[#00C2FF]/20 text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New Client Workspace
                      </button>
                      <button
                        onClick={() => {
                          setWsDropdownOpen(false);
                          if (onOpenWorkspaceSettings) onOpenWorkspaceSettings();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1E3A5F]/30 text-xs transition-all cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-[#00E5A0]" />
                        Client Password & Credentials Settings
                      </button>
                      <button
                        onClick={() => {
                          setWsDropdownOpen(false);
                          if (onOpenCloudSync) onOpenCloudSync();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:text-[#00E5A0] hover:bg-[#1E3A5F]/30 text-xs transition-all cursor-pointer"
                      >
                        <Cloud className="w-3.5 h-3.5 text-[#00E5A0]" />
                        Cloud Database Sync Settings
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            // CLIENT FIXED BRANDING
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E3A5F]">
              <Building2 className="w-4 h-4 text-[#00C2FF]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-[#7B7B7B] uppercase font-semibold">Client Portal</span>
                <span className="text-sm font-bold text-white">{currentWorkspace?.clientName || currentWorkspace?.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: CONTROLS, VIEW TOGGLE & AUTH */}
        <div className="flex items-center gap-3">
          
          {/* ADMIN: CHANGE CLIENT PASSWORD & SETTINGS SHORTCUT */}
          {isAdmin && (
            <button
              onClick={onOpenWorkspaceSettings}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Edit Client Username, Password, and Campaign Settings"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#00E5A0]" />
              <span>Client Credentials</span>
            </button>
          )}

          {/* ADMIN: TOGGLE CLIENT PREVIEW MODE */}
          {isAdmin && (
            <div className="hidden sm:flex items-center bg-[#111827] p-0.5 rounded-lg border border-[#1E3A5F]">
              <button
                onClick={() => setAdminViewingAsClient(false)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  !adminViewingAsClient 
                    ? 'bg-[#00C2FF] text-[#0A0A0A] shadow' 
                    : 'text-[#7B7B7B] hover:text-white'
                }`}
                title="Full Agency Management with Mail Merge Batch Copy"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Agency Mode
              </button>
              <button
                onClick={() => setAdminViewingAsClient(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  adminViewingAsClient 
                    ? 'bg-[#00E5A0] text-[#0A0A0A] shadow' 
                    : 'text-[#7B7B7B] hover:text-white'
                }`}
                title="Preview exactly what this client sees upon login"
              >
                <Eye className="w-3.5 h-3.5" />
                Client View
              </button>
            </div>
          )}

          {/* SHARE CLIENT ACCESS INFO */}
          {isAdmin && (
            <button
              onClick={handleCopyShare}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Copy Client Login Credentials to send to your client"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00E5A0]" />
                  <span className="text-[#00E5A0]">Credentials Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span className="hidden sm:inline">Share Client Access</span>
                </>
              )}
            </button>
          )}

          {/* USER PROFILE & LOGOUT */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#1E3A5F]">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-white leading-tight">
                {currentUser?.name || 'User'}
              </span>
              <span className="text-[10px] text-[#00E5A0] font-mono leading-none">
                {isAdmin ? 'ADMINISTRATOR' : 'CLIENT PORTAL'}
              </span>
            </div>
            
            <button
              onClick={logout}
              className="p-2 rounded-lg bg-[#111827] hover:bg-red-500/20 text-[#7B7B7B] hover:text-red-400 border border-[#1E3A5F] hover:border-red-500/30 transition-all cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
}
