import React, { useState, useEffect } from 'react';
import { Edit, X } from 'lucide-react';
import { Transaction, Rickshaw, Driver } from '../types';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction: Transaction | null;
}

export default function EditTransactionModal({ isOpen, onClose, onSuccess, transaction }: EditTransactionModalProps) {
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [formData, setFormData] = useState({
    date: '',
    type: 'income',
    category: 'rent',
    amount: '',
    rickshaw_id: '',
    driver_id: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      fetch('/api/rickshaws', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setRickshaws(data); });
      fetch('/api/drivers', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setDrivers(data); });
    }
  }, [isOpen]);

  useEffect(() => {
    if (transaction) {
      setFormData({
        date: transaction.date,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount.toString(),
        rickshaw_id: transaction.rickshaw_id?.toString() || '',
        driver_id: transaction.driver_id?.toString() || '',
        notes: transaction.notes || ''
      });
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;
    
    const token = localStorage.getItem('auth_token');
    const headers = { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const res = await fetch(`/api/transactions/${transaction.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        date: formData.date,
        type: formData.type,
        category: formData.category,
        amount: formData.amount === '' ? 0 : parseFloat(formData.amount),
        rickshaw_id: formData.rickshaw_id || null,
        driver_id: formData.driver_id || null,
        notes: formData.notes || null
      }),
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(`Error updating transaction: ${error.error}`);
      return;
    }
    
    onSuccess();
    onClose();
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-zinc-900">Edit Transaction</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Type</label>
              <select 
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={formData.type} 
                onChange={e => {
                  const newType = e.target.value;
                  setFormData({
                    ...formData, 
                    type: newType,
                    category: newType === 'income' ? 'rent' : newType === 'pending' ? 'rent_pending' : 'fuel'
                  });
                }}
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="pending">Rent Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Category</label>
              <input 
                type="text" 
                list="category-options"
                required 
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})} 
                placeholder="Select or type custom..."
                disabled={formData.type === 'pending'}
              />
              <datalist id="category-options">
                {formData.type === 'income' ? (
                  <>
                    <option value="rent" />
                    <option value="rent_recovery" />
                    <option value="tips" />
                    <option value="other" />
                  </>
                ) : formData.type === 'expense' ? (
                  <>
                    <option value="fuel" />
                    <option value="maintenance" />
                    <option value="salary" />
                    <option value="rent_pending" />
                    <option value="other" />
                  </>
                ) : null}
              </datalist>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Amount</label>
              <input 
                type="number" 
                step="0.01" 
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-number"
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
                placeholder={formData.category === 'rent_pending' || formData.type === 'pending' ? "0 (will use notes amount)" : "0.00"}
                required={formData.category !== 'rent_pending' && formData.type !== 'pending'}
              />
              {(formData.category === 'rent_pending' || formData.type === 'pending') && (
                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                  Tip: Leave amount 0 and enter "500 pending" in notes to add 500 to pending balance.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Rickshaw</label>
              <select 
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={formData.rickshaw_id} 
                onChange={e => setFormData({...formData, rickshaw_id: e.target.value})}
              >
                <option value="">None</option>
                {rickshaws.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Driver</label>
              <select 
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                value={formData.driver_id} 
                onChange={e => setFormData({...formData, driver_id: e.target.value})}
              >
                <option value="">None</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Notes</label>
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
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Update Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
