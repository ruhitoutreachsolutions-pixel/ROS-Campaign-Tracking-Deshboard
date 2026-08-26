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
