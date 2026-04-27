import { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { TrendingUp, TrendingDown, DollarSign, Car, Plus, Edit, ChevronDown, Trash2, Users, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { DashboardStats, Transaction, Driver } from '../types';
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
  const [driverPerformance, setDriverPerformance] = useState<{driver: Driver, stats: {income: number, expense: number, profit: number, lastMonthIncome: number, lastMonthExpense: number, growth: number}}[]>([]);

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

  const fetchDriverPerformance = async () => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    try {
      const driversRes = await fetch('/api/drivers', { headers });
      const drivers: Driver[] = await driversRes.json();
      
      const performanceData = await Promise.all(
        drivers.map(async (driver) => {
          // Current month stats
          const currentMonth = new Date().toISOString().slice(0, 7);
          const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
          
          const currentRes = await fetch(`/api/transactions?driver_id=${driver.id}&month=${currentMonth}`, { headers });
          const currentTx: Transaction[] = await currentRes.json();
          
          const lastRes = await fetch(`/api/transactions?driver_id=${driver.id}&month=${lastMonth}`, { headers });
          const lastTx: Transaction[] = await lastRes.json();
          
          const currentIncome = currentTx.filter(t => t.type === 'income' && t.category !== 'rent_pending').reduce((sum, t) => sum + t.amount, 0);
          const currentExpense = currentTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          const lastIncome = lastTx.filter(t => t.type === 'income' && t.category !== 'rent_pending').reduce((sum, t) => sum + t.amount, 0);
          const lastExpense = lastTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          
          const growth = lastIncome > 0 ? ((currentIncome - lastIncome) / lastIncome) * 100 : currentIncome > 0 ? 100 : 0;
          
          return {
            driver,
            stats: {
              income: currentIncome,
              expense: currentExpense,
              profit: currentIncome - currentExpense,
              lastMonthIncome: lastIncome,
              lastMonthExpense: lastExpense,
              growth
            }
          };
        })
      );
      
      setDriverPerformance(performanceData);
    } catch (error) {
      console.error('Error fetching driver performance:', error);
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
    if (!selectedDriverId) {
      fetchDriverPerformance();
    }
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

  const remainingInvestment = Math.max(0, (stats.totalInvestment || 0) - (stats.allTimeProfit || 0));
  const isFullyRecovered = remainingInvestment === 0 && (stats.totalInvestment || 0) > 0;
  const totalProfit = (stats.allTimeProfit || 0) - (stats.totalInvestment || 0);

  const statCards = [
    { title: 'Revenue', value: stats.totalIncome || 0, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', prefix: currency + ' ' },
    { title: 'Expense', value: stats.totalExpense || 0, icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-50', prefix: currency + ' ' },
    { title: 'Net Profit', value: stats.profit || 0, icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-50', prefix: currency + ' ' },
    { title: 'Pending', value: stats.pendingBalance || 0, icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-50', prefix: currency + ' ' },
    { title: 'Investment', value: stats.totalInvestment || 0, icon: Car, color: 'text-purple-500', bg: 'bg-purple-50', prefix: currency + ' ' },
    { 
      title: isFullyRecovered ? 'Net Profit' : 'Remaining', 
      value: isFullyRecovered ? totalProfit : remainingInvestment, 
      icon: isFullyRecovered ? TrendingUp : TrendingDown, 
      color: isFullyRecovered ? 'text-emerald-500' : 'text-orange-500', 
      bg: isFullyRecovered ? 'bg-emerald-50' : 'bg-orange-50', 
      prefix: isFullyRecovered ? '+' + currency + ' ' : currency + ' ',
      subtitle: isFullyRecovered ? 'Investment recovered!' : undefined
    },
    { title: 'Rickshaws', value: `${stats.activeRickshaws || 0}/${stats.totalRickshaws || 0}`, icon: Car, color: 'text-zinc-500', bg: 'bg-zinc-50', prefix: '', hideOnDriver: true },
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
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-10 md:py-16 space-y-12 md:space-y-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-semibold text-zinc-900 tracking-tight leading-tight">
            {selectedDriverId ? selectedDriverName : 'Overview'}
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-11 px-4 bg-zinc-100 border-0 rounded-xl text-[14px] text-zinc-700 font-medium hover:bg-zinc-200 transition-colors cursor-pointer focus:ring-2 focus:ring-zinc-300 outline-none"
          >
            <option value="all">All Time</option>
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() - i);
              const monthStr = date.toISOString().slice(0, 7);
              const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              return <option key={monthStr} value={monthStr}>{monthName}</option>;
            })}
          </select>
          {selectedDriverId && (
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="h-11 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-[14px] font-medium transition-colors flex items-center gap-2"
            >
              <TrendingDown className="w-4 h-4" /> <span className="hidden sm:inline">Expense</span>
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowTransactionDropdown(!showTransactionDropdown)}
              className="h-11 px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-[14px] font-medium transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showTransactionDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTransactionDropdown && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-zinc-100 p-2 z-50">
                <button 
                  onClick={() => { setIsLogRentModalOpen(true); setShowTransactionDropdown(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[14px] text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  Add Income
                </button>
                <button 
                  onClick={() => { setIsExpenseModalOpen(true); setShowTransactionDropdown(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[14px] text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                  </div>
                  Add Expense
                </button>
                <button 
                  onClick={() => { setIsPendingBalanceModalOpen(true); setShowTransactionDropdown(false); }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[14px] text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                  </div>
                  Add Pending
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {filteredStatCards.map((card, i) => (
          <div key={i} className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-3">
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-5 h-5 ${card.color}`} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[13px] text-zinc-500 font-medium">{card.title}</p>
              <h3 className={`text-[22px] md:text-[26px] font-semibold tracking-tight font-number mt-1 ${card.color}`}>
                {card.prefix}{typeof card.value === 'string' ? card.value : card.value.toLocaleString()}
              </h3>
            </div>
            {card.subtitle && (
              <p className="text-[12px] text-emerald-600 font-medium">{card.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {/* Driver Performance */}
      {driverPerformance.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            <h3 className="text-[15px] font-semibold text-zinc-700">Driver Performance</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {driverPerformance
              .filter(({ driver }) => !selectedDriverId || driver.id.toString() === selectedDriverId)
              .map(({ driver, stats }) => (
                <div key={driver.id} className="bg-white p-5 rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-[15px] ${
                      stats.growth > 10 ? 'bg-emerald-500' : stats.growth > 0 ? 'bg-blue-500' : stats.growth < 0 ? 'bg-rose-500' : 'bg-zinc-400'
                    }`}>
                      {driver.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-zinc-900 truncate">{driver.name}</p>
                      <p className="text-[12px] text-zinc-500 truncate">{driver.assigned_rickshaw || 'Unassigned'}</p>
                    </div>
                    <div className={`flex items-center gap-0.5 text-[13px] font-semibold ${
                      stats.growth > 0 ? 'text-emerald-600' : stats.growth < 0 ? 'text-rose-600' : 'text-zinc-500'
                    }`}>
                      {stats.growth > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : stats.growth < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                      {Math.abs(stats.growth).toFixed(0)}%
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="text-zinc-500">Income</span>
                      <span className="font-semibold text-emerald-600">{currency}{stats.income.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[13px]">
                      <span className="text-zinc-500">Expense</span>
                      <span className="font-semibold text-rose-600">{currency}{stats.expense.toLocaleString()}</span>
                    </div>
                    <div className="pt-2.5 border-t border-zinc-100 flex justify-between items-center">
                      <span className="text-[13px] font-medium text-zinc-700">Profit</span>
                      <span className={`text-[15px] font-bold ${stats.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stats.profit >= 0 ? '+' : ''}{currency}{stats.profit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {selectedDriverId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-[15px] font-semibold text-zinc-900">Monthly Leave</h3>
              </div>
              <span className="text-[13px] font-medium text-zinc-500">{leaveRecords.length} days</span>
            </div>
            {leaveRecords.length === 0 ? (
              <p className="text-[13px] text-zinc-400 text-center py-6">No leave records this month</p>
            ) : (
              <div className="space-y-2">
                {leaveRecords.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                    <p className="text-[13px] font-medium text-zinc-700">
                      {new Date(t.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Car className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-[15px] font-semibold text-zinc-900">Last Oil Change</h3>
            </div>
            {oilChangeRecords.length === 0 ? (
              <p className="text-[13px] text-zinc-400 text-center py-6">No oil change records</p>
            ) : (
              <div className="space-y-3">
                {oilChangeRecords.map(t => (
                  <div key={t.id} className="flex justify-between items-start p-3 bg-zinc-50 rounded-xl">
                    <div>
                      {t.rickshaw_number && (
                        <p className="text-[13px] font-semibold text-zinc-900">Rickshaw {t.rickshaw_number}</p>
                      )}
                      <p className="text-[12px] text-zinc-500 mt-0.5">
                        {new Date(t.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      {t.notes && (
                        <p className="text-[12px] text-zinc-600 mt-1.5 italic">{t.notes}</p>
                      )}
                    </div>
                    <span className={`text-[13px] font-semibold font-number ${
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
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-5 md:p-6 border-b border-zinc-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-[17px] font-semibold text-zinc-900">Recent Transactions</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[12px] font-semibold text-emerald-700">
                  {(Array.isArray(transactions) ? transactions : []).filter(t => t.type === 'income').length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                <span className="text-[12px] font-semibold text-rose-700">
                  {(Array.isArray(transactions) ? transactions : []).filter(t => t.type === 'expense').length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                <span className="text-[12px] font-semibold text-amber-700">
                  {(Array.isArray(transactions) ? transactions : []).filter(t => t.category === 'rent_pending').length}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile View */}
        <div className="block md:hidden">
          {(Array.isArray(transactions) ? transactions : []).map(t => (
            <div key={t.id} className="p-4 border-b border-zinc-100 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    t.type === 'income' ? 'bg-emerald-50' : 
                    t.category === 'rent_pending' ? 'bg-amber-50' :
                    'bg-rose-50'
                  }`}>
                    {t.type === 'income' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : t.category === 'rent_pending' ? (
                      <DollarSign className="w-4 h-4 text-amber-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-zinc-900 capitalize">{t.category.replace('_', ' ')}</p>
                    <p className="text-[12px] text-zinc-500 mt-0.5">
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {t.rickshaw_number && (
                        <span className="text-[11px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">{t.rickshaw_number}</span>
                      )}
                      {t.driver_name && (
                        <span className="text-[11px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">{t.driver_name}</span>
                      )}
                    </div>
                    {t.notes && (
                      <p className="text-[12px] text-zinc-500 mt-2 italic truncate">{t.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[15px] font-bold font-number ${
                    t.type === 'income' ? 'text-emerald-600' : 
                    t.type === 'pending' ? 'text-amber-600' :
                    'text-rose-600'
                  }`}>
                    {t.type === 'income' ? '+' : t.type === 'pending' ? '' : '-'}{currency}{t.amount.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-3 mt-2 justify-end">
                    <button 
                      onClick={() => handleEditTransaction(t)} 
                      className="text-zinc-400 hover:text-zinc-700"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTransaction(t.id)} 
                      className="text-zinc-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200/60 text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">
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
                <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors group">
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[15px] font-semibold text-zinc-900">Income vs Expense</h3>
            <div className="flex bg-zinc-100 p-1 rounded-xl">
              <button 
                onClick={() => setChartView('daily')}
                className={`px-3 py-1.5 text-[13px] rounded-lg transition-all ${chartView === 'daily' ? 'bg-white shadow-sm text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Daily
              </button>
              <button 
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1.5 text-[13px] rounded-lg transition-all ${chartView === 'monthly' ? 'bg-white shadow-sm text-zinc-900 font-medium' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="h-64 md:h-72">
            <ReactApexChart
              options={{
                chart: {
                  type: 'bar',
                  height: '100%',
                  toolbar: { show: false },
                  fontFamily: 'inherit',
                },
                plotOptions: {
                  bar: {
                    horizontal: false,
                    columnWidth: '60%',
                    borderRadius: 4,
                    borderRadiusApplication: 'end',
                  },
                },
                dataLabels: { enabled: false },
                stroke: { show: true, width: 2, colors: ['transparent'] },
                xaxis: {
                  categories: (chartView === 'daily' ? stats.dailyData : stats.monthlyData)?.map((d: any) => chartView === 'daily' ? d.date : d.month) || [],
                  labels: {
                    style: { colors: '#71717a', fontSize: '12px' },
                  },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: { colors: '#71717a', fontSize: '12px' },
                  },
                },
                fill: { opacity: 1 },
                tooltip: {
                  theme: 'light',
                  style: { fontSize: '13px' },
                },
                colors: ['#10b981', '#f43f5e'],
                legend: {
                  position: 'top',
                  horizontalAlign: 'left',
                  markers: { radius: 12 },
                },
                responsive: [
                  {
                    breakpoint: 768,
                    options: {
                      chart: { height: 250 },
                      plotOptions: { bar: { columnWidth: '50%' } },
                      xaxis: { labels: { style: { fontSize: '10px' } } },
                    },
                  },
                ],
              }}
              series={[
                {
                  name: 'Income',
                  data: (chartView === 'daily' ? stats.dailyData : stats.monthlyData)?.map((d: any) => d.income) || [],
                },
                {
                  name: 'Expense',
                  data: (chartView === 'daily' ? stats.dailyData : stats.monthlyData)?.map((d: any) => d.expense) || [],
                },
              ]}
              type="bar"
              height="100%"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
          <h3 className="text-base font-semibold text-zinc-900 mb-6">Total Income by Month (Last Year)</h3>
          <div className="h-64 md:h-72">
            <ReactApexChart
              options={{
                chart: {
                  type: 'bar',
                  height: '100%',
                  toolbar: { show: false },
                  fontFamily: 'inherit',
                },
                plotOptions: {
                  bar: {
                    horizontal: false,
                    columnWidth: '60%',
                    borderRadius: 4,
                    borderRadiusApplication: 'end',
                  },
                },
                dataLabels: { enabled: false },
                stroke: { show: true, width: 2, colors: ['transparent'] },
                xaxis: {
                  categories: stats.monthlyData?.map((d: any) => d.month) || [],
                  labels: {
                    style: { colors: '#71717a', fontSize: '12px' },
                  },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: { colors: '#71717a', fontSize: '12px' },
                  },
                },
                fill: { opacity: 1 },
                tooltip: {
                  theme: 'light',
                  style: { fontSize: '13px' },
                },
                colors: ['#10b981'],
                responsive: [
                  {
                    breakpoint: 768,
                    options: {
                      chart: { height: 250 },
                      plotOptions: { bar: { columnWidth: '50%' } },
                      xaxis: { labels: { style: { fontSize: '10px' } } },
                    },
                  },
                ],
              }}
              series={[
                {
                  name: 'Income',
                  data: stats.monthlyData?.map((d: any) => d.income) || [],
                },
              ]}
              type="bar"
              height="100%"
            />
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
