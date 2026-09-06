import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Mail, 
  Copy, 
  Check, 
  Plus, 
  Edit3, 
  Trash2, 
  Pin, 
  CheckSquare, 
  Square, 
  Layers, 
  FileText, 
  Sparkles, 
  Clock, 
  Building2, 
  Search, 
  AlertCircle,
  Calendar,
  X,
  Send,
  AtSign,
  Bookmark
} from 'lucide-react';

export default function EmailCopiesNotes() {
  const { 
    currentWorkspace, 
    workspaces,
    emailCopies, 
    addEmailCopy, 
    updateEmailCopy, 
    deleteEmailCopy,
    importantNotes, 
    addNote, 
    deleteNote, 
    togglePinNote,
    todos, 
    addTodo, 
    toggleTodo, 
    deleteTodo,
    currentUser,
    logWarriorAction
  } = useWorkspace();

  const isWarriorReadOnly = currentUser?.role === 'warrior' && currentUser?.accessLevel === 'view';

  const [activeSubTab, setActiveSubTab] = useState('copies'); // 'copies', 'notes'
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSequence, setSelectedSequence] = useState('all');
  const [copySearchQuery, setCopySearchQuery] = useState('');
  
  // Modals / forms
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [editingCopyId, setEditingCopyId] = useState(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  
  // Copy form state
  const [formBrand, setFormBrand] = useState(currentWorkspace?.name || 'Crewlix UK');
  const [formSequence, setFormSequence] = useState('email1');
  const [formAccount, setFormAccount] = useState(currentWorkspace?.activeSendingAccount || '');
  const [formSubjectA, setFormSubjectA] = useState('');
  const [formSubjectB, setFormSubjectB] = useState('');
  const [formBody, setFormBody] = useState('');

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState('Strategy');
  const [notePinned, setNotePinned] = useState(true);

  // Todo quick input
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState('medium');
  const [newTodoDueDate, setNewTodoDueDate] = useState('Today');

  // Copy to clipboard notifications
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    logWarriorAction('copied_text', `Copied text template (${key})`);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Filtered Email Copies
  const filteredCopies = useMemo(() => {
    return (emailCopies || []).filter(c => {
      if (selectedBrand !== 'all' && c.brandName !== selectedBrand && c.workspaceId !== selectedBrand) return false;
      if (selectedSequence !== 'all' && c.sequenceStep !== selectedSequence) return false;
      if (copySearchQuery.trim()) {
        const q = copySearchQuery.toLowerCase();
        const text = `${c.subjectA} ${c.subjectB} ${c.body} ${c.assignedAccount} ${c.brandName}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [emailCopies, selectedBrand, selectedSequence, copySearchQuery]);

  // Open modal for editing
  const handleEditCopy = (copy) => {
    setEditingCopyId(copy.id);
    setFormBrand(copy.brandName || currentWorkspace?.name);
    setFormSequence(copy.sequenceStep || 'email1');
    setFormAccount(copy.assignedAccount || '');
    setFormSubjectA(copy.subjectA || '');
    setFormSubjectB(copy.subjectB || '');
    setFormBody(copy.body || '');
    setCopyModalOpen(true);
  };

  const handleSaveCopy = (e) => {
    e.preventDefault();
    if (!formSubjectA.trim() || !formBody.trim()) return;

    const seqLabels = {
      email1: 'Email 1 (Initial Cold Touch)',
      email2: 'Email 2 (Follow-up 1 - Value Add)',
      email3: 'Email 3 (Follow-up 2 - Breakup / Case Study)',
      email4: 'Email 4 (Re-engagement)'
    };

    if (editingCopyId) {
      updateEmailCopy(editingCopyId, {
        brandName: formBrand,
        sequenceStep: formSequence,
        sequenceLabel: seqLabels[formSequence] || 'Email Copy',
        assignedAccount: formAccount,
        subjectA: formSubjectA.trim(),
        subjectB: formSubjectB.trim(),
        body: formBody.trim()
      });
    } else {
      addEmailCopy({
        workspaceId: currentWorkspace?.id,
        brandName: formBrand,
        sequenceStep: formSequence,
        sequenceLabel: seqLabels[formSequence] || 'Email Copy',
        assignedAccount: formAccount,
        subjectA: formSubjectA.trim(),
        subjectB: formSubjectB.trim(),
        body: formBody.trim()
      });
    }

    setCopyModalOpen(false);
    setEditingCopyId(null);
    setFormSubjectA('');
    setFormSubjectB('');
    setFormBody('');
  };

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    addNote({
      title: noteTitle.trim(),
      content: noteContent.trim(),
      category: noteCategory,
      pinned: notePinned
    });
    setNoteModalOpen(false);
    setNoteTitle('');
    setNoteContent('');
  };

  const handleCreateTodo = (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    addTodo({
      text: newTodoText.trim(),
      priority: newTodoPriority,
      dueDate: newTodoDueDate
    });
    setNewTodoText('');
  };

  // Completed todos percentage
  const completedTodoCount = (todos || []).filter(t => t.completed).length;
  const todoPercentage = (todos || []).length > 0 ? Math.round((completedTodoCount / todos.length) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Sub-Tabs Header */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30 uppercase tracking-widest">
              Copywriting & Knowledge Hub
            </span>
            <span className="text-xs text-[#7B7B7B] font-mono">
              Workspace: <strong className="text-white">{currentWorkspace?.name}</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Email Copies, Strategy Notes & To-Dos
          </h2>
          <p className="text-xs text-[#7B7B7B] mt-1 max-w-2xl leading-relaxed">
            Manage high-converting outreach email templates with dual subject lines for A/B testing, assign to sending mailboxes, and maintain agency operational guidelines.
          </p>
        </div>

        {/* Sub-Tab Navigation Toggle */}
        <div className="flex items-center gap-1.5 bg-[#0A0A0A] p-1.5 rounded-2xl border border-[#1E3A5F]">
          <button
            onClick={() => setActiveSubTab('copies')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'copies'
                ? 'bg-[#00C2FF] text-[#0A0A0A] shadow-md shadow-[#00C2FF]/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Copy Management</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0A0A0A] text-[#00E5A0] font-mono">
              {(emailCopies || []).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('notes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'notes'
                ? 'bg-[#00E5A0] text-[#0A0A0A] shadow-md shadow-[#00E5A0]/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Important Notes & To-Do</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0A0A0A] text-[#00C2FF] font-mono">
              {(importantNotes || []).length + (todos || []).length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: EMAIL COPY MANAGEMENT */}
      {/* ========================================================================= */}
      {activeSubTab === 'copies' && (
        <div className="space-y-4">
          
          {/* Filters & Create Toolbar */}
          <div className="p-4 rounded-2xl bg-[#111827] border border-[#1E3A5F] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={copySearchQuery}
                  onChange={(e) => setCopySearchQuery(e.target.value)}
                  placeholder="Search subject, body, or account..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              {/* Brand Filter */}
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              >
                <option value="all">All Brands & Workspaces</option>
                {(workspaces || []).map(w => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>

              {/* Sequence Filter */}
              <select
                value={selectedSequence}
                onChange={(e) => setSelectedSequence(e.target.value)}
                className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              >
                <option value="all">All Sequence Steps</option>
                <option value="email1">Email 1 (Initial Outreach)</option>
                <option value="email2">Email 2 (Follow-up 1)</option>
                <option value="email3">Email 3 (Follow-up 2)</option>
              </select>

            </div>

            {/* Create Button */}
            {!isWarriorReadOnly && (
              <button
                onClick={() => {
                  setEditingCopyId(null);
                  setFormBrand(currentWorkspace?.name || 'Crewlix UK');
                  setFormSequence('email1');
                  setFormAccount(currentWorkspace?.activeSendingAccount || '');
                  setFormSubjectA('');
                  setFormSubjectB('');
                  setFormBody('');
                  setCopyModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-[#00C2FF]/20 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Create New Email Copy</span>
              </button>
            )}
          </div>

          {/* Email Copies Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredCopies.length === 0 ? (
              <div className="lg:col-span-2 p-12 text-center rounded-2xl bg-[#111827] border border-[#1E3A5F]">
                <Mail className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">No Email Copies Found</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  No templates match your selected filters. Click "+ Create New Email Copy" to draft multiple subject lines and sequences.
                </p>
              </div>
            ) : (
              filteredCopies.map(copy => (
                <div 
                  key={copy.id}
                  className="p-5 rounded-2xl bg-[#111827] border border-[#1E3A5F] hover:border-[#00C2FF]/40 transition-all flex flex-col justify-between shadow-xl space-y-4 relative"
                >
                  <div className="space-y-3.5">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#1E3A5F] pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#00C2FF]/15 text-[#00C2FF] border border-[#00C2FF]/30 font-mono text-[10px] font-bold">
                          {copy.sequenceLabel || copy.sequenceStep}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#0A0A0A] border border-[#1E3A5F] text-gray-300 font-mono text-[10px]">
                          {copy.brandName || 'Brand'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isWarriorReadOnly && (
                          <>
                            <button
                              onClick={() => handleEditCopy(copy)}
                              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1E3A5F] cursor-pointer"
                              title="Edit Copy"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteEmailCopy(copy.id)}
                              className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Delete Copy"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Assigned Sender Mailbox */}
                    {copy.assignedAccount && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#00E5A0] font-mono">
                        <AtSign className="w-3.5 h-3.5" />
                        <span>Assigned Mailbox: <strong>{copy.assignedAccount}</strong></span>
                      </div>
                    )}

                    {/* Subject Line A */}
                    <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] uppercase font-bold text-[#00C2FF] tracking-wider block">
                          Subject Line A (Primary)
                        </span>
                        <p className="text-xs text-white font-medium truncate mt-0.5">
                          {copy.subjectA}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopyText(copy.subjectA, `subj_a_${copy.id}`)}
                        className="px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] text-[#00C2FF] border border-[#00C2FF]/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer flex-shrink-0"
                      >
                        {copiedKey === `subj_a_${copy.id}` ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === `subj_a_${copy.id}` ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Subject Line B (A/B Test Variant) */}
                    <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] uppercase font-bold text-[#F97316] tracking-wider block">
                          Subject Line B (A/B Variant)
                        </span>
                        <p className="text-xs text-white font-medium truncate mt-0.5">
                          {copy.subjectB || '— No variant defined —'}
                        </p>
                      </div>
                      {copy.subjectB && (
                        <button
                          onClick={() => handleCopyText(copy.subjectB, `subj_b_${copy.id}`)}
                          className="px-2.5 py-1 rounded-lg bg-[#111827] hover:bg-[#1E3A5F] text-[#F97316] border border-[#F97316]/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer flex-shrink-0"
                        >
                          {copiedKey === `subj_b_${copy.id}` ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === `subj_b_${copy.id}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    {/* Body Content Preview */}
                    <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#1E3A5F] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                          Email Body (Supports Merge Tags)
                        </span>
                        <button
                          onClick={() => handleCopyText(copy.body, `body_${copy.id}`)}
                          className="px-2.5 py-1 rounded-lg bg-[#00E5A0]/10 hover:bg-[#00E5A0]/20 text-[#00E5A0] border border-[#00E5A0]/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `body_${copy.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === `body_${copy.id}` ? 'Body Copied!' : 'Copy Body'}</span>
                        </button>
                      </div>
                      <pre className="text-xs text-gray-300 font-sans whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto no-scrollbar font-normal">
                        {copy.body}
                      </pre>
                    </div>

                  </div>

                  <div className="text-[10px] text-[#7B7B7B] font-mono pt-1">
                    Last updated: {new Date(copy.updatedAt || Date.now()).toLocaleDateString('en-GB')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: IMPORTANT NOTES & TO-DO LIST */}
      {/* ========================================================================= */}
      {activeSubTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: IMPORTANT NOTES (Col 1-7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 rounded-2xl bg-[#111827] border border-[#1E3A5F] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-[#00C2FF]" />
                  Important Operational Notes & Client Guidelines
                </h3>
                <p className="text-xs text-[#7B7B7B]">
                  Critical outreach rules, domain warmup schedules, and client caveats.
                </p>
              </div>

              {!isWarriorReadOnly && (
                <button
                  onClick={() => setNoteModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#00C2FF]/10 hover:bg-[#00C2FF]/20 text-[#00C2FF] border border-[#00C2FF]/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Add Note</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {(importantNotes || []).map(note => (
                <div
                  key={note.id}
                  className={`p-4 rounded-2xl bg-[#111827] border transition-all ${
                    note.pinned ? 'border-[#00C2FF]/60 shadow-lg shadow-[#00C2FF]/5' : 'border-[#1E3A5F]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {note.pinned && <Pin className="w-3.5 h-3.5 text-[#00C2FF] fill-[#00C2FF]" />}
                      <h4 className="text-sm font-bold text-white">{note.title}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0A0A0A] border border-[#1E3A5F] text-[#00E5A0]">
                        {note.category}
                      </span>
                    </div>

                    {!isWarriorReadOnly && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => togglePinNote(note.id)}
                          className={`p-1 rounded hover:bg-[#1E3A5F] cursor-pointer ${note.pinned ? 'text-[#00C2FF]' : 'text-gray-400'}`}
                          title="Toggle Pin"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                          title="Delete Note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: ACTIONABLE TO-DO LIST (Col 8-12) */}
          <div className="lg:col-span-5 space-y-4">
            
            <div className="p-4 rounded-2xl bg-[#111827] border border-[#1E3A5F] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[#00E5A0]" />
                    Daily Operations Checklist
                  </h3>
                  <span className="text-xs text-[#7B7B7B]">
                    {completedTodoCount} of {(todos || []).length} completed ({todoPercentage}%)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-[#00E5A0] px-2 py-0.5 rounded bg-[#00E5A0]/10 border border-[#00E5A0]/30">
                  {todoPercentage}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-[#0A0A0A] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#00E5A0] transition-all duration-300"
                  style={{ width: `${todoPercentage}%` }}
                />
              </div>

              {/* Add Todo Form */}
              {!isWarriorReadOnly && (
                <form onSubmit={handleCreateTodo} className="pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      placeholder="Add high-priority task..."
                      className="flex-1 px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00E5A0]"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/90 text-[#0A0A0A] text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Todo Items */}
            <div className="space-y-2">
              {(todos || []).map(todo => (
                <div
                  key={todo.id}
                  onClick={() => toggleTodo(todo.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    todo.completed
                      ? 'bg-[#0A0A0A]/40 border-[#1E3A5F]/40 opacity-60'
                      : 'bg-[#111827] border-[#1E3A5F] hover:border-[#00E5A0]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {todo.completed ? (
                      <CheckSquare className="w-4 h-4 text-[#00E5A0] flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                    <span className={`text-xs ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                      {todo.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded uppercase ${
                      todo.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-[#0A0A0A] text-gray-400'
                    }`}>
                      {todo.dueDate || 'Today'}
                    </span>
                    {!isWarriorReadOnly && (
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-1 text-gray-500 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT EMAIL COPY */}
      {/* ========================================================================= */}
      {copyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl my-8 bg-[#111827] border border-[#1E3A5F] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#00C2FF]" />
                {editingCopyId ? 'Edit Email Copy' : 'Create New Email Copy Template'}
              </h3>
              <button
                onClick={() => setCopyModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCopy} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Brand / Workspace</label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                  >
                    {(workspaces || []).map(w => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Sequence Step</label>
                  <select
                    value={formSequence}
                    onChange={(e) => setFormSequence(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                  >
                    <option value="email1">Email 1 (Initial Cold Touch)</option>
                    <option value="email2">Email 2 (Follow-up 1 - Value Add)</option>
                    <option value="email3">Email 3 (Follow-up 2 - Breakup / Case Study)</option>
                    <option value="email4">Email 4 (Re-engagement)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Assigned Sender Mailbox</label>
                  <input
                    type="text"
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value)}
                    placeholder="e.g. juned@crewlixglobal.com"
                    className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white font-mono text-xs outline-none focus:border-[#00C2FF]"
                  />
                </div>
              </div>

              {/* Subject Line A */}
              <div>
                <label className="text-xs font-semibold text-[#00C2FF] flex items-center justify-between mb-1">
                  <span>Subject Line A (Primary) *</span>
                  <span className="text-[10px] text-gray-400 font-mono">Merge tags supported</span>
                </label>
                <input
                  type="text"
                  required
                  value={formSubjectA}
                  onChange={(e) => setFormSubjectA(e.target.value)}
                  placeholder="e.g. Quick inquiry regarding qualified care staff for {companyName}"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
                />
              </div>

              {/* Subject Line B (A/B Test Variant) */}
              <div>
                <label className="text-xs font-semibold text-[#F97316] flex items-center justify-between mb-1">
                  <span>Subject Line B (A/B Test Variant - Recommended)</span>
                  <span className="text-[10px] text-gray-400 font-mono">Alternative angle</span>
                </label>
                <input
                  type="text"
                  value={formSubjectB}
                  onChange={(e) => setFormSubjectB(e.target.value)}
                  placeholder="e.g. Reliable healthcare staffing solution for {city} care homes"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#F97316]"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-300">
                    Email Body Copy *
                  </label>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <span>Tags:</span>
                    <button type="button" onClick={() => setFormBody(b => b + ' {firstName}')} className="px-1 py-0.5 rounded bg-[#0A0A0A] text-[#00C2FF] border border-[#1E3A5F] hover:bg-[#1E3A5F] cursor-pointer">{"{firstName}"}</button>
                    <button type="button" onClick={() => setFormBody(b => b + ' {companyName}')} className="px-1 py-0.5 rounded bg-[#0A0A0A] text-[#00C2FF] border border-[#1E3A5F] hover:bg-[#1E3A5F] cursor-pointer">{"{companyName}"}</button>
                    <button type="button" onClick={() => setFormBody(b => b + ' {city}')} className="px-1 py-0.5 rounded bg-[#0A0A0A] text-[#00C2FF] border border-[#1E3A5F] hover:bg-[#1E3A5F] cursor-pointer">{"{city}"}</button>
                  </div>
                </div>
                <textarea
                  rows={8}
                  required
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Write cold outreach body here..."
                  className="w-full px-3.5 py-2.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs font-mono outline-none focus:border-[#00C2FF] resize-none"
                />
              </div>

              <div className="pt-2 border-t border-[#1E3A5F] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCopyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow-md shadow-[#00C2FF]/20 cursor-pointer"
                >
                  {editingCopyId ? 'Save Changes' : '+ Save Email Copy'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD IMPORTANT NOTE */}
      {/* ========================================================================= */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg my-8 bg-[#111827] border border-[#1E3A5F] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#00E5A0]" />
                Add Important Guideline / Note
              </h3>
              <button
                onClick={() => setNoteModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Gmail Warmup Limits for Brand X"
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00E5A0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Category</label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00E5A0]"
                  >
                    <option value="Strategy">Strategy</option>
                    <option value="Deliverability">Deliverability</option>
                    <option value="Client Nuance">Client Nuance</option>
                    <option value="Mailbox Limits">Mailbox Limits</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={notePinned}
                      onChange={(e) => setNotePinned(e.target.checked)}
                      className="w-4 h-4 rounded text-[#00E5A0] accent-[#00E5A0]"
                    />
                    <span>Pin to top of list</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">Content / Instruction</label>
                <textarea
                  rows={4}
                  required
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add key notes..."
                  className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00E5A0] resize-none"
                />
              </div>

              <div className="pt-2 border-t border-[#1E3A5F] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] text-gray-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00E5A0] hover:bg-[#00E5A0]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow-md shadow-[#00E5A0]/20 cursor-pointer"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
