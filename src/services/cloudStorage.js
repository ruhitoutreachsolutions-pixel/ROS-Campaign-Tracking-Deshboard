// UNIVERSAL MULTI-TIER REAL-TIME SYNC & NOTIFICATION ENGINE
// Tier 1: Browser BroadcastChannel (0ms, same browser / incognito tabs)
// Tier 2: Vite Local Server API /api/sync (0ms, cross-browser on machine / LAN)
// Tier 3: Cloud Realtime Pub/Sub & SSE via ntfy.sh (unlimited, zero-auth, real-time push across devices)

const NTFY_TOPIC = 'ros_warrior_sync_prod_9921';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;
const BROADCAST_CHANNEL_NAME = 'ros_realtime_broadcast_v1';

let broadcastChannel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  // BroadcastChannel fallback
}

// 1. Broadcast an instant real-time event across all channels
export async function broadcastRealtimeEvent(eventData) {
  if (!eventData || typeof eventData !== 'object') return false;

  const eventPayload = {
    ...eventData,
    _eventId: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    _timestamp: new Date().toISOString()
  };

  // A. BroadcastChannel (0ms, local browser tabs & windows)
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage(eventPayload);
    }
  } catch (e) {}

  // B. Local Vite Server /api/sync (0ms, cross-browser on this machine)
  try {
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastEvent: eventPayload })
    }).catch(() => {});
  } catch (e) {}

  // C. Cloud Pub/Sub via ntfy.sh (real-time push to all connected browsers)
  try {
    fetch(NTFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload)
    }).catch(() => {});
  } catch (e) {}

  return true;
}

// 2. Subscribe to real-time events via Server-Sent Events (SSE) & BroadcastChannel
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

  // 1. Listen to BroadcastChannel (same browser)
  let channelHandler = null;
  if (broadcastChannel) {
    channelHandler = (e) => {
      if (e && e.data) handleEvent(e.data);
    };
    broadcastChannel.addEventListener('message', channelHandler);
  }

  // 2. Listen to Cloud Server-Sent Events (cross-browser / cross-device)
  let sse = null;
  try {
    if ('EventSource' in window) {
      sse = new EventSource(`${NTFY_URL}/sse`);
      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.event === 'message' && parsed.message) {
            handleEvent(parsed.message);
          }
        } catch (e) {}
      };
      sse.onerror = () => {
        // EventSource auto-reconnects automatically
      };
    }
  } catch (e) {}

  return () => {
    if (broadcastChannel && channelHandler) {
      broadcastChannel.removeEventListener('message', channelHandler);
    }
    if (sse) {
      try { sse.close(); } catch (e) {}
    }
  };
}

// 3. Fetch historical events submitted in the last 24 hours
export async function fetchHistoricalEvents(since = '24h') {
  const events = [];
  try {
    const res = await fetch(`${NTFY_URL}/json?poll=1&since=${since}`, {
      headers: { 'Accept': 'application/x-ndjson, text/plain, application/json' }
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed && parsed.event === 'message' && parsed.message) {
            const inner = typeof parsed.message === 'string' ? JSON.parse(parsed.message) : parsed.message;
            if (inner && inner.type) {
              events.push(inner);
            }
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('Historical events fetch notice:', err);
  }
  return events;
}

// 4. Fetch Global Metadata (Warriors, Reports, Tasks, Timeline) from Local API & Cloud
export async function fetchGlobalMetaFromCloud() {
  let localData = null;

  // A. Check Local Server API
  try {
    const res = await fetch('/api/sync');
    if (res.ok) {
      localData = await res.json();
    }
  } catch (e) {}

  // B. Check Historical Cloud Events (catch up on anything missed)
  try {
    const cloudEvents = await fetchHistoricalEvents('24h');
    if (cloudEvents.length > 0) {
      const reports = [...(localData?.dailyReports || [])];
      const tasks = [...(localData?.tasks || [])];
      const timeline = [...(localData?.warriorTimeline || [])];
      const warriors = [...(localData?.warriors || [])];

      for (const evt of cloudEvents) {
        if (evt.type === 'DAILY_REPORT_SUBMITTED' && evt.report) {
          if (!reports.some(r => r.id === evt.report.id)) {
            reports.unshift(evt.report);
          }
        }
        if (evt.type === 'WARRIOR_ACTION' && evt.action) {
          if (!timeline.some(t => t.id === evt.action.id)) {
            timeline.unshift(evt.action);
          }
        }
        if (evt.type === 'WARRIOR_UPDATED' && evt.warrior) {
          const idx = warriors.findIndex(w => w.id === evt.warrior.id);
          if (idx >= 0) warriors[idx] = { ...warriors[idx], ...evt.warrior };
          else warriors.unshift(evt.warrior);
        }
        if (evt.type === 'TASK_SUBMITTED' && evt.task) {
          const idx = tasks.findIndex(t => t.id === evt.task.id);
          if (idx >= 0) tasks[idx] = evt.task;
          else tasks.unshift(evt.task);
        }
      }

      localData = {
        ...(localData || {}),
        dailyReports: reports,
        tasks,
        warriorTimeline: timeline,
        warriors
      };
    }
  } catch (e) {}

  return localData;
}

// 5. Save Global Metadata (Warriors, Reports, Tasks, Workspaces)
export async function saveGlobalMetaToCloud(meta) {
  if (!meta || typeof meta !== 'object') return false;

  // A. Save to Local Server API
  try {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta)
    });
  } catch (e) {}

  // B. Broadcast State Sync
  broadcastRealtimeEvent({
    type: 'STATE_SYNC',
    meta
  });

  return true;
}

// 6. Workspaces helpers
export async function fetchWorkspacesFromCloud(fallbackWorkspaces = []) {
  try {
    const meta = await fetchGlobalMetaFromCloud();
    if (meta && Array.isArray(meta.workspaces) && meta.workspaces.length > 0) {
      return meta.workspaces;
    }
  } catch (err) {}
  return fallbackWorkspaces;
}

export async function saveWorkspacesToCloud(workspaces) {
  if (!workspaces || !Array.isArray(workspaces)) return false;
  return saveGlobalMetaToCloud({ workspaces });
}
