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

    setShowReportModal(false);
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
      allowedTabs: ['dispatcher', 'pipeline', 'leads', 'email-copies', 'tasks']
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
      allowedTabs: w.allowedTabs || ['dispatcher', 'pipeline', 'leads', 'email-copies', 'tasks']
    });
    setShowWarriorModal(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-sky-950 text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/20 border border-sky-400/30 rounded-full text-sky-300 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5" />
            {isAdmin ? 'Admin Mission Control · Task Delegation' : 'ROS Warrior Station · Assigned Work'}
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            Tasks, Approvals & ROS Warriors
          </h1>
          <p className="text-slate-300 text-sm mt-1">
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
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-sky-500/25 transition transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Assign New Task
            </button>
          )}

          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold border border-white/20 transition backdrop-blur-sm"
          >
            <Send className="w-4 h-4" />
            Submit Daily Report
          </button>
        </div>
      </div>

      {/* Sub-Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
            activeSubTab === 'tasks'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Tasks & Approvals
          {pendingApprovalCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-amber-500 text-slate-950 text-xs font-black rounded-full animate-pulse">
              {pendingApprovalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
            activeSubTab === 'reports'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          Daily Outreach Reports
          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
            {dailyReports?.length || 0}
          </span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('warriors')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              activeSubTab === 'warriors'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            ROS Warriors (Managers)
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {warriors?.length || 0}
            </span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
              activeSubTab === 'timeline'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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
          <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Status:
              </span>
              {['all', 'pending', 'submitted_for_approval', 'approved_completed', 'rejected'].map(statusKey => {
                const label = 
                  statusKey === 'all' ? 'All Tasks' :
                  statusKey === 'pending' ? 'In Progress / Pending' :
                  statusKey === 'submitted_for_approval' ? '⏳ Submitted for Approval' :
                  statusKey === 'approved_completed' ? '✅ Approved & Done' : '❌ Needs Revision';

                return (
                  <button
                    key={statusKey}
                    onClick={() => setTaskStatusFilter(statusKey)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      taskStatusFilter === statusKey
                        ? 'bg-slate-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">Warrior:</span>
                <select
                  value={taskWarriorFilter}
                  onChange={(e) => setTaskWarriorFilter(e.target.value)}
                  className="px-2.5 py-1 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-700"
                >
                  <option value="all">All Warriors</option>
                  {warriors.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Task Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.length === 0 ? (
              <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                <CheckSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <div className="text-base font-semibold text-gray-700">No tasks found</div>
                <p className="text-xs text-gray-600 mt-1">There are no tasks matching your current filter.</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isPending = task.status === 'pending';
                const isSubmitted = task.status === 'submitted_for_approval';
                const isApproved = task.status === 'approved_completed';
                const isRejected = task.status === 'rejected';

                const priorityColor = 
                  task.priority === 'High' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                  task.priority === 'Medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-blue-100 text-blue-700 border-blue-200';

                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-xl border p-5 shadow-sm transition flex flex-col justify-between ${
                      isSubmitted 
                        ? 'border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20' 
                        : isApproved 
                        ? 'border-green-200 bg-green-50/10' 
                        : isRejected 
                        ? 'border-rose-300 bg-rose-50/20' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${priorityColor}`}>
                            {task.priority} Priority
                          </span>
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {task.workspaceName}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isSubmitted && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300 animate-pulse">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              Awaiting Admin Approval
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full border border-green-300">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Approved & Complete
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-300">
                              <AlertCircle className="w-3.5 h-3.5 mr-1" />
                              Changes Requested
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full border border-slate-300">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              Pending Execution
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Task Title & Description */}
                      <h3 className="text-base font-bold text-gray-900 leading-snug">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {task.description}
                        </p>
                      )}

                      {/* Admin Feedback Box if rejected or approved with feedback */}
                      {task.adminFeedback && (
                        <div className={`mt-2 p-2.5 rounded-lg text-xs font-medium border ${
                          isRejected ? 'bg-rose-50 text-rose-900 border-rose-200' : 'bg-green-50 text-green-900 border-green-200'
                        }`}>
                          <span className="font-bold">Admin Feedback:</span> {task.adminFeedback}
                        </div>
                      )}

                      {/* Meta Info */}
                      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="text-gray-600 block">Assigned ROS Warrior:</span>
                          <span className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3 text-sky-600" />
                            {task.assignedWarriorName}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 block">Due Deadline:</span>
                          <span className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {task.dueDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      {/* Warrior Action */}
                      {isWarrior && (
                        <div>
                          {isPending || isRejected ? (
                            <button
                              onClick={() => handleSubmitForApproval(task.id)}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm transition"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Submit for Admin Approval
                            </button>
                          ) : isSubmitted ? (
                            <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Admin notified on desktop. Awaiting sign-off.
                            </span>
                          ) : (
                            <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approved by Admin
                            </span>
                          )}
                        </div>
                      )}

                      {/* Admin Actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-2 ml-auto">
                          {isSubmitted && (
                            <>
                              <button
                                onClick={() => handleOpenFeedbackModal(task.id, 'approve')}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve & Sign-Off
                              </button>
                              <button
                                onClick={() => handleOpenFeedbackModal(task.id, 'reject')}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                Request Changes
                              </button>
                            </>
                          )}
                          {isApproved && (
                            <span className="text-xs text-green-700 font-bold flex items-center gap-1 mr-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              Completed
                            </span>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this task?')) deleteTask(task.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete Task"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY OUTREACH REPORTS */}
      {activeSubTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">ROS Warrior Daily Outreach Submissions</h3>
                <p className="text-xs text-gray-500">Summary of daily volume, follow-ups sent, positive replies and calls booked.</p>
              </div>
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Submit Today's Report
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-100/70 text-gray-700 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Warrior</th>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4 text-center">Initial Sent</th>
                    <th className="py-3 px-4 text-center">Follow-ups</th>
                    <th className="py-3 px-4 text-center">Replies</th>
                    <th className="py-3 px-4 text-center">Calls Booked</th>
                    <th className="py-3 px-4">Notes & Observations</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(dailyReports || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-gray-400">
                        No daily reports submitted yet.
                      </td>
                    </tr>
                  ) : (
                    dailyReports.map(rep => (
                      <tr key={rep.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-gray-900 text-xs">{rep.date}</td>
                        <td className="py-3 px-4 font-bold text-gray-800 text-xs">{rep.warriorName}</td>
                        <td className="py-3 px-4 text-xs font-medium text-gray-600">{rep.workspaceName}</td>
                        <td className="py-3 px-4 text-center font-bold text-gray-900">{rep.initialSent}</td>
                        <td className="py-3 px-4 text-center font-bold text-sky-700">{rep.followUpsSent}</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-700">{rep.repliesReceived}</td>
                        <td className="py-3 px-4 text-center font-black text-emerald-600">
                          {rep.callsBooked > 0 ? `🎯 ${rep.callsBooked}` : 0}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600 max-w-xs">{rep.notes || '—'}</td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this report?')) deleteDailyReport(rep.id);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
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
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-gray-900">ROS Warriors Team & Access Control</h3>
              <p className="text-xs text-gray-500">Manage campaign managers, set Edit & Use vs View Only rights, and assign client workspaces.</p>
            </div>
            <button
              onClick={handleOpenNewWarrior}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add ROS Warrior
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(warriors || []).map(w => {
              const isEdit = w.accessLevel === 'edit';

              return (
                <div key={w.id} className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-gray-900">{w.name}</h4>
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${
                          isEdit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isEdit ? '⚡ Edit & Use' : '👁️ View Only'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Username: <span className="font-mono font-bold text-gray-700">{w.username}</span></div>
                      <div className="text-xs text-gray-500">Password: <span className="font-mono font-bold text-gray-700">{w.password}</span></div>
                      <div className="text-xs text-gray-500">Email: {w.email || 'N/A'}</div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditWarrior(w)}
                        className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                        title="Edit Permissions"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete warrior ${w.name}?`)) deleteWarrior(w.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Warrior"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Permitted Workspaces */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-600 block mb-1.5">Permitted Client Workspaces:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(w.allowedWorkspaceIds || []).map(wsId => {
                        const ws = workspaces.find(item => item.id === wsId);
                        return (
                          <span key={wsId} className="px-2 py-0.5 bg-sky-50 text-sky-800 text-[11px] font-semibold rounded border border-sky-200">
                            {ws ? ws.name : wsId}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Security Badge */}
                  <div className="mt-3 pt-2 text-[11px] text-gray-600 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gray-600" />
                    Payments & Retainers section is strictly hidden and inaccessible.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE WARRIOR ACTION TIMELINE (SPY / AUDIT LOG) */}
      {isAdmin && activeSubTab === 'timeline' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Live Warrior Action Audit Timeline
                </h3>
                <p className="text-xs text-gray-500">Real-time log of actions, batch copies, task submissions, and status changes performed by team managers.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                Live Tracking Active
              </span>
            </div>

            {/* Timeline Stream */}
            <div className="mt-4 space-y-3">
              {(warriorTimeline || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No actions logged yet.
                </div>
              ) : (
                warriorTimeline.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/60 transition">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-900">{item.warriorName}</span>
                        <span className="text-[11px] text-gray-600 font-medium">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 mt-0.5 font-medium">{item.details}</p>
                      {item.workspaceName && (
                        <span className="inline-block mt-1 text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600 font-semibold">
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

      {/* MODAL: ASSIGN NEW TASK */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-sky-600" />
                Assign Task to ROS Warrior
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Task Title</label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder="e.g. Dispatch 300 Follow-ups for Crewlix UK"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Detailed Instructions</label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  placeholder="Filter by juned@ sending mailbox and dispatch Email 2..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Assign To Warrior</label>
                  <select
                    value={taskFormData.assignedWarriorId}
                    onChange={(e) => setTaskFormData({ ...taskFormData, assignedWarriorId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  >
                    {warriors.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Client Workspace</label>
                  <select
                    value={taskFormData.workspaceId}
                    onChange={(e) => setTaskFormData({ ...taskFormData, workspaceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  >
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Due Deadline</label>
                  <input
                    type="text"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                    placeholder="e.g. Today - 04:00 PM"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-bold shadow transition"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scaleUp">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {actionFeedbackType === 'approve' ? '✅ Approve & Sign-Off Task' : '❌ Request Revision on Task'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {actionFeedbackType === 'approve' 
                ? 'Confirm that the outreach was executed properly and mark this task as successfully completed.' 
                : 'Send feedback to the warrior indicating what needs to be fixed or resent.'}
            </p>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              placeholder="Leave optional notes or requirements..."
            />

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFeedbackAction}
                className={`px-5 py-2 text-white rounded-lg text-sm font-bold transition shadow ${
                  actionFeedbackType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-rose-600 hover:bg-rose-700'
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Submit Daily Outreach Report
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveReport} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Client Workspace</label>
                <select
                  value={reportFormData.workspaceId}
                  onChange={(e) => setReportFormData({ ...reportFormData, workspaceId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Sent (Email 1)</label>
                  <input
                    type="number"
                    value={reportFormData.initialSent}
                    onChange={(e) => setReportFormData({ ...reportFormData, initialSent: e.target.value })}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Follow-ups Sent (Email 2/3)</label>
                  <input
                    type="number"
                    value={reportFormData.followUpsSent}
                    onChange={(e) => setReportFormData({ ...reportFormData, followUpsSent: e.target.value })}
                    placeholder="e.g. 400"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Replies Received</label>
                  <input
                    type="number"
                    value={reportFormData.repliesReceived}
                    onChange={(e) => setReportFormData({ ...reportFormData, repliesReceived: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Discovery Calls Booked</label>
                  <input
                    type="number"
                    value={reportFormData.callsBooked}
                    onChange={(e) => setReportFormData({ ...reportFormData, callsBooked: e.target.value })}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Observations / Deliverability Notes</label>
                <textarea
                  value={reportFormData.notes}
                  onChange={(e) => setReportFormData({ ...reportFormData, notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. All mailboxes warmed up, zero bounces..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow transition"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ROS WARRIOR (ADMIN ONLY) */}
      {isAdmin && showWarriorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                {editingWarrior ? 'Edit ROS Warrior Access' : 'Add New ROS Warrior (Manager)'}
              </h3>
              <button onClick={() => setShowWarriorModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveWarrior} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Warrior Full Name</label>
                <input
                  type="text"
                  value={warriorFormData.name}
                  onChange={(e) => setWarriorFormData({ ...warriorFormData, name: e.target.value })}
                  placeholder="e.g. Farhan (Outreach Lead)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Login Username</label>
                  <input
                    type="text"
                    value={warriorFormData.username}
                    onChange={(e) => setWarriorFormData({ ...warriorFormData, username: e.target.value })}
                    placeholder="e.g. farhan"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Login Password</label>
                  <input
                    type="text"
                    value={warriorFormData.password}
                    onChange={(e) => setWarriorFormData({ ...warriorFormData, password: e.target.value })}
                    placeholder="e.g. warrior2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    required
                  />
                </div>
              </div>

              {/* Access Level: Edit & Use vs View Only */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Access Level Permission</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                    warriorFormData.accessLevel === 'edit' 
                      ? 'border-emerald-500 bg-emerald-50/40' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="accessLevel"
                      value="edit"
                      checked={warriorFormData.accessLevel === 'edit'}
                      onChange={() => setWarriorFormData({ ...warriorFormData, accessLevel: 'edit' })}
                      className="text-emerald-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-900">⚡ Edit & Use</div>
                      <div className="text-[10px] text-gray-500">Can copy batches, update lead status & submit tasks</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                    warriorFormData.accessLevel === 'view' 
                      ? 'border-slate-800 bg-slate-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="accessLevel"
                      value="view"
                      checked={warriorFormData.accessLevel === 'view'}
                      onChange={() => setWarriorFormData({ ...warriorFormData, accessLevel: 'view' })}
                      className="text-slate-800"
                    />
                    <div>
                      <div className="text-xs font-bold text-gray-900">👁️ View Only</div>
                      <div className="text-[10px] text-gray-500">Read-only inspection without editing data</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Permitted Workspaces Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Permitted Client Workspaces</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2.5 bg-gray-50">
                  {workspaces.map(ws => {
                    const isChecked = (warriorFormData.allowedWorkspaceIds || []).includes(ws.id);
                    return (
                      <label key={ws.id} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
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
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-semibold">{ws.name}</span> ({ws.clientName || 'Client'})
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowWarriorModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow transition"
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
