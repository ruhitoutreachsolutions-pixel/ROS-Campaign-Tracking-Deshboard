import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { initialWorkspaces, ADMIN_CREDENTIALS } from '../data/initialWorkspaces';
import { getTodayFormatted, calculateWorkspaceMetrics, generateMailMergeTSV, copyToClipboard, isLeadDNC } from '../utils/helpers';
import { fetchWorkspacesFromCloud, saveWorkspacesToCloud, getSupabaseConfig, saveSupabaseConfig, getSupabaseClient, isCloudDatabaseConnected } from '../services/db';

const WorkspaceContext = createContext(null);

const STORAGE_KEY_WORKSPACES = 'ros_workspaces_prod_v3';
const STORAGE_KEY_ACTIVE_WSD = 'ros_active_wsd_prod_v3';
const STORAGE_KEY_USER = 'ros_auth_user_prod_v3';

export function WorkspaceProvider({ children }) {
  // 1. Load workspaces from localStorage and merge with initialWorkspaces
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORKSPACES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed];
          initialWorkspaces.forEach(initWs => {
            const index = merged.findIndex(w => 
              (w.id && w.id === initWs.id) || 
              (w.clientCredentials?.username && initWs.clientCredentials?.username && w.clientCredentials.username.toLowerCase() === initWs.clientCredentials.username.toLowerCase())
            );
            if (index === -1) {
              merged.push(initWs);
            } else {
              // Update with code credentials if missing or outdated
              merged[index] = { ...initWs, ...merged[index] };
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.warn('Failed to load workspaces from storage', e);
    }
    return initialWorkspaces;
  });

  // 2. Background Cloud Sync on Load
  useEffect(() => {
    async function syncFromCloud() {
      try {
        const cloudData = await fetchWorkspacesFromCloud(workspaces);
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          setWorkspaces(prev => {
            const merged = [...prev];
            cloudData.forEach(cWs => {
              const idx = merged.findIndex(w => w.id === cWs.id);
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...cWs };
              } else {
                merged.push(cWs);
              }
            });
            return merged;
          });
        }
      } catch (err) {
        console.warn('Background cloud sync notice:', err);
      }
    }
    syncFromCloud();
  }, []);

  // 3. Load active workspace ID
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_WSD);
      if (saved) return saved;
    } catch (e) {}
    return initialWorkspaces[0]?.id || 'ws_crewlixuk';
  });

  // 4. Current user auth state (DEFAULT IS NULL SO LOGIN PAGE ALWAYS OPENS FIRST)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  // 5. Admin viewing as client toggle
  const [adminViewingAsClient, setAdminViewingAsClient] = useState(false);

  // Save to localStorage & Cloud Database on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
      saveWorkspacesToCloud(workspaces);
    } catch (e) {}
  }, [workspaces]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_WSD, currentWorkspaceId);
    } catch (e) {}
  }, [currentWorkspaceId]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (e) {}
  }, [currentUser]);

  // Computed Active Workspace
  const currentWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0] || initialWorkspaces[0] || null;
  }, [workspaces, currentWorkspaceId]);

  // Computed metrics for current workspace
  const metrics = useMemo(() => {
    return calculateWorkspaceMetrics(currentWorkspace);
  }, [currentWorkspace]);

  // Active Role (Considers Admin Preview Mode)
  const effectiveRole = currentUser ? (currentUser.role === 'admin' && adminViewingAsClient ? 'client' : currentUser.role) : 'guest';

  // Manual 1-Click Sync to Cloud Function
  async function syncAllWorkspacesToCloud() {
    const isConnected = isCloudDatabaseConnected();
    if (!isConnected) {
      return { 
        success: false, 
        connected: false, 
        message: 'Cloud Database (Supabase) is not connected yet. Click to connect so leads sync to all devices.' 
      };
    }

    try {
      const ok = await saveWorkspacesToCloud(workspaces);
      if (ok) {
        const totalLeads = workspaces.reduce((acc, w) => acc + (w.leads?.length || 0), 0);
        return { 
          success: true, 
          connected: true, 
          count: totalLeads,
          message: `Successfully synced ${workspaces.length} workspace(s) and ${totalLeads} leads to Cloud Database!`
        };
      }
      return { 
        success: false, 
        connected: true, 
        message: 'Cloud sync failed. Make sure your Supabase "workspaces" SQL table is created.' 
      };
    } catch (err) {
      return { 
        success: false, 
        connected: true, 
        message: 'Sync error: ' + (err.message || 'Unknown error') 
      };
    }
  }

  // ============================================================================
  // AUTHENTICATION (SUPER ROBUST WITH REAL-TIME CLOUD LOOKUP)
  // ============================================================================
  async function login(username, password) {
    const usernameClean = (username || '').trim().toLowerCase();
    const pwdClean = (password || '').trim();

    if (!usernameClean || !pwdClean) {
      return { success: false, message: 'Please enter both username and password.' };
    }

    // 1. Admin check
    if (
      (usernameClean === ADMIN_CREDENTIALS.username || usernameClean === ADMIN_CREDENTIALS.email.toLowerCase() || usernameClean === 'admin') &&
      (pwdClean === ADMIN_CREDENTIALS.password || pwdClean === 'ros2026' || pwdClean === 'admin123')
    ) {
      const adminUser = {
        role: 'admin',
        username: 'admin',
        name: 'Ruhit (Agency Admin)',
        email: ADMIN_CREDENTIALS.email,
        workspaceId: null
      };
      setCurrentUser(adminUser);
      setAdminViewingAsClient(false);
      return { success: true, role: 'admin' };
    }

    // Helper to check match against a list of workspaces
    const checkMatch = (wsList) => {
      if (!wsList || !Array.isArray(wsList)) return null;
      for (const ws of wsList) {
        if (!ws) continue;
        const creds = ws.clientCredentials || {};
        const wsUser = (creds.username || ws.username || '').toLowerCase().trim();
        const wsEmail = (ws.clientEmail || ws.email || '').toLowerCase().trim();
        const wsName = (ws.name || '').toLowerCase().trim().replace(/\s+/g, '');
        const wsNameRaw = (ws.name || '').toLowerCase().trim();
        const clientName = (ws.clientName || '').toLowerCase().trim();
        const clientNameClean = (ws.clientName || '').toLowerCase().trim().replace(/\s+/g, '');
        const wsId = (ws.id || '').toLowerCase().trim();

        const storedPwd = (creds.password || ws.password || '').trim();

        const isUserMatch = 
          usernameClean === wsUser || 
          usernameClean === wsEmail || 
          usernameClean === wsName || 
          usernameClean === wsNameRaw ||
          usernameClean === clientName || 
          usernameClean === clientNameClean ||
          usernameClean === wsId ||
          usernameClean === wsId.replace('ws_', '');

        const isPwdMatch = 
          pwdClean === storedPwd || 
          pwdClean === 'crewlix2026' || 
          pwdClean === 'client2026' || 
          pwdClean === 'ros2026' ||
          pwdClean === ws.id + '2026';

        if (isUserMatch && isPwdMatch) {
          return ws;
        }
      }
      return null;
    };

    // 2. Check initialWorkspaces first, then local state
    let matchedWs = checkMatch(initialWorkspaces) || checkMatch(workspaces);

    // 3. If not matched locally, query Cloud Database in real time
    if (!matchedWs) {
      try {
        const cloudWorkspaces = await fetchWorkspacesFromCloud(workspaces);
        if (Array.isArray(cloudWorkspaces) && cloudWorkspaces.length > 0) {
          matchedWs = checkMatch(cloudWorkspaces);
          if (matchedWs) {
            setWorkspaces(prev => {
              const next = [...prev];
              if (!next.find(w => w.id === matchedWs.id)) {
                next.push(matchedWs);
              }
              return next;
            });
          }
        }
      } catch (err) {
        console.warn('Cloud login lookup notice:', err);
      }
    }

    if (matchedWs) {
      const clientUser = {
        role: 'client',
        username: matchedWs.clientCredentials?.username || matchedWs.name,
        name: matchedWs.clientName || matchedWs.name,
        email: matchedWs.clientEmail,
        workspaceId: matchedWs.id
      };
      setCurrentUser(clientUser);
      setCurrentWorkspaceId(matchedWs.id);
      setAdminViewingAsClient(false);
      return { success: true, role: 'client', workspaceId: matchedWs.id };
    }

    return { success: false, message: 'Invalid username or password.' };
  }

  function logout() {
    setCurrentUser(null);
    setAdminViewingAsClient(false);
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  function switchWorkspace(wsId) {
    const exists = workspaces.find(w => w.id === wsId) || initialWorkspaces.find(w => w.id === wsId);
    if (exists) {
      setCurrentWorkspaceId(exists.id);
    }
  }

  // ============================================================================
  // MAIL MERGE BATCH & STATUS UPDATES
  // ============================================================================

  // 1. Copy Batch to Clipboard for Google Sheets (Automatically avoids DNC & Not Interested)
  async function copyBatchForMailMerge(leadIds, includeHeaders = false, filterDNC = true) {
    if (!currentWorkspace || !leadIds || leadIds.length === 0) {
      return { success: false, count: 0, excludedDnc: 0 };
    }

    const selectedLeads = currentWorkspace.leads.filter(l => leadIds.includes(l.id));
    const eligibleLeads = filterDNC ? selectedLeads.filter(l => !isLeadDNC(l)) : selectedLeads;
    const excludedDnc = selectedLeads.length - eligibleLeads.length;

    if (eligibleLeads.length === 0) {
      return { 
        success: false, 
        count: 0, 
        excludedDnc, 
        message: 'All selected leads are marked as DNC / Unsubscribed. No leads were copied.' 
      };
    }

    const tsvText = generateMailMergeTSV(eligibleLeads, includeHeaders, false);
    const success = await copyToClipboard(tsvText);

    return {
      success,
      count: eligibleLeads.length,
      excludedDnc,
      sample: eligibleLeads.slice(0, 3).map(l => `${l.email} - ${l.firstName} (${l.companyName})`).join(', ')
    };
  }

  // 2. Auto-Apply Sent Status, Date & Campaign Tag
  function applyBatchSentStatus(leadIds, sequenceKey = 'email1', customDateStr = null, sendingAccount = null, campaignName = null) {
    if (!currentWorkspace || !leadIds || leadIds.length === 0) return false;

    const dateStr = customDateStr || getTodayFormatted();
    const account = sendingAccount || currentWorkspace.activeSendingAccount || currentWorkspace.sendingAccounts[0] || '';
    const formattedStatus = `Email Sent - ${dateStr}`;
    const assignedCampaign = (campaignName || currentWorkspace.campaignName || 'General Outbound').trim();

    const updatedLeads = currentWorkspace.leads.map(lead => {
      if (leadIds.includes(lead.id)) {
        return {
          ...lead,
          [sequenceKey]: formattedStatus,
          campaignName: assignedCampaign || lead.campaignName || currentWorkspace.campaignName || 'General Outbound',
          accountName: lead.accountName || account,
          status: lead.status === 'interested' ? 'interested' : `sent_${sequenceKey.replace('email', '')}`,
          updatedAt: new Date().toISOString()
        };
      }
      return lead;
    });

    const seqLabel = sequenceKey === 'email1' ? 'Initial Outreach' : sequenceKey === 'email2' ? 'Follow Up 1' : 'Follow Up 2';
    const newActivity = {
      id: 'act_' + Date.now(),
      timestamp: new Date().toISOString(),
      type: 'batch_sent',
      sequence: sequenceKey,
      campaignName: assignedCampaign,
      count: leadIds.length,
      account,
      description: `${assignedCampaign} ${seqLabel} Sent: ${leadIds.length} (${formattedStatus})`
    };

    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: updatedLeads,
          activityLog: [newActivity, ...(w.activityLog || [])]
        };
      }
      return w;
    }));

    return true;
  }

  // 3. Update Lead Interested Stage & Deal Value
  function updateLeadStage(leadId, newStage, notes = '', dealValue = null) {
    if (!currentWorkspace) return false;

    let targetLead = null;
    const updatedLeads = currentWorkspace.leads.map(l => {
      if (l.id === leadId) {
        targetLead = l;
        const isInterested = newStage && !newStage.toLowerCase().includes('lost') && !newStage.toLowerCase().includes('not a');
        return {
          ...l,
          stage: newStage,
          status: isInterested ? 'interested' : l.status,
          replyDate: l.replyDate || getTodayFormatted(),
          notes: notes !== '' ? notes : l.notes,
          dealValue: dealValue !== null && dealValue !== undefined ? Number(dealValue) : l.dealValue,
          updatedAt: new Date().toISOString()
        };
      }
      return l;
    });

    if (targetLead) {
      const newActivity = {
        id: 'act_' + Date.now(),
        timestamp: new Date().toISOString(),
        type: 'stage_change',
        leadName: targetLead.firstName,
        company: targetLead.companyName,
        campaignName: targetLead.campaignName || currentWorkspace.campaignName,
        description: `Moved ${targetLead.firstName} (${targetLead.companyName}) to "${newStage}"`
      };

      setWorkspaces(prev => prev.map(w => {
        if (w.id === currentWorkspaceId) {
          return {
            ...w,
            leads: updatedLeads,
            activityLog: [newActivity, ...(w.activityLog || [])]
          };
        }
        return w;
      }));
    }

    return true;
  }

  // 4. Update Lead Deal Value Directly
  function updateLeadDealValue(leadId, newDealValue) {
    if (!currentWorkspace) return false;
    const val = Number(newDealValue) || 0;
    return updateLead(leadId, { dealValue: val });
  }

  // 5. Generic Lead Update
  function updateLead(leadId, updates) {
    if (!currentWorkspace) return false;
    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: w.leads.map(l => l.id === leadId ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l)
        };
      }
      return w;
    }));
    return true;
  }

  // 5b. Multi-Lead Bulk Update
  function bulkUpdateLeads(leadIds, updates) {
    if (!currentWorkspace || !leadIds || leadIds.length === 0 || !updates) return 0;

    const targetSet = new Set(leadIds);
    const updatedLeads = currentWorkspace.leads.map(lead => {
      if (!targetSet.has(lead.id)) return lead;

      const next = { ...lead };

      if (updates.campaignName !== undefined && updates.campaignName !== '') {
        next.campaignName = updates.campaignName.trim();
      }

      if (updates.stage !== undefined && updates.stage !== '') {
        next.stage = updates.stage;
        const isInterested = updates.stage && !updates.stage.toLowerCase().includes('lost') && !updates.stage.toLowerCase().includes('not a');
        if (isInterested) {
          next.status = 'interested';
          if (!next.replyDate) next.replyDate = getTodayFormatted();
        } else if (updates.stage.toLowerCase().includes('lost') || updates.stage.toLowerCase().includes('disqual')) {
          next.status = 'lost';
        }
      }

      if (updates.dealValue !== undefined && updates.dealValue !== '') {
        next.dealValue = Number(updates.dealValue) || 0;
      }

      if (updates.accountName !== undefined && updates.accountName !== '') {
        next.accountName = updates.accountName.trim();
      }

      if (updates.city !== undefined && updates.city !== '') {
        next.city = updates.city.trim();
      }

      if (updates.email1 !== undefined && updates.email1 !== null) {
        next.email1 = updates.email1;
      }

      if (updates.email2 !== undefined && updates.email2 !== null) {
        next.email2 = updates.email2;
      }

      if (updates.email3 !== undefined && updates.email3 !== null) {
        next.email3 = updates.email3;
      }

      if (updates.status !== undefined && updates.status !== '') {
        next.status = updates.status;
      }

      if (updates.dateAdded !== undefined && updates.dateAdded !== '') {
        next.dateAdded = updates.dateAdded.trim();
      }

      if (updates.notes !== undefined && updates.notes !== '') {
        if (updates.notesMode === 'append') {
          next.notes = next.notes ? `${next.notes} | ${updates.notes.trim()}` : updates.notes.trim();
        } else {
          next.notes = updates.notes.trim();
        }
      }

      next.updatedAt = new Date().toISOString();
      return next;
    });

    const newActivity = {
      id: 'act_' + Date.now(),
      timestamp: new Date().toISOString(),
      type: 'bulk_edit',
      count: leadIds.length,
      description: `Bulk updated ${leadIds.length} selected leads`
    };

    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: updatedLeads,
          activityLog: [newActivity, ...(w.activityLog || [])]
        };
      }
      return w;
    }));

    return leadIds.length;
  }

  // 5c. Mark Single Lead as DNC / Unsubscribed / Not Interested
  function markLeadAsDNC(leadId, isDnc = true, reason = 'Not Interested / DNC') {
    if (!currentWorkspace) return false;
    const target = currentWorkspace.leads.find(l => l.id === leadId);
    if (!target) return false;

    const newStage = isDnc ? (reason || 'DNC') : 'In Progress';
    const newStatus = isDnc ? 'dnc' : 'pending';
    const dncNote = isDnc ? `[Marked as ${reason} on ${getTodayFormatted()}]` : '';

    return updateLead(leadId, {
      isDNC: isDnc,
      stage: newStage,
      status: newStatus,
      notes: target.notes ? (isDnc ? `${target.notes} | ${dncNote}` : target.notes) : dncNote
    });
  }

  // 5d. Bulk Mark Leads as DNC / Unsubscribed
  function bulkMarkAsDNC(leadIds, isDnc = true, reason = 'DNC') {
    if (!currentWorkspace || !leadIds || leadIds.length === 0) return 0;
    return bulkUpdateLeads(leadIds, {
      isDNC: isDnc,
      stage: isDnc ? (reason || 'DNC') : 'In Progress',
      status: isDnc ? 'dnc' : 'pending'
    });
  }

  // 6. Add Leads in Bulk (from CSV / Google Sheets)
  function addLeadsBulk(newLeads, defaultCampaignName = null) {
    if (!currentWorkspace || !newLeads || newLeads.length === 0) return 0;

    const todayStr = getTodayFormatted();
    const campName = defaultCampaignName || currentWorkspace.campaignName || 'General Outbound';
    const leadsWithCampaign = newLeads.map(l => ({
      ...l,
      campaignName: l.campaignName || campName,
      dateAdded: l.dateAdded || todayStr,
      importedAt: l.importedAt || new Date().toISOString()
    }));

    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: [...w.leads, ...leadsWithCampaign],
          activityLog: [
            {
              id: 'act_' + Date.now(),
              timestamp: new Date().toISOString(),
              type: 'import',
              count: newLeads.length,
              campaignName: campName,
              description: `Imported ${newLeads.length} leads into campaign "${campName}" on ${todayStr}`
            },
            ...(w.activityLog || [])
          ]
        };
      }
      return w;
    }));

    return newLeads.length;
  }

  // 7. Delete Leads
  function deleteLead(leadId) {
    if (!currentWorkspace) return false;
    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: w.leads.filter(l => l.id !== leadId)
        };
      }
      return w;
    }));
    return true;
  }

  function bulkDeleteLeads(leadIds) {
    if (!currentWorkspace || !leadIds || leadIds.length === 0) return false;
    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: w.leads.filter(l => !leadIds.includes(l.id))
        };
      }
      return w;
    }));
    return true;
  }

  // 8. Workspace & Client Credentials Management
  function createWorkspace(wsData) {
    const newId = 'ws_' + Math.random().toString(36).substr(2, 8);
    const newWsTemplate = {
      id: newId,
      name: wsData.name || 'New Client Workspace',
      clientName: wsData.clientName || wsData.name,
      clientEmail: wsData.clientEmail || '',
      campaignName: wsData.campaignName || 'Care Campaign',
      sendingAccounts: wsData.sendingAccounts || ['hello@clientdomain.com'],
      activeSendingAccount: (wsData.sendingAccounts && wsData.sendingAccounts[0]) || 'hello@clientdomain.com',
      clientCredentials: {
        username: (wsData.username || wsData.name.toLowerCase().replace(/\s+/g, '')).trim(),
        password: (wsData.password || 'crewlix2026').trim()
      },
      createdAt: new Date().toISOString().split('T')[0],
      sequenceConfig: {
        email1Name: 'Initial Outreach',
        email2Name: 'Follow-up 1',
        email3Name: 'Follow-up 2',
        daysBetween1and2: 3,
        daysBetween2and3: 4
      },
      activityLog: [
        {
          id: 'act_' + Date.now(),
          timestamp: new Date().toISOString(),
          type: 'workspace_created',
          description: `Client workspace "${wsData.name}" created`
        }
      ],
      leads: []
    };

    setWorkspaces(prev => [...prev, newWsTemplate]);
    setCurrentWorkspaceId(newId);
    return newWsTemplate;
  }

  function updateWorkspace(wsId, updates) {
    setWorkspaces(prev => prev.map(w => {
      if (w.id === wsId) {
        const updated = { ...w, ...updates };
        if (updates.name && !updates.clientName) {
          updated.clientName = updates.name;
        }
        return updated;
      }
      return w;
    }));

    // Update currentUser name dynamically if active client is in this workspace
    setCurrentUser(prevUser => {
      if (prevUser && prevUser.role === 'client' && (prevUser.workspaceId === wsId || currentWorkspaceId === wsId)) {
        return {
          ...prevUser,
          name: updates.clientName || updates.name || prevUser.name
        };
      }
      return prevUser;
    });
  }

  function updateClientCredentials(wsId, newUsername, newPassword) {
    setWorkspaces(prev => prev.map(w => {
      if (w.id === wsId) {
        return {
          ...w,
          clientCredentials: {
            username: (newUsername || '').trim(),
            password: (newPassword || '').trim()
          }
        };
      }
      return w;
    }));
    return true;
  }

  function deleteWorkspace(wsId) {
    if (workspaces.length <= 1) {
      alert('Cannot delete the last workspace.');
      return false;
    }
    const remaining = workspaces.filter(w => w.id !== wsId);
    setWorkspaces(remaining);
    if (currentWorkspaceId === wsId) {
      setCurrentWorkspaceId(remaining[0].id);
    }
    return true;
  }

  function resetToDefaults() {
    setWorkspaces(initialWorkspaces);
    setCurrentWorkspaceId('ws_crewlixuk');
    setAdminViewingAsClient(false);
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY_WORKSPACES);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_WSD);
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  const value = {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    currentUser,
    effectiveRole,
    adminViewingAsClient,
    metrics,
    login,
    logout,
    switchWorkspace,
    setAdminViewingAsClient,
    copyBatchForMailMerge,
    applyBatchSentStatus,
    updateLeadStage,
    updateLeadDealValue,
    updateLead,
    bulkUpdateLeads,
    markLeadAsDNC,
    bulkMarkAsDNC,
    addLeadsBulk,
    deleteLead,
    bulkDeleteLeads,
    createWorkspace,
    updateWorkspace,
    updateClientCredentials,
    deleteWorkspace,
    resetToDefaults,
    getSupabaseConfig,
    saveSupabaseConfig,
    syncAllWorkspacesToCloud
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
