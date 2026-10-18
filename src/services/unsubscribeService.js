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

    // 1. Identify candidate workspace(s)
    let explicitWsId = workspaceId && typeof workspaceId === 'string' && workspaceId.trim() !== '' 
      ? workspaceId.trim() 
      : null;

    let targetWorkspaces = [];

    if (explicitWsId) {
      const { data: singleWs, error } = await supabase
        .from('workspaces')
        .select('id, name, leads, activity_log, updated_at')
        .eq('id', explicitWsId)
        .maybeSingle();

      if (!error && singleWs) {
        targetWorkspaces = [singleWs];
      }
    }

    // If no explicit workspace provided or not found, automatically resolve workspace
    if (targetWorkspaces.length === 0) {
      // Prioritize workspace based on authoritative dataset match
      let prioritizedWsId = 'ws_crewlixukltd';
      if (getCrewlixEmailMap().has(cleanEmail)) {
        prioritizedWsId = 'ws_crewlixukltd';
      } else if (getCgeEmailMap().has(cleanEmail)) {
        prioritizedWsId = 'ws_zrnl1fjb';
      }

      // Fetch prioritized workspace first (avoids fetching massive payload across all workspaces)
      const { data: primaryWs } = await supabase
        .from('workspaces')
        .select('id, name, leads, activity_log, updated_at')
        .eq('id', prioritizedWsId)
        .maybeSingle();

      if (primaryWs) {
        targetWorkspaces.push(primaryWs);
      }

      // Also fetch other active workspaces as fallback if not matched
      const { data: otherWorkspaces } = await supabase
        .from('workspaces')
        .select('id, name, leads, activity_log, updated_at')
        .neq('id', prioritizedWsId)
        .neq('id', '__ros_system_metadata__')
        .neq('id', '__ros_sheets_config_v1__')
        .neq('id', '__ros_chat_messages_v1__')
        .neq('id', '__ros_form_submissions_v1__');

      if (Array.isArray(otherWorkspaces)) {
        targetWorkspaces.push(...otherWorkspaces);
      }
    }

    let matchFound = false;
    let updatedWorkspaceName = '';
    let updatedLeadRecord = null;

    // 2. Search for the lead across workspace(s) in Supabase leads AND authoritative baselines
    for (const ws of targetWorkspaces) {
      if (!ws || !ws.id) continue;

      let existingLead = null;
      let leadIndex = -1;

      // 2a. Check Supabase workspace leads first
      if (Array.isArray(ws.leads)) {
        leadIndex = ws.leads.findIndex(l => 
          l && l.email && l.email.trim().toLowerCase() === cleanEmail
        );
        if (leadIndex !== -1) {
          existingLead = ws.leads[leadIndex];
        }
      }

      // 2b. If not found in Supabase delta, check baseline for this workspace
      if (!existingLead) {
        if (ws.id === 'ws_crewlixukltd' || ws.id === 'ws_crewlixuk' || ws.id === 'ws_crewlix') {
          existingLead = getCrewlixEmailMap().get(cleanEmail) || null;
        } else if (ws.id === 'ws_zrnl1fjb') {
          existingLead = getCgeEmailMap().get(cleanEmail) || null;
        }
      }

      // 2c. Lead found! Apply DNC opt-out
      if (existingLead) {
        matchFound = true;
        updatedWorkspaceName = ws.name || 'Crewlix UK LTD';

        const updatedLead = {
          ...existingLead,
          status: 'dnc',
          stage: 'DNC / Unsubscribed',
          isDNC: true,
          unsubscribedAt: nowIso,
          unsubscribeReason: reason || 'Public unsubscribe link (unsub.crewlixhr.co.uk)',
          notes: existingLead.notes 
            ? `${existingLead.notes} | [Unsubscribed via link on ${todayFormatted}]` 
            : `[Unsubscribed via link on ${todayFormatted}]`,
          updatedAt: nowIso
        };

        updatedLeadRecord = updatedLead;

        let updatedLeads = Array.isArray(ws.leads) ? [...ws.leads] : [];
        if (leadIndex !== -1) {
          updatedLeads[leadIndex] = updatedLead;
        } else {
          updatedLeads.push(updatedLead);
        }

        const newActivity = {
          id: 'act_unsub_' + Date.now(),
          timestamp: nowIso,
          type: 'dnc',
          count: 1,
          description: `Lead ${cleanEmail} unsubscribed via public link (unsub.crewlixhr.co.uk)`
        };

        const updatedActivity = [newActivity, ...(ws.activity_log || [])].slice(0, 500);

        // 3. Save to Supabase Cloud
        const { error: updateErr } = await supabase
          .from('workspaces')
          .update({
            leads: updatedLeads,
            activity_log: updatedActivity,
            updated_at: nowIso
          })
          .eq('id', ws.id);

        // Always record in the resilient Cloud DNC Registry partition
        saveDncRecordToCloud({
          email: cleanEmail,
          leadId: updatedLead.id,
          workspaceId: ws.id,
          reason: reason || 'Public unsubscribe link (unsub.crewlixhr.co.uk)',
          unsubscribedAt: nowIso
        }).catch(() => {});

        // Broadcast instant DNC notification across all tabs
        broadcastRealtimeEvent('DNC_RECORD_ADDED', {
          email: cleanEmail,
          workspaceId: ws.id,
          unsubscribedAt: nowIso,
          lead: updatedLead
        }).catch(() => {});

        if (!updateErr) {
          // 4. Broadcast Realtime Event to all open dashboard devices & tabs
          broadcastRealtimeEvent('WORKSPACE_LEADS_UPDATED', {
            workspaceId: ws.id,
            leads: [updatedLead],
            updatedAt: nowIso
          }).catch(() => {});

          broadcastRealtimeEvent('WORKSPACE_RECONCILE_NEEDED', {
            workspaceId: ws.id,
            updatedAt: nowIso
          }).catch(() => {});

          // 5. Delta sync to Google Sheets
          syncLeadsBatchToGoogleSheet(ws.id, ws.name, [updatedLead], newActivity).catch(() => {});
        }

        break; // Match confirmed and processed
      }
    }

    // 6. Fallback if not matched in any loaded workspace: check baselines directly
    if (!matchFound) {
      const fallbackBaselineLead = getCrewlixEmailMap().get(cleanEmail) || getCgeEmailMap().get(cleanEmail);
      if (fallbackBaselineLead) {
        const fallbackWsId = getCrewlixEmailMap().has(cleanEmail) ? 'ws_crewlixukltd' : 'ws_zrnl1fjb';
        const fallbackWsName = fallbackWsId === 'ws_crewlixukltd' ? 'Crewlix UK Ltd' : 'CGE UK LTD';

        const updatedLead = {
          ...fallbackBaselineLead,
          status: 'dnc',
          stage: 'DNC / Unsubscribed',
          isDNC: true,
          unsubscribedAt: nowIso,
          unsubscribeReason: reason || 'Public unsubscribe link (unsub.crewlixhr.co.uk)',
          notes: fallbackBaselineLead.notes 
            ? `${fallbackBaselineLead.notes} | [Unsubscribed via link on ${todayFormatted}]` 
            : `[Unsubscribed via link on ${todayFormatted}]`,
          updatedAt: nowIso
        };

        matchFound = true;
        updatedWorkspaceName = fallbackWsName;

        const { data: wsRow } = await supabase
          .from('workspaces')
          .select('id, leads, activity_log')
          .eq('id', fallbackWsId)
          .maybeSingle();

        if (wsRow) {
          const updatedLeads = [...(wsRow.leads || []), updatedLead];
          const act = {
            id: 'act_unsub_' + Date.now(),
            timestamp: nowIso,
            type: 'dnc',
            count: 1,
            description: `Lead ${cleanEmail} unsubscribed via public link (unsub.crewlixhr.co.uk)`
          };
          await supabase
            .from('workspaces')
            .update({
              leads: updatedLeads,
              activity_log: [act, ...(wsRow.activity_log || [])].slice(0, 500),
              updated_at: nowIso
            })
            .eq('id', fallbackWsId);

          saveDncRecordToCloud({
            email: cleanEmail,
            leadId: updatedLead.id,
            workspaceId: fallbackWsId,
            reason: reason || 'Public unsubscribe link (unsub.crewlixhr.co.uk)',
            unsubscribedAt: nowIso
          }).catch(() => {});

          broadcastRealtimeEvent('DNC_RECORD_ADDED', {
            email: cleanEmail,
            workspaceId: fallbackWsId,
            unsubscribedAt: nowIso,
            lead: updatedLead
          }).catch(() => {});

          broadcastRealtimeEvent('WORKSPACE_LEADS_UPDATED', {
            workspaceId: fallbackWsId,
            leads: [updatedLead],
            updatedAt: nowIso
          }).catch(() => {});

          broadcastRealtimeEvent('WORKSPACE_RECONCILE_NEEDED', {
            workspaceId: fallbackWsId,
            updatedAt: nowIso
          }).catch(() => {});

          syncLeadsBatchToGoogleSheet(fallbackWsId, fallbackWsName, [updatedLead], act).catch(() => {});
        }
      }
    }

    // 7. If genuinely external (not found anywhere), log in __ros_system_metadata__
    if (!matchFound) {
      try {
        const { data: sysRow } = await supabase
          .from('workspaces')
          .select('id, activity_log')
          .eq('id', '__ros_system_metadata__')
          .maybeSingle();

        if (sysRow) {
          const act = {
            id: 'act_unsub_external_' + Date.now(),
            timestamp: nowIso,
            type: 'dnc_external',
            description: `External email ${cleanEmail} unsubscribed via unsub.crewlixhr.co.uk`
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
    }

    return {
      success: true,
      email: cleanEmail,
      matched: matchFound,
      workspaceName: updatedWorkspaceName || 'Crewlix UK LTD'
    };

  } catch (err) {
    console.error('Error in processUnsubscribeRequest:', err);
    return { 
      success: false, 
      error: 'An unexpected error occurred while processing your request. Please try again.' 
    };
  }
}
