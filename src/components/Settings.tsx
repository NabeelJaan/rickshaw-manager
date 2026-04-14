import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Edit, Save, Download, FileText, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import UserManagement from './UserManagement';
import { useAuth } from '../contexts/AuthContext';

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
  const [activeTab, setActiveTab] = useState<'categories' | 'general' | 'reports' | 'data' | 'users'>('general');
  const [showUserManagement, setShowUserManagement] = useState(false);
  const { user: currentUser } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', type: 'income' as 'income' | 'expense' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [tempSettings, setTempSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingChartData, setLoadingChartData] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchChartData();
    }
  }, [activeTab]);

  const fetchChartData = async () => {
    try {
      setLoadingChartData(true);
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const response = await fetch('/api/stats', { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.monthlyData && Array.isArray(data.monthlyData)) {
          setChartData(data.monthlyData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    } finally {
      setLoadingChartData(false);
    }
  };

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

  const resetSettings = () => {
    setTempSettings(settings);
    setHasChanges(false);
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
          name: newCategory.name.toLowerCase().replace(/\s+/g, '_'),
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
          name: editingCategory.name.toLowerCase().replace(/\s+/g, '_')
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

  const generateReport = async (type: 'income' | 'expense' | 'summary') => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const response = await fetch(`/api/reports/${type}`, { headers });
      if (!response.ok) {
        alert('Failed to generate report');
        return;
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        alert('Invalid data received');
        return;
      }
      
      if (data.length === 0) {
        alert('No data available for this report');
        return;
      }

      if (settings.reportFormat === 'excel') {
        // Generate CSV
        const headers_row = Object.keys(data[0]).join(',');
        const csv_content = [
          headers_row,
          ...data.map(row => Object.values(row).map(val => 
            typeof val === 'string' && (val.includes(',') || val.includes('"')) 
              ? `"${val.replace(/"/g, '""')}"` 
              : val
          ).join(','))
        ].join('\n');
        
        const blob = new Blob([csv_content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Generate PDF using HTML
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${type.charAt(0).toUpperCase() + type.slice(1)} Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f4f4f4; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .summary { margin-top: 20px; padding: 10px; background: #f0f0f0; }
            </style>
          </head>
          <body>
            <h1>${type.charAt(0).toUpperCase() + type.slice(1)} Report</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <table>
              <thead>
                <tr>
                  ${Object.keys(data[0]).map(key => `<th>${key}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.map(row => `
                  <tr>
                    ${Object.values(row).map(val => `<td>${val !== null ? val : ''}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="summary">
              <p>Total Records: ${data.length}</p>
            </div>
          </body>
          </html>
        `;
        
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.html`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('Report generated as HTML. Open the file and print to PDF (Ctrl+P).');
      }
      
    } catch (error) {
      console.error('Report generation error:', error);
      alert('Failed to generate report');
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
    a.download = `rickshaw-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetTransactionsOnly = async () => {
    if (!confirm('Are you sure you want to delete all transactions? This action cannot be undone!')) {
      return;
    }

    setIsResetting(true);
    
    try {
      console.log('Starting simple transaction reset...');
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // Method 1: Try to get all transactions and delete them individually
      console.log('Method 1: Getting all transactions...');
      const getResponse = await fetch('/api/transactions', { headers });
      
      if (getResponse.ok) {
        const transactions = await getResponse.json();
        if (!Array.isArray(transactions)) {
          alert('Failed to retrieve transactions');
          setIsResetting(false);
          return;
        }
        console.log('Found', transactions.length, 'transactions to delete');
        
        let deletedCount = 0;
        let errorCount = 0;
        
        for (const transaction of transactions) {
          try {
            const deleteResponse = await fetch(`/api/transactions/${transaction.id}`, {
              method: 'DELETE',
              headers
            });
            
            if (deleteResponse.ok) {
              deletedCount++;
              console.log('✅ Deleted transaction:', transaction.id);
            } else {
              errorCount++;
              console.log('❌ Failed to delete transaction:', transaction.id, deleteResponse.status);
            }
          } catch (error) {
            errorCount++;
            console.log('❌ Error deleting transaction:', transaction.id, error);
          }
        }
        
        console.log(`Delete complete: ${deletedCount} deleted, ${errorCount} errors`);
        alert(`Transaction reset complete!\n✅ Deleted: ${deletedCount} transactions\n❌ Errors: ${errorCount}\n\nPage will reload in 2 seconds.`);
        
      } else {
        console.log('Failed to get transactions:', getResponse.status);
        alert('Failed to retrieve transactions for deletion. Status: ' + getResponse.status);
      }
      
      // Reload the page to refresh data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Simple reset error:', error);
      alert(`Failed to reset transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  const resetData = async (type: 'all' | 'transactions' | 'drivers' | 'rickshaws') => {
    const confirmMessages = {
      all: 'Are you sure you want to delete ALL data? This will remove:\n• All transactions\n• All drivers\n• All rickshaws\n• All settings\n\nThis action cannot be undone!',
      transactions: 'Are you sure you want to delete all transactions? This action cannot be undone!',
      drivers: 'Are you sure you want to delete all drivers? This will also delete all their transactions. This action cannot be undone!',
      rickshaws: 'Are you sure you want to delete all rickshaws? This action cannot be undone!'
    };

    if (!confirm(confirmMessages[type])) {
      return;
    }

    setIsResetting(true);
    
    try {
      console.log('Resetting data type:', type);
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      switch (type) {
        case 'all':
          // Try to delete everything
          try {
            await fetch('/api/transactions', { method: 'DELETE', headers });
            console.log('Transactions deleted');
          } catch (e) {
            console.log('Transactions endpoint might not support DELETE');
          }
          
          try {
            await fetch('/api/drivers', { method: 'DELETE', headers });
            console.log('Drivers deleted');
          } catch (e) {
            console.log('Drivers endpoint might not support DELETE');
          }
          
          try {
            await fetch('/api/rickshaws', { method: 'DELETE', headers });
            console.log('Rickshaws deleted');
          } catch (e) {
            console.log('Rickshaws endpoint might not support DELETE');
          }
          
          // Clear localStorage
          localStorage.clear();
          break;
          
        case 'transactions':
          try {
            const response = await fetch('/api/transactions', { method: 'DELETE', headers });
            console.log('Delete transactions response:', response.status);
            if (!response.ok && response.status !== 404) {
              throw new Error(`Failed to delete transactions: ${response.status}`);
            }
          } catch (error) {
            console.log('Transactions delete failed, trying alternative method...');
            // Alternative: Get all transactions and delete individually
            const getResponse = await fetch('/api/transactions', { headers });
            if (getResponse.ok) {
              const transactions = await getResponse.json();
              if (Array.isArray(transactions)) {
                for (const tx of transactions) {
                  try {
                    await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE', headers });
                  } catch (e) {
                    console.log('Failed to delete transaction:', tx.id);
                  }
                }
              }
            }
          }
          break;
          
        case 'drivers':
          try {
            const response = await fetch('/api/drivers', { method: 'DELETE', headers });
            console.log('Delete drivers response:', response.status);
            if (!response.ok && response.status !== 404) {
              throw new Error(`Failed to delete drivers: ${response.status}`);
            }
          } catch (error) {
            console.log('Drivers delete failed, trying alternative method...');
            // Alternative: Get all drivers and delete individually
            const getResponse = await fetch('/api/drivers', { headers });
            if (getResponse.ok) {
              const drivers = await getResponse.json();
              if (Array.isArray(drivers)) {
                for (const driver of drivers) {
                  try {
                    await fetch(`/api/drivers/${driver.id}`, { method: 'DELETE', headers });
                  } catch (e) {
                    console.log('Failed to delete driver:', driver.id);
                  }
                }
              }
            }
          }
          break;
          
        case 'rickshaws':
          try {
            const response = await fetch('/api/rickshaws', { method: 'DELETE', headers });
            console.log('Delete rickshaws response:', response.status);
            if (!response.ok && response.status !== 404) {
              throw new Error(`Failed to delete rickshaws: ${response.status}`);
            }
          } catch (error) {
            console.log('Rickshaws delete failed, trying alternative method...');
            // Alternative: Get all rickshaws and delete individually
            const getResponse = await fetch('/api/rickshaws', { headers });
            if (getResponse.ok) {
              const rickshaws = await getResponse.json();
              if (Array.isArray(rickshaws)) {
                for (const rickshaw of rickshaws) {
                  try {
                    await fetch(`/api/rickshaws/${rickshaw.id}`, { method: 'DELETE', headers });
                  } catch (e) {
                    console.log('Failed to delete rickshaw:', rickshaw.id);
                  }
                }
              }
            }
          }
          break;
      }

      const successMessages = {
        all: 'All data has been successfully reset. The page will reload in 3 seconds.',
        transactions: 'All transactions have been successfully deleted.',
        drivers: 'All drivers and their transactions have been successfully deleted.',
        rickshaws: 'All rickshaws have been successfully deleted.'
      };

      alert(successMessages[type]);
      
      if (type === 'all') {
        // Reload the page to reset everything
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        // Refresh the data by triggering a re-render
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      
    } catch (error) {
      console.error('Reset error:', error);
      alert(`Failed to reset data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <SettingsIcon className="w-8 h-8 text-zinc-600" />
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Settings</h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reports'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Reports
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'data'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Data Management
        </button>
        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Users
          </button>
        )}
      </div>
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">Add New Category</h3>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Category name"
                className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
              <select
                className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={newCategory.type}
                onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value as 'income' | 'expense' })}
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <button
                onClick={addCategory}
                className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 text-emerald-600">Income Categories</h3>
              <div className="space-y-2">
                {categories.filter(cat => cat.type === 'income').map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    {editingCategory?.id === category.id ? (
                      <input
                        type="text"
                        className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm"
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
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 text-rose-600">Expense Categories</h3>
              <div className="space-y-2">
                {categories.filter(cat => cat.type === 'expense').map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
                    {editingCategory?.id === category.id ? (
                      <input
                        type="text"
                        className="flex-1 px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-sm"
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
                  onClick={resetSettings}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Reset
                </button>
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

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6">Report Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Default Report Format</label>
                <select
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                  value={settings.reportFormat}
                  onChange={(e) => saveSettings({ ...settings, reportFormat: e.target.value as 'pdf' | 'excel' })}
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6">Generate Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => generateReport('income')}
                className="p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors text-center"
              >
                <FileText className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-emerald-700">Income Report</div>
              </button>
              <button
                onClick={() => generateReport('expense')}
                className="p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors text-center"
              >
                <FileText className="w-8 h-8 text-rose-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-rose-700">Expense Report</div>
              </button>
              <button
                onClick={() => generateReport('summary')}
                className="p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors text-center"
              >
                <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-blue-700">Summary Report</div>
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6">Monthly Income vs Expense</h3>
            {loadingChartData ? (
              <div className="h-64 flex items-center justify-center text-zinc-500">Loading chart...</div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="income" fill="#10b981" name="Income" />
                  <Bar dataKey="expense" fill="#f43f5e" name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-zinc-500">No data available</div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6">Data Management</h3>
            <div className="flex gap-4">
              <button
                onClick={exportData}
                className="px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Export All Data
              </button>
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
            
            {/* Warning Message */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-800 mb-1">⚠️ Important Warning</h4>
                  <p className="text-sm text-amber-700">
                    Data reset operations are permanent and cannot be undone. Please consider exporting your data before performing any reset operations.
                  </p>
                </div>
              </div>
            </div>

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

            {/* Reset Options */}
            <div>
              <h4 className="text-base font-medium text-zinc-900 mb-3 text-rose-600">Reset Data</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reset Transactions - Simple Method */}
                <button
                  onClick={resetTransactionsOnly}
                  disabled={isResetting}
                  className="p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Trash2 className="w-5 h-5 text-rose-600" />
                    <span className="text-sm font-semibold text-rose-700">Reset Transactions (Simple)</span>
                  </div>
                  <p className="text-xs text-rose-600">Delete all transaction records - Try this first</p>
                </button>

                {/* Reset Transactions - Original Method */}
                <button
                  onClick={() => resetData('transactions')}
                  disabled={isResetting}
                  className="p-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Trash2 className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-semibold text-orange-700">Reset Transactions (Advanced)</span>
                  </div>
                  <p className="text-xs text-orange-600">Delete all transaction records - Alternative method</p>
                </button>

                {/* Reset Drivers */}
                <button
                  onClick={() => resetData('drivers')}
                  disabled={isResetting}
                  className="p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Trash2 className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">Reset Drivers</span>
                  </div>
                  <p className="text-xs text-blue-600">Delete all drivers and their transactions</p>
                </button>

                {/* Reset Rickshaws */}
                <button
                  onClick={() => resetData('rickshaws')}
                  disabled={isResetting}
                  className="p-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Trash2 className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-semibold text-purple-700">Reset Rickshaws</span>
                  </div>
                  <p className="text-xs text-purple-600">Delete all rickshaw records</p>
                </button>

                {/* Reset All Data */}
                <button
                  onClick={() => resetData('all')}
                  disabled={isResetting}
                  className="p-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed md:col-span-2"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <RefreshCw className="w-5 h-5 text-red-600" />
                    <span className="text-sm font-semibold text-red-700">Reset All Data</span>
                  </div>
                  <p className="text-xs text-red-600">Delete everything and start fresh</p>
                </button>
              </div>
            </div>

            {/* Processing Indicator */}
            {isResetting && (
              <div className="mt-6 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent animate-spin"></div>
                  <span className="text-sm text-zinc-600">Resetting data... Please wait.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showUserManagement && (
        <UserManagement onClose={() => setShowUserManagement(false)} />
      )}
    </div>
  );
}
