import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  CreditCard, DollarSign, Plus, CheckCircle2, Clock, AlertTriangle, 
  Trash2, Edit3, Download, Search, Filter, ShieldAlert, FileText, ArrowUpRight
} from 'lucide-react';

export default function PaymentsInvoices() {
  const { 
    payments, 
    addPayment, 
    updatePayment, 
    deletePayment, 
    workspaces, 
    effectiveRole,
    currentUser 
  } = useWorkspace();

  // Strict role check: Admin only
  if (effectiveRole !== 'admin') {
    return (
      <div className="bg-[#111827] rounded-2xl border border-rose-500/30 p-12 text-center shadow-xl my-6">
        <ShieldAlert className="w-16 h-16 text-rose-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-gray-400 max-w-md mx-auto text-sm">
          The Payments & Invoices portal is strictly confidential and restricted to Super Admins. ROS Warriors and Clients do not have permission to view billing data.
        </p>
      </div>
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const [formData, setFormData] = useState({
    workspaceId: workspaces[0]?.id || '',
    clientName: workspaces[0]?.name || '',
    month: 'September 2026',
    amount: '',
    currency: 'GBP',
    billingDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    status: 'Pending',
    invoiceNumber: `INV-ROS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    paymentMethod: 'Wise Bank Transfer',
    notes: ''
  });

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return (payments || []).filter(p => {
      const matchesSearch = 
        (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesWorkspace = selectedWorkspaceFilter === 'all' || p.workspaceId === selectedWorkspaceFilter;
      const matchesStatus = selectedStatusFilter === 'all' || p.status.toLowerCase() === selectedStatusFilter.toLowerCase();
      const matchesCurrency = currencyFilter === 'all' || p.currency === currencyFilter;

      return matchesSearch && matchesWorkspace && matchesStatus && matchesCurrency;
    });
  }, [payments, searchTerm, selectedWorkspaceFilter, selectedStatusFilter, currencyFilter]);

  // Metrics Calculations
  const stats = useMemo(() => {
    let totalMRRGBP = 0;
    let totalMRRUSD = 0;
    let paidGBP = 0;
    let paidUSD = 0;
    let pendingGBP = 0;
    let pendingUSD = 0;
    let overdueCount = 0;

    (payments || []).forEach(p => {
      const amt = Number(p.amount) || 0;
      if (p.currency === 'USD') {
        totalMRRUSD += amt;
        if (p.status === 'Paid') paidUSD += amt;
        if (p.status === 'Pending') pendingUSD += amt;
      } else {
        totalMRRGBP += amt;
        if (p.status === 'Paid') paidGBP += amt;
        if (p.status === 'Pending') pendingGBP += amt;
      }
      if (p.status === 'Overdue') overdueCount++;
    });

    return { totalMRRGBP, totalMRRUSD, paidGBP, paidUSD, pendingGBP, pendingUSD, overdueCount };
  }, [payments]);

  // Open Modal for New
  const handleOpenNew = () => {
    setEditingPayment(null);
    setFormData({
      workspaceId: workspaces[0]?.id || '',
      clientName: workspaces[0]?.name || '',
      month: 'September 2026',
      amount: '',
      currency: 'GBP',
      billingDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'Pending',
      invoiceNumber: `INV-ROS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      paymentMethod: 'Wise Bank Transfer',
      notes: ''
    });
    setShowModal(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (payment) => {
    setEditingPayment(payment);
    setFormData({
      workspaceId: payment.workspaceId || '',
      clientName: payment.clientName || '',
      month: payment.month || 'September 2026',
      amount: payment.amount || '',
      currency: payment.currency || 'GBP',
      billingDate: payment.billingDate || '',
      dueDate: payment.dueDate || '',
      status: payment.status || 'Pending',
      invoiceNumber: payment.invoiceNumber || '',
      paymentMethod: payment.paymentMethod || 'Wise Bank Transfer',
      notes: payment.notes || ''
    });
    setShowModal(true);
  };

  // Save handler
  const handleSave = (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      alert('Please enter a valid invoice amount.');
      return;
    }

    const matchedWs = workspaces.find(w => w.id === formData.workspaceId);
    const clientName = matchedWs ? matchedWs.name : formData.clientName;

    if (editingPayment) {
      updatePayment(editingPayment.id, {
        ...formData,
        clientName,
        amount: Number(formData.amount)
      });
    } else {
      addPayment({
        ...formData,
        clientName,
        amount: Number(formData.amount)
      });
    }
    setShowModal(false);
  };

  // Quick mark status
  const handleQuickStatus = (paymentId, newStatus) => {
    updatePayment(paymentId, { status: newStatus });
  };

  // Delete handler
  const handleDelete = (paymentId) => {
    if (window.confirm('Are you sure you want to delete this invoice record?')) {
      deletePayment(paymentId);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Invoice Number', 'Client Name', 'Month', 'Amount', 'Currency', 'Billing Date', 'Due Date', 'Status', 'Payment Method', 'Notes'];
    const rows = filteredPayments.map(p => [
      `"${p.invoiceNumber}"`,
      `"${p.clientName}"`,
      `"${p.month}"`,
      p.amount,
      p.currency,
      `"${p.billingDate}"`,
      `"${p.dueDate}"`,
      `"${p.status}"`,
      `"${p.paymentMethod}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ROS_Client_Invoices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner in Cyber Dark Theme */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#111827] via-[#0F2238] to-[#111827] border border-[#1E3A5F] text-white p-6 rounded-2xl shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#00E5A0]/15 border border-[#00E5A0]/30 rounded-full text-[#00E5A0] text-xs font-semibold mb-2">
            <CreditCard className="w-3.5 h-3.5" />
            Super Admin Vault · Confidential Billing
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-white">
            Client Payments & Monthly Retainers
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Track outbound retainer contracts, recurring billings, Wise/Stripe receipts, and outstanding dues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] hover:bg-[#162238] text-white rounded-xl text-sm font-semibold border border-[#1E3A5F] transition"
          >
            <Download className="w-4 h-4 text-[#00C2FF]" />
            Export CSV
          </button>
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00E5A0] hover:bg-[#00E5A0]/80 text-[#0A0A0A] rounded-xl text-sm font-bold shadow-lg shadow-[#00E5A0]/20 transition transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Invoice / Retainer
          </button>
        </div>
      </div>

      {/* Metric Cards in Signature Cyber Dark Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total MRR */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E3A5F] p-5 shadow-sm hover:border-[#00C2FF]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7B7B7B]">Monthly Contract Value</span>
            <div className="w-9 h-9 rounded-lg bg-[#00C2FF]/10 border border-[#00C2FF]/20 flex items-center justify-center text-[#00C2FF]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white font-mono">
              £{stats.totalMRRGBP.toLocaleString()}
            </div>
            {stats.totalMRRUSD > 0 && (
              <div className="text-xs font-semibold text-[#00C2FF] mt-0.5 font-mono">
                + ${stats.totalMRRUSD.toLocaleString()} USD
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-400">Total active monthly client retainers</div>
        </div>

        {/* Collected This Month */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E3A5F] p-5 shadow-sm hover:border-[#00E5A0]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7B7B7B]">Collected / Paid</span>
            <div className="w-9 h-9 rounded-lg bg-[#00E5A0]/10 border border-[#00E5A0]/20 flex items-center justify-center text-[#00E5A0]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#00E5A0] font-mono">
              £{stats.paidGBP.toLocaleString()}
            </div>
            {stats.paidUSD > 0 && (
              <div className="text-xs font-semibold text-[#00E5A0]/80 mt-0.5 font-mono">
                + ${stats.paidUSD.toLocaleString()} USD
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-[#00E5A0]/90 font-medium">Successfully settled retainers</div>
        </div>

        {/* Pending Invoices */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E3A5F] p-5 shadow-sm hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7B7B7B]">Pending Collection</span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-400 font-mono">
              £{stats.pendingGBP.toLocaleString()}
            </div>
            {stats.pendingUSD > 0 && (
              <div className="text-xs font-semibold text-amber-400/80 mt-0.5 font-mono">
                + ${stats.pendingUSD.toLocaleString()} USD
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-amber-400/90 font-medium">Awaiting client bank transfer</div>
        </div>

        {/* Overdue */}
        <div className="bg-[#111827] rounded-2xl border border-[#1E3A5F] p-5 shadow-sm hover:border-rose-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#7B7B7B]">Overdue Invoices</span>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-400 font-mono">
              {stats.overdueCount}
            </div>
            <div className="text-xs font-semibold text-rose-400/80 mt-0.5">
              {stats.overdueCount === 0 ? 'All clients up to date' : 'Requires immediate follow-up'}
            </div>
          </div>
          <div className="mt-2 text-xs text-rose-400/90 font-medium">Past due date retainers</div>
        </div>
      </div>

      {/* Filter Bar in Cyber Theme */}
      <div className="bg-[#111827] p-4 rounded-2xl border border-[#1E3A5F] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#7B7B7B] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search client, invoice #, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-[#00C2FF] focus:border-[#00C2FF] transition outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#7B7B7B]">
            <Filter className="w-3.5 h-3.5 text-[#00C2FF]" />
            Filters:
          </div>

          {/* Workspace Filter */}
          <select
            value={selectedWorkspaceFilter}
            onChange={(e) => setSelectedWorkspaceFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs font-medium text-gray-200 focus:ring-2 focus:ring-[#00C2FF] outline-none"
          >
            <option value="all">All Workspaces / Clients</option>
            {workspaces.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs font-medium text-gray-200 focus:ring-2 focus:ring-[#00C2FF] outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Currency Filter */}
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-xs font-medium text-gray-200 focus:ring-2 focus:ring-[#00C2FF] outline-none"
          >
            <option value="all">All Currencies</option>
            <option value="GBP">GBP (£)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>
      </div>

      {/* Invoices Table in Cyber Theme */}
      <div className="bg-[#111827] rounded-2xl border border-[#1E3A5F] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#0A0A0A] text-[#7B7B7B] text-xs font-semibold uppercase tracking-wider border-b border-[#1E3A5F]">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Client / Brand</th>
                <th className="py-3.5 px-4">Billing Month</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Billing Date</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A5F]/40">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                    No invoice records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isPaid = p.status === 'Paid';
                  const isPending = p.status === 'Pending';
                  const isOverdue = p.status === 'Overdue';

                  return (
                    <tr key={p.id} className="hover:bg-[#0A0A0A]/60 transition">
                      {/* Invoice # */}
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-[#00C2FF]">
                        {p.invoiceNumber}
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{p.clientName}</div>
                        {p.notes && <div className="text-xs text-gray-400 line-clamp-1">{p.notes}</div>}
                      </td>

                      {/* Month */}
                      <td className="py-3.5 px-4 font-medium text-gray-300">
                        {p.month}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-bold text-white font-mono">
                        {p.currency === 'GBP' ? '£' : p.currency === 'USD' ? '$' : '€'}
                        {Number(p.amount).toLocaleString()}
                        <span className="text-[10px] text-[#00C2FF] ml-1 font-semibold">{p.currency}</span>
                      </td>

                      {/* Billing Date */}
                      <td className="py-3.5 px-4 text-xs text-gray-400 font-medium font-mono">
                        {p.billingDate}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-gray-300 font-mono">
                        {p.dueDate}
                      </td>

                      {/* Status with Quick Toggle */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              isPaid 
                                ? 'bg-[#00E5A0]/15 text-[#00E5A0] border border-[#00E5A0]/30' 
                                : isPending
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {isPaid && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {isPending && <Clock className="w-3 h-3 mr-1" />}
                            {isOverdue && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {p.status}
                          </span>

                          {/* Quick Mark as Paid Button */}
                          {!isPaid && (
                            <button
                              onClick={() => handleQuickStatus(p.id, 'Paid')}
                              title="Quick Mark as Paid"
                              className="px-2 py-0.5 bg-[#00E5A0]/20 hover:bg-[#00E5A0]/30 text-[#00E5A0] border border-[#00E5A0]/40 rounded-md transition text-xs font-semibold"
                            >
                              ✓ Paid
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {p.paymentMethod || 'Wise / Wire'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-gray-400 hover:text-[#00C2FF] hover:bg-[#0A0A0A] rounded-lg transition"
                            title="Edit Invoice"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New / Edit Invoice in Cyber Theme */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#1E3A5F] animate-scaleUp text-white">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E3A5F]">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#00E5A0]" />
                {editingPayment ? 'Edit Client Invoice' : 'New Client Retainer / Invoice'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              {/* Workspace / Client */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Client / Workspace
                </label>
                <select
                  value={formData.workspaceId}
                  onChange={(e) => {
                    const ws = workspaces.find(w => w.id === e.target.value);
                    setFormData({
                      ...formData,
                      workspaceId: e.target.value,
                      clientName: ws ? ws.name : formData.clientName
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  required
                >
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.clientName || 'Retainer'})</option>
                  ))}
                </select>
              </div>

              {/* Invoice Number & Billing Month */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-mono text-[#00C2FF] focus:ring-2 focus:ring-[#00C2FF] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Billing Month
                  </label>
                  <input
                    type="text"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                    placeholder="e.g. September 2026"
                    required
                  />
                </div>
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-bold font-mono text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                    placeholder="e.g. 1500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {/* Billing Date & Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Billing Date
                  </label>
                  <input
                    type="date"
                    value={formData.billingDate}
                    onChange={(e) => setFormData({ ...formData, billingDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  />
                </div>
              </div>

              {/* Status & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm font-semibold text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Payment Method
                  </label>
                  <input
                    type="text"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                    placeholder="e.g. Wise Bank Transfer"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Contract / Invoice Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#1E3A5F] rounded-xl text-sm text-white focus:ring-2 focus:ring-[#00C2FF] outline-none"
                  placeholder="e.g. Monthly cold outbound retainer, includes 2,500 prospects..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E3A5F]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[#1E3A5F] rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#0A0A0A] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#00E5A0] hover:bg-[#00E5A0]/80 text-[#0A0A0A] rounded-xl text-sm font-bold shadow-lg shadow-[#00E5A0]/20 transition"
                >
                  {editingPayment ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
