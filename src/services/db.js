import { createClient } from '@supabase/supabase-js';
import { mergeWorkspaceLeads, isLeadPermanentlyPurged, sanitizeLeadForWorkspace } from './storage';
import cgeAuthoritative3804 from '../data/cgeAuthoritative3804.json';
import crewlixAuthoritative20113 from '../data/crewlixAuthoritative20113.json';

// Default Supabase project for ROS Outreach Dashboard
const DEFAULT_SUPABASE_URL = 'https://dyqcthbetwenvctjvfim.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cWN0aGJldHdlbnZjdGp2ZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MTUzMTMsImV4cCI6MjEwMzI5MTMxM30.JVjBtbXU8evmFx9ORHtVsf3cr8F7_yqhFrcm-NvtvKU';

const ENV_SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

const STORAGE_KEY_SUPABASE_URL = 'ros_supabase_url_v2';
const STORAGE_KEY_SUPABASE_KEY = 'ros_supabase_key_v2';
export const SYSTEM_META_ID = '__ros_system_metadata__';

let cachedClient = null;
let cachedClientKey = '';

// Helper to validate Supabase anon key is a valid JWT
export function isValidSupabaseKey(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  const parts = trimmed.split('.');
  return parts.length === 3 && trimmed.startsWith('eyJ') && trimmed.length > 50;
}

// 1. Get active Supabase client (singleton cached for stable realtime connection)
export function getSupabaseClient() {
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_URL) : null;
  const savedKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) : null;
  
  // Guard: if savedKey is invalid (e.g. autofilled browser password), purge it and fallback to authoritative anon key
  const validSavedKey = isValidSupabaseKey(savedKey) ? savedKey.trim() : null;
  if (savedKey && !validSavedKey && typeof localStorage !== 'undefined') {
    console.warn('Purged invalid Supabase API key from localStorage');
    try { localStorage.removeItem(STORAGE_KEY_SUPABASE_KEY); } catch (e) {}
  }

  const url = (savedUrl && savedUrl.startsWith('http')) ? savedUrl.trim() : (ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL);
  const key = validSavedKey || ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  if (url && key && url.startsWith('http')) {
    const clientKey = `${url.trim()}___${key.trim()}`;
    if (cachedClient && cachedClientKey === clientKey) {
      return cachedClient;
    }
    try {
      cachedClient = createClient(url.trim(), key.trim(), {
        auth: { persistSession: false },
        realtime: {
          params: {
            eventsPerSecond: 20
          }
        }
      });
      cachedClientKey = clientKey;
      return cachedClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
    }
  }
  return null;
}

export function saveSupabaseConfig(url, key) {
  if (url && key && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, key.trim());
    return true;
  }
  return false;
}

export function getSupabaseConfig() {
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_URL) : null;
  const savedKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) : null;
  return {
    url: savedUrl || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key: savedKey || ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  };
}

export function isCloudDatabaseConnected() {
  return !!getSupabaseClient();
}

// Permanently purged demo workspaces that must NEVER be loaded or re-saved
export const PERMANENTLY_PURGED_WS_IDS = ['ws_crewlix', 'ws_crewlixuk'];
export const DEMO_INVOICE_IDS = ['inv_101', 'inv_102', 'inv_103'];

function getLocalDeletedIds() {
  try {
    if (typeof localStorage !== 'undefined') {
      const s = localStorage.getItem('ros_deleted_workspaces_v1');
      return s ? JSON.parse(s) : [];
    }
  } catch (e) {}
  return [];
}

// 2. Fetch all workspaces from Supabase Cloud Database (Lightweight & Scalable)
export async function fetchWorkspacesFromCloud(fallbackWorkspaces = [], targetWorkspaceId = null, mergeOptions = {}) {
  const unionSentEmailsFor = Array.isArray(mergeOptions.unionSentEmailsFor) ? mergeOptions.unionSentEmailsFor : [];
  const safeFallback = Array.isArray(fallbackWorkspaces) ? fallbackWorkspaces : [];
  const supabase = getSupabaseClient();
  if (!supabase) {
    lastCloudErrorMsg = 'Supabase client is not connected or anon key is missing.';
    return safeFallback;
  }

  try {
    // Light query: Fetch workspace metadata (WITHOUT the heavy leads column)
    // This reduces the bulk query size from 30MB down to ~20KB, preventing statement timeouts.
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, client_name, client_email, campaign_name, active_sending_account, sending_accounts, client_credentials, sequence_config, activity_log, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error:', error);
      lastCloudErrorMsg = error.message || error.details || String(error);
      return safeFallback;
    }

    if (Array.isArray(data) && data.length > 0) {
      const deletedIds = getLocalDeletedIds();
      // Filter out internal system metadata rows and purged/deleted workspaces
      const clientWorkspaces = data.filter(item => 
        item && item.id && 
        !item.id.startsWith('__ros_') && 
        !PERMANENTLY_PURGED_WS_IDS.includes(item.id) &&
        !deletedIds.includes(item.id)
      );

      // Resolve leads for each workspace safely and fast:
      // If local already has leads and local updatedAt is up-to-date, reuse local leads.
      // Only fetch leads individually from cloud for the target workspace, or if cloud has newer updates.
      const workspacesWithLeads = await Promise.all(clientWorkspaces.map(async (item) => {
        const localWs = safeFallback.find(w => w.id === item.id);
        const cloudTime = new Date(item.updated_at || item.created_at || 0).getTime();
        const localTime = new Date(localWs?.updatedAt || 0).getTime();

        let leads = [];
        const isTarget = targetWorkspaceId && targetWorkspaceId === item.id;
        const needsCloudLeads = isTarget || unionSentEmailsFor.includes(item.id) || !localWs || !Array.isArray(localWs.leads) || localWs.leads.length === 0 || (cloudTime > localTime + 2000);

        if (needsCloudLeads) {
          try {
            const { data: leadRow, error: leadErr } = await supabase
              .from('workspaces')
              .select('id, leads')
              .eq('id', item.id)
              .maybeSingle();

            if (!leadErr && leadRow && Array.isArray(leadRow.leads)) {
              if (localWs && Array.isArray(localWs.leads) && localWs.leads.length > 0) {
                leads = mergeWorkspaceLeads(localWs.leads, leadRow.leads, {
                  workspaceId: item.id,
                  localWsUpdatedAt: localWs.updatedAt,
                  cloudWsUpdatedAt: item.updated_at,
                  deletedLeadIds: localWs.deletedLeadIds || [],
                  unionSentEmails: unionSentEmailsFor.includes(item.id)
                });
              } else {
                leads = leadRow.leads;
              }
            } else if (localWs && Array.isArray(localWs.leads)) {
              leads = localWs.leads;
            }
          } catch (e) {
            if (localWs && Array.isArray(localWs.leads)) {
              leads = localWs.leads;
            }
          }
        } else {
          leads = localWs.leads;
        }

        return {
          id: item.id,
          name: item.name,
          clientName: item.client_name || item.name,
          clientEmail: item.client_email || '',
          campaignName: item.campaign_name || 'Care Campaign',
          activeSendingAccount: item.active_sending_account || '',
          sendingAccounts: Array.isArray(item.sending_accounts) ? item.sending_accounts : (typeof item.sending_accounts === 'string' ? JSON.parse(item.sending_accounts) : [item.active_sending_account]),
          clientCredentials: typeof item.client_credentials === 'object' && item.client_credentials !== null 
            ? item.client_credentials 
            : (typeof item.client_credentials === 'string' ? JSON.parse(item.client_credentials) : { username: item.username || item.name, password: item.password || 'client2026' }),
          sequenceConfig: typeof item.sequence_config === 'object' && item.sequence_config !== null
            ? item.sequence_config
            : (typeof item.sequence_config === 'string' ? JSON.parse(item.sequence_config) : {}),
          deletedLeadIds: Array.isArray(item.sequence_config?.deletedLeadIds) 
            ? item.sequence_config.deletedLeadIds 
            : (typeof item.sequence_config === 'string' ? (JSON.parse(item.sequence_config)?.deletedLeadIds || []) : []),
          activityLog: Array.isArray(item.activity_log) ? item.activity_log : (typeof item.activity_log === 'string' ? JSON.parse(item.activity_log) : []),
          leads: (() => {
            let sanitizedLeads = Array.isArray(leads) ? leads.map(l => sanitizeLeadForWorkspace(l, item.id)).filter(Boolean) : [];
            if (item.id === 'ws_zrnl1fjb') {
              if (sanitizedLeads.length < 3804 && cgeAuthoritative3804 && Array.isArray(cgeAuthoritative3804.leads)) {
                const idSet = new Set(sanitizedLeads.map(l => l.id));
                cgeAuthoritative3804.leads.forEach(al => {
                  if (!idSet.has(al.id)) {
                    sanitizedLeads.push(al);
                    idSet.add(al.id);
                  }
                });
              }
            }
            if (item.id === 'ws_crewlixukltd') {
              if (sanitizedLeads.length < 20113 && crewlixAuthoritative20113 && Array.isArray(crewlixAuthoritative20113.leads)) {
                const idSet = new Set(sanitizedLeads.map(l => l.id));
                crewlixAuthoritative20113.leads.forEach(al => {
                  if (!idSet.has(al.id)) {
                    sanitizedLeads.push(al);
                    idSet.add(al.id);
                  }
                });
              }
            }
            return sanitizedLeads;
          })(),
          createdAt: item.created_at || new Date().toISOString().split('T')[0],
          updatedAt: item.updated_at || item.created_at || new Date().toISOString()
        };
      }));

      return workspacesWithLeads;
    }
  } catch (err) {
    console.warn('Cloud database fetch failed:', err);
    lastCloudErrorMsg = err.message || String(err);
  }

  return safeFallback;
}

let lastCloudErrorMsg = null;
export function getLastCloudError() {
  return lastCloudErrorMsg;
}

// Crewlix (20k+ leads) ships its authoritative baseline in the bundle, so the cloud row only needs
// the leads that differ from it. Every read path already backfills baseline leads by id.
let crewlixBaselineMap = null;
function getCrewlixBaselineMap() {
  if (!crewlixBaselineMap) {
    crewlixBaselineMap = new Map(
      (crewlixAuthoritative20113?.leads || []).filter(l => l && l.id).map(l => [String(l.id), l])
    );
  }
  return crewlixBaselineMap;
}

const DIFF_IGNORED_KEYS = new Set(['updatedAt', 'importedAt']);
function leadDiffersFromBaseline(lead, base) {
  if (!base) return true;
  const keys = new Set([...Object.keys(lead), ...Object.keys(base)]);
  for (const k of keys) {
    if (DIFF_IGNORED_KEYS.has(k)) continue;
    const a = lead[k] === undefined || lead[k] === null ? '' : lead[k];
    const b = base[k] === undefined || base[k] === null ? '' : base[k];
    if (typeof a === 'object' || typeof b === 'object') {
      if (JSON.stringify(a) !== JSON.stringify(b)) return true;
    } else if (String(a) !== String(b)) {
      return true;
    }
  }
  return false;
}

function toCrewlixCloudDelta(leads, previousCloudLeads = []) {
  const baseline = getCrewlixBaselineMap();
  // Leads the cloud already stored as changed stay in the delta, so reverting a field back to its
  // baseline value still propagates (with its newer timestamp) instead of silently dropping out.
  const previouslyChanged = new Set(
    (previousCloudLeads || [])
      .filter(l => l && l.id && leadDiffersFromBaseline(l, baseline.get(String(l.id))))
      .map(l => String(l.id))
  );
  return leads.filter(l => {
    if (!l || !l.id) return true;
    const id = String(l.id);
    return previouslyChanged.has(id) || leadDiffersFromBaseline(l, baseline.get(id));
  });
}

export function mergeActivityLogs(localLog = [], cloudLog = []) {
  const map = new Map();
  [...(Array.isArray(cloudLog) ? cloudLog : []), ...(Array.isArray(localLog) ? localLog : [])].forEach(a => {
    if (!a) return;
    map.set(a.id || `${a.timestamp}_${a.description}`, a);
  });
  return Array.from(map.values())
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 500);
}

// Result of the most recent successful save per workspace: the fully merged state that is now in
// the cloud. The context applies it locally so changes merged in from other portals show up at once.
const lastSavedRows = new Map();
export function getLastSavedRow(wsId) {
  return lastSavedRows.get(wsId) || null;
}

// Saves for the same workspace run one at a time so two saves from this device never race each other.
const workspaceSaveQueues = new Map();
function enqueueWorkspaceSave(wsId, task) {
  const prev = workspaceSaveQueues.get(wsId) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  workspaceSaveQueues.set(wsId, next.catch(() => {}));
  return next;
}

// Lightweight header poll: which workspaces changed in the cloud (no leads payload).
export async function fetchWorkspaceHeadersFromCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('workspaces').select('id, updated_at');
    if (error || !Array.isArray(data)) return null;
    const deletedIds = getLocalDeletedIds();
    return data.filter(r =>
      r && r.id && !r.id.startsWith('__ros_') &&
      !PERMANENTLY_PURGED_WS_IDS.includes(r.id) &&
      !deletedIds.includes(r.id)
    );
  } catch (err) {
    return null;
  }
}

const MAX_SAVE_ATTEMPTS = 4;

async function saveSingleWorkspaceToCloud(supabase, ws, isTargeted) {
  for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt++) {
    const { data: existingRow, error: checkErr } = await supabase
      .from('workspaces')
      .select('id, updated_at, leads, sequence_config, activity_log')
      .eq('id', ws.id)
      .maybeSingle();

    if (checkErr) {
      lastCloudErrorMsg = checkErr.message || String(checkErr);
      return false;
    }

    const cloudDeleted = Array.isArray(existingRow?.sequence_config?.deletedLeadIds) ? existingRow.sequence_config.deletedLeadIds : [];
    const localDeleted = Array.isArray(ws.deletedLeadIds) ? ws.deletedLeadIds : (ws.sequenceConfig?.deletedLeadIds || []);
    const mergedDeleted = Array.from(new Set([...cloudDeleted, ...localDeleted])).slice(-10000);

    let leadsToSave = ws.leads || [];
    if (existingRow) {
      const cloudTime = new Date(existingRow.updated_at || 0).getTime();
      const localTime = new Date(ws.updatedAt || 0).getTime();
      const cleanCloudLeads = Array.isArray(existingRow.leads)
        ? existingRow.leads.filter(l => !isLeadPermanentlyPurged(l, ws.id))
        : [];

      // Bulk (untargeted) save: skip when the cloud already holds everything this device has
      if (!isTargeted && cloudTime >= localTime && cleanCloudLeads.length >= (ws.leads?.length || 0)) {
        return true;
      }

      if (cleanCloudLeads.length > 0) {
        leadsToSave = mergeWorkspaceLeads(ws.leads || [], cleanCloudLeads, {
          workspaceId: ws.id,
          localWsUpdatedAt: ws.updatedAt,
          cloudWsUpdatedAt: existingRow.updated_at,
          deletedLeadIds: mergedDeleted
        });
      }
    }

    leadsToSave = (leadsToSave || []).map(l => sanitizeLeadForWorkspace(l, ws.id)).filter(Boolean);

    if (ws.id === 'ws_zrnl1fjb' && leadsToSave.length < 3804 && Array.isArray(cgeAuthoritative3804?.leads)) {
      const idSet = new Set(leadsToSave.map(l => l.id));
      cgeAuthoritative3804.leads.forEach(al => {
        if (!idSet.has(al.id)) {
          leadsToSave.push(al);
          idSet.add(al.id);
        }
      });
    }

    let cloudLeadsPayload = leadsToSave;
    if (ws.id === 'ws_crewlixukltd') {
      if (leadsToSave.length < 20113 && Array.isArray(crewlixAuthoritative20113?.leads)) {
        const idSet = new Set(leadsToSave.map(l => l.id));
        crewlixAuthoritative20113.leads.forEach(al => {
          if (!idSet.has(al.id)) {
            leadsToSave.push(al);
            idSet.add(al.id);
          }
        });
      }
      // Previously Crewlix was skipped entirely (payload too large), so its edits never left the
      // device. Upload only the leads that differ from the bundled baseline.
      cloudLeadsPayload = toCrewlixCloudDelta(leadsToSave, existingRow?.leads);
    }

    const mergedActivity = mergeActivityLogs(ws.activityLog || [], existingRow?.activity_log || []);
    const nowIso = new Date().toISOString();

    const payload = {
      id: ws.id,
      name: ws.name,
      client_name: ws.clientName || ws.name,
      client_email: ws.clientEmail || '',
      campaign_name: ws.campaignName || 'Care Campaign',
      active_sending_account: ws.activeSendingAccount || ws.sendingAccounts?.[0] || '',
      sending_accounts: ws.sendingAccounts || [ws.activeSendingAccount],
      client_credentials: ws.clientCredentials || { username: ws.name, password: 'client2026' },
      sequence_config: {
        ...(existingRow?.sequence_config || {}),
        ...(ws.sequenceConfig || {}),
        deletedLeadIds: mergedDeleted
      },
      activity_log: mergedActivity,
      leads: cloudLeadsPayload,
      updated_at: nowIso
    };

    let writeError = null;
    let conflict = false;

    if (existingRow) {
      // Compare-and-swap: only write if nobody else saved since we read. Otherwise re-read,
      // re-merge and retry, so concurrent saves from two portals can't erase each other's edits.
      let casQuery = supabase.from('workspaces').update(payload).eq('id', ws.id);
      casQuery = existingRow.updated_at
        ? casQuery.eq('updated_at', existingRow.updated_at)
        : casQuery.is('updated_at', null);
      const { data: updatedRows, error } = await casQuery.select('id');
      writeError = error;
      conflict = !error && (!Array.isArray(updatedRows) || updatedRows.length === 0);
    } else {
      const { error } = await supabase.from('workspaces').upsert(payload, { onConflict: 'id' });
      writeError = error;
    }

    if (writeError) {
      console.warn(`Error syncing workspace ${ws.id} to Supabase:`, writeError);
      lastCloudErrorMsg = writeError.message || writeError.details || String(writeError);
      return false;
    }

    if (conflict) {
      if (attempt < MAX_SAVE_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 150 * attempt + Math.random() * 200));
        continue;
      }
      lastCloudErrorMsg = `Workspace ${ws.id} kept changing in the cloud during save; will retry on next sync.`;
      return false;
    }

    lastSavedRows.set(ws.id, {
      id: ws.id,
      leads: leadsToSave,
      activity_log: mergedActivity,
      sequence_config: payload.sequence_config,
      updated_at: nowIso,
      savedLocalUpdatedAt: ws.updatedAt
    });
    return true;
  }
  return false;
}

// 3. Save / Sync Workspaces (including leads) to Supabase Cloud Database (Targeted & Efficient)
export async function saveWorkspacesToCloud(workspaces, targetWorkspaceId = null) {
  if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) return false;

  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const deletedIds = getLocalDeletedIds();
  lastCloudErrorMsg = null;

  let hasError = false;
  for (const ws of workspaces) {
    if (!ws || !ws.id || ws.id.startsWith('__ros_') || PERMANENTLY_PURGED_WS_IDS.includes(ws.id) || deletedIds.includes(ws.id)) continue;
    if (targetWorkspaceId && ws.id !== targetWorkspaceId) continue;

    // Skip massive historical archives during untargeted bulk saves to avoid statement timeouts
    if (!targetWorkspaceId && ws.leads && ws.leads.length > 5000) continue;

    try {
      const ok = await enqueueWorkspaceSave(ws.id, () => saveSingleWorkspaceToCloud(supabase, ws, !!targetWorkspaceId));
      if (!ok) hasError = true;
    } catch (err) {
      console.warn(`Save exception for ${ws.id}:`, err);
      lastCloudErrorMsg = err.message || String(err);
      hasError = true;
    }
  }
  return !hasError;
}

// 3b. Delete Workspace from Supabase Cloud Database
export async function deleteWorkspaceFromCloud(wsId) {
  if (!wsId || wsId.startsWith('__ros_')) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', wsId);

    if (error) {
      console.warn(`Error deleting workspace ${wsId} from Supabase:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete workspace failed:', err);
    return false;
  }
}

// 4. Fetch System Metadata (Warriors, Daily Reports, Tasks, Timeline) from Supabase
export async function fetchSystemMetaFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, client_credentials, sequence_config, activity_log, updated_at')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (error || !data) return null;

    const warriors = Array.isArray(data.client_credentials?.warriors) ? data.client_credentials.warriors : [];
    const seq = data.sequence_config || {};
    const dailyReports = Array.isArray(seq.dailyReports) ? seq.dailyReports : [];
    const tasks = Array.isArray(seq.tasks) ? seq.tasks : [];
    const rawPayments = Array.isArray(seq.payments) ? seq.payments : [];
    const payments = rawPayments.filter(p => p && !PERMANENTLY_PURGED_WS_IDS.includes(p.workspaceId) && !DEMO_INVOICE_IDS.includes(p.id));
    const emailCopies = Array.isArray(seq.emailCopies) ? seq.emailCopies : [];
    const importantNotes = Array.isArray(seq.importantNotes) ? seq.importantNotes : [];
    const todos = Array.isArray(seq.todos) ? seq.todos : [];
    const formSubmissions = Array.isArray(seq.formSubmissions) ? seq.formSubmissions : [];
    const warriorTimeline = Array.isArray(data.activity_log) ? data.activity_log : [];

    return {
      warriors,
      dailyReports,
      tasks,
      payments,
      emailCopies,
      importantNotes,
      todos,
      formSubmissions,
      warriorTimeline,
      updatedAt: data.updated_at
    };
  } catch (err) {
    console.warn('Failed to fetch system meta from Supabase:', err);
    return null;
  }
}

// 5. Save System Metadata (Warriors, Daily Reports, Tasks, Timeline) to Supabase
export async function saveSystemMetaToSupabase(meta) {
  const supabase = getSupabaseClient();
  if (!supabase || !meta) return false;

  try {
    // Fetch raw existing row to preserve client_credentials (chat, etc.) and sequence_config
    const { data: rawData } = await supabase
      .from('workspaces')
      .select('id, client_credentials, sequence_config, activity_log')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    const existingCreds = (rawData && typeof rawData.client_credentials === 'object' && rawData.client_credentials !== null)
      ? rawData.client_credentials
      : {};
    const existingSeq = (rawData && typeof rawData.sequence_config === 'object' && rawData.sequence_config !== null)
      ? rawData.sequence_config
      : {};

    const existingWarriors = Array.isArray(existingCreds.warriors) ? existingCreds.warriors : [];
    const mergedWarriors = meta.warriors !== undefined ? meta.warriors : existingWarriors;

    const mergedReports = meta.dailyReports !== undefined ? meta.dailyReports : (Array.isArray(existingSeq.dailyReports) ? existingSeq.dailyReports : []);
    const mergedTasks = meta.tasks !== undefined ? meta.tasks : (Array.isArray(existingSeq.tasks) ? existingSeq.tasks : []);
    const rawPayments = meta.payments !== undefined ? meta.payments : (Array.isArray(existingSeq.payments) ? existingSeq.payments : []);
    const mergedPayments = rawPayments.filter(p => p && !PERMANENTLY_PURGED_WS_IDS.includes(p.workspaceId) && !DEMO_INVOICE_IDS.includes(p.id));
    const mergedCopies = meta.emailCopies !== undefined ? meta.emailCopies : (Array.isArray(existingSeq.emailCopies) ? existingSeq.emailCopies : []);
    const mergedNotes = meta.importantNotes !== undefined ? meta.importantNotes : (Array.isArray(existingSeq.importantNotes) ? existingSeq.importantNotes : []);
    const mergedTodos = meta.todos !== undefined ? meta.todos : (Array.isArray(existingSeq.todos) ? existingSeq.todos : []);
    const mergedForms = meta.formSubmissions !== undefined ? meta.formSubmissions : (Array.isArray(existingSeq.formSubmissions) ? existingSeq.formSubmissions : []);
    const mergedTimeline = meta.warriorTimeline !== undefined ? meta.warriorTimeline : (Array.isArray(rawData?.activity_log) ? rawData.activity_log : []);

    const payload = {
      id: SYSTEM_META_ID,
      name: 'ROS System Cloud Database',
      client_name: 'ROS Internal Mission Control',
      client_email: 'admin@rosoutreach.com',
      campaign_name: 'Global System State',
      active_sending_account: 'system',
      sending_accounts: ['system'],
      client_credentials: {
        ...existingCreds,
        warriors: mergedWarriors
      },
      sequence_config: {
        ...existingSeq,
        dailyReports: mergedReports,
        tasks: mergedTasks,
        payments: mergedPayments,
        emailCopies: mergedCopies,
        importantNotes: mergedNotes,
        todos: mergedTodos,
        formSubmissions: mergedForms
      },
      activity_log: mergedTimeline.slice(0, 300),
      leads: [],
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('workspaces')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Failed to save system meta to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase system meta save failed:', err);
    return false;
  }
}

// 6. Direct Warrior Fetch & Save
export async function fetchWarriorsFromSupabase() {
  const meta = await fetchSystemMetaFromSupabase();
  return meta?.warriors || [];
}

export async function saveWarriorsToSupabase(warriors) {
  return saveSystemMetaToSupabase({ warriors });
}

// ============================================================================
// PARTITIONED CLOUD STORAGE (ISOLATED MICRO-ENTITIES)
// Prevents race conditions and overwrites between Chat, Forms, and System Meta
// ============================================================================
export const FORM_SUBMISSIONS_ID = '__ros_form_submissions_v1__';
export const CHAT_DATA_ID = '__ros_chat_messages_v1__';
export const SHEETS_CONFIG_ID = '__ros_sheets_config_v1__';

// 6b. Dedicated Google Sheets Config Partition (shared by Admin, Warrior & Client portals)
export async function fetchSheetsConfigFromCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('sequence_config, updated_at')
      .eq('id', SHEETS_CONFIG_ID)
      .maybeSingle();

    if (error || !data?.sequence_config) return null;
    const { url, token, updatedAt } = data.sequence_config;
    if (!url) return null;
    return { url, token, updatedAt: updatedAt || data.updated_at };
  } catch (err) {
    console.warn('fetchSheetsConfigFromCloud notice:', err);
    return null;
  }
}

export async function saveSheetsConfigToCloud({ url, token }) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const now = new Date().toISOString();
    const payload = {
      id: SHEETS_CONFIG_ID,
      name: 'ROS Google Sheets Config Partition',
      client_name: 'System Partition',
      client_email: 'sheets@rosoutreach.com',
      campaign_name: 'Google Sheets Config',
      active_sending_account: 'system',
      sending_accounts: ['system'],
      client_credentials: {},
      sequence_config: { url: (url || '').trim(), token: (token || '').trim(), updatedAt: now },
      activity_log: [],
      leads: [],
      updated_at: now
    };

    const { error } = await supabase
      .from('workspaces')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('saveSheetsConfigToCloud error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('saveSheetsConfigToCloud exception:', err);
    return false;
  }
}

// 7. Dedicated Form Submissions Partition
export async function fetchFormSubmissionsFromCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    // 1. Try dedicated partition row first
    const { data, error } = await supabase
      .from('workspaces')
      .select('sequence_config')
      .eq('id', FORM_SUBMISSIONS_ID)
      .maybeSingle();

    if (!error && data?.sequence_config && Array.isArray(data.sequence_config.formSubmissions)) {
      return data.sequence_config.formSubmissions;
    }

    // 2. Fallback / migration check from legacy row
    const { data: legacyData } = await supabase
      .from('workspaces')
      .select('sequence_config')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    const legacyForms = legacyData?.sequence_config?.formSubmissions;
    if (Array.isArray(legacyForms) && legacyForms.length > 0) {
      // Seed dedicated row
      saveFormSubmissionsToCloud(legacyForms).catch(() => {});
      return legacyForms;
    }
  } catch (err) {
    console.warn('fetchFormSubmissionsFromCloud notice:', err);
  }
  return [];
}

export async function saveFormSubmissionsToCloud(formSubmissions) {
  const supabase = getSupabaseClient();
  if (!supabase || !Array.isArray(formSubmissions)) return false;

  try {
    const payload = {
      id: FORM_SUBMISSIONS_ID,
      name: 'ROS Form Submissions Partition',
      client_name: 'System Partition',
      client_email: 'forms@rosoutreach.com',
      campaign_name: 'Form Submissions',
      active_sending_account: 'system',
      sending_accounts: ['system'],
      client_credentials: {},
      sequence_config: { formSubmissions },
      activity_log: [],
      leads: [],
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('workspaces')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('saveFormSubmissionsToCloud error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('saveFormSubmissionsToCloud exception:', err);
    return false;
  }
}

// 8. Dedicated Chat Data Partition
export async function fetchChatDataFromCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) return { messages: [], conversations: [] };

  try {
    // 1. Try dedicated partition row first
    const { data, error } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', CHAT_DATA_ID)
      .maybeSingle();

    if (!error && data?.client_credentials) {
      const messages = Array.isArray(data.client_credentials.chat_messages) ? data.client_credentials.chat_messages : [];
      const conversations = Array.isArray(data.client_credentials.chat_conversations) ? data.client_credentials.chat_conversations : [];
      if (messages.length > 0 || conversations.length > 0) {
        return { messages, conversations };
      }
    }

    // 2. Fallback / migration check from legacy row
    const { data: legacyData } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    const legacyCreds = legacyData?.client_credentials;
    const legacyMsgs = Array.isArray(legacyCreds?.chat_messages) ? legacyCreds.chat_messages : [];
    const legacyConvs = Array.isArray(legacyCreds?.chat_conversations) ? legacyCreds.chat_conversations : [];

    if (legacyMsgs.length > 0 || legacyConvs.length > 0) {
      saveChatDataToCloud({ messages: legacyMsgs, conversations: legacyConvs }).catch(() => {});
      return { messages: legacyMsgs, conversations: legacyConvs };
    }
  } catch (err) {
    console.warn('fetchChatDataFromCloud notice:', err);
  }
  return { messages: [], conversations: [] };
}

export async function saveChatDataToCloud({ messages, conversations }) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { data: existing } = await supabase
      .from('workspaces')
      .select('client_credentials')
      .eq('id', CHAT_DATA_ID)
      .maybeSingle();

    const existingCreds = existing?.client_credentials || {};
    const nextCreds = { ...existingCreds };
    if (messages !== undefined) nextCreds.chat_messages = messages;
    if (conversations !== undefined) nextCreds.chat_conversations = conversations;

    const payload = {
      id: CHAT_DATA_ID,
      name: 'ROS Chat Partition',
      client_name: 'Chat Partition',
      client_email: 'chat@rosoutreach.com',
      campaign_name: 'Chat Data',
      active_sending_account: 'system',
      sending_accounts: ['system'],
      client_credentials: nextCreds,
      sequence_config: {},
      activity_log: [],
      leads: [],
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('workspaces')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('saveChatDataToCloud error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('saveChatDataToCloud exception:', err);
    return false;
  }
}


