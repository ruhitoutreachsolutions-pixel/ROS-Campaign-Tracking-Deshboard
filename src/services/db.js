import { createClient } from '@supabase/supabase-js';

// Default Supabase project for ROS Outreach Dashboard
// Production Cloud Sync Active
const DEFAULT_SUPABASE_URL = 'https://dyqcthbetwenvctjvfim.supabase.co';
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const STORAGE_KEY_SUPABASE_URL = 'ros_supabase_url_v2';
const STORAGE_KEY_SUPABASE_KEY = 'ros_supabase_key_v2';

// 1. Get active Supabase client
export function getSupabaseClient() {
  const url = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || ENV_SUPABASE_ANON_KEY;

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
  if (url && key) {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, key.trim());
    return true;
  }
  return false;
}

export function getSupabaseConfig() {
  return {
    url: localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key: localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || ENV_SUPABASE_ANON_KEY || ''
  };
}

export function isCloudDatabaseConnected() {
  return !!getSupabaseClient();
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
      return data.map(item => ({
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
        createdAt: item.created_at || new Date().toISOString().split('T')[0]
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

  try {
    for (const ws of workspaces) {
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
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('workspaces')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn(`Error syncing workspace ${ws.id} to Supabase:`, error);
      }
    }
    return true;
  } catch (err) {
    console.warn('Supabase save failed:', err);
    return false;
  }
}
