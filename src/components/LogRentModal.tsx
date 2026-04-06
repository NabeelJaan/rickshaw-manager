import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, User } from 'lucide-react';
import { Driver, Rickshaw } from '../types';

interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
}

interface LogRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onSuccess: () => void;
  selectedDriverId?: string;
}

export default function LogRentModal({ isOpen, onClose, onSubmit, onSuccess, selectedDriverId }: LogRentModalProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('Rs.');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    driver_id: selectedDriverId || '',
    rickshaw_id: '',
    category: 'rent',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchDrivers();
      fetchRickshaws();
      fetchCategories();
      setFormData(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0],
        amount: '',
        driver_id: selectedDriverId || '',
        rickshaw_id: '',
        category: 'rent',
        notes: ''
      }));
    }
  }, [isOpen, selectedDriverId]);

  const fetchDrivers = () => {
    fetch('/api/drivers').then(res => res.json()).then(setDrivers);
  };

  const fetchRickshaws = () => {
    fetch('/api/rickshaws').then(res => res.json()).then(setRickshaws);
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        // Filter for income categories but always include 'rent_pending' if it exists in expense
        const incomeCats = data.filter((cat: Category) => 
          cat.type === 'income' || cat.name === 'rent_pending'
        );
        setCategories(incomeCats);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  // Auto-select rickshaw if driver is selected and has an assigned rickshaw
  useEffect(() => {
    if (formData.driver_id) {
      const driver = drivers.find(d => d.id.toString() === formData.driver_id);
      if (driver && driver.assigned_rickshaw) {
        const rickshaw = rickshaws.find(r => r.number === driver.assigned_rickshaw);
        if (rickshaw) {
          setFormData(prev => ({ ...prev, rickshaw_id: rickshaw.id.toString() }));
        }
      }
    }
  }, [formData.driver_id, drivers, rickshaws]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const headers = { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    setLoading(true);
    
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          amount: formData.amount === '' ? 0 : parseFloat(formData.amount),
          type: 'income'
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(`Error logging rent: ${error.error}`);
        return;
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error logging rent:', error);
      alert('Failed to log rent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-zinc-100">
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            Log Rental Income
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Date</label>
            <input 
              type="date" required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} 
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Amount ({currency})</label>
            <input 
              type="number" step="0.01" min="0"
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
              value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
              placeholder={formData.category === 'rent_pending' ? "0 (will use notes amount)" : "e.g. 500"}
              required={formData.category !== 'rent_pending'}
            />
            {formData.category === 'rent_pending' && (
              <p className="mt-1 text-[11px] text-amber-600 font-medium">
                Tip: Leave amount 0 and enter "500 pending" in notes to add 500 to pending balance.
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Category</label>
            <select 
              required
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name.replace('_', ' ').charAt(0).toUpperCase() + cat.name.replace('_', ' ').slice(1)}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Driver</label>
            <select 
              required
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.driver_id} onChange={e => setFormData({...formData, driver_id: e.target.value})}
            >
              <option value="">Select Driver</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name} {d.assigned_rickshaw ? `(Rickshaw #${d.assigned_rickshaw})` : ''}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Rickshaw</label>
            <select 
              required
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.rickshaw_id} onChange={e => setFormData({...formData, rickshaw_id: e.target.value})}
            >
              <option value="">Select Rickshaw</option>
              {rickshaws.map(r => (
                <option key={r.id} value={r.id}>Rickshaw #{r.number}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Notes (Optional)</label>
            <input 
              type="text" 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional details..."
            />
          </div>
          
          <div className="pt-2 flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors shadow-sm disabled:opacity-70"
            >
              {loading ? 'Saving...' : 'Save Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
