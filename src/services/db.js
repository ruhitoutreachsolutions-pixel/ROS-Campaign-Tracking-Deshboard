import { createClient } from '@supabase/supabase-js';

// Default Supabase project for ROS Outreach Dashboard
const DEFAULT_SUPABASE_URL = 'https://dyqcthbetwenvctjvfim.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cWN0aGJldHdlbnZjdGp2ZmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3MTUzMTMsImV4cCI6MjEwMzI5MTMxM30.JVjBtbXU8evmFx9ORHtVsf3cr8F7_yqhFrcm-NvtvKU';

const ENV_SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

const STORAGE_KEY_SUPABASE_URL = 'ros_supabase_url_v2';
const STORAGE_KEY_SUPABASE_KEY = 'ros_supabase_key_v2';
const SYSTEM_META_ID = '__ros_system_metadata__';

// 1. Get active Supabase client
export function getSupabaseClient() {
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_URL) : null;
  const savedKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) : null;
  const url = savedUrl || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = savedKey || ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  if (url && key && url.startsWith('http')) {
    try {
      return createClient(url.trim(), key.trim(), {
        auth: { persistSession: false }
      });
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

function getLocalDeletedIds() {
  try {
    if (typeof localStorage !== 'undefined') {
      const s = localStorage.getItem('ros_deleted_workspaces_v1');
      return s ? JSON.parse(s) : [];
    }
  } catch (e) {}
  return [];
}

// 2. Fetch all workspaces and their thousands of leads from Supabase Cloud Database
export async function fetchWorkspacesFromCloud(fallbackWorkspaces = []) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return fallbackWorkspaces;
  }

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error:', error);
      return fallbackWorkspaces;
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

      return clientWorkspaces.map(item => ({
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
        activityLog: Array.isArray(item.activity_log) ? item.activity_log : (typeof item.activity_log === 'string' ? JSON.parse(item.activity_log) : []),
        leads: Array.isArray(item.leads) ? item.leads : (typeof item.leads === 'string' ? JSON.parse(item.leads) : []),
        createdAt: item.created_at || new Date().toISOString().split('T')[0],
        updatedAt: item.updated_at || item.created_at || new Date().toISOString()
      }));
    }
  } catch (err) {
    console.warn('Cloud database fetch failed:', err);
  }

  return fallbackWorkspaces;
}

// 3. Save / Sync Workspaces (including all leads) to Supabase Cloud Database
export async function saveWorkspacesToCloud(workspaces) {
  if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) return false;

  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const deletedIds = getLocalDeletedIds();

  try {
    let hasError = false;
    let lastError = null;

    for (const ws of workspaces) {
      if (!ws || !ws.id || ws.id.startsWith('__ros_') || PERMANENTLY_PURGED_WS_IDS.includes(ws.id) || deletedIds.includes(ws.id)) continue;

      const payload = {
        id: ws.id,
        name: ws.name,
        client_name: ws.clientName || ws.name,
        client_email: ws.clientEmail || '',
        campaign_name: ws.campaignName || 'Care Campaign',
        active_sending_account: ws.activeSendingAccount || ws.sendingAccounts?.[0] || '',
        sending_accounts: ws.sendingAccounts || [ws.activeSendingAccount],
        client_credentials: ws.clientCredentials || { username: ws.name, password: 'client2026' },
        sequence_config: ws.sequenceConfig || {},
        activity_log: ws.activityLog || [],
        leads: ws.leads || [],
        updated_at: ws.updatedAt || new Date().toISOString()
      };

      const { error } = await supabase
        .from('workspaces')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn(`Error syncing workspace ${ws.id} to Supabase:`, error);
        hasError = true;
        lastError = error;
      }
    }
    return !hasError;
  } catch (err) {
    console.warn('Supabase save failed:', err);
    return false;
  }
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
      .select('*')
      .eq('id', SYSTEM_META_ID)
      .maybeSingle();

    if (error || !data) return null;

    const warriors = Array.isArray(data.client_credentials?.warriors) ? data.client_credentials.warriors : [];
    const seq = data.sequence_config || {};
    const dailyReports = Array.isArray(seq.dailyReports) ? seq.dailyReports : [];
    const tasks = Array.isArray(seq.tasks) ? seq.tasks : [];
    const rawPayments = Array.isArray(seq.payments) ? seq.payments : [];
    const payments = rawPayments.filter(p => p && !PERMANENTLY_PURGED_WS_IDS.includes(p.workspaceId) && p.id !== 'inv_101' && p.id !== 'inv_103');
    const emailCopies = Array.isArray(seq.emailCopies) ? seq.emailCopies : [];
    const importantNotes = Array.isArray(seq.importantNotes) ? seq.importantNotes : [];
    const todos = Array.isArray(seq.todos) ? seq.todos : [];
    const warriorTimeline = Array.isArray(data.activity_log) ? data.activity_log : [];

    return {
      warriors,
      dailyReports,
      tasks,
      payments,
      emailCopies,
      importantNotes,
      todos,
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
      .select('*')
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
    const mergedPayments = rawPayments.filter(p => p && !PERMANENTLY_PURGED_WS_IDS.includes(p.workspaceId) && p.id !== 'inv_101' && p.id !== 'inv_103');
    const mergedCopies = meta.emailCopies !== undefined ? meta.emailCopies : (Array.isArray(existingSeq.emailCopies) ? existingSeq.emailCopies : []);
    const mergedNotes = meta.importantNotes !== undefined ? meta.importantNotes : (Array.isArray(existingSeq.importantNotes) ? existingSeq.importantNotes : []);
    const mergedTodos = meta.todos !== undefined ? meta.todos : (Array.isArray(existingSeq.todos) ? existingSeq.todos : []);
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
        todos: mergedTodos
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

