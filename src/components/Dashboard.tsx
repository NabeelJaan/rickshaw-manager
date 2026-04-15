import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Car, Plus, Edit, ChevronDown, Trash2, Users } from 'lucide-react';
import { DashboardStats, Transaction } from '../types';
import LogRentModal from './LogRentModal';
import ExpenseModal from './ExpenseModal';
import EditTransactionModal from './EditTransactionModal';
import AddPendingBalanceModal from './AddPendingBalanceModal';

export default function Dashboard({ selectedDriverId }: { selectedDriverId?: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'monthly' | 'daily'>('daily');
  const [isLogRentModalOpen, setIsLogRentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isPendingBalanceModalOpen, setIsPendingBalanceModalOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [currency, setCurrency] = useState('Rs.');
  const [showTransactionDropdown, setShowTransactionDropdown] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

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

  const handleEditTransaction = (transaction: Transaction) => {
    setEditTransaction(transaction);
  };

  const handleDeleteTransaction = async (id: number) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      await fetch(`/api/transactions/${id}`, { 
        method: 'DELETE',
        headers
      });
      fetchData();
    }
  };

  const fetchData = () => {
    setLoading(true);
    const queryParts = [];
    if (selectedDriverId) queryParts.push(`driver_id=${selectedDriverId}`);
    if (selectedMonth) queryParts.push(`month=${selectedMonth}`);
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    Promise.all([
      fetch(`/api/stats${query}`, { headers }).then(res => res.json()).catch(() => ({})),
      fetch(`/api/transactions${query ? query + '&' : '?'}limit=10`, { headers }).then(res => res.json()).catch(() => [])
    ]).then(([statsData, txData]) => {
      console.log('Dashboard received stats:', statsData);
      console.log('Dashboard received transactions:', txData);
      console.log('Number of transactions:', Array.isArray(txData) ? txData.length : 0);
      
      // Log each transaction's driver_id for debugging
      if (Array.isArray(txData) && txData.length > 0) {
        console.log('Transaction driver_ids:', txData.map((t: any) => ({
          id: t.id,
          driver_id: t.driver_id,
          driver_id_type: typeof t.driver_id,
          amount: t.amount,
          date: t.date
        })));
      }
      
      setStats(statsData || {});
      setTransactions(Array.isArray(txData) ? txData : []);
      setLoading(false);
    }).catch(error => {
      console.error('Dashboard fetch error:', error);
      setStats({});
      setTransactions([]);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, [selectedDriverId]);

  useEffect(() => {
    if (selectedDriverId) {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      fetch(`/api/drivers`, { headers })
        .then(res => res.json())
        .then(drivers => {
          const driver = drivers.find((d: any) => d.id.toString() === selectedDriverId);
          setSelectedDriverName(driver ? driver.name : '');
        });
    } else {
      setSelectedDriverName('');
    }
  }, [selectedDriverId]);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading...</div>;

  const statCards = [
    { title: 'Total Revenue', value: stats.totalIncome || 0, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', prefix: currency + ' ' },
    { title: 'Total Expense', value: stats.totalExpense || 0, icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10', prefix: currency + ' ' },
    { title: 'Net Profit (Excl. Pending)', value: stats.profit || 0, icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-500/10', prefix: currency + ' ' },
    { title: 'Total Profit (Incl. Pending)', value: stats.profitIncludingPending || 0, icon: DollarSign, color: 'text-cyan-500', bg: 'bg-cyan-500/10', prefix: currency + ' ' },
    { title: 'Pending Balance', value: stats.pendingBalance || 0, icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-500/10', prefix: currency + ' ' },
    { title: 'Total Investment', value: stats.totalInvestment || 0, icon: Car, color: 'text-purple-500', bg: 'bg-purple-500/10', prefix: currency + ' ' },
    { title: 'Remaining Investment', value: Math.max(0, (stats.totalInvestment || 0) - (stats.allTimeProfit || 0)), icon: TrendingDown, color: 'text-orange-500', bg: 'bg-orange-500/10', prefix: currency + ' ' },
    { title: 'All-Time Income', value: stats.allTimeIncome || 0, icon: TrendingUp, color: 'text-teal-500', bg: 'bg-teal-500/10', prefix: currency + ' ' },
    { title: 'All-Time Expense', value: stats.allTimeExpense || 0, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', prefix: currency + ' ' },
    { title: 'Active Rickshaws', value: stats.activeRickshaws || 0, icon: Car, color: 'text-indigo-500', bg: 'bg-indigo-500/10', prefix: '', hideOnDriver: true },
    { title: 'Total Rickshaws', value: stats.totalRickshaws || 0, icon: Car, color: 'text-zinc-500', bg: 'bg-zinc-500/10', prefix: '', hideOnDriver: true },
  ];

  const filteredStatCards = selectedDriverId 
    ? statCards.filter(card => !card.hideOnDriver) 
    : statCards;

  // Extract leave records from transactions
  const leaveRecords = (Array.isArray(transactions) ? transactions : []).filter(t => 
    t.notes && (t.notes.toLowerCase().includes('leave') || t.notes.toLowerCase().includes('off'))
  );

  // Extract engine oil change records from transactions
  const oilChangeRecords = (Array.isArray(transactions) ? transactions : []).filter(t => 
    t.category && (t.category.toLowerCase().includes('oil') || t.category.toLowerCase().includes('engine'))
  ).slice(0, 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">
            {selectedDriverId ? `${selectedDriverName}'s Overview` : 'Dashboard Overview'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-600">Month:</label>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">All Months</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - i);
                  const monthStr = date.toISOString().slice(0, 7);
                  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  return <option key={monthStr} value={monthStr}>{monthName}</option>;
                })}
              </select>
              {selectedMonth && selectedMonth !== 'all' && (
                <button 
                  onClick={() => setSelectedMonth('all')}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedDriverId && (
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm text-sm font-medium"
            >
              <DollarSign className="w-4 h-4" /> Add Expense
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowTransactionDropdown(!showTransactionDropdown)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-sm text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Log Transaction
              <ChevronDown className={`w-4 h-4 transition-transform ${showTransactionDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showTransactionDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-zinc-200/60 py-2 z-50">
                <button 
                  onClick={() => {
                    setIsLogRentModalOpen(true);
                    setShowTransactionDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Add Income
                </button>
                <button 
                  onClick={() => {
                    setIsLogRentModalOpen(false);
                    setIsExpenseModalOpen(true);
                    setShowTransactionDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                >
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  Add Expense
                </button>
                <button 
                  onClick={() => {
                    setIsPendingBalanceModalOpen(true);
                    setShowTransactionDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  Add Pending Amount
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {filteredStatCards.map((card, i) => (
          <div key={i} className={`bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-3 md:gap-4 transition-shadow hover:shadow-md`}>
            <div className="flex justify-between items-start">
              <div className={`p-2 rounded-xl ${card.bg}`}>
                <card.icon className={`w-4 h-4 md:w-5 md:h-5 ${card.color}`} />
              </div>
            </div>
            <div>
              <p className="text-[11px] md:text-[13px] font-medium text-zinc-500 mb-0.5 md:mb-1">{card.title}</p>
              <h3 className="text-lg md:text-2xl font-bold text-zinc-900 font-number tracking-tight break-words">
                {card.prefix}{card.value.toLocaleString()}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {selectedDriverId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-zinc-100 flex justify-between items-center">
              <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                Monthly Leave
              </h3>
              <span className="text-sm font-medium text-zinc-600">{leaveRecords.length} leaves</span>
            </div>
            <div className="p-4 md:p-5">
              {leaveRecords.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No leave records this month</p>
              ) : (
                <div className="space-y-2">
                  {leaveRecords.map(t => (
                    <div key={t.id} className="flex justify-center p-2 bg-zinc-50 rounded-lg">
                      <p className="text-sm font-medium text-zinc-900">
                        {new Date(t.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-zinc-100">
              <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-500" />
                Last Engine Oil Change
              </h3>
            </div>
            <div className="p-4 md:p-5">
              {oilChangeRecords.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No oil change records</p>
              ) : (
                <div className="space-y-3">
                  {oilChangeRecords.map(t => (
                    <div key={t.id} className="flex justify-between items-start p-3 bg-zinc-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {t.rickshaw_number && (
                            <p className="text-sm font-medium text-zinc-900">Rickshaw {t.rickshaw_number}</p>
                          )}
                          {t.driver_name && (
                            <p className="text-sm text-zinc-600">- {t.driver_name}</p>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">
                        {new Date(t.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                        {t.notes && (
                          <p className="text-xs text-zinc-600 mt-1 italic">"{t.notes}"</p>
                        )}
                      </div>
                      <span className={`text-sm font-medium font-number ${
                        t.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {t.type === 'expense' ? '-' : '+'}{currency}{t.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-zinc-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-base font-semibold text-zinc-900">Recent Transactions</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-medium text-emerald-700">
                  {(Array.isArray(transactions) ? transactions : []).filter(t => t.type === 'income').length} Income
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                <span className="text-xs font-medium text-rose-700">
                  {(Array.isArray(transactions) ? transactions : []).filter(t => t.type === 'expense').length} Expense
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-xs font-medium text-amber-700">
                  {(Array.isArray(transactions) ? transactions : []).filter(t => t.category === 'rent_pending').length} Pending
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-zinc-100">
          {(Array.isArray(transactions) ? transactions : []).map(t => (
            <div key={t.id} className="p-4 space-y-3 bg-gradient-to-r from-transparent to-zinc-50/30 hover:from-zinc-50/50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${
                      t.type === 'income' ? 'bg-emerald-100' : 
                      t.category === 'rent_pending' ? 'bg-amber-100' :
                      'bg-rose-100'
                    }`}>
                      {t.type === 'income' ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : t.category === 'rent_pending' ? (
                        <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">
                      {new Date(t.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 capitalize">{t.category.replace('_', ' ')}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 
                  t.category === 'rent_pending' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                }`}>
                  {currency}{t.amount.toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                  {t.rickshaw_number && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-2 py-1 rounded-md">
                      <Car className="w-3 h-3 text-zinc-500" />
                      <span className="font-medium">{t.rickshaw_number}</span>
                    </div>
                  )}
                  {t.driver_name && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-2 py-1 rounded-md">
                      <Users className="w-3 h-3 text-zinc-500" />
                      <span className="font-medium">{t.driver_name}</span>
                    </div>
                  )}
                </div>
                <div className={`text-base font-bold font-number ${
                  t.type === 'income' ? 'text-emerald-600' : 
                  t.type === 'pending' ? 'text-amber-600' :
                  'text-rose-600'
                }`}>
                  {t.type === 'income' ? '+' : t.type === 'pending' ? '' : '-'}{currency}{t.amount.toLocaleString()}
                </div>
              </div>
              
              {t.notes && (
                <p className="text-xs text-zinc-500 bg-zinc-50 p-2 rounded-lg italic">
                  "{t.notes}"
                </p>
              )}
              
              <div className="flex justify-end gap-3 pt-1">
                <button 
                  onClick={() => handleEditTransaction(t)} 
                  className="text-zinc-400 hover:text-emerald-500 flex items-center gap-1 text-[11px] font-medium"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button 
                  onClick={() => handleDeleteTransaction(t.id)} 
                  className="text-zinc-400 hover:text-rose-500 flex items-center gap-1 text-[11px] font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100/50 border-b border-zinc-200/60 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="p-4 rounded-tl-lg">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Category</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Rickshaw</th>
                <th className="p-4">Driver</th>
                <th className="p-4">Notes</th>
                <th className="p-4 text-right rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/80">
              {(Array.isArray(transactions) ? transactions : []).map(t => (
                <tr key={t.id} className="hover:bg-gradient-to-r hover:from-zinc-50/50 hover:to-transparent transition-all group">
                  <td className="p-4 text-sm text-zinc-600 font-medium">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        t.type === 'income' ? 'bg-emerald-500' : 
                        t.category === 'rent_pending' ? 'bg-amber-500' :
                        'bg-rose-500'
                      }`}></div>
                      {new Date(t.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                      t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 
                      t.category === 'rent_pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {t.type === 'income' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : t.category === 'rent_pending' ? (
                        <DollarSign className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {t.type}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-zinc-700 capitalize font-medium">{t.category.replace('_', ' ')}</td>
                  <td className={`p-4 text-sm font-bold font-number ${
                    t.type === 'income' ? 'text-emerald-600' : 
                    t.category === 'rent_pending' ? 'text-amber-600' :
                    'text-rose-600'
                  }`}>
                    {t.type === 'income' ? '+' : t.category === 'rent_pending' ? '' : '-'}{currency}{t.amount.toLocaleString()}
                  </td>
                  <td className="p-4">
                    {t.rickshaw_number ? (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full w-fit">
                        <Car className="w-3 h-3 text-zinc-500" />
                        <span className="font-medium">{t.rickshaw_number}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {t.driver_name ? (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full w-fit">
                        <Users className="w-3 h-3 text-zinc-500" />
                        <span className="font-medium">{t.driver_name}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-zinc-500">
                    {t.notes ? (
                      <div className="max-w-xs">
                        <p className="truncate text-xs" title={t.notes}>{t.notes}</p>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button 
                        onClick={() => handleEditTransaction(t)} 
                        className="p-1.5 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Edit transaction"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTransaction(t.id)} 
                        className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length === 0 && (
          <div className="p-12 text-center text-zinc-500">
            No recent transactions
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-base font-semibold text-zinc-900">Income vs Expense</h3>
            <div className="flex bg-zinc-100/80 p-1 rounded-lg border border-zinc-200/50">
              <button 
                onClick={() => setChartView('daily')}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${chartView === 'daily' ? 'bg-white shadow-sm text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Daily
              </button>
              <button 
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1.5 text-xs rounded-md transition-all ${chartView === 'monthly' ? 'bg-white shadow-sm text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartView === 'daily' ? stats.dailyData : stats.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis 
                  dataKey={chartView === 'daily' ? 'date' : 'month'} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#71717a' }} 
                  dy={10}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5', opacity: 0.4 }} 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                  labelStyle={{ fontSize: '12px', color: '#71717a', marginBottom: '4px' }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" maxBarSize={40} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expense" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
          <h3 className="text-base font-semibold text-zinc-900 mb-6">Total Income by Month (Last Year)</h3>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#71717a' }} 
                  dy={10}
                  interval="preserveStartEnd"
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5', opacity: 0.4 }} 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                  labelStyle={{ fontSize: '12px', color: '#71717a', marginBottom: '4px' }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <LogRentModal 
        isOpen={isLogRentModalOpen} 
        onClose={() => setIsLogRentModalOpen(false)} 
        onSubmit={fetchData}
        onSuccess={fetchData}
        selectedDriverId={selectedDriverId}
      />
      
      <AddPendingBalanceModal
        isOpen={isPendingBalanceModalOpen}
        onClose={() => setIsPendingBalanceModalOpen(false)}
        onSuccess={fetchData}
      />
      
      <EditTransactionModal 
        isOpen={!!editTransaction}
        onClose={() => setEditTransaction(null)}
        onSuccess={fetchData}
        transaction={editTransaction}
      />
      
      <ExpenseModal 
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={fetchData}
        driverId={selectedDriverId || ''}
        driverName={selectedDriverName}
      />
    </div>
  );
}
