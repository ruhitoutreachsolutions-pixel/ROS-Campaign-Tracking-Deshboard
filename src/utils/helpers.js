// HELPER UTILITIES FOR ROS CAMPAIGN DASHBOARD

export function getTodayFormatted() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`; // e.g. 26/08/26
}

export function getYesterdayFormatted() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`; // e.g. 25/08/26
}

export function extractDateFromStatus(statusStr) {
  if (!statusStr || typeof statusStr !== 'string') return null;
  const match = statusStr.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  return match ? match[1] : null;
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

// Calculate workspace metrics dynamically (Strict Date Separation: Today vs Yesterday / Last Day)
export function calculateWorkspaceMetrics(workspace) {
  const emptyMetrics = {
    totalLeads: 0,
    sentToday: 0,
    sentYesterday: 0,
    lastDaySent: 0,
    lastActiveDate: null,
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
    todayCampaignStats: [],
    yesterdayCampaignStats: [],
    lastDayCampaignStats: []
  };

  if (!workspace || !workspace.leads) {
    return emptyMetrics;
  }

  const leads = workspace.leads;
  const todayStr = getTodayFormatted();
  const yesterdayStr = getYesterdayFormatted();
  const defaultCampName = workspace.campaignName || 'General Outbound';

  let sentToday = 0;
  let sentYesterday = 0;
  let totalSent = 0;
  let uniqueSentIds = new Set();
  let totalReplied = 0;
  let interestedCount = 0;
  let pipelineValue = 0;

  // Track counts per date to determine the most recent dispatch day
  const dateCounts = {}; // { '25/08/26': 1495, '18/08/26': 745 }
  const dateCampaignMap = {}; // { '25/08/26': { 'Care Campaign UK': { email1: 0, email2: 1495, email3: 0 } } }
  
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
        sentYesterday: 0,
        email1Today: 0,
        email2Today: 0,
        email3Today: 0,
        email1Yesterday: 0,
        email2Yesterday: 0,
        email3Yesterday: 0,
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

    // Helper to process sequence send
    const processSequenceSend = (val, seqKey) => {
      if (!val || typeof val !== 'string' || val.trim() === '') return false;
      totalSent++;
      camp.totalSent++;
      camp[`${seqKey}Sent`]++;
      sequenceStats[seqKey].sent++;
      hasSentAny = true;

      const date = extractDateFromStatus(val);
      if (date) {
        dateCounts[date] = (dateCounts[date] || 0) + 1;
        if (!dateCampaignMap[date]) dateCampaignMap[date] = {};
        if (!dateCampaignMap[date][cName]) {
          dateCampaignMap[date][cName] = { email1: 0, email2: 0, email3: 0, total: 0 };
        }
        dateCampaignMap[date][cName][seqKey]++;
        dateCampaignMap[date][cName].total++;

        // Strictly check Today vs Yesterday
        if (date === todayStr) {
          sentToday++;
          camp.sentToday++;
          camp[`${seqKey}Today`]++;
        } else if (date === yesterdayStr) {
          sentYesterday++;
          camp.sentYesterday++;
          camp[`${seqKey}Yesterday`]++;
        }
      }
      return true;
    };

    // Email 1
    const hasE1 = processSequenceSend(lead.email1, 'email1');
    if (!hasE1) sequenceStats.email1.pending++;

    // Email 2
    const hasE2 = processSequenceSend(lead.email2, 'email2');
    if (!hasE2 && hasE1) sequenceStats.email2.pending++;

    // Email 3
    const hasE3 = processSequenceSend(lead.email3, 'email3');
    if (!hasE3 && hasE2) sequenceStats.email3.pending++;

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

  // Calculate Last Active Date (excluding today if today is 0)
  const sortedDates = Object.keys(dateCounts).sort((a, b) => {
    const parse = (s) => {
      const parts = s.split('/');
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        return new Date(`${year}-${parts[1]}-${parts[0]}`).getTime();
      }
      return 0;
    };
    return parse(b) - parse(a);
  });

  const lastActiveDate = sortedDates.find(d => d !== todayStr) || sortedDates[0] || null;
  const lastDaySent = lastActiveDate ? (dateCounts[lastActiveDate] || 0) : 0;

  // Build Today's Campaign Telemetry Cards
  const todayCampaignStats = [];
  Object.values(campaignMap).forEach(camp => {
    if (camp.sentToday > 0) {
      const details = [];
      if (camp.email1Today > 0) details.push(`Initial Outreach: ${camp.email1Today}`);
      if (camp.email2Today > 0) details.push(`Follow Up 1: ${camp.email2Today}`);
      if (camp.email3Today > 0) details.push(`Follow Up 2: ${camp.email3Today}`);

      todayCampaignStats.push({
        campaignName: camp.name,
        sentToday: camp.sentToday,
        details: details.join(' · '),
        email1: camp.email1Today,
        email2: camp.email2Today,
        email3: camp.email3Today
      });
    }
  });

  // Build Yesterday's Campaign Telemetry Cards
  const yesterdayCampaignStats = [];
  Object.values(campaignMap).forEach(camp => {
    if (camp.sentYesterday > 0) {
      const details = [];
      if (camp.email1Yesterday > 0) details.push(`Initial Outreach: ${camp.email1Yesterday}`);
      if (camp.email2Yesterday > 0) details.push(`Follow Up 1: ${camp.email2Yesterday}`);
      if (camp.email3Yesterday > 0) details.push(`Follow Up 2: ${camp.email3Yesterday}`);

      yesterdayCampaignStats.push({
        campaignName: camp.name,
        sentYesterday: camp.sentYesterday,
        date: yesterdayStr,
        details: details.join(' · '),
        email1: camp.email1Yesterday,
        email2: camp.email2Yesterday,
        email3: camp.email3Yesterday
      });
    }
  });

  // Build Last Active Day Breakdown (e.g. 25/08/26)
  const lastDayCampaignStats = [];
  if (lastActiveDate && dateCampaignMap[lastActiveDate]) {
    Object.entries(dateCampaignMap[lastActiveDate]).forEach(([cName, stats]) => {
      const details = [];
      if (stats.email1 > 0) details.push(`Initial Outreach: ${stats.email1}`);
      if (stats.email2 > 0) details.push(`Follow Up 1: ${stats.email2}`);
      if (stats.email3 > 0) details.push(`Follow Up 2: ${stats.email3}`);

      lastDayCampaignStats.push({
        campaignName: cName,
        date: lastActiveDate,
        totalSent: stats.total,
        details: details.join(' · ')
      });
    });
  }

  const replyRate = totalSent > 0 ? ((totalReplied / totalSent) * 100).toFixed(1) : '0.0';

  return {
    totalLeads: leads.length,
    sentToday,
    sentYesterday,
    lastDaySent,
    lastActiveDate,
    totalSent,
    uniqueSent: uniqueSentIds.size,
    totalReplied,
    replyRate,
    interestedCount,
    pipelineValue,
    sequenceStats,
    stageCounts,
    campaignsBreakdown: Object.values(campaignMap),
    todayCampaignStats,
    yesterdayCampaignStats,
    lastDayCampaignStats
  };
}

// Parse pasted TSV / CSV text from Google Sheets into structured lead objects
export function parsePastedLeadsText(text, defaultCampaignName = null) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.trim().split(/\r?\n/);
  const leads = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect TSV or CSV
    const separator = line.includes('\t') ? '\t' : ',';
    const cols = line.split(separator).map(c => c.replace(/^["']|["']$/g, '').trim());

    // Skip Header line if detected
    if (i === 0 && (
      cols[0].toLowerCase().includes('email') || 
      cols[1]?.toLowerCase().includes('first') || 
      cols[0].toLowerCase().includes('address')
    )) {
      continue;
    }

    if (cols.length >= 1 && cols[0].includes('@')) {
      leads.push({
        id: 'ld_' + Math.random().toString(36).substr(2, 9),
        email: cols[0] || '',
        firstName: cols[1] || '',
        city: cols[2] || '',
        companyName: cols[3] || '',
        campaignName: cols[4] || defaultCampaignName || 'General Outbound',
        email1: cols[5] || '',
        email2: cols[6] || '',
        email3: cols[7] || '',
        accountName: cols[8] || '',
        status: 'pending',
        stage: '',
        dealValue: 0,
        notes: '',
        importedAt: new Date().toISOString()
      });
    }
  }

  return leads;
}

// Export array of leads to CSV download
export function exportLeadsToCSV(leads, filename = 'ROS_Campaign_Leads.csv') {
  if (!leads || leads.length === 0) return;

  const headers = [
    'Email Address',
    'First Name',
    'City',
    'Company Name',
    'Campaign Name',
    'Email 1',
    'Email 2',
    'Email 3',
    'Account Name',
    'Pipeline Stage',
    'Deal Value ($)',
    'Status',
    'Notes'
  ];

  const rows = leads.map(l => [
    `"${(l.email || '').replace(/"/g, '""')}"`,
    `"${(l.firstName || '').replace(/"/g, '""')}"`,
    `"${(l.city || '').replace(/"/g, '""')}"`,
    `"${(l.companyName || '').replace(/"/g, '""')}"`,
    `"${(l.campaignName || '').replace(/"/g, '""')}"`,
    `"${(l.email1 || '').replace(/"/g, '""')}"`,
    `"${(l.email2 || '').replace(/"/g, '""')}"`,
    `"${(l.email3 || '').replace(/"/g, '""')}"`,
    `"${(l.accountName || '').replace(/"/g, '""')}"`,
    `"${(l.stage || '').replace(/"/g, '""')}"`,
    `"${l.dealValue || 0}"`,
    `"${(l.status || '').replace(/"/g, '""')}"`,
    `"${(l.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
