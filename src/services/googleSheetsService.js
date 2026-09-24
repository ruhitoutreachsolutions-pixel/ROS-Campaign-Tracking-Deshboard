// ============================================================================
// GOOGLE SHEETS LIVE REDUNDANCY & FAILOVER ENGINE
// Secondary cloud data store providing:
// 1. Live tab-by-tab workspace sync
// 2. Automated login credentials redundancy (_Auth_Credentials tab)
// 3. Workspace metadata registry (_Workspaces_Meta tab)
// 4. Chronological activity audit log (_Activity_Log tab)
// 5. Autonomous failover when Supabase is offline or unreachable
// 6. Out-of-sync detection with 1-click Push Engine
// ============================================================================

export const STORAGE_KEY_SHEETS_URL = 'ros_google_sheets_url_v2';
export const STORAGE_KEY_SHEETS_TOKEN = 'ros_google_sheets_token_v2';
export const STORAGE_KEY_PENDING_QUEUE = 'ros_google_sheets_pending_queue_v2';
export const STORAGE_KEY_LAST_SYNC = 'ros_google_sheets_last_sync_v2';

export const DEFAULT_SHEETS_TOKEN = 'ROS_SHEET_SECRET_2026';

// Standard 16-column lead schema for all workspace tabs
export const LEAD_COLUMNS = [
  'id',
  'email',
  'firstName',
  'companyName',
  'city',
  'campaignName',
  'status',
  'stage',
  'email1',
  'email2',
  'email3',
  'replyDate',
  'dealValue',
  'isDNC',
  'accountName',
  'updatedAt'
];

/**
 * Generate clean sheet tab name from workspace name/id
 * e.g. "CGE UK LTD" -> "WS_CGE_UK_LTD"
 * e.g. "Crewlix UK Ltd" -> "WS_Crewlix_UK_Ltd"
 */
export function getWorkspaceTabName(workspace) {
  if (!workspace) return 'WS_General';
  const rawName = (workspace.name || workspace.clientName || workspace.id || 'Workspace').trim();
  const clean = rawName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
  return `WS_${clean}`;
}

/**
 * Get current Google Sheets configuration
 */
export function getGoogleSheetsConfig() {
  if (typeof localStorage === 'undefined') {
    return { url: '', token: DEFAULT_SHEETS_TOKEN };
  }
  const url = localStorage.getItem(STORAGE_KEY_SHEETS_URL) || '';
  const token = localStorage.getItem(STORAGE_KEY_SHEETS_TOKEN) || DEFAULT_SHEETS_TOKEN;
  return { url: url.trim(), token: token.trim() };
}

/**
 * Save Google Sheets configuration to localStorage
 */
export function saveGoogleSheetsConfig(url, token) {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (url !== undefined) localStorage.setItem(STORAGE_KEY_SHEETS_URL, (url || '').trim());
    if (token !== undefined) localStorage.setItem(STORAGE_KEY_SHEETS_TOKEN, (token || DEFAULT_SHEETS_TOKEN).trim());
    return true;
  } catch (err) {
    console.error('Failed to save Google Sheets configuration:', err);
    return false;
  }
}

/**
 * Check if Google Sheets is configured with a valid Apps Script Web App URL
 */
export function isGoogleSheetsConfigured() {
  const { url } = getGoogleSheetsConfig();
  return !!(url && url.startsWith('http') && url.includes('script.google.com'));
}

/**
 * Get pending sync queue from localStorage
 */
export function getPendingSyncQueue() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Add an item to the pending sync queue
 */
export function addPendingSyncItem(item) {
  if (typeof localStorage === 'undefined' || !item) return;
  try {
    const queue = getPendingSyncQueue();
    const queueItem = {
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...item
    };
    queue.push(queueItem);
    // Keep max 100 items
    if (queue.length > 100) queue.splice(0, queue.length - 100);
    localStorage.setItem(STORAGE_KEY_PENDING_QUEUE, JSON.stringify(queue));
    notifyQueueChange();
    return queueItem;
  } catch (e) {
    console.warn('Failed to add to pending sync queue:', e);
  }
}

/**
 * Clear the pending sync queue
 */
export function clearPendingSyncQueue() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING_QUEUE);
    notifyQueueChange();
  } catch (e) {}
}

/**
 * Get last sync timestamp
 */
export function getLastSheetsSyncTime() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
}

export function setLastSheetsSyncTime() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, new Date().toISOString());
  } catch (e) {}
}

// Queue change subscriber mechanism
const queueListeners = new Set();
export function subscribeToQueueChange(listener) {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}
function notifyQueueChange() {
  const q = getPendingSyncQueue();
  queueListeners.forEach(fn => {
    try { fn(q); } catch (e) {}
  });
}

/**
 * Low-level HTTP POST request to Google Apps Script Web App
 * Uses 'text/plain;charset=utf-8' to avoid CORS preflight (OPTIONS) triggers in browsers.
 */
async function sendSheetsRequest(payload, timeoutMs = 12000) {
  const { url, token } = getGoogleSheetsConfig();
  if (!url || !url.startsWith('http')) {
    throw new Error('Google Sheet Web App URL is not configured. Please set the Web App URL in Cloud Settings.');
  }

  const fullPayload = {
    ...payload,
    secret: token || DEFAULT_SHEETS_TOKEN
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(fullPayload),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Google Sheets responded with HTTP status ${response.status}`);
    }

    const json = await response.json();
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Google Sheets request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

/**
 * Test connectivity with the Google Sheets Web App
 */
export async function testGoogleSheetsConnection(customUrl = null, customToken = null) {
  const url = customUrl || getGoogleSheetsConfig().url;
  const token = customToken || getGoogleSheetsConfig().token || DEFAULT_SHEETS_TOKEN;

  if (!url || !url.startsWith('http')) {
    return { success: false, message: 'Please enter a valid Google Apps Script Web App URL.' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'test', secret: token }),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (data && data.success) {
      return { 
        success: true, 
        message: `Connected successfully! Spreadsheet: "${data.title || 'ROS Campaign Master Database'}"`,
        title: data.title 
      };
    } else {
      return { 
        success: false, 
        message: data?.error || 'Invalid secret token or script error.' 
      };
    }
  } catch (err) {
    return { 
      success: false, 
      message: `Connection failed: ${err.message || 'Network error or invalid script URL.'}` 
    };
  }
}

/**
 * Synchronize batch delta leads (e.g. after clicking "Auto-Apply Email Sent")
 * Non-blocking, fast execution.
 */
export async function syncLeadsBatchToGoogleSheet(workspaceId, workspaceName, leads, activity = null) {
  if (!isGoogleSheetsConfigured()) {
    // Record in pending queue for user attention
    addPendingSyncItem({
      type: 'batch_leads',
      workspaceId,
      workspaceName,
      leadCount: leads?.length || 0,
      description: `Sent/updated ${leads?.length || 0} leads (Google Sheet setup pending)`
    });
    return { success: false, reason: 'unconfigured' };
  }

  if (!leads || leads.length === 0) return { success: true };

  const tabName = getWorkspaceTabName({ name: workspaceName, id: workspaceId });

  const payload = {
    action: 'sync_workspace_leads',
    workspaceId,
    tabName,
    leads,
    activity,
    fullSync: false
  };

  try {
    const res = await sendSheetsRequest(payload, 10000);
    if (res && res.success) {
      setLastSheetsSyncTime();
      return { success: true, count: res.count || leads.length };
    } else {
      throw new Error(res?.error || 'Failed to update workspace tab in Google Sheet');
    }
  } catch (err) {
    console.warn('[GoogleSheetSync] Batch delta sync error:', err.message);
    addPendingSyncItem({
      type: 'batch_leads',
      workspaceId,
      workspaceName,
      leadCount: leads.length,
      leadIds: leads.map(l => l.id),
      description: `Failed to sync ${leads.length} leads: ${err.message}`
    });
    return { success: false, error: err.message };
  }
}

/**
 * Synchronize all credentials to the _Auth_Credentials tab
 */
export async function syncAuthCredentialsToGoogleSheet(workspaces = [], warriors = []) {
  if (!isGoogleSheetsConfigured()) return { success: false, reason: 'unconfigured' };

  const credentials = [];

  // 1. Admin Credentials
  credentials.push({
    workspaceId: 'ADMIN',
    role: 'admin',
    username: 'admin',
    password: 'ros2026',
    name: 'Ruhit (Agency Admin)',
    email: 'ruhitahmed111@gmail.com',
    allowedWorkspaces: 'ALL',
    status: 'active'
  });

  // 2. Warriors Credentials
  (warriors || []).forEach(w => {
    if (!w) return;
    credentials.push({
      workspaceId: 'WARRIOR',
      role: 'warrior',
      username: w.username || w.email || '',
      password: w.password || 'warrior2026',
      name: w.name || 'ROS Warrior',
      email: w.email || '',
      allowedWorkspaces: (w.allowedWorkspaceIds || []).join(', ') || 'ALL',
      status: w.status || 'active'
    });
  });

  // 3. Client Workspaces Credentials
  (workspaces || []).forEach(ws => {
    if (!ws) return;
    const creds = ws.clientCredentials || {};
    credentials.push({
      workspaceId: ws.id,
      role: 'client',
      username: creds.username || ws.username || ws.name,
      password: creds.password || ws.password || 'crewlix2026',
      name: ws.clientName || ws.name || 'Client',
      email: ws.clientEmail || ws.email || '',
      allowedWorkspaces: ws.id,
      status: 'active'
    });
  });

  try {
    const res = await sendSheetsRequest({
      action: 'sync_auth_credentials',
      credentials
    }, 15000);
    return res;
  } catch (err) {
    console.warn('[GoogleSheetSync] Credentials sync failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronize full workspace metadata to _Workspaces_Meta tab
 */
export async function syncWorkspacesMetaToGoogleSheet(workspaces = []) {
  if (!isGoogleSheetsConfigured()) return { success: false, reason: 'unconfigured' };

  const metaList = (workspaces || []).map(ws => {
    const leads = ws.leads || [];
    let sentCount = 0;
    let interestedCount = 0;

    leads.forEach(l => {
      if (l.email1 || l.email2 || l.email3 || (l.status && l.status.startsWith('sent_'))) {
        sentCount++;
      }
      if (l.status === 'interested' || (l.stage && l.stage.toLowerCase().includes('interest'))) {
        interestedCount++;
      }
    });

    return {
      id: ws.id,
      name: ws.name || '',
      clientName: ws.clientName || ws.name || '',
      campaignName: ws.campaignName || '',
      activeSendingAccount: ws.activeSendingAccount || ws.sendingAccounts?.[0] || '',
      sendingAccounts: (ws.sendingAccounts || []).join(', '),
      totalLeads: leads.length,
      sentCount,
      interestedCount,
      tabName: getWorkspaceTabName(ws),
      updatedAt: ws.updatedAt || new Date().toISOString()
    };
  });

  try {
    const res = await sendSheetsRequest({
      action: 'sync_workspaces_meta',
      workspaces: metaList
    }, 15000);
    return res;
  } catch (err) {
    console.warn('[GoogleSheetSync] Meta sync failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Synchronize full workspace (full lead roster + tab creation)
 */
export async function syncFullWorkspaceToGoogleSheet(workspace) {
  if (!workspace || !isGoogleSheetsConfigured()) {
    return { success: false, reason: 'unconfigured' };
  }

  const tabName = getWorkspaceTabName(workspace);
  const leads = workspace.leads || [];

  const payload = {
    action: 'sync_workspace_leads',
    workspaceId: workspace.id,
    tabName,
    leads,
    fullSync: true
  };

  try {
    const res = await sendSheetsRequest(payload, 25000);
    if (res && res.success) {
      setLastSheetsSyncTime();
      return { success: true, count: leads.length, tabName };
    }
    throw new Error(res?.error || 'Full workspace sync rejected');
  } catch (err) {
    console.warn(`[GoogleSheetSync] Full sync for ${workspace.name} failed:`, err.message);
    addPendingSyncItem({
      type: 'full_workspace',
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      leadCount: leads.length,
      description: `Full sync failed for ${workspace.name}: ${err.message}`
    });
    return { success: false, error: err.message };
  }
}

/**
 * Master 1-Click Push: Synchronize all workspaces, tabs, metadata, and auth credentials
 */
export async function pushAllToGoogleSheet(workspaces = [], warriors = [], onProgress = null) {
  if (!isGoogleSheetsConfigured()) {
    return { success: false, message: 'Google Sheets Web App URL is not configured.' };
  }

  try {
    if (onProgress) onProgress('Syncing credentials & metadata...');
    await syncAuthCredentialsToGoogleSheet(workspaces, warriors);
    await syncWorkspacesMetaToGoogleSheet(workspaces);

    let totalSyncedLeads = 0;
    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];
      if (onProgress) onProgress(`Syncing ${ws.name} (${i + 1}/${workspaces.length})...`);
      const res = await syncFullWorkspaceToGoogleSheet(ws);
      if (res.success) {
        totalSyncedLeads += ws.leads?.length || 0;
      }
    }

    clearPendingSyncQueue();
    setLastSheetsSyncTime();

    return {
      success: true,
      message: `Successfully synchronized ${workspaces.length} workspaces (${totalSyncedLeads.toLocaleString()} leads) and all credentials to Google Sheets!`
    };
  } catch (err) {
    return {
      success: false,
      message: `Sync failed: ${err.message}`
    };
  }
}

/**
 * Redundant Authentication Verification:
 * Validates username & password against Google Sheets _Auth_Credentials tab.
 * Used automatically when Supabase Cloud is unreachable or fails.
 */
export async function verifyCredentialsWithGoogleSheet(username, password) {
  if (!isGoogleSheetsConfigured()) {
    return { success: false, message: 'Google Sheets backup auth is not configured.' };
  }

  try {
    const res = await sendSheetsRequest({
      action: 'verify_credentials',
      username: (username || '').trim(),
      password: (password || '').trim()
    }, 6000);

    if (res && res.success && res.user) {
      return { success: true, user: res.user };
    }
    return { success: false, message: res?.message || 'Invalid credentials in backup store' };
  } catch (err) {
    return { success: false, message: `Backup auth error: ${err.message}` };
  }
}

/**
 * Redundant Data Read:
 * Pulls leads for a workspace directly from its Google Sheet tab.
 */
export async function fetchWorkspaceLeadsFromGoogleSheet(workspaceId, workspaceName) {
  if (!isGoogleSheetsConfigured()) return null;

  const tabName = getWorkspaceTabName({ name: workspaceName, id: workspaceId });

  try {
    const res = await sendSheetsRequest({
      action: 'get_workspace_leads',
      workspaceId,
      tabName
    }, 12000);

    if (res && res.success && Array.isArray(res.leads)) {
      return res.leads;
    }
    return null;
  } catch (err) {
    console.warn(`[GoogleSheetFailover] Failed to read ${tabName}:`, err.message);
    return null;
  }
}

/**
 * Google Apps Script Web App Template
 * Ready to be copied and pasted directly into Google Sheets Script Editor.
 */
export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * ROS CAMPAIGN TRACKING DASHBOARD - MASTER GOOGLE APPS SCRIPT WEB APP ENGINE
 * Dual-Cloud Live Redundancy, Failover & Authentication Backend
 * ============================================================================
 * 
 * Setup Instructions:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete existing code, paste this entire file, and click Save (disk icon).
 * 4. Click Deploy > New deployment.
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 * 6. Set Description: "ROS Campaign Database Engine"
 * 7. Set "Execute as": "Me"
 * 8. Set "Who has access": "Anyone"
 * 9. Click "Deploy", authorize permissions when prompted, and copy the Web App URL!
 */

const SECRET_TOKEN = "ROS_SHEET_SECRET_2026";

function doGet(e) {
  return jsonResponse({
    success: true,
    status: "ROS Google Sheets Web App Engine is ONLINE",
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Empty request payload" }, 400);
    }

    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET_TOKEN) {
      return jsonResponse({ success: false, error: "Unauthorized: Invalid secret token" }, 401);
    }

    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ------------------------------------------------------------------------
    // 0. Connection Test
    // ------------------------------------------------------------------------
    if (action === "test") {
      return jsonResponse({
        success: true,
        title: ss.getName(),
        sheetsCount: ss.getSheets().length,
        timestamp: new Date().toISOString()
      });
    }

    // ------------------------------------------------------------------------
    // 1. Sync Workspace Leads (Full or Delta Upsert)
    // ------------------------------------------------------------------------
    if (action === "sync_workspace_leads") {
      const workspaceId = body.workspaceId || "ws_default";
      const tabName = body.tabName || ("WS_" + workspaceId);
      const leads = body.leads || [];
      const activity = body.activity || null;
      const fullSync = !!body.fullSync;

      let sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        sheet = ss.insertSheet(tabName);
      }

      const headers = [
        "id", "email", "firstName", "companyName", "city",
        "campaignName", "status", "stage", "email1", "email2",
        "email3", "replyDate", "dealValue", "isDNC", "accountName", "updatedAt"
      ];

      // Format header row
      if (sheet.getLastRow() === 0 || fullSync) {
        if (fullSync) sheet.clear();
        sheet.appendRow(headers);
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight("bold")
                   .setBackground("#001B3A")
                   .setFontColor("#00E5A0")
                   .setHorizontalAlignment("center");
        sheet.setFrozenRows(1);
      }

      if (leads.length > 0) {
        if (fullSync) {
          // Fast Bulk Write
          const rows = leads.map(l => [
            String(l.id || ""),
            String(l.email || ""),
            String(l.firstName || ""),
            String(l.companyName || ""),
            String(l.city || ""),
            String(l.campaignName || ""),
            String(l.status || "pending"),
            String(l.stage || ""),
            String(l.email1 || ""),
            String(l.email2 || ""),
            String(l.email3 || ""),
            String(l.replyDate || ""),
            Number(l.dealValue || 0),
            l.isDNC ? "TRUE" : "FALSE",
            String(l.accountName || ""),
            String(l.updatedAt || new Date().toISOString())
          ]);
          sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        } else {
          // Fast Delta Upsert
          const lastRow = sheet.getLastRow();
          const idToRow = {};
          if (lastRow > 1) {
            const idColValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
            for (let i = 0; i < idColValues.length; i++) {
              if (idColValues[i][0]) {
                idToRow[String(idColValues[i][0])] = i + 2; // 1-indexed sheet row
              }
            }
          }

          const rowsToAppend = [];
          leads.forEach(l => {
            const rowData = [
              String(l.id || ""),
              String(l.email || ""),
              String(l.firstName || ""),
              String(l.companyName || ""),
              String(l.city || ""),
              String(l.campaignName || ""),
              String(l.status || "pending"),
              String(l.stage || ""),
              String(l.email1 || ""),
              String(l.email2 || ""),
              String(l.email3 || ""),
              String(l.replyDate || ""),
              Number(l.dealValue || 0),
              l.isDNC ? "TRUE" : "FALSE",
              String(l.accountName || ""),
              String(l.updatedAt || new Date().toISOString())
            ];

            const existingRow = idToRow[String(l.id)];
            if (existingRow) {
              sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
            } else {
              rowsToAppend.push(rowData);
            }
          });

          if (rowsToAppend.length > 0) {
            sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
          }
        }
      }

      // Record Activity Log
      if (activity) {
        logActivity(ss, workspaceId, activity);
      }

      return jsonResponse({ success: true, count: leads.length, tabName });
    }

    // ------------------------------------------------------------------------
    // 2. Sync Auth Credentials
    // ------------------------------------------------------------------------
    if (action === "sync_auth_credentials") {
      const credentials = body.credentials || [];
      let sheet = ss.getSheetByName("_Auth_Credentials") || ss.insertSheet("_Auth_Credentials");
      sheet.clear();

      const headers = ["workspace_id", "role", "username", "password", "name", "email", "allowed_workspaces", "status", "updated_at"];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
           .setFontWeight("bold")
           .setBackground("#0A0A0A")
           .setFontColor("#00C2FF");
      sheet.setFrozenRows(1);

      if (credentials.length > 0) {
        const rows = credentials.map(c => [
          String(c.workspaceId || ""),
          String(c.role || ""),
          String(c.username || ""),
          String(c.password || ""),
          String(c.name || ""),
          String(c.email || ""),
          String(c.allowedWorkspaces || ""),
          String(c.status || "active"),
          new Date().toISOString()
        ]);
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      return jsonResponse({ success: true, count: credentials.length });
    }

    // ------------------------------------------------------------------------
    // 3. Sync Workspaces Metadata
    // ------------------------------------------------------------------------
    if (action === "sync_workspaces_meta") {
      const workspaces = body.workspaces || [];
      let sheet = ss.getSheetByName("_Workspaces_Meta") || ss.insertSheet("_Workspaces_Meta");
      sheet.clear();

      const headers = ["id", "name", "client_name", "campaign_name", "active_account", "sending_accounts", "total_leads", "sent_count", "interested_count", "tab_name", "updated_at"];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
           .setFontWeight("bold")
           .setBackground("#001B3A")
           .setFontColor("#00E5A0");
      sheet.setFrozenRows(1);

      if (workspaces.length > 0) {
        const rows = workspaces.map(w => [
          String(w.id || ""),
          String(w.name || ""),
          String(w.clientName || ""),
          String(w.campaignName || ""),
          String(w.activeSendingAccount || ""),
          String(w.sendingAccounts || ""),
          Number(w.totalLeads || 0),
          Number(w.sentCount || 0),
          Number(w.interestedCount || 0),
          String(w.tabName || ""),
          String(w.updatedAt || new Date().toISOString())
        ]);
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      return jsonResponse({ success: true, count: workspaces.length });
    }

    // ------------------------------------------------------------------------
    // 4. Verify Credentials (Redundant Auth Failover)
    // ------------------------------------------------------------------------
    if (action === "verify_credentials") {
      const username = (body.username || "").trim().toLowerCase();
      const password = (body.password || "").trim();

      const sheet = ss.getSheetByName("_Auth_Credentials");
      if (!sheet || sheet.getLastRow() < 2) {
        return jsonResponse({ success: false, error: "Credentials database empty or missing" });
      }

      const data = sheet.getDataRange().getValues();
      for (let r = 1; r < data.length; r++) {
        const [wsId, role, u, p, name, email, allowed, status] = data[r];
        const uClean = String(u || "").trim().toLowerCase();
        const pClean = String(p || "").trim();

        if ((uClean === username || String(email || "").trim().toLowerCase() === username) && pClean === password) {
          return jsonResponse({
            success: true,
            user: {
              workspaceId: wsId,
              role: role,
              username: u,
              name: name,
              email: email,
              allowedWorkspaceIds: String(allowed || "").split(",").map(s => s.trim()).filter(Boolean),
              status: status
            }
          });
        }
      }

      return jsonResponse({ success: false, error: "Invalid username or password" });
    }

    // ------------------------------------------------------------------------
    // 5. Read Workspace Leads (Failover Data Store)
    // ------------------------------------------------------------------------
    if (action === "get_workspace_leads") {
      const tabName = body.tabName;
      const sheet = ss.getSheetByName(tabName);
      if (!sheet || sheet.getLastRow() < 2) {
        return jsonResponse({ success: true, leads: [] });
      }

      const values = sheet.getDataRange().getValues();
      const headers = values[0];
      const leads = [];

      for (let r = 1; r < values.length; r++) {
        const row = values[r];
        const lead = {};
        for (let c = 0; c < headers.length; c++) {
          lead[headers[c]] = row[c];
        }
        lead.isDNC = lead.isDNC === "TRUE" || lead.isDNC === true;
        leads.push(lead);
      }

      return jsonResponse({ success: true, leads });
    }

    return jsonResponse({ success: false, error: "Unknown action" }, 400);

  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

function logActivity(ss, workspaceId, act) {
  try {
    let sheet = ss.getSheetByName("_Activity_Log") || ss.insertSheet("_Activity_Log");
    if (sheet.getLastRow() === 0) {
      const headers = ["activity_id", "workspace_id", "type", "count", "sequence", "account", "description", "timestamp"];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    sheet.appendRow([
      String(act.id || ("act_" + Date.now())),
      String(workspaceId || ""),
      String(act.type || "batch_sent"),
      Number(act.count || 0),
      String(act.sequence || ""),
      String(act.account || ""),
      String(act.description || ""),
      String(act.timestamp || new Date().toISOString())
    ]);
  } catch (e) {
    // Non-fatal logging error
  }
}

function jsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
