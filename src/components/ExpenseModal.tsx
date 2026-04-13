import React, { useState, useEffect } from 'react';
import { DollarSign, X } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driverId: string;
  driverName: string;
}

interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
}

export default function ExpenseModal({ isOpen, onClose, onSuccess, driverId, driverName }: ExpenseModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'fuel',
    amount: '',
    notes: ''
  });
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: 'fuel',
        amount: '',
        notes: ''
      });
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/categories?type=expense', { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const headers = { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        date: formData.date,
        type: 'expense',
        category: formData.category,
        amount: formData.amount === '' ? 0 : parseFloat(formData.amount),
        driver_id: driverId,
        notes: formData.notes
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error adding expense: ${error.error}`);
      return;
    }
    
    onSuccess();
    onClose();
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: 'fuel',
      amount: '',
      notes: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-zinc-900">Add Expense</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-zinc-50 rounded-xl">
          <p className="text-sm text-zinc-600">Driver: <span className="font-medium text-zinc-900">{driverName}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Date</label>
            <input 
              type="date" 
              required 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.date} 
              onChange={e => setFormData({...formData, date: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Category</label>
            <select 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.category} 
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>
                  {cat.name.replace('_', ' ').charAt(0).toUpperCase() + cat.name.replace('_', ' ').slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Amount</label>
            <input 
              type="number" 
              step="0.01" 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
              value={formData.amount} 
              onChange={e => setFormData({...formData, amount: e.target.value})} 
              placeholder={formData.category === 'rent_pending' ? "0 (will use notes amount)" : "0.00"}
              required={formData.category !== 'rent_pending'}
            />
            {formData.category === 'rent_pending' && (
              <p className="mt-1 text-[11px] text-amber-600 font-medium">
                Tip: Leave amount 0 and enter "500 pending" in notes to add 500 to pending balance.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Notes/Comments</label>
            <textarea 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm resize-none"
              rows={3}
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              placeholder="Add any additional details..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
