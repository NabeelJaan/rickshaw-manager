import React, { useState, useEffect } from 'react';
import { Plus, Car, Calendar, DollarSign, UserPlus, Users, TrendingUp, TrendingDown, Edit, Trash2 } from 'lucide-react';
import { Rickshaw, Driver, Assignment, Transaction } from '../types';
import { todayYMD } from '../utils/date';

export default function Rickshaws({ selectedDriverId }: { selectedDriverId?: string }) {
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState<number | null>(null);
  const [editingRickshaw, setEditingRickshaw] = useState<Rickshaw | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  
  const [formData, setFormData] = useState({ number: '', purchase_date: '', investment_cost: '' });
  const [assignData, setAssignData] = useState({ rickshaw_id: '', driver_id: '', start_date: todayYMD() });
  const [editFormData, setEditFormData] = useState({ number: '', purchase_date: '', investment_cost: '', id: '' });

  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) setCurrency(savedCurrency);
    
    const handleStorageChange = () => {
      const newCurrency = localStorage.getItem('currency');
      if (newCurrency) setCurrency(newCurrency);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdated', handleStorageChange);
    };
  }, []);

  const fetchData = () => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/rickshaws', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setRickshaws(data); });
    fetch('/api/drivers', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setDrivers(data); });
    fetch('/api/assignments', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setAssignments(data); });
    fetch('/api/transactions', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setTransactions(data); });
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    const res = await fetch('/api/rickshaws', { method: 'POST', headers, body: JSON.stringify(formData) });
    if (!res.ok) { const error = await res.json(); alert(`Error adding rickshaw: ${error.error}`); return; }
    setShowForm(false);
    setFormData({ number: '', purchase_date: '', investment_cost: '' });
    fetchData();
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    const res = await fetch('/api/assignments', { method: 'POST', headers, body: JSON.stringify(assignData) });
    if (!res.ok) { const error = await res.json(); alert(`Error assigning driver: ${error.error}`); return; }
    setShowAssignForm(null);
    setAssignData({ rickshaw_id: '', driver_id: '', start_date: todayYMD() });
    fetchData();
  };

  const handleEdit = (rickshaw: Rickshaw) => {
    setEditingRickshaw(rickshaw);
    setEditFormData({ number: rickshaw.number, purchase_date: rickshaw.purchase_date, investment_cost: rickshaw.investment_cost.toString(), id: rickshaw.id.toString() });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    const res = await fetch(`/api/rickshaws/${editFormData.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({ number: editFormData.number, purchase_date: editFormData.purchase_date, investment_cost: parseFloat(editFormData.investment_cost) }),
    });
    if (!res.ok) { const error = await res.json(); alert(`Error updating rickshaw: ${error.error}`); return; }
    setEditingRickshaw(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this rickshaw? This will also delete all its assignments and transactions.')) {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/rickshaws/${id}`, { method: 'DELETE', headers });
      if (!res.ok) { const error = await res.json(); alert(`Error deleting rickshaw: ${error.error}`); return; }
      fetchData();
    }
  };

  const getCurrentDriver = (rickshawId: number) => {
    const activeAssignment = assignments.find(a => a.rickshaw_id === rickshawId && !a.end_date);
    return activeAssignment ? activeAssignment.driver_name : 'Unassigned';
  };

  // For a legacy transaction with no rickshaw_id, resolve the ONE rickshaw it belongs
  // to (same rule as the backfill endpoint): assignment covering the transaction date,
  // else the driver's open assignment, else their most recent assignment.
  const resolveRickshawForTx = (txDriverId: number, txDate: Date): number | null => {
    const mine = assignments.filter(a => Number(a.driver_id) === txDriverId);
    if (mine.length === 0) return null;
    // Deterministic tie-break by id so this matches the backfill SQL (ORDER BY start_date DESC, id DESC)
    const byStartDesc = (x: Assignment, y: Assignment) =>
      new Date(y.start_date).getTime() - new Date(x.start_date).getTime() || Number(y.id) - Number(x.id);
    const covering = mine
      .filter(a => new Date(a.start_date) <= txDate && (!a.end_date || new Date(a.end_date) >= txDate))
      .sort(byStartDesc)[0];
    if (covering) return Number(covering.rickshaw_id);
    const open = mine.filter(a => !a.end_date).sort(byStartDesc)[0];
    if (open) return Number(open.rickshaw_id);
    const latest = [...mine].sort(byStartDesc)[0];
    return latest ? Number(latest.rickshaw_id) : null;
  };

  const calculateRickshawStats = (rickshawId: number, _purchaseDate: string) => {
    const rid = Number(rickshawId);

    // Note: no purchase-date guard here. A transaction that is tagged to (or resolved
    // for) this rickshaw must always count, otherwise it would vanish from every card
    // while still appearing in dashboard totals (the backfill has no such guard either).
    const rickshawTransactions = transactions.filter(t => {
      // Primary: transaction is tagged to this rickshaw (rickshaw-centric tracking)
      if (t.rickshaw_id != null && Number(t.rickshaw_id) === rid) return true;

      // Legacy fallback: untagged transaction — attribute to exactly one rickshaw
      if (t.rickshaw_id == null && t.driver_id != null) {
        return resolveRickshawForTx(Number(t.driver_id), new Date(t.date)) === rid;
      }

      return false;
    });

    // Income: paid rent (excludes pending)
    const income = rickshawTransactions
      .filter(t => t.type === 'income' && t.category !== 'rent_pending')
      .reduce((sum, t) => sum + t.amount, 0);

    // Expense: all expenses
    const expense = rickshawTransactions
      .filter(t => t.type === 'expense' && t.category !== 'rent_pending')
      .reduce((sum, t) => sum + t.amount, 0);

    // Pending balance (rent not yet collected)
    const pending = rickshawTransactions
      .filter(t => t.category === 'rent_pending')
      .reduce((sum, t) => sum + t.amount, 0);

    const netIncome = income - expense;
    // Effective value towards recovering investment = net income + pending
    const effectiveTotal = netIncome + pending;

    // Breakdown of who contributed to this rickshaw's totals (reveals stray/duplicate drivers)
    const byDriver: Record<string, { name: string; income: number; expense: number }> = {};
    rickshawTransactions.forEach(t => {
      const key = t.driver_name || '— (no driver)';
      if (!byDriver[key]) byDriver[key] = { name: key, income: 0, expense: 0 };
      if (t.type === 'income' && t.category !== 'rent_pending') byDriver[key].income += t.amount;
      else if (t.type === 'expense' && t.category !== 'rent_pending') byDriver[key].expense += t.amount;
    });
    const contributors = Object.values(byDriver).sort((a, b) => b.income - a.income);

    return { income, expense, pending, netIncome, effectiveTotal, contributors };
  };

  const filteredRickshaws = selectedDriverId 
    ? rickshaws.filter(r => {
        const activeAssignment = assignments.find(a => a.rickshaw_id === r.id && !a.end_date);
        return activeAssignment && activeAssignment.driver_id.toString() === selectedDriverId;
      })
    : rickshaws;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-purple-50 via-white to-indigo-50 p-6 md:p-8 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl md:text-4xl font-bold text-zinc-900 tracking-tight">Rickshaws</h2>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Rickshaw
          </button>
        </div>
      </div>

      {selectedDriverId && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm border border-amber-200/60">
          <strong>Note:</strong> You are currently viewing only rickshaws assigned to the selected driver. 
          To see all rickshaws (including newly added ones), please select "All Drivers" in the sidebar.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Rickshaw Number</label>
            <input type="text" required className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Purchase Date</label>
            <input type="date" required className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Investment Cost</label>
            <input type="number" required step="0.01" className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
              value={formData.investment_cost} onChange={e => setFormData({...formData, investment_cost: e.target.value})} />
          </div>
          <div className="md:col-span-3 flex justify-end gap-3 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">Save Rickshaw</button>
          </div>
        </form>
      )}

      {editingRickshaw && (
        <form onSubmit={handleUpdate} className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200/60 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Rickshaw Number</label>
            <input type="text" required className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              value={editFormData.number} onChange={e => setEditFormData({...editFormData, number: e.target.value})} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Purchase Date</label>
            <input type="date" required className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              value={editFormData.purchase_date} onChange={e => setEditFormData({...editFormData, purchase_date: e.target.value})} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Investment Cost</label>
            <input type="number" required step="0.01" className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-number"
              value={editFormData.investment_cost} onChange={e => setEditFormData({...editFormData, investment_cost: e.target.value})} />
          </div>
          <div className="md:col-span-3 flex justify-end gap-3 mt-2">
            <button type="button" onClick={() => setEditingRickshaw(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-sm">Update Rickshaw</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {filteredRickshaws.map(r => (
          <div key={r.id} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60 hover:shadow-md transition-all relative group">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-zinc-100 text-zinc-600 rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{r.number}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                    {r.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3.5 text-[13px] text-zinc-600 mb-5">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span>Purchased: <span className="font-number">{r.purchase_date}</span></span>
              </div>
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-zinc-400" />
                <span>Investment: <span className="font-number font-medium text-zinc-900">{currency} {r.investment_cost.toLocaleString()}</span></span>
              </div>
              
              <div className="pt-3 pb-1">
                {(() => {
                  const stats = calculateRickshawStats(r.id, r.purchase_date);
                  const { income, expense, pending, netIncome, effectiveTotal, contributors } = stats;

                  // Recovery is based on NET PROFIT (income - expense), excluding pending,
                  // to stay consistent with the Dashboard's "Profit After Investment".
                  const progressPct = r.investment_cost > 0
                    ? Math.min(100, Math.max(0, (netIncome / r.investment_cost) * 100))
                    : 100;
                  const isFullyRecovered = netIncome >= r.investment_cost;
                  const remainingInvestment = Math.max(0, r.investment_cost - netIncome);
                  const profitAfterInvestment = isFullyRecovered ? netIncome - r.investment_cost : 0;

                  return (
                    <>
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="font-medium text-zinc-500 uppercase tracking-wider">
                          {isFullyRecovered ? 'Investment Recovered' : 'Recovery Progress'}
                        </span>
                        <span className="text-emerald-600 font-semibold font-number">
                          {isFullyRecovered ? '100% Complete' : `${progressPct.toFixed(1)}%`}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${progressPct}%` }}
                        ></div>
                      </div>

                      <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200/60 space-y-1">
                        {/* Income */}
                        <div className="flex justify-between text-[11px] font-number">
                          <span className="text-emerald-700 font-medium">Total Income</span>
                          <span className="text-emerald-600 font-semibold">+{currency} {income.toLocaleString()}</span>
                        </div>
                        {/* Pending */}
                        {pending > 0 && (
                          <div className="flex justify-between text-[11px] font-number">
                            <span className="text-amber-600 font-medium">Pending Balance</span>
                            <span className="text-amber-500">+{currency} {pending.toLocaleString()}</span>
                          </div>
                        )}
                        {/* Expense */}
                        <div className="flex justify-between text-[11px] font-number">
                          <span className="text-rose-600 font-medium">Total Expenses</span>
                          <span className="text-rose-500">-{currency} {expense.toLocaleString()}</span>
                        </div>

                        {/* Net Profit (income - expense, no pending) */}
                        <div className="flex justify-between text-[11px] font-number pt-1 border-t border-emerald-200/60">
                          <span className="text-blue-700 font-semibold">Net Profit</span>
                          <span className="text-blue-600 font-bold">{currency} {netIncome.toLocaleString()}</span>
                        </div>

                        {/* Effective total line */}
                        {pending > 0 && (
                          <div className="flex justify-between text-[11px] font-number">
                            <span className="text-indigo-600 font-medium">Net + Pending</span>
                            <span className="text-indigo-600 font-semibold">{currency} {effectiveTotal.toLocaleString()}</span>
                          </div>
                        )}

                        {/* Investment deduction */}
                        <div className="flex justify-between text-[11px] font-number">
                          <span className="text-zinc-500 font-medium">Investment</span>
                          <span className="text-zinc-500">-{currency} {r.investment_cost.toLocaleString()}</span>
                        </div>

                        {/* Remaining or Profit after investment */}
                        <div className="flex justify-between text-[11px] font-number pt-1 border-t border-emerald-200/60">
                          {isFullyRecovered ? (
                            <>
                              <span className="text-emerald-700 font-semibold">Profit After Investment</span>
                              <span className="text-emerald-600 font-bold">+{currency} {profitAfterInvestment.toLocaleString()}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-orange-600 font-semibold">Remaining Amount</span>
                              <span className="text-orange-600 font-bold">{currency} {remainingInvestment.toLocaleString()}</span>
                            </>
                          )}
                        </div>

                        {/* Contributors breakdown — only shown when more than one driver contributed */}
                        {contributors.length > 1 && (
                          <div className="mt-1 pt-1 border-t border-emerald-200/60">
                            <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Contributing Drivers</p>
                            <div className="space-y-0.5">
                              {contributors.map(c => (
                                <div key={c.name} className="flex justify-between text-[10px] font-number">
                                  <span className="text-zinc-600 font-medium truncate max-w-[55%]">{c.name}</span>
                                  <span className="text-zinc-500">
                                    <span className="text-emerald-600">+{c.income.toLocaleString()}</span>
                                    {c.expense > 0 && <span className="text-rose-500"> / -{c.expense.toLocaleString()}</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Status pill */}
                        {isFullyRecovered ? (
                          <div className="text-[10px] text-center mt-1 text-emerald-600 font-medium bg-emerald-100/60 rounded py-1">
                            Investment recovered — now in profit!
                          </div>
                        ) : (
                          <div className="text-[10px] text-center mt-1 text-orange-600 font-medium bg-orange-100/50 rounded py-1">
                            {currency} {remainingInvestment.toLocaleString()} left to recover investment
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2.5 pt-3.5 border-t border-zinc-100">
                <Users className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-700">Driver: <span className="font-medium text-zinc-900">{getCurrentDriver(r.id)}</span></span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100">
              <button onClick={() => handleEdit(r)} className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5">
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={() => handleDelete(r.id)} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button 
                onClick={() => { setShowAssignForm(r.id); setAssignData({ ...assignData, rickshaw_id: r.id.toString() }); }}
                className="flex-1 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" /> Assign
              </button>
            </div>

            {showAssignForm === r.id && (
              <form onSubmit={handleAssign} className="absolute inset-0 bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-zinc-200/60 z-10 flex flex-col justify-center">
                <h4 className="font-semibold text-zinc-900 mb-5 text-center">Assign Driver to {r.number}</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Select Driver</label>
                    <select required className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={assignData.driver_id} onChange={e => setAssignData({...assignData, driver_id: e.target.value})}>
                      <option value="">Choose...</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Start Date</label>
                    <input type="date" required className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={assignData.start_date} onChange={e => setAssignData({...assignData, start_date: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => setShowAssignForm(null)} className="flex-1 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors shadow-sm">Assign</button>
                </div>
              </form>
            )}
          </div>
        ))}
        {filteredRickshaws.length === 0 && !showForm && (
          <div className="col-span-full text-center py-16 px-4 rounded-2xl border-2 border-dashed border-zinc-200">
            <Car className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-zinc-900 mb-1">No rickshaws found</h3>
            <p className="text-sm text-zinc-500">Add your first rickshaw to start tracking.</p>
          </div>
        )}
      </div>
    </div>
  );
}