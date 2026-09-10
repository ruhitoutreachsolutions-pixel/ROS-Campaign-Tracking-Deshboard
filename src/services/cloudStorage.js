// ============================================================================
// UNIVERSAL REAL-TIME SYNC & NOTIFICATION ENGINE (V2 - SUPABASE REALTIME BACKBONE)
// Primary Tier: Supabase Realtime WebSocket Channels (0ms - 50ms worldwide across all devices)
// Fast-Path Tier: Browser BroadcastChannel (0ms same-machine tabs & incognito windows)
// Local Dev Tier: /api/sync fallback (safe no-op if unavailable)
// ============================================================================

import { 
  getSupabaseClient, 
  fetchSystemMetaFromSupabase, 
  saveSystemMetaToSupabase,
  fetchFormSubmissionsFromCloud,
  saveFormSubmissionsToCloud 
} from './db';

const GLOBAL_REALTIME_CHANNEL = 'ros_global_realtime_v2';
const BROADCAST_CHANNEL_NAME = 'ros_realtime_broadcast_v1';

let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  // BroadcastChannel fallback
}

let activeGlobalChannel = null;

export function getGlobalRealtimeChannel() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  if (activeGlobalChannel) {
    return activeGlobalChannel;
  }

  try {
    const channel = supabase.channel(GLOBAL_REALTIME_CHANNEL, {
      config: {
        broadcast: { self: false }
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Channel connected
      }
    });

    activeGlobalChannel = channel;
    return channel;
  } catch (err) {
    console.warn('Supabase global realtime channel init notice:', err);
    return null;
  }
}

// 1. Broadcast an instant real-time event across all channels
export async function broadcastRealtimeEvent(typeOrData, payload = {}) {
  let eventData = typeOrData;
  if (typeof typeOrData === 'string') {
    eventData = { type: typeOrData, ...(typeof payload === 'object' && payload !== null ? payload : {}) };
  }
  if (!eventData || typeof eventData !== 'object') return false;

  const eventPayload = {
    ...eventData,
    _eventId: eventData._eventId || ('evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
    _timestamp: eventData._timestamp || new Date().toISOString()
  };

  // Lane A: BroadcastChannel (0ms, local browser tabs & windows on same machine)
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage(eventPayload);
    }
  } catch (e) {}

  // Lane B: Supabase Native Realtime WebSocket Broadcast (Instant worldwide across all devices)
  try {
    const channel = getGlobalRealtimeChannel();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'ros_event',
        payload: eventPayload
      }).catch(err => console.warn('Supabase broadcast send notice:', err));
    }
  } catch (e) {}

  // Lane C: Local Vite Server /api/sync (if running Vite dev server locally)
  try {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastEvent: eventPayload })
      }).catch(() => {});
    }
  } catch (e) {}

  return true;
}

// 2. Subscribe to real-time events via Supabase Realtime & BroadcastChannel
export function subscribeRealtimeEvents(onEventReceived) {
  if (typeof window === 'undefined' || typeof onEventReceived !== 'function') {
    return () => {};
  }

  const seenEventIds = new Set();

  const handleEvent = (rawPayload) => {
    try {
      const event = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      if (!event || typeof event !== 'object') return;

      if (event._eventId) {
        if (seenEventIds.has(event._eventId)) return;
        seenEventIds.add(event._eventId);
        if (seenEventIds.size > 500) {
          const first = seenEventIds.values().next().value;
          seenEventIds.delete(first);
        }
      }

      onEventReceived(event);
    } catch (e) {}
  };

  // 1. Listen to BroadcastChannel (same browser profile)
  let channelHandler = null;
  if (broadcastChannel) {
    channelHandler = (e) => {
      if (e && e.data) handleEvent(e.data);
    };
    broadcastChannel.addEventListener('message', channelHandler);
  }

  // 2. Listen to Supabase Global Realtime Broadcast (all devices globally)
  const channel = getGlobalRealtimeChannel();
  let supabaseHandler = null;
  if (channel) {
    supabaseHandler = ({ payload }) => {
      if (payload) handleEvent(payload);
    };
    channel.on('broadcast', { event: 'ros_event' }, supabaseHandler);
  }

  return () => {
    if (broadcastChannel && channelHandler) {
      broadcastChannel.removeEventListener('message', channelHandler);
    }
  };
}

// 3. Historical Events Catch-Up (From Supabase Timeline)
export async function fetchHistoricalEvents() {
  try {
    const meta = await fetchSystemMetaFromSupabase();
    if (meta && Array.isArray(meta.warriorTimeline)) {
      return meta.warriorTimeline.map(action => ({
        type: 'WARRIOR_ACTION',
        action
      }));
    }
  } catch (err) {
    console.warn('Historical events fetch notice:', err);
  }
  return [];
}

// 4. Fetch Global Metadata (Warriors, Reports, Tasks, Timeline, Forms)
export async function fetchGlobalMetaFromCloud() {
  let localData = null;

  // A. Primary: Query Supabase Cloud Database directly
  try {
    const [supabaseMeta, formSubmissions] = await Promise.all([
      fetchSystemMetaFromSupabase(),
      fetchFormSubmissionsFromCloud()
    ]);

    if (supabaseMeta) {
      localData = {
        ...supabaseMeta,
        formSubmissions: Array.isArray(formSubmissions) ? formSubmissions : (supabaseMeta.formSubmissions || [])
      };
    }
  } catch (e) {
    console.warn('Supabase fetchGlobalMeta notice:', e);
  }

  // B. Secondary: Check Local Server API (if running Vite dev server on localhost)
  try {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const devData = await res.json();
        localData = {
          ...(localData || {}),
          ...devData,
          warriors: (localData?.warriors && localData.warriors.length > 0) ? localData.warriors : (devData.warriors || []),
          dailyReports: [...(localData?.dailyReports || []), ...(devData.dailyReports || []).filter(r => !(localData?.dailyReports || []).some(x => x.id === r.id))],
          warriorTimeline: [...(localData?.warriorTimeline || []), ...(devData.warriorTimeline || []).filter(t => !(localData?.warriorTimeline || []).some(x => x.id === t.id))],
          formSubmissions: (Array.isArray(localData?.formSubmissions) && localData.formSubmissions.length > 0) 
            ? localData.formSubmissions 
            : (Array.isArray(devData?.formSubmissions) && devData.formSubmissions.length > 0 ? devData.formSubmissions : (localData?.formSubmissions || [])),
          importantNotes: (Array.isArray(localData?.importantNotes) && localData.importantNotes.length > 0) 
            ? localData.importantNotes 
            : (Array.isArray(devData?.importantNotes) && devData.importantNotes.length > 0 ? devData.importantNotes : (localData?.importantNotes || []))
        };
      }
    }
  } catch (e) {}

  return localData;
}

// 5. Save Global Metadata (Warriors, Reports, Tasks, Forms)
export async function saveGlobalMetaToCloud(meta) {
  if (!meta || typeof meta !== 'object') return false;

  // If form submissions are present, save to dedicated partition
  if (Array.isArray(meta.formSubmissions)) {
    saveFormSubmissionsToCloud(meta.formSubmissions).catch(err => {
      console.warn('saveFormSubmissionsToCloud error:', err);
    });
  }

  // Save remainder of meta to system metadata partition
  const { formSubmissions: _forms, ...restMeta } = meta;
  if (Object.keys(restMeta).length > 0) {
    saveSystemMetaToSupabase(restMeta).catch(err => {
      console.warn('saveSystemMetaToSupabase error:', err);
    });
  }

  // Local Server API if on localhost
  try {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meta)
      }).catch(() => {});
    }
  } catch (e) {}

  // Broadcast State Sync across tabs and devices
  broadcastRealtimeEvent({
    type: 'STATE_SYNC',
    meta
  });

  return true;
}
