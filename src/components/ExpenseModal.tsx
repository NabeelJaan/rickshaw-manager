import CategoryPicker from './CategoryPicker';
import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, X } from 'lucide-react';
import { todayYMD } from '../utils/date';

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

const DEFAULT_EXPENSE_CATEGORY = 'engine_oil';

function preferredExpenseCategory(categories: { name: string }[]): string {
  const found = categories.find(c => c.name.toLowerCase().replace(/[\s-]+/g, '_') === DEFAULT_EXPENSE_CATEGORY);
  return found?.name || DEFAULT_EXPENSE_CATEGORY;
}

export default function ExpenseModal({ isOpen, onClose, onSuccess, driverId, driverName }: ExpenseModalProps) {
  const [formData, setFormData] = useState({
    date: todayYMD(),
    category: DEFAULT_EXPENSE_CATEGORY,
    amount: '',
    notes: ''
  });
  const [categories, setCategories] = useState<Category[]>([]);
  // Expenses are rickshaw-centric (drivers can switch rickshaws), so every expense
  // must be tagged to a rickshaw. Pre-filled from the driver's active assignment.
  const [assignedRickshawId, setAssignedRickshawId] = useState<string>('');
  const [rickshaws, setRickshaws] = useState<{ id: number; number: string }[]>([]);
  // Guards against out-of-order responses when the modal reopens for a different driver
  const assignReqRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchRickshaws();
      fetchAssignedRickshaw();
      setFormData({
        date: todayYMD(),
        category: DEFAULT_EXPENSE_CATEGORY,
        amount: '',
        notes: ''
      });
    }
  }, [isOpen, driverId]);

  const fetchRickshaws = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/rickshaws', { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) setRickshaws(data);
      }
    } catch (error) {
      console.error('Failed to fetch rickshaws:', error);
    }
  };

  const fetchAssignedRickshaw = async () => {
    const reqId = ++assignReqRef.current;
    const forDriver = driverId;
    setAssignedRickshawId('');
    if (!forDriver) return;
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/assignments', { headers });
      // Ignore if a newer request (e.g. modal reopened for another driver) superseded this one
      if (reqId !== assignReqRef.current) return;
      if (response.ok) {
        const data = await response.json();
        if (reqId !== assignReqRef.current) return;
        if (Array.isArray(data)) {
          // Active assignment = no end_date, matching this driver
          const active = data.find((a: any) =>
            String(a.driver_id) === String(forDriver) && !a.end_date
          );
          if (active) setAssignedRickshawId(String(active.rickshaw_id));
        }
      }
    } catch (error) {
      console.error('Failed to fetch assigned rickshaw:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/categories?type=expense', { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setCategories(data);
          setFormData(prev => {
            const preferred = preferredExpenseCategory(data);
            const stillDefault = prev.category === 'fuel' || prev.category === DEFAULT_EXPENSE_CATEGORY;
            const known = data.some(c => c.name === prev.category);
            return { ...prev, category: stillDefault || !known ? preferred : prev.category };
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categories.some(c => c.name === formData.category)) { alert('Please select a category.'); return; }
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
        rickshaw_id: assignedRickshawId || null,
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
      date: todayYMD(),
      category: DEFAULT_EXPENSE_CATEGORY,
      amount: '',
      notes: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[100dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-zinc-900 leading-tight">Add Expense</h3>
            {driverName && <p className="text-xs text-zinc-500 truncate">Driver: <span className="font-medium text-zinc-800">{driverName}</span></p>}
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1">Date</label>
              <input 
                type="date" 
                required 
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={formData.date} 
                onChange={e => setFormData({...formData, date: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1">Amount</label>
              <input 
                type="number" 
                step="0.01" min="0"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
                placeholder={formData.category === 'rent_pending' ? "0" : "0.00"}
                required={formData.category !== 'rent_pending'}
              />
            </div>
          </div>

          <CategoryPicker categories={categories} value={formData.category} type="expense" previewCount={6}
            onChange={category => setFormData(prev => ({ ...prev, category }))}
            onCreated={category => setCategories(prev => [...prev.filter(c => c.id !== category.id), category])}
            onRemoved={category => {
              const remaining = categories.filter(c => c.id !== category.id);
              setCategories(remaining);
              setFormData(prev => ({ ...prev, category: prev.category === category.name ? preferredExpenseCategory(remaining) : prev.category }));
            }} />

          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1">Rickshaw</label>
            <select
              required
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={assignedRickshawId}
              onChange={e => setAssignedRickshawId(e.target.value)}
            >
              <option value="">Select rickshaw...</option>
              {rickshaws.map(r => (
                <option key={r.id} value={String(r.id)}>{r.number}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1">Notes</label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="Optional note"
            />
          </div>

          <div className="flex gap-3">
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
