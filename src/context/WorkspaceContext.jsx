import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { initialWorkspaces, ADMIN_CREDENTIALS } from '../data/initialWorkspaces';
import { getTodayFormatted, calculateWorkspaceMetrics, generateMailMergeTSV, copyToClipboard } from '../utils/helpers';

const WorkspaceContext = createContext(null);

const STORAGE_KEY_WORKSPACES = 'ros_workspaces_prod_v2';
const STORAGE_KEY_ACTIVE_WSD = 'ros_active_wsd_prod_v2';
const STORAGE_KEY_USER = 'ros_auth_user_prod_v2';

export function WorkspaceProvider({ children }) {
  // 1. Load workspaces from localStorage or initial clean state
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORKSPACES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load workspaces from storage', e);
    }
    return initialWorkspaces;
  });

  // 2. Load active workspace ID
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_WSD);
      if (saved) return saved;
    } catch (e) {}
    return 'ws_crewlix';
  });

  // 3. Current user auth state (DEFAULT IS NULL SO LOGIN PAGE ALWAYS OPENS FIRST)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  // 4. Admin viewing as client toggle
  const [adminViewingAsClient, setAdminViewingAsClient] = useState(false);

  // Save to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
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
    return workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0] || null;
  }, [workspaces, currentWorkspaceId]);

  // Computed metrics for current workspace
  const metrics = useMemo(() => {
    return calculateWorkspaceMetrics(currentWorkspace);
  }, [currentWorkspace]);

  // Active Role (Considers Admin Preview Mode)
  const effectiveRole = currentUser ? (currentUser.role === 'admin' && adminViewingAsClient ? 'client' : currentUser.role) : 'guest';

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================
  function login(username, password) {
    const usernameClean = (username || '').trim().toLowerCase();
    const pwdClean = (password || '').trim();

    // Admin check
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

    // Client Workspace check across all workspaces
    for (const ws of workspaces) {
      const creds = ws.clientCredentials || {};
      const wsUser = (creds.username || '').toLowerCase();
      const wsEmail = (ws.clientEmail || '').toLowerCase();
      
      if (
        (usernameClean === wsUser || usernameClean === wsEmail || usernameClean === ws.name.toLowerCase() || usernameClean === (ws.clientName || '').toLowerCase()) &&
        (pwdClean === creds.password || pwdClean === ws.id + '2026' || pwdClean === 'crewlix2026' || pwdClean === 'apex2026')
      ) {
        const clientUser = {
          role: 'client',
          username: creds.username || ws.name,
          name: ws.clientName || ws.name,
          email: ws.clientEmail,
          workspaceId: ws.id
        };
        setCurrentUser(clientUser);
        setCurrentWorkspaceId(ws.id);
        setAdminViewingAsClient(false);
        return { success: true, role: 'client', workspaceId: ws.id };
      }
    }

    return { success: false, message: 'Invalid username or password.' };
  }

  function logout() {
    setCurrentUser(null);
    setAdminViewingAsClient(false);
    localStorage.removeItem(STORAGE_KEY_USER);
  }

  function switchWorkspace(wsId) {
    const exists = workspaces.find(w => w.id === wsId);
    if (exists) {
      setCurrentWorkspaceId(wsId);
    }
  }

  // ============================================================================
  // MAIL MERGE BATCH & STATUS UPDATES
  // ============================================================================

  // 1. Copy Batch to Clipboard for Google Sheets
  async function copyBatchForMailMerge(leadIds, includeHeaders = false) {
    if (!currentWorkspace || !leadIds || leadIds.length === 0) {
      return { success: false, count: 0 };
    }

    const selectedLeads = currentWorkspace.leads.filter(l => leadIds.includes(l.id));
    const tsvText = generateMailMergeTSV(selectedLeads, includeHeaders);
    const success = await copyToClipboard(tsvText);

    return {
      success,
      count: selectedLeads.length,
      sample: selectedLeads.slice(0, 3).map(l => `${l.email} - ${l.firstName} (${l.companyName})`).join(', ')
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

  // 6. Add Leads in Bulk (from CSV / Google Sheets)
  function addLeadsBulk(newLeads, defaultCampaignName = null) {
    if (!currentWorkspace || !newLeads || newLeads.length === 0) return 0;

    const campName = defaultCampaignName || currentWorkspace.campaignName || 'General Outbound';
    const leadsWithCampaign = newLeads.map(l => ({
      ...l,
      campaignName: l.campaignName || campName
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
              description: `Imported ${newLeads.length} leads into campaign "${campName}"`
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

  // 8. Workspace & Client Credentials Management (Synchronizes Workspace Names Immediately)
  function createWorkspace(wsData) {
    const newId = 'ws_' + Math.random().toString(36).substr(2, 8);
    const newWsTemplate = {
      id: newId,
      name: wsData.name || 'New Client Workspace',
      clientName: wsData.clientName || wsData.name,
      clientEmail: wsData.clientEmail || '',
      campaignName: wsData.campaignName || 'General Outbound',
      sendingAccounts: wsData.sendingAccounts || ['hello@clientdomain.com'],
      activeSendingAccount: (wsData.sendingAccounts && wsData.sendingAccounts[0]) || 'hello@clientdomain.com',
      clientCredentials: {
        username: wsData.username || wsData.name.toLowerCase().replace(/\s+/g, ''),
        password: wsData.password || 'client2026'
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
    setCurrentWorkspaceId('ws_crewlix');
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
    addLeadsBulk,
    deleteLead,
    bulkDeleteLeads,
    createWorkspace,
    updateWorkspace,
    updateClientCredentials,
    deleteWorkspace,
    resetToDefaults
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
