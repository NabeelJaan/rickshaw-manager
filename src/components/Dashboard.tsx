import { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { TrendingUp, TrendingDown, DollarSign, Car, Plus, Edit, ChevronDown, Trash2, Users, Percent } from 'lucide-react';
import { DashboardStats, Transaction, Driver } from '../types';
import { currentMonth, recentMonths, formatDate } from '../utils/date';
import LogRentModal from './LogRentModal';
import ExpenseModal from './ExpenseModal';
import EditTransactionModal from './EditTransactionModal';
import AddPendingBalanceModal from './AddPendingBalanceModal';

interface DashboardProps {
  selectedDriverId?: string;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
}

export default function Dashboard({ selectedDriverId, selectedMonth: propSelectedMonth, onMonthChange }: DashboardProps) {
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
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense' | 'pending'>('all');
  // Use prop month if provided (controlled by parent), otherwise use local state
  const [localSelectedMonth, setLocalSelectedMonth] = useState<string>(() => currentMonth());
  const selectedMonth = propSelectedMonth ?? localSelectedMonth;
  const setSelectedMonth = (month: string) => {
    if (onMonthChange) onMonthChange(month);
    setLocalSelectedMonth(month);
  };

  // Load currency from settings
  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
    
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
    const headers: Record<string, string> = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    Promise.all([
      fetch(`/api/stats${query}`, { headers }).then(res => res.json()).catch(() => ({})),
      fetch(`/api/transactions${query ? query + '&' : '?'}limit=30`, { headers }).then(res => res.json()).catch(() => [])
    ]).then(([statsData, txData]) => {
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

  const calculateCumulativeProfit = () => {
    if (!selectedMonth || selectedMonth === 'all') return stats.allTimeProfit ?? stats.profit ?? 0;
    if (!stats.monthlyData || !Array.isArray(stats.monthlyData)) return stats.profit ?? 0;
    
    const hasSelectedMonth = stats.monthlyData.some((d: any) => d.month === selectedMonth);
    if (!hasSelectedMonth) return stats.profit ?? 0;
    
    return [...stats.monthlyData]
      .sort((a: any, b: any) => a.month.localeCompare(b.month))
      .filter((d: any) => d.month <= selectedMonth)
      .reduce((sum: number, d: any) => sum + ((d.income || 0) - (d.expense || 0)), 0);
  };

  const cumulativeProfit = calculateCumulativeProfit();
  const remainingInvestment = Math.max(0, (stats.totalInvestment || 0) - cumulativeProfit);
  const isFullyRecovered = remainingInvestment === 0 && (stats.totalInvestment || 0) > 0;
  const totalProfit = cumulativeProfit - (stats.totalInvestment || 0);
  // ROI = profit returned relative to the investment (cumulative profit up to selected month)
  const roi = (stats.totalInvestment || 0) > 0
    ? (cumulativeProfit / (stats.totalInvestment || 1)) * 100
    : 0;

  // Monthly avg: always based on the selected month's data, never affected by All Time
  // Use historical activeRickshaws count from that month if available
  const currentMonthData = (stats.monthlyData || []).find((d: any) => d.month === selectedMonth);
  const monthlyProfit = currentMonthData
    ? (currentMonthData.income || 0) - (currentMonthData.expense || 0)
    : (stats.profit || 0);
  // Use the activeRickshaws count for that specific month (e.g., April had 7, May had 9)
  const activeDriversForMonth = currentMonthData?.activeRickshaws ?? stats.activeRickshaws ?? 1;
  const monthlyAvg = Math.round((monthlyProfit + (stats.pendingBalance || 0)) / activeDriversForMonth);

  const statCards = [
    { title: 'Revenue', value: stats.totalIncome || 0, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', prefix: currency + ' ', showOnMobile: true },
    { title: 'Expense', value: stats.totalExpense || 0, icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-50', prefix: currency + ' ', showOnMobile: true },
    { title: 'Net Profit', value: stats.profit || 0, icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-50', prefix: currency + ' ', showOnMobile: true },
    { title: 'Pending', value: stats.pendingBalance || 0, icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-50', prefix: currency + ' ', showOnMobile: true },
    { title: 'Revenue + Pending', value: (stats.totalIncome || 0) + (stats.pendingBalance || 0), icon: TrendingUp, color: 'text-teal-500', bg: 'bg-teal-50', prefix: currency + ' ', showOnMobile: true },
    { title: 'Profit + Pending', value: (stats.profit || 0) + (stats.pendingBalance || 0), icon: DollarSign, color: 'text-indigo-500', bg: 'bg-indigo-50', prefix: currency + ' ', showOnMobile: true },
    { title: 'Investment', value: stats.totalInvestment || 0, icon: Car, color: 'text-purple-500', bg: 'bg-purple-50', prefix: currency + ' ', showOnMobile: false },
    { title: 'Monthly Avg', value: monthlyAvg, icon: DollarSign, color: 'text-cyan-500', bg: 'bg-cyan-50', prefix: currency + ' ', showOnMobile: false, hideOnDriver: true },
    {
      title: isFullyRecovered ? 'Profit After Investment' : 'Remaining',
      value: isFullyRecovered ? totalProfit : remainingInvestment,
      icon: isFullyRecovered ? TrendingUp : TrendingDown, 
      color: isFullyRecovered ? 'text-emerald-500' : 'text-orange-500', 
      bg: isFullyRecovered ? 'bg-emerald-50' : 'bg-orange-50', 
      prefix: isFullyRecovered ? '+' + currency + ' ' : currency + ' ',
      subtitle: isFullyRecovered ? 'Investment recovered!' : undefined,
      showOnMobile: true
    },
    { title: 'Rickshaws', value: `${stats.activeRickshaws || 0}/${stats.totalRickshaws || 0}`, icon: Car, color: 'text-zinc-500', bg: 'bg-zinc-50', prefix: '', hideOnDriver: true, showOnMobile: false },
    { title: 'ROI', value: `${roi.toFixed(1)}%`, icon: Percent, color: roi >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: roi >= 0 ? 'bg-emerald-50' : 'bg-rose-50', prefix: '', showOnMobile: true },
  ];

  const filteredStatCards = selectedDriverId 
    ? statCards.filter(card => !card.hideOnDriver) 
    : statCards;

  const leaveRecords = (Array.isArray(transactions) ? transactions : []).filter(t => 
    t.notes && (t.notes.toLowerCase().includes('leave') || t.notes.toLowerCase().includes('off'))
  );

  const oilChangeRecords = (Array.isArray(transactions) ? transactions : []).filter(t => 
    t.category && (t.category.toLowerCase().includes('oil') || t.category.toLowerCase().includes('engine'))
  ).slice(0, 1);

  // Filtered transactions for the table
  const allTransactions = Array.isArray(transactions) ? transactions : [];
  const filteredTransactions = txFilter === 'all'
    ? allTransactions
    : txFilter === 'income'
      ? allTransactions.filter(t => t.type === 'income')
      : txFilter === 'pending'
        ? allTransactions.filter(t => t.category === 'rent_pending')
        : allTransactions.filter(t => t.type === 'expense' && t.category !== 'rent_pending');

  // Chart helpers for mobile — limit daily labels to avoid overflow
  const buildChartData = (view: 'daily' | 'monthly') => {
    const raw = (view === 'daily' ? stats.dailyData : stats.monthlyData) || [];
    // On daily view, trim label to DD (e.g. "15") to save space
    const categories = raw.map((d: any) => {
      if (view === 'daily') {
        const parts = (d.date || '').split('-');
        return parts[2] ? parts[2] : d.date;
      }
      // Monthly: shorten to "Jan", "Feb", etc.
      try {
        const [y, m] = (d.month || '').split('-');
        const date = new Date(Number(y), Number(m) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'short' });
      } catch {
        return d.month;
      }
    });
    return { categories, raw };
  };

  const mainChartData = buildChartData(chartView);
  const yearChartData = buildChartData('monthly');

  const mobileXAxisOptions = {
    labels: {
      rotate: -45,
      rotateAlways: true,
      style: { colors: '#71717a', fontSize: '9px' },
      trim: true,
      hideOverlappingLabels: true,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  };

  const desktopXAxisOptions = {
    labels: {
      style: { colors: '#71717a', fontSize: '12px' },
      hideOverlappingLabels: true,
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  };

  return (
    <div className="space-y-3 md:space-y-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[18px] sm:text-[22px] md:text-[40px] font-semibold text-zinc-900 tracking-tight leading-tight break-words">
              {selectedDriverId ? (
                <>
                  {selectedMonth && selectedMonth !== 'all' ? (
                    <>
                      {formatDate(selectedMonth + '-01', { month: 'short', year: 'numeric' })} - {selectedDriverName}
                    </>
                  ) : (
                    selectedDriverName
                  )}
                </>
              ) : 'Overview'}
            </h1>
            {!selectedDriverId && (
              <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-green-50 rounded-lg md:rounded-xl border border-green-100">
                <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" />
                <span className="text-[11px] md:text-[14px] font-medium text-green-700">Today:</span>
                <span className="text-[13px] md:text-[18px] font-bold text-green-700 font-number">{currency} {stats.todayTotal?.toLocaleString() || 0}</span>
              </div>
            )}
          </div>
          <p className="text-[12px] md:text-[14px] text-zinc-500 mt-0.5">
            {formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 px-3 md:h-11 md:px-4 bg-zinc-100 border-0 rounded-lg md:rounded-xl text-[12px] md:text-[14px] text-zinc-700 font-medium hover:bg-zinc-200 transition-colors cursor-pointer focus:ring-2 focus:ring-zinc-300 outline-none max-w-[120px] sm:max-w-none"
          >
            <option value="all">All Time</option>
            {recentMonths(12).map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {selectedDriverId && (
            <button 
              onClick={() => setIsExpenseModalOpen(true)}
              className="h-9 px-3 md:h-11 md:px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg md:rounded-xl text-[12px] md:text-[14px] font-medium transition-colors flex items-center gap-1.5 md:gap-2"
            >
              <TrendingDown className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Expense</span>
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowTransactionDropdown(!showTransactionDropdown)}
              className="h-9 px-3 md:h-11 md:px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg md:rounded-xl text-[12px] md:text-[14px] font-medium transition-colors flex items-center gap-1.5 md:gap-2"
            >
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Add</span>
              <ChevronDown className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-transform ${showTransactionDropdown ? 'rotate-180' : ''}`} />
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
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
        {filteredStatCards.map((card, i) => (
          <div 
            key={i} 
            className="bg-white p-2.5 md:p-6 rounded-xl md:rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col gap-1 md:gap-3"
          >
            <div className={`w-6 h-6 md:w-10 md:h-10 rounded-lg md:rounded-xl ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-3 h-3 md:w-5 md:h-5 ${card.color}`} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] md:text-[13px] text-zinc-500 font-medium leading-tight">{card.title}</p>
              <h3 className={`text-[13px] md:text-[26px] font-semibold tracking-tight font-number mt-0.5 md:mt-1 ${card.color}`}>
                {card.prefix}{typeof card.value === 'string' ? card.value : card.value.toLocaleString()}
              </h3>
            </div>
            {card.subtitle && (
              <p className="text-[10px] md:text-[12px] text-emerald-600 font-medium">{card.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {selectedDriverId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
          <div className="bg-white p-2.5 md:p-6 rounded-xl md:rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-1.5 md:mb-4">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-6 h-6 md:w-10 md:h-10 rounded-md md:rounded-lg bg-amber-50 flex items-center justify-center">
                  <Users className="w-3 h-3 md:w-5 md:h-5 text-amber-600" />
                </div>
                <h3 className="text-[11px] md:text-[15px] font-semibold text-zinc-900">Monthly Leave</h3>
              </div>
              <span className="text-[10px] md:text-[13px] font-medium text-zinc-500">{leaveRecords.length} days</span>
            </div>
            {leaveRecords.length === 0 ? (
              <p className="text-[10px] md:text-[13px] text-zinc-400 text-center py-3 md:py-6">No leave records this month</p>
            ) : (
              <div className="space-y-1 md:space-y-2">
                {leaveRecords.map(t => (
                  <div key={t.id} className="flex items-center gap-1.5 p-1.5 md:p-3 bg-zinc-50 rounded-lg md:rounded-xl">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-amber-400"></div>
                    <p className="text-[10px] md:text-[13px] font-medium text-zinc-700">
                      {formatDate(t.date, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-2.5 md:p-6 rounded-xl md:rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-4">
              <div className="w-6 h-6 md:w-10 md:h-10 rounded-md md:rounded-lg bg-blue-50 flex items-center justify-center">
                <Car className="w-3 h-3 md:w-5 md:h-5 text-blue-600" />
              </div>
              <h3 className="text-[11px] md:text-[15px] font-semibold text-zinc-900">Last Oil Change</h3>
            </div>
            {oilChangeRecords.length === 0 ? (
              <p className="text-[10px] md:text-[13px] text-zinc-400 text-center py-3 md:py-6">No oil change records</p>
            ) : (
              <div className="space-y-1 md:space-y-3">
                {oilChangeRecords.map(t => (
                  <div key={t.id} className="flex justify-between items-start p-1.5 md:p-3 bg-zinc-50 rounded-lg md:rounded-xl">
                    <div>
                      {t.rickshaw_number && (
                        <p className="text-[10px] md:text-[13px] font-semibold text-zinc-900">Rickshaw {t.rickshaw_number}</p>
                      )}
                      <p className="text-[9px] md:text-[12px] text-zinc-500 mt-0.5">
                        {formatDate(t.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      {t.notes && (
                        <p className="text-[9px] md:text-[12px] text-zinc-600 mt-1 md:mt-1.5 italic">{t.notes}</p>
                      )}
                    </div>
                    <span className={`text-[10px] md:text-[13px] font-semibold font-number ${
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
      <div className="bg-white rounded-xl md:rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-2.5 md:p-6 border-b border-zinc-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-4">
            <h3 className="text-[11px] md:text-[17px] font-semibold text-zinc-900">Recent Transactions</h3>
            <div className="flex items-center gap-1.5 md:gap-3 flex-wrap">
              {/* Filter tabs */}
              <div className="flex bg-zinc-100 p-0.5 rounded-lg shrink-0">
                {(['all', 'income', 'expense', 'pending'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={`px-3 py-1.5 text-[11px] md:text-[12px] rounded-md transition-all font-medium capitalize whitespace-nowrap ${
                      txFilter === f
                        ? 'bg-white shadow-sm text-zinc-900'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {/* Count badges */}
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 md:px-3 md:py-1.5 bg-emerald-50 rounded-md md:rounded-lg">
                  <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[9px] md:text-[12px] font-semibold text-emerald-700">
                    {allTransactions.filter(t => t.type === 'income').length}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 md:px-3 md:py-1.5 bg-rose-50 rounded-md md:rounded-lg">
                  <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-rose-500"></div>
                  <span className="text-[9px] md:text-[12px] font-semibold text-rose-700">
                    {allTransactions.filter(t => t.type === 'expense' && t.category !== 'rent_pending').length}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 md:px-3 md:py-1.5 bg-amber-50 rounded-md md:rounded-lg">
                  <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-amber-500"></div>
                  <span className="text-[9px] md:text-[12px] font-semibold text-amber-700">
                    {allTransactions.filter(t => t.category === 'rent_pending').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile View */}
        <div className="block md:hidden">
          {filteredTransactions.map(t => (
            <div key={t.id} className="px-2.5 py-2 border-b border-zinc-100 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className={
                    t.type === 'income' 
                      ? 'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50' 
                      : t.category === 'rent_pending' 
                        ? 'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-amber-50' 
                        : 'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-rose-50'
                  }>
                    {t.type === 'income' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    ) : t.category === 'rent_pending' ? (
                      <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-zinc-900 capitalize">{t.category.replace('_', ' ')}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {formatDate(t.date, { month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {t.rickshaw_number && (
                        <span className="text-[9px] text-zinc-500 bg-zinc-100 px-1 py-0.5 rounded">{t.rickshaw_number}</span>
                      )}
                      {t.driver_name && (
                        <span className="text-[9px] text-zinc-500 bg-zinc-100 px-1 py-0.5 rounded">{t.driver_name}</span>
                      )}
                    </div>
                    {t.notes && (
                      <p className="text-[9px] text-zinc-500 mt-1 italic truncate">{t.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={
                    t.category === 'rent_pending' 
                      ? 'text-[12px] font-bold font-number text-amber-600' 
                      : t.type === 'income' 
                        ? 'text-[12px] font-bold font-number text-emerald-600' 
                        : 'text-[12px] font-bold font-number text-rose-600'
                  }>
                    {t.category === 'rent_pending' ? '+' : t.type === 'income' ? '+' : '-'}{currency}{t.amount.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 justify-end">
                    <button 
                      onClick={() => handleEditTransaction(t)} 
                      className="text-zinc-400 hover:text-zinc-700"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteTransaction(t.id)} 
                      className="text-zinc-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="p-4 text-sm text-zinc-600 font-medium">
                    <div className="flex items-center gap-2">
                      <div className={
                        t.type === 'income' 
                          ? 'w-2 h-2 rounded-full bg-emerald-500' 
                          : t.category === 'rent_pending' 
                            ? 'w-2 h-2 rounded-full bg-amber-500' 
                            : 'w-2 h-2 rounded-full bg-rose-500'
                      }></div>
                      {formatDate(t.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className={
                      t.type === 'income' 
                        ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700' 
                        : t.category === 'rent_pending' 
                          ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700' 
                          : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700'
                    }>
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
                  <td className={
                    t.type === 'income' 
                      ? 'p-4 text-sm font-bold font-number text-emerald-600' 
                      : t.category === 'rent_pending' 
                        ? 'p-4 text-sm font-bold font-number text-amber-600' 
                        : 'p-4 text-sm font-bold font-number text-rose-600'
                  }>
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
        {filteredTransactions.length === 0 && (
          <div className="p-12 text-center text-zinc-500">
            No recent transactions
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-6">
        <div className="bg-white p-2.5 md:p-6 rounded-xl md:rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex justify-between items-center mb-2 md:mb-6">
            <h3 className="text-[11px] md:text-[15px] font-semibold text-zinc-900">Income vs Expense</h3>
            <div className="flex bg-zinc-100 p-0.5 md:p-1 rounded-lg md:rounded-xl">
              <button 
                onClick={() => setChartView('daily')}
                className={
                  chartView === 'daily' 
                    ? 'px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-[13px] rounded-md md:rounded-lg transition-all bg-white shadow-sm text-zinc-900 font-medium' 
                    : 'px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-[13px] rounded-md md:rounded-lg transition-all text-zinc-500 hover:text-zinc-700'
                }
              >
                Daily
              </button>
              <button 
                onClick={() => setChartView('monthly')}
                className={
                  chartView === 'monthly' 
                    ? 'px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-[13px] rounded-md md:rounded-lg transition-all bg-white shadow-sm text-zinc-900 font-medium' 
                    : 'px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-[13px] rounded-md md:rounded-lg transition-all text-zinc-500 hover:text-zinc-700'
                }
              >
                Monthly
              </button>
            </div>
          </div>
          {/* Mobile chart: fixed height with overflow scroll wrapper */}
          <div className="h-52 md:h-72">
            <ReactApexChart
              key={`main-chart-${chartView}-${stats.monthlyData?.length}-${stats.dailyData?.length}`}
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
                  categories: mainChartData.categories,
                  labels: {
                    rotate: -45,
                    rotateAlways: false,
                    hideOverlappingLabels: true,
                    trim: true,
                    style: { colors: '#71717a', fontSize: '10px' },
                  },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: { colors: '#71717a', fontSize: '10px' },
                    formatter: (val: number) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : `${val}`,
                  },
                },
                fill: { opacity: 1 },
                tooltip: {
                  theme: 'light',
                  style: { fontSize: '12px' },
                },
                colors: ['#10b981', '#f43f5e'],
                legend: {
                  position: 'top',
                  horizontalAlign: 'left',
                  markers: { radius: 12 },
                  fontSize: '11px',
                },
                responsive: [
                  {
                    breakpoint: 768,
                    options: {
                      chart: { height: 208 },
                      plotOptions: { bar: { columnWidth: '70%', borderRadius: 3 } },
                      xaxis: {
                        labels: {
                          rotate: -45,
                          rotateAlways: true,
                          hideOverlappingLabels: true,
                          trim: true,
                          style: { fontSize: '9px', colors: '#71717a' },
                        },
                      },
                      yaxis: {
                        labels: {
                          style: { fontSize: '9px' },
                          formatter: (val: number) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : `${val}`,
                        },
                      },
                      legend: { fontSize: '10px' },
                    },
                  },
                ],
              }}
              series={[
                {
                  name: 'Income',
                  data: mainChartData.raw.map((d: any) => d.income) || [],
                },
                {
                  name: 'Expense',
                  data: mainChartData.raw.map((d: any) => d.expense) || [],
                },
              ]}
              type="bar"
              height="100%"
            />
          </div>
        </div>

        <div className="bg-white p-2.5 md:p-6 rounded-xl md:rounded-2xl border border-zinc-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3 className="text-[11px] md:text-[15px] font-semibold text-zinc-900 mb-2 md:mb-6">Total Income by Month (Last Year)</h3>
          <div className="h-52 md:h-72">
            <ReactApexChart
              key={`year-chart-${stats.monthlyData?.length}-${stats.monthlyData?.map((d: any) => d.month).join(',')}`}
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
                  categories: yearChartData.categories,
                  labels: {
                    rotate: -45,
                    rotateAlways: false,
                    hideOverlappingLabels: true,
                    trim: true,
                    style: { colors: '#71717a', fontSize: '10px' },
                  },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: { colors: '#71717a', fontSize: '10px' },
                    formatter: (val: number) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : `${val}`,
                  },
                },
                fill: { opacity: 1 },
                tooltip: {
                  theme: 'light',
                  style: { fontSize: '12px' },
                },
                colors: ['#10b981'],
                responsive: [
                  {
                    breakpoint: 768,
                    options: {
                      chart: { height: 208 },
                      plotOptions: { bar: { columnWidth: '70%', borderRadius: 3 } },
                      xaxis: {
                        labels: {
                          rotate: -45,
                          rotateAlways: true,
                          hideOverlappingLabels: true,
                          trim: true,
                          style: { fontSize: '9px', colors: '#71717a' },
                        },
                      },
                      yaxis: {
                        labels: {
                          style: { fontSize: '9px' },
                          formatter: (val: number) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : `${val}`,
                        },
                      },
                    },
                  },
                ],
              }}
              series={[
                {
                  name: 'Income',
                  data: yearChartData.raw.map((d: any) => d.income) || [],
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
        onSuccess={fetchData}
        selectedDriverId={selectedDriverId}
      />
      
      <ExpenseModal 
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={fetchData}
        driverId={selectedDriverId || ''}
        driverName={selectedDriverName}
      />
      
      <AddPendingBalanceModal 
        isOpen={isPendingBalanceModalOpen} 
        onClose={() => setIsPendingBalanceModalOpen(false)} 
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