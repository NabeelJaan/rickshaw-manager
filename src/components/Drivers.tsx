import React, { useState, useEffect } from 'react';
import { Plus, Users, Phone, Calendar, Car, Edit, Trash2, DollarSign } from 'lucide-react';
import { Driver, Rickshaw } from '../types';

export default function Drivers({ onDriverAdded, defaultShowForm }: { onDriverAdded?: () => void, defaultShowForm?: boolean }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [showForm, setShowForm] = useState(defaultShowForm || false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  
  const [formData, setFormData] = useState({ name: '', phone: '', join_date: new Date().toISOString().split('T')[0], rickshaw_id: '', daily_rent: '', pending_balance: '' });
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', join_date: '', id: '', daily_rent: '', pending_balance: '' });

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

  useEffect(() => {
    setShowForm(defaultShowForm || false);
  }, [defaultShowForm]);

  const fetchData = () => {
    fetch('/api/drivers')
      .then(res => res.json())
      .then(data => setDrivers(data));
    
    fetch('/api/rickshaws')
      .then(res => res.json())
      .then(data => setRickshaws(data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name,
        phone: formData.phone,
        join_date: formData.join_date
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error adding driver: ${error.error}`);
      return;
    }

    const newDriver = await res.json();

    // If a rickshaw was selected, create an assignment
    if (formData.rickshaw_id) {
      await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rickshaw_id: formData.rickshaw_id,
          driver_id: newDriver.id,
          start_date: formData.join_date
        }),
      });
    }
    
    setShowForm(false);
    setFormData({ name: '', phone: '', join_date: new Date().toISOString().split('T')[0], rickshaw_id: '' });
    fetchData();
    if (onDriverAdded) onDriverAdded();
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setEditFormData({
      name: driver.name,
      phone: driver.phone,
      join_date: driver.join_date,
      id: driver.id.toString()
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/drivers/${editFormData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editFormData.name,
        phone: editFormData.phone,
        join_date: editFormData.join_date
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error updating driver: ${error.error}`);
      return;
    }
    
    setEditingDriver(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this driver? This will also delete all their assignments and transactions.')) {
      const res = await fetch(`/api/drivers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        alert(`Error deleting driver: ${error.error}`);
        return;
      }
      fetchData();
    }
  };

  const availableRickshaws = rickshaws.filter(r => {
    // A rickshaw is available if it's not currently assigned to anyone
    // We can check this by looking at the drivers list and seeing if any driver has this rickshaw number
    return !drivers.some(d => d.assigned_rickshaw === r.number);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">Drivers Management</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Driver Name</label>
            <input 
              type="text" required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Phone Number</label>
            <input 
              type="tel" required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
              placeholder="e.g. 0300-1234567"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Join Date</label>
            <input 
              type="date" required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.join_date} onChange={e => setFormData({...formData, join_date: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Assign Rickshaw (Optional)</label>
            <select 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.rickshaw_id} onChange={e => setFormData({...formData, rickshaw_id: e.target.value})}
            >
              <option value="">No Assignment</option>
              {availableRickshaws.map(r => (
                <option key={r.id} value={r.id}>Rickshaw #{r.number}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-4 flex justify-end gap-3 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">Save Driver</button>
          </div>
        </form>
      )}

      {editingDriver && (
        <form onSubmit={handleUpdate} className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Driver Name</label>
            <input 
              type="text" required 
              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              value={editFormData.name} 
              onChange={e => setEditFormData({...editFormData, name: e.target.value})}
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Phone Number</label>
            <input 
              type="tel" required 
              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-number"
              value={editFormData.phone} 
              onChange={e => setEditFormData({...editFormData, phone: e.target.value})}
              placeholder="e.g. 0300-1234567"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Join Date</label>
            <input 
              type="date" required 
              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              value={editFormData.join_date} 
              onChange={e => setEditFormData({...editFormData, join_date: e.target.value})}
            />
          </div>
          <div className="lg:col-span-4 flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={() => setEditingDriver(null)} 
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-sm"
            >
              Update Driver
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {drivers.map(d => (
          <div key={d.id} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60 hover:shadow-md transition-all group">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{d.name}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                  d.assigned_rickshaw 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' 
                    : 'bg-zinc-50 text-zinc-600 border-zinc-200/50'
                }`}>
                  {d.assigned_rickshaw ? 'Assigned' : 'Available'}
                </span>
              </div>
            </div>
            
            <div className="space-y-3.5 text-[13px] text-zinc-600">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-zinc-400" />
                <span className="font-number">{d.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span>Joined: <span className="font-number">{d.join_date}</span></span>
              </div>
              <div className="flex items-center gap-3">
                <Car className="w-4 h-4 text-zinc-400" />
                <span>Rickshaw: <span className="font-medium text-zinc-900">{d.assigned_rickshaw || 'None'}</span></span>
              </div>
              {d.pending_balance !== undefined && d.pending_balance > 0 && (
                <div className="flex items-center gap-3 text-amber-600 font-medium">
                  <span className="w-4 h-4 flex items-center justify-center text-lg leading-none">!</span>
                  <span>Pending: {currency} <span className="font-number">{d.pending_balance.toLocaleString()}</span></span>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100">
              <button 
                onClick={() => handleEdit(d)}
                className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
              <button 
                onClick={() => handleDelete(d.id)}
                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        ))}
        {drivers.length === 0 && !showForm && (
          <div className="col-span-full text-center py-16 px-4 rounded-2xl border-2 border-dashed border-zinc-200">
            <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-zinc-900 mb-1">No drivers found</h3>
            <p className="text-sm text-zinc-500">Add your first driver to start assigning rickshaws.</p>
          </div>
        )}
      </div>
    </div>
  );
}
