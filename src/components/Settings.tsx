import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Edit, Save, Download, FileText, RefreshCw, Users, TrendingUp, TrendingDown } from 'lucide-react';
import UserManagement from './UserManagement';
import { useAuth } from '../contexts/AuthContext';
import { todayYMD } from '../utils/date';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface AppSettings {
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  autoBackup: boolean;
  reportFormat: 'pdf' | 'excel';
}

const defaultSettings: AppSettings = {
  currency: 'PKR',
  currencySymbol: 'Rs.',
  dateFormat: 'DD-MM-YYYY',
  autoBackup: false,
  reportFormat: 'pdf'
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'categories' | 'general' | 'data' | 'users'>('general');
  const [showUserManagement, setShowUserManagement] = useState(false);
  const { user: currentUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', type: 'income' as 'income' | 'expense' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [tempSettings, setTempSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  // One-time maintenance: tag legacy transactions (saved with only a driver) with the
  // rickshaw the driver was assigned to — expenses are tracked per rickshaw.
  const backfillRickshawIds = async () => {
    if (!confirm('Link all old transactions to their rickshaws based on driver assignments? This is safe — it only fills in missing rickshaw links, amounts are not changed.')) return;
    setIsBackfilling(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/admin/backfill-rickshaw-ids', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      alert(`Done!\n\nUntagged before: ${data.untagged_before}\nLinked: ${data.total_updated}\nStill untagged: ${data.still_untagged}${data.still_untagged > 0 ? '\n\n(Remaining ones have drivers with no assignment history.)' : ''}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchSettings();
  }, []);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/categories', { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/settings', { headers });
      if (response.ok) {
        const data = await response.json();
        const parsedSettings: AppSettings = {
          currency: data.currency || 'PKR',
          currencySymbol: data.currency_symbol || 'Rs.',
          dateFormat: data.date_format || 'DD-MM-YYYY',
          autoBackup: !!data.auto_backup,
          reportFormat: data.report_format || 'pdf'
        };
        setSettings(parsedSettings);
        setTempSettings(parsedSettings);
        localStorage.setItem('currency', parsedSettings.currencySymbol);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const saveCategories = (updatedCategories: Category[]) => {
    setCategories(updatedCategories);
    localStorage.setItem('categories', JSON.stringify(updatedCategories));
  };

  const saveSettings = async (updatedSettings: AppSettings) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currency: updatedSettings.currency,
          currencySymbol: updatedSettings.currencySymbol,
          dateFormat: updatedSettings.dateFormat,
          autoBackup: updatedSettings.autoBackup,
          reportFormat: updatedSettings.reportFormat
        })
      });
      
      if (response.ok) {
        setSettings(updatedSettings);
        localStorage.setItem('currency', updatedSettings.currencySymbol);
        
        // Trigger a custom event to notify other components
        window.dispatchEvent(new Event('localStorageUpdated'));
      } else {
        const error = await response.json();
        alert(`Error saving settings: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const updateTempSettings = (key: keyof AppSettings, value: any) => {
    const newTempSettings = { ...tempSettings, [key]: value };
    setTempSettings(newTempSettings);
    
    // Check if there are changes
    const changes = JSON.stringify(newTempSettings) !== JSON.stringify(settings);
    setHasChanges(changes);
  };

  const saveAllSettings = () => {
    saveSettings(tempSettings);
    setHasChanges(false);
    alert('Settings saved successfully!');
  };

  const addCategory = async () => {
    if (!newCategory.name.trim()) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newCategory.name.trim().toLowerCase().replace(/\s+/g, '_'),
          type: newCategory.type
        })
      });
      
      if (response.ok) {
        await fetchCategories();
        setNewCategory({ name: '', type: 'income' });
      } else {
        const error = await response.json();
        alert(`Error adding category: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('Failed to add category. Please try again.');
    }
  };

  const updateCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      const response = await fetch(`/api/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: editingCategory.name.trim().toLowerCase().replace(/\s+/g, '_')
        })
      });
      
      if (response.ok) {
        await fetchCategories();
        setEditingCategory(null);
      } else {
        const error = await response.json();
        alert(`Error updating category: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category. Please try again.');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers
      });
      
      if (response.ok) {
        await fetchCategories();
      } else {
        const error = await response.json();
        alert(`Error deleting category: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category. Please try again.');
    }
  };

  const exportData = () => {
    // Export all data as JSON
    const data = {
      categories,
      settings,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rickshaw-manager-backup-${todayYMD()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-violet-50 via-white to-purple-50 p-6 md:p-8 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/20">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-4xl font-bold text-zinc-900 tracking-tight">Settings</h2>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 p-2 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
            activeTab === 'categories'
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
            activeTab === 'general'
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
            activeTab === 'data'
              ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          Data Management
        </button>
        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 min-w-[100px] px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            Users
          </button>
        )}
      </div>
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-violet-500" />
              Add New Category
            </h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Category name"
                className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-sm"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
              <select
                className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-sm"
                value={newCategory.type}
                onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value as 'income' | 'expense' })}
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <button
                onClick={addCategory}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                Income Categories
              </h3>
              <div className="space-y-2">
                {categories.filter(cat => cat.type === 'income').map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100 transition-all hover:shadow-md">
                    {editingCategory?.id === category.id ? (
                      <input
                        type="text"
                        className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                      />
                    ) : (
                      <span className="text-sm font-medium text-zinc-700 capitalize">{category.name.replace('_', ' ')}</span>
                    )}
                    <div className="flex items-center gap-2">
                      {editingCategory?.id === category.id ? (
                        <>
                          <button
                            onClick={updateCategory}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingCategory(category)}
                            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCategory(category.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                </div>
                Expense Categories
              </h3>
              <div className="space-y-2">
                {categories.filter(cat => cat.type === 'expense').map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100 transition-all hover:shadow-md">
                    {editingCategory?.id === category.id ? (
                      <input
                        type="text"
                        className="flex-1 px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                      />
                    ) : (
                      <span className="text-sm font-medium text-zinc-700 capitalize">{category.name.replace('_', ' ')}</span>
                    )}
                    <div className="flex items-center gap-2">
                      {editingCategory?.id === category.id ? (
                        <>
                          <button
                            onClick={updateCategory}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingCategory(category)}
                            className="p-1.5 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteCategory(category.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-zinc-900">General Settings</h3>
            {hasChanges && (
              <div className="flex gap-2">
                <button
                  onClick={saveAllSettings}
                  className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Currency</label>
              <select
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={tempSettings.currency}
                onChange={(e) => updateTempSettings('currency', e.target.value)}
              >
                <option value="PKR">Pakistani Rupee (PKR)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
                <option value="INR">Indian Rupee (INR)</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Currency Symbol</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={tempSettings.currencySymbol}
                onChange={(e) => updateTempSettings('currencySymbol', e.target.value)}
                placeholder="Rs."
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Date Format</label>
              <select
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={tempSettings.dateFormat}
                onChange={(e) => updateTempSettings('dateFormat', e.target.value)}
              >
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="autoBackup"
                className="w-4 h-4 text-emerald-500 border-zinc-300 rounded focus:ring-emerald-500"
                checked={settings.autoBackup}
                onChange={(e) => saveSettings({ ...settings, autoBackup: e.target.checked })}
              />
              <label htmlFor="autoBackup" className="text-sm font-medium text-zinc-700">
                Enable automatic data backup
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && currentUser?.role === 'super_admin' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">User Management</h3>
                <p className="text-sm text-zinc-500">Create and manage admin users</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> Only Super Admins can create new users. Regular admins can access the system but cannot manage other users.
              </p>
            </div>

            <button
              onClick={() => setShowUserManagement(true)}
              className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Users className="w-5 h-5" />
              Open User Management
            </button>
          </div>
        </div>
      )}

      {/* Data Management Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6">Data Management</h3>
            
            {/* Export Backup */}
            <div className="mb-8">
              <h4 className="text-base font-medium text-zinc-900 mb-3">Backup Your Data</h4>
              <button
                onClick={exportData}
                className="px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Export All Data
              </button>
            </div>

            {/* Maintenance */}
            <div className="mb-8">
              <h4 className="text-base font-medium text-zinc-900 mb-3">Maintenance</h4>
              <button
                onClick={backfillRickshawIds}
                disabled={isBackfilling}
                className="p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
              >
                <div className="flex items-center gap-3 mb-2">
                  <RefreshCw className={`w-5 h-5 text-blue-600 ${isBackfilling ? 'animate-spin' : ''}`} />
                  <span className="text-sm font-semibold text-blue-700">Link Expenses to Rickshaws</span>
                </div>
                <p className="text-xs text-blue-600">
                  Tags old transactions (saved with only a driver) with the correct rickshaw, so rickshaw stats stay accurate when drivers switch. Safe to run — no amounts change.
                </p>
              </button>
            </div>

          </div>
        </div>
      )}

      {showUserManagement && (
        <UserManagement onClose={() => setShowUserManagement(false)} />
      )}
    </div>
  );
}
