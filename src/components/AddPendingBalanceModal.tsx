import React, { useState, useEffect } from 'react';
import { X, DollarSign, User, Eye, EyeOff } from 'lucide-react';
import { Driver, Transaction } from '../types';

interface AddPendingBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDriverId?: string;
}

export default function AddPendingBalanceModal({ isOpen, onClose, onSuccess, selectedDriverId }: AddPendingBalanceModalProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('Rs.');
  const [showData, setShowData] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [formData, setFormData] = useState({
    driver_id: selectedDriverId || '',
    amount: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchDrivers();
      setFormData({
        driver_id: selectedDriverId || '',
        amount: '',
        notes: ''
      });
      if (selectedDriverId) {
        fetchPendingData(selectedDriverId);
      }
    }
  }, [isOpen, selectedDriverId]);

  const fetchPendingData = async (driverId: string) => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    try {
      const res = await fetch(`/api/transactions?driver_id=${driverId}&category=rent_pending&limit=20`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPendingTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching pending data:', error);
    }
  };

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
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          amount: formData.amount === '' ? 0 : parseFloat(formData.amount),
          type: 'income',
          category: 'rent_pending',
          driver_id: formData.driver_id,
          notes: formData.notes
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(`Error adding pending amount: ${error.error}`);
        return;
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding pending amount:', error);
      alert('Failed to add pending amount. Please try again.');
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
              onChange={(e) => {
                const driverId = e.target.value;
                setFormData({ ...formData, driver_id: driverId });
                if (driverId) {
                  fetchPendingData(driverId);
                } else {
                  setPendingTransactions([]);
                }
              }}
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowData(!showData)}
              className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {showData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showData ? 'Hide Data' : 'Show Data'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Adding...' : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Add Pending
                </>
              )}
            </button>
          </div>
        </form>

        {/* Show Data Section */}
        {showData && (
          <div className="mt-6 border-t border-zinc-200 pt-4">
            <h3 className="text-sm font-semibold text-zinc-700 mb-3">Pending Transactions</h3>
            {pendingTransactions.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No pending transactions found</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {pendingTransactions.map((t) => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-zinc-700">{new Date(t.date).toLocaleDateString()}</p>
                      {t.notes && <p className="text-xs text-zinc-500">{t.notes}</p>}
                    </div>
                    <span className="text-sm font-bold text-amber-600">{currency}{t.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
