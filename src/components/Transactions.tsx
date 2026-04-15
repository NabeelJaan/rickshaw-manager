import React, { useState, useEffect } from 'react';
import { Plus, Receipt, Trash2, Filter, DollarSign, Edit, TrendingDown, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Transaction, Rickshaw, Driver } from '../types';
import LogRentModal from './LogRentModal';
import EditTransactionModal from './EditTransactionModal';

export default function Transactions({ selectedDriverId }: { selectedDriverId?: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLogRentModalOpen, setIsLogRentModalOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'income',
    category: 'rent',
    amount: '',
    rickshaw_id: '',
    driver_id: selectedDriverId || '',
    notes: ''
  });

  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    rickshaw_id: '',
    driver_id: selectedDriverId || ''
  });

  // Load currency from settings
  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
    
    // Listen for storage changes (when settings are updated)
    const handleStorageChange = () => {
      const newCurrency = localStorage.getItem('currency');
      if (newCurrency) {
        setCurrency(newCurrency);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdated', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    setFilters(prev => ({ ...prev, driver_id: selectedDriverId || '' }));
    setFormData(prev => ({ ...prev, driver_id: selectedDriverId || '' }));
  }, [selectedDriverId]);

  const fetchData = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const query = new URLSearchParams(filters as any).toString();
    
    Promise.all([
      fetch(`/api/transactions?${query}`, { headers }).then(res => res.json()),
      fetch(`/api/stats?${query}`, { headers }).then(res => res.json())
    ]).then(([txData, statsData]) => {
      if (Array.isArray(txData)) setTransactions(txData);
      setStats(statsData || {});
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetchData();
    fetch('/api/rickshaws', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setRickshaws(data); });
    fetch('/api/drivers', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setDrivers(data); });
  }, [filters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ...formData,
        amount: formData.amount === '' ? 0 : parseFloat(formData.amount)
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error adding transaction: ${error.error}`);
      return;
    }
    
    setShowForm(false);
    setFormData({ ...formData, amount: '', notes: '' });
    fetchData();
  };

  const openExpenseForm = () => {
    setFormData({
      ...formData,
      type: 'expense',
      category: 'maintenance',
      amount: '',
      notes: ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      await fetch(`/api/transactions/${id}`, { method: 'DELETE', headers });
      fetchData();
    }
  };

  const setQuickFilter = (months: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    setFilters({
      ...filters,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      rickshaw_id: '',
      driver_id: selectedDriverId || ''
    });
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-6 md:p-8 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">Transactions</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-zinc-600">Quick Filters:</label>
              <button 
                onClick={() => setQuickFilter(1)}
                className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                1 Month
              </button>
              <button 
                onClick={() => setQuickFilter(2)}
                className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                2 Months
              </button>
              <button 
                onClick={() => setQuickFilter(6)}
                className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                6 Months
              </button>
              <button 
                onClick={() => setQuickFilter(12)}
                className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                1 Year
              </button>
              <button 
                onClick={() => setFilters({ start_date: '', end_date: '', rickshaw_id: '', driver_id: selectedDriverId || '' })}
                className="px-3 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 text-rose-700 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsLogRentModalOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 text-sm font-medium"
            >
              <DollarSign className="w-4 h-4" /> Log Rent
            </button>
            <button 
              onClick={openExpenseForm}
              className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-rose-500/20 text-sm font-medium"
            >
              <TrendingDown className="w-4 h-4" /> Add Expense
            </button>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-900 hover:to-zinc-950 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-zinc-500/20 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Transaction
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Total Income</p>
                <h3 className="text-lg font-bold text-zinc-900">{currency} {(stats.totalIncome || 0).toLocaleString()}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10">
                <TrendingDown className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Total Expense</p>
                <h3 className="text-lg font-bold text-zinc-900">{currency} {(stats.totalExpense || 0).toLocaleString()}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <DollarSign className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Net Profit</p>
                <h3 className="text-lg font-bold text-zinc-900">{currency} {(stats.profit || 0).toLocaleString()}</h3>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200/60">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <Receipt className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Transactions</p>
                <h3 className="text-lg font-bold text-zinc-900">{transactions.length}</h3>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Date</label>
            <input type="date" required className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Type</label>
            <select className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.type} onChange={e => {
                const newType = e.target.value;
                setFormData({
                  ...formData, 
                  type: newType,
                  category: newType === 'income' ? 'rent' : newType === 'pending' ? 'rent_pending' : 'fuel'
                });
              }}>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="pending">Rent Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Category</label>
            <input 
              type="text" 
              list="category-options"
              required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.category} 
              onChange={e => setFormData({...formData, category: e.target.value})} 
              placeholder="Select or type custom..."
              disabled={formData.type === 'pending'}
            />
            <datalist id="category-options">
              {formData.type === 'income' ? (
                <>
                  <option value="rent" />
                  <option value="rent_recovery" />
                  <option value="tips" />
                  <option value="other" />
                </>
              ) : formData.type === 'expense' ? (
                <>
                  <option value="fuel" />
                  <option value="maintenance" />
                  <option value="salary" />
                  <option value="rent_pending" />
                  <option value="other" />
                </>
              ) : null}
            </datalist>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Amount</label>
            <input type="number" step="0.01" className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
              value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
              placeholder={formData.category === 'rent_pending' || formData.type === 'pending' ? "0 (will use notes amount)" : "0.00"}
              required={formData.category !== 'rent_pending' && formData.type !== 'pending'}
            />
            {(formData.category === 'rent_pending' || formData.type === 'pending') && (
              <p className="mt-1 text-[11px] text-amber-600 font-medium">
                Tip: Leave amount 0 and enter "500 pending" in notes to add to pending balance.
              </p>
            )}
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Rickshaw (Optional)</label>
            <select className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.rickshaw_id} onChange={e => setFormData({...formData, rickshaw_id: e.target.value})}>
              <option value="">None</option>
              {rickshaws.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Driver (Optional)</label>
            <select className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.driver_id} onChange={e => setFormData({...formData, driver_id: e.target.value})}>
              <option value="">None</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Notes</label>
            <input type="text" className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>
          <div className="lg:col-span-4 flex justify-end gap-3 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">Save Transaction</button>
          </div>
        </form>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-wrap gap-5 items-end">
        <div className="flex items-center gap-2 text-zinc-500 font-medium text-sm">
          <Filter className="w-4 h-4" /> Filters:
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Start Date</label>
          <input type="date" className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">End Date</label>
          <input type="date" className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Rickshaw</label>
          <select className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={filters.rickshaw_id} onChange={e => setFilters({...filters, rickshaw_id: e.target.value})}>
            <option value="">All</option>
            {rickshaws.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Driver</label>
          <select className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={filters.driver_id} onChange={e => setFilters({...filters, driver_id: e.target.value})}>
            <option value="">All</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button 
          onClick={() => setFilters({start_date: '', end_date: '', rickshaw_id: '', driver_id: selectedDriverId || ''})}
          className="px-4 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200/60 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Category</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Rickshaw</th>
                <th className="p-4">Driver</th>
                <th className="p-4">Notes</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="p-4 text-sm text-zinc-600 font-number">{t.date}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
                      t.type === 'income' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' : 
                      t.type === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                      'bg-rose-50 text-rose-700 border-rose-200/50'
                    }`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-zinc-700 capitalize">{t.category.replace('_', ' ')}</td>
                  <td className={`p-4 text-sm font-medium font-number ${
                    t.type === 'income' ? 'text-emerald-600' : 
                    t.type === 'pending' ? 'text-amber-600' :
                    'text-rose-600'
                  }`}>
                    {t.type === 'income' ? '+' : t.type === 'pending' ? '' : '-'}{currency} {t.amount.toLocaleString()}
                  </td>
                  <td className="p-4 text-sm text-zinc-600">{t.rickshaw_number || '-'}</td>
                  <td className="p-4 text-sm text-zinc-600">{t.driver_name || '-'}</td>
                  <td className="p-4 text-sm text-zinc-500">
                    {t.notes ? (
                      <div className="max-w-xs">
                        <p className="truncate" title={t.notes}>{t.notes}</p>
                      </div>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setEditTransaction(t)} 
                        className="text-zinc-400 hover:text-emerald-500 transition-colors"
                        title="Edit transaction"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)} 
                        className="text-zinc-400 hover:text-rose-500 transition-colors"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-zinc-500">
                    <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LogRentModal 
        isOpen={isLogRentModalOpen} 
        onClose={() => setIsLogRentModalOpen(false)} 
        onSubmit={fetchData}
        onSuccess={fetchData}
        selectedDriverId={selectedDriverId}
      />
      
      <EditTransactionModal 
        isOpen={!!editTransaction}
        onClose={() => setEditTransaction(null)}
        onSuccess={fetchData}
        transaction={editTransaction}
      />
    </div>
  );
}
