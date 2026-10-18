import { getSupabaseClient } from './db';
import { broadcastRealtimeEvent } from './cloudStorage';
import { syncLeadsBatchToGoogleSheet } from './googleSheetsService';
import { isLeadDNC } from '../utils/helpers';

/**
 * unsubscribeService.js
 * Handles public unsubscribe requests from unsub.crewlixhr.co.uk (or /unsubscribe route).
 * Updates the lead in Supabase Cloud to DNC / Unsubscribed, logs activity, syncs to Google Sheets,
 * and broadcasts realtime events so all open dashboards update live.
 */

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
    // 1. Fetch relevant workspace(s)
    let query = supabase
      .from('workspaces')
      .select('id, name, leads, activity_log, sequence_config, updated_at');

    if (workspaceId && typeof workspaceId === 'string' && workspaceId.trim() !== '') {
      query = query.eq('id', workspaceId.trim());
    }

    const { data: workspaces, error } = await query;

    if (error || !Array.isArray(workspaces) || workspaces.length === 0) {
      // If workspaceId was provided but not found, try fetching all non-system workspaces
      if (workspaceId) {
        return processUnsubscribeRequest({ email, workspaceId: null, reason });
      }
      return { success: false, error: 'Database record lookup failed.' };
    }

    // Filter out internal system rows
    const clientWorkspaces = workspaces.filter(w => 
      w && w.id && !w.id.startsWith('__ros_')
    );

    let matchFound = false;
    let updatedWorkspaceName = '';
    const nowIso = new Date().toISOString();
    const todayFormatted = new Date().toLocaleDateString('en-GB');

    // 2. Search for the lead across workspace(s)
    for (const ws of clientWorkspaces) {
      if (!Array.isArray(ws.leads) || ws.leads.length === 0) continue;

      const leadIndex = ws.leads.findIndex(l => 
        l && l.email && l.email.trim().toLowerCase() === cleanEmail
      );

      if (leadIndex !== -1) {
        matchFound = true;
        updatedWorkspaceName = ws.name || 'Outreach System';

        const existingLead = ws.leads[leadIndex];
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

        const updatedLeads = [...ws.leads];
        updatedLeads[leadIndex] = updatedLead;

        const newActivity = {
          id: 'act_unsub_' + Date.now(),
          timestamp: nowIso,
          type: 'dnc',
          count: 1,
          description: `Lead ${cleanEmail} unsubscribed via public link (unsub.crewlixhr.co.uk)`
        };

        const updatedActivity = [newActivity, ...(ws.activity_log || [])];

        // 3. Save directly to Supabase Cloud
        const { error: updateErr } = await supabase
          .from('workspaces')
          .update({
            leads: updatedLeads,
            activity_log: updatedActivity,
            updated_at: nowIso
          })
          .eq('id', ws.id);

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
      }
    }

    // Even if no exact match is found in the database (e.g. lead was contacted from an external list or alias),
    // we still record it cleanly in system metadata so it is permanently blacklisted.
    if (!matchFound) {
      try {
        await supabase
          .from('workspaces')
          .select('id, activity_log')
          .eq('id', '__ros_system_metadata__')
          .maybeSingle()
          .then(async ({ data: sysRow }) => {
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
                  activity_log: [act, ...(sysRow.activity_log || [])],
                  updated_at: nowIso
                })
                .eq('id', '__ros_system_metadata__');
            }
          });
      } catch (e) {}
    }

    return {
      success: true,
      email: cleanEmail,
      matched: matchFound,
      workspaceName: updatedWorkspaceName || 'Crewlix HR & Outreach'
    };

  } catch (err) {
    console.error('Error in processUnsubscribeRequest:', err);
    return { 
      success: false, 
      error: 'An unexpected error occurred while processing your request. Please try again.' 
    };
  }
}
