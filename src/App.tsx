import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Car, Receipt, Settings, Menu, X, ChevronDown, LogOut, FileText } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import Rickshaws from './components/Rickshaws';
import Drivers from './components/Drivers';
import Transactions from './components/Transactions';
import Reports from './components/Reports';
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
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard selectedDriverId={selectedDriverId} />;
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
        ></div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-300 transform transition-all duration-300 ease-in-out border-r border-zinc-800/50 flex flex-col shadow-2xl
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
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
          <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50 rounded-2xl p-4 mb-6 backdrop-blur-sm">
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

          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Active Profile</label>
          <div className="relative">
            <select 
              className="w-full appearance-none bg-zinc-800/50 border border-zinc-700/50 text-white py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm font-medium transition-all backdrop-blur-sm"
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
                setIsMobileMenuOpen(false); // Close mobile menu on selection
              }}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
              <option value="add_new">+ Add New Driver</option>
            </select>
            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        <nav className="px-3 space-y-1 flex-1">
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
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400 font-medium border border-emerald-500/30 shadow-lg shadow-emerald-500/10' 
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300 transition-colors'}`} />
                <span className="text-sm">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"></div>
                )}
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
      <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
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
