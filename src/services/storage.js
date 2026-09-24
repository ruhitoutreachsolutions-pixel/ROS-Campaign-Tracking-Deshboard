// ROBUST LOCAL DATABASE (INDEXEDDB + LOCALSTORAGE FALLBACK)
// Overcomes the 5MB browser localStorage limit for handling 50k+ leads smoothly

const DB_NAME = 'ros_campaign_db';
const DB_VERSION = 1;
const STORE_NAME = 'workspaces_store';
const BACKUP_KEY = 'ros_workspaces_prod_v3';
const BACKUP_SNAPSHOT_KEY = 'ros_workspaces_snapshot_v1';

import cgeAuthoritative3804 from '../data/cgeAuthoritative3804.json';
import crewlixAuthoritative20113 from '../data/crewlixAuthoritative20113.json';

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

// Historical deleted campaigns that must never be merged or resurrected from stale local caches
export const PERMANENTLY_PURGED_CAMPAIGNS = {
  'ws_zrnl1fjb': new Set([
    'Banqueting-halls-UK-Campaign-2',
    'Banqueting-halls-UK-Campaign-3',
    'Banqueting-halls-UK-Campaign-4',
    'Cold Outreach Campaign (HTML Email Design)'
  ])
};

export function sanitizeLeadForWorkspace(lead, workspaceId) {
  if (!lead) return null;
  const wsId = workspaceId || lead.workspaceId;

  // STRICT PURGE & SANITIZATION FOR CGE UK LTD (ws_zrnl1fjb) ONLY
  if (wsId === 'ws_zrnl1fjb') {
    const camp = (lead.campaignName || '').trim();

    // 1. Only BNQ Google Maps, BNQ UK October List 1, and Banqueting-halls-UK-Campaign-1 are allowed
    if (camp !== 'BNQ Google Maps' && camp !== 'BNQ UK October List 1' && camp !== 'Banqueting-halls-UK-Campaign-1') {
      return null;
    }

    // 2. Banqueting-halls-UK-Campaign-1: ONLY the 10 interested leads
    if (camp === 'Banqueting-halls-UK-Campaign-1') {
      const s = String(lead.stage || '') + ' ' + String(lead.status || '');
      if (!s.toLowerCase().includes('interest')) return null;
      return {
        ...lead,
        email1: '',
        email2: '',
        email3: '',
        status: 'interested',
        stage: 'Interested'
      };
    }

    // 3. Active Campaigns (BNQ UK October List 1, BNQ Google Maps, etc.):
    // Preserve all lead information, including dispatched emails across any dates (23/09/26, 25/09/26, etc.)
    return lead;
  }

  // ALL OTHER WORKSPACES: Return lead completely untouched!
  return lead;
}

export function isLeadPermanentlyPurged(lead, workspaceId) {
  if (!lead) return true;
  return sanitizeLeadForWorkspace(lead, workspaceId) === null;
}

// Save workspaces to IndexedDB & localStorage safely
export async function saveWorkspacesToLocal(workspaces) {
  if (!workspaces || !Array.isArray(workspaces)) return false;

  const sanitized = workspaces.map(w => {
    if (!w || !Array.isArray(w.leads)) return w;
    return {
      ...w,
      leads: w.leads.map(l => sanitizeLeadForWorkspace(l, w.id)).filter(Boolean)
    };
  });

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
        data: sanitized,
        updatedAt: nowIso,
        leadCount: sanitized.reduce((acc, w) => acc + (w.leads?.length || 0), 0)
      });

      // Keep a rolling snapshot backup
      store.put({
        key: 'workspaces_backup',
        data: sanitized,
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
    const serialized = JSON.stringify(sanitized);
    // If under 4.5MB, save full data to localStorage
    if (serialized.length < 4.5 * 1024 * 1024) {
      localStorage.setItem(BACKUP_KEY, serialized);
    } else {
      // Smart quota preservation: Keep 100% of leads for standard workspaces (like CGE with 3,804 leads),
      // and only sample massive archives (>5,000 leads like Crewlix historical) in localStorage!
      const smartWorkspaces = sanitized.map(w => {
        if ((w.leads || []).length > 5000) {
          return {
            ...w,
            leads: (w.leads || []).slice(0, 100),
            isTruncatedForQuota: true
          };
        }
        return w;
      });
      const smartSerialized = JSON.stringify(smartWorkspaces);
      if (smartSerialized.length < 4.5 * 1024 * 1024) {
        localStorage.setItem(BACKUP_KEY, smartSerialized);
      } else {
        const lightWorkspaces = sanitized.map(w => ({
          ...w,
          leads: (w.leads || []).slice(0, 50)
        }));
        localStorage.setItem(BACKUP_KEY, JSON.stringify(lightWorkspaces));
      }
      localStorage.setItem('ros_using_indexeddb', 'true');
    }
  } catch (err) {
    console.warn('localStorage quota warning (IndexedDB handles storage):', err);
  }

  return true;
}

// Load workspaces from IndexedDB (with localStorage and snapshot fallback)
export async function loadWorkspacesFromLocal(fallbackWorkspaces = []) {
  // Helper to filter out any permanently purged leads from local loads
  const cleanLoadedWorkspaces = (list) => {
    if (!Array.isArray(list)) return list;
    return list.map(w => {
      if (!w || !Array.isArray(w.leads)) return w;
      let cleanLeads = w.leads.map(l => sanitizeLeadForWorkspace(l, w.id)).filter(Boolean);
      if (w.id === 'ws_zrnl1fjb') {
        if (cleanLeads.length < 3804 && cgeAuthoritative3804 && Array.isArray(cgeAuthoritative3804.leads)) {
          const idSet = new Set(cleanLeads.map(l => l.id));
          cgeAuthoritative3804.leads.forEach(al => {
            if (!idSet.has(al.id)) {
              cleanLeads.push(al);
              idSet.add(al.id);
            }
          });
        }
      }
      if (w.id === 'ws_crewlixukltd') {
        if (cleanLeads.length < 20113 && crewlixAuthoritative20113 && Array.isArray(crewlixAuthoritative20113.leads)) {
          const idSet = new Set(cleanLeads.map(l => l.id));
          crewlixAuthoritative20113.leads.forEach(al => {
            if (!idSet.has(al.id)) {
              cleanLeads.push(al);
              idSet.add(al.id);
            }
          });
        }
      }
      return {
        ...w,
        leads: cleanLeads
      };
    });
  };

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
        return cleanLoadedWorkspaces(result);
      }

      // Try snapshot in IndexedDB
      const backupReq = store.get('workspaces_backup');
      const backupResult = await new Promise((resolve) => {
        backupReq.onsuccess = () => resolve(backupReq.result ? backupReq.result.data : null);
        backupReq.onerror = () => resolve(null);
      });

      if (Array.isArray(backupResult) && backupResult.length > 0) {
        return cleanLoadedWorkspaces(backupResult);
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
        return cleanLoadedWorkspaces(parsed);
      }
    }
  } catch (err) {
    console.warn('localStorage read error:', err);
  }

  return fallbackWorkspaces;
}

// Smart Lead-Level Merge with Authoritative Cloud Sync & Non-Destructive Reconciliation
export function mergeWorkspaceLeads(localLeads = [], cloudLeads = [], options = {}) {
  const wsId = options.workspaceId || 'ws_zrnl1fjb';
  const deletedSet = new Set(options.deletedLeadIds || []);
  const isValid = (l) => l && (l.id || l.email) && !deletedSet.has(l.id) && !isLeadPermanentlyPurged(l, wsId);

  const validLocal = (Array.isArray(localLeads) ? localLeads : []).filter(isValid);
  const validCloud = (Array.isArray(cloudLeads) ? cloudLeads : []).filter(isValid);

  if (validLocal.length === 0) {
    return validCloud.map(l => sanitizeLeadForWorkspace(l, wsId)).filter(Boolean);
  }
  if (validCloud.length === 0) {
    return validLocal.map(l => sanitizeLeadForWorkspace(l, wsId)).filter(Boolean);
  }

  const leadMap = new Map();

  const isAdvancedStage = (lead) => {
    if (!lead) return false;
    const s = `${lead.stage || ''} ${lead.status || ''}`.toLowerCase();
    return s.includes('interest') || s.includes('book') || s.includes('won') || s.includes('negotiat') || s.includes('proposal') || s.includes('dnc');
  };

  const mergeTwoLeads = (leadA, leadB) => {
    if (!leadA) return leadB;
    if (!leadB) return leadA;

    // For ws_zrnl1fjb: strictly guard against reviving old emails or invalid campaigns
    // For ws_zrnl1fjb: strictly guard against reviving old invalid campaigns or losing interested leads
    if (wsId === 'ws_zrnl1fjb') {
      const camp = (leadB.campaignName || leadA.campaignName || '').trim();
      if (camp === 'Banqueting-halls-UK-Campaign-1') {
        return {
          ...leadA,
          ...leadB,
          email1: '',
          email2: '',
          email3: '',
          status: 'interested',
          stage: 'Interested',
          updatedAt: new Date(Math.max(
            new Date(leadA.updatedAt || 0).getTime(),
            new Date(leadB.updatedAt || 0).getTime(),
            Date.now()
          )).toISOString()
        };
      }
    }

    const timeA = new Date(leadA.updatedAt || leadA.importedAt || 0).getTime();
    const timeB = new Date(leadB.updatedAt || leadB.importedAt || 0).getTime();

    // Email sending progress: always pick the latest sent date/status
    const pickNewestEmail = (valA, valB) => {
      if (valA === valB) return valA || '';
      // If timeA > timeB, leadA is newer and its value is authoritative (even if cleared to '')
      if (timeA > timeB) {
        return valA !== undefined ? (valA || '') : (valB || '');
      }
      // If timeB > timeA, leadB is newer
      if (timeB > timeA) {
        return valB !== undefined ? (valB || '') : (valA || '');
      }
      // If timestamps identical, pick non-empty
      return (valA && valA.trim()) ? valA : (valB || '');
    };

    const email1 = pickNewestEmail(leadA.email1, leadB.email1);
    const email2 = pickNewestEmail(leadA.email2, leadB.email2);
    const email3 = pickNewestEmail(leadA.email3, leadB.email3);

    // Advanced stages: preserve interested, meeting booked, won, dnc
    const aAdv = isAdvancedStage(leadA);
    const bAdv = isAdvancedStage(leadB);

    let stage = leadA.stage || leadB.stage || '';
    let status = leadA.status || leadB.status || 'pending';

    if (bAdv && !aAdv) {
      stage = leadB.stage;
      status = leadB.status;
    } else if (aAdv && !bAdv) {
      stage = leadA.stage;
      status = leadA.status;
    } else {
      if (timeB >= timeA) {
        stage = leadB.stage || leadA.stage;
        status = leadB.status || leadA.status;
      }
    }

    const isDnc = status === 'dnc' || (stage && stage.toLowerCase().includes('dnc'));
    const isInterested = status === 'interested' || (stage && stage.toLowerCase().includes('interest'));
    if (!isDnc && !isInterested) {
      if (email3 && email3.trim()) status = 'sent_3';
      else if (email2 && email2.trim()) status = 'sent_2';
      else if (email1 && email1.trim()) status = 'sent_1';
      else status = 'pending';
    }

    const notes = (leadB.notes && leadB.notes.length >= (leadA.notes?.length || 0))
      ? leadB.notes
      : (leadA.notes || leadB.notes || '');
    const primary = timeB >= timeA ? leadB : leadA;
    const secondary = timeB >= timeA ? leadA : leadB;

    return {
      ...secondary,
      ...primary,
      email1,
      email2,
      email3,
      stage,
      status,
      notes,
      dealValue: primary.dealValue !== undefined ? primary.dealValue : (secondary.dealValue || 0),
      replyDate: primary.replyDate || secondary.replyDate || '',
      updatedAt: new Date(Math.max(timeA, timeB, Date.now())).toISOString()
    };
  };

  // 1. Populate map with local leads by exact unique ID (or fallback to email ONLY if lead has no ID)
  validLocal.forEach(lead => {
    const key = lead.id ? String(lead.id) : (lead.email ? `email:${lead.email.toLowerCase().trim()}` : null);
    if (key) {
      leadMap.set(key, lead);
    }
  });

  // 2. Merge cloud leads non-destructively by exact unique ID (or fallback to email ONLY if lead has no ID)
  validCloud.forEach(cLead => {
    const key = cLead.id ? String(cLead.id) : (cLead.email ? `email:${cLead.email.toLowerCase().trim()}` : `gen_${Math.random()}`);

    if (leadMap.has(key)) {
      const existing = leadMap.get(key);
      leadMap.set(key, mergeTwoLeads(existing, cLead));
    } else {
      leadMap.set(key, cLead);
    }
  });

  const mergedLeads = Array.from(leadMap.values())
    .map(l => sanitizeLeadForWorkspace(l, wsId))
    .filter(Boolean);

  if (wsId === 'ws_zrnl1fjb' && mergedLeads.length < 3804 && cgeAuthoritative3804 && Array.isArray(cgeAuthoritative3804.leads)) {
    const idSet = new Set(mergedLeads.map(l => l.id));
    cgeAuthoritative3804.leads.forEach(al => {
      if (!idSet.has(al.id)) {
        mergedLeads.push(al);
        idSet.add(al.id);
      }
    });
  }

  if (wsId === 'ws_crewlixukltd' && mergedLeads.length < 20113 && crewlixAuthoritative20113 && Array.isArray(crewlixAuthoritative20113.leads)) {
    const idSet = new Set(mergedLeads.map(l => l.id));
    crewlixAuthoritative20113.leads.forEach(al => {
      if (!idSet.has(al.id)) {
        mergedLeads.push(al);
        idSet.add(al.id);
      }
    });
  }

  return mergedLeads;
}

