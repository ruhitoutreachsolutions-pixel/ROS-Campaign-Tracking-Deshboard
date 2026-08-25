import React, { useState } from 'react';
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
import { 
  BarChart3, 
  Send, 
  Target, 
  Layers, 
  Table, 
  Sparkles, 
  Building2, 
  Mail, 
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export default function App() {
  const { 
    currentUser, 
    effectiveRole, 
    adminViewingAsClient,
    currentWorkspace,
    metrics
  } = useWorkspace();

  const [activeAdminTab, setActiveAdminTab] = useState('dispatcher'); // 'dispatcher', 'pipeline', 'telemetry', 'leads'
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceEditMode, setWorkspaceEditMode] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [cloudSyncModalOpen, setCloudSyncModalOpen] = useState(false);
  const [selectedLeadForModal, setSelectedLeadForModal] = useState(null);

  // If user is not logged in, show Login Screen
  if (!currentUser) {
    return <LoginScreen />;
  }

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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-['Space_Grotesk'] selection:bg-[#00C2FF] selection:text-[#0A0A0A]">
      
      {/* Top Navigation */}
      <Navbar 
        onOpenNewWorkspace={handleOpenNewWorkspace}
        onOpenWorkspaceSettings={handleOpenWorkspaceSettings}
        onOpenCloudSync={() => setCloudSyncModalOpen(true)}
      />

      {/* Admin Preview Banner when viewing client view */}
      {adminViewingAsClient && (
        <div className="bg-[#00E5A0] text-[#0A0A0A] px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md">
          <Sparkles className="w-4 h-4" />
          <span>You are currently previewing the exact Client Portal view for <strong>{currentWorkspace?.clientName || currentWorkspace?.name}</strong>.</span>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        
        {effectiveRole === 'client' ? (
          // ==========================================
          // 1. CLIENT PORTAL VIEW
          // ==========================================
          <ClientPortalView onOpenLeadDetail={handleOpenLeadDetail} />
        ) : (
          // ==========================================
          // 2. AGENCY ADMIN VIEW (FULL CONTROL)
          // ==========================================
          <div className="space-y-8">
            
            {/* Admin Header with quick stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1E3A5F]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 uppercase tracking-widest">
                    Agency Admin Hub
                  </span>
                  <span className="text-xs text-[#7B7B7B] font-mono">
                    Workspace: <strong className="text-white">{currentWorkspace?.name}</strong>
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                  ROS Campaign <span className="text-[#00C2FF]">Operations</span>
                </h1>
              </div>

              {/* Admin Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-2 bg-[#111827] p-1.5 rounded-2xl border border-[#1E3A5F]">
                {[
                  { id: 'dispatcher', label: 'Mail Merge Dispatcher', icon: Send, badge: 'Fast' },
                  { id: 'pipeline', label: 'Interested Pipeline', icon: Target, badge: `${metrics.interestedCount}` },
                  { id: 'telemetry', label: 'Campaign Analytics', icon: BarChart3 },
                  { id: 'leads', label: 'All Leads Sheet', icon: Table, badge: `${metrics.totalLeads}` }
                ].map(tab => {
                  const IconComp = tab.icon;
                  const isSelected = activeAdminTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveAdminTab(tab.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                          : 'text-gray-400 hover:text-white hover:bg-[#0A0A0A]'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${isSelected ? 'bg-[#0A0A0A] text-[#00C2FF]' : 'bg-[#0A0A0A] text-[#00E5A0]'}`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* KPI Stat Cards */}
            <MetricCards />

            {/* Admin Active Tab Content */}
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
              />
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
      <footer className="w-full border-t border-[#1E3A5F] bg-[#0A0A0A] py-8 text-xs text-[#7B7B7B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
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
