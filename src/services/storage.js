// ROBUST LOCAL DATABASE (INDEXEDDB + LOCALSTORAGE FALLBACK)
// Overcomes the 5MB browser localStorage limit for handling 50k+ leads smoothly

const DB_NAME = 'ros_campaign_db';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces_store';
const BACKUP_KEY = 'ros_workspaces_prod_v3';
const BACKUP_SNAPSHOT_KEY = 'ros_workspaces_snapshot_v1';

// Open or initialize IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open error:', event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      resolve(null);
    }
  });
}

// Save workspaces to IndexedDB & localStorage safely
export async function saveWorkspacesToLocal(workspaces) {
  if (!workspaces || !Array.isArray(workspaces)) return false;

  const nowIso = new Date().toISOString();
  let idbSuccess = false;

  // 1. Primary Save to IndexedDB (No 5MB limit)
  try {
    const db = await openDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        key: 'workspaces_data',
        data: workspaces,
        updatedAt: nowIso,
        leadCount: workspaces.reduce((acc, w) => acc + (w.leads?.length || 0), 0)
      });

      // Keep a rolling snapshot backup
      store.put({
        key: 'workspaces_backup',
        data: workspaces,
        timestamp: nowIso
      });

      await new Promise((resolve) => {
        tx.oncomplete = () => {
          idbSuccess = true;
          resolve();
        };
        tx.onerror = () => resolve();
      });
    }
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage', err);
  }

  // 2. Secondary Save to localStorage (with quota safety check)
  try {
    const serialized = JSON.stringify(workspaces);
    // If under 4.5MB, save to localStorage
    if (serialized.length < 4.5 * 1024 * 1024) {
      localStorage.setItem(BACKUP_KEY, serialized);
    } else {
      // If large, save lightweight metadata in localStorage
      const lightWorkspaces = workspaces.map(w => ({
        ...w,
        leads: (w.leads || []).slice(0, 50) // only sample in localStorage to prevent quota error
      }));
      localStorage.setItem(BACKUP_KEY, JSON.stringify(lightWorkspaces));
      localStorage.setItem('ros_using_indexeddb', 'true');
    }
  } catch (err) {
    console.warn('localStorage quota warning (IndexedDB handles storage):', err);
  }

  return true;
}

// Load workspaces from IndexedDB (with localStorage and snapshot fallback)
export async function loadWorkspacesFromLocal(fallbackWorkspaces = []) {
  // 1. Try IndexedDB first (most complete and largest capacity)
  try {
    const db = await openDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('workspaces_data');

      const result = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });

      if (Array.isArray(result) && result.length > 0) {
        return result;
      }

      // Try snapshot in IndexedDB
      const backupReq = store.get('workspaces_backup');
      const backupResult = await new Promise((resolve) => {
        backupReq.onsuccess = () => resolve(backupReq.result ? backupReq.result.data : null);
        backupReq.onerror = () => resolve(null);
      });

      if (Array.isArray(backupResult) && backupResult.length > 0) {
        return backupResult;
      }
    }
  } catch (err) {
    console.warn('IndexedDB read error:', err);
  }

  // 2. Try localStorage fallback
  try {
    const saved = localStorage.getItem(BACKUP_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('localStorage read error:', err);
  }

  return fallbackWorkspaces;
}

// Smart Lead-Level Merge with Authoritative Cloud Sync & Tombstones
export function mergeWorkspaceLeads(localLeads = [], cloudLeads = [], options = {}) {
  const deletedSet = new Set(options.deletedLeadIds || []);
  const validLocal = (Array.isArray(localLeads) ? localLeads : []).filter(l => l && l.id && !deletedSet.has(l.id));
  const validCloud = (Array.isArray(cloudLeads) ? cloudLeads : []).filter(l => l && l.id && !deletedSet.has(l.id));

  if (validLocal.length === 0) return validCloud;
  if (validCloud.length === 0) {
    // If cloud has 0 leads and cloudWsUpdatedAt is strictly newer than localWsUpdatedAt,
    // it means leads were deleted/cleared in cloud! Return empty array!
    const localTime = new Date(options.localWsUpdatedAt || 0).getTime();
    const cloudTime = new Date(options.cloudWsUpdatedAt || 0).getTime();
    if (cloudTime > localTime) {
      return [];
    }
    return validLocal;
  }

  const localTime = new Date(options.localWsUpdatedAt || 0).getTime();
  const cloudTime = new Date(options.cloudWsUpdatedAt || 0).getTime();
  const isCloudAuthoritative = cloudTime > localTime;

  const localMap = new Map();
  validLocal.forEach(l => {
    if (l && l.id) localMap.set(l.id, l);
    else if (l && l.email) localMap.set(l.email.toLowerCase().trim(), l);
  });

  const cloudMap = new Map();
  validCloud.forEach(l => {
    if (l && l.id) cloudMap.set(l.id, l);
    else if (l && l.email) cloudMap.set(l.email.toLowerCase().trim(), l);
  });

  const result = [];
  const processedIds = new Set();

  // If cloud is newer/authoritative, iterate over cloud leads as base
  if (isCloudAuthoritative) {
    validCloud.forEach(cLead => {
      processedIds.add(cLead.id);
      const local = localMap.get(cLead.id) || (cLead.email ? localMap.get(cLead.email.toLowerCase().trim()) : null);
      if (!local) {
        result.push(cLead);
      } else {
        // Reconcile status / follow-ups
        const hasLocalE1 = local.email1 && local.email1.trim() !== '';
        const hasLocalE2 = local.email2 && local.email2.trim() !== '';
        const hasLocalE3 = local.email3 && local.email3.trim() !== '';
        const isLocalAdvancedStage = local.stage && (
          local.stage.toLowerCase().includes('book') || 
          local.stage.toLowerCase().includes('interest') || 
          local.stage.toLowerCase().includes('won') || 
          local.stage.toLowerCase().includes('proposal') ||
          local.stage.toLowerCase().includes('negotiat') ||
          local.stage.toLowerCase().includes('dnc')
        );

        const leadLocalTime = new Date(local.updatedAt || local.importedAt || 0).getTime();

        if (leadLocalTime > cloudTime || hasLocalE2 || hasLocalE3 || isLocalAdvancedStage) {
          result.push({
            ...cLead,
            ...local,
            email1: local.email1 || cLead.email1 || '',
            email2: local.email2 || cLead.email2 || '',
            email3: local.email3 || cLead.email3 || '',
            stage: local.stage || cLead.stage || '',
            status: local.status || cLead.status || 'pending',
            dealValue: local.dealValue !== undefined ? local.dealValue : cLead.dealValue || 0,
            notes: local.notes || cLead.notes || ''
          });
        } else {
          result.push({ ...local, ...cLead });
        }
      }
    });

    // Any local lead created strictly after cloudTime is preserved
    validLocal.forEach(local => {
      if (!processedIds.has(local.id)) {
        const leadLocalTime = new Date(local.updatedAt || local.createdAt || local.importedAt || 0).getTime();
        if (leadLocalTime > cloudTime) {
          result.push(local);
        }
        // Otherwise, it was deleted on cloud and is pruned!
      }
    });

    return result;
  }

  // Otherwise local is newer/authoritative:
  validLocal.forEach(local => {
    processedIds.add(local.id);
    const cLead = cloudMap.get(local.id) || (local.email ? cloudMap.get(local.email.toLowerCase().trim()) : null);
    if (!cLead) {
      result.push(local);
    } else {
      const leadLocalTime = new Date(local.updatedAt || local.importedAt || 0).getTime();
      const leadCloudTime = new Date(cLead.updatedAt || cLead.updated_at || cLead.importedAt || 0).getTime();
      if (leadLocalTime >= leadCloudTime) {
        result.push({
          ...cLead,
          ...local,
          email1: local.email1 || cLead.email1 || '',
          email2: local.email2 || cLead.email2 || '',
          email3: local.email3 || cLead.email3 || '',
          stage: local.stage || cLead.stage || '',
          status: local.status || cLead.status || 'pending',
          dealValue: local.dealValue !== undefined ? local.dealValue : cLead.dealValue || 0,
          notes: local.notes || cLead.notes || ''
        });
      } else {
        result.push({ ...local, ...cLead });
      }
    }
  });

  // Add any new leads from cloud that do not exist locally
  validCloud.forEach(cLead => {
    if (!processedIds.has(cLead.id)) {
      result.push(cLead);
    }
  });

  return result;
}
