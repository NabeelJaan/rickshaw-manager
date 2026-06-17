import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Car, Receipt, Settings, Menu, X, LogOut, FileText } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Rickshaws from './components/Rickshaws';
import Drivers from './components/Drivers';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
import SettingsPage from './components/Settings';
import { Driver } from './types';

// Names to always show last in the driver list (case-insensitive substring match)
const PINNED_LAST_NAMES = ['zain', 'hassan'];

function AppContent() {
  const { isAuthenticated, logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [showAddDriverForm, setShowAddDriverForm] = useState(false);
  // Selected month for pending badges (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 7); // YYYY-MM
  });

  // Today's entry color: driverId -> 'income' | 'pending' | null
  const [todayEntryMap, setTodayEntryMap] = useState<Record<string, 'income' | 'pending' | null>>({});
  // Selected month pending balance per driver (from rent_pending transactions in selected month)
  const [monthlyPendingMap, setMonthlyPendingMap] = useState<Record<string, number>>({});
  // True once today's fetch completed — prevents flashing red before data loads
  const [todayFetched, setTodayFetched] = useState(false);
  // Driver id with highest profit this month
  const [topDriverId, setTopDriverId] = useState<string | null>(null);
  // Drivers on leave today
  const [driversOnLeave, setDriversOnLeave] = useState<Set<string>>(new Set());

  const fetchDrivers = () => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/drivers', { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDrivers(data);
        else { console.error('fetchDrivers error:', data); setDrivers([]); }
      });
  };

  // Fetch today's transactions (button color) + selected month's pending transactions (badge)
  const fetchTodayEntries = () => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const today = new Date().toISOString().split('T')[0];
    const monthToFetch = selectedMonth; // Use selected month instead of always current

    Promise.all([
      fetch(`/api/transactions?start_date=${today}&end_date=${today}`, { headers }).then(r => r.json()),
      fetch(`/api/transactions?month=${monthToFetch}`, { headers }).then(r => r.json()),
    ]).then(([todayData, monthData]) => {
      // Today color map
      if (Array.isArray(todayData)) {
        const map: Record<string, 'income' | 'pending' | null> = {};
        const onLeave = new Set<string>();

        todayData.forEach((tx: any) => {
          if (!tx.driver_id) return;
          const id = tx.driver_id.toString();

          if (tx.notes && tx.notes.toLowerCase().includes('leave')) {
            onLeave.add(id);
          }

          if (tx.category === 'rent_pending') {
            if (map[id] !== 'income') map[id] = 'pending';
          } else if (tx.type === 'income') {
            map[id] = 'income';
          }
        });

        setTodayEntryMap(map);
        setDriversOnLeave(onLeave);
        setTodayFetched(true);
      }

      // This month's pending balance per driver
      if (Array.isArray(monthData)) {
        const pendMap: Record<string, number> = {};
        monthData.forEach((tx: any) => {
          if (!tx.driver_id || tx.category !== 'rent_pending') return;
          const id = tx.driver_id.toString();
          pendMap[id] = (pendMap[id] || 0) + Number(tx.amount);
        });
        setMonthlyPendingMap(pendMap);

        // Compute each driver's profit this month: income - expense (excluding rent_pending)
        const profitMap: Record<string, number> = {};
        monthData.forEach((tx: any) => {
          if (!tx.driver_id || tx.category === 'rent_pending') return;
          const id = tx.driver_id.toString();
          if (!profitMap[id]) profitMap[id] = 0;
          if (tx.type === 'income') profitMap[id] += Number(tx.amount);
          else if (tx.type === 'expense') profitMap[id] -= Number(tx.amount);
        });
        // Find driver with highest profit (must be > 0 and strictly the best)
        let bestId: string | null = null;
        let bestProfit = -Infinity;
        Object.entries(profitMap).forEach(([id, profit]) => {
          if (profit > bestProfit) { bestProfit = profit; bestId = id; }
        });
        // Only crown if there's a clear winner with positive profit
        setTopDriverId(bestProfit > 0 ? bestId : null);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDrivers();
      fetchTodayEntries();
    }
  }, [isAuthenticated]);

  // Refetch monthly pending data when selectedMonth changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchTodayEntries();
    }
  }, [selectedMonth]);

  // Refresh every 60s - recreate interval when selectedMonth changes
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(fetchTodayEntries, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated, selectedMonth]);

  if (!isAuthenticated) return <LoginPage />;

  // Sort: Zain & Hassan always last
  const isPinnedLast = (name: string) =>
    PINNED_LAST_NAMES.some(p => name.toLowerCase().includes(p));

  const sortedDrivers = [...drivers].sort((a, b) => {
    const aLast = isPinnedLast(a.name);
    const bLast = isPinnedLast(b.name);
    if (aLast && !bLast) return 1;
    if (!aLast && bLast) return -1;
    return 0;
  });

  // Driver button background based on today's entry status (leave takes priority)
  const getDriverButtonClasses = (driverId: string, isSelected: boolean, isOnLeave: boolean) => {
    if (isOnLeave) {
      return isSelected
        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
        : 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100';
    }
    const entry = todayEntryMap[driverId];
    const noEntry = todayFetched && !entry;
    if (isSelected) {
      if (entry === 'income') return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';
      if (entry === 'pending') return 'bg-amber-500 text-white shadow-lg shadow-amber-500/20';
      if (noEntry) return 'bg-rose-500 text-white shadow-lg shadow-rose-500/20';
      return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';
    }
    if (entry === 'income') return 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100';
    if (entry === 'pending') return 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100';
    if (noEntry) return 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100';
    return 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200';
  };

  // Format pending badge: 1000->1, 2700->2.7, 7000->7
  const formatPendingBadge = (amount: number): string | null => {
    if (!amount || amount <= 0) return null;
    const val = amount / 1000;
    if (Number.isInteger(val)) return String(val);
    return parseFloat(val.toFixed(1)).toString();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'rickshaws', label: 'Rickshaws', icon: Car },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard selectedDriverId={selectedDriverId} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />;
      case 'rickshaws': return <Rickshaws selectedDriverId={selectedDriverId} />;
      case 'drivers': return <Drivers onDriverAdded={fetchDrivers} defaultShowForm={showAddDriverForm} />;
      case 'transactions': return <Transactions selectedDriverId={selectedDriverId} />;
      case 'reports': return <Reports selectedDriverId={selectedDriverId} />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard selectedDriverId={selectedDriverId} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-gradient-to-r from-zinc-950 to-zinc-900 text-white p-4 flex justify-between items-center border-b border-zinc-800 shadow-lg">
        <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg">
            <Car className="w-5 h-5 text-emerald-400" />
          </div>
          Rickshaw Manager
        </h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-300
        transform transition-all duration-300 ease-in-out border-r border-zinc-800/50 flex flex-col shadow-2xl
        ${isMobileMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full md:translate-x-0 pointer-events-none md:pointer-events-auto'}
      `}>
        <div className="p-6 hidden md:block border-b border-zinc-800/50">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20">
              <Car className="w-6 h-6 text-white" />
            </div>
            Rickshaw Manager
          </h1>
        </div>

        <div className="px-4 mb-6">
          <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-medium">Super Admin</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="px-3 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                  ${isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400 font-medium border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors'}`} />
                <span className="text-sm">{item.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-zinc-800/50">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 border border-transparent transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-3 md:p-8 lg:p-10 overflow-y-auto min-h-screen">
        <div className="max-w-7xl mx-auto">

          {/* Driver Filter Tabs */}
          <div className="mb-4 md:mb-6">
            <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-500" />
              <span className="text-xs md:text-sm font-medium text-zinc-600">Select Driver:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">

              {/* All Drivers */}
              <button
                onClick={() => { setSelectedDriverId(''); setShowAddDriverForm(false); setIsMobileMenuOpen(false); }}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all ${
                  selectedDriverId === ''
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50 border border-zinc-200'
                }`}
              >
                All Drivers
              </button>

              {/* Individual drivers — Zain & Hassan pinned last */}
              {sortedDrivers.map(d => {
                const dId = d.id.toString();
                const isSelected = selectedDriverId === dId;
                const isTop = topDriverId === dId;
                const isOnLeave = driversOnLeave.has(dId);
                // Badge uses current month's pending only
                const monthPending = monthlyPendingMap[dId] || 0;
                const pendingLabel = formatPendingBadge(monthPending);
                return (
                  <div key={d.id} className="relative inline-flex">
                    <button
                      onClick={() => { setSelectedDriverId(dId); setShowAddDriverForm(false); setIsMobileMenuOpen(false); }}
                      className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-all ${getDriverButtonClasses(dId, isSelected, isOnLeave)}`}
                    >
                      {isTop && <span className="mr-1 text-[11px]">⭐</span>}{d.name}
                    </button>
                    {pendingLabel && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none shadow-md shadow-amber-500/40 pointer-events-none">
                        {pendingLabel}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Add Driver */}
              <button
                onClick={() => { setActiveTab('drivers'); setShowAddDriverForm(true); setSelectedDriverId(''); setIsMobileMenuOpen(false); }}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-dashed border-zinc-300 transition-all flex items-center gap-1 md:gap-1.5"
              >
                <Users className="w-3 h-3 md:w-3.5 md:h-3.5" /> Add Driver
              </button>
            </div>
          </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}