import { createClient } from '@supabase/supabase-js';
import { mergeWorkspaceLeads, isLeadPermanentlyPurged, sanitizeLeadForWorkspace, refillFromBaseline, capTombstones, cloudSyncedAtAfterMerge } from './storage';
import { fetchDncRegistryFromGoogleSheets } from './googleSheetsService';
import { isLeadUnsubscribedFromLink, KNOWN_LINK_UNSUB_EMAILS, VERIFIED_LINK_UNSUB_RECORDS } from '../utils/helpers';
import cgeAuthoritative3804 from '../data/cgeAuthoritative3804.json';
import crewlixAuthoritative20113 from '../data/crewlixAuthoritative20113.json';

// Default Supabase project for ROS Outreach Dashboard (Crewlix UK Ltd Active Database)
const DEFAULT_SUPABASE_URL = 'https://efpywnwavldrycjspdel.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcHl3bndhdmxkcnljanNwZGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzE4MDEsImV4cCI6MjEwODYwNzgwMX0.i0wlV3E3CiLL9uZ5JCVr5hfYnkwywhWUCvjDp5zcz0s';

const ENV_SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

const STORAGE_KEY_SUPABASE_URL = 'ros_supabase_url_v2';
const STORAGE_KEY_SUPABASE_KEY = 'ros_supabase_key_v2';
export const SYSTEM_META_ID = '__ros_system_metadata__';
export const DNC_REGISTRY_ID = '__ros_dnc_registry_v1__';
export const CHUNK_SIZE = 3000;
export const CHUNK_PREFIX = '__ros_chunk__';

// Strips empty strings, nulls, zeroes, false booleans to reduce JSON size by >60%
export function compactLeadForCloud(l) {
  if (!l || typeof l !== 'object') return null;
  const c = { id: String(l.id || ''), email: String(l.email || '') };
  if (l.firstName != null) c.firstName = String(l.firstName);
  if (l.companyName != null) c.companyName = String(l.companyName);
  if (l.city != null) c.city = String(l.city);
  if (l.campaignName != null) c.campaignName = String(l.campaignName);
  if (l.accountName != null) c.accountName = String(l.accountName);
  if (l.email1 != null) c.email1 = String(l.email1);
  if (l.email2 != null) c.email2 = String(l.email2);
  if (l.email3 != null) c.email3 = String(l.email3);
  if (l.stage != null) c.stage = String(l.stage);
  if (l.status && l.status !== 'pending') c.status = String(l.status);
  if (l.isDNC) c.isDNC = true;
  if (l.dealValue) c.dealValue = Number(l.dealValue) || 0;
  if (l.replyDate != null) c.replyDate = String(l.replyDate);
  if (l.notes != null) c.notes = String(l.notes);
  if (l.dateAdded != null) c.dateAdded = String(l.dateAdded);
  if (l.createdAt != null) c.createdAt = String(l.createdAt);
  if (l.importedAt != null) c.importedAt = String(l.importedAt);
  if (l.updatedAt != null) c.updatedAt = String(l.updatedAt);
  if (l.unsubscribedAt != null) c.unsubscribedAt = String(l.unsubscribedAt);
  if (l.unsubscribeReason != null) c.unsubscribeReason = String(l.unsubscribeReason);
  if (l.unsubscribedFromLink) c.unsubscribedFromLink = true;
  return c;
}

// Fast 32-bit checksum for chunk delta change detection
export function computeChunkHash(leads) {
  if (!Array.isArray(leads) || leads.length === 0) return '0';
  let hash = 0;
  const str = JSON.stringify(leads);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

// Fetches the main workspace row AND all partition chunks, seamlessly stitching the leads together.
// Returns an error unless every partition loaded and the count matches sequence_config.totalLeads;
// options.allowIncomplete instead returns what loaded, flagged `incomplete` (used by the save path,
// which merges this device's leads in and so repairs the cloud copy).
export async function fetchFullCloudWorkspaceRow(supabase, wsId, options = {}) {
  if (!supabase || !wsId) return { data: null, error: 'No client or workspace ID' };

  try {
    const { data: mainRow, error: mainErr } = await supabase
      .from('workspaces')
      .select('id, name, client_name, client_email, campaign_name, active_sending_account, sending_accounts, client_credentials, leads, sequence_config, activity_log, created_at, updated_at')
      .eq('id', wsId)
      .maybeSingle();

    if (mainErr) return { data: null, error: mainErr };
    if (!mainRow) return { data: null, error: null };

    // Fetch chunk IDs list first (lightweight query ~1 KB, avoids 15MB socket truncation)
    const { data: chunkHeaderRows, error: chunkErr } = await supabase
      .from('workspaces')
      .select('id')
      .ilike('id', `%${CHUNK_PREFIX}${wsId}%`)
      .order('id', { ascending: true });

    if (chunkErr) return { data: null, error: chunkErr };

    const chunkIndexOf = (id) => parseInt(String(id).split('__').pop(), 10) || 0;
    const cfg = mainRow.sequence_config || {};
    const expectedChunkCount = Number(cfg.chunkCount) || 0;
    const expectedTotal = Number.isFinite(Number(cfg.totalLeads)) && cfg.totalLeads !== undefined ? Number(cfg.totalLeads) : null;
    const existingChunkIds = (chunkHeaderRows || []).map(r => r.id);
    // Only partitions 1..chunkCount-1 belong to the current save. Rows past that are leftovers
    // from a bigger save; stitching them in would resurrect leads deleted since.
    const liveChunkIds = existingChunkIds
      .filter(id => { const k = chunkIndexOf(id); return k >= 1 && (!expectedChunkCount || k < expectedChunkCount); })
      .sort((a, b) => chunkIndexOf(a) - chunkIndexOf(b));

    const chunkLeads = new Map();
    const loadChunks = async (ids) => {
      const { data: batchData, error: batchErr } = await supabase
        .from('workspaces')
        .select('id, leads')
        .in('id', ids);
      if (batchErr || !Array.isArray(batchData)) return;
      batchData.forEach(cr => chunkLeads.set(cr.id, Array.isArray(cr.leads) ? cr.leads : []));
    };
    // Fetch in safe batches of 4 chunks (~2.5 MB per batch), then retry missing ones singly
    const BATCH_SIZE = 4;
    for (let i = 0; i < liveChunkIds.length; i += BATCH_SIZE) {
      await loadChunks(liveChunkIds.slice(i, i + BATCH_SIZE));
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const missing = liveChunkIds.filter(id => !chunkLeads.has(id));
      if (missing.length === 0) break;
      for (const id of missing) await loadChunks([id]);
    }

    // A partial copy must never be treated as the cloud state: every reader merges it as
    // authoritative, so missing partitions would look like deleted leads (and vice versa).
    const missingChunks = liveChunkIds.filter(id => !chunkLeads.has(id));
    const fullLeads = Array.isArray(mainRow.leads) ? [...mainRow.leads] : [];
    liveChunkIds.forEach(id => { if (chunkLeads.has(id)) fullLeads.push(...chunkLeads.get(id)); });
    const missingPartitions = expectedChunkCount > 1 && liveChunkIds.length < expectedChunkCount - 1;
    const incomplete = missingChunks.length > 0 || missingPartitions || (expectedTotal !== null && fullLeads.length !== expectedTotal);
    if (incomplete && !options.allowIncomplete) {
      return {
        data: null,
        error: new Error(`Incomplete cloud copy of ${wsId}: got ${fullLeads.length}${expectedTotal !== null ? ` of ${expectedTotal}` : ''} leads (${missingChunks.length} partition(s) failed to load)`)
      };
    }

    return {
      data: {
        ...mainRow,
        leads: fullLeads,
        existingChunkIds,
        incomplete
      },
      error: null
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchDncRegistryFromCloud() {
  let records = [];
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('leads')
        .eq('id', DNC_REGISTRY_ID)
        .maybeSingle();
      if (!error && data && Array.isArray(data.leads) && data.leads.length > 0) {
        records = data.leads;
      }
    } catch (e) {
      console.warn('[CloudRegistry] Supabase DNC fetch error, falling back to Google Sheets:', e.message);
    }
  }

  // Dual-Cloud Failover: If Supabase returned empty/error (e.g. quota 402), fail over to Google Sheets
  if (!records || records.length === 0) {
    try {
      const sheetRecords = await fetchDncRegistryFromGoogleSheets();
      if (Array.isArray(sheetRecords) && sheetRecords.length > 0) {
        records = sheetRecords;
      }
    } catch (sheetErr) {
      console.warn('[CloudRegistry] Google Sheets failover fetch error:', sheetErr.message);
    }
  }

  // Baseline Guarantee: Merge with all 13 verified public link unsubscribe records
  const map = new Map();
  VERIFIED_LINK_UNSUB_RECORDS.forEach(rec => {
    if (rec && rec.email) map.set(rec.email.toLowerCase().trim(), rec);
  });
  (records || []).forEach(rec => {
    if (rec && rec.email) {
      const clean = rec.email.toLowerCase().trim();
      const existing = map.get(clean);
      map.set(clean, { ...existing, ...rec });
    }
  });

  return Array.from(map.values());
}

export async function saveDncRecordToCloud(recordsOrRecord) {
  const supabase = getSupabaseClient();
  if (!supabase || !recordsOrRecord) return false;
  try {
    const list = Array.isArray(recordsOrRecord) ? recordsOrRecord : [recordsOrRecord];
    const validRecords = list.filter(r => r && r.email && typeof r.email === 'string' && r.email.trim());
    if (validRecords.length === 0) return false;

    const existing = await fetchDncRegistryFromCloud();
    const cleanNewEmails = new Set(validRecords.map(r => r.email.toLowerCase().trim()));
    const filtered = (existing || []).filter(r => r && r.email && !cleanNewEmails.has(r.email.toLowerCase().trim()));

    // Add new records to the top of registry
    filtered.unshift(...validRecords);

    const nowIso = new Date().toISOString();
    const { error: upsertErr } = await supabase
      .from('workspaces')
      .upsert({
        id: DNC_REGISTRY_ID,
        name: 'ROS Global DNC Registry',
        leads: filtered.slice(0, 10000),
        updated_at: nowIso
      }, { onConflict: 'id' });

    if (upsertErr) {
      await supabase
        .from('workspaces')
        .update({
          leads: filtered.slice(0, 10000),
          updated_at: nowIso
        })
        .eq('id', DNC_REGISTRY_ID);
    }
    return true;
  } catch (e) {
    console.warn('saveDncRecordToCloud failed:', e);
    return false;
  }
}

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
  let savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_URL) : null;
  let savedKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) : null;

  // Auto-Migration Guard: If localStorage holds any old deprecated project, purge it so all clients upgrade cleanly
  if (savedUrl && (savedUrl.includes('dyqcthbetwenvctjvfim') || savedUrl.includes('kmjqbctguwighqwezwq'))) {
    console.log('Migrating device to authoritative Crewlix UK Ltd Supabase database...');
    try {
      localStorage.removeItem(STORAGE_KEY_SUPABASE_URL);
      localStorage.removeItem(STORAGE_KEY_SUPABASE_KEY);
      savedUrl = null;
      savedKey = null;
    } catch (e) {}
  }
  
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
  let savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_URL) : null;
  let savedKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) : null;
  if (savedUrl && (savedUrl.includes('dyqcthbetwenvctjvfim') || savedUrl.includes('kmjqbctguwighqwezwq'))) {
    savedUrl = null;
    savedKey = null;
  }
  return {
    url: savedUrl || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key: savedKey || ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  };
}

export function isCloudDatabaseConnected() {
  return !!getSupabaseClient();
}

// Sole authoritative active workspace
export const PRIMARY_WORKSPACE_ID = 'ws_crewlixukltd';

// Permanently purged workspaces that must NEVER be loaded or re-saved
export const PERMANENTLY_PURGED_WS_IDS = [
  'ws_crewlix',
  'ws_crewlixuk',
  'ws_zrnl1fjb',
  'ws_ybrxd4k1',
  'ws_cgeenergy',
  'ws_cge_uk_ltd',
  'ws_crewlixglobal'
];
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
  lastCloudFetchOk = false;
  const safeFallback = Array.isArray(fallbackWorkspaces) 
    ? fallbackWorkspaces.filter(w => w && w.id === PRIMARY_WORKSPACE_ID) 
    : [];
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
      // Strictly only retain Crewlix UK Ltd, permanently purge everything else
      const clientWorkspaces = data.filter(item => 
        item && item.id && 
        item.id === PRIMARY_WORKSPACE_ID &&
        !item.id.startsWith('__ros_') && 
        !PERMANENTLY_PURGED_WS_IDS.includes(item.id) &&
        !deletedIds.includes(item.id)
      );

      // Fetch cloud DNC registry to guarantee all opt-outs are reflected
      let dncEmailSet = new Set();
      let dncRecordMap = new Map();
      try {
        const dncList = await fetchDncRegistryFromCloud();
        (dncList || []).forEach(d => {
          if (d && d.email) {
            const clean = d.email.trim().toLowerCase();
            dncEmailSet.add(clean);
            dncRecordMap.set(clean, d);
          }
        });
      } catch (e) {}

      // Resolve leads for each workspace safely and fast:
      // If local already has leads and local updatedAt is up-to-date, reuse local leads.
      // Only fetch leads individually from cloud for the target workspace, or if cloud has newer updates.
      const workspacesWithLeads = await Promise.all(clientWorkspaces.map(async (item) => {
        const localWs = safeFallback.find(w => w.id === item.id);
        const cloudTime = new Date(item.updated_at || item.created_at || 0).getTime();
        const localTime = new Date(localWs?.updatedAt || 0).getTime();

        let leads = [];
        let cloudSyncedAt = localWs?.cloudSyncedAt || null;
        const isTarget = targetWorkspaceId && targetWorkspaceId === item.id;
        const needsCloudLeads = isTarget || unionSentEmailsFor.includes(item.id) || !localWs || !Array.isArray(localWs.leads) || localWs.leads.length === 0 || (cloudTime > localTime + 2000);

        if (needsCloudLeads) {
          const { data: fullCloudRow, error: leadErr } = await fetchFullCloudWorkspaceRow(supabase, item.id);
          // Never dress local (or partial) leads up as the cloud copy: callers treat the result as
          // authoritative and would mark stale data clean or drop leads the fetch missed.
          if (leadErr || !fullCloudRow || !Array.isArray(fullCloudRow.leads)) {
            throw (leadErr instanceof Error ? leadErr : new Error(leadErr?.message || `Could not load leads for ${item.id}`));
          }
          if (localWs && Array.isArray(localWs.leads) && localWs.leads.length > 0) {
            const deletedLeadIds = [...(localWs.deletedLeadIds || []), ...(fullCloudRow.sequence_config?.deletedLeadIds || [])];
            const cutoff = localOnlyCutoffFor(localWs, fullCloudRow.updated_at);
            leads = mergeWorkspaceLeads(localWs.leads, fullCloudRow.leads, {
              workspaceId: item.id,
              localWsUpdatedAt: localWs.updatedAt,
              cloudWsUpdatedAt: fullCloudRow.updated_at,
              deletedLeadIds,
              localOnlyCutoff: cutoff,
              unionSentEmails: unionSentEmailsFor.includes(item.id)
            });
            cloudSyncedAt = cloudSyncedAtAfterMerge(localWs.leads, fullCloudRow.leads, cutoff, fullCloudRow.updated_at, deletedLeadIds);
          } else {
            leads = fullCloudRow.leads;
            cloudSyncedAt = fullCloudRow.updated_at;
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
            const deleted = new Set([
              ...((item.sequence_config && item.sequence_config.deletedLeadIds) || []),
              ...(localWs?.deletedLeadIds || [])
            ]);
            const sanitizedLeads = Array.isArray(leads)
              ? leads.filter(l => l && !deleted.has(l.id)).map(l => sanitizeLeadForWorkspace(l, item.id)).filter(Boolean)
              : [];
            const refilled = refillFromBaseline(sanitizedLeads, item.id, deleted);
            if (dncEmailSet.size > 0 || KNOWN_LINK_UNSUB_EMAILS.size > 0) {
              return refilled.map(l => {
                const cleanEmail = (l && l.email) ? l.email.trim().toLowerCase() : '';
                const isMatchInDnc = cleanEmail && (dncEmailSet.has(cleanEmail) || KNOWN_LINK_UNSUB_EMAILS.has(cleanEmail));
                const isLinkUnsub = isMatchInDnc || isLeadUnsubscribedFromLink(l);

                if (isLinkUnsub) {
                  const dncRec = dncRecordMap.get(cleanEmail);
                  return {
                    ...l,
                    status: 'dnc',
                    stage: 'DNC / Unsubscribed',
                    isDNC: true,
                    unsubscribedAt: l.unsubscribedAt || dncRec?.unsubscribedAt || new Date().toISOString(),
                    unsubscribeReason: l.unsubscribeReason || dncRec?.reason || 'Public unsubscribe link (unsub.crewlixhr.co.uk)',
                    unsubscribedFromLink: true
                  };
                } else if (l && l.unsubscribedFromLink === true && !isLeadUnsubscribedFromLink(l)) {
                  const clean = { ...l };
                  delete clean.unsubscribedFromLink;
                  if (clean.unsubscribeReason && (clean.unsubscribeReason.includes('unsub.crewlixhr.co.uk') || clean.unsubscribeReason.includes('Public unsubscribe link'))) {
                    delete clean.unsubscribeReason;
                  }
                  if (clean.notes && clean.notes.includes('[Unsubscribed via link]')) {
                    clean.notes = clean.notes.replace(/\s*\|\s*\[Unsubscribed via link\]/g, '').replace(/\[Unsubscribed via link\]\s*/g, '').trim();
                  }
                  if (clean.stage === 'DNC / Unsubscribed') {
                    clean.stage = 'DNC';
                  }
                  return clean;
                }
                return l;
              });
            }
            return refilled;
          })(),
          createdAt: item.created_at || new Date().toISOString().split('T')[0],
          updatedAt: item.updated_at || item.created_at || new Date().toISOString(),
          cloudSyncedAt
        };
      }));

      lastCloudFetchOk = true;
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

// Whether the most recent fetchWorkspacesFromCloud returned real cloud data (it returns the local
// fallback on any failure, which callers must not merge as if it were the cloud copy).
let lastCloudFetchOk = false;
export function getLastCloudFetchOk() {
  return lastCloudFetchOk;
}

// Cutoff for mergeWorkspaceLeads' localOnlyCutoff: the cloud version this device last synced with.
// Local leads newer than that may be pending uploads; older ones missing from the cloud were deleted.
// A device that never recorded a sync (pre-fix cache) defers to the cloud copy entirely.
export function localOnlyCutoffFor(localWs, cloudUpdatedAt) {
  const synced = new Date(localWs?.cloudSyncedAt || 0).getTime();
  if (Number.isFinite(synced) && synced > 0) return synced;
  const cloud = new Date(cloudUpdatedAt || 0).getTime();
  return Number.isFinite(cloud) ? cloud : 0;
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
// Statuses derived purely from the email1-3 fields (which are compared directly). Merges
// recompute these, so comparing them flagged almost every lead as changed.
const DERIVED_SEND_STATUSES = new Set(['', 'pending', 'sent_1', 'sent_2', 'sent_3']);
// Empty defaults the merge fills in (dealValue: 0, isDNC: false, email3: '') equal "missing"
const normalizeDiffValue = (v) => (v === undefined || v === null || v === 0 || v === false || v === '0' || v === 'false') ? '' : v;

function leadDiffersFromBaseline(lead, base) {
  if (!base) return true;
  const keys = new Set([...Object.keys(lead), ...Object.keys(base)]);
  for (const k of keys) {
    if (DIFF_IGNORED_KEYS.has(k)) continue;
    if (k === 'status') {
      const sa = String(lead.status || '').toLowerCase();
      const sb = String(base.status || '').toLowerCase();
      if (sa !== sb && !(DERIVED_SEND_STATUSES.has(sa) && DERIVED_SEND_STATUSES.has(sb))) return true;
      continue;
    }
    const a = normalizeDiffValue(lead[k]);
    const b = normalizeDiffValue(base[k]);
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
  if (!ws || !ws.id || ws.id !== PRIMARY_WORKSPACE_ID || PERMANENTLY_PURGED_WS_IDS.includes(ws.id)) {
    return true; // Skip non-Crewlix UK Ltd workspaces completely
  }

  for (let attempt = 1; attempt <= MAX_SAVE_ATTEMPTS; attempt++) {
    const { data: existingRow, error: checkErr } = await fetchFullCloudWorkspaceRow(supabase, ws.id, { allowIncomplete: true });

    if (checkErr) {
      lastCloudErrorMsg = checkErr.message || String(checkErr);
      return false;
    }

    const cloudDeleted = Array.isArray(existingRow?.sequence_config?.deletedLeadIds) ? existingRow.sequence_config.deletedLeadIds : [];
    const localDeleted = Array.isArray(ws.deletedLeadIds) ? ws.deletedLeadIds : (ws.sequenceConfig?.deletedLeadIds || []);
    const mergedDeleted = capTombstones([...cloudDeleted, ...localDeleted], ws.id);
    const mergedDeletedSet = new Set(mergedDeleted);

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
          deletedLeadIds: mergedDeleted,
          // A complete cloud copy decides which old leads still exist, so a stale device can't push
          // back leads removed elsewhere. An incomplete read keeps everything to repair the cloud.
          localOnlyCutoff: existingRow.incomplete ? undefined : localOnlyCutoffFor(ws, existingRow.updated_at)
        });
      }
    }

    leadsToSave = (leadsToSave || [])
      .filter(l => l && !mergedDeletedSet.has(l.id))
      .map(l => sanitizeLeadForWorkspace(l, ws.id))
      .filter(Boolean);
    leadsToSave = refillFromBaseline(leadsToSave, ws.id, mergedDeletedSet);

    // Compact all leads to strip redundant empty strings / defaults
    const compactedLeads = leadsToSave.map(compactLeadForCloud).filter(Boolean);

    // Split into safe chunks of CHUNK_SIZE (3,000 leads ~ 750 KB each)
    const chunks = [];
    for (let i = 0; i < compactedLeads.length; i += CHUNK_SIZE) {
      chunks.push(compactedLeads.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push([]);

    const currentHashes = chunks.map(computeChunkHash);
    const prevHashes = Array.isArray(existingRow?.sequence_config?.chunkHashes) ? existingRow.sequence_config.chunkHashes : [];
    const prevChunkCount = Number(existingRow?.sequence_config?.chunkCount) || 1;
    const existingChunkIds = new Set(existingRow?.existingChunkIds || []);

    // 🛡️ ANTI-DOWNGRADE SHIELD:
    // A save may only shrink the cloud by leads that were deliberately deleted (newly tombstoned).
    // Any bigger drop means this device is missing data (e.g. a 20,113 baseline boot), so refuse.
    // (This used to be a fixed 50,000 floor, which also blocked legitimate deletes below 50k.)
    if (existingRow) {
      const cloudDeletedSet = new Set(cloudDeleted.map(String));
      const newlyDeleted = mergedDeleted.filter(id => !cloudDeletedSet.has(id)).length;
      const cloudTotal = Number(existingRow.sequence_config?.totalLeads) || (existingRow.leads || []).length;
      if (compactedLeads.length < cloudTotal - newlyDeleted) {
        console.warn(`[ANTI-DOWNGRADE SHIELD] Blocked save: cloud holds ${cloudTotal} leads, only ${newlyDeleted} newly deleted, but this device would write ${compactedLeads.length}.`);
        lastCloudErrorMsg = `Refused to shrink ${ws.id} from ${cloudTotal} to ${compactedLeads.length} leads (only ${newlyDeleted} deletions)`;
        return false;
      }
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
        deletedLeadIds: mergedDeleted,
        chunkCount: chunks.length,
        chunkSize: CHUNK_SIZE,
        totalLeads: compactedLeads.length,
        chunkHashes: currentHashes
      },
      activity_log: mergedActivity,
      leads: chunks[0], // Primary chunk stored in workspace main row
      updated_at: nowIso
    };

    let writeError = null;
    let conflict = false;

    if (existingRow) {
      // Compare-and-swap on main row
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

    // Upsert any subsequent partition chunks (1 .. N-1) with bulletproof delta skip
    for (let k = 1; k < chunks.length; k++) {
      const chunkRowId = `${CHUNK_PREFIX}${ws.id}__${String(k).padStart(4, '0')}`;
      // DELTA OPTIMIZATION GUARD:
      // Only skip upload if the chunk row ALREADY EXISTS in the cloud table AND its hash is identical!
      if (existingChunkIds.has(chunkRowId) && prevHashes[k] && prevHashes[k] === currentHashes[k]) {
        continue;
      }
      const chunkPayload = {
        id: chunkRowId,
        name: `${ws.name || ws.id} (Partition ${k})`,
        client_name: 'ROS Chunk Partition',
        client_email: '',
        campaign_name: ws.campaignName || '',
        active_sending_account: 'system',
        sending_accounts: ['system'],
        client_credentials: {},
        sequence_config: { partitionIndex: k, workspaceId: ws.id, hash: currentHashes[k] },
        activity_log: [],
        leads: chunks[k],
        updated_at: nowIso
      };

      const { error: chunkSaveErr } = await supabase
        .from('workspaces')
        .upsert(chunkPayload, { onConflict: 'id' });

      if (chunkSaveErr) {
        console.warn(`Error uploading chunk ${k} for ${ws.id}:`, chunkSaveErr);
      }
    }

    // Clean up partitions past the new chunk count (readers ignore them, but they'd linger forever)
    const staleChunkIds = Array.from(existingChunkIds).filter(id => {
      const k = parseInt(String(id).split('__').pop(), 10) || 0;
      return k >= chunks.length;
    });
    for (let c = chunks.length; c < prevChunkCount; c++) {
      const staleId = `${CHUNK_PREFIX}${ws.id}__${String(c).padStart(4, '0')}`;
      if (!staleChunkIds.includes(staleId)) staleChunkIds.push(staleId);
    }
    for (const staleId of staleChunkIds) {
      await supabase.from('workspaces').delete().eq('id', staleId);
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

    // Also delete any partition chunks for this workspace
    await supabase
      .from('workspaces')
      .delete()
      .like('id', `${CHUNK_PREFIX}${wsId}__%`);

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

/**
 * Purges all deprecated workspaces and their partition chunks from Supabase
 * to reclaim storage space, reduce table bloat, and prevent egress limits.
 * Guarantees 'ws_crewlixukltd' is NEVER touched.
 */
export async function purgeUnwantedWorkspacesFromCloud() {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  let cleanedCount = 0;
  for (const id of PERMANENTLY_PURGED_WS_IDS) {
    try {
      // 1. Delete main workspace row
      const { error: err1 } = await supabase.from('workspaces').delete().eq('id', id);
      if (!err1) cleanedCount++;

      // 2. Delete all partition chunk rows for this workspace
      await supabase.from('workspaces').delete().like('id', `${CHUNK_PREFIX}${id}__%`);
    } catch (e) {
      console.warn(`[PurgeCloud] Could not delete ${id}:`, e.message);
    }
  }

  return cleanedCount;
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


