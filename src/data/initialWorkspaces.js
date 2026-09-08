export const initialWorkspaces = [
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
    workspaceId: 'ws_crewlixukltd',
    brandName: 'Crewlix UK Ltd',
    sequenceStep: 'email1',
    sequenceLabel: 'Email 1 (Initial Cold Touch)',
    assignedAccount: 'hello@crewlixukltd.com',
    subjectA: 'Quick inquiry regarding qualified care staff for {companyName}',
    subjectB: 'Reliable healthcare staffing solution for {city} care homes',
    body: `Hi {firstName},

I hope this finds you well.

I noticed {companyName} has been delivering exceptional care services across {city}. We currently support premier UK healthcare providers by supplying pre-vetted, compliant nurses and senior carers ready on short notice.

Are you open to reviewing our rate card or having a brief 5-minute chat this week?

Best regards,
Outreach Team · Crewlix UK Ltd`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'copy_2',
    workspaceId: 'ws_crewlixukltd',
    brandName: 'Crewlix UK Ltd',
    sequenceStep: 'email2',
    sequenceLabel: 'Email 2 (Follow-up 1 - Value Add)',
    assignedAccount: 'hello@crewlixukltd.com',
    subjectA: 'Quick follow-up: staffing support for {companyName}',
    subjectB: 'Sharing our care home case study ({city})',
    body: `Hi {firstName},

Following up on my previous note. We recently helped a fellow care provider in {city} reduce agency expenditure by 22% while ensuring 100% shift coverage.

Would it be worth sending over a quick 2-page overview of how we achieve this?

Kind regards,
Crewlix UK Ltd Outreach`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'copy_3',
    workspaceId: 'ws_crewlixukltd',
    brandName: 'Crewlix UK Ltd',
    sequenceStep: 'email3',
    sequenceLabel: 'Email 3 (Follow-up 2 - Breakup / Case Study)',
    assignedAccount: 'hello@crewlixukltd.com',
    subjectA: 'Permission to close your file, {firstName}?',
    subjectB: 'Final check-in regarding {companyName} staffing',
    body: `Hi {firstName},

I understand you're likely swamped managing care operations at {companyName}.

I will assume staffing is completely sorted for now. If requirements come up in the future, feel free to keep my details handy.

Wishing you and the team all the best!

Warm regards,
Crewlix UK Ltd`,
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
  { id: 'todo_2', text: 'Check bounce rates across active sending accounts', completed: true, priority: 'medium', dueDate: 'Yesterday' },
  { id: 'todo_3', text: 'Update monthly invoice status for active clients', completed: false, priority: 'medium', dueDate: '10/09/26' }
];

// 3. Initial Client Payments & Retainer Invoices (Admin Only) - Empty by default, no demo data
export const initialPayments = [];

// 4. Initial Tasks & Real-Time Approval Workflows (Empty by default)
export const initialTasks = [];

// 5. Initial Daily Outreach Reports (Empty by default)
export const initialDailyReports = [];

// 6. ROS Warriors (Managers) - No demo accounts; created by Admin
export const initialWarriors = [];

// 7. Warrior Action Timeline (Live Action Spy / Audit)
export const initialWarriorTimeline = [];

