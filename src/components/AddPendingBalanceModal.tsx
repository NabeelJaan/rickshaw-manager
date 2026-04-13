import React, { useState, useEffect } from 'react';
import { X, DollarSign, User } from 'lucide-react';
import { Driver } from '../types';

interface AddPendingBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPendingBalanceModal({ isOpen, onClose, onSuccess }: AddPendingBalanceModalProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('Rs.');
  const [formData, setFormData] = useState({
    driver_id: '',
    amount: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchDrivers();
      setFormData({
        driver_id: '',
        amount: '',
        notes: ''
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
  }, []);

  const fetchDrivers = () => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/drivers', { headers }).then(res => res.json()).then(data => { if (Array.isArray(data)) setDrivers(data); });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const headers = { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    setLoading(true);
    
    try {
      const res = await fetch(`/api/drivers/${formData.driver_id}/pending-balance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: formData.amount === '' ? 0 : parseFloat(formData.amount),
          notes: formData.notes
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(`Error adding pending balance: ${error.error}`);
        return;
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding pending balance:', error);
      alert('Failed to add pending balance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900">Add Pending Balance</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Driver</label>
            <select
              required
              value={formData.driver_id}
              onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            >
              <option value="">Select a driver</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>{driver.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">{currency}</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-12 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
              rows={2}
              placeholder="Add any notes..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Adding...' : (
              <>
                <DollarSign className="w-4 h-4" />
                Add Pending Balance
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
