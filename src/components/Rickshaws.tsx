import React, { useState, useEffect } from 'react';
import { Plus, Car, Calendar, DollarSign, UserPlus, Users, TrendingUp, TrendingDown, Edit, Trash2 } from 'lucide-react';
import { Rickshaw, Driver, Assignment } from '../types';

export default function Rickshaws({ selectedDriverId }: { selectedDriverId?: string }) {
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState<number | null>(null);
  const [editingRickshaw, setEditingRickshaw] = useState<Rickshaw | null>(null);
  const [currency, setCurrency] = useState('Rs.');
  
  const [formData, setFormData] = useState({ number: '', purchase_date: '', investment_cost: '' });
  const [assignData, setAssignData] = useState({ rickshaw_id: '', driver_id: '', start_date: new Date().toISOString().split('T')[0] });
  const [editFormData, setEditFormData] = useState({ number: '', purchase_date: '', investment_cost: '', id: '' });

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

  const fetchData = () => {
    fetch('/api/rickshaws').then(res => res.json()).then(setRickshaws);
    fetch('/api/drivers').then(res => res.json()).then(setDrivers);
    fetch('/api/assignments').then(res => res.json()).then(setAssignments);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/rickshaws', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error adding rickshaw: ${error.error}`);
      return;
    }
    
    setShowForm(false);
    setFormData({ number: '', purchase_date: '', investment_cost: '' });
    fetchData();
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignData),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error assigning driver: ${error.error}`);
      return;
    }
    
    setShowAssignForm(null);
    setAssignData({ rickshaw_id: '', driver_id: '', start_date: new Date().toISOString().split('T')[0] });
    fetchData();
  };

  const handleEdit = (rickshaw: Rickshaw) => {
    setEditingRickshaw(rickshaw);
    setEditFormData({
      number: rickshaw.number,
      purchase_date: rickshaw.purchase_date,
      investment_cost: rickshaw.investment_cost.toString(),
      id: rickshaw.id.toString()
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/rickshaws/${editFormData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: editFormData.number,
        purchase_date: editFormData.purchase_date,
        investment_cost: parseFloat(editFormData.investment_cost)
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error updating rickshaw: ${error.error}`);
      return;
    }
    
    setEditingRickshaw(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this rickshaw? This will also delete all its assignments and transactions.')) {
      const res = await fetch(`/api/rickshaws/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        alert(`Error deleting rickshaw: ${error.error}`);
        return;
      }
      fetchData();
    }
  };

  const getCurrentDriver = (rickshawId: number) => {
    const activeAssignment = assignments.find(a => a.rickshaw_id === rickshawId && !a.end_date);
    return activeAssignment ? activeAssignment.driver_name : 'Unassigned';
  };

  const filteredRickshaws = selectedDriverId 
    ? rickshaws.filter(r => {
        const activeAssignment = assignments.find(a => a.rickshaw_id === r.id && !a.end_date);
        return activeAssignment && activeAssignment.driver_id.toString() === selectedDriverId;
      })
    : rickshaws;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 tracking-tight">Rickshaws</h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Rickshaw
        </button>
      </div>

      {selectedDriverId && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm border border-amber-200/60">
          <strong>Note:</strong> You are currently viewing only rickshaws assigned to the selected driver. 
          To see all rickshaws (including newly added ones), please select "All Drivers" in the sidebar.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Rickshaw Number</label>
            <input 
              type="text" required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Purchase Date</label>
            <input 
              type="date" required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Investment Cost</label>
            <input 
              type="number" required step="0.01"
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
              value={formData.investment_cost} onChange={e => setFormData({...formData, investment_cost: e.target.value})}
            />
          </div>
          <div className="md:col-span-3 flex justify-end gap-3 mt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm">Save Rickshaw</button>
          </div>
        </form>
      )}

      {editingRickshaw && (
        <form onSubmit={handleUpdate} className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200/60 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Rickshaw Number</label>
            <input 
              type="text" required 
              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              value={editFormData.number} 
              onChange={e => setEditFormData({...editFormData, number: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Purchase Date</label>
            <input 
              type="date" required 
              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              value={editFormData.purchase_date} 
              onChange={e => setEditFormData({...editFormData, purchase_date: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Investment Cost</label>
            <input 
              type="number" required step="0.01"
              className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-number"
              value={editFormData.investment_cost} 
              onChange={e => setEditFormData({...editFormData, investment_cost: e.target.value})}
            />
          </div>
          <div className="md:col-span-3 flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={() => setEditingRickshaw(null)} 
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors shadow-sm"
            >
              Update Rickshaw
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {filteredRickshaws.map(r => (
          <div key={r.id} className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60 hover:shadow-md transition-all relative group">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-zinc-100 text-zinc-600 rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{r.number}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                    {r.status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3.5 text-[13px] text-zinc-600 mb-5">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span>Purchased: <span className="font-number">{r.purchase_date}</span></span>
              </div>
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-4 h-4 text-zinc-400" />
                <span>Investment: <span className="font-number font-medium text-zinc-900">{currency} {r.investment_cost.toLocaleString()}</span></span>
              </div>
              
              <div className="pt-3 pb-1">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="font-medium text-zinc-500 uppercase tracking-wider">Recovery Progress</span>
                  <span className="text-emerald-600 font-semibold font-number">
                    {Math.min(100, Math.max(0, ((r.recovered_cost || 0) / r.investment_cost) * 100)).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${Math.min(100, Math.max(0, ((r.recovered_cost || 0) / r.investment_cost) * 100))}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] mt-2 text-zinc-500 font-number">
                  <span className="text-emerald-600 font-medium">{currency} {(r.recovered_cost || 0).toLocaleString()}</span>
                  <span>{currency} {Math.max(0, r.investment_cost - (r.recovered_cost || 0)).toLocaleString()} left</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-3.5 border-t border-zinc-100">
                <Users className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-700">Driver: <span className="font-medium text-zinc-900">{getCurrentDriver(r.id)}</span></span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-100">
              <button 
                onClick={() => handleEdit(r)}
                className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-600 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
              <button 
                onClick={() => handleDelete(r.id)}
                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <button 
                onClick={() => {
                  setShowAssignForm(r.id);
                  setAssignData({ ...assignData, rickshaw_id: r.id.toString() });
                }}
                className="flex-1 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 px-3 py-2 rounded-xl text-[12px] font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Assign
              </button>
            </div>

            {showAssignForm === r.id && (
              <form onSubmit={handleAssign} className="absolute inset-0 bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-zinc-200/60 z-10 flex flex-col justify-center">
                <h4 className="font-semibold text-zinc-900 mb-5 text-center">Assign Driver to {r.number}</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Select Driver</label>
                    <select required className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={assignData.driver_id} onChange={e => setAssignData({...assignData, driver_id: e.target.value})}>
                      <option value="">Choose...</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Start Date</label>
                    <input type="date" required className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      value={assignData.start_date} onChange={e => setAssignData({...assignData, start_date: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => setShowAssignForm(null)} className="flex-1 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-2 text-sm font-medium bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors shadow-sm">Assign</button>
                </div>
              </form>
            )}
          </div>
        ))}
        {filteredRickshaws.length === 0 && !showForm && (
          <div className="col-span-full text-center py-16 px-4 rounded-2xl border-2 border-dashed border-zinc-200">
            <Car className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-zinc-900 mb-1">No rickshaws found</h3>
            <p className="text-sm text-zinc-500">Add your first rickshaw to start tracking.</p>
          </div>
        )}
      </div>
    </div>
  );
}
