import React, { useEffect, useState } from 'react';
import { X, Umbrella } from 'lucide-react';
import { Driver, Rickshaw } from '../types';
import { todayYMD } from '../utils/date';
import { isLeaveTransaction } from '../utils/leave';

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDriverId?: string;
}

export default function LeaveModal({ isOpen, onClose, onSuccess, selectedDriverId }: LeaveModalProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ date: todayYMD(), driver_id: '', notes: '' });

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('auth_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/drivers', { headers }).then(r => r.json()).then(data => { if (Array.isArray(data)) setDrivers(data); });
    fetch('/api/rickshaws', { headers }).then(r => r.json()).then(data => { if (Array.isArray(data)) setRickshaws(data); });
    setFormData({ date: todayYMD(), driver_id: selectedDriverId || '', notes: '' });
  }, [isOpen, selectedDriverId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driver_id) return;
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    setLoading(true);
    try {
      const existingRes = await fetch(
        `/api/transactions?driver_id=${formData.driver_id}&start_date=${formData.date}&end_date=${formData.date}&leave=1`,
        { headers }
      );
      const existing = await existingRes.json();
      if (Array.isArray(existing) && existing.some(isLeaveTransaction)) {
        alert('This driver is already on leave for that date.');
        return;
      }

      const driver = drivers.find(d => String(d.id) === formData.driver_id);
      const rickshaw = driver?.assigned_rickshaw
        ? rickshaws.find(r => r.number === driver.assigned_rickshaw)
        : undefined;
      const extra = formData.notes.trim();
      const notes = !extra ? 'Leave' : /leave/i.test(extra) ? extra : `Leave - ${extra}`;

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          date: formData.date,
          type: 'leave',
          category: 'leave',
          amount: 0,
          driver_id: formData.driver_id,
          rickshaw_id: rickshaw ? rickshaw.id : null,
          notes,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Could not save leave' }));
        alert(`Error saving leave: ${error.error || 'Could not save leave'}`);
        return;
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving leave:', error);
      alert('Failed to save leave. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-zinc-100">
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <Umbrella className="w-5 h-5 text-rose-500" />
            Set Driver on Leave
          </h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Date</label>
            <input
              type="date"
              required
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Driver</label>
            <select
              required
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
              value={formData.driver_id}
              onChange={e => setFormData({ ...formData, driver_id: e.target.value })}
            >
              <option value="">Select Driver</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.assigned_rickshaw ? ` (Rickshaw #${d.assigned_rickshaw})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Notes (Optional)</label>
            <input
              type="text"
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Reason, if any"
            />
          </div>
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-colors shadow-sm disabled:opacity-70">
              {loading ? 'Saving...' : 'Save Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
