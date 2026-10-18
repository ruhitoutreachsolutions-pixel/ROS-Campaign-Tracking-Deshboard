/**
 * cycleHelpers.js
 * High-performance date math and leads aggregation utilities for Workspace Monthly Cycles.
 * Supports customized cycle days (e.g. Crewlix 22nd to 21st, Calendar Month 1st to 31st, Custom ranges).
 */

/**
 * Robustly parses any date representation into a JavaScript Date at local midnight (00:00:00.000).
 * Handles:
 *  - "Email Sent - 23/09/26"
 *  - "23/09/26" or "23/09/2026"
 *  - "2026-09-23" or "2026-09-23T11:01:41.457Z"
 *  - "23-09-26" or "23-09-2026"
 */
export function parseAnyDateToMidnight(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0, 0);
  }
  if (typeof val !== 'string') return null;

  const trimmed = val.trim();
  if (!trimmed) return null;

  // 1. Check if contains DD/MM/YY or DD/MM/YYYY
  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    let day = parseInt(slashMatch[1], 10);
    let month = parseInt(slashMatch[2], 10) - 1;
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;

    // Handle potential MM/DD swap if month > 12
    if (day <= 12 && parseInt(slashMatch[2], 10) > 12) {
      const temp = day;
      day = parseInt(slashMatch[2], 10);
      month = temp - 1;
    }
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  // 2. Check ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  // 3. Check DD-MM-YY or DD-MM-YYYY
  const dashMatch = trimmed.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (dashMatch) {
    let day = parseInt(dashMatch[1], 10);
    let month = parseInt(dashMatch[2], 10) - 1;
    let year = parseInt(dashMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  // 4. Fallback to generic Date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }

  return null;
}

/**
 * Resolves a lead's addition date.
 */
export function getLeadAdditionDate(lead) {
  if (!lead) return null;
  if (lead.dateAdded) {
    const d = parseAnyDateToMidnight(lead.dateAdded);
    if (d) return d;
  }
  if (lead.importedAt) {
    const d = parseAnyDateToMidnight(lead.importedAt);
    if (d) return d;
  }
  if (lead.createdAt) {
    const d = parseAnyDateToMidnight(lead.createdAt);
    if (d) return d;
  }
  return null;
}

/**
 * Converts a Date to YYYY-MM-DD string for input fields.
 */
export function formatDateToISO(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts a Date to user-friendly UK display: e.g. "22 Sep 2026"
 */
export function formatDateToDisplay(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate();
  const mon = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${mon} ${year}`;
}

/**
 * Computes the start and end dates for a cycle given reference date, startDay, endDay, and monthOffset.
 * E.g., for Crewlix: startDay = 22, endDay = 21.
 * If today is 18 Oct 2026:
 *  - offset = 0: 22 Sep 2026 -> 21 Oct 2026
 *  - offset = -1: 22 Aug 2026 -> 21 Sep 2026
 *  - offset = +1: 22 Oct 2026 -> 21 Nov 2026
 */
export function computeCycleDates(refDate = new Date(), startDay = 22, endDay = 21, monthOffset = 0) {
  const target = new Date(refDate.getTime());
  const curDay = target.getDate();
  const curMonth = target.getMonth();
  const curYear = target.getFullYear();

  // If calendar month (start day 1, end day >= 28)
  if (startDay === 1 && endDay >= 28) {
    const baseMonth = new Date(curYear, curMonth + monthOffset, 1, 0, 0, 0, 0);
    const start = new Date(baseMonth.getFullYear(), baseMonth.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startDate: start, endDate: end };
  }

  // Custom cycle day range (e.g. 22nd to 21st)
  let baseStartMonth = curMonth;
  if (curDay < startDay) {
    baseStartMonth = curMonth - 1;
  }

  // Apply monthOffset
  baseStartMonth += monthOffset;

  const start = new Date(curYear, baseStartMonth, startDay, 0, 0, 0, 0);
  
  // Calculate end date: if endDay < startDay, it's next month's endDay
  let baseEndMonth = baseStartMonth;
  if (endDay <= startDay) {
    baseEndMonth = baseStartMonth + 1;
  }
  const end = new Date(curYear, baseEndMonth, endDay, 23, 59, 59, 999);

  return { startDate: start, endDate: end };
}

/**
 * Calculates email sends and lead additions within the specified cycle date range.
 * Directly aggregates from the workspace's leads array.
 */
export function calculateMonthCycleMetrics(leads = [], startDate, endDate) {
  if (!leads || !Array.isArray(leads) || !startDate || !endDate) {
    return {
      totalEmailsSent: 0,
      email1Sent: 0,
      email2Sent: 0,
      email3Sent: 0,
      uniqueLeadsContacted: 0,
      totalLeadsAdded: 0,
      daysInCycle: 30,
      daysRemaining: 0,
      cycleProgressPercent: 0,
      isCurrentCycle: false
    };
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const now = new Date();
  const nowMs = now.getTime();

  let totalEmailsSent = 0;
  let email1Sent = 0;
  let email2Sent = 0;
  let email3Sent = 0;
  const contactedLeadIds = new Set();
  let totalLeadsAdded = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    let touchedInCycle = false;

    // Check Email 1
    if (lead.email1) {
      const d1 = parseAnyDateToMidnight(lead.email1);
      if (d1 && d1.getTime() >= startMs && d1.getTime() <= endMs) {
        totalEmailsSent++;
        email1Sent++;
        touchedInCycle = true;
      }
    }

    // Check Email 2
    if (lead.email2) {
      const d2 = parseAnyDateToMidnight(lead.email2);
      if (d2 && d2.getTime() >= startMs && d2.getTime() <= endMs) {
        totalEmailsSent++;
        email2Sent++;
        touchedInCycle = true;
      }
    }

    // Check Email 3
    if (lead.email3) {
      const d3 = parseAnyDateToMidnight(lead.email3);
      if (d3 && d3.getTime() >= startMs && d3.getTime() <= endMs) {
        totalEmailsSent++;
        email3Sent++;
        touchedInCycle = true;
      }
    }

    if (touchedInCycle) {
      contactedLeadIds.add(lead.id);
    }

    // Check Lead Addition Date
    const addDate = getLeadAdditionDate(lead);
    if (addDate && addDate.getTime() >= startMs && addDate.getTime() <= endMs) {
      totalLeadsAdded++;
    }
  }

  // Timeline & progress calculation
  const totalDurationMs = Math.max(endMs - startMs, 86400000);
  const daysInCycle = Math.round(totalDurationMs / (1000 * 60 * 60 * 24)) + 1;
  const isCurrentCycle = nowMs >= startMs && nowMs <= endMs;
  
  let daysRemaining = 0;
  let cycleProgressPercent = 0;

  if (nowMs < startMs) {
    daysRemaining = daysInCycle;
    cycleProgressPercent = 0;
  } else if (nowMs > endMs) {
    daysRemaining = 0;
    cycleProgressPercent = 100;
  } else {
    const elapsedMs = nowMs - startMs;
    daysRemaining = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));
    cycleProgressPercent = Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100));
  }

  return {
    totalEmailsSent,
    email1Sent,
    email2Sent,
    email3Sent,
    uniqueLeadsContacted: contactedLeadIds.size,
    totalLeadsAdded,
    daysInCycle,
    daysRemaining,
    cycleProgressPercent,
    isCurrentCycle
  };
}
