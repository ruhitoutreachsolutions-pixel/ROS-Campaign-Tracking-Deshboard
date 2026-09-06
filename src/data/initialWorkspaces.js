export const initialWorkspaces = [
  {
    id: 'ws_crewlixuk',
    name: 'Crewlix UK',
    clientName: 'Crewlix UK',
    clientEmail: 'contact@crewlixuk.com',
    campaignName: 'Care Campaign',
    sendingAccounts: ['hello@crewlixuk.com'],
    activeSendingAccount: 'hello@crewlixuk.com',
    clientCredentials: {
      username: 'crewlixuk',
      password: 'crewlix2026'
    },
    createdAt: new Date().toISOString().split('T')[0],
    sequenceConfig: {
      email1Name: 'Initial Outreach',
      email2Name: 'Follow-up 1 (Value Add)',
      email3Name: 'Follow-up 2 (Breakup / Case Study)',
      daysBetween1and2: 3,
      daysBetween2and3: 4
    },
    activityLog: [],
    leads: []
  },
  {
    id: 'ws_crewlix',
    name: 'Crewlix Global',
    clientName: 'Crewlix Global Recruitment',
    clientEmail: 'contact@crewlixglobal.com',
    campaignName: 'Care Campaign',
    sendingAccounts: ['hello@crewlixglobal.com'],
    activeSendingAccount: 'hello@crewlixglobal.com',
    clientCredentials: {
      username: 'crewlix',
      password: 'crewlix2026'
    },
    createdAt: new Date().toISOString().split('T')[0],
    sequenceConfig: {
      email1Name: 'Initial Outreach',
      email2Name: 'Follow-up 1 (Value Add)',
      email3Name: 'Follow-up 2 (Breakup / Case Study)',
      daysBetween1and2: 3,
      daysBetween2and3: 4
    },
    activityLog: [],
    leads: []
  },
  {
    id: 'ws_crewlixukltd',
    name: 'Crewlix UK Ltd',
    clientName: 'Crewlix UK Ltd',
    clientEmail: 'contact@crewlixukltd.com',
    campaignName: 'Care Campaign',
    sendingAccounts: ['hello@crewlixukltd.com'],
    activeSendingAccount: 'hello@crewlixukltd.com',
    clientCredentials: {
      username: 'crewlixukltd',
      password: 'crewlix2026'
    },
    createdAt: new Date().toISOString().split('T')[0],
    sequenceConfig: {
      email1Name: 'Initial Outreach',
      email2Name: 'Follow-up 1 (Value Add)',
      email3Name: 'Follow-up 2 (Breakup / Case Study)',
      daysBetween1and2: 3,
      daysBetween2and3: 4
    },
    activityLog: [],
    leads: []
  }
];

export const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'ros2026',
  name: 'Ruhit (Agency Admin)',
  email: 'ruhitahmed111@gmail.com'
};

// Standard Pipeline Stages
export const PIPELINE_STAGES = [
  { slug: 'interested', label: 'Interested / Positive Reply', color: '#00C2FF', bg: 'rgba(0, 194, 255, 0.15)', icon: 'Target' },
  { slug: 'booked', label: 'Discovery Call Booked', color: '#00E5A0', bg: 'rgba(0, 229, 160, 0.15)', icon: 'Calendar' },
  { slug: 'proposal', label: 'Proposal / Audit Sent', color: '#00C2FF', bg: 'rgba(0, 194, 255, 0.15)', icon: 'FileText' },
  { slug: 'negotiation', label: 'Negotiation', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', icon: 'Handshake' },
  { slug: 'won', label: 'Closed Won', color: '#00E5A0', bg: 'rgba(0, 229, 160, 0.25)', icon: 'Trophy' },
  { slug: 'lost', label: 'Not a Fit', color: '#7B7B7B', bg: 'rgba(123, 123, 123, 0.15)', icon: 'Xbar' }
];

// 1. Initial Email Copies (with dual subject lines for A/B testing)
export const initialEmailCopies = [
  {
    id: 'copy_1',
    workspaceId: 'ws_crewlixuk',
    brandName: 'Crewlix UK',
    sequenceStep: 'email1',
    sequenceLabel: 'Email 1 (Initial Cold Touch)',
    assignedAccount: 'juned@crewlixglobal.com',
    subjectA: 'Quick inquiry regarding qualified care staff for {companyName}',
    subjectB: 'Reliable healthcare staffing solution for {city} care homes',
    body: `Hi {firstName},

I hope this finds you well.

I noticed {companyName} has been delivering exceptional care services across {city}. We currently support premier UK healthcare providers by supplying pre-vetted, compliant nurses and senior carers ready on short notice.

Are you open to reviewing our rate card or having a brief 5-minute chat this week?

Best regards,
Outreach Team · Crewlix UK`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'copy_2',
    workspaceId: 'ws_crewlixuk',
    brandName: 'Crewlix UK',
    sequenceStep: 'email2',
    sequenceLabel: 'Email 2 (Follow-up 1 - Value Add)',
    assignedAccount: 'juned@crewlixglobal.com',
    subjectA: 'Quick follow-up: staffing support for {companyName}',
    subjectB: 'Sharing our care home case study ({city})',
    body: `Hi {firstName},

Following up on my previous note. We recently helped a fellow care provider in {city} reduce agency expenditure by 22% while ensuring 100% shift coverage.

Would it be worth sending over a quick 2-page overview of how we achieve this?

Kind regards,
Crewlix UK Outreach`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'copy_3',
    workspaceId: 'ws_crewlixuk',
    brandName: 'Crewlix UK',
    sequenceStep: 'email3',
    sequenceLabel: 'Email 3 (Follow-up 2 - Breakup / Case Study)',
    assignedAccount: 'juned@crewlixglobal.com',
    subjectA: 'Permission to close your file, {firstName}?',
    subjectB: 'Final check-in regarding {companyName} staffing',
    body: `Hi {firstName},

I understand you're likely swamped managing care operations at {companyName}.

I will assume staffing is completely sorted for now. If requirements come up in the future, feel free to keep my details handy.

Wishing you and the team all the best!

Warm regards,
Crewlix UK`,
    updatedAt: new Date().toISOString()
  }
];

// 2. Initial Important Notes & To-Do List
export const initialImportantNotes = [
  {
    id: 'note_1',
    title: 'Daily Mailbox Sending Limits',
    content: 'Keep sending accounts capped at 30-35 emails per mailbox per day with 45-90s delay to protect Google Workspace SPF/DKIM reputation.',
    category: 'Deliverability',
    pinned: true,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'note_2',
    title: 'UK Time Zone Outreach Window',
    content: 'Best dispatch hours for UK healthcare decision makers: 09:30 AM to 11:45 AM, and 02:15 PM to 04:30 PM GMT on Tuesdays through Thursdays.',
    category: 'Strategy',
    pinned: true,
    updatedAt: new Date().toISOString()
  }
];

export const initialTodos = [
  { id: 'todo_1', text: 'Dispatch 250 follow-ups for Crewlix UK Ltd', completed: false, priority: 'high', dueDate: 'Today' },
  { id: 'todo_2', text: 'Check bounce rates across juned@ and amit@ accounts', completed: true, priority: 'medium', dueDate: 'Yesterday' },
  { id: 'todo_3', text: 'Update monthly invoice status for Crewlix Global', completed: false, priority: 'medium', dueDate: '10/09/26' }
];

// 3. Initial Client Payments & Retainer Invoices (Admin Only)
export const initialPayments = [
  {
    id: 'inv_101',
    workspaceId: 'ws_crewlixuk',
    clientName: 'Crewlix UK',
    month: 'September 2026',
    amount: 1500,
    currency: 'GBP',
    billingDate: '01/09/2026',
    dueDate: '15/09/2026',
    status: 'Paid',
    invoiceNumber: 'INV-ROS-2026-091',
    paymentMethod: 'Wise Bank Transfer',
    notes: 'Monthly cold outbound lead generation retainer paid in full.'
  },
  {
    id: 'inv_102',
    workspaceId: 'ws_crewlixukltd',
    clientName: 'Crewlix UK Ltd',
    month: 'September 2026',
    amount: 1750,
    currency: 'GBP',
    billingDate: '05/09/2026',
    dueDate: '20/09/2026',
    status: 'Pending',
    invoiceNumber: 'INV-ROS-2026-092',
    paymentMethod: 'Direct Debit / Stripe',
    notes: 'Includes Mail Merge dedicated warmups and 3,000 monthly verified prospects.'
  },
  {
    id: 'inv_103',
    workspaceId: 'ws_crewlix',
    clientName: 'Crewlix Global',
    month: 'August 2026',
    amount: 2000,
    currency: 'USD',
    billingDate: '01/08/2026',
    dueDate: '15/08/2026',
    status: 'Paid',
    invoiceNumber: 'INV-ROS-2026-085',
    paymentMethod: 'Stripe Card',
    notes: 'Full payment received with positive ROI.'
  }
];

// 4. Initial Tasks & Real-Time Approval Workflows
export const initialTasks = [
  {
    id: 'task_1',
    title: 'Dispatch Follow-up 1 Batch (300 Leads)',
    description: 'Filter by juned@ sending mailbox and dispatch Email 2 follow-ups on Crewlix UK campaign. Ensure DNC leads are excluded.',
    assignedWarriorId: 'warrior_1',
    assignedWarriorName: 'Farhan (Outreach Lead)',
    workspaceId: 'ws_crewlixuk',
    workspaceName: 'Crewlix UK',
    priority: 'High',
    dueDate: '07/09/2026 - 02:00 PM',
    status: 'pending', // 'pending', 'submitted_for_approval', 'approved_completed', 'rejected'
    submittedAt: null,
    approvedAt: null,
    adminFeedback: '',
    createdAt: new Date().toISOString()
  },
  {
    id: 'task_2',
    title: 'Update Positive Replies in Interested Pipeline',
    description: 'Check inbox for responses and move interested prospects to "Discovery Call Booked" with correct deal values.',
    assignedWarriorId: 'warrior_1',
    assignedWarriorName: 'Farhan (Outreach Lead)',
    workspaceId: 'ws_crewlixuk',
    workspaceName: 'Crewlix UK',
    priority: 'Medium',
    dueDate: '07/09/2026 - 05:00 PM',
    status: 'submitted_for_approval',
    submittedAt: new Date(Date.now() - 3600000).toISOString(),
    approvedAt: null,
    adminFeedback: '',
    createdAt: new Date(Date.now() - 7200000).toISOString()
  }
];

// 5. Initial Daily Outreach Reports
export const initialDailyReports = [
  {
    id: 'rep_1',
    warriorId: 'warrior_1',
    warriorName: 'Farhan (Outreach Lead)',
    date: '06/09/2026',
    workspaceId: 'ws_crewlixuk',
    workspaceName: 'Crewlix UK',
    initialSent: 150,
    followUpsSent: 420,
    repliesReceived: 3,
    callsBooked: 1,
    notes: 'Healthy deliverability across all 12 sending mailboxes. Zero spam complaints.',
    submittedAt: new Date(Date.now() - 86400000).toISOString()
  }
];

// 6. Initial ROS Warriors (Managers)
export const initialWarriors = [
  {
    id: 'warrior_1',
    username: 'farhan',
    password: 'warrior2026',
    name: 'Farhan (Outreach Lead)',
    email: 'farhan@rosoutreach.com',
    role: 'warrior',
    accessLevel: 'edit', // 'edit' (Use & Edit) or 'view' (View Only)
    allowedWorkspaceIds: ['ws_crewlixuk', 'ws_crewlixukltd'],
    allowedTabs: ['dispatcher', 'pipeline', 'leads', 'email-copies', 'tasks'], // Payments is NEVER allowed
    createdAt: '2026-08-20'
  },
  {
    id: 'warrior_2',
    username: 'sakib',
    password: 'warrior2026',
    name: 'Sakib (Campaign Specialist)',
    email: 'sakib@rosoutreach.com',
    role: 'warrior',
    accessLevel: 'view',
    allowedWorkspaceIds: ['ws_crewlix'],
    allowedTabs: ['dispatcher', 'pipeline', 'leads', 'tasks'],
    createdAt: '2026-08-25'
  }
];

// 7. Initial Warrior Action Timeline (Live Action Spy / Audit)
export const initialWarriorTimeline = [
  {
    id: 'tl_1',
    warriorId: 'warrior_1',
    warriorName: 'Farhan (Outreach Lead)',
    actionType: 'batch_copied',
    workspaceName: 'Crewlix UK',
    details: 'Copied 50 leads for Email 2 Mail Merge dispatch',
    timestamp: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'tl_2',
    warriorId: 'warrior_1',
    warriorName: 'Farhan (Outreach Lead)',
    actionType: 'task_submitted',
    workspaceName: 'Crewlix UK',
    details: 'Submitted task: "Update Positive Replies in Interested Pipeline"',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];

