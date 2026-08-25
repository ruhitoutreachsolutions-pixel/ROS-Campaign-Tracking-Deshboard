import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { X, Building2, KeyRound, Mail, Plus, Trash2, Check, Copy, Shield } from 'lucide-react';

export default function WorkspaceModal({ isOpen, onClose, editMode = false }) {
  const { currentWorkspace, createWorkspace, updateWorkspace, deleteWorkspace } = useWorkspace();

  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [sendingAccount, setSendingAccount] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('client2026');
  const [copiedCreds, setCopiedCreds] = useState(false);

  useEffect(() => {
    if (editMode && currentWorkspace) {
      setName(currentWorkspace.name || '');
      setClientName(currentWorkspace.clientName || '');
      setClientEmail(currentWorkspace.clientEmail || '');
      setCampaignName(currentWorkspace.campaignName || '');
      setSendingAccount(currentWorkspace.activeSendingAccount || currentWorkspace.sendingAccounts?.[0] || '');
      setUsername(currentWorkspace.clientCredentials?.username || '');
      setPassword(currentWorkspace.clientCredentials?.password || 'client2026');
    } else if (!editMode) {
      setName('');
      setClientName('');
      setClientEmail('');
      setCampaignName('Cold Outreach Campaign');
      setSendingAccount('');
      setUsername('');
      setPassword('client2026');
    }
  }, [editMode, currentWorkspace, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editMode && currentWorkspace) {
      updateWorkspace(currentWorkspace.id, {
        name,
        clientName: clientName || name,
        clientEmail,
        campaignName,
        activeSendingAccount: sendingAccount,
        sendingAccounts: [sendingAccount],
        clientCredentials: {
          username: (username || name.toLowerCase().replace(/\s+/g, '')).trim(),
          password: (password || 'client2026').trim()
        }
      });
    } else {
      createWorkspace({
        name,
        clientName: clientName || name,
        clientEmail,
        campaignName: campaignName || 'Cold Outreach Campaign',
        sendingAccounts: [sendingAccount || 'hello@clientdomain.com'],
        username: (username || name.toLowerCase().replace(/\s+/g, '')).trim(),
        password: (password || 'client2026').trim()
      });
    }

    onClose();
  };

  const handleCopyCredentials = () => {
    const credText = `ROS Campaign Tracking Dashboard\nClient: ${name || 'Your Campaign'}\nUsername: ${username || name.toLowerCase().replace(/\s+/g, '')}\nPassword: ${password}\nURL: ${window.location.origin}`;
    navigator.clipboard.writeText(credText);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2500);
  };

  const handleDelete = () => {
    if (!currentWorkspace) return;
    if (window.confirm(`Are you sure you want to delete workspace "${currentWorkspace.name}" and all its leads?`)) {
      deleteWorkspace(currentWorkspace.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0A]/85 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-2xl bg-[#111827] border border-[#1E3A5F] shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg bg-[#0A0A0A] hover:bg-[#1E3A5F] text-[#7B7B7B] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#1E3A5F]">
          <div className="p-2.5 rounded-xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {editMode ? 'Client Workspace & Login Credentials' : 'Create New Client Workspace'}
            </h3>
            <p className="text-xs text-[#7B7B7B]">
              Configure client details, sending accounts, and client login password.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-[#00C2FF] uppercase tracking-wider mb-1">
              Workspace / Client Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!username && !editMode) {
                  setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''));
                }
              }}
              placeholder="e.g. Crewlix Global or Acme Corp"
              className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Campaign Name
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. B2B Outbound Campaign"
                className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs outline-none focus:border-[#00C2FF]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                Sending Email Account
              </label>
              <input
                type="email"
                value={sendingAccount}
                onChange={(e) => setSendingAccount(e.target.value)}
                placeholder="e.g. hello@crewlixglobal.com"
                className="w-full px-3.5 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-white text-xs font-mono outline-none focus:border-[#00C2FF]"
              />
            </div>
          </div>

          {/* Client Portal Login Credentials (Editable Anytime) */}
          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#00E5A0]/40 space-y-3 green-glow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#00E5A0] uppercase tracking-wider">
                <KeyRound className="w-4 h-4 text-[#00E5A0]" />
                <span>Client Portal Login Credentials</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="px-2 py-1 rounded bg-[#111827] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-[10px] font-semibold text-[#00C2FF] flex items-center gap-1 transition-all"
              >
                {copiedCreds ? <Check className="w-3 h-3 text-[#00E5A0]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCreds ? 'Copied!' : 'Copy for Client'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                  Client Username *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. crewlix"
                  className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00E5A0] rounded-lg text-white text-xs font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-300 font-semibold mb-1">
                  Client Password *
                </label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g. crewlix2026"
                  className="w-full px-3 py-2 bg-[#111827] border border-[#1E3A5F] focus:border-[#00E5A0] rounded-lg text-white text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>
            
            <p className="text-[10px] text-[#7B7B7B]">
              Your client will enter this username and password on the login page to access their private campaign dashboard.
            </p>
          </div>

          <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-between gap-3">
            {editMode ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-[#1E3A5F] border border-[#1E3A5F] text-xs font-semibold text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#00C2FF] hover:bg-[#00C2FF]/90 text-[#0A0A0A] text-xs font-bold transition-all shadow cursor-pointer"
              >
                {editMode ? 'Save Settings & Credentials' : 'Create Workspace'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
