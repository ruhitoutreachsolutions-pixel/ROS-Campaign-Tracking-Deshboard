// ============================================================================
// ROS REAL-TIME CHAT SERVICE (CHAT V1)
// Architecture:
// 1. Direct Supabase Storage (chat_conversations, chat_messages)
// 2. Dual-Persistence Fallback (via workspaces table __ros_system_metadata__)
// 3. Ultra-Low-Latency Real-Time Delivery (Supabase Broadcast + BroadcastChannel)
// 4. Zero-Write Live Presence (Supabase Realtime Presence state)
// ============================================================================

import { getSupabaseClient } from './db';

const CHAT_CHANNEL_NAME = 'ros_portal_chat_v1';
const LOCAL_BROADCAST_NAME = 'ros_chat_local_broadcast_v1';
const SYSTEM_META_ID = '__ros_system_metadata__';
const STORAGE_KEY_PERMISSIONS = 'ros_chat_permissions_v1';

let activeChannel = null;
let localBroadcast = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localBroadcast = new BroadcastChannel(LOCAL_BROADCAST_NAME);
  }
} catch (e) {
  // BroadcastChannel fallback
}

// ----------------------------------------------------------------------------
// 1. REAL-TIME SUBSCRIPTION & BROADCASTING
// ----------------------------------------------------------------------------

export function setupChatRealtime({ currentUserId, userMetadata, onMessage, onMessagesRead, onPresenceSync }) {
  const supabase = getSupabaseClient();
  if (!supabase || !currentUserId) return () => {};

  // Clean up previous channel if exists
  if (activeChannel) {
    try { supabase.removeChannel(activeChannel); } catch (e) {}
  }

  // 1. Listen on local BroadcastChannel for 0ms cross-tab events
  const handleLocalMessage = (event) => {
    if (!event?.data) return;
    const { type, payload } = event.data;
    if (type === 'NEW_MESSAGE' && onMessage) onMessage(payload);
    if (type === 'MESSAGES_READ' && onMessagesRead) onMessagesRead(payload);
  };

  if (localBroadcast) {
    localBroadcast.addEventListener('message', handleLocalMessage);
  }

  // 2. Setup Supabase Realtime Channel (Broadcast + Presence across all devices)
  const channel = supabase.channel(CHAT_CHANNEL_NAME, {
    config: {
      presence: { key: currentUserId }
    }
  });

  // Handle incoming broadcast messages
  channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
    if (payload && onMessage) {
      onMessage(payload);
    }
  });

  // Handle messages read status broadcast
  channel.on('broadcast', { event: 'messages_read' }, ({ payload }) => {
    if (payload && onMessagesRead) {
      onMessagesRead(payload);
    }
  });

  // Handle live presence updates
  channel.on('presence', { event: 'sync' }, () => {
    try {
      const state = channel.presenceState();
      if (onPresenceSync) onPresenceSync(state);
    } catch (e) {}
  });

  // Subscribe and track current user presence
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      try {
        await channel.track({
          user_id: currentUserId,
          name: userMetadata?.name || currentUserId,
          role: userMetadata?.role || 'warrior',
          online_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Presence track notice:', err);
      }
    }
  });

  activeChannel = channel;

  // Return unsubscribe cleanup function
  return () => {
    if (localBroadcast) {
      localBroadcast.removeEventListener('message', handleLocalMessage);
    }
    if (activeChannel) {
      try {
        supabase.removeChannel(activeChannel);
      } catch (e) {}
      activeChannel = null;
    }
  };
}

export async function broadcastChatMessage(message) {
  if (!message) return;

  // 1. Local BroadcastChannel (0ms in-browser)
  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'NEW_MESSAGE', payload: message });
    }
  } catch (e) {}

  // 2. Supabase Realtime Cloud Broadcast (<100ms multi-device)
  if (activeChannel) {
    try {
      await activeChannel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: message
      });
    } catch (e) {
      console.warn('Supabase message broadcast notice:', e);
    }
  }
}

export async function broadcastMessagesRead(conversationId, readerId) {
  const payload = { conversationId, readerId, readAt: new Date().toISOString() };

  try {
    if (localBroadcast) {
      localBroadcast.postMessage({ type: 'MESSAGES_READ', payload });
    }
  } catch (e) {}

  if (activeChannel) {
    try {
      await activeChannel.send({
        type: 'broadcast',
        event: 'messages_read',
        payload
      });
    } catch (e) {}
  }
}

// ----------------------------------------------------------------------------
// 2. CONVERSATION ID GENERATION
// ----------------------------------------------------------------------------

export function getDirectConversationId(userId1, userId2) {
  // Canonical deterministic ID regardless of who initiates
  const sorted = [String(userId1), String(userId2)].sort();
  return `dm_${sorted[0]}__${sorted[1]}`;
}

// ----------------------------------------------------------------------------
// 3. PERSISTENCE LAYER (SUPABASE + DUAL-PERSISTENCE FALLBACK)
// ----------------------------------------------------------------------------

export async function fetchConversationsFromCloud(currentUserId) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    // 1. Try dedicated chat_conversations table
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .contains('participant_ids', [currentUserId])
      .order('updated_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (e) {
    // Table not created yet; fall through to system metadata fallback
  }

  // 2. Fallback: Retrieve from __ros_system_metadata__ in workspaces table
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (!error && data?.client_credentials?.chat_conversations) {
      const allConvs = data.client_credentials.chat_conversations;
      return allConvs.filter(c => Array.isArray(c.participant_ids) && c.participant_ids.includes(currentUserId));
    }
  } catch (err) {
    console.warn('Fallback fetch conversations notice:', err);
  }

  return [];
}

export async function fetchMessagesFromCloud(conversationId) {
  const supabase = getSupabaseClient();
  if (!supabase || !conversationId) return [];

  try {
    // 1. Try dedicated chat_messages table
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (e) {
    // Table not created yet
  }

  // 2. Fallback: Retrieve from __ros_system_metadata__
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (!error && data?.client_credentials?.chat_messages) {
      const allMsgs = data.client_credentials.chat_messages;
      return allMsgs.filter(m => m.conversation_id === conversationId);
    }
  } catch (err) {
    console.warn('Fallback fetch messages notice:', err);
  }

  return [];
}

export async function saveMessageToCloud(message) {
  const supabase = getSupabaseClient();
  if (!supabase || !message) return false;

  let savedDedicated = false;

  // 1. Try dedicated chat_messages table
  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert(message);

    if (!error) savedDedicated = true;
  } catch (e) {}

  // 2. Always maintain dual-sync in __ros_system_metadata__ to guarantee data integrity
  try {
    const { data } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    const creds = data?.client_credentials || {};
    const existingMsgs = Array.isArray(creds.chat_messages) ? creds.chat_messages : [];
    
    // Add message if not duplicate
    if (!existingMsgs.some(m => m.id === message.id)) {
      const nextMsgs = [...existingMsgs.slice(-500), message]; // Keep last 500 in fallback
      
      // Also update conversation updated_at in fallback
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

  // Also update dedicated chat_conversations table if present
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

  // 1. Try dedicated table
  try {
    await supabase
      .from('chat_messages')
      .update({ status: 'read', read_at: now })
      .eq('conversation_id', conversationId)
      .eq('recipient_id', recipientId)
      .eq('status', 'sent');
  } catch (e) {}

  // 2. Update in fallback system metadata
  try {
    const { data } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (data?.client_credentials?.chat_messages) {
      const creds = data.client_credentials;
      const updatedMsgs = creds.chat_messages.map(m => {
        if (m.conversation_id === conversationId && m.recipient_id === recipientId && m.status !== 'read') {
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
      const perms = data.client_credentials.chat_permissions;
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
  try { localStorage.setItem(STORAGE_KEY_PERMISSIONS, JSON.stringify(permissionsMap)); } catch (e) {}

  if (!supabase || !permissionsMap) return false;

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
          chat_permissions: permissionsMap
        }
      })
      .eq('id', SYSTEM_META_ID);

    return true;
  } catch (err) {
    console.warn('Save chat permissions notice:', err);
    return false;
  }
}
