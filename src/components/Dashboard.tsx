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
    { title: 'Total Revenue', value: stats.totalIncome || 0, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', prefix: currency + ' ' },
    { title: 'Total Expense', value: stats.totalExpense || 0, icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10', prefix: currency + ' ' },
    { title: 'Net Profit (Excl. Pending)', value: stats.profit || 0, icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-500/10', prefix: currency + ' ' },
    { title: 'Total Profit (Incl. Pending)', value: stats.profitIncludingPending || 0, icon: DollarSign, color: 'text-cyan-500', bg: 'bg-cyan-500/10', prefix: currency + ' ' },
    { title: 'Pending Balance', value: stats.pendingBalance || 0, icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-500/10', prefix: currency + ' ' },
    { title: 'Total Investment', value: stats.totalInvestment || 0, icon: Car, color: 'text-purple-500', bg: 'bg-purple-500/10', prefix: currency + ' ' },
    { 
      title: isFullyRecovered ? 'Investment Recovered!' : 'Remaining Investment', 
      value: isFullyRecovered ? totalProfit : remainingInvestment, 
      icon: isFullyRecovered ? TrendingUp : TrendingDown, 
      color: isFullyRecovered ? 'text-emerald-500' : 'text-orange-500', 
      bg: isFullyRecovered ? 'bg-emerald-500/10' : 'bg-orange-500/10', 
      prefix: isFullyRecovered ? '+' + currency + ' ' : currency + ' ',
      subtitle: isFullyRecovered ? 'All investments recovered - Now in profit!' : undefined
    },
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
      <div className="bg-gradient-to-r from-emerald-50 via-white to-zinc-50 p-6 md:p-8 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">
              {selectedDriverId ? `${selectedDriverName}'s Overview` : 'Dashboard Overview'}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-zinc-600">Month:</label>
                <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm transition-all"
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
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 px-2 py-1 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {selectedDriverId && (
              <button 
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl flex items-center gap-1.5 md:gap-2 transition-all shadow-lg shadow-rose-500/20 text-xs md:text-sm font-medium"
              >
                <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Add</span> Expense
              </button>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowTransactionDropdown(!showTransactionDropdown)}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl flex items-center gap-1.5 md:gap-2 transition-all shadow-lg shadow-emerald-500/20 text-xs md:text-sm font-medium"
              >
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Log</span> Transaction
                <ChevronDown className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-transform ${showTransactionDropdown ? 'rotate-180' : ''}`} />
              </button>
            
            {showTransactionDropdown && (
              <div className="absolute top-full right-0 md:left-0 mt-2 w-44 md:w-48 bg-white rounded-lg md:rounded-xl shadow-lg border border-zinc-200/60 py-1.5 md:py-2 z-50">
                <button 
                  onClick={() => {
                    setIsLogRentModalOpen(true);
                    setShowTransactionDropdown(false);
                  }}
                  className="w-full text-left px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 md:gap-2"
                >
                  <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
                  Add Income
                </button>
                <button 
                  onClick={() => {
                    setIsLogRentModalOpen(false);
                    setIsExpenseModalOpen(true);
                    setShowTransactionDropdown(false);
                  }}
                  className="w-full text-left px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 md:gap-2"
                >
                  <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-500" />
                  Add Expense
                </button>
                <button 
                  onClick={() => {
                    setIsPendingBalanceModalOpen(true);
                    setShowTransactionDropdown(false);
                  }}
                  className="w-full text-left px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 md:gap-2"
                >
                  <DollarSign className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                  Add Pending
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {filteredStatCards.map((card, i) => (
          <div key={i} className={`bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-3 md:gap-4 transition-all duration-300 hover:shadow-lg hover:border-zinc-300/60 group`}>
            <div className="flex justify-between items-start">
              <div className={`p-2.5 rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className={`w-4 h-4 md:w-5 md:h-5 ${card.color}`} />
              </div>
            </div>
            <div>
              <p className="text-[11px] md:text-[13px] font-medium text-zinc-500 mb-0.5 md:mb-1">{card.title}</p>
              <h3 className={`text-lg md:text-2xl font-bold font-number tracking-tight break-words ${card.color}`}>
                {card.prefix}{card.value.toLocaleString()}
              </h3>
              {card.subtitle && (
                <p className="text-[10px] md:text-xs text-emerald-600 mt-1 font-medium">{card.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Driver Performance Tracker */}
      {driverPerformance.length > 0 && (
        <div className="bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 rounded-2xl md:rounded-3xl shadow-sm border border-zinc-200/60 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 md:gap-4 mb-4 md:mb-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-2.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/20">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold text-zinc-900">Driver Performance Tracker</h3>
                <p className="text-[10px] md:text-xs text-zinc-500">Monitor growth and progress in real-time</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 md:px-3 py-1 md:py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] md:text-xs font-semibold">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {driverPerformance
              .filter(({ driver }) => !selectedDriverId || driver.id.toString() === selectedDriverId)
              .map(({ driver, stats }) => {
                const profitMargin = stats.income > 0 ? ((stats.profit / stats.income) * 100).toFixed(0) : 0;
                
                return (
                <div key={driver.id} className="group bg-white rounded-xl md:rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-emerald-200 hover:-translate-y-1">
                  {/* Gradient Header with Driver Info */}
                  <div className={`relative p-3 md:p-4 ${
                    stats.growth > 10 
                      ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400' 
                      : stats.growth > 0 
                      ? 'bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400'
                      : stats.growth < 0 
                      ? 'bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400'
                      : 'bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-400'
                  }`}>
                    {/* Growth Badge */}
                    <div className="absolute top-2 md:top-3 right-2 md:right-3">
                      <div className={`flex items-center gap-0.5 md:gap-1 px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold backdrop-blur-sm ${
                        stats.growth > 0 
                          ? 'bg-white/90 text-emerald-600' 
                          : stats.growth < 0 
                          ? 'bg-white/90 text-rose-600'
                          : 'bg-white/90 text-zinc-600'
                      }`}>
                        {stats.growth > 0 ? (
                          <ArrowUpRight className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        ) : stats.growth < 0 ? (
                          <ArrowDownRight className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        ) : (
                          <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />
                        )}
                        {Math.abs(stats.growth).toFixed(0)}%
                      </div>
                    </div>
                    
                    {/* Driver Avatar & Name */}
                    <div className="flex items-center gap-2 md:gap-3 pt-4 md:pt-5">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
                        <span className="text-base md:text-lg font-bold text-white">{driver.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm md:text-base font-bold text-white truncate">{driver.name}</h4>
                        <p className="text-[10px] md:text-xs text-white/80 truncate">{driver.assigned_rickshaw || 'No rickshaw'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Section */}
                  <div className="p-3 md:p-4 space-y-3">
                    {/* Income/Expense Row */}
                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                      <div className="bg-emerald-50 rounded-lg md:rounded-xl p-2 md:p-2.5 text-center">
                        <p className="text-[9px] md:text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Income</p>
                        <p className="text-xs md:text-sm font-bold text-emerald-700 font-number mt-0.5">{currency}{stats.income.toLocaleString()}</p>
                      </div>
                      <div className="bg-rose-50 rounded-lg md:rounded-xl p-2 md:p-2.5 text-center">
                        <p className="text-[9px] md:text-[10px] text-rose-600 font-medium uppercase tracking-wider">Expense</p>
                        <p className="text-xs md:text-sm font-bold text-rose-700 font-number mt-0.5">{currency}{stats.expense.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Profit */}
                    <div className={`rounded-lg md:rounded-xl p-2.5 md:p-3 text-center ${
                      stats.profit >= 0 ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-rose-50 to-orange-50'
                    }`}>
                      <div className="flex items-center justify-center gap-1 md:gap-1.5">
                        {stats.profit >= 0 ? (
                          <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 md:w-3.5 md:h-3.5 text-rose-500" />
                        )}
                        <span className={`text-xs md:text-sm font-bold font-number ${stats.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {stats.profit >= 0 ? '+' : ''}{currency}{stats.profit.toLocaleString()}
                        </span>
                        <span className={`text-[9px] md:text-[10px] font-medium ${stats.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          ({profitMargin}% margin)
                        </span>
                      </div>
                    </div>
                    
                    {/* Comparison Bar */}
                    <div className="pt-2 md:pt-3 border-t border-zinc-100">
                      <div className="flex justify-between items-center text-[9px] md:text-[10px] text-zinc-500 mb-1.5">
                        <span>vs Last Month</span>
                        <span className="font-medium font-number">{currency}{stats.lastMonthIncome.toLocaleString()}</span>
                      </div>
                      <div className="h-2 md:h-2.5 bg-zinc-100 rounded-full overflow-hidden relative">
                        <div 
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                            stats.growth >= 0 
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' 
                              : 'bg-gradient-to-r from-rose-400 to-rose-500'
                          }`}
                          style={{ 
                            width: `${Math.min(100, Math.max(8, stats.lastMonthIncome > 0 
                              ? Math.min(100, (stats.income / Math.max(stats.income, stats.lastMonthIncome)) * 100)
                              : stats.income > 0 ? 60 : 8
                            ))}%` 
                          }}
                        ></div>
                        {stats.lastMonthIncome > 0 && (
                          <div 
                            className="absolute inset-y-0 w-0.5 bg-zinc-400"
                            style={{ left: `${Math.min(100, (stats.lastMonthIncome / Math.max(stats.income, stats.lastMonthIncome, 1)) * 100)}%` }}
                          ></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )})}
          </div>
        </div>
      )}

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
