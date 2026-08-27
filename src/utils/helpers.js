// HELPER UTILITIES FOR ROS CAMPAIGN DASHBOARD

export function getTodayFormatted() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`; // e.g. 27/08/26
}

export function getYesterdayFormatted() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`; // e.g. 26/08/26
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

// Check if a lead is labeled as DNC, Unsubscribed, or Not Interested
export function isLeadDNC(lead) {
  if (!lead) return false;
  if (lead.isDNC === true) return true;

  const stage = (lead.stage || '').toLowerCase().trim();
  const status = (lead.status || '').toLowerCase().trim();

  // Explicit DNC, Unsubscribe, and Not Interested conditions
  if (
    stage === 'dnc' ||
    stage.includes('do not contact') ||
    stage.includes('unsub') ||
    stage.includes('not interested') ||
    stage.includes('opt out') ||
    stage.includes('remove') ||
    stage.includes('disqual') ||
    stage.includes('not a fit')
  ) {
    return true;
  }

  if (
    status === 'dnc' ||
    status === 'unsubscribed' ||
    status === 'not_interested' ||
    status === 'disqualified'
  ) {
    return true;
  }

  return false;
}

// Generates tab-separated values ready for Google Mail Merge Sheets instant paste (Automatically avoids DNC / Not Interested)
export function generateMailMergeTSV(leads, includeHeaders = false, filterDNC = true) {
  if (!leads || leads.length === 0) return '';
  
  const validLeads = filterDNC ? leads.filter(l => !isLeadDNC(l)) : leads;
  if (validLeads.length === 0) return '';

  let lines = [];
  if (includeHeaders) {
    lines.push('Email Address\tFirst Name\tCity\tCompany Name');
  }
  
  validLeads.forEach(lead => {
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

// Calculate workspace metrics dynamically (Strict Date Separation & DNC Intelligence)
export function calculateWorkspaceMetrics(workspace) {
  const emptyMetrics = {
    totalLeads: 0,
    activeLeads: 0,
    dncCount: 0,
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
      lost: 0,
      dnc: 0
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
  let dncCount = 0;

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
    lost: 0,
    dnc: 0
  };

  // Map to hold campaign-specific breakdowns
  const campaignMap = {};

  leads.forEach(lead => {
    const isDnc = isLeadDNC(lead);
    if (isDnc) {
      dncCount++;
      stageCounts.dnc++;
    }

    const cName = (lead.campaignName && lead.campaignName.trim()) || defaultCampName;
    if (!campaignMap[cName]) {
      campaignMap[cName] = {
        name: cName,
        totalLeads: 0,
        dncCount: 0,
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
    if (isDnc) camp.dncCount++;

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
    if (!hasE1 && !isDnc) sequenceStats.email1.pending++;

    // Email 2
    const hasE2 = processSequenceSend(lead.email2, 'email2');
    if (!hasE2 && hasE1 && !isDnc) sequenceStats.email2.pending++;

    // Email 3
    const hasE3 = processSequenceSend(lead.email3, 'email3');
    if (!hasE3 && hasE2 && !isDnc) sequenceStats.email3.pending++;

    if (hasSentAny) {
      uniqueSentIds.add(lead.id);
    }

    // Replies & Interested (Excluding DNC from positive interested pipeline)
    if (!isDnc && (lead.status === 'interested' || (lead.stage && lead.stage.trim() !== ''))) {
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
    activeLeads: leads.length - dncCount,
    dncCount,
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

// Robust CSV row parser that handles commas inside quotes and escaped quotes
export function parseCSVRow(rowStr, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    const nextChar = rowStr[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Intelligent Multi-Column CSV & TSV Parser (Auto-detects all column headers & automatically assigns Date Added)
export function parsePastedLeadsText(text, defaultCampaignName = null, defaultAccount = null) {
  if (!text || typeof text !== 'string') return [];

  const rawLines = text.trim().split(/\r?\n/);
  if (rawLines.length === 0) return [];

  // Determine separator (Tab, Comma, or Semicolon)
  const firstLine = rawLines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let separator = '\t';
  if (tabCount >= 2) separator = '\t';
  else if (commaCount >= 1) separator = ',';
  else if (semiCount >= 1) separator = ';';

  const todayStr = getTodayFormatted();
  const leads = [];

  // Check if Line 0 is a Header Row
  const headerCols = separator === '\t' ? firstLine.split('\t').map(c => c.replace(/^["']|["']$/g, '').trim()) : parseCSVRow(firstLine, separator);
  
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isHeaderRow = headerCols.some(h => {
    const nh = normalize(h);
    return nh.includes('email') || nh.includes('name') || nh.includes('city') || nh.includes('company') || nh.includes('campaign');
  });

  // Build Column Index Mapping
  const headerMap = {};
  if (isHeaderRow) {
    headerCols.forEach((rawH, idx) => {
      const nh = normalize(rawH);
      if (nh.includes('emailaddress') || nh === 'email' || nh === 'e-mail' || nh === 'mail' || nh === 'contactemail') {
        headerMap.email = idx;
      } else if (nh.includes('firstname') || nh === 'first' || nh === 'name' || nh === 'contact' || nh === 'leadname') {
        headerMap.firstName = idx;
      } else if (nh === 'city' || nh.includes('location') || nh === 'town' || nh === 'region') {
        headerMap.city = idx;
      } else if (nh.includes('company') || nh === 'business' || nh === 'organization' || nh === 'client') {
        headerMap.companyName = idx;
      } else if (nh.includes('campaign')) {
        headerMap.campaignName = idx;
      } else if (nh.includes('email1') || nh.includes('touch1') || nh.includes('step1') || nh.includes('initial')) {
        headerMap.email1 = idx;
      } else if (nh.includes('email2') || nh.includes('touch2') || nh.includes('step2') || nh.includes('followup1') || nh.includes('follow1')) {
        headerMap.email2 = idx;
      } else if (nh.includes('email3') || nh.includes('touch3') || nh.includes('step3') || nh.includes('followup2') || nh.includes('follow2')) {
        headerMap.email3 = idx;
      } else if (nh.includes('account') || nh.includes('sender') || nh.includes('sendingaccount')) {
        headerMap.accountName = idx;
      } else if (nh.includes('stage') || nh === 'status' || nh.includes('pipelinestage')) {
        headerMap.stage = idx;
      } else if (nh.includes('dealvalue') || nh === 'deal' || nh === 'value' || nh === 'amount') {
        headerMap.dealValue = idx;
      } else if (nh.includes('dateadded') || nh.includes('importdate') || nh.includes('createdat') || nh === 'date' || nh.includes('added')) {
        headerMap.dateAdded = idx;
      } else if (nh.includes('note') || nh.includes('comment') || nh.includes('context')) {
        headerMap.notes = idx;
      }
    });
  }

  const startIdx = isHeaderRow ? 1 : 0;

  for (let i = startIdx; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const cols = separator === '\t' ? line.split('\t').map(c => c.replace(/^["']|["']$/g, '').trim()) : parseCSVRow(line, separator);

    let email = '';
    let firstName = '';
    let city = '';
    let companyName = '';
    let campaignName = defaultCampaignName || 'General Outbound';
    let email1 = '';
    let email2 = '';
    let email3 = '';
    let accountName = defaultAccount || '';
    let stage = '';
    let dealValue = 0;
    let dateAdded = todayStr;
    let notes = '';

    if (isHeaderRow && Object.keys(headerMap).length > 0) {
      if (headerMap.email !== undefined) email = cols[headerMap.email] || '';
      if (headerMap.firstName !== undefined) firstName = cols[headerMap.firstName] || '';
      if (headerMap.city !== undefined) city = cols[headerMap.city] || '';
      if (headerMap.companyName !== undefined) companyName = cols[headerMap.companyName] || '';
      if (headerMap.campaignName !== undefined && cols[headerMap.campaignName]) campaignName = cols[headerMap.campaignName];
      if (headerMap.email1 !== undefined) email1 = cols[headerMap.email1] || '';
      if (headerMap.email2 !== undefined) email2 = cols[headerMap.email2] || '';
      if (headerMap.email3 !== undefined) email3 = cols[headerMap.email3] || '';
      if (headerMap.accountName !== undefined) accountName = cols[headerMap.accountName] || '';
      if (headerMap.stage !== undefined) stage = cols[headerMap.stage] || '';
      if (headerMap.dealValue !== undefined) dealValue = Number(cols[headerMap.dealValue]) || 0;
      if (headerMap.dateAdded !== undefined && cols[headerMap.dateAdded]) dateAdded = cols[headerMap.dateAdded];
      if (headerMap.notes !== undefined) notes = cols[headerMap.notes] || '';
    } else {
      // Positional fallback (Standard Google Sheets format)
      email = cols[0] || '';
      firstName = cols[1] || '';
      city = cols[2] || '';
      companyName = cols[3] || '';
      campaignName = cols[4] || defaultCampaignName || 'General Outbound';
      email1 = cols[5] || '';
      email2 = cols[6] || '';
      email3 = cols[7] || '';
      accountName = cols[8] || defaultAccount || '';
      stage = cols[9] || '';
      dealValue = Number(cols[10]) || 0;
      dateAdded = cols[11] || todayStr;
      notes = cols[12] || '';
    }

    // Only add valid records with an email address
    if (email && email.includes('@')) {
      const isDnc = stage.toLowerCase().includes('dnc') || 
                    stage.toLowerCase().includes('unsub') || 
                    stage.toLowerCase().includes('not interested');

      leads.push({
        id: 'ld_' + Math.random().toString(36).substr(2, 9),
        email: email.trim(),
        firstName: firstName.trim(),
        city: city.trim(),
        companyName: companyName.trim(),
        campaignName: campaignName.trim(),
        email1: email1.trim(),
        email2: email2.trim(),
        email3: email3.trim(),
        accountName: accountName.trim(),
        status: isDnc ? 'dnc' : (stage && !stage.toLowerCase().includes('lost') ? 'interested' : 'pending'),
        stage: stage.trim(),
        dealValue: Number(dealValue) || 0,
        dateAdded: dateAdded.trim() || todayStr,
        notes: notes.trim(),
        isDNC: isDnc,
        importedAt: new Date().toISOString()
      });
    }
  }

  return leads;
}

// Export array of leads to CSV download (Includes Date Added)
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
    'Date Added',
    'Status',
    'DNC Status',
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
    `"${(l.dateAdded || getTodayFormatted()).replace(/"/g, '""')}"`,
    `"${(l.status || '').replace(/"/g, '""')}"`,
    `"${isLeadDNC(l) ? 'DNC / Unsubscribed' : 'Active'}"`,
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
