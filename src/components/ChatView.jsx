import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  MessageSquare, 
  Send, 
  User, 
  Search, 
  Check, 
  CheckCheck, 
  Clock, 
  Shield, 
  Settings, 
  X, 
  ArrowLeft, 
  Building2, 
  Circle,
  Lock,
  Sparkles,
  Users
} from 'lucide-react';
import { getDirectConversationId } from '../services/chatService';

export default function ChatView() {
  const {
    currentUser,
    currentUserId,
    effectiveUser,
    effectiveUserId,
    chatMessages,
    activeChatContactId,
    setActiveChatContactId,
    openChatWithContact,
    chatOnlineUsers,
    chatPermissions,
    unreadCountByContact,
    allowedChatContacts,
    allWarriorsForPermissions,
    allWorkspacesForPermissions,
    sendChatMessage,
    markConversationAsRead,
    canUserAccessChat,
    updateChatAccess,
    effectiveRole
  } = useWorkspace();

  const isAdmin = effectiveRole === 'admin';
  const hasAccess = canUserAccessChat(effectiveUser);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccessModal, setShowAccessModal] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-select first contact if none selected and on desktop
  useEffect(() => {
    if (!activeChatContactId && allowedChatContacts.length > 0 && window.innerWidth >= 768) {
      openChatWithContact(allowedChatContacts[0].id);
    }
  }, [allowedChatContacts, activeChatContactId]);

  // Active contact object
  const activeContact = useMemo(() => {
    return allowedChatContacts.find(c => c.id === activeChatContactId) || null;
  }, [allowedChatContacts, activeChatContactId]);

  // Current conversation ID (derived strictly from effectiveUserId)
  const activeConversationId = useMemo(() => {
    if (!effectiveUserId || !activeChatContactId) return null;
    return getDirectConversationId(effectiveUserId, activeChatContactId);
  }, [effectiveUserId, activeChatContactId]);

  // Messages in active conversation
  const currentMessages = useMemo(() => {
    if (!activeConversationId) return [];
    return (chatMessages || []).filter(m => m.conversation_id === activeConversationId);
  }, [chatMessages, activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // Auto-mark conversation read when opening
  useEffect(() => {
    if (activeChatContactId) {
      markConversationAsRead(activeChatContactId);
    }
  }, [activeChatContactId]);

  // Filter contacts by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return allowedChatContacts;
    const q = searchQuery.toLowerCase();
    return allowedChatContacts.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.username || '').toLowerCase().includes(q) ||
      (c.badge || '').toLowerCase().includes(q)
    );
  }, [allowedChatContacts, searchQuery]);

  // Send message handler
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText || isSending || !activeChatContactId) return;

    setIsSending(true);
    try {
      await sendChatMessage(activeChatContactId, cleanText);
      setInputText('');
      inputRef.current?.focus();
    } catch (err) {
      console.warn('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Check if contact is online
  const isContactOnline = (contactId) => {
    return chatOnlineUsers.has(String(contactId));
  };

  if (!hasAccess) {
    return (
      <div className="w-full h-[calc(100vh-14rem)] min-h-[500px] max-h-[850px] bg-[#111827] rounded-3xl border border-[#1E3A5F] shadow-2xl flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white">Chat Access Restricted</h3>
        <p className="text-xs text-gray-400 max-w-md">
          Direct chat messaging is currently turned off for this workspace or account. Contact your ROS agency administrator to activate Chat access.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-14rem)] min-h-[500px] max-h-[850px] bg-[#111827] rounded-3xl border border-[#1E3A5F] shadow-2xl overflow-hidden flex flex-col md:flex-row relative selection:bg-[#00C2FF] selection:text-[#0A0A0A]">
      
      {/* ===================================================================== */}
      {/* 1. LEFT SIDEBAR: CONTACTS LIST */}
      {/* ===================================================================== */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-[#1E3A5F] bg-[#0A0A0A]/95 h-full ${
        activeChatContactId ? 'hidden md:flex' : 'flex'
      }`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#1E3A5F] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                ROS Direct Chat
                <span className="text-[10px] px-2 py-0.2 bg-[#00E5A0]/15 text-[#00E5A0] rounded-full border border-[#00E5A0]/30 font-mono">
                  v1.0
                </span>
              </h2>
              <span className="text-[11px] text-gray-400">
                {chatOnlineUsers.size} member{chatOnlineUsers.size === 1 ? '' : 's'} online
              </span>
            </div>
          </div>

          {/* Admin Chat Access Settings Button */}
          {isAdmin && (
            <button
              onClick={() => setShowAccessModal(true)}
              className="p-2 rounded-xl bg-[#111827] hover:bg-[#1E3A5F] text-gray-300 hover:text-[#00C2FF] border border-[#1E3A5F] transition"
              title="Manage Chat Permissions for Warriors & Clients"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Contacts Search Bar */}
        <div className="p-3 border-b border-[#1E3A5F]/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team & clients..."
              className="w-full pl-9 pr-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-xl text-xs text-white placeholder:text-gray-500 outline-none transition"
            />
          </div>
        </div>

        {/* Contacts Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1E3A5F]/30 no-scrollbar">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              <Users className="w-8 h-8 mx-auto mb-2 text-[#1E3A5F]" />
              No authorized contacts found.
            </div>
          ) : (
            filteredContacts.map(contact => {
              const isSelected = contact.id === activeChatContactId;
              const online = isContactOnline(contact.id);
              const unread = unreadCountByContact[contact.id] || 0;

              // Get last message in conversation
              const convId = getDirectConversationId(currentUserId, contact.id);
              const lastMsg = (chatMessages || [])
                .filter(m => m.conversation_id === convId)
                .slice(-1)[0];

              return (
                <button
                  key={contact.id}
                  onClick={() => openChatWithContact(contact.id)}
                  className={`w-full p-3.5 flex items-start gap-3 text-left transition cursor-pointer ${
                    isSelected 
                      ? 'bg-[#111827] border-l-4 border-l-[#00C2FF]' 
                      : 'hover:bg-[#111827]/50 border-l-4 border-l-transparent'
                  }`}
                >
                  {/* Avatar + Status Indicator */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-10 h-10 rounded-xl bg-[#1E3A5F]/50 border border-[#1E3A5F] flex items-center justify-center text-white font-bold text-xs uppercase font-mono">
                      {contact.name?.substring(0, 2) || 'RO'}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0A0A0A] ${
                      online ? 'bg-[#00E5A0]' : 'bg-gray-600'
                    }`} />
                  </div>

                  {/* Name, Role & Last Message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                        {contact.name}
                      </h4>
                      {lastMsg && (
                        <span className="text-[10px] text-gray-500 font-mono shrink-0">
                          {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        contact.role === 'admin' 
                          ? 'bg-[#00C2FF]/15 text-[#00C2FF]' 
                          : contact.role === 'warrior' 
                            ? 'bg-sky-500/15 text-sky-300' 
                            : 'bg-[#00E5A0]/15 text-[#00E5A0]'
                      }`}>
                        {contact.badge}
                      </span>
                      {online && (
                        <span className="text-[9px] text-[#00E5A0] font-medium">Online</span>
                      )}
                    </div>

                    {/* Snippet / Unread Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-gray-400 truncate">
                        {lastMsg ? lastMsg.content : 'No messages yet'}
                      </p>
                      {unread > 0 && (
                        <span className="shrink-0 px-2 py-0.5 bg-[#00C2FF] text-[#0A0A0A] font-black text-[10px] rounded-full animate-pulse shadow-sm">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 2. RIGHT MAIN PANEL: CONVERSATION STREAM & INPUT */}
      {/* ===================================================================== */}
      <div className={`flex-1 flex flex-col bg-[#111827] h-full ${
        !activeChatContactId ? 'hidden md:flex' : 'flex'
      }`}>
        
        {activeContact ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 bg-[#0A0A0A]/90 border-b border-[#1E3A5F] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setActiveChatContactId(null)}
                  className="md:hidden p-1.5 rounded-lg bg-[#111827] text-gray-400 hover:text-white border border-[#1E3A5F]"
                  title="Back to Contact List"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                {/* Contact Avatar */}
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-[#00C2FF]/10 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF] font-bold text-xs uppercase font-mono">
                    {activeContact.name?.substring(0, 2) || 'RO'}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0A0A0A] ${
                    isContactOnline(activeContact.id) ? 'bg-[#00E5A0]' : 'bg-gray-600'
                  }`} />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {activeContact.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.2 rounded bg-[#111827] text-[#00C2FF] border border-[#1E3A5F] font-semibold">
                      {activeContact.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Circle className={`w-2 h-2 fill-current ${
                        isContactOnline(activeContact.id) ? 'text-[#00E5A0]' : 'text-gray-500'
                      }`} />
                      {isContactOnline(activeContact.id) ? 'Online Now' : 'Offline'}
                    </span>
                    {activeContact.workspaceId && (
                      <span className="hidden sm:inline text-gray-500">· Workspace: {activeContact.workspaceId}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0A0A0A] border border-[#1E3A5F] text-[11px] text-gray-400">
                <Lock className="w-3 h-3 text-[#00E5A0]" />
                <span>Authorized Direct Line</span>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#0A0A0A]/40">
              {currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                  <div className="p-4 rounded-2xl bg-[#111827] border border-[#1E3A5F] mb-3 cyan-glow">
                    <MessageSquare className="w-8 h-8 text-[#00C2FF]" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Direct Conversation with {activeContact.name}</h4>
                  <p className="text-xs text-gray-400 max-w-sm mt-1">
                    Messages are delivered in real time across all devices and safely persisted in Supabase.
                  </p>
                </div>
              ) : (
                currentMessages.map((msg, idx) => {
                  const isMe = String(msg.sender_id) === currentUserId;
                  const isRead = msg.status === 'read';
                  const formattedTime = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-full`}
                    >
                      {/* Sender Name if Other */}
                      {!isMe && (
                        <span className="text-[11px] font-semibold text-gray-400 mb-1 ml-1 flex items-center gap-1.5">
                          {msg.sender_name}
                          <span className="text-[9px] px-1.5 py-0.2 bg-[#1E3A5F]/40 text-gray-300 rounded font-mono uppercase">
                            {msg.sender_role}
                          </span>
                        </span>
                      )}

                      {/* Bubble */}
                      <div
                        className={`px-4 py-2.5 rounded-2xl max-w-[85%] sm:max-w-[70%] break-words text-sm shadow-md leading-relaxed ${
                          isMe
                            ? 'bg-gradient-to-r from-[#00C2FF]/20 to-[#00C2FF]/30 border border-[#00C2FF]/40 text-white rounded-tr-sm'
                            : 'bg-[#111827] border border-[#1E3A5F] text-gray-200 rounded-tl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Timestamp & Read Receipt */}
                      <div className={`flex items-center gap-1 mt-1 text-[10px] text-gray-500 font-mono ${
                        isMe ? 'mr-1' : 'ml-1'
                      }`}>
                        <span>{formattedTime}</span>
                        {isMe && (
                          <span title={isRead ? 'Read' : 'Sent'}>
                            {isRead ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#00E5A0]" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <div className="p-3 sm:p-4 bg-[#0A0A0A] border-t border-[#1E3A5F]">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeContact.name}... (Press Enter to send)`}
                  disabled={isSending}
                  className="flex-1 px-4 py-3 bg-[#111827] border border-[#1E3A5F] focus:border-[#00C2FF] rounded-2xl text-sm text-white placeholder:text-gray-500 outline-none transition"
                  autoComplete="off"
                />
                
                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="px-5 py-3 bg-[#00C2FF] hover:bg-[#00C2FF]/80 disabled:opacity-40 text-[#0A0A0A] rounded-2xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-[#00C2FF]/20 cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
              <div className="text-[10px] text-gray-500 mt-1.5 ml-2 font-mono flex items-center justify-between">
                <span>Shift + Enter for new line · Real-time encrypted channel</span>
                <span className="text-[#00E5A0]">⚡ Supabase Realtime Active</span>
              </div>
            </div>
          </>
        ) : (
          /* Empty State when no conversation selected */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <div className="p-5 rounded-3xl bg-[#0A0A0A] border border-[#1E3A5F] mb-4 cyan-glow">
              <MessageSquare className="w-10 h-10 text-[#00C2FF]" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Select a Team Member or Client</h3>
            <p className="text-xs text-gray-400 max-w-sm mt-1.5">
              Choose a contact from the left direct message list to start communicating in real time.
            </p>
          </div>
        )}

      </div>

      {/* ===================================================================== */}
      {/* 3. ADMIN MODAL: MANAGE CHAT PERMISSIONS */}
      {/* ===================================================================== */}
      {isAdmin && showAccessModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            
            <div className="flex items-center justify-between pb-4 border-b border-[#1E3A5F]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/30 flex items-center justify-center text-[#00C2FF]">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Chat Access Permissions</h3>
                  <p className="text-xs text-gray-400">Control who can use Chat across the ROS platform</p>
                </div>
              </div>
              <button
                onClick={() => setShowAccessModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#0A0A0A] transition text-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              
              {/* Admin Always Enabled Notice */}
              <div className="p-3 bg-[#0A0A0A] border border-[#1E3A5F] rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Ruhit (Agency Founder / Admin)</div>
                  <div className="text-[10px] text-[#00C2FF]">Platform Administrator</div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 bg-[#00E5A0]/15 text-[#00E5A0] rounded-full border border-[#00E5A0]/30 font-mono">
                  ✓ Always Enabled
                </span>
              </div>

              {/* Warriors Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00C2FF] mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  ROS Warriors (Campaign Managers)
                </h4>
                <div className="space-y-2">
                  {(allWarriorsForPermissions || []).length === 0 ? (
                    <div className="text-xs text-gray-500 py-2">No warriors configured.</div>
                  ) : (
                    (allWarriorsForPermissions || []).map(w => {
                      const wId = String(w.id || w.username);
                      const isEnabled = chatPermissions[wId] !== undefined ? Boolean(chatPermissions[wId]) : true;

                      return (
                        <div key={wId} className="p-3 bg-[#0A0A0A] border border-[#1E3A5F] rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-white">{w.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">@{w.username}</div>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => updateChatAccess(wId, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00E5A0]"></div>
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Clients Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#00E5A0] mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Client Workspaces
                </h4>
                <div className="space-y-2">
                  {(allWorkspacesForPermissions || []).length === 0 ? (
                    <div className="text-xs text-gray-500 py-2">No client workspaces configured.</div>
                  ) : (
                    (allWorkspacesForPermissions || []).map(cl => {
                      const cId = String(cl.id);
                      const isEnabled = Boolean(chatPermissions[cId]);

                      return (
                        <div key={cId} className="p-3 bg-[#0A0A0A] border border-[#1E3A5F] rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-white">{cl.clientName || cl.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">Workspace ID: {cId}</div>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => updateChatAccess(cId, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00E5A0]"></div>
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            <div className="mt-6 pt-4 border-t border-[#1E3A5F] flex justify-end">
              <button
                onClick={() => setShowAccessModal(false)}
                className="px-5 py-2 bg-[#00C2FF] hover:bg-[#00C2FF]/80 text-[#0A0A0A] font-bold rounded-xl text-xs transition"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
