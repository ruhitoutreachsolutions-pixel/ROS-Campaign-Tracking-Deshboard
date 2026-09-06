import React, { useState, useMemo } from 'react';
import { useWorkspace } from './context/WorkspaceContext';
import Navbar from './components/Navbar';
import LoginScreen from './components/LoginScreen';
import MetricCards from './components/MetricCards';
import MailMergeDispatcher from './components/MailMergeDispatcher';
import InterestedPipeline from './components/InterestedPipeline';
import SequenceTracker from './components/SequenceTracker';
import LeadsTable from './components/LeadsTable';
import ClientPortalView from './components/ClientPortalView';
import AnalyticsCharts from './components/AnalyticsCharts';
import WorkspaceModal from './components/WorkspaceModal';
import LeadDetailModal from './components/LeadDetailModal';
import ImportLeadsModal from './components/ImportLeadsModal';
import CloudSyncModal from './components/CloudSyncModal';
import EmailCopiesNotes from './components/EmailCopiesNotes';
import PaymentsInvoices from './components/PaymentsInvoices';
import TasksAndReports from './components/TasksAndReports';
import { 
  BarChart3, 
  Send, 
  Target, 
  Table, 
  Sparkles, 
  Mail, 
  CreditCard,
  CheckSquare,
  FileText,
  Shield,
  Eye,
  Lock
} from 'lucide-react';

export default function App() {
  const { 
    currentUser, 
    effectiveRole, 
    adminViewingAsClient,
    currentWorkspace,
    metrics,
    tasks,
    payments
  } = useWorkspace();

  const [activeAdminTab, setActiveAdminTab] = useState('dispatcher');
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceEditMode, setWorkspaceEditMode] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [cloudSyncModalOpen, setCloudSyncModalOpen] = useState(false);
  const [selectedLeadForModal, setSelectedLeadForModal] = useState(null);

  // Unconditional Hooks (Must be called before any return statements)
  const isAdmin = effectiveRole === 'admin';
  const isWarrior = effectiveRole === 'warrior';

  const pendingApprovalsCount = useMemo(() => {
    return (tasks || []).filter(t => t && t.status === 'submitted_for_approval').length;
  }, [tasks]);

  const safeMetrics = useMemo(() => {
    return metrics || { interestedCount: 0, totalLeads: 0 };
  }, [metrics]);

  const availableTabs = useMemo(() => {
    const tabs = [
      { id: 'dispatcher', label: 'Mail Merge Dispatcher', icon: Send, badge: 'Fast', role: 'both' },
      { id: 'pipeline', label: 'Interested Pipeline', icon: Target, badge: `${safeMetrics.interestedCount || 0}`, role: 'both' },
      { id: 'telemetry', label: 'Campaign Analytics', icon: BarChart3, role: 'both' },
      { id: 'leads', label: 'All Leads Sheet', icon: Table, badge: `${safeMetrics.totalLeads || 0}`, role: 'both' },
      { id: 'email-copies', label: 'Email Copies & Notes', icon: Mail, role: 'both' },
      { id: 'payments', label: 'Payments & Invoices', icon: CreditCard, role: 'admin' },
      { 
        id: 'tasks', 
        label: 'Tasks & Approvals', 
        icon: CheckSquare, 
        badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
        badgeColor: 'amber',
        role: 'both' 
      }
    ];

    if (isAdmin) return tabs;
    if (isWarrior) {
      const allowed = currentUser?.allowedTabs || ['dispatcher', 'pipeline', 'leads', 'email-copies', 'tasks'];
      return tabs.filter(t => t.id !== 'payments' && allowed.includes(t.id));
    }
    return tabs;
  }, [isAdmin, isWarrior, currentUser, safeMetrics, pendingApprovalsCount]);

  // Handle lead click from any subcomponent
  const handleOpenLeadDetail = (lead) => {
    setSelectedLeadForModal(lead);
  };

  const handleOpenNewWorkspace = () => {
    setWorkspaceEditMode(false);
    setWorkspaceModalOpen(true);
  };

  const handleOpenWorkspaceSettings = () => {
    setWorkspaceEditMode(true);
    setWorkspaceModalOpen(true);
  };

  // If user is not logged in, show Login Screen
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-['Space_Grotesk'] selection:bg-[#00C2FF] selection:text-[#0A0A0A]">
      
      {/* Top Navigation */}
      <Navbar 
        onOpenNewWorkspace={handleOpenNewWorkspace}
        onOpenWorkspaceSettings={handleOpenWorkspaceSettings}
        onOpenCloudSync={() => setCloudSyncModalOpen(true)}
        onNavigateToTasks={() => setActiveAdminTab('tasks')}
      />

      {/* Admin Preview Banner when viewing client view */}
      {adminViewingAsClient && (
        <div className="bg-[#00E5A0] text-[#0A0A0A] px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-md">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">You are previewing the Client Portal for <strong>{currentWorkspace?.clientName || currentWorkspace?.name}</strong>.</span>
        </div>
      )}

      {/* ROS Warrior View-Only Notice Banner */}
      {isWarrior && currentUser?.accessLevel === 'view' && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2">
          <Eye className="w-4 h-4 text-amber-400" />
          <span>You are logged in with <strong>View-Only</strong> permissions. Lead editing and modifications are locked.</span>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER (FULL WIDTH FLUID LAYOUT) */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-5 sm:py-7 space-y-6 sm:space-y-8">
        
        {effectiveRole === 'client' ? (
          // ==========================================
          // 1. CLIENT PORTAL VIEW
          // ==========================================
          <ClientPortalView onOpenLeadDetail={handleOpenLeadDetail} />
        ) : (
          // ==========================================
          // 2. AGENCY ADMIN / ROS WARRIORS VIEW
          // ==========================================
          <div className="space-y-6 sm:space-y-8">
            
            {/* Header with role badge and tabs */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-[#1E3A5F]">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest border ${
                    isAdmin 
                      ? 'bg-[#00C2FF]/10 text-[#00C2FF] border-[#00C2FF]/30' 
                      : 'bg-sky-500/20 text-sky-300 border-sky-400/30'
                  }`}>
                    {isAdmin ? 'Agency Admin Hub' : `ROS Warrior · ${currentUser?.name || 'Manager'}`}
                  </span>
                  <span className="text-xs text-[#7B7B7B] font-mono">
                    Workspace: <strong className="text-white">{currentWorkspace?.name}</strong>
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                  ROS Campaign <span className="text-[#00C2FF]">Operations</span>
                </h1>
              </div>

              {/* Navigation Tabs Bar */}
              <div className="flex items-center gap-1.5 bg-[#111827] p-1.5 rounded-2xl border border-[#1E3A5F] overflow-x-auto max-w-full no-scrollbar">
                {availableTabs.map(tab => {
                  const IconComp = tab.icon;
                  const isSelected = activeAdminTab === tab.id;
                  const isAmberBadge = tab.badgeColor === 'amber';

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAdminTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                        isSelected
                          ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                          : 'text-gray-400 hover:text-white hover:bg-[#0A0A0A]'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                          isAmberBadge 
                            ? (isSelected ? 'bg-amber-900 text-amber-200' : 'bg-amber-500 text-slate-950 font-black animate-pulse')
                            : (isSelected ? 'bg-[#0A0A0A] text-[#00C2FF]' : 'bg-[#0A0A0A] text-[#00E5A0]')
                        }`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Top KPI Stat Cards */}
            <MetricCards />

            {/* Active Tab Content */}
            {activeAdminTab === 'dispatcher' && (
              <MailMergeDispatcher />
            )}

            {activeAdminTab === 'pipeline' && (
              <InterestedPipeline onOpenLeadDetail={handleOpenLeadDetail} />
            )}

            {activeAdminTab === 'telemetry' && (
              <div className="space-y-8">
                <SequenceTracker onSelectSequenceForDispatch={() => setActiveAdminTab('dispatcher')} />
                <AnalyticsCharts />
              </div>
            )}

            {activeAdminTab === 'leads' && (
              <LeadsTable 
                onOpenImportModal={() => setImportModalOpen(true)}
                onOpenLeadDetail={handleOpenLeadDetail}
                onOpenCloudSync={() => setCloudSyncModalOpen(true)}
              />
            )}

            {activeAdminTab === 'email-copies' && (
              <EmailCopiesNotes />
            )}

            {activeAdminTab === 'payments' && isAdmin && (
              <PaymentsInvoices />
            )}

            {activeAdminTab === 'tasks' && (
              <TasksAndReports />
            )}

          </div>
        )}

      </main>

      {/* Global Modals */}
      <WorkspaceModal 
        isOpen={workspaceModalOpen}
        editMode={workspaceEditMode}
        onClose={() => setWorkspaceModalOpen(false)}
      />

      <LeadDetailModal
        lead={selectedLeadForModal}
        isOpen={!!selectedLeadForModal}
        onClose={() => setSelectedLeadForModal(null)}
      />

      <ImportLeadsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />

      <CloudSyncModal
        isOpen={cloudSyncModalOpen}
        onClose={() => setCloudSyncModalOpen(false)}
      />

      {/* Brand Footer */}
      <footer className="w-full border-t border-[#1E3A5F] bg-[#0A0A0A] py-6 sm:py-8 text-xs text-[#7B7B7B]">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span className="font-bold text-white">RUHIT OUTREACH SOLUTIONS</span>
            <span className="hidden sm:inline text-[#1E3A5F]">|</span>
            <span className="text-[#00C2FF]">B2B Outbound Growth · Cold Email Systems · AI Automation</span>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <span className="font-medium text-gray-300">"Building pipeline, not just sending emails."</span>
            <span className="text-[#00E5A0] font-mono">© 2026 ROS</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
