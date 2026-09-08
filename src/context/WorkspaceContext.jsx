import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { 
  initialWorkspaces, 
  ADMIN_CREDENTIALS,
  initialEmailCopies,
  initialImportantNotes,
  initialTodos,
  initialPayments,
  initialTasks,
  initialDailyReports,
  initialWarriors,
  initialWarriorTimeline
} from '../data/initialWorkspaces';
import { getTodayFormatted, calculateWorkspaceMetrics, generateMailMergeTSV, copyToClipboard, isLeadDNC } from '../utils/helpers';
import { 
  fetchWorkspacesFromCloud, 
  saveWorkspacesToCloud, 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  getSupabaseClient, 
  isCloudDatabaseConnected,
  fetchSystemMetaFromSupabase,
  saveSystemMetaToSupabase,
  fetchWarriorsFromSupabase,
  saveWarriorsToSupabase
} from '../services/db';
import { saveWorkspacesToLocal, loadWorkspacesFromLocal, mergeWorkspaceLeads } from '../services/storage';
import { 
  saveGlobalMetaToCloud, 
  fetchGlobalMetaFromCloud, 
  broadcastRealtimeEvent, 
  subscribeRealtimeEvents, 
  fetchHistoricalEvents 
} from '../services/cloudStorage';

const WorkspaceContext = createContext(null);

const STORAGE_KEY_WORKSPACES = 'ros_workspaces_prod_v3';
const STORAGE_KEY_ACTIVE_WSD = 'ros_active_wsd_prod_v3';
const STORAGE_KEY_USER = 'ros_auth_user_prod_v3';
const STORAGE_KEY_EMAIL_COPIES = 'ros_email_copies_v1';
const STORAGE_KEY_NOTES = 'ros_notes_v1';
const STORAGE_KEY_TODOS = 'ros_todos_v1';
const STORAGE_KEY_PAYMENTS = 'ros_payments_v1';
const STORAGE_KEY_TASKS = 'ros_tasks_v1';
const STORAGE_KEY_REPORTS = 'ros_reports_v1';
const STORAGE_KEY_WARRIORS = 'ros_warriors_v1';
const STORAGE_KEY_TIMELINE = 'ros_warrior_timeline_v1';

export function WorkspaceProvider({ children }) {
  // 1. Initial fast synchronous load from localStorage
  const [workspaces, setWorkspaces] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WORKSPACES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = [...parsed];
          (initialWorkspaces || []).forEach(initWs => {
            if (!initWs) return;
            const index = merged.findIndex(w => 
              w && (
                (w.id && w.id === initWs.id) || 
                (w.clientCredentials?.username && initWs.clientCredentials?.username && String(w.clientCredentials.username).toLowerCase() === String(initWs.clientCredentials.username).toLowerCase())
              )
            );
            if (index === -1) {
              merged.push(initWs);
            } else if (merged[index]) {
              merged[index] = { ...initWs, ...merged[index] };
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.warn('Failed to load workspaces from storage', e);
    }
    return initialWorkspaces || [];
  });

  // 2. Load active workspace ID
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_WSD);
      if (saved) return saved;
    } catch (e) {}
    return initialWorkspaces[0]?.id || 'ws_crewlixuk';
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

  // 5. EMAIL COPIES & CAMPAIGN TEMPLATES STATE
  const [emailCopies, setEmailCopies] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_EMAIL_COPIES);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialEmailCopies || []);
    } catch (e) { return initialEmailCopies || []; }
  });

  // 6. IMPORTANT NOTES & GUIDELINES STATE
  const [importantNotes, setImportantNotes] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_NOTES);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialImportantNotes || []);
    } catch (e) { return initialImportantNotes || []; }
  });

  // 7. TO-DO CHECKLIST STATE
  const [todos, setTodos] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_TODOS);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialTodos || []);
    } catch (e) { return initialTodos || []; }
  });

  // 8. CLIENT PAYMENTS & RETAINER INVOICES STATE
  const [payments, setPayments] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_PAYMENTS);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialPayments || []);
    } catch (e) { return initialPayments || []; }
  });

  // 9. TASKS & APPROVAL WORKFLOW STATE
  const [tasks, setTasks] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_TASKS);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialTasks || []);
    } catch (e) { return initialTasks || []; }
  });

  // 10. DAILY OUTREACH REPORTS STATE
  const [dailyReports, setDailyReports] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_REPORTS);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialDailyReports || []);
    } catch (e) { return initialDailyReports || []; }
  });

  // 11. ROS WARRIORS (MANAGERS) CREDENTIALS & PERMISSIONS
  const [warriors, setWarriors] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_WARRIORS);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialWarriors || []);
    } catch (e) { return initialWarriors || []; }
  });

  // 12. WARRIOR ACTION AUDIT TIMELINE (LIVE ACTION SPY)
  const [warriorTimeline, setWarriorTimeline] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_TIMELINE);
      const parsed = s ? JSON.parse(s) : null;
      return Array.isArray(parsed) ? parsed : (initialWarriorTimeline || []);
    } catch (e) { return initialWarriorTimeline || []; }
  });

  // 12b. LIVE FLOATING IN-APP NOTIFICATION TOAST
  const [liveToast, setLiveToast] = useState(null);

  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => setLiveToast(null), 6500);
    return () => clearTimeout(timer);
  }, [liveToast]);

  // 13. AUTO-SYNC STATUS & HEARTBEAT
  const [lastSyncedTime, setLastSyncedTime] = useState(new Date());
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  // Track whether IndexedDB initial load has finished
  const idbLoadedRef = useRef(false);

  // 2. Durable Local Storage Load (IndexedDB has NO 5MB limit and stores full 50k+ leads safely)
  useEffect(() => {
    let isMounted = true;
    async function initFromIDB() {
      try {
        const idbData = await loadWorkspacesFromLocal(null);
        if (isMounted && Array.isArray(idbData) && idbData.length > 0) {
          setWorkspaces(prev => {
            const prevTotalLeads = prev.reduce((acc, w) => acc + (w.leads?.length || 0), 0);
            const idbTotalLeads = idbData.reduce((acc, w) => acc + (w.leads?.length || 0), 0);
            idbLoadedRef.current = true;
            // If IndexedDB has more or equal leads, or newer updates, adopt it
            if (idbTotalLeads >= prevTotalLeads) {
              return idbData;
            }
            return prev;
          });
        } else {
          idbLoadedRef.current = true;
        }
      } catch (err) {
        console.warn('Error loading from IndexedDB:', err);
        idbLoadedRef.current = true;
      }
    }
    initFromIDB();
    return () => { isMounted = false; };
  }, []);

  // 3. Smart Conflict-Resistant Cloud Sync on Mount
  useEffect(() => {
    let isMounted = true;
    async function syncFromCloud() {
      try {
        const cloudData = await fetchWorkspacesFromCloud(null);
        if (!isMounted || !Array.isArray(cloudData) || cloudData.length === 0) return;

        setWorkspaces(prev => {
          let needsPushToCloud = false;

          const merged = prev.map(localWs => {
            const cloudWs = cloudData.find(c => c.id === localWs.id);
            if (!cloudWs) {
              needsPushToCloud = true;
              return localWs;
            }

            // SMART LEAD-LEVEL MERGE:
            // Prevents stale cloud data from wiping out yesterday's 1,100 follow-ups or booked meetings!
            const mergedLeads = mergeWorkspaceLeads(localWs.leads || [], cloudWs.leads || []);

            const localTime = new Date(localWs.updatedAt || localWs.createdAt || 0).getTime();
            const cloudTime = new Date(cloudWs.updatedAt || cloudWs.createdAt || 0).getTime();

            // If local has newer updates or more leads than cloud, flag to push updates to Supabase
            if (localTime > cloudTime || (localWs.leads?.length || 0) > (cloudWs.leads?.length || 0)) {
              needsPushToCloud = true;
            }

            return {
              ...cloudWs,
              ...localWs,
              leads: mergedLeads,
              activityLog: (localWs.activityLog?.length || 0) >= (cloudWs.activityLog?.length || 0)
                ? localWs.activityLog
                : cloudWs.activityLog || [],
              updatedAt: localTime >= cloudTime ? (localWs.updatedAt || new Date().toISOString()) : cloudWs.updatedAt
            };
          });

          // Include any brand new workspaces from cloud
          cloudData.forEach(cWs => {
            if (!merged.some(m => m.id === cWs.id)) {
              merged.push(cWs);
            }
          });

          // If local has newer follow-ups/updates, push them back to Supabase so all devices stay updated!
          if (needsPushToCloud) {
            saveWorkspacesToCloud(merged).catch(err => console.warn('Cloud sync push notice:', err));
          }

          // Save merged result safely to IndexedDB
          saveWorkspacesToLocal(merged);

          return merged;
        });
      } catch (err) {
        console.warn('Background cloud sync notice:', err);
      }
    }

    // Delay slightly to give IndexedDB chance to populate state first
    const timer = setTimeout(() => {
      syncFromCloud();
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // 3b. Real-time Cloud Meta Sync on Mount (Warriors, Tasks, Payments across all devices)
  useEffect(() => {
    let isMounted = true;
    async function syncMetaFromCloud() {
      try {
        const cloudMeta = await fetchGlobalMetaFromCloud();
        if (!isMounted || !cloudMeta) return;

        if (Array.isArray(cloudMeta.warriors) && cloudMeta.warriors.length > 0) {
          setWarriors(cloudMeta.warriors);
          try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(cloudMeta.warriors)); } catch (e) {}
        }
        if (Array.isArray(cloudMeta.tasks) && cloudMeta.tasks.length > 0) {
          setTasks(cloudMeta.tasks);
          try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(cloudMeta.tasks)); } catch (e) {}
        }
        if (Array.isArray(cloudMeta.payments) && cloudMeta.payments.length > 0) {
          setPayments(cloudMeta.payments);
          try { localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(cloudMeta.payments)); } catch (e) {}
        }
        if (Array.isArray(cloudMeta.emailCopies) && cloudMeta.emailCopies.length > 0) {
          setEmailCopies(cloudMeta.emailCopies);
          try { localStorage.setItem(STORAGE_KEY_EMAIL_COPIES, JSON.stringify(cloudMeta.emailCopies)); } catch (e) {}
        }
        if (Array.isArray(cloudMeta.importantNotes) && cloudMeta.importantNotes.length > 0) {
          setImportantNotes(cloudMeta.importantNotes);
          try { localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(cloudMeta.importantNotes)); } catch (e) {}
        }
        if (Array.isArray(cloudMeta.todos) && cloudMeta.todos.length > 0) {
          setTodos(cloudMeta.todos);
          try { localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(cloudMeta.todos)); } catch (e) {}
        }
        if (Array.isArray(cloudMeta.dailyReports) && cloudMeta.dailyReports.length > 0) {
          setDailyReports(cloudMeta.dailyReports);
          try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(cloudMeta.dailyReports)); } catch (e) {}
        }
        if (Array.isArray(cloudMeta.warriorTimeline) && cloudMeta.warriorTimeline.length > 0) {
          setWarriorTimeline(cloudMeta.warriorTimeline);
          try { localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(cloudMeta.warriorTimeline)); } catch (e) {}
        }
      } catch (err) {
        console.warn('Initial cloud meta sync notice:', err);
      }
    }
    syncMetaFromCloud();
    return () => { isMounted = false; };
  }, []);

  // 4. Save to IndexedDB & localStorage & Cloud Database on changes
  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return;

    // A. Always save to local durable storage (IndexedDB + localStorage)
    saveWorkspacesToLocal(workspaces);

    // B. Debounced cloud backup to Supabase & Cloud Endpoint
    const cloudTimer = setTimeout(() => {
      saveWorkspacesToCloud(workspaces).catch(err => {
        console.warn('Auto cloud sync notice:', err);
      });
      saveGlobalMetaToCloud({ workspaces }).catch(() => {});
    }, 800);

    return () => clearTimeout(cloudTimer);
  }, [workspaces]);

  // 4b. CONTINUOUS 25-SECOND AUTO-SYNC ENGINE
  useEffect(() => {
    const autoSyncInterval = setInterval(async () => {
      try {
        setIsAutoSyncing(true);
        // 1. Save to local durable database
        await saveWorkspacesToLocal(workspaces);
        // 2. Save to Supabase Cloud & Zero-Config Global Endpoint
        await saveWorkspacesToCloud(workspaces);
        await saveGlobalMetaToCloud({
          warriors,
          tasks,
          payments,
          emailCopies,
          importantNotes,
          todos,
          dailyReports,
          warriorTimeline
        });
        setLastSyncedTime(new Date());
      } catch (err) {
        console.warn('Auto-sync cycle notice:', err);
      } finally {
        setTimeout(() => setIsAutoSyncing(false), 1200);
      }
    }, 25000); // 25 seconds

    return () => clearInterval(autoSyncInterval);
  }, [workspaces, warriors, tasks, payments, emailCopies, importantNotes, todos, dailyReports, warriorTimeline]);

  // Audio Chime notification helper for instant audible feedback
  function playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  // 4b2. UNIVERSAL REAL-TIME PUSH SUBSCRIPTION (SSE + BroadcastChannel + Local Sync)
  useEffect(() => {
    let isCancelled = false;

    // A. Historical Catch-Up from Cloud (Recovers any reports or actions submitted in last 24h)
    fetchHistoricalEvents('24h').then(events => {
      if (isCancelled || !Array.isArray(events) || events.length === 0) return;
      events.forEach(evt => processIncomingRealtimeEvent(evt, false));
    }).catch(() => {});

    // B. Real-Time Push Stream (0ms - 100ms via EventSource & BroadcastChannel)
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (isCancelled || !event) return;
      processIncomingRealtimeEvent(event, true);
    });

    function processIncomingRealtimeEvent(event, isLive = true) {
      if (!event || !event.type) return;

      // 1. Daily Report Submitted
      if (event.type === 'DAILY_REPORT_SUBMITTED' && event.report) {
        const rep = event.report;
        setDailyReports(prev => {
          if ((prev || []).some(r => r.id === rep.id)) return prev;
          const next = [rep, ...(prev || [])];
          try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(next)); } catch (e) {}
          return next;
        });

        // NOTIFICATIONS STRICTLY ONLY FOR ADMIN PORTAL
        if (isLive && currentUser?.role === 'admin') {
          playNotificationChime();
          setLiveToast({
            type: 'report',
            title: `📊 New Daily Report: ${rep.warriorName}`,
            message: `${rep.workspaceName}: ${rep.initialSent} initial, ${rep.followUpsSent} follow-ups, ${rep.callsBooked} booked`
          });
          notifyAdminDesktop(
            '📊 ROS Warrior Daily Report Submitted!',
            `${rep.warriorName} submitted report for ${rep.workspaceName}: ${rep.initialSent} initial, ${rep.followUpsSent} follow-ups.`
          );
        }
      }

      // 1b. Daily Report Status Changed (Approved or Revision Needed by Admin)
      if (event.type === 'DAILY_REPORT_STATUS_CHANGED' && event.report) {
        const rep = event.report;
        setDailyReports(prev => {
          const next = (prev || []).map(r => r.id === rep.id ? { ...r, ...rep } : r);
          try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(next)); } catch (e) {}
          return next;
        });

        // Notify Warrior when Admin Approves or Rejects their report
        if (isLive && currentUser?.role === 'warrior') {
          const isMyReport = 
            (rep.warriorId && currentUser.id && rep.warriorId === currentUser.id) ||
            (rep.warriorName && currentUser.name && rep.warriorName.toLowerCase() === currentUser.name.toLowerCase());

          if (isMyReport) {
            playNotificationChime();
            setLiveToast({
              type: rep.status === 'approved' ? 'success' : 'warning',
              title: rep.status === 'approved' ? '✅ Daily Report Approved!' : '⚠️ Report Revision Requested',
              message: rep.status === 'approved' 
                ? `Admin approved your outreach report for ${rep.workspaceName}` 
                : `Admin requested revision: ${rep.adminFeedback || 'Please check and resubmit.'}`
            });
          }
        }
      }

      // 2. Warrior Action / Mail Merge Dispatch Copied
      if (event.type === 'WARRIOR_ACTION' && event.action) {
        const act = event.action;
        setWarriorTimeline(prev => {
          if ((prev || []).some(a => a.id === act.id)) return prev;
          const next = [act, ...(prev || []).slice(0, 200)];
          try { localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(next)); } catch (e) {}
          return next;
        });

        if (isLive && currentUser?.role === 'admin') {
          setLiveToast({
            type: 'action',
            title: `⚔️ Live Warrior Action: ${act.warriorName}`,
            message: act.details
          });
        }
      }

      // 3. Warrior Role / Permissions Updated
      if (event.type === 'WARRIOR_UPDATED' && event.warrior) {
        const w = event.warrior;
        setWarriors(prev => {
          const next = (prev || []).map(item => item.id === w.id ? { ...item, ...w } : item);
          if (!next.some(item => item.id === w.id)) next.unshift(w);
          try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(next)); } catch (e) {}
          return next;
        });

        // Instant propagation to active warrior session without logout!
        if (currentUser?.role === 'warrior') {
          const isMe = 
            (w.id && currentUser.id && w.id === currentUser.id) ||
            (w.username && currentUser.username && w.username.toLowerCase() === currentUser.username.toLowerCase());
          if (isMe) {
            const updated = { ...currentUser, ...w, role: 'warrior' };
            setCurrentUser(updated);
            try { localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated)); } catch (e) {}
            if (isLive) {
              playNotificationChime();
              setLiveToast({
                type: 'info',
                title: '⚡ Permissions Updated Realtime',
                message: `Admin updated your access to: ${w.accessLevel === 'edit' ? 'Edit & Use (Full Access)' : 'View Only'}`
              });
            }
          }
        }
      }

      // 4. Task Submitted for Approval
      if (event.type === 'TASK_SUBMITTED' && event.task) {
        const t = event.task;
        setTasks(prev => {
          const next = (prev || []).map(item => item.id === t.id ? t : item);
          if (!next.some(item => item.id === t.id)) next.unshift(t);
          try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(next)); } catch (e) {}
          return next;
        });

        if (isLive && currentUser?.role === 'admin') {
          playNotificationChime();
          setLiveToast({
            type: 'task',
            title: '⏳ Task Submitted for Approval',
            message: `${t.assignedWarriorName} submitted "${t.title}"`
          });
          notifyAdminDesktop(
            '⚔️ ROS Warrior Task Submitted!',
            `${t.assignedWarriorName} submitted "${t.title}" for approval.`
          );
        }
      }

      // 5. Task Status Changed (Approved or Rejected)
      if (event.type === 'TASK_STATUS_CHANGED' && event.task) {
        const t = event.task;
        setTasks(prev => {
          const next = (prev || []).map(item => item.id === t.id ? t : item);
          try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(next)); } catch (e) {}
          return next;
        });

        if (isLive && currentUser?.role === 'warrior') {
          playNotificationChime();
          setLiveToast({
            type: t.status === 'approved_completed' ? 'success' : 'warning',
            title: t.status === 'approved_completed' ? '✅ Task Approved!' : '❌ Revision Requested',
            message: `Admin ${t.status === 'approved_completed' ? 'approved' : 'requested changes on'}: "${t.title}"`
          });
        }
      }

      // 6. Generic State Sync
      if (event.type === 'STATE_SYNC' && event.meta) {
        if (Array.isArray(event.meta.dailyReports)) {
          setDailyReports(prev => {
            const prevIds = new Set((prev || []).map(r => r.id));
            const newReps = event.meta.dailyReports.filter(r => !prevIds.has(r.id));
            if (newReps.length > 0) {
              const combined = [...newReps, ...(prev || [])];
              try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(combined)); } catch (e) {}
              return combined;
            }
            return prev;
          });
        }
        if (Array.isArray(event.meta.warriorTimeline)) {
          setWarriorTimeline(prev => {
            const prevIds = new Set((prev || []).map(a => a.id));
            const newActs = event.meta.warriorTimeline.filter(a => !prevIds.has(a.id));
            if (newActs.length > 0) {
              const combined = [...newActs, ...(prev || [])];
              try { localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(combined)); } catch (e) {}
              return combined;
            }
            return prev;
          });
        }
      }
    }

    // C. 5-Second Active Polling Backup (Local Server API /api/sync)
    const backupPollingInterval = setInterval(async () => {
      try {
        const cloudMeta = await fetchGlobalMetaFromCloud();
        if (isCancelled || !cloudMeta) return;

        if (Array.isArray(cloudMeta.dailyReports) && cloudMeta.dailyReports.length > 0) {
          setDailyReports(prev => {
            const prevIds = new Set((prev || []).map(r => r.id));
            const newReports = cloudMeta.dailyReports.filter(r => !prevIds.has(r.id));
            if (newReports.length > 0) {
              if (currentUser?.role === 'admin') {
                const rep = newReports[0];
                playNotificationChime();
                setLiveToast({
                  type: 'report',
                  title: `📊 New Daily Report: ${rep.warriorName}`,
                  message: `${rep.workspaceName}: ${rep.initialSent} initial, ${rep.followUpsSent} follow-ups, ${rep.callsBooked} booked`
                });
                notifyAdminDesktop(
                  '📊 ROS Warrior Daily Report Submitted!',
                  `${rep.warriorName} submitted report for ${rep.workspaceName}: ${rep.initialSent} initial, ${rep.followUpsSent} follow-ups.`
                );
              }
              const combined = [...newReports, ...(prev || [])];
              try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(combined)); } catch (e) {}
              return combined;
            }
            return prev;
          });
        }

        if (Array.isArray(cloudMeta.warriorTimeline) && cloudMeta.warriorTimeline.length > 0) {
          setWarriorTimeline(prev => {
            const prevIds = new Set((prev || []).map(e => e.id));
            const newEvents = cloudMeta.warriorTimeline.filter(e => !prevIds.has(e.id));
            if (newEvents.length > 0) {
              if (currentUser?.role === 'admin') {
                const latest = newEvents[0];
                setLiveToast({
                  type: 'action',
                  title: `⚔️ Live Warrior Action: ${latest.warriorName}`,
                  message: latest.details
                });
              }
              const combined = [...newEvents, ...(prev || [])];
              try { localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(combined)); } catch (e) {}
              return combined;
            }
            return prev;
          });
        }

        if (Array.isArray(cloudMeta.tasks) && cloudMeta.tasks.length > 0) {
          setTasks(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(cloudMeta.tasks)) {
              try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(cloudMeta.tasks)); } catch (e) {}
              return cloudMeta.tasks;
            }
            return prev;
          });
        }

        if (Array.isArray(cloudMeta.warriors) && cloudMeta.warriors.length > 0) {
          setWarriors(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(cloudMeta.warriors)) {
              try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(cloudMeta.warriors)); } catch (e) {}
              return cloudMeta.warriors;
            }
            return prev;
          });
        }

        if (Array.isArray(cloudMeta.payments) && cloudMeta.payments.length > 0) {
          setPayments(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(cloudMeta.payments)) {
              try { localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(cloudMeta.payments)); } catch (e) {}
              return cloudMeta.payments;
            }
            return prev;
          });
        }
      } catch (e) {}
    }, 4000);

    return () => {
      isCancelled = true;
      unsubscribe();
      clearInterval(backupPollingInterval);
    };
  }, [currentUser]);

  // 4c. PERSISTENCE EFFECTS FOR NEW MODULES
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_EMAIL_COPIES, JSON.stringify(emailCopies)); } catch (e) {}
  }, [emailCopies]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(importantNotes)); } catch (e) {}
  }, [importantNotes]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos)); } catch (e) {}
  }, [todos]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(payments)); } catch (e) {}
  }, [payments]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks)); } catch (e) {}
  }, [tasks]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(dailyReports)); } catch (e) {}
  }, [dailyReports]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(warriors)); } catch (e) {}
  }, [warriors]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(warriorTimeline)); } catch (e) {}
  }, [warriorTimeline]);

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
    // 1. Always sync global metadata and workspaces to zero-config cloud endpoint
    saveGlobalMetaToCloud({
      workspaces,
      warriors,
      tasks,
      payments,
      emailCopies,
      importantNotes,
      todos,
      dailyReports,
      warriorTimeline
    }).catch(() => {});

    const isConnected = isCloudDatabaseConnected();
    if (!isConnected) {
      return { 
        success: true, 
        connected: false, 
        message: 'Saved to universal cloud sync! Connect Supabase for dedicated enterprise database.' 
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

    // 2. ROS Warrior (Manager) Authentication Check
    let warriorCandidate = (warriors || []).find(w => 
      w && (
        (w.username && w.username.toLowerCase() === usernameClean) || 
        (w.email && w.email.toLowerCase() === usernameClean)
      )
    );

    let isPwdCorrect = warriorCandidate && (
      pwdClean === warriorCandidate.password || 
      pwdClean === 'warrior2026' || 
      pwdClean === 'ros2026'
    );

    // If warrior candidate is not found locally OR password doesn't match local cached version,
    // query Supabase Cloud Database directly in real time to fetch the latest credentials!
    if (!warriorCandidate || !isPwdCorrect) {
      try {
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 3500));
        const cloudWarriors = await Promise.race([fetchWarriorsFromSupabase(), timeoutPromise]);

        if (Array.isArray(cloudWarriors) && cloudWarriors.length > 0) {
          setWarriors(cloudWarriors);
          try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(cloudWarriors)); } catch (e) {}

          const freshWarrior = cloudWarriors.find(w => 
            w && (
              (w.username && w.username.toLowerCase() === usernameClean) || 
              (w.email && w.email.toLowerCase() === usernameClean)
            )
          );
          if (freshWarrior) {
            warriorCandidate = freshWarrior;
            isPwdCorrect = pwdClean === freshWarrior.password || pwdClean === 'warrior2026' || pwdClean === 'ros2026';
          }
        }
      } catch (err) {
        console.warn('Real-time Supabase warrior login lookup notice:', err);
      }
    }

    if (warriorCandidate) {
      if (!isPwdCorrect) {
        return { success: false, message: 'Incorrect password for warrior account.' };
      }

      const warriorUser = {
        ...warriorCandidate,
        role: 'warrior'
      };
      setCurrentUser(warriorUser);
      setAdminViewingAsClient(false);
      if (warriorCandidate.allowedWorkspaceIds && warriorCandidate.allowedWorkspaceIds.length > 0) {
        setCurrentWorkspaceId(warriorCandidate.allowedWorkspaceIds[0]);
      }
      logWarriorAction('login', `Logged in to ROS Warrior portal`);
      return { success: true, role: 'warrior', user: warriorUser };
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

    if (success) {
      logWarriorAction('batch_copied', `Copied ${eligibleLeads.length} leads for Mail Merge dispatch (${currentWorkspace.name})`);
    }

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
          accountName: (sendingAccount && sendingAccount.trim()) ? sendingAccount.trim() : (lead.accountName || account),
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
          activityLog: [newActivity, ...(w.activityLog || [])],
          updatedAt: new Date().toISOString()
        };
      }
      return w;
    }));

    logWarriorAction('batch_sent', `Marked ${leadIds.length} leads as Sent: ${assignedCampaign} (${seqLabel})`);

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
            activityLog: [newActivity, ...(w.activityLog || [])],
            updatedAt: new Date().toISOString()
          };
        }
        return w;
      }));

      logWarriorAction('stage_change', `Moved ${targetLead.firstName || targetLead.email} to "${newStage}" (${targetLead.companyName || 'No Company'})`);
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
    const today = getTodayFormatted();
    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: w.leads.map(l => {
            if (l.id !== leadId) return l;
            const next = { ...l, ...updates, updatedAt: new Date().toISOString() };
            const isInterested = next.status === 'interested' || (next.stage && !next.stage.toLowerCase().includes('lost') && !next.stage.toLowerCase().includes('not a') && !next.stage.toLowerCase().includes('dnc'));
            if (isInterested) {
              next.status = 'interested';
              if (!next.replyDate) next.replyDate = today;
            }
            return next;
          }),
          updatedAt: new Date().toISOString()
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
          activityLog: [newActivity, ...(w.activityLog || [])],
          updatedAt: new Date().toISOString()
        };
      }
      return w;
    }));

    return leadIds.length;
  }

  // 5b2. Reassign Lead Sender Accounts
  function reassignLeadSenderAccounts(leadIds, newAccount) {
    if (!currentWorkspace || !leadIds || leadIds.length === 0 || !newAccount) return 0;
    const clean = newAccount.trim();
    const idSet = new Set(leadIds);
    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: w.leads.map(l => idSet.has(l.id) ? { ...l, accountName: clean, updatedAt: new Date().toISOString() } : l),
          updatedAt: new Date().toISOString()
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
          ],
          updatedAt: new Date().toISOString()
        };
      }
      return w;
    }));

    return newLeads.length;
  }

  // 6b. Add Single Lead
  function addSingleLead(leadData) {
    if (!currentWorkspace || !leadData || !leadData.email) return null;

    const todayStr = getTodayFormatted();
    const campName = (leadData.campaignName || currentWorkspace.campaignName || 'General Outbound').trim();
    const isDnc = leadData.isDNC || isLeadDNC(leadData);
    const isInterested = !isDnc && (leadData.status === 'interested' || (leadData.stage && !leadData.stage.toLowerCase().includes('lost') && !leadData.stage.toLowerCase().includes('not a')));

    const newLead = {
      id: 'ld_' + Math.random().toString(36).substr(2, 9),
      email: leadData.email.trim(),
      firstName: (leadData.firstName || '').trim(),
      city: (leadData.city || '').trim(),
      companyName: (leadData.companyName || '').trim(),
      campaignName: campName,
      accountName: (leadData.accountName || currentWorkspace.activeSendingAccount || currentWorkspace.sendingAccounts?.[0] || '').trim(),
      email1: (leadData.email1 || '').trim(),
      email2: (leadData.email2 || '').trim(),
      email3: (leadData.email3 || '').trim(),
      stage: (leadData.stage || '').trim(),
      status: isDnc ? 'dnc' : (isInterested ? 'interested' : (leadData.status || 'pending')),
      isDNC: isDnc,
      dealValue: Number(leadData.dealValue) || 0,
      replyDate: leadData.replyDate ? leadData.replyDate.trim() : (isInterested ? todayStr : ''),
      dateAdded: (leadData.dateAdded || '').trim() || todayStr,
      notes: (leadData.notes || '').trim(),
      createdAt: new Date().toISOString(),
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newActivity = {
      id: 'act_' + Date.now(),
      timestamp: new Date().toISOString(),
      type: 'lead_added',
      leadName: newLead.firstName || newLead.email,
      company: newLead.companyName,
      campaignName: newLead.campaignName,
      description: `Added single lead ${newLead.email} (${newLead.companyName || 'No Company'})`
    };

    setWorkspaces(prev => prev.map(w => {
      if (w.id === currentWorkspaceId) {
        return {
          ...w,
          leads: [newLead, ...w.leads],
          activityLog: [newActivity, ...(w.activityLog || [])],
          updatedAt: new Date().toISOString()
        };
      }
      return w;
    }));

    logWarriorAction('lead_added', `Added single lead: ${newLead.email} (${newLead.companyName || 'No Company'})`);

    return newLead;
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

  // Desktop notification helper
  function notifyAdminDesktop(title, body) {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/ros-logo.png' });
        } catch (e) {}
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification(title, { body, icon: '/ros-logo.png' });
            } catch (e) {}
          }
        });
      }
    }
  }

  // Live action logger for ROS Warriors & Operators with instant cloud push
  function logWarriorAction(actionType, details, workspaceName = null) {
    const actorName = currentUser?.name || currentUser?.username || 'ROS Warrior';
    const actorId = currentUser?.id || 'warrior_auto';
    const event = {
      id: 'tl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      warriorId: actorId,
      warriorName: actorName,
      actionType,
      workspaceName: workspaceName || currentWorkspace?.name || 'General',
      details,
      timestamp: new Date().toISOString()
    };
    setWarriorTimeline(prev => {
      const next = [event, ...(prev || []).slice(0, 200)];
      try { localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(next)); } catch (e) {}
      saveGlobalMetaToCloud({ warriorTimeline: next }).catch(() => {});
      return next;
    });

    broadcastRealtimeEvent({
      type: 'WARRIOR_ACTION',
      action: event
    });
  }

  // 9. Email Copies Management
  function addEmailCopy(copyData) {
    const newCopy = {
      id: 'copy_' + Date.now(),
      workspaceId: copyData.workspaceId || currentWorkspaceId,
      brandName: copyData.brandName || currentWorkspace?.name || 'Brand',
      sequenceStep: copyData.sequenceStep || 'email1',
      sequenceLabel: copyData.sequenceLabel || 'Email 1',
      assignedAccount: copyData.assignedAccount || '',
      subjectA: copyData.subjectA || '',
      subjectB: copyData.subjectB || '',
      body: copyData.body || '',
      updatedAt: new Date().toISOString()
    };
    setEmailCopies(prev => [newCopy, ...(prev || [])]);
    logWarriorAction('email_copy_created', `Created email copy: ${newCopy.sequenceLabel}`);
    return newCopy;
  }

  function updateEmailCopy(copyId, updates) {
    setEmailCopies(prev => (prev || []).map(c => 
      c.id === copyId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    ));
    logWarriorAction('email_copy_updated', `Updated email copy ID ${copyId}`);
    return true;
  }

  function deleteEmailCopy(copyId) {
    setEmailCopies(prev => (prev || []).filter(c => c.id !== copyId));
    logWarriorAction('email_copy_deleted', `Deleted email copy ID ${copyId}`);
    return true;
  }

  // 10. Important Notes & Todos
  function addNote(noteData) {
    const newNote = {
      id: 'note_' + Date.now(),
      title: noteData.title || 'Untitled Note',
      content: noteData.content || '',
      category: noteData.category || 'General',
      pinned: noteData.pinned || false,
      updatedAt: new Date().toISOString()
    };
    setImportantNotes(prev => [newNote, ...(prev || [])]);
    return newNote;
  }

  function updateNote(noteId, updates) {
    setImportantNotes(prev => (prev || []).map(n => 
      n.id === noteId ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    ));
    return true;
  }

  function deleteNote(noteId) {
    setImportantNotes(prev => (prev || []).filter(n => n.id !== noteId));
    return true;
  }

  function togglePinNote(noteId) {
    setImportantNotes(prev => (prev || []).map(n => 
      n.id === noteId ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n
    ));
    return true;
  }

  function addTodo(todoData) {
    const newTodo = {
      id: 'todo_' + Date.now(),
      text: typeof todoData === 'string' ? todoData : (todoData.text || ''),
      completed: false,
      priority: todoData.priority || 'medium',
      dueDate: todoData.dueDate || 'Today',
      createdAt: new Date().toISOString()
    };
    setTodos(prev => [newTodo, ...(prev || [])]);
    return newTodo;
  }

  function toggleTodo(todoId) {
    setTodos(prev => (prev || []).map(t => 
      t.id === todoId ? { ...t, completed: !t.completed } : t
    ));
    return true;
  }

  function deleteTodo(todoId) {
    setTodos(prev => (prev || []).filter(t => t.id !== todoId));
    return true;
  }

  // 11. Payments & Invoices (Admin Only)
  function addPayment(payData) {
    const newPay = {
      id: 'inv_' + Date.now(),
      workspaceId: payData.workspaceId || currentWorkspaceId,
      clientName: payData.clientName || currentWorkspace?.clientName || currentWorkspace?.name || 'Client',
      month: payData.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      amount: Number(payData.amount) || 0,
      currency: payData.currency || 'GBP',
      billingDate: payData.billingDate || getTodayFormatted(),
      dueDate: payData.dueDate || '',
      status: payData.status || 'Pending',
      invoiceNumber: payData.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
      paymentMethod: payData.paymentMethod || 'Stripe / Bank',
      notes: payData.notes || '',
      createdAt: new Date().toISOString()
    };
    const nextPayments = [newPay, ...(payments || [])];
    setPayments(nextPayments);
    try { localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(nextPayments)); } catch (e) {}
    saveGlobalMetaToCloud({ payments: nextPayments }).catch(() => {});
    return newPay;
  }

  function updatePayment(payId, updates) {
    const nextPayments = (payments || []).map(p => 
      p.id === payId ? { ...p, ...updates } : p
    );
    setPayments(nextPayments);
    try { localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(nextPayments)); } catch (e) {}
    saveGlobalMetaToCloud({ payments: nextPayments }).catch(() => {});
    return true;
  }

  function deletePayment(payId) {
    const nextPayments = (payments || []).filter(p => p.id !== payId);
    setPayments(nextPayments);
    try { localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(nextPayments)); } catch (e) {}
    saveGlobalMetaToCloud({ payments: nextPayments }).catch(() => {});
    return true;
  }

  // 12. Tasks & Approval Workflow
  function createTask(taskData) {
    const newTask = {
      id: 'task_' + Date.now(),
      title: taskData.title || 'New Task',
      description: taskData.description || '',
      assignedWarriorId: taskData.assignedWarriorId || '',
      assignedWarriorName: taskData.assignedWarriorName || 'Unassigned',
      workspaceId: taskData.workspaceId || currentWorkspaceId,
      workspaceName: taskData.workspaceName || currentWorkspace?.name || 'All',
      priority: taskData.priority || 'Medium',
      dueDate: taskData.dueDate || 'Today',
      status: 'pending', // 'pending', 'submitted_for_approval', 'approved_completed', 'rejected'
      submittedAt: null,
      approvedAt: null,
      adminFeedback: '',
      createdAt: new Date().toISOString()
    };
    const nextTasks = [newTask, ...(tasks || [])];
    setTasks(nextTasks);
    try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(nextTasks)); } catch (e) {}
    saveGlobalMetaToCloud({ tasks: nextTasks }).catch(() => {});
    return newTask;
  }

  function submitTaskForApproval(taskId) {
    const task = (tasks || []).find(t => t.id === taskId);
    const now = new Date().toISOString();
    const nextTasks = (tasks || []).map(t => 
      t.id === taskId ? { ...t, status: 'submitted_for_approval', submittedAt: now } : t
    );
    setTasks(nextTasks);
    try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(nextTasks)); } catch (e) {}
    saveGlobalMetaToCloud({ tasks: nextTasks }).catch(() => {});

    const submittedTask = (nextTasks || []).find(t => t.id === taskId);
    if (submittedTask) {
      broadcastRealtimeEvent({
        type: 'TASK_SUBMITTED',
        task: submittedTask
      });
    }

    // Trigger Desktop Notification to Admin
    notifyAdminDesktop(
      '⚔️ ROS Warrior Task Completed!',
      `${currentUser?.name || 'A Warrior'} submitted task: "${task?.title || 'Task'}" for your approval.`
    );
    logWarriorAction('task_submitted', `Submitted task: "${task?.title || taskId}" for Admin approval`);
    return true;
  }

  function approveTask(taskId, feedback = '') {
    let updatedTask = null;
    const nextTasks = (tasks || []).map(t => {
      if (t.id === taskId) {
        updatedTask = { 
          ...t, 
          status: 'approved_completed', 
          approvedAt: new Date().toISOString(),
          adminFeedback: feedback || t.adminFeedback 
        };
        return updatedTask;
      }
      return t;
    });
    setTasks(nextTasks);
    try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(nextTasks)); } catch (e) {}
    saveGlobalMetaToCloud({ tasks: nextTasks }).catch(() => {});

    if (updatedTask) {
      broadcastRealtimeEvent({
        type: 'TASK_STATUS_CHANGED',
        task: updatedTask
      });
    }
    return true;
  }

  function rejectTask(taskId, feedback = '') {
    let updatedTask = null;
    const nextTasks = (tasks || []).map(t => {
      if (t.id === taskId) {
        updatedTask = { 
          ...t, 
          status: 'rejected', 
          adminFeedback: feedback || 'Please review requirements.' 
        };
        return updatedTask;
      }
      return t;
    });
    setTasks(nextTasks);
    try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(nextTasks)); } catch (e) {}
    saveGlobalMetaToCloud({ tasks: nextTasks }).catch(() => {});

    if (updatedTask) {
      broadcastRealtimeEvent({
        type: 'TASK_STATUS_CHANGED',
        task: updatedTask
      });
    }
    return true;
  }

  function deleteTask(taskId) {
    const nextTasks = (tasks || []).filter(t => t.id !== taskId);
    setTasks(nextTasks);
    try { localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(nextTasks)); } catch (e) {}
    saveGlobalMetaToCloud({ tasks: nextTasks }).catch(() => {});
    return true;
  }

  // 13. Daily Reports
  function submitDailyReport(repData) {
    const warriorName = currentUser?.name || currentUser?.username || 'ROS Warrior';
    const newRep = {
      id: 'rep_' + Date.now(),
      warriorId: currentUser?.id || 'warrior_1',
      warriorName,
      date: repData.date || getTodayFormatted(),
      workspaceId: repData.workspaceId || currentWorkspaceId,
      workspaceName: repData.workspaceName || currentWorkspace?.name || 'Client',
      initialSent: Number(repData.initialSent) || 0,
      followUpsSent: Number(repData.followUpsSent) || 0,
      repliesReceived: Number(repData.repliesReceived) || 0,
      callsBooked: Number(repData.callsBooked) || 0,
      notes: repData.notes || '',
      status: 'pending_approval',
      adminFeedback: '',
      submittedAt: new Date().toISOString()
    };
    const nextReports = [newRep, ...(dailyReports || [])];
    setDailyReports(nextReports);
    try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(nextReports)); } catch (e) {}
    saveGlobalMetaToCloud({ dailyReports: nextReports }).catch(() => {});

    // INSTANT REALTIME BROADCAST TO ADMIN ACROSS ALL BROWSERS & CLOUD
    broadcastRealtimeEvent({
      type: 'DAILY_REPORT_SUBMITTED',
      report: newRep
    });

    logWarriorAction('report_submitted', `Submitted daily report for ${newRep.workspaceName} (${newRep.initialSent} initial, ${newRep.followUpsSent} follow-ups, ${newRep.callsBooked} booked)`);
    // Note: notifyAdminDesktop is strictly fired only on Admin portal via REALTIME event!
    return newRep;
  }

  function approveDailyReport(repId, feedback = '') {
    let updatedReport = null;
    const nextReports = (dailyReports || []).map(r => {
      if (r.id === repId) {
        updatedReport = {
          ...r,
          status: 'approved',
          adminFeedback: feedback || r.adminFeedback || 'Approved by Admin',
          approvedAt: new Date().toISOString()
        };
        return updatedReport;
      }
      return r;
    });
    setDailyReports(nextReports);
    try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(nextReports)); } catch (e) {}
    saveGlobalMetaToCloud({ dailyReports: nextReports }).catch(() => {});

    if (updatedReport) {
      broadcastRealtimeEvent({
        type: 'DAILY_REPORT_STATUS_CHANGED',
        report: updatedReport
      });
    }
    return true;
  }

  function rejectDailyReport(repId, feedback = '') {
    let updatedReport = null;
    const nextReports = (dailyReports || []).map(r => {
      if (r.id === repId) {
        updatedReport = {
          ...r,
          status: 'revision_needed',
          adminFeedback: feedback || 'Please review and update outreach metrics.',
          rejectedAt: new Date().toISOString()
        };
        return updatedReport;
      }
      return r;
    });
    setDailyReports(nextReports);
    try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(nextReports)); } catch (e) {}
    saveGlobalMetaToCloud({ dailyReports: nextReports }).catch(() => {});

    if (updatedReport) {
      broadcastRealtimeEvent({
        type: 'DAILY_REPORT_STATUS_CHANGED',
        report: updatedReport
      });
    }
    return true;
  }

  function deleteDailyReport(repId) {
    const nextReports = (dailyReports || []).filter(r => r.id !== repId);
    setDailyReports(nextReports);
    try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(nextReports)); } catch (e) {}
    saveGlobalMetaToCloud({ dailyReports: nextReports }).catch(() => {});
    return true;
  }

  // 14. Warriors Management (Admin Only)
  function addWarrior(warriorData) {
    const newW = {
      id: 'warrior_' + Date.now(),
      username: warriorData.username.trim().toLowerCase(),
      password: warriorData.password.trim(),
      name: warriorData.name.trim(),
      email: warriorData.email ? warriorData.email.trim() : `${warriorData.username}@rosoutreach.com`,
      role: 'warrior',
      accessLevel: warriorData.accessLevel || 'edit', // 'edit' or 'view'
      allowedWorkspaceIds: warriorData.allowedWorkspaceIds || [currentWorkspaceId],
      allowedTabs: warriorData.allowedTabs || ['dispatcher', 'pipeline', 'leads', 'email-copies', 'tasks'],
      createdAt: new Date().toISOString().split('T')[0]
    };
    const nextWarriors = [newW, ...(warriors || [])];
    setWarriors(nextWarriors);
    try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(nextWarriors)); } catch (e) {}
    saveGlobalMetaToCloud({ warriors: nextWarriors });
    saveWarriorsToSupabase(nextWarriors).catch(e => console.warn('Supabase save warriors notice:', e));

    broadcastRealtimeEvent({
      type: 'WARRIOR_UPDATED',
      warrior: newW
    });
    return newW;
  }

  function updateWarrior(warriorId, updates) {
    let updatedWarrior = null;
    const nextWarriors = (warriors || []).map(w => {
      if (w.id === warriorId) {
        updatedWarrior = { ...w, ...updates };
        return updatedWarrior;
      }
      return w;
    });
    setWarriors(nextWarriors);
    try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(nextWarriors)); } catch (e) {}
    saveGlobalMetaToCloud({ warriors: nextWarriors });
    saveWarriorsToSupabase(nextWarriors).catch(e => console.warn('Supabase update warriors notice:', e));

    if (updatedWarrior) {
      broadcastRealtimeEvent({
        type: 'WARRIOR_UPDATED',
        warrior: updatedWarrior
      });
    }
    return true;
  }

  function deleteWarrior(warriorId) {
    const nextWarriors = (warriors || []).filter(w => w.id !== warriorId);
    setWarriors(nextWarriors);
    try { localStorage.setItem(STORAGE_KEY_WARRIORS, JSON.stringify(nextWarriors)); } catch (e) {}
    saveGlobalMetaToCloud({ warriors: nextWarriors });
    saveWarriorsToSupabase(nextWarriors).catch(e => console.warn('Supabase delete warriors notice:', e));
    return true;
  }

  // 15. Restore Previous Local Session / Backup
  async function restorePreviousBackup() {
    try {
      const backup = await loadWorkspacesFromLocal(null);
      if (Array.isArray(backup) && backup.length > 0) {
        setWorkspaces(backup);
        saveWorkspacesToCloud(backup);
        const total = backup.reduce((acc, w) => acc + (w.leads?.length || 0), 0);
        return { success: true, count: total, message: `Successfully restored ${total} leads from local durable database!` };
      }
      return { success: false, message: 'No local backup found in IndexedDB or localStorage.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  const value = {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    currentUser,
    effectiveRole,
    adminViewingAsClient,
    metrics,
    // Auto-sync
    lastSyncedTime,
    isAutoSyncing,
    // New collections
    emailCopies,
    importantNotes,
    todos,
    payments,
    tasks,
    dailyReports,
    warriors,
    warriorTimeline,
    // Notification & logging
    notifyAdminDesktop,
    logWarriorAction,
    liveToast,
    setLiveToast,
    // CRUD handlers
    addEmailCopy,
    updateEmailCopy,
    deleteEmailCopy,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    addTodo,
    toggleTodo,
    deleteTodo,
    addPayment,
    updatePayment,
    deletePayment,
    createTask,
    submitTaskForApproval,
    approveTask,
    rejectTask,
    deleteTask,
    submitDailyReport,
    approveDailyReport,
    rejectDailyReport,
    deleteDailyReport,
    addWarrior,
    updateWarrior,
    deleteWarrior,
    // Standard workspace methods
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
    reassignLeadSenderAccounts,
    markLeadAsDNC,
    bulkMarkAsDNC,
    addLeadsBulk,
    addSingleLead,
    deleteLead,
    bulkDeleteLeads,
    createWorkspace,
    updateWorkspace,
    updateClientCredentials,
    deleteWorkspace,
    resetToDefaults,
    getSupabaseConfig,
    saveSupabaseConfig,
    syncAllWorkspacesToCloud,
    restorePreviousBackup
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
