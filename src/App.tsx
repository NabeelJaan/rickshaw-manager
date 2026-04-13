import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Car, Receipt, Settings, Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Rickshaws from './components/Rickshaws';
import Drivers from './components/Drivers';
import Transactions from './components/Transactions';
import SettingsPage from './components/Settings';
import { Driver } from './types';

function AppContent() {
  const { isAuthenticated, logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [showAddDriverForm, setShowAddDriverForm] = useState(false);

  const fetchDrivers = () => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/drivers', { headers }).then(res => res.json()).then(data => {
      // Ensure we only set array data, not error objects
      if (Array.isArray(data)) {
        setDrivers(data);
      } else {
        console.error('fetchDrivers error:', data);
        setDrivers([]);
      }
    });
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDrivers();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'rickshaws', label: 'Rickshaws', icon: Car },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard selectedDriverId={selectedDriverId} />;
      case 'rickshaws': return <Rickshaws selectedDriverId={selectedDriverId} />;
      case 'drivers': return <Drivers onDriverAdded={fetchDrivers} defaultShowForm={showAddDriverForm} />;
      case 'transactions': return <Transactions selectedDriverId={selectedDriverId} />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard selectedDriverId={selectedDriverId} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-zinc-950 text-white p-4 flex justify-between items-center border-b border-zinc-800">
        <h1 className="text-xl font-bold flex items-center gap-2 tracking-tight">
          <Car className="w-6 h-6 text-emerald-400" />
          Rickshaw Manager
        </h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-zinc-950 text-zinc-300 transform transition-transform duration-200 ease-in-out border-r border-zinc-800 flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 hidden md:block">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
            <Car className="w-8 h-8 text-emerald-400" />
            Rickshaw<br/>Manager
          </h1>
        </div>

        <div className="px-4 mb-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.username}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Super Admin</p>
              </div>
            </div>
          </div>

          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Active Profile</label>
          <div className="relative">
            <select 
              className="w-full appearance-none bg-zinc-900 border border-zinc-800 text-white py-2.5 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm font-medium transition-shadow"
              value={selectedDriverId}
              onChange={(e) => {
                if (e.target.value === 'add_new') {
                  setActiveTab('drivers');
                  setShowAddDriverForm(true);
                  setSelectedDriverId('');
                } else {
                  setSelectedDriverId(e.target.value);
                  setShowAddDriverForm(false);
                }
              }}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
              <option value="add_new">+ Add New Driver</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <nav className="px-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-zinc-900">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-500 hover:bg-rose-500/10 hover:text-rose-500 transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto bg-zinc-50">
        <div className="max-w-6xl mx-auto">
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
