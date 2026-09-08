import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  CheckSquare, Users, History, FileText, Plus, CheckCircle2, 
  Clock, AlertCircle, Shield, Eye, Edit, Trash2, Send, 
  Filter, Calendar, Bell, ChevronRight, UserCheck, Lock, ExternalLink
} from 'lucide-react';

export default function TasksAndReports() {
  const {
    tasks,
    createTask,
    submitTaskForApproval,
    approveTask,
    rejectTask,
    deleteTask,
    dailyReports,
    submitDailyReport,
    approveDailyReport,
    rejectDailyReport,
    deleteDailyReport,
    warriors,
    addWarrior,
    updateWarrior,
    deleteWarrior,
    warriorTimeline,
    workspaces,
    currentWorkspaceId,
    currentUser,
    effectiveRole
  } = useWorkspace();

  const isAdmin = effectiveRole === 'admin';
  const isWarrior = effectiveRole === 'warrior';

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState('tasks'); // 'tasks', 'reports', 'warriors', 'timeline'

  // Task Filter
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskWarriorFilter, setTaskWarriorFilter] = useState('all');

  // Task Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignedWarriorId: warriors[0]?.id || '',
    workspaceId: currentWorkspaceId,
    priority: 'High',
    dueDate: 'Today - 05:00 PM'
  });

  // Admin Feedback Modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [actionTargetTaskId, setActionTargetTaskId] = useState(null);
  const [actionFeedbackType, setActionFeedbackType] = useState('approve'); // 'approve' or 'reject'
  const [feedbackText, setFeedbackText] = useState('');

  // Daily Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSuccessMessage, setReportSuccessMessage] = useState('');
  const [reportFormData, setReportFormData] = useState({
    workspaceId: currentWorkspaceId,
    date: new Date().toLocaleDateString('en-GB'),
    initialSent: '',
    followUpsSent: '',
    repliesReceived: '',
    callsBooked: '',
    notes: ''
  });

  // Warrior Management Modal
  const [showWarriorModal, setShowWarriorModal] = useState(false);
  const [editingWarrior, setEditingWarrior] = useState(null);
  const [warriorFormData, setWarriorFormData] = useState({
    name: '',
    username: '',
    password: '',
    email: '',
    accessLevel: 'edit',
    allowedWorkspaceIds: [workspaces[0]?.id || ''],
    allowedTabs: ['dispatcher', 'pipeline', 'leads', 'email-copies', 'tasks']
  });

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return (tasks || []).filter(t => {
      // If user is warrior, only show tasks assigned to them (or all if unassigned)
      if (isWarrior && t.assignedWarriorId && t.assignedWarriorId !== currentUser?.id && t.assignedWarriorName !== currentUser?.name) {
        return false;
      }
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
      if (taskWarriorFilter !== 'all' && t.assignedWarriorId !== taskWarriorFilter) return false;
      return true;
    });
  }, [tasks, isWarrior, currentUser, taskStatusFilter, taskWarriorFilter]);

  // Pending approval tasks count
  const pendingApprovalCount = useMemo(() => {
    return (tasks || []).filter(t => t.status === 'submitted_for_approval').length;
  }, [tasks]);

  // Pending approval daily reports count (for Admin badge)
  const pendingReportsCount = useMemo(() => {
    return (dailyReports || []).filter(r => !r.status || r.status === 'pending_approval').length;
  }, [dailyReports]);

  // Handle Save Task
  const handleSaveTask = (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim()) return;

    const assigned = warriors.find(w => w.id === taskFormData.assignedWarriorId);
    const ws = workspaces.find(w => w.id === taskFormData.workspaceId);

    createTask({
      title: taskFormData.title,
      description: taskFormData.description,
      assignedWarriorId: taskFormData.assignedWarriorId,
      assignedWarriorName: assigned ? assigned.name : 'Unassigned',
      workspaceId: taskFormData.workspaceId,
      workspaceName: ws ? ws.name : 'All Workspaces',
      priority: taskFormData.priority,
      dueDate: taskFormData.dueDate
    });

    setShowTaskModal(false);
    setTaskFormData({
      title: '',
      description: '',
      assignedWarriorId: warriors[0]?.id || '',
      workspaceId: currentWorkspaceId,
      priority: 'High',
      dueDate: 'Today - 05:00 PM'
    });
  };

  // Handle Submit Task for Approval (Warrior Action)
  const handleSubmitForApproval = (taskId) => {
    if (window.confirm('Submit this task to Admin for final approval?')) {
      submitTaskForApproval(taskId);
    }
  };

  // Open Feedback Modal for Admin Approval / Rejection
  const handleOpenFeedbackModal = (taskId, type) => {
    setActionTargetTaskId(taskId);
    setActionFeedbackType(type);
    setFeedbackText(type === 'approve' ? 'Great work! Clean execution.' : 'Please review and fix missing follow-ups.');
    setShowFeedbackModal(true);
  };

  const handleConfirmFeedbackAction = () => {
    if (actionFeedbackType === 'approve') {
      approveTask(actionTargetTaskId, feedbackText);
    } else {
      rejectTask(actionTargetTaskId, feedbackText);
    }
    setShowFeedbackModal(false);
  };

  // Handle Submit Daily Report
  const handleSaveReport = (e) => {
    e.preventDefault();
    const ws = workspaces.find(w => w.id === reportFormData.workspaceId);

    submitDailyReport({
      ...reportFormData,
      workspaceName: ws ? ws.name : 'Workspace'
    });

    setReportSuccessMessage('✅ Report submitted! Sent to Admin portal for review & approval.');
    setTimeout(() => {
      setReportSuccessMessage('');
      setShowReportModal(false);
    }, 1500);

    setReportFormData({
      workspaceId: currentWorkspaceId,
      date: new Date().toLocaleDateString('en-GB'),
      initialSent: '',
      followUpsSent: '',
      repliesReceived: '',
      callsBooked: '',
      notes: ''
    });
  };

  // Handle Warrior Save
  const handleSaveWarrior = (e) => {
    e.preventDefault();
    if (!warriorFormData.username.trim() || !warriorFormData.password.trim()) {
      alert('Please fill in username and password.');
      return;
    }

    if (editingWarrior) {
      updateWarrior(editingWarrior.id, warriorFormData);
    } else {
      addWarrior(warriorFormData);
    }

    setShowWarriorModal(false);
  };

  const handleOpenNewWarrior = () => {
    setEditingWarrior(null);
    setWarriorFormData({
      name: '',
      username: '',
      password: '',
      email: '',
      accessLevel: 'edit',
      allowedWorkspaceIds: workspaces.map(w => w.id),
      allowedTabs: ['dispatcher', 'pipeline', 'telemetry', 'leads', 'email-copies', 'form-submissions', 'tasks', 'chat']
    });
    setShowWarriorModal(true);
  };

  const handleOpenEditWarrior = (w) => {
    setEditingWarrior(w);
    setWarriorFormData({
      name: w.name || '',
      username: w.username || '',
      password: w.password || '',
      email: w.email || '',
      accessLevel: w.accessLevel || 'edit',
      allowedWorkspaceIds: w.allowedWorkspaceIds || [],
      allowedTabs: w.allowedTabs || ['dispatcher', 'pipeline', 'telemetry', 'leads', 'email-copies', 'form-submissions', 'tasks', 'chat']
    });
    setShowWarriorModal(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner in Cyber Dark Theme */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111827] via-[#0F2238] to-[#111827] border border-[#1E3A5F] text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00C2FF]/15 border border-[#00C2FF]/30 rounded-full text-[#00C2FF] text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5" />
            {isAdmin ? 'Admin Mission Control · Task Delegation' : 'ROS Warrior Station · Assigned Work'}
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-white">
            Tasks, Approvals & ROS Warriors
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Delegate outreach tasks, enforce step-by-step approvals with desktop notifications, and audit manager activity.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => {
                setTaskFormData(prev => ({ ...prev, workspaceId: currentWorkspaceId }));
                setShowTaskModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-[#0A0A0A] rounded-xl text-sm font-bold shadow-lg shadow-[#00C2FF]/25 transition transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Assign New Task
            </button>
          )}

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] hover:bg-[#162238] text-white rounded-xl text-sm font-semibold border border-[#1E3A5F] transition"
          >
            <Send className="w-4 h-4 text-[#00E5A0]" />
            Submit Daily Report
          </button>
        </div>
      </div>

      {/* Sub-Tabs Bar in Cyber Theme */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1E3A5F] pb-2">
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
            activeSubTab === 'tasks'
              ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
              : 'text-gray-400 hover:text-white hover:bg-[#111827]'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Tasks & Approvals
          {pendingApprovalCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-amber-500 text-[#0A0A0A] text-xs font-black rounded-full animate-pulse">
              {pendingApprovalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
            activeSubTab === 'reports'
              ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
              : 'text-gray-400 hover:text-white hover:bg-[#111827]'
          }`}
        >
          <FileText className="w-4 h-4" />
          Daily Outreach Reports
          {pendingReportsCount > 0 && isAdmin ? (
            <span className="ml-1 px-2 py-0.5 bg-amber-500 text-[#0A0A0A] text-xs font-black rounded-full animate-pulse">
              {pendingReportsCount} Pending
            </span>
          ) : (
            <span className="text-xs bg-[#0A0A0A] text-gray-300 border border-[#1E3A5F] px-2 py-0.5 rounded-full font-semibold">
              {dailyReports?.length || 0}
            </span>
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('warriors')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              activeSubTab === 'warriors'
                ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                : 'text-gray-400 hover:text-white hover:bg-[#111827]'
            }`}
          >
            <Users className="w-4 h-4" />
            ROS Warriors (Managers)
            <span className="text-xs bg-[#0A0A0A] text-gray-300 border border-[#1E3A5F] px-2 py-0.5 rounded-full font-semibold">
              {warriors?.length || 0}
            </span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              activeSubTab === 'timeline'
                ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                : 'text-gray-400 hover:text-white hover:bg-[#111827]'
            }`}
          >
            <History className="w-4 h-4" />
            Live Action Timeline
          </button>
        )}
      </div>

      {/* TAB 1: TASKS & APPROVAL WORKFLOW */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#111827] p-3.5 rounded-2xl border border-[#1E3A5F] shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#7B7B7B] flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#00C2FF]" />
                Status:
              </span>
              {['all', 'pending', 'submitted_for_approval', 'approved_completed', 'rejected'].map(statusKey => {
                const label = 
                  statusKey === 'all' ? 'All Tasks' :
                  statusKey === 'pending' ? 'In Progress' :
                  statusKey === 'submitted_for_approval' ? '⏳ Awaiting Approval' :
                  statusKey === 'approved_completed' ? '✅ Approved & Done' : '❌ Needs Revision';

                return (
                  <button
                    key={statusKey}
                    onClick={() => setTaskStatusFilter(statusKey)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                      taskStatusFilter === statusKey
                        ? 'bg-[#00C2FF] text-[#0A0A0A] font-bold shadow'
                        : 'bg-[#0A0A0A] text-gray-300 hover:text-white border border-[#1E3A5F]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#7B7B7B]">Warrior:</span>
                <select
                  value={taskWarriorFilter}
                  onChange={(e) => setTaskWarriorFilter(e.target.value)}
                  className="px-2.5 py-1 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs font-medium text-gray-200 outline-none"
                >
                  <option value="all">All Warriors</option>
                  {warriors.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Task Cards Grid in Cyber Dark Theme */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.length === 0 ? (
              <div className="col-span-2 bg-[#111827] rounded-2xl border border-[#1E3A5F] p-12 text-center text-gray-400">
                <CheckSquare className="w-12 h-12 mx-auto mb-2 text-[#1E3A5F]" />
                <div className="text-base font-semibold text-white">No tasks found</div>
                <p className="text-xs text-gray-500 mt-1">There are no tasks matching your current filter.</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isPending = task.status === 'pending';
                const isSubmitted = task.status === 'submitted_for_approval';
                const isApproved = task.status === 'approved_completed';
                const isRejected = task.status === 'rejected';

                const priorityColor = 
                  task.priority === 'High' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
                  task.priority === 'Medium' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                  'bg-[#00C2FF]/15 text-[#00C2FF] border-[#00C2FF]/30';

                return (
                  <div
                    key={task.id}
                    className={`bg-[#111827] rounded-2xl border p-5 shadow-sm transition flex flex-col justify-between ${
                      isSubmitted 
                        ? 'border-amber-400/80 bg-[#141C2B] ring-1 ring-amber-400/40' 
                        : isApproved 
                        ? 'border-[#00E5A0]/40 bg-[#0F1D24]' 
                        : isRejected 
                        ? 'border-rose-500/50 bg-[#1D141C]' 
                        : 'border-[#1E3A5F] hover:border-[#00C2FF]/40'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${priorityColor}`}>
                            {task.priority} Priority
                          </span>
                          <span className="text-xs font-semibold text-gray-300 bg-[#0A0A0A] border border-[#1E3A5F] px-2 py-0.5 rounded">
                            {task.workspaceName}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isSubmitted && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-full border border-amber-400/40 animate-pulse">
                              <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" />
                              Awaiting Approval
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-[#00E5A0]/20 text-[#00E5A0] text-xs font-bold rounded-full border border-[#00E5A0]/40">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Approved & Complete
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-rose-500/20 text-rose-300 text-xs font-bold rounded-full border border-rose-400/40">
                              <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-400" />
                              Changes Requested
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-[#0A0A0A] text-gray-300 text-xs font-bold rounded-full border border-[#1E3A5F]">
                              <Clock className="w-3.5 h-3.5 mr-1 text-[#00C2FF]" />
                              Pending Execution
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-base font-bold text-white tracking-tight">{task.title}</h4>
                      {task.description && (
                        <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">{task.description}</p>
                      )}

                      {/* Feedback Note if present */}
                      {task.adminFeedback && (
                        <div className={`mt-3 p-2.5 rounded-xl border text-xs ${
                          isApproved 
                            ? 'bg-[#00E5A0]/10 border-[#00E5A0]/30 text-[#00E5A0]' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}>
                          <strong className="block text-[11px] uppercase tracking-wider mb-0.5">Admin Feedback:</strong>
                          {task.adminFeedback}
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata & Controls */}
                    <div className="mt-5 pt-3 border-t border-[#1E3A5F]/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-xs text-[#7B7B7B]">
                        <div className="flex items-center gap-1 font-semibold text-gray-300">
                          <Users className="w-3.5 h-3.5 text-[#00C2FF]" />
                          <span>{task.assignedWarriorName}</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{task.dueDate}</span>
                        </div>
                      </div>

                      {/* Role Actions */}
                      <div className="flex items-center gap-2">
                        {/* Warrior Submission Button */}
                        {isWarrior && isPending && (
                          <button
                            onClick={() => handleSubmitForApproval(task.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-[#0A0A0A] rounded-xl text-xs font-bold shadow-md shadow-[#00C2FF]/20 transition"
                          >
                            <Send className="w-3 h-3" />
                            Submit For Approval
                          </button>
                        )}

                        {/* Admin Approval / Rejection Controls */}
                        {isAdmin && isSubmitted && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenFeedbackModal(task.id, 'reject')}
                              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleOpenFeedbackModal(task.id, 'approve')}
                              className="px-3 py-1 bg-[#00E5A0] hover:bg-[#00E5A0]/80 text-[#0A0A0A] rounded-xl text-xs font-bold shadow transition"
                            >
                              Approve
                            </button>
                          </div>
                        )}

                        {/* Admin Delete */}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this task?')) deleteTask(task.id);
                            }}
                            className="p-1.5 text-[#7B7B7B] hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                            title="Delete Task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY OUTREACH REPORTS IN CYBER THEME */}
      {activeSubTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-[#111827] rounded-2xl border border-[#1E3A5F] shadow-sm overflow-hidden">
            <div className="p-4 bg-[#0A0A0A] border-b border-[#1E3A5F] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">ROS Warrior Daily Outreach Submissions</h3>
                <p className="text-xs text-gray-400">Summary of daily volume, follow-ups sent, positive replies and calls booked.</p>
              </div>
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00E5A0] hover:bg-[#00E5A0]/80 text-[#0A0A0A] rounded-xl text-xs font-bold transition shadow"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                Submit Today's Report
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#0A0A0A]/90 text-[#7B7B7B] text-xs font-semibold uppercase tracking-wider border-b border-[#1E3A5F]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Warrior</th>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4 text-center">Initial Sent</th>
                    <th className="py-3 px-4 text-center">Follow-ups</th>
                    <th className="py-3 px-4 text-center">Replies</th>
                    <th className="py-3 px-4 text-center">Calls Booked</th>
                    <th className="py-3 px-4">Notes & Observations</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3A5F]/40">
                  {(dailyReports || []).length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="py-10 text-center text-gray-500">
                        No daily reports submitted yet.
                      </td>
                    </tr>
                  ) : (
                    dailyReports.map(rep => {
                      const isApproved = rep.status === 'approved';
                      const isRevision = rep.status === 'revision_needed';
                      const isPending = !rep.status || rep.status === 'pending_approval';

                      return (
                        <tr key={rep.id} className="hover:bg-[#0A0A0A]/60 transition">
                          <td className="py-3 px-4 font-mono font-semibold text-gray-300 text-xs">{rep.date}</td>
                          <td className="py-3 px-4 font-bold text-white text-xs">{rep.warriorName}</td>
                          <td className="py-3 px-4 text-xs font-medium text-[#00C2FF]">{rep.workspaceName}</td>
                          <td className="py-3 px-4 text-center font-bold text-white font-mono">{rep.initialSent}</td>
                          <td className="py-3 px-4 text-center font-bold text-[#00C2FF] font-mono">{rep.followUpsSent}</td>
                          <td className="py-3 px-4 text-center font-bold text-amber-400 font-mono">{rep.repliesReceived}</td>
                          <td className="py-3 px-4 text-center font-black text-[#00E5A0] font-mono">
                            {rep.callsBooked > 0 ? `🎯 ${rep.callsBooked}` : 0}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-400 max-w-xs">
                            <div>{rep.notes || '—'}</div>
                            {rep.adminFeedback && (
                              <div className="text-[11px] text-amber-300/80 mt-1 font-sans">
                                💬 Admin: "{rep.adminFeedback}"
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/30">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approved
                              </span>
                            ) : isRevision ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30" title={rep.adminFeedback || 'Revision requested'}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                Revision Needed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                                <Clock className="w-3.5 h-3.5" />
                                Pending Approval
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isApproved && (
                                  <button
                                    onClick={() => approveDailyReport(rep.id, 'Report verified and signed off.')}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-[#00E5A0]/20 hover:bg-[#00E5A0] text-[#00E5A0] hover:text-[#0A0A0A] border border-[#00E5A0]/40 rounded-lg text-xs font-bold transition shadow-sm"
                                    title="Approve Report"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Approve
                                  </button>
                                )}

                                {!isRevision && (
                                  <button
                                    onClick={() => {
                                      const reason = window.prompt('Provide revision notes for warrior:', 'Please verify follow-ups and resubmit.');
                                      if (reason !== null) {
                                        rejectDailyReport(rep.id, reason);
                                      }
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-[#0A0A0A] border border-amber-500/40 rounded-lg text-xs font-bold transition"
                                    title="Request Revision"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Revision
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    if (window.confirm('Delete this report permanently?')) deleteDailyReport(rep.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                                  title="Delete Report"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROS WARRIORS MANAGEMENT (ADMIN ONLY) */}
      {isAdmin && activeSubTab === 'warriors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-[#111827] p-4 rounded-2xl border border-[#1E3A5F] shadow-sm">
            <div>
              <h3 className="text-base font-bold text-white">ROS Warriors Team & Access Control</h3>
              <p className="text-xs text-gray-400">Manage campaign managers, set Edit & Use vs View Only rights in real-time, and assign client workspaces.</p>
            </div>
            <button
              onClick={handleOpenNewWarrior}
              className="flex items-center gap-2 px-4 py-2 bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-[#0A0A0A] rounded-xl text-xs font-bold transition shadow-md shadow-[#00C2FF]/20"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Add ROS Warrior
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(warriors || []).length === 0 ? (
              <div className="col-span-2 bg-[#111827] rounded-2xl border border-[#1E3A5F] p-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-2 text-[#1E3A5F]" />
                <div className="text-base font-semibold text-white">No Warriors Configured</div>
                <p className="text-xs text-gray-500 mt-1">Add your team members to grant them access to client campaigns.</p>
              </div>
            ) : (
              warriors.map(w => {
                const isEdit = w.accessLevel === 'edit';

                return (
                  <div key={w.id} className="bg-[#111827] rounded-2xl border border-[#1E3A5F] p-5 shadow-sm hover:border-[#00C2FF]/40 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">{w.name}</h4>
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${
                            isEdit ? 'bg-[#00E5A0]/15 text-[#00E5A0] border-[#00E5A0]/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}>
                            {isEdit ? '⚡ Edit & Use' : '👁️ View Only'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1.5">Username: <span className="font-mono font-bold text-[#00C2FF]">{w.username}</span></div>
                        <div className="text-xs text-gray-400">Password: <span className="font-mono font-bold text-gray-200">{w.password}</span></div>
                        <div className="text-xs text-gray-400">Email: {w.email || 'N/A'}</div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditWarrior(w)}
                          className="p-1.5 text-gray-400 hover:text-[#00C2FF] hover:bg-[#0A0A0A] rounded-lg transition"
                          title="Edit Permissions"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete warrior ${w.name}?`)) deleteWarrior(w.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                          title="Delete Warrior"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Permitted Workspaces */}
                    <div className="mt-4 pt-3 border-t border-[#1E3A5F]/60">
                      <span className="text-xs font-semibold text-[#7B7B7B] block mb-1.5">Permitted Client Workspaces:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(w.allowedWorkspaceIds || []).map(wsId => {
                          const ws = workspaces.find(item => item.id === wsId);
                          return (
                            <span key={wsId} className="px-2 py-0.5 bg-[#0A0A0A] text-[#00C2FF] text-[11px] font-semibold rounded-lg border border-[#1E3A5F]">
                              {ws ? ws.name : wsId}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Security Badge */}
                    <div className="mt-3 pt-2 text-[11px] text-gray-500 flex items-center gap-1 border-t border-[#1E3A5F]/30">
                      <Lock className="w-3 h-3 text-[#00E5A0]" />
                      Payments & Invoices section is strictly hidden and inaccessible.
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE WARRIOR ACTION TIMELINE (SPY / AUDIT LOG) */}
      {isAdmin && activeSubTab === 'timeline' && (
        <div className="space-y-4">
          <div className="bg-[#111827] rounded-2xl border border-[#1E3A5F] shadow-sm p-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E3A5F]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-[#00C2FF]" />
                  Live Warrior Action Audit Timeline
                </h3>
                <p className="text-xs text-gray-400">Real-time log of actions, batch copies, task submissions, and status changes performed by team managers.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#00E5A0]/15 text-[#00E5A0] text-xs font-bold rounded-full border border-[#00E5A0]/30">
                <span className="w-2 h-2 rounded-full bg-[#00E5A0] animate-ping" />
                Live 5s Cloud Sync
              </span>
            </div>

            {/* Timeline Stream */}
            <div className="mt-4 space-y-3">
              {(warriorTimeline || []).length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  <History className="w-10 h-10 mx-auto mb-2 text-[#1E3A5F]" />
                  No actions logged yet. When a warrior logs in, copies a batch, or updates leads, actions will stream here in real time.
                </div>
              ) : (
                warriorTimeline.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-3.5 bg-[#0A0A0A] hover:bg-[#131E2F] rounded-xl border border-[#1E3A5F] transition">
                    <div className="w-8 h-8 rounded-lg bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{item.warriorName}</span>
                        <span className="text-[11px] text-[#7B7B7B] font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-0.5 font-medium">{item.details}</p>
                      {item.workspaceName && (
                        <span className="inline-block mt-1 text-[10px] bg-[#111827] px-2 py-0.5 rounded border border-[#1E3A5F] text-[#00C2FF] font-mono font-semibold">
                          Client: {item.workspaceName}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN NEW TASK IN CYBER THEME */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E3A5F]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#00C2FF]" />
                Assign Task to ROS Warrior
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Task Title</label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder="e.g. Dispatch 300 Follow-ups for Crewlix UK"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Detailed Instructions</label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  placeholder="Filter by juned@ sending mailbox and dispatch Email 2..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Assign To Warrior</label>
                  <select
                    value={taskFormData.assignedWarriorId}
                    onChange={(e) => setTaskFormData({ ...taskFormData, assignedWarriorId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  >
                    {warriors.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Target Client Workspace</label>
                  <select
                    value={taskFormData.workspaceId}
                    onChange={(e) => setTaskFormData({ ...taskFormData, workspaceId: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  >
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Priority</label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Due Deadline</label>
                  <input
                    type="text"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                    placeholder="e.g. Today - 04:00 PM"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-[#1E3A5F] rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#0A0A0A] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-[#0A0A0A] rounded-xl text-sm font-bold shadow transition"
                >
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN FEEDBACK & APPROVAL / REJECTION */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <h3 className="text-lg font-bold text-white mb-2">
              {actionFeedbackType === 'approve' ? '✅ Approve & Sign-Off Task' : '❌ Request Revision on Task'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {actionFeedbackType === 'approve' 
                ? 'Confirm that the outreach was executed properly and mark this task as successfully completed.' 
                : 'Send feedback to the warrior indicating what needs to be fixed or resent.'}
            </p>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
              placeholder="Leave optional notes or requirements..."
            />

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 border border-[#1E3A5F] rounded-xl text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFeedbackAction}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition shadow ${
                  actionFeedbackType === 'approve' ? 'bg-[#00E5A0] hover:bg-[#00E5A0]/80 text-[#0A0A0A]' : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {actionFeedbackType === 'approve' ? 'Confirm Approval' : 'Send Revision Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT DAILY REPORT */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E3A5F]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#00E5A0]" />
                Submit Daily Outreach Report
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
            </div>

            {reportSuccessMessage ? (
              <div className="my-6 p-6 bg-[#00E5A0]/15 border border-[#00E5A0]/40 rounded-xl text-center text-sm font-bold text-[#00E5A0] flex flex-col items-center gap-3">
                <CheckCircle2 className="w-10 h-10 text-[#00E5A0]" />
                <div className="text-base text-white">{reportSuccessMessage}</div>
                <p className="text-xs text-gray-400 font-normal">Your metrics are now awaiting Admin review and approval in the Admin portal.</p>
              </div>
            ) : (
              <form onSubmit={handleSaveReport} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Target Client Workspace</label>
                <select
                  value={reportFormData.workspaceId}
                  onChange={(e) => setReportFormData({ ...reportFormData, workspaceId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                >
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Initial Sent (Email 1)</label>
                  <input
                    type="number"
                    value={reportFormData.initialSent}
                    onChange={(e) => setReportFormData({ ...reportFormData, initialSent: e.target.value })}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-bold font-mono text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Follow-ups Sent (Email 2/3)</label>
                  <input
                    type="number"
                    value={reportFormData.followUpsSent}
                    onChange={(e) => setReportFormData({ ...reportFormData, followUpsSent: e.target.value })}
                    placeholder="e.g. 400"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-bold font-mono text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Replies Received</label>
                  <input
                    type="number"
                    value={reportFormData.repliesReceived}
                    onChange={(e) => setReportFormData({ ...reportFormData, repliesReceived: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-bold font-mono text-amber-400 focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Discovery Calls Booked</label>
                  <input
                    type="number"
                    value={reportFormData.callsBooked}
                    onChange={(e) => setReportFormData({ ...reportFormData, callsBooked: e.target.value })}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-bold font-mono text-[#00E5A0] focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Observations / Deliverability Notes</label>
                <textarea
                  value={reportFormData.notes}
                  onChange={(e) => setReportFormData({ ...reportFormData, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. All mailboxes warmed up, zero bounces..."
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 border border-[#1E3A5F] rounded-xl text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00E5A0] hover:bg-[#00E5A0]/80 text-[#0A0A0A] rounded-xl text-sm font-bold shadow transition"
                >
                  Submit Report
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ROS WARRIOR (ADMIN ONLY) */}
      {isAdmin && showWarriorModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E3A5F]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00C2FF]" />
                {editingWarrior ? 'Edit ROS Warrior Access' : 'Add New ROS Warrior (Manager)'}
              </h3>
              <button onClick={() => setShowWarriorModal(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveWarrior} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Warrior Full Name</label>
                <input
                  type="text"
                  value={warriorFormData.name}
                  onChange={(e) => setWarriorFormData({ ...warriorFormData, name: e.target.value })}
                  placeholder="e.g. Alex (Outreach Manager)"
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Login Username</label>
                  <input
                    type="text"
                    value={warriorFormData.username}
                    onChange={(e) => setWarriorFormData({ ...warriorFormData, username: e.target.value })}
                    placeholder="e.g. alex"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-mono text-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Login Password</label>
                  <input
                    type="text"
                    value={warriorFormData.password}
                    onChange={(e) => setWarriorFormData({ ...warriorFormData, password: e.target.value })}
                    placeholder="e.g. warrior2026"
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-mono text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                    required
                  />
                </div>
              </div>

              {/* Access Level: Edit & Use vs View Only */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Access Level Permission (Real-Time)</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                    warriorFormData.accessLevel === 'edit' 
                      ? 'border-[#00E5A0] bg-[#00E5A0]/10 text-white' 
                      : 'border-[#1E3A5F] bg-[#0A0A0A] text-gray-400 hover:text-white'
                  }`}>
                    <input
                      type="radio"
                      name="accessLevel"
                      value="edit"
                      checked={warriorFormData.accessLevel === 'edit'}
                      onChange={() => setWarriorFormData({ ...warriorFormData, accessLevel: 'edit' })}
                      className="text-[#00E5A0] focus:ring-[#00E5A0]"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">⚡ Edit & Use</div>
                      <div className="text-[10px] text-gray-400">Can copy batches, update lead status & submit tasks</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                    warriorFormData.accessLevel === 'view' 
                      ? 'border-amber-400 bg-amber-500/10 text-white' 
                      : 'border-[#1E3A5F] bg-[#0A0A0A] text-gray-400 hover:text-white'
                  }`}>
                    <input
                      type="radio"
                      name="accessLevel"
                      value="view"
                      checked={warriorFormData.accessLevel === 'view'}
                      onChange={() => setWarriorFormData({ ...warriorFormData, accessLevel: 'view' })}
                      className="text-amber-400 focus:ring-amber-400"
                    />
                    <div>
                      <div className="text-xs font-bold text-white">👁️ View Only</div>
                      <div className="text-[10px] text-gray-400">Read-only inspection without editing data</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Permitted Workspaces Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Permitted Client Workspaces</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-[#1E3A5F] rounded-xl p-2.5 bg-[#0A0A0A]">
                  {workspaces.map(ws => {
                    const isChecked = (warriorFormData.allowedWorkspaceIds || []).includes(ws.id);
                    return (
                      <label key={ws.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const prevIds = warriorFormData.allowedWorkspaceIds || [];
                            const nextIds = e.target.checked
                              ? [...prevIds, ws.id]
                              : prevIds.filter(id => id !== ws.id);
                            setWarriorFormData({ ...warriorFormData, allowedWorkspaceIds: nextIds });
                          }}
                          className="rounded text-[#00C2FF] focus:ring-[#00C2FF]"
                        />
                        <span className="font-semibold text-white">{ws.name}</span> ({ws.clientName || 'Client'})
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Permitted Feature Modules / Tabs */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-300">
                    Permitted Feature Modules & Tabs
                  </label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setWarriorFormData({ 
                        ...warriorFormData, 
                        allowedTabs: ['dispatcher', 'pipeline', 'telemetry', 'leads', 'email-copies', 'form-submissions', 'tasks', 'chat'] 
                      })}
                      className="text-[#00C2FF] hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={() => setWarriorFormData({ ...warriorFormData, allowedTabs: [] })}
                      className="text-gray-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border border-[#1E3A5F] rounded-xl p-2.5 bg-[#0A0A0A] max-h-40 overflow-y-auto">
                  {[
                    { id: 'dispatcher', label: 'Mail Merge Dispatcher', icon: '🚀' },
                    { id: 'pipeline', label: 'Interested Pipeline', icon: '🎯' },
                    { id: 'telemetry', label: 'Campaign Analytics', icon: '📊' },
                    { id: 'leads', label: 'All Leads Sheet', icon: '📋' },
                    { id: 'email-copies', label: 'Email Copies & Notes', icon: '✉️' },
                    { id: 'form-submissions', label: 'Form Submissions', icon: '🌐' },
                    { id: 'tasks', label: 'Tasks & Approvals', icon: '✅' },
                    { id: 'chat', label: 'Chat Direct Line', icon: '💬' }
                  ].map(tab => {
                    const isChecked = (warriorFormData.allowedTabs || []).includes(tab.id);
                    return (
                      <label key={tab.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white p-1 rounded hover:bg-[#111827]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const prevTabs = warriorFormData.allowedTabs || [];
                            const nextTabs = e.target.checked
                              ? [...prevTabs, tab.id]
                              : prevTabs.filter(t => t !== tab.id);
                            setWarriorFormData({ ...warriorFormData, allowedTabs: nextTabs });
                          }}
                          className="rounded text-[#00C2FF] focus:ring-[#00C2FF]"
                        />
                        <span className="text-xs">{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setShowWarriorModal(false)}
                  className="px-4 py-2 border border-[#1E3A5F] rounded-xl text-sm text-gray-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-[#0A0A0A] rounded-xl text-sm font-bold shadow transition"
                >
                  {editingWarrior ? 'Save Permissions' : 'Create Warrior'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
