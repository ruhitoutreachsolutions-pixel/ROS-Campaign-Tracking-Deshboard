import { createClient } from '@supabase/supabase-js';

// Default / Environment Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const STORAGE_KEY_SUPABASE_URL = 'ros_supabase_url_v1';
const STORAGE_KEY_SUPABASE_KEY = 'ros_supabase_key_v1';

// Get active Supabase client (from env or saved settings)
export function getSupabaseClient() {
  const customUrl = localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || SUPABASE_URL;
  const customKey = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || SUPABASE_ANON_KEY;

  if (customUrl && customKey && customUrl.startsWith('http')) {
    try {
      return createClient(customUrl, customKey);
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
    url: localStorage.getItem(STORAGE_KEY_SUPABASE_URL) || SUPABASE_URL || '',
    key: localStorage.getItem(STORAGE_KEY_SUPABASE_KEY) || SUPABASE_ANON_KEY || ''
  };
}

// 1. Fetch workspaces from Cloud Database
export async function fetchWorkspacesFromCloud(fallbackWorkspaces = []) {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*');

      if (!error && Array.isArray(data) && data.length > 0) {
        // Parse JSON fields if stored as text or return rows
        return data.map(item => ({
          ...item,
          leads: Array.isArray(item.leads) ? item.leads : (typeof item.leads === 'string' ? JSON.parse(item.leads) : []),
          activityLog: Array.isArray(item.activityLog) ? item.activityLog : (typeof item.activityLog === 'string' ? JSON.parse(item.activityLog) : []),
          sendingAccounts: Array.isArray(item.sendingAccounts) ? item.sendingAccounts : (typeof item.sendingAccounts === 'string' ? JSON.parse(item.sendingAccounts) : [item.activeSendingAccount]),
          clientCredentials: typeof item.clientCredentials === 'object' ? item.clientCredentials : (typeof item.clientCredentials === 'string' ? JSON.parse(item.clientCredentials) : { username: item.username, password: item.password })
        }));
      }
    } catch (err) {
      console.warn('Supabase fetch error:', err);
    }
  }

  return fallbackWorkspaces;
}

// 2. Save / Sync Workspaces to Cloud Database
export async function saveWorkspacesToCloud(workspaces) {
  if (!workspaces || !Array.isArray(workspaces)) return false;

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      for (const ws of workspaces) {
        const payload = {
          id: ws.id,
          name: ws.name,
          clientName: ws.clientName || ws.name,
          clientEmail: ws.clientEmail || '',
          campaignName: ws.campaignName || 'General Outbound',
          activeSendingAccount: ws.activeSendingAccount || ws.sendingAccounts?.[0] || '',
          sendingAccounts: ws.sendingAccounts || [ws.activeSendingAccount],
          clientCredentials: ws.clientCredentials || { username: ws.name, password: 'client2026' },
          sequenceConfig: ws.sequenceConfig || {},
          activityLog: ws.activityLog || [],
          leads: ws.leads || [],
          updated_at: new Date().toISOString()
        };

        await supabase
          .from('workspaces')
          .upsert(payload, { onConflict: 'id' });
      }
      return true;
    } catch (err) {
      console.warn('Supabase save error:', err);
    }
  }

  return false;
}
