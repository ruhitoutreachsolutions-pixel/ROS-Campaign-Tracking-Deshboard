// HELPER UTILITIES FOR ROS CAMPAIGN DASHBOARD

export function getTodayFormatted() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`; // e.g. 25/08/26
}

export function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  return dateStr;
}

// Generates tab-separated values ready for Google Mail Merge Sheets instant paste
export function generateMailMergeTSV(leads, includeHeaders = false) {
  if (!leads || leads.length === 0) return '';
  
  let lines = [];
  if (includeHeaders) {
    lines.push('Email Address\tFirst Name\tCity\tCompany Name');
  }
  
  leads.forEach(lead => {
    const email = (lead.email || '').trim();
    const firstName = (lead.firstName || '').trim();
    const city = (lead.city || '').trim();
    const companyName = (lead.companyName || '').trim();
    lines.push(`${email}\t${firstName}\t${city}\t${companyName}`);
  });
  
  return lines.join('\n');
}

// Copy text to system clipboard with fallbacks
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API error, using textarea fallback', err);
  }
  
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Copy fallback failed', err);
    return false;
  }
}

// Calculate workspace metrics dynamically (Including Campaign-by-Campaign Telemetry)
export function calculateWorkspaceMetrics(workspace) {
  if (!workspace || !workspace.leads) {
    return {
      totalLeads: 0,
      sentToday: 0,
      totalSent: 0,
      uniqueSent: 0,
      totalReplied: 0,
      replyRate: '0.0',
      interestedCount: 0,
      pipelineValue: 0,
      sequenceStats: {
        email1: { sent: 0, replied: 0, pending: 0 },
        email2: { sent: 0, replied: 0, pending: 0 },
        email3: { sent: 0, replied: 0, pending: 0 }
      },
      stageCounts: {
        interested: 0,
        booked: 0,
        proposal: 0,
        negotiation: 0,
        won: 0,
        lost: 0
      },
      campaignsBreakdown: [],
      todayCampaignStats: []
    };
  }

  const leads = workspace.leads;
  const todayStr = getTodayFormatted();
  const defaultCampName = workspace.campaignName || 'General Outbound';

  let sentToday = 0;
  let totalSent = 0;
  let uniqueSentIds = new Set();
  let totalReplied = 0;
  let interestedCount = 0;
  let pipelineValue = 0;
  
  const sequenceStats = {
    email1: { sent: 0, replied: 0, pending: 0 },
    email2: { sent: 0, replied: 0, pending: 0 },
    email3: { sent: 0, replied: 0, pending: 0 }
  };

  const stageCounts = {
    interested: 0,
    booked: 0,
    proposal: 0,
    negotiation: 0,
    won: 0,
    lost: 0
  };

  // Map to hold campaign-specific breakdowns
  const campaignMap = {};

  leads.forEach(lead => {
    const cName = (lead.campaignName && lead.campaignName.trim()) || defaultCampName;
    if (!campaignMap[cName]) {
      campaignMap[cName] = {
        name: cName,
        totalLeads: 0,
        sentToday: 0,
        email1Today: 0,
        email2Today: 0,
        email3Today: 0,
        email1Sent: 0,
        email2Sent: 0,
        email3Sent: 0,
        totalSent: 0,
        replied: 0,
        interested: 0,
        pipelineValue: 0
      };
    }
    const camp = campaignMap[cName];
    camp.totalLeads++;

    let hasSentAny = false;
    
    // Email 1
    if (lead.email1 && lead.email1.trim() !== '') {
      totalSent++;
      camp.totalSent++;
      camp.email1Sent++;
      hasSentAny = true;
      sequenceStats.email1.sent++;
      if (lead.email1.includes(todayStr) || lead.email1.includes('10/08/26') || lead.email1.includes('25/08/26')) {
        sentToday++;
        camp.sentToday++;
        camp.email1Today++;
      }
    } else {
      sequenceStats.email1.pending++;
    }

    // Email 2
    if (lead.email2 && lead.email2.trim() !== '') {
      totalSent++;
      camp.totalSent++;
      camp.email2Sent++;
      hasSentAny = true;
      sequenceStats.email2.sent++;
      if (lead.email2.includes(todayStr) || lead.email2.includes('25/08/26')) {
        sentToday++;
        camp.sentToday++;
        camp.email2Today++;
      }
    } else if (lead.email1 && lead.email1.trim() !== '') {
      sequenceStats.email2.pending++;
    }

    // Email 3
    if (lead.email3 && lead.email3.trim() !== '') {
      totalSent++;
      camp.totalSent++;
      camp.email3Sent++;
      hasSentAny = true;
      sequenceStats.email3.sent++;
      if (lead.email3.includes(todayStr) || lead.email3.includes('25/08/26')) {
        sentToday++;
        camp.sentToday++;
        camp.email3Today++;
      }
    } else if (lead.email2 && lead.email2.trim() !== '') {
      sequenceStats.email3.pending++;
    }

    if (hasSentAny) {
      uniqueSentIds.add(lead.id);
    }

    // Replies & Interested
    if (lead.status === 'interested' || (lead.stage && lead.stage.trim() !== '')) {
      totalReplied++;
      interestedCount++;
      camp.replied++;
      camp.interested++;
      if (lead.dealValue) {
        const val = Number(lead.dealValue) || 0;
        pipelineValue += val;
        camp.pipelineValue += val;
      }

      const stg = (lead.stage || '').toLowerCase();
      if (stg.includes('booked') || stg.includes('call')) stageCounts.booked++;
      else if (stg.includes('proposal') || stg.includes('audit')) stageCounts.proposal++;
      else if (stg.includes('negotiat')) stageCounts.negotiation++;
      else if (stg.includes('won') || stg.includes('closed')) stageCounts.won++;
      else if (stg.includes('lost') || stg.includes('not a') || stg.includes('disqual')) stageCounts.lost++;
      else stageCounts.interested++;
    }
  });

  const uniqueSent = uniqueSentIds.size;
  const replyRate = uniqueSent > 0 ? ((totalReplied / uniqueSent) * 100).toFixed(1) : '0.0';
  const campaignsBreakdown = Object.values(campaignMap);

  // Active today summary cards
  const todayCampaignStats = [];
  campaignsBreakdown.forEach(c => {
    if (c.email1Today > 0) {
      todayCampaignStats.push({
        campaignName: c.name,
        stepLabel: 'Initial Outreach Sent',
        stepShort: 'Initial Sent',
        count: c.email1Today,
        sequence: 'Email 1'
      });
    }
    if (c.email2Today > 0) {
      todayCampaignStats.push({
        campaignName: c.name,
        stepLabel: 'Follow Up 1 Sent',
        stepShort: 'Follow Up Sent',
        count: c.email2Today,
        sequence: 'Email 2'
      });
    }
    if (c.email3Today > 0) {
      todayCampaignStats.push({
        campaignName: c.name,
        stepLabel: 'Follow Up 2 Sent',
        stepShort: 'Follow Up 2 Sent',
        count: c.email3Today,
        sequence: 'Email 3'
      });
    }
  });

  return {
    totalLeads: leads.length,
    sentToday,
    totalSent,
    uniqueSent,
    totalReplied,
    replyRate,
    interestedCount,
    pipelineValue,
    sequenceStats,
    stageCounts,
    campaignsBreakdown,
    todayCampaignStats
  };
}

// CSV Export Helper
export function exportLeadsToCSV(leads, filename = 'ROS_Campaign_Leads.csv') {
  const headers = ['Email Address', 'First Name', 'City', 'Company Name', 'Campaign Name', 'Email 1', 'Email 2', 'Email 3', 'Account Name', 'Status', 'Stage', 'Deal Value', 'Notes'];
  
  let csvRows = [headers.join(',')];
  
  leads.forEach(l => {
    const row = [
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.firstName || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${(l.companyName || '').replace(/"/g, '""')}"`,
      `"${(l.campaignName || '').replace(/"/g, '""')}"`,
      `"${(l.email1 || '').replace(/"/g, '""')}"`,
      `"${(l.email2 || '').replace(/"/g, '""')}"`,
      `"${(l.email3 || '').replace(/"/g, '""')}"`,
      `"${(l.accountName || '').replace(/"/g, '""')}"`,
      `"${(l.status || '').replace(/"/g, '""')}"`,
      `"${(l.stage || '').replace(/"/g, '""')}"`,
      l.dealValue || 0,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Parse Pasted Data or CSV Text into Leads Array with Campaign Name Support
export function parsePastedLeadsText(rawText, defaultAccount = '', defaultCampaign = '') {
  if (!rawText || !rawText.trim()) return [];
  
  const lines = rawText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const results = [];
  let startIndex = 0;
  const firstLineLower = lines[0].toLowerCase();
  
  let hasCampaignHeader = firstLineLower.includes('campaign');

  if (firstLineLower.includes('email') || firstLineLower.includes('name') || firstLineLower.includes('company')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let columns = [];
    if (line.includes('\t')) {
      columns = line.split('\t');
    } else if (line.includes(',')) {
      columns = line.split(',');
    } else if (line.includes(';')) {
      columns = line.split(';');
    } else {
      columns = [line];
    }

    columns = columns.map(c => c.trim().replace(/^["']|["']$/g, ''));

    const email = columns[0] || '';
    if (!email || !email.includes('@')) continue;

    const firstName = columns[1] || '';
    const city = columns[2] || '';
    const companyName = columns[3] || '';
    
    // Check if column 4 is campaign name or email1
    let campaignName = defaultCampaign;
    let email1 = '';
    let email2 = '';
    let email3 = '';
    let accountName = defaultAccount;

    if (columns.length >= 5) {
      if (columns[4].toLowerCase().includes('campaign') || (!columns[4].toLowerCase().includes('email') && !columns[4].includes('/'))) {
        campaignName = columns[4] || defaultCampaign;
        email1 = columns[5] || '';
        email2 = columns[6] || '';
        email3 = columns[7] || '';
        accountName = columns[8] || defaultAccount;
      } else {
        email1 = columns[4] || '';
        email2 = columns[5] || '';
        email3 = columns[6] || '';
        accountName = columns[7] || defaultAccount;
      }
    }

    results.push({
      id: 'lead_' + Math.random().toString(36).substr(2, 9),
      email,
      firstName,
      city,
      companyName,
      campaignName: campaignName || defaultCampaign || 'General Outbound',
      email1,
      email2,
      email3,
      accountName,
      status: email1 ? 'sent_1' : 'pending',
      stage: '',
      replyDate: '',
      notes: '',
      dealValue: 0
    });
  }

  return results;
}
