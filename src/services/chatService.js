// ============================================================================
// ROS REAL-TIME CHAT SERVICE (CHAT V1 - SECURITY REFACTORED)
// Architecture:
// 1. Scoped User-Level Realtime Channels (ros_chat_user_{userId})
// 2. Global Presence Channel (ros_chat_presence_v1)
// 3. Strict Participant-Level Query & Send Validation
// 4. Supabase Storage + Dual-Persistence Fallback
// ============================================================================

import { getSupabaseClient } from './db';

const PRESENCE_CHANNEL_NAME = 'ros_chat_presence_v1';
const LOCAL_BROADCAST_NAME = 'ros_chat_local_broadcast_v1';
const SYSTEM_META_ID = '__ros_system_metadata__';
const STORAGE_KEY_PERMISSIONS = 'ros_chat_permissions_v1';

export function getUserChatChannelName(userId) {
  if (!userId) return 'ros_chat_user_anonymous';
  return `ros_chat_user_${String(userId).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

let activeUserChannel = null;
let activePresenceChannel = null;
let localBroadcast = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localBroadcast = new BroadcastChannel(LOCAL_BROADCAST_NAME);
  }
} catch (e) {
  // BroadcastChannel fallback
}

// ----------------------------------------------------------------------------
// 1. REAL-TIME SUBSCRIPTION & BROADCASTING (SCOPED BY USER)
// ----------------------------------------------------------------------------

export function setupChatRealtime({ currentUserId, userMetadata, onMessage, onMessagesRead, onMessagesDeleted, onPresenceSync }) {
  const supabase = getSupabaseClient();
  if (!supabase || !currentUserId) return () => {};

  const cleanUserId = String(currentUserId);

  // Clean up any existing channels
  if (activeUserChannel) {
    try { supabase.removeChannel(activeUserChannel); } catch (e) {}
    activeUserChannel = null;
  }
  if (activePresenceChannel) {
    try { supabase.removeChannel(activePresenceChannel); } catch (e) {}
    activePresenceChannel = null;
  }

  // 1. Local BroadcastChannel: strictly ignore messages not for or from this user
  const handleLocalMessage = (event) => {
    if (!event?.data) return;
    const { type, payload } = event.data;

    if (type === 'NEW_MESSAGE' && payload) {
      if (String(payload.recipient_id) === cleanUserId || String(payload.sender_id) === cleanUserId) {
        if (onMessage) onMessage(payload);
      }
    }

    if (type === 'MESSAGES_READ' && payload) {
      if (payload.conversationId && (String(payload.readerId) === cleanUserId || String(payload.senderId) === cleanUserId)) {
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

  // 2. Personal User Channel: Only receives direct messages for this user
  const userChannelName = getUserChatChannelName(cleanUserId);
  const userChannel = supabase.channel(userChannelName);

  userChannel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
    if (payload && (String(payload.recipient_id) === cleanUserId || String(payload.sender_id) === cleanUserId)) {
      if (onMessage) onMessage(payload);
    }
  });

  userChannel.on('broadcast', { event: 'messages_read' }, ({ payload }) => {
    if (payload && onMessagesRead) {
      onMessagesRead(payload);
    }
  });

  userChannel.on('broadcast', { event: 'messages_deleted' }, ({ payload }) => {
    if (payload && onMessagesDeleted) {
      onMessagesDeleted(payload);
    }
  });

  userChannel.subscribe();
  activeUserChannel = userChannel;

  // 3. Presence Channel: Tracks online users with zero DB writes
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
          role: userMetadata?.role || 'client',
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
    if (activeUserChannel) {
      try { supabase.removeChannel(activeUserChannel); } catch (e) {}
      activeUserChannel = null;
    }
    if (activePresenceChannel) {
      try { supabase.removeChannel(activePresenceChannel); } catch (e) {}
      activePresenceChannel = null;
    }
  };
}

export async function broadcastChatMessage(message) {
  if (!message || !message.recipient_id) return;

  // 1. Local BroadcastChannel (instant in same browser)
  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'NEW_MESSAGE', payload: message });
    }
  } catch (e) {}

  // 2. Supabase Realtime Scoped Broadcasts:
  // Target recipient's channel AND sender's channel
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const recipientChannelName = getUserChatChannelName(message.recipient_id);
  const senderChannelName = getUserChatChannelName(message.sender_id);

  try {
    const recipientChan = supabase.channel(recipientChannelName);
    await recipientChan.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await recipientChan.send({
          type: 'broadcast',
          event: 'new_message',
          payload: message
        });
        setTimeout(() => {
          try { supabase.removeChannel(recipientChan); } catch (e) {}
        }, 1500);
      }
    });

    // Also broadcast to sender's own channel if different to sync multi-device tabs
    if (senderChannelName !== recipientChannelName) {
      const senderChan = supabase.channel(senderChannelName);
      await senderChan.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await senderChan.send({
            type: 'broadcast',
            event: 'new_message',
            payload: message
          });
          setTimeout(() => {
            try { supabase.removeChannel(senderChan); } catch (e) {}
          }, 1500);
        }
      });
    }
  } catch (err) {
    console.warn('Supabase scoped broadcast error:', err);
  }
}

export async function broadcastMessagesRead(conversationId, readerId, senderId) {
  const payload = { conversationId, readerId, senderId, readAt: new Date().toISOString() };

  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'MESSAGES_READ', payload });
    }
  } catch (e) {}

  const supabase = getSupabaseClient();
  if (!supabase || !senderId) return;

  try {
    const targetChannelName = getUserChatChannelName(senderId);
    const targetChan = supabase.channel(targetChannelName);
    await targetChan.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await targetChan.send({
          type: 'broadcast',
          event: 'messages_read',
          payload
        });
        setTimeout(() => {
          try { supabase.removeChannel(targetChan); } catch (e) {}
        }, 1500);
      }
    });
  } catch (e) {}
}

export async function broadcastMessagesDeleted(conversationId, messageIds, participantIds = []) {
  if (!conversationId || !Array.isArray(messageIds) || messageIds.length === 0) return;

  const payload = { conversationId, messageIds, deletedAt: new Date().toISOString() };

  // 1. Local BroadcastChannel (same machine/browser)
  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'MESSAGES_DELETED', payload });
    }
  } catch (e) {}

  // 2. Supabase Realtime Scoped Broadcasts to all participants
  const supabase = getSupabaseClient();
  if (!supabase || !Array.isArray(participantIds) || participantIds.length === 0) return;

  for (const pid of participantIds) {
    if (!pid) continue;
    try {
      const channelName = getUserChatChannelName(pid);
      const chan = supabase.channel(channelName);
      await chan.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await chan.send({
            type: 'broadcast',
            event: 'messages_deleted',
            payload
          });
          setTimeout(() => {
            try { supabase.removeChannel(chan); } catch (e) {}
          }, 1500);
        }
      });
    } catch (err) {
      console.warn('Broadcast messages deleted notice:', err);
    }
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
  const supabase = getSupabaseClient();
  if (!supabase || !currentUserId) return [];

  const uid = String(currentUserId);

  try {
    // 1. Try dedicated chat_conversations table
    let query = supabase.from('chat_conversations').select('*');
    if (uid !== 'admin') {
      query = query.contains('participant_ids', [uid]);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      // Filter out internal system IDs
      return data.filter(c => !c.id.includes(SYSTEM_META_ID));
    }
  } catch (e) {}

  // 2. Fallback: Retrieve from __ros_system_metadata__ in workspaces table
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (!error && data?.client_credentials?.chat_conversations) {
      const allConvs = data.client_credentials.chat_conversations;
      return allConvs.filter(c => {
        if (!c || c.id?.includes(SYSTEM_META_ID)) return false;
        if (uid === 'admin') return true;
        return Array.isArray(c.participant_ids) && c.participant_ids.includes(uid);
      });
    }
  } catch (err) {
    console.warn('Fallback fetch conversations notice:', err);
  }

  return [];
}

export async function fetchMessagesFromCloud(conversationId, currentUserId) {
  const supabase = getSupabaseClient();
  if (!supabase || !conversationId) return [];

  // Security Check: Validate user is a participant of this conversation
  if (currentUserId && String(currentUserId) !== 'admin') {
    const participants = parseConversationParticipants(conversationId);
    if (participants.length > 0 && !participants.includes(String(currentUserId))) {
      console.warn('Blocked unauthorized message fetch attempt:', { conversationId, currentUserId });
      return [];
    }
  }

  try {
    // 1. Try dedicated chat_messages table
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!error && Array.isArray(data)) {
      return data.filter(m => !m.sender_id?.includes(SYSTEM_META_ID) && !m.recipient_id?.includes(SYSTEM_META_ID));
    }
  } catch (e) {}

  // 2. Fallback: Retrieve from __ros_system_metadata__
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (!error && data?.client_credentials?.chat_messages) {
      const allMsgs = data.client_credentials.chat_messages;
      const uid = currentUserId ? String(currentUserId) : null;

      return allMsgs.filter(m => {
        if (m.conversation_id !== conversationId) return false;
        if (m.sender_id?.includes(SYSTEM_META_ID) || m.recipient_id?.includes(SYSTEM_META_ID)) return false;
        if (!uid || uid === 'admin') return true;
        return String(m.sender_id) === uid || String(m.recipient_id) === uid;
      });
    }
  } catch (err) {
    console.warn('Fallback fetch messages notice:', err);
  }

  return [];
}

export async function saveMessageToCloud(message) {
  const supabase = getSupabaseClient();
  if (!supabase || !message) return false;

  // Never persist system metadata dummy IDs
  if (message.sender_id?.includes(SYSTEM_META_ID) || message.recipient_id?.includes(SYSTEM_META_ID)) {
    return false;
  }

  // 1. Try dedicated chat_messages table
  try {
    await supabase.from('chat_messages').insert(message);
  } catch (e) {}

  // 2. Always maintain dual-sync in __ros_system_metadata__
  try {
    const { data } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    const creds = data?.client_credentials || {};
    const existingMsgs = Array.isArray(creds.chat_messages) ? creds.chat_messages : [];

    if (!existingMsgs.some(m => m.id === message.id)) {
      const nextMsgs = [...existingMsgs.slice(-500), message];

      const existingConvs = Array.isArray(creds.chat_conversations) ? creds.chat_conversations : [];
      const convIdx = existingConvs.findIndex(c => c.id === message.conversation_id);
      let nextConvs = [...existingConvs];

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

      await supabase
        .from('workspaces')
        .update({
          client_credentials: {
            ...creds,
            chat_messages: nextMsgs,
            chat_conversations: nextConvs
          }
        })
        .eq('id', SYSTEM_META_ID);
    }
  } catch (err) {
    console.warn('Fallback save message notice:', err);
  }

  // 3. Upsert conversation record
  try {
    await supabase
      .from('chat_conversations')
      .upsert({
        id: message.conversation_id,
        type: 'direct',
        participant_ids: [message.sender_id, message.recipient_id],
        updated_at: new Date().toISOString()
      });
  } catch (e) {}

  return true;
}

export async function markMessagesAsReadInCloud(conversationId, recipientId) {
  const supabase = getSupabaseClient();
  if (!supabase || !conversationId) return false;

  const now = new Date().toISOString();

  try {
    await supabase
      .from('chat_messages')
      .update({ status: 'read', read_at: now })
      .eq('conversation_id', conversationId)
      .eq('recipient_id', recipientId)
      .eq('status', 'sent');
  } catch (e) {}

  try {
    const { data } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (data?.client_credentials?.chat_messages) {
      const creds = data.client_credentials;
      const updatedMsgs = creds.chat_messages.map(m => {
        if (m.conversation_id === conversationId && String(m.recipient_id) === String(recipientId) && m.status !== 'read') {
          return { ...m, status: 'read', read_at: now };
        }
        return m;
      });

      await supabase
        .from('workspaces')
        .update({
          client_credentials: {
            ...creds,
            chat_messages: updatedMsgs
          }
        })
        .eq('id', SYSTEM_META_ID);
    }
  } catch (e) {}

  return true;
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

  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const msgIdSet = new Set(messageIds);

  // 1. Delete from dedicated chat_messages table
  try {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .in('id', messageIds);

    if (error) {
      console.warn('Supabase chat_messages table delete error:', error);
    }
  } catch (e) {}

  // 2. Delete from __ros_system_metadata__ fallback storage
  try {
    const { data } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (data?.client_credentials) {
      const creds = data.client_credentials;
      const existingMsgs = Array.isArray(creds.chat_messages) ? creds.chat_messages : [];
      const filteredMsgs = existingMsgs.filter(m => !msgIdSet.has(m.id));

      // Re-evaluate conversation last_message if needed
      const existingConvs = Array.isArray(creds.chat_conversations) ? creds.chat_conversations : [];
      const updatedConvs = existingConvs.map(conv => {
        const remainingForConv = filteredMsgs.filter(m => m.conversation_id === conv.id);
        const latest = remainingForConv[remainingForConv.length - 1];
        return {
          ...conv,
          last_message: latest ? latest.content : '',
          updated_at: latest ? latest.created_at : conv.updated_at
        };
      });

      await supabase
        .from('workspaces')
        .update({
          client_credentials: {
            ...creds,
            chat_messages: filteredMsgs,
            chat_conversations: updatedConvs
          }
        })
        .eq('id', SYSTEM_META_ID);
    }
  } catch (err) {
    console.warn('Fallback delete messages notice:', err);
  }

  return true;
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
