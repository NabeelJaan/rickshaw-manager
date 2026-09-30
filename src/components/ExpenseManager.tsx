import { useState, useEffect, useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, HandCoins, Store, Plus, Pencil, Trash2, X, Check, Scale } from 'lucide-react';
import { todayYMD, formatDate, recentMonths } from '../utils/date';

type LedgerType = 'income' | 'expense' | 'borrow' | 'repay';

interface LedgerEntry {
  id: number;
  date: string;
  type: LedgerType;
  amount: number;
  party: string | null;
  category: string | null;
  notes: string | null;
}

const TYPE_META: Record<LedgerType, { label: string; short: string; text: string; bg: string; ring: string }> = {
  income:  { label: 'Income',          short: 'Income',  text: 'text-emerald-700', bg: 'bg-emerald-50',  ring: 'border-emerald-300' },
  expense: { label: 'Expense',         short: 'Expense', text: 'text-rose-700',    bg: 'bg-rose-50',     ring: 'border-rose-300' },
  borrow:  { label: 'Borrow (Udhaar)', short: 'Borrow',  text: 'text-amber-700',   bg: 'bg-amber-50',    ring: 'border-amber-300' },
  repay:   { label: 'Repay Udhaar',    short: 'Repaid',  text: 'text-sky-700',     bg: 'bg-sky-50',      ring: 'border-sky-300' },
};

const emptyForm = () => ({ date: todayYMD(), type: 'expense' as LedgerType, amount: '', party: '', category: '', notes: '' });

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

export default function ExpenseManager() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('Rs.');
  const [month, setMonth] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | LedgerType>('all');
  const [partyFilter, setPartyFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const months = useMemo(() => recentMonths(12), []);
  const fmt = (n: number) => `${currency} ${Math.round(n).toLocaleString()}`;

  const load = () => {
    setLoading(true);
    fetch('/api/ledger', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setEntries(Array.isArray(d) ? d.map((e: any) => ({ ...e, amount: Number(e.amount) })) : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const saved = localStorage.getItem('currency');
    if (saved) setCurrency(saved);
    load();
  }, []);

  // Entries in the selected period
  const periodEntries = useMemo(
    () => (month === 'all' ? entries : entries.filter(e => e.date.startsWith(month))),
    [entries, month],
  );

  const sum = (list: LedgerEntry[], t: LedgerType) => list.filter(e => e.type === t).reduce((s, e) => s + e.amount, 0);
  const totalIncome = sum(periodEntries, 'income');
  // Repaying udhaar reduces the shopkeeper balance AND counts as an expense
  const totalExpense = sum(periodEntries, 'expense') + sum(periodEntries, 'repay');
  const periodBorrowed = sum(periodEntries, 'borrow');
  const periodRepaid = sum(periodEntries, 'repay');
  // Net = income − expenses − udhaar paid (repayment deducted once)
  const net = totalIncome - totalExpense;
  // Income shown after udhaar repayments are cut from it
  const incomeAfterRepay = totalIncome - periodRepaid;

  // Udhaar balances per shopkeeper — always all-time (what you still owe today)
  const partyBalances = useMemo(() => {
    const map: Record<string, { name: string; borrowed: number; repaid: number; last: string }> = {};
    entries.forEach(e => {
      if ((e.type !== 'borrow' && e.type !== 'repay') || !e.party) return;
      const key = e.party.trim().toLowerCase();
      if (!map[key]) map[key] = { name: e.party.trim(), borrowed: 0, repaid: 0, last: e.date };
      if (e.type === 'borrow') map[key].borrowed += e.amount; else map[key].repaid += e.amount;
      if (e.date > map[key].last) map[key].last = e.date;
    });
    return Object.values(map)
      .map(p => ({ ...p, due: p.borrowed - p.repaid }))
      .sort((a, b) => b.due - a.due);
  }, [entries]);
  const totalDue = partyBalances.reduce((s, p) => s + Math.max(p.due, 0), 0);

  const allParties = useMemo(
    () => Array.from(new Set(entries.map(e => e.party?.trim()).filter(Boolean) as string[])).sort(),
    [entries],
  );
  const allCategories = useMemo(
    () => Array.from(new Set(entries.map(e => e.category?.trim()).filter(Boolean) as string[])).sort(),
    [entries],
  );

  const visible = periodEntries.filter(e =>
    (typeFilter === 'all' || e.type === typeFilter) &&
    (!partyFilter || (e.party || '').trim().toLowerCase() === partyFilter.toLowerCase()),
  );

  const openAdd = (type: LedgerType = 'expense', party = '') => {
    setForm({ ...emptyForm(), type, party });
    setEditingId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (e: LedgerEntry) => {
    setForm({ date: e.date, type: e.type, amount: String(e.amount), party: e.party || '', category: e.category || '', notes: e.notes || '' });
    setEditingId(e.id);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    if (!(Number(form.amount) > 0)) return setError('Enter an amount');
    if ((form.type === 'borrow' || form.type === 'repay') && !form.party.trim()) return setError('Enter the shopkeeper / person name');
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/ledger/${editingId}` : '/api/ledger', {
        method: editingId ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/ledger/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  const needsParty = form.type === 'borrow' || form.type === 'repay';
  const periodLabel = month === 'all' ? 'All time' : months.find(m => m.value === month)?.label || month;

  const Card = ({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: any; tone: string }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-zinc-200/60 shadow-sm p-3 md:p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
        <Icon className={`w-4 h-4 ${tone}`} />
      </div>
      <p className={`text-base md:text-2xl font-bold font-number ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] md:text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4 md:p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg md:text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" /> Expense Manager
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="flex-1 sm:flex-none bg-white/10 text-white text-[12px] md:text-sm px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none [color-scheme:dark]"
            >
              <option value="all">All time</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <button
              onClick={() => openAdd()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] md:text-sm font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" /> Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        <Card label="Total Income" value={`${incomeAfterRepay < 0 ? '-' : ''}${fmt(Math.abs(incomeAfterRepay))}`} sub={periodRepaid > 0 ? `${fmt(totalIncome)} − ${fmt(periodRepaid)} udhaar paid` : periodLabel} icon={TrendingUp} tone="text-emerald-600" />
        <Card label="Total Expenses" value={fmt(totalExpense)} sub={periodRepaid > 0 ? `${periodLabel} · incl. ${fmt(periodRepaid)} udhaar paid` : periodLabel} icon={TrendingDown} tone="text-rose-600" />
        <Card label="Net Balance" value={`${net < 0 ? '-' : ''}${fmt(Math.abs(net))}`} sub="Income − Expenses − Udhaar paid" icon={Scale} tone={net >= 0 ? 'text-zinc-900' : 'text-rose-600'} />
        <Card label="Udhaar Due" value={fmt(totalDue)} sub={month === 'all' ? `Borrowed ${fmt(periodBorrowed)} · Repaid ${fmt(periodRepaid)}` : `This month: +${fmt(periodBorrowed)} / −${fmt(periodRepaid)}`} icon={HandCoins} tone="text-amber-600" />
      </div>

      {/* Add / edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-3 md:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold text-zinc-900">{editingId ? 'Edit Entry' : 'New Entry'}</h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {(Object.keys(TYPE_META) as LedgerType[]).map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`px-2 py-2 rounded-xl text-[12px] md:text-sm font-medium border transition-all ${
                  form.type === t ? `${TYPE_META[t].bg} ${TYPE_META[t].text} ${TYPE_META[t].ring}` : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500">Date</span>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500">Amount ({currency})</span>
              <input type="number" inputMode="numeric" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-sm font-number focus:outline-none focus:border-emerald-400" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500">{needsParty ? 'Shopkeeper / Person *' : 'Paid to / From (optional)'}</span>
              <input list="ledger-parties" value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))}
                placeholder={needsParty ? 'e.g. Aslam Kiryana' : 'optional'}
                className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500">Category</span>
              <input list="ledger-categories" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Grocery, Bills" className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            </label>
          </div>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)" className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          <datalist id="ledger-parties">{allParties.map(p => <option key={p} value={p} />)}</datalist>
          <datalist id="ledger-categories">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm rounded-lg text-zinc-600 hover:bg-zinc-100">Cancel</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium flex items-center gap-1.5 disabled:opacity-50">
              <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Udhaar per shopkeeper */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
          <h3 className="text-[13px] md:text-base font-semibold text-zinc-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-600" /> Udhaar — Shopkeepers
          </h3>
          <span className="text-[11px] md:text-xs text-zinc-500">Total due: <b className="text-amber-700 font-number">{fmt(totalDue)}</b></span>
        </div>
        {partyBalances.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs md:text-sm text-zinc-500">No udhaar yet. Use “Borrow (Udhaar)” when you take items or cash on credit.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {partyBalances.map(p => (
              <div key={p.name} className={`px-3 md:px-4 py-2.5 flex items-center gap-2 flex-wrap ${partyFilter.toLowerCase() === p.name.toLowerCase() ? 'bg-amber-50/60' : ''}`}>
                <button onClick={() => setPartyFilter(partyFilter.toLowerCase() === p.name.toLowerCase() ? '' : p.name)}
                  className="flex-1 min-w-[140px] text-left">
                  <p className="text-[13px] md:text-sm font-medium text-zinc-900">{p.name}</p>
                  <p className="text-[10px] md:text-xs text-zinc-500 font-number">
                    Borrowed {fmt(p.borrowed)} · Repaid {fmt(p.repaid)} · Last {formatDate(p.last, { day: 'numeric', month: 'short' })}
                  </p>
                </button>
                <span className={`text-[13px] md:text-sm font-bold font-number ${p.due > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                  {p.due > 0 ? fmt(p.due) : p.due < 0 ? `Advance ${fmt(-p.due)}` : 'Cleared'}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openAdd('borrow', p.name)} className="px-2 py-1 text-[11px] rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">+ Udhaar</button>
                  {p.due > 0 && (
                    <button onClick={() => { openAdd('repay', p.name); setForm(f => ({ ...f, type: 'repay', party: p.name, amount: String(p.due) })); }}
                      className="px-2 py-1 text-[11px] rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100">Pay</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entries list */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-zinc-100 flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-[13px] md:text-base font-semibold text-zinc-900">
            Entries <span className="text-zinc-400 font-normal text-xs">({visible.length})</span>
          </h3>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'income', 'expense', 'borrow', 'repay'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-2 py-1 rounded-lg text-[11px] md:text-xs font-medium border ${
                  typeFilter === t ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}>
                {t === 'all' ? 'All' : TYPE_META[t].short}
              </button>
            ))}
            {partyFilter && (
              <button onClick={() => setPartyFilter('')} className="px-2 py-1 rounded-lg text-[11px] md:text-xs font-medium bg-amber-100 text-amber-800 flex items-center gap-1">
                {partyFilter} <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50/80 border-b border-zinc-100">
              <tr>
                <th className="px-3 md:px-4 py-2 text-left text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                <th className="px-3 md:px-4 py-2 text-left text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Details</th>
                <th className="px-3 md:px-4 py-2 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount</th>
                <th className="px-2 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">Loading...</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">No entries</td></tr>
              ) : visible.map(e => {
                const m = TYPE_META[e.type];
                const sign = e.type === 'income' ? '+' : e.type === 'expense' || e.type === 'repay' ? '−' : '';
                return (
                  <tr key={e.id} className="hover:bg-zinc-50/50">
                    <td className="px-3 md:px-4 py-2.5 text-[11px] md:text-sm text-zinc-600 whitespace-nowrap">{formatDate(e.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                    <td className="px-3 md:px-4 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] md:text-[10px] font-semibold px-1.5 py-0.5 rounded ${m.bg} ${m.text}`}>{m.short}</span>
                        {e.party && <span className="text-[12px] md:text-sm font-medium text-zinc-900">{e.party}</span>}
                        {e.category && <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{e.category}</span>}
                      </div>
                      {e.notes && <p className="text-[10px] md:text-xs text-zinc-500 mt-0.5">{e.notes}</p>}
                    </td>
                    <td className={`px-3 md:px-4 py-2.5 text-right text-[12px] md:text-sm font-semibold font-number whitespace-nowrap ${m.text}`}>{sign}{fmt(e.amount)}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(e.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
