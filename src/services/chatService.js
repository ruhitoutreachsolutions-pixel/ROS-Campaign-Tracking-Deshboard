// ============================================================================
// ROS REAL-TIME CHAT SERVICE (CHAT V1 - SECURITY REFACTORED)
// Architecture:
// 1. Scoped User-Level Realtime Channels (ros_chat_user_{userId})
// 2. Global Presence Channel (ros_chat_presence_v1)
// 3. Strict Participant-Level Query & Send Validation
// 4. Supabase Storage + Dual-Persistence Fallback
// ============================================================================

import { 
  getSupabaseClient, 
  fetchChatDataFromCloud, 
  saveChatDataToCloud,
  SYSTEM_META_ID,
  CHAT_DATA_ID 
} from './db';

const CHAT_REALTIME_CHANNEL = 'ros_chat_realtime_v2';
const PRESENCE_CHANNEL_NAME = 'ros_chat_presence_v2';
const LOCAL_BROADCAST_NAME = 'ros_chat_local_broadcast_v1';
const STORAGE_KEY_PERMISSIONS = 'ros_chat_permissions_v1';

export function getUserChatChannelName(userId) {
  if (!userId) return 'ros_chat_user_anonymous';
  return `ros_chat_user_${String(userId).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

let activeChatChannel = null;
let activePresenceChannel = null;
let localBroadcast = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localBroadcast = new BroadcastChannel(LOCAL_BROADCAST_NAME);
  }
} catch (e) {
  // BroadcastChannel fallback
}

export function getChatRealtimeChannel() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  if (activeChatChannel) {
    return activeChatChannel;
  }

  try {
    const channel = supabase.channel(CHAT_REALTIME_CHANNEL, {
      config: {
        broadcast: { self: false }
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Chat realtime connected
      }
    });

    activeChatChannel = channel;
    return channel;
  } catch (err) {
    console.warn('Supabase chat realtime channel init notice:', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// 1. REAL-TIME SUBSCRIPTION & BROADCASTING (PERSISTENT SINGLETON CHANNEL)
// ----------------------------------------------------------------------------

export function setupChatRealtime({ currentUserId, userMetadata, onMessage, onMessagesRead, onMessagesDeleted, onPresenceSync }) {
  const supabase = getSupabaseClient();
  if (!supabase || !currentUserId) return () => {};

  const cleanUserId = String(currentUserId);
  const userRole = userMetadata?.role || 'client';

  // 1. Local BroadcastChannel: handles tabs in same browser instance
  const handleLocalMessage = (event) => {
    if (!event?.data) return;
    const { type, payload } = event.data;

    if (type === 'NEW_MESSAGE' && payload) {
      if (String(payload.recipient_id) === cleanUserId || String(payload.sender_id) === cleanUserId || userRole === 'admin') {
        if (onMessage) onMessage(payload);
      }
    }

    if (type === 'MESSAGES_READ' && payload) {
      if (payload.conversationId && (String(payload.readerId) === cleanUserId || String(payload.senderId) === cleanUserId || userRole === 'admin')) {
        if (onMessagesRead) onMessagesRead(payload);
      }
    }

    if (type === 'MESSAGES_DELETED' && payload) {
      if (onMessagesDeleted) onMessagesDeleted(payload);
    }
  };

  if (localBroadcast) {
    localBroadcast.addEventListener('message', handleLocalMessage);
  }

  // 2. Persistent Supabase Realtime Channel
  const chatChannel = getChatRealtimeChannel();
  if (chatChannel) {
    chatChannel.on('broadcast', { event: 'chat_msg' }, ({ payload }) => {
      if (!payload) return;
      if (String(payload.recipient_id) === cleanUserId || String(payload.sender_id) === cleanUserId || userRole === 'admin') {
        if (onMessage) onMessage(payload);
      }
    });

    chatChannel.on('broadcast', { event: 'chat_read' }, ({ payload }) => {
      if (payload && onMessagesRead) {
        if (String(payload.senderId) === cleanUserId || String(payload.readerId) === cleanUserId || userRole === 'admin') {
          onMessagesRead(payload);
        }
      }
    });

    chatChannel.on('broadcast', { event: 'chat_del' }, ({ payload }) => {
      if (payload && onMessagesDeleted) {
        onMessagesDeleted(payload);
      }
    });
  }

  // 3. Presence Channel: Tracks online users with zero DB writes
  if (activePresenceChannel) {
    try { supabase.removeChannel(activePresenceChannel); } catch (e) {}
    activePresenceChannel = null;
  }

  const presenceChannel = supabase.channel(PRESENCE_CHANNEL_NAME, {
    config: {
      presence: { key: cleanUserId }
    }
  });

  presenceChannel.on('presence', { event: 'sync' }, () => {
    try {
      const state = presenceChannel.presenceState();
      if (onPresenceSync) onPresenceSync(state);
    } catch (e) {}
  });

  presenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      try {
        await presenceChannel.track({
          user_id: cleanUserId,
          name: userMetadata?.name || cleanUserId,
          role: userRole,
          online_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Presence track notice:', err);
      }
    }
  });

  activePresenceChannel = presenceChannel;

  // Cleanup function
  return () => {
    if (localBroadcast) {
      localBroadcast.removeEventListener('message', handleLocalMessage);
    }
    if (activePresenceChannel) {
      try { supabase.removeChannel(activePresenceChannel); } catch (e) {}
      activePresenceChannel = null;
    }
  };
}

export async function broadcastChatMessage(message) {
  if (!message || !message.recipient_id) return;

  // 1. Local BroadcastChannel (instant in same browser profile)
  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'NEW_MESSAGE', payload: message });
    }
  } catch (e) {}

  // 2. Persistent Supabase Realtime Channel Broadcast (instant cross-device worldwide)
  try {
    const channel = getChatRealtimeChannel();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'chat_msg',
        payload: message
      }).catch(err => console.warn('Supabase chat message send notice:', err));
    }
  } catch (err) {
    console.warn('Supabase broadcast error:', err);
  }
}

export async function broadcastMessagesRead(conversationId, readerId, senderId) {
  const payload = { conversationId, readerId, senderId, readAt: new Date().toISOString() };

  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'MESSAGES_READ', payload });
    }
  } catch (e) {}

  try {
    const channel = getChatRealtimeChannel();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'chat_read',
        payload
      }).catch(() => {});
    }
  } catch (e) {}
}

export async function broadcastMessagesDeleted(conversationId, messageIds, participantIds = []) {
  if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) return;

  const payload = { conversationId, messageIds, participantIds, deletedAt: new Date().toISOString() };

  // 1. Local BroadcastChannel
  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'MESSAGES_DELETED', payload });
    }
  } catch (e) {}

  // 2. Supabase Realtime Broadcast
  try {
    const channel = getChatRealtimeChannel();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'chat_del',
        payload
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Broadcast messages deleted notice:', err);
  }
}

// ----------------------------------------------------------------------------
// 2. CONVERSATION ID GENERATION
// ----------------------------------------------------------------------------

export function getDirectConversationId(userId1, userId2) {
  const sorted = [String(userId1).trim(), String(userId2).trim()].sort();
  return `dm_${sorted[0]}__${sorted[1]}`;
}

export function parseConversationParticipants(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') return [];
  if (conversationId.startsWith('dm_')) {
    return conversationId.replace(/^dm_/, '').split('__');
  }
  return [];
}

// ----------------------------------------------------------------------------
// 3. PERSISTENCE LAYER (STRICT AUTHORIZATION ON QUERIES)
// ----------------------------------------------------------------------------

export async function fetchConversationsFromCloud(currentUserId) {
  if (!currentUserId) return [];
  const uid = String(currentUserId);

  try {
    const { conversations } = await fetchChatDataFromCloud();
    return (conversations || []).filter(c => {
      if (!c || c.id?.includes(SYSTEM_META_ID)) return false;
      if (uid === 'admin') return true;
      return Array.isArray(c.participant_ids) && c.participant_ids.includes(uid);
    });
  } catch (err) {
    console.warn('fetchConversationsFromCloud error:', err);
    return [];
  }
}

export async function fetchMessagesFromCloud(conversationId, currentUserId) {
  if (!conversationId) return [];

  // Security Check: Validate user is a participant of this conversation
  if (currentUserId && String(currentUserId) !== 'admin') {
    const participants = parseConversationParticipants(conversationId);
    if (participants.length > 0 && !participants.includes(String(currentUserId))) {
      console.warn('Blocked unauthorized message fetch attempt:', { conversationId, currentUserId });
      return [];
    }
  }

  try {
    const { messages } = await fetchChatDataFromCloud();
    const uid = currentUserId ? String(currentUserId) : null;

    return (messages || []).filter(m => {
      if (m.conversation_id !== conversationId) return false;
      if (m.sender_id?.includes(SYSTEM_META_ID) || m.recipient_id?.includes(SYSTEM_META_ID)) return false;
      if (!uid || uid === 'admin') return true;
      return String(m.sender_id) === uid || String(m.recipient_id) === uid;
    });
  } catch (err) {
    console.warn('fetchMessagesFromCloud error:', err);
    return [];
  }
}

export async function saveMessageToCloud(message) {
  if (!message || !message.conversation_id) return false;

  // Never persist system metadata dummy IDs
  if (message.sender_id?.includes(SYSTEM_META_ID) || message.recipient_id?.includes(SYSTEM_META_ID)) {
    return false;
  }

  try {
    const { messages = [], conversations = [] } = await fetchChatDataFromCloud();

    if (!messages.some(m => m.id === message.id)) {
      const nextMsgs = [...messages.slice(-500), message];
      let nextConvs = [...conversations];
      const convIdx = nextConvs.findIndex(c => c.id === message.conversation_id);

      if (convIdx >= 0) {
        nextConvs[convIdx] = {
          ...nextConvs[convIdx],
          updated_at: new Date().toISOString(),
          last_message: message.content
        };
      } else {
        nextConvs.unshift({
          id: message.conversation_id,
          type: 'direct',
          participant_ids: [message.sender_id, message.recipient_id],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message: message.content
        });
      }

      return await saveChatDataToCloud({ messages: nextMsgs, conversations: nextConvs });
    }
    return true;
  } catch (err) {
    console.warn('saveMessageToCloud error:', err);
    return false;
  }
}

export async function markMessagesAsReadInCloud(conversationId, recipientId) {
  if (!conversationId) return false;

  try {
    const { messages = [], conversations = [] } = await fetchChatDataFromCloud();
    const now = new Date().toISOString();
    let changed = false;

    const updatedMsgs = messages.map(m => {
      if (m.conversation_id === conversationId && String(m.recipient_id) === String(recipientId) && m.status !== 'read') {
        changed = true;
        return { ...m, status: 'read', read_at: now };
      }
      return m;
    });

    if (changed) {
      return await saveChatDataToCloud({ messages: updatedMsgs, conversations });
    }
    return true;
  } catch (err) {
    console.warn('markMessagesAsReadInCloud error:', err);
    return false;
  }
}

// Permanently delete chat messages from Supabase (Admin Only)
export async function deleteMessagesFromCloud(messageIds, adminUser) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return false;

  // Security Check: strictly require Admin
  const isAuthorizedAdmin = adminUser && (adminUser.role === 'admin' || adminUser.username === 'admin');
  if (!isAuthorizedAdmin) {
    console.error('Unauthorized message deletion attempt blocked: caller is not Admin');
    return false;
  }

  try {
    const { messages = [], conversations = [] } = await fetchChatDataFromCloud();
    const msgIdSet = new Set(messageIds);
    const filteredMsgs = messages.filter(m => !msgIdSet.has(m.id));

    const updatedConvs = conversations.map(conv => {
      const remainingForConv = filteredMsgs.filter(m => m.conversation_id === conv.id);
      const latest = remainingForConv[remainingForConv.length - 1];
      return {
        ...conv,
        last_message: latest ? latest.content : '',
        updated_at: latest ? latest.created_at : conv.updated_at
      };
    });

    return await saveChatDataToCloud({ messages: filteredMsgs, conversations: updatedConvs });
  } catch (err) {
    console.warn('deleteMessagesFromCloud error:', err);
    return false;
  }
}

// ----------------------------------------------------------------------------
// 4. CHAT PERMISSIONS CONTROL (ADMIN PERMISSION SYSTEM)
// ----------------------------------------------------------------------------

export async function fetchChatPermissionsFromCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    try {
      const s = localStorage.getItem(STORAGE_KEY_PERMISSIONS);
      return s ? JSON.parse(s) : {};
    } catch (e) {
      return {};
    }
  }

  try {
    const { data } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (data?.client_credentials?.chat_permissions) {
      const perms = { ...data.client_credentials.chat_permissions };
      delete perms[SYSTEM_META_ID]; // Never expose system metadata as a permission key
      try { localStorage.setItem(STORAGE_KEY_PERMISSIONS, JSON.stringify(perms)); } catch (e) {}
      return perms;
    }
  } catch (e) {}

  try {
    const s = localStorage.getItem(STORAGE_KEY_PERMISSIONS);
    return s ? JSON.parse(s) : {};
  } catch (e) {
    return {};
  }
}

export async function saveChatPermissionsToCloud(permissionsMap) {
  const supabase = getSupabaseClient();
  const cleanMap = { ...(permissionsMap || {}) };
  delete cleanMap[SYSTEM_META_ID]; // Clean out system metadata ID

  try { localStorage.setItem(STORAGE_KEY_PERMISSIONS, JSON.stringify(cleanMap)); } catch (e) {}

  if (!supabase) return false;

  try {
    const { data } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    const creds = data?.client_credentials || {};
    await supabase
      .from('workspaces')
      .update({
        client_credentials: {
          ...creds,
          chat_permissions: cleanMap
        }
      })
      .eq('id', SYSTEM_META_ID);

    return true;
  } catch (err) {
    console.warn('Save chat permissions notice:', err);
    return false;
  }
}
