import { useEffect, useMemo, useState } from 'react';
import { Coins, Plus, Trash2 } from 'lucide-react';
import { todayYMD, formatDate, recentMonths, currentMonth } from '../utils/date';
import { COMMITTEE_DEFAULT_AMOUNT, committeeMonthDays } from '../utils/committee';

interface CommitteeEntry {
  id: number;
  date: string;
  amount: number;
  notes: string;
}

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function CommitteeTab() {
  const [entries, setEntries] = useState<CommitteeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('Rs.');
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState({ date: todayYMD(), amount: String(COMMITTEE_DEFAULT_AMOUNT), notes: '' });

  const load = () => {
    setLoading(true);
    fetch('/api/committee', { headers: authHeaders() })
      .then(r => { if (!r.ok) throw new Error('Could not load commetti.'); return r.json(); })
      .then(data => setEntries(Array.isArray(data) ? data.map((e: CommitteeEntry) => ({ ...e, amount: Number(e.amount), notes: e.notes || '' })) : []))
      .catch(e => { setEntries([]); setError(e.message); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const saved = localStorage.getItem('currency');
    if (saved) setCurrency(saved);
    load();
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, CommitteeEntry[]>();
    entries.forEach(entry => {
      const day = String(entry.date).slice(0, 10);
      const list = map.get(day) || [];
      list.push(entry);
      map.set(day, list);
    });
    return map;
  }, [entries]);

  const days = useMemo(() => committeeMonthDays(month, todayYMD()), [month]);
  const monthEntries = entries.filter(entry => String(entry.date).slice(0, 7) === month);
  const addedDays = days.filter(day => (byDate.get(day) || []).length > 0).length;
  const monthTotal = monthEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/committee', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ date: form.date, amount: form.amount, notes: form.notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save commetti');
      setForm({ date: todayYMD(), amount: String(COMMITTEE_DEFAULT_AMOUNT), notes: '' });
      setMonth(form.date.slice(0, 7));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save commetti');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Remove this commetti entry?')) return;
    const res = await fetch(`/api/committee/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not remove entry');
      return;
    }
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      <div className="bg-gradient-to-r from-violet-50 via-white to-violet-50 p-4 md:p-6 rounded-2xl border border-violet-200/70">
        <h2 className="text-xl md:text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <Coins className="w-6 h-6 text-violet-600" /> Commetti
        </h2>
        <p className="text-sm text-zinc-500 mt-1">Daily committee only. These entries stay out of rickshaw income, expenses, and drivers.</p>
      </div>

      <form onSubmit={save} className="bg-white p-4 md:p-5 rounded-2xl border border-zinc-200/60 shadow-sm grid grid-cols-1 sm:grid-cols-[1fr_8rem_1fr_auto] gap-3 items-end">
        <label className="text-sm">
          <span className="block text-[13px] font-medium text-zinc-700 mb-1">Date</span>
          <input type="date" required value={form.date} max={todayYMD()} onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm" />
        </label>
        <label className="text-sm">
          <span className="block text-[13px] font-medium text-zinc-700 mb-1">Amount</span>
          <input type="number" required min="1" step="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-number" />
        </label>
        <label className="text-sm">
          <span className="block text-[13px] font-medium text-zinc-700 mb-1">Note</span>
          <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional"
            className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm" />
        </label>
        <button type="submit" disabled={saving}
          className="h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60">
          <Plus className="w-4 h-4" /> {saving ? 'Saving...' : 'Add'}
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-semibold text-zinc-900">Daily routine</h3>
            <p className="text-xs text-zinc-500">{addedDays} of {days.length} days added · {currency} {monthTotal.toLocaleString()}</p>
          </div>
          <select value={month} onChange={e => setMonth(e.target.value)} className="h-9 px-3 bg-zinc-100 rounded-xl text-sm">
            {recentMonths(12).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-zinc-500 text-center">Loading...</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {days.map(day => {
              const list = byDate.get(day) || [];
              const total = list.reduce((sum, entry) => sum + entry.amount, 0);
              const isToday = day === todayYMD();
              return (
                <li key={day} className={`px-4 py-2.5 ${isToday ? 'bg-violet-50/60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        {formatDate(day, { weekday: 'short', month: 'short', day: 'numeric' })}
                        {isToday && <span className="ml-2 text-[11px] font-medium text-violet-700">Today</span>}
                      </p>
                      {list.length === 0 ? (
                        <p className="text-xs text-zinc-400">Not added</p>
                      ) : (
                        list.map(entry => (
                          <p key={entry.id} className="text-xs text-zinc-500 truncate">{entry.notes || 'Added'}</p>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {list.length === 0 ? (
                        <span className="text-sm text-zinc-300">—</span>
                      ) : (
                        <span className="text-sm font-semibold text-violet-700 font-number">{currency} {total.toLocaleString()}</span>
                      )}
                      {list.map(entry => (
                        <button key={entry.id} type="button" onClick={() => remove(entry.id)} aria-label={`Remove commetti on ${day}`}
                          className="text-zinc-400 hover:text-rose-500 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
