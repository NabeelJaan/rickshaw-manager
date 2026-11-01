import { useEffect, useState, type FormEvent } from 'react';
import { Driver, Rickshaw, Assignment } from '../types';
import { currentMonth, todayYMD } from '../utils/date';
import { PendingRecord, isPending, isRecovery, pendingSummary } from '../utils/pendingLedger';

const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` });
export default function PendingLedger() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<PendingRecord[]>([]);
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ rickshaw_id: '', driver_id: '', date: todayYMD(), amount: '', category: 'pending', month: currentMonth(), notes: '' });
  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await Promise.all(['pending-register', 'rickshaws', 'drivers', 'assignments'].map(async path => {
        const r = await fetch(`/api/${path}`, { headers: headers() });
        if (!r.ok) throw new Error('Could not load pending records');
        const result = await r.json();
        if (!Array.isArray(result)) throw new Error('Invalid pending records');
        return result;
      }));
      setTransactions(data[0]); setRickshaws(data[1]); setDrivers(data[2]); setAssignments(data[3]);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const save = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const r = await fetch('/api/pending-register', { method: 'POST', headers: headers(), body: JSON.stringify({ ...form, amount: Number(form.amount), driver_id: form.driver_id || null }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not save');
      setForm(f => ({ ...f, amount: '', notes: '' })); setMonth(form.month);
      await load(); setMessage('Record saved in the separate pending register.');
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    if (!confirm('Remove this record from the separate pending register?')) return;
    setSaving(true); setError('');
    try {
      const r = await fetch(`/api/pending-register/${id}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error('Could not remove record');
      await load();
    } catch (e) { setError(String(e)); } finally { setSaving(false); }
  };
  const money = (n: number) => `${localStorage.getItem('currency') || 'Rs.'} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const records = transactions.filter(t => isPending(t) || isRecovery(t));
  const known = [...rickshaws];
  for (const t of records) if (!known.some(r => String(r.id) === String(t.rickshaw_id))) known.push({ id: t.rickshaw_id, number: t.rickshaw_number, purchase_date: '', investment_cost: 0, status: 'removed' });
  const vehicles = known.filter(r => !filter || String(r.id) === filter);
  const details = records.filter(t => t.month === month && (!filter || String(t.rickshaw_id) === filter));
  const driverTotals = new Map<string, { driver: string; rickshaw: string; pending: number; paid: number }>();
  for (const t of details) {
    const key = `${t.rickshaw_id}:${t.driver_id ?? t.driver_name}`;
    const row = driverTotals.get(key) || { driver: t.driver_name || 'Unknown', rickshaw: t.rickshaw_number, pending: 0, paid: 0 };
    if (isPending(t)) row.pending += Math.round(Number(t.amount) * 100);
    else row.paid += Math.round(Number(t.amount) * 100);
    driverTotals.set(key, row);
  }
  const input = 'w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm';
  return <div className="space-y-5 pb-10">
    <div><h2 className="text-xl font-bold">Monthly Pending</h2><p className="text-sm text-zinc-500 mt-1">Separate register only. These records do not change income, expenses, profit, or transaction balances. Pending stays with the rickshaw when drivers change.</p></div>
    {error && <p role="alert" className="text-rose-600">{error}</p>}
    {message && <p role="status" className="text-emerald-700">{message}</p>}
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">Month<input aria-label="Record month" type="month" required value={month} onChange={e => e.target.value && setMonth(e.target.value)} className={input} /></label>
      <label className="text-sm">Rickshaw<select value={filter} onChange={e => setFilter(e.target.value)} className={input}><option value="">All rickshaws</option>{rickshaws.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}</select></label>
    </div>
    {loading ? <p>Loading records…</p> : <div className="overflow-x-auto bg-white rounded-xl border border-zinc-200"><table className="w-full text-sm text-left"><thead className="bg-zinc-50"><tr>{['Rickshaw', 'Opening pending', 'Added this month', 'Payments this month', 'Closing pending'].map(s => <th className="p-3 whitespace-nowrap" key={s}>{s}</th>)}</tr></thead><tbody>{vehicles.map(r => {
      const s = pendingSummary(records, month, String(r.id));
      return <tr key={r.id} className="border-t border-zinc-100"><td className="p-3 font-semibold">{r.number}</td>{[s.opening, s.added, s.recovered, s.closing].map((n, i) => <td className="p-3 whitespace-nowrap" key={i}>{money(n)}</td>)}</tr>;
    })}</tbody></table></div>}
    <form onSubmit={save} className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Add pending / record payment</h3>
      <p className="text-xs text-zinc-500">For a driver leaving or switching, choose the rickshaw they leave and the record month. Payments reduce that rickshaw’s balance in the chosen month. Enter only the additional amount owed, to avoid counting an existing balance twice.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">Rickshaw<select required className={input} value={form.rickshaw_id} onChange={e => setForm({ ...form, rickshaw_id: e.target.value })}><option value="">Select rickshaw</option>{rickshaws.map(r => <option key={r.id} value={r.id}>{r.number}</option>)}</select></label>
        <label className="text-sm">Driver at the time<select className={input} value={form.driver_id} onChange={e => setForm({ ...form, driver_id: e.target.value })}><option value="">No driver / unknown</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}{d.status === 'inactive' ? ' (left)' : ''}</option>)}</select></label>
        <label className="text-sm">Record month<input required type="month" className={input} value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} /></label>
        <label className="text-sm">Date<input required type="date" className={input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
        <label className="text-sm">Record type<select className={input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="pending">Pending added</option><option value="payment">Payment received</option></select></label>
        <label className="text-sm">Amount<input required type="number" min="0.01" step="0.01" className={input} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
        <label className="text-sm">Notes<input className={input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Switch, leaving, or monthly pending" /></label>
      </div><button disabled={saving || loading} className="bg-emerald-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save record'}</button>
    </form>
    <div className="bg-white border rounded-xl p-4"><h3 className="font-semibold mb-3">Monthly totals by driver and rickshaw</h3><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Driver', 'Rickshaw', 'Pending added', 'Payments', 'Net added'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{[...driverTotals.entries()].map(([key, row]) => <tr key={key} className="border-t"><td className="p-2">{row.driver}</td><td className="p-2">{row.rickshaw}</td><td className="p-2">{money(row.pending / 100)}</td><td className="p-2">{money(row.paid / 100)}</td><td className="p-2">{money((row.pending - row.paid) / 100)}</td></tr>)}</tbody></table></div><p className="text-xs text-zinc-500 mt-2">Driver totals show this month’s activity. Carried balances are shown per rickshaw above.</p></div>
    <div className="bg-white border rounded-xl p-4 space-y-3"><h3 className="font-semibold">Driver records — {month}</h3>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['Date', 'Rickshaw', 'Driver', 'Pending added', 'Payment', 'Notes', 'Actions'].map(s => <th key={s} className="p-2">{s}</th>)}</tr></thead><tbody>{details.map(t => <tr key={t.id} className="border-t"><td className="p-2 whitespace-nowrap">{t.date.slice(0, 10)}</td><td className="p-2">{t.rickshaw_number || 'Unlinked'}</td><td className="p-2">{t.driver_name || 'Unknown'}</td><td className="p-2">{isPending(t) ? money(Number(t.amount)) : '—'}</td><td className="p-2">{isRecovery(t) ? money(Number(t.amount)) : '—'}</td><td className="p-2">{t.notes}</td><td className="p-2"><button type="button" disabled={saving} onClick={() => remove(t.id)} className="text-rose-600 disabled:opacity-50">Remove</button></td></tr>)}</tbody></table>{!details.length && <p className="text-sm text-zinc-500 py-3">No records for this month.</p>}</div>
    </div>
    <details className="bg-white border rounded-xl p-4"><summary className="cursor-pointer font-semibold">Driver assignment history</summary>{assignments.filter(a => !filter || String(a.rickshaw_id) === filter).map(a => <p className="text-sm py-2 border-b" key={a.id}>{a.rickshaw_number} · {a.driver_name} · {a.start_date.slice(0, 10)} to {a.end_date?.slice(0, 10) || 'present'}</p>)}</details>
  </div>;
}
