import { dailyPendingRows } from '../utils/dailyPending';
import { useState, useEffect } from 'react';
import { CalendarDays, Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Transaction, Driver, Rickshaw } from '../types';
import { todayYMD, shiftYMD, formatDate } from '../utils/date';
import { isLeaveTransaction } from '../utils/leave';

interface DiaryRow {
  key: string;
  name: string;
  rickshaw: string;
  income: number;
  expense: number;
  paid: boolean;
  isDriver: boolean;
  parked: boolean;
  leave: boolean;
}

export default function IncomeTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('Rs.');
  const [date, setDate] = useState<string>(() => todayYMD());

  useEffect(() => {
    const saved = localStorage.getItem('currency');
    if (saved) setCurrency(saved);
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    Promise.all(['drivers', 'rickshaws'].map(async resource => {
      const response = await fetch(`/api/${resource}`, { headers });
      if (!response.ok) throw new Error('Could not load drivers and rickshaws. Please refresh.');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Could not load drivers and rickshaws. Please refresh.');
      return data;
    })).then(([drivers, rickshaws]) => { setDrivers(drivers); setRickshaws(rickshaws); })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`/api/transactions?start_date=${date}&end_date=${date}`, { headers, signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Could not load diary entries. Please refresh.'); return r.json(); })
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(e => { if (!controller.signal.aborted) { setTransactions([]); setError(e.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date]);

  const shiftDay = (delta: number) => setDate(shiftYMD(date, delta));

  const isToday = date === todayYMD();

  // Sum income and expenses per driver for the selected date
  const incomeById: Record<string, number> = {};
  const expenseById: Record<string, number> = {};
  let noDriverIncome = 0, noDriverExpense = 0;
  transactions.forEach(t => {
    const isPending = t.category === 'rent_pending' || t.type === 'pending';
    const amount = Number(t.amount) || 0;
    const isIncome = t.type === 'income' && !isPending;
    const isExpense = t.type === 'expense' && !isPending;
    if (isPending || (!isIncome && !isExpense)) return;
    if (t.driver_id == null || !drivers.some(d => String(d.id) === String(t.driver_id))) {
      if (isIncome) noDriverIncome += amount;
      else noDriverExpense += amount;
      return;
    }
    const id = String(t.driver_id);
    if (isIncome) incomeById[id] = (incomeById[id] || 0) + amount;
    else expenseById[id] = (expenseById[id] || 0) + amount;
  });

  const leaveIds = new Set<string>();
  transactions.forEach(t => {
    if (t.driver_id != null && isLeaveTransaction(t)) leaveIds.add(String(t.driver_id));
  });

  // One row per driver so non-payers are visible
  const allRows: DiaryRow[] = drivers.map(d => {
    const id = String(d.id);
    const income = incomeById[id] || 0;
    const expense = expenseById[id] || 0;
    const rickshaw = rickshaws.find(r => r.number === d.assigned_rickshaw);
    const parked = (rickshaw?.status || d.rickshaw_status) === 'parked';
    return { key: id, name: d.name, rickshaw: d.assigned_rickshaw || '', income, expense, paid: income > 0, isDriver: true, parked, leave: leaveIds.has(id) };
  });

  const sortRows = (rows: DiaryRow[]) =>
    [...rows].sort((a, b) => (b.paid ? 1 : 0) - (a.paid ? 1 : 0) || b.income - a.income);

  // Keep every driver in one of the two status groups.
  const activeRows = sortRows(allRows.filter(r => !r.parked));
  const parkedRows = sortRows(allRows.filter(r => r.parked));
  if (noDriverIncome > 0 || noDriverExpense > 0) {
    activeRows.push({ key: 'none', name: '— (no driver)', rickshaw: '', income: noDriverIncome, expense: noDriverExpense, paid: noDriverIncome > 0, isDriver: false, parked: false, leave: false });
  }

  const pendingRows = dailyPendingRows(rickshaws, transactions, date);
  const totalPending = pendingRows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100;

  const grandIncome = allRows.reduce((s, r) => s + r.income, 0) + noDriverIncome;
  const grandExpense = allRows.reduce((s, r) => s + r.expense, 0) + noDriverExpense;

  const DiaryTable = ({ title, rows }: { title: string; rows: DiaryRow[] }) => {
    const totalIncome = rows.reduce((s, r) => s + r.income, 0);
    const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
    const driverRows = rows.filter(r => r.isDriver);
    const paidCount = driverRows.filter(r => r.paid).length;

    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-zinc-100 flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-[13px] md:text-base font-semibold text-zinc-900">{title}</h3>
          {!loading && driverRows.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[10px] md:text-xs">
              <Check className="w-3 h-3" /> {paidCount}/{driverRows.length} paid
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50/80 border-b border-zinc-100">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-2.5 text-left text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="px-3 md:px-4 py-2 md:py-2.5 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Income</th>
                <th className="px-3 md:px-4 py-2 md:py-2.5 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Expense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">No drivers</td></tr>
              ) : (
                rows.map(r => (
                  <tr key={r.key} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-3 md:px-4 py-2.5 md:py-3">
                      <div className="flex items-center gap-2">
                        {r.isDriver && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.leave ? 'bg-rose-500' : r.paid ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                        )}
                        <span className="text-[12px] md:text-sm font-medium text-zinc-900">{r.name}</span>
                        {r.leave && (
                          <span className="text-[9px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded shrink-0">Leave</span>
                        )}
                        {r.rickshaw && (
                          <span className="text-[9px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">{r.rickshaw}</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 md:px-4 py-2.5 md:py-3 text-right text-[12px] md:text-sm font-semibold font-number ${r.income > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                      {r.income > 0 ? `${currency} ${r.income.toLocaleString()}` : '—'}
                    </td>
                    <td className={`px-3 md:px-4 py-2.5 md:py-3 text-right text-[12px] md:text-sm font-semibold font-number ${r.expense > 0 ? 'text-rose-600' : 'text-zinc-300'}`}>
                      {r.expense > 0 ? `${currency} ${r.expense.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot className="bg-zinc-50/80 border-t border-zinc-200">
                <tr>
                  <td className="px-3 md:px-4 py-2.5 md:py-3 text-[12px] md:text-sm font-bold text-zinc-900">Total</td>
                  <td className="px-3 md:px-4 py-2.5 md:py-3 text-right text-[12px] md:text-sm font-bold text-emerald-700 font-number">{currency} {totalIncome.toLocaleString()}</td>
                  <td className="px-3 md:px-4 py-2.5 md:py-3 text-right text-[12px] md:text-sm font-bold text-rose-700 font-number">{currency} {totalExpense.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Mobile: date bar pinned to the bottom of the screen */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center gap-2 shadow-[0_-4px_16px_rgba(0,0,0,0.2)]">
        <button onClick={() => shiftDay(-1)}
          className="shrink-0 whitespace-nowrap bg-white/10 active:bg-white/25 text-white px-3 py-2.5 rounded-xl border border-white/10 flex items-center gap-1 text-xs font-medium" aria-label="Previous day">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <div className="relative flex-1 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="date"
            value={date}
            max={todayYMD()}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="w-full min-w-0 bg-white/10 text-white text-sm pl-8 pr-2 py-2.5 rounded-xl border border-white/10 focus:outline-none [color-scheme:dark]"
          />
        </div>
        <button onClick={() => shiftDay(1)} disabled={isToday}
          className="shrink-0 whitespace-nowrap bg-white/10 active:bg-white/25 text-white px-3 py-2.5 rounded-xl border border-white/10 flex items-center gap-1 text-xs font-medium disabled:opacity-40" aria-label="Next day">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4 md:p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg md:text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-400" /> Daily Diary
          </h2>
          {/* Date picker with prev/next day */}
          <div className="hidden md:flex items-center gap-1.5 w-full sm:w-auto">
            <button onClick={() => shiftDay(-1)}
              className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-lg border border-white/10 transition-colors" title="Previous day">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="relative flex-1 sm:flex-none">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={date}
                max={todayYMD()}
                onChange={e => e.target.value && setDate(e.target.value)}
                className="w-full bg-white/10 text-white text-[12px] md:text-sm pl-8 pr-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none [color-scheme:dark]"
              />
            </div>
            <button onClick={() => shiftDay(1)} disabled={isToday}
              className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-lg border border-white/10 transition-colors disabled:opacity-40" title="Next day">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Date label + grand total */}
      <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
        <p className="text-[12px] md:text-sm text-zinc-500">
          {formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {isToday && <span className="ml-2 text-emerald-600 font-medium">Today</span>}
        </p>
        {!loading && (
          <p className="text-[11px] md:text-xs text-zinc-500">
            Day total: <span className="font-semibold text-emerald-600 font-number">{currency} {grandIncome.toLocaleString()}</span>
            {grandExpense > 0 && <> · <span className="font-semibold text-rose-600 font-number">-{currency} {grandExpense.toLocaleString()}</span></>}
          </p>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {/* Income and expenses remain in the driver tables. */}
      <DiaryTable title="Active Rickshaw Drivers" rows={activeRows} />
      <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
        <div className="px-3 md:px-4 py-3 bg-amber-50 border-b border-amber-100">
          <h3 className="text-sm md:text-base font-semibold text-amber-900">Rickshaw Pending</h3>
          <p className="text-xs text-amber-700 mt-1">Only drivers with pending amounts on the selected date.</p>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs md:text-sm text-left">
          <thead className="bg-amber-50/50"><tr><th scope="col" className="p-3">Rickshaw</th><th scope="col" className="p-3">Driver on entry</th><th scope="col" className="p-3 text-right">Pending</th></tr></thead>
          <tbody className="divide-y divide-amber-100">
            {loading ? <tr><td colSpan={3} className="p-4 text-center text-zinc-500">Loading...</td></tr> : pendingRows.length ? pendingRows.map(row => <tr key={row.key} className={row.amount > 0 ? 'bg-amber-50/50' : ''}>
              <td className="p-3 font-medium">{row.number}</td><td className="p-3 text-zinc-500">{row.drivers || '—'}</td><td className={`p-3 text-right font-semibold font-number ${row.amount > 0 ? 'text-amber-700' : 'text-zinc-400'}`}>{currency} {row.amount.toLocaleString()}</td>
            </tr>) : <tr><td colSpan={3} className="p-4 text-center text-zinc-500">No pending amounts for this date.</td></tr>}
          </tbody>
          {!loading && pendingRows.length > 0 && <tfoot className="bg-amber-50 border-t border-amber-200"><tr><th scope="row" colSpan={2} className="p-3">Total pending</th><td className="p-3 text-right font-bold text-amber-800 font-number">{currency} {totalPending.toLocaleString()}</td></tr></tfoot>}
        </table></div>
      </div>
      <DiaryTable title="Parked Rickshaw Drivers" rows={parkedRows} />
    </div>
  );
}
