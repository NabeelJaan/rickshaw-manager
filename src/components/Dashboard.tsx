import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Car, Plus, Edit, ChevronDown, Trash2 } from 'lucide-react';
import { DashboardStats, Transaction } from '../types';
import LogRentModal from './LogRentModal';
import ExpenseModal from './ExpenseModal';
import EditTransactionModal from './EditTransactionModal';

export default function Dashboard({ selectedDriverId }: { selectedDriverId?: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'monthly' | 'daily'>('daily');
  const [isLogRentModalOpen, setIsLogRentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState('');
  const [currency, setCurrency] = useState('Rs.');
  const [showTransactionDropdown, setShowTransactionDropdown] = useState(false);

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
      await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const fetchData = () => {
    setLoading(true);
    const query = selectedDriverId ? `?driver_id=${selectedDriverId}` : '';
    console.log('Dashboard fetching data with query:', query);
    console.log('selectedDriverId (type):', selectedDriverId, typeof selectedDriverId);
    
    Promise.all([
      fetch(`/api/stats${query}`).then(res => res.json()),
      fetch(`/api/transactions${query ? query + '&' : '?'}limit=10`).then(res => res.json())
    ]).then(([statsData, txData]) => {
      console.log('Dashboard received stats:', statsData);
      console.log('Dashboard received transactions:', txData);
      console.log('Number of transactions:', txData.length || 0);
      
      // Log each transaction's driver_id for debugging
      if (txData && txData.length > 0) {
        console.log('Transaction driver_ids:', txData.map((t: any) => ({
          id: t.id,
          driver_id: t.driver_id,
          driver_id_type: typeof t.driver_id,
          amount: t.amount,
          date: t.date
        })));
      }
      
      setStats(statsData);
      setTransactions(txData);
      setLoading(false);
    }).catch(error => {
      console.error('Dashboard fetch error:', error);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, [selectedDriverId]);

  useEffect(() => {
    if (selectedDriverId) {
      fetch(`/api/drivers`)
        .then(res => res.json())
        .then(drivers => {
          const driver = drivers.find((d: any) => d.id.toString() === selectedDriverId);
          setSelectedDriverName(driver ? driver.name : '');
        });
    } else {
      setSelectedDriverName('');
    }
  }, [selectedDriverId]);

  if (loading || !stats) return <div className="animate-pulse flex space-x-4">Loading...</div>;

  const statCards = [
    { title: 'Total Revenue', value: stats.totalIncome, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', prefix: currency + ' ' },
    { title: 'Total Expense', value: stats.totalExpense, icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10', prefix: currency + ' ' },
    { title: 'Net Profit', value: stats.profit, icon: DollarSign, color: 'text-blue-500', bg: 'bg-blue-500/10', prefix: currency + ' ' },
    { title: 'Pending Balance', value: stats.pendingBalance, icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-500/10', prefix: currency + ' ' },
    { title: 'Total Investment', value: stats.totalInvestment, icon: Car, color: 'text-purple-500', bg: 'bg-purple-500/10', prefix: currency + ' ' },
    { title: 'Remaining Investment', value: Math.max(0, stats.totalInvestment - stats.profit), icon: TrendingDown, color: 'text-orange-500', bg: 'bg-orange-500/10', prefix: currency + ' ' },
    { title: 'Active Rickshaws', value: stats.activeRickshaws, icon: Car, color: 'text-indigo-500', bg: 'bg-indigo-500/10', prefix: '' },
    { title: 'Total Rickshaws', value: stats.totalRickshaws, icon: Car, color: 'text-zinc-500', bg: 'bg-zinc-500/10', prefix: '' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">
          {selectedDriverId ? `${selectedDriverName}'s Overview` : 'Dashboard Overview'}
        </h2>
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
                    setIsExpenseModalOpen(true);
                    setShowTransactionDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                >
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  Add Expense
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className={`bg-white p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-4 transition-shadow hover:shadow-md`}>
            <div className="flex justify-between items-start">
              <div className={`p-2.5 rounded-xl ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <div>
              <p className="text-[13px] font-medium text-zinc-500 mb-1">{card.title}</p>
              <h3 className="text-2xl font-semibold text-zinc-900 font-number tracking-tight">
                {card.prefix}{card.value.toLocaleString()}
              </h3>
            </div>
          </div>
        ))}
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
          <div className="h-72">
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={chartView === 'daily' ? stats.dailyData : stats.monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey={chartView === 'daily' ? 'date' : 'month'} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} dy={10} />
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
          <div className="h-72">
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={stats.monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#71717a' }} dy={10} />
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <h3 className="text-base font-semibold text-zinc-900 mb-6">Recent Transactions</h3>
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
                        onClick={() => handleEditTransaction(t)} 
                        className="text-zinc-400 hover:text-emerald-500 transition-colors"
                        title="Edit transaction"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTransaction(t.id)} 
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
                    No recent transactions
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
