import React, { useState, useEffect } from 'react';
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
  Cloud,
  RefreshCw,
  Bell,
  Shield,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';

export default function Navbar({ onOpenNewWorkspace, onOpenWorkspaceSettings, onOpenCloudSync, onNavigateToTasks, onNavigateToChat }) {
  const {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    currentUser,
    adminViewingAsClient,
    setAdminViewingAsClient,
    switchWorkspace,
    logout,
    lastSyncedTime,
    isAutoSyncing,
    syncAllWorkspacesToCloud,
    tasks,
    chatUnreadCount,
    canUserAccessChat
  } = useWorkspace();

  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [timeAgoStr, setTimeAgoStr] = useState('just now');

  const isAdmin = currentUser?.role === 'admin';
  const isWarrior = currentUser?.role === 'warrior';

  // Allowed workspaces for this user
  const availableWorkspaces = React.useMemo(() => {
    if (isAdmin) return workspaces;
    if (isWarrior) {
      const allowedIds = currentUser?.allowedWorkspaceIds || [];
      return workspaces.filter(w => allowedIds.includes(w.id));
    }
    return workspaces.filter(w => w.id === currentUser?.workspaceId);
  }, [workspaces, isAdmin, isWarrior, currentUser]);

  // Pending approval tasks count (for admin)
  const pendingApprovalsCount = React.useMemo(() => {
    if (!isAdmin) return 0;
    return (tasks || []).filter(t => t.status === 'submitted_for_approval').length;
  }, [tasks, isAdmin]);

  // Format relative time for auto sync
  useEffect(() => {
    const updateRelativeTime = () => {
      if (!lastSyncedTime) {
        setTimeAgoStr('just now');
        return;
      }
      const diffSecs = Math.max(0, Math.floor((Date.now() - new Date(lastSyncedTime).getTime()) / 1000));
      if (diffSecs < 10) {
        setTimeAgoStr('just now');
      } else if (diffSecs < 60) {
        setTimeAgoStr(`${diffSecs}s ago`);
      } else {
        const mins = Math.floor(diffSecs / 60);
        setTimeAgoStr(`${mins}m ago`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 5000);
    return () => clearInterval(interval);
  }, [lastSyncedTime]);

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
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 h-16 flex items-center justify-between gap-3 sm:gap-4">
        
        {/* LEFT: BRAND LOGO */}
        <div className="flex items-center gap-6">
          <RosLogo showTagline={false} />
          
          <div className="hidden md:block h-6 w-px bg-[#1E3A5F]" />

          {/* WORKSPACE SWITCHER (ADMIN & ROS WARRIORS) */}
          {isAdmin || (isWarrior && availableWorkspaces.length > 1) ? (
            <div className="relative">
              <button
                onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E3A5F] hover:border-[#00C2FF]/60 transition-all text-left group cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-[#00C2FF]" />
                <div className="flex flex-col">
                  <span className="text-xs text-[#7B7B7B] font-medium leading-none">
                    {isWarrior ? 'Assigned Client' : 'Client Workspace'}
                  </span>
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
                      {isWarrior ? 'Your Assigned Clients' : 'Active Client Workspaces'} ({availableWorkspaces.length})
                    </div>

                    <div className="space-y-1 my-1 max-h-60 overflow-y-auto">
                      {availableWorkspaces.map(ws => {
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

                    {isAdmin && (
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
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            // CLIENT FIXED BRANDING / SINGLE WARRIOR CLIENT
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111827] border border-[#1E3A5F]">
              <Building2 className="w-4 h-4 text-[#00C2FF]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-[#7B7B7B] uppercase font-semibold">
                  {isWarrior ? 'Assigned Client' : 'Client Portal'}
                </span>
                <span className="text-sm font-bold text-white">{currentWorkspace?.clientName || currentWorkspace?.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: CONTROLS, AUTO-SYNC PILL & AUTH */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          
          {/* REAL-TIME CHAT SHORTCUT PILL */}
          {canUserAccessChat(currentUser) && (
            <button
              onClick={onNavigateToChat}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                chatUnreadCount > 0
                  ? 'bg-[#00C2FF]/20 text-[#00C2FF] border-[#00C2FF]/60 shadow-[#00C2FF]/25 animate-pulse'
                  : 'bg-[#111827] text-gray-300 border-[#1E3A5F] hover:border-[#00C2FF]/60 hover:text-white'
              }`}
              title="Open ROS Real-Time Chat"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#00C2FF]" />
              <span className="hidden sm:inline">Chat</span>
              {chatUnreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#00C2FF] text-[#0A0A0A] font-black text-[10px]">
                  {chatUnreadCount}
                </span>
              )}
            </button>
          )}

          {/* AUTO-SYNC STATUS PILL (Continuous 20-30s Cloud & Local Sync) */}
          <button
            onClick={() => {
              if (isAdmin && onOpenCloudSync) onOpenCloudSync();
              else syncAllWorkspacesToCloud();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827] border border-[#1E3A5F] hover:border-[#00E5A0]/60 text-xs font-medium text-gray-300 transition-all cursor-pointer shadow-sm group"
            title="Auto-sync active every 25s: Click to trigger manual cloud sync"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isAutoSyncing ? 'bg-[#00C2FF]' : 'bg-[#00E5A0]'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isAutoSyncing ? 'bg-[#00C2FF]' : 'bg-[#00E5A0]'}`} />
            </span>
            <span className="hidden sm:inline text-[#7B7B7B] text-[11px]">
              {isAutoSyncing ? 'Syncing...' : 'Auto-Sync:'}
            </span>
            <span className="text-[11px] font-semibold text-[#00E5A0] group-hover:text-white transition-colors">
              {isAutoSyncing ? 'In progress' : timeAgoStr}
            </span>
          </button>

          {/* ADMIN: PENDING APPROVAL NOTIFICATION BADGE */}
          {isAdmin && pendingApprovalsCount > 0 && (
            <button
              onClick={onNavigateToTasks}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-bold transition hover:bg-amber-500/30 animate-pulse"
              title={`${pendingApprovalsCount} task(s) awaiting your sign-off`}
            >
              <Bell className="w-3 h-3 text-amber-300" />
              <span>{pendingApprovalsCount} Approval{pendingApprovalsCount > 1 ? 's' : ''}</span>
            </button>
          )}

          {/* ADMIN: CHANGE CLIENT PASSWORD & SETTINGS SHORTCUT */}
          {isAdmin && (
            <button
              onClick={onOpenWorkspaceSettings}
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer"
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
              <span className="text-[10px] font-mono leading-none font-bold">
                {isAdmin ? (
                  <span className="text-[#00E5A0]">ADMINISTRATOR</span>
                ) : isWarrior ? (
                  <span className="text-sky-400">
                    ROS WARRIOR · {currentUser?.accessLevel === 'edit' ? 'EDIT' : 'VIEW'}
                  </span>
                ) : (
                  <span className="text-emerald-400">CLIENT PORTAL</span>
                )}
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
