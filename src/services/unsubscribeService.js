import { getSupabaseClient, saveDncRecordToCloud } from './db';
import { broadcastRealtimeEvent } from './cloudStorage';
import { syncLeadsBatchToGoogleSheet } from './googleSheetsService';
import { isLeadDNC } from '../utils/helpers';
import cgeAuthoritative3804 from '../data/cgeAuthoritative3804.json';
import crewlixAuthoritative20113 from '../data/crewlixAuthoritative20113.json';

/**
 * unsubscribeService.js
 * Handles public unsubscribe requests from unsub.crewlixhr.co.uk (or /unsubscribe route).
 * Updates the lead in Supabase Cloud to DNC / Unsubscribed (supporting both Supabase delta
 * and authoritative baseline datasets), logs activity, syncs to Google Sheets,
 * and broadcasts realtime events so all open dashboards update live.
 */

// Lazy cached baseline lookup maps by email for high-speed O(1) matching
let crewlixEmailMap = null;
let cgeEmailMap = null;

function getCrewlixEmailMap() {
  if (!crewlixEmailMap) {
    crewlixEmailMap = new Map();
    (crewlixAuthoritative20113?.leads || []).forEach(lead => {
      if (lead && lead.email) {
        crewlixEmailMap.set(lead.email.trim().toLowerCase(), lead);
      }
    });
  }
  return crewlixEmailMap;
}

function getCgeEmailMap() {
  if (!cgeEmailMap) {
    cgeEmailMap = new Map();
    (cgeAuthoritative3804?.leads || []).forEach(lead => {
      if (lead && lead.email) {
        cgeEmailMap.set(lead.email.trim().toLowerCase(), lead);
      }
    });
  }
  return cgeEmailMap;
}

export async function processUnsubscribeRequest({ email, workspaceId, reason }) {
  if (!email || typeof email !== 'string') {
    return { success: false, error: 'A valid email address is required.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Please provide a valid email format (e.g., name@company.com).' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Unable to connect to cloud database. Please try again shortly.' };
  }

  try {
    const nowIso = new Date().toISOString();
    const todayFormatted = new Date().toLocaleDateString('en-GB');
    const finalReason = reason || 'Public unsubscribe link (unsub.crewlixhr.co.uk)';

    // 1. Resolve workspace and baseline match in-memory (0ms lookup)
    let baselineLead = null;
    let targetWsId = workspaceId && typeof workspaceId === 'string' && workspaceId.trim() !== '' 
      ? workspaceId.trim() 
      : null;
    let targetWsName = 'Crewlix UK LTD';

    if (getCrewlixEmailMap().has(cleanEmail)) {
      baselineLead = getCrewlixEmailMap().get(cleanEmail);
      targetWsId = 'ws_crewlixukltd';
      targetWsName = 'Crewlix UK Ltd';
    } else {
      targetWsId = 'ws_crewlixukltd';
      targetWsName = 'Crewlix UK Ltd';
    }

    // 2. UNCONDITIONAL GLOBAL DNC REGISTRY SAVE (Always executed first!)
    // Ensures regardless of chunks or baselines, the email is permanently registered as DNC.
    const dncRecord = {
      email: cleanEmail,
      leadId: baselineLead?.id || null,
      workspaceId: targetWsId,
      reason: finalReason,
      unsubscribedAt: nowIso
    };

    // Save to global cloud registry so all dashboards/chunks reconcile it immediately
    await saveDncRecordToCloud(dncRecord);

    // Broadcast instant DNC notification across all tabs and open devices
    broadcastRealtimeEvent('DNC_RECORD_ADDED', {
      email: cleanEmail,
      workspaceId: targetWsId,
      reason: finalReason,
      unsubscribedAt: nowIso,
      lead: baselineLead ? {
        ...baselineLead,
        status: 'dnc',
        stage: 'DNC / Unsubscribed',
        isDNC: true,
        unsubscribedAt: nowIso,
        unsubscribeReason: finalReason,
        unsubscribedFromLink: true
      } : null
    }).catch(() => {});

    // 3. Fast targeted workspace row update (only the single target workspace, NEVER all partitions!)
    let updatedLeadRecord = null;
    try {
      const { data: wsRow } = await supabase
        .from('workspaces')
        .select('id, name, leads, activity_log')
        .eq('id', targetWsId)
        .maybeSingle();

      if (wsRow) {
        if (wsRow.name) targetWsName = wsRow.name;
        let wsLeads = Array.isArray(wsRow.leads) ? [...wsRow.leads] : [];
        const existingIdx = wsLeads.findIndex(l => l && l.email && l.email.trim().toLowerCase() === cleanEmail);
        
        const existingOrBase = existingIdx !== -1 ? wsLeads[existingIdx] : (baselineLead || {
          id: 'lead_unsub_' + Date.now(),
          email: cleanEmail,
          createdAt: nowIso
        });

        const updatedLead = {
          ...existingOrBase,
          status: 'dnc',
          stage: 'DNC / Unsubscribed',
          isDNC: true,
          unsubscribedAt: nowIso,
          unsubscribeReason: finalReason,
          unsubscribedFromLink: true,
          notes: existingOrBase.notes 
            ? `${existingOrBase.notes} | [Unsubscribed via link on ${todayFormatted}]` 
            : `[Unsubscribed via link on ${todayFormatted}]`,
          updatedAt: nowIso
        };

        updatedLeadRecord = updatedLead;

        if (existingIdx !== -1) {
          wsLeads[existingIdx] = updatedLead;
        } else {
          wsLeads.unshift(updatedLead);
        }

        const newActivity = {
          id: 'act_unsub_' + Date.now(),
          timestamp: nowIso,
          type: 'dnc',
          count: 1,
          description: `Lead ${cleanEmail} unsubscribed via public link (unsub.crewlixhr.co.uk)`
        };

        const updatedActivity = [newActivity, ...(wsRow.activity_log || [])].slice(0, 500);

        await supabase
          .from('workspaces')
          .update({
            leads: wsLeads,
            activity_log: updatedActivity,
            updated_at: nowIso
          })
          .eq('id', targetWsId);

        // Sync delta to Google Sheet in background
        syncLeadsBatchToGoogleSheet(targetWsId, targetWsName, [updatedLead], newActivity).catch(() => {});

        // Broadcast workspace updated event
        broadcastRealtimeEvent('WORKSPACE_LEADS_UPDATED', {
          workspaceId: targetWsId,
          leads: [updatedLead],
          updatedAt: nowIso
        }).catch(() => {});

        broadcastRealtimeEvent('WORKSPACE_RECONCILE_NEEDED', {
          workspaceId: targetWsId,
          updatedAt: nowIso
        }).catch(() => {});
      }
    } catch (wsErr) {
      console.warn('Non-blocking workspace row update error:', wsErr);
    }

    // Also record in system metadata activity log for centralized audit history
    try {
      const { data: sysRow } = await supabase
        .from('workspaces')
        .select('id, activity_log')
        .eq('id', '__ros_system_metadata__')
        .maybeSingle();

      if (sysRow) {
        const act = {
          id: 'act_unsub_' + Date.now(),
          timestamp: nowIso,
          type: 'dnc',
          description: `Lead ${cleanEmail} unsubscribed via unsub.crewlixhr.co.uk (${targetWsName})`
        };
        await supabase
          .from('workspaces')
          .update({
            activity_log: [act, ...(sysRow.activity_log || [])].slice(0, 500),
            updated_at: nowIso
          })
          .eq('id', '__ros_system_metadata__');
      }
    } catch (e) {}

    return {
      success: true,
      email: cleanEmail,
      matched: true,
      workspaceName: targetWsName
    };

  } catch (err) {
    console.error('Error in processUnsubscribeRequest:', err);
    return { 
      success: false, 
      error: 'An unexpected error occurred while processing your request. Please try again.' 
    };
  }
}
