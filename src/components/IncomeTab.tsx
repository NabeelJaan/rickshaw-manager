import { useState, useEffect } from 'react';
import { CalendarDays, Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Transaction, Driver } from '../types';
import { todayYMD, shiftYMD, formatDate } from '../utils/date';

interface DiaryRow {
  key: string;
  name: string;
  rickshaw: string;
  income: number;
  pending: number;
  expense: number;
  paid: boolean;
  isDriver: boolean;
}

// Group-1 gets its own table, matched by RICKSHAW NUMBER (digits) — driver names can
// change over time, but the rickshaw's number stays the same. Substring match handles
// numbers embedded in labels like "BAB - 2023" or "BJK 6020".
const GROUP1_RICKSHAWS = ['2023', '6020', '5184'];
const isGroup1 = (rickshawNo: string) =>
  GROUP1_RICKSHAWS.some(n => (rickshawNo || '').includes(n));

export default function IncomeTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('Rs.');
  const [date, setDate] = useState<string>(() => todayYMD());

  useEffect(() => {
    const saved = localStorage.getItem('currency');
    if (saved) setCurrency(saved);
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/drivers', { headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDrivers(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(`/api/transactions?start_date=${date}&end_date=${date}`, { headers })
      .then(r => r.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [date]);

  const shiftDay = (delta: number) => setDate(shiftYMD(date, delta));

  const isToday = date === todayYMD();

  // Sum income / pending / expense per driver id for the selected date
  const incomeById: Record<string, number> = {};
  const pendingById: Record<string, number> = {};
  const expenseById: Record<string, number> = {};
  let noDriverIncome = 0, noDriverPending = 0, noDriverExpense = 0;
  transactions.forEach(t => {
    const isPending = t.category === 'rent_pending';
    const isIncome = t.type === 'income' && !isPending;
    const isExpense = t.type === 'expense' && !isPending;
    if (!isIncome && !isExpense && !isPending) return;
    if (t.driver_id == null) {
      if (isPending) noDriverPending += t.amount;
      else if (isIncome) noDriverIncome += t.amount;
      else noDriverExpense += t.amount;
      return;
    }
    const id = String(t.driver_id);
    if (isPending) pendingById[id] = (pendingById[id] || 0) + t.amount;
    else if (isIncome) incomeById[id] = (incomeById[id] || 0) + t.amount;
    else expenseById[id] = (expenseById[id] || 0) + t.amount;
  });

  // One row per driver so non-payers are visible
  const allRows: DiaryRow[] = drivers.map(d => {
    const id = String(d.id);
    const income = incomeById[id] || 0;
    const pending = pendingById[id] || 0;
    const expense = expenseById[id] || 0;
    return { key: id, name: d.name, rickshaw: d.assigned_rickshaw || '', income, pending, expense, paid: income > 0, isDriver: true };
  });

  const sortRows = (rows: DiaryRow[]) =>
    [...rows].sort((a, b) => (b.paid ? 1 : 0) - (a.paid ? 1 : 0) || b.income - a.income);

  // Split into the two groups by rickshaw number
  const group1 = sortRows(allRows.filter(r => isGroup1(r.rickshaw)));
  const others = sortRows(allRows.filter(r => !isGroup1(r.rickshaw)));
  if (noDriverIncome > 0 || noDriverExpense > 0 || noDriverPending > 0) {
    others.push({ key: 'none', name: '— (no driver)', rickshaw: '', income: noDriverIncome, pending: noDriverPending, expense: noDriverExpense, paid: noDriverIncome > 0, isDriver: false });
  }

  const grandIncome = allRows.reduce((s, r) => s + r.income, 0) + noDriverIncome;
  const grandExpense = allRows.reduce((s, r) => s + r.expense, 0) + noDriverExpense;

  const DiaryTable = ({ title, rows }: { title: string; rows: DiaryRow[] }) => {
    const totalIncome = rows.reduce((s, r) => s + r.income, 0);
    const totalPending = rows.reduce((s, r) => s + r.pending, 0);
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
                <th className="px-3 md:px-4 py-2 md:py-2.5 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending</th>
                <th className="px-3 md:px-4 py-2 md:py-2.5 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Expense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">No drivers</td></tr>
              ) : (
                rows.map(r => (
                  <tr key={r.key} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-3 md:px-4 py-2.5 md:py-3">
                      <div className="flex items-center gap-2">
                        {r.isDriver && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.paid ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                        )}
                        <span className="text-[12px] md:text-sm font-medium text-zinc-900">{r.name}</span>
                        {r.rickshaw && (
                          <span className="text-[9px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded shrink-0">{r.rickshaw}</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 md:px-4 py-2.5 md:py-3 text-right text-[12px] md:text-sm font-semibold font-number ${r.income > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                      {r.income > 0 ? `${currency} ${r.income.toLocaleString()}` : '—'}
                    </td>
                    <td className={`px-3 md:px-4 py-2.5 md:py-3 text-right text-[12px] md:text-sm font-semibold font-number ${r.pending > 0 ? 'text-amber-600' : 'text-zinc-300'}`}>
                      {r.pending > 0 ? `${currency} ${r.pending.toLocaleString()}` : '—'}
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
                  <td className="px-3 md:px-4 py-2.5 md:py-3 text-right text-[12px] md:text-sm font-bold text-amber-700 font-number">{totalPending > 0 ? `${currency} ${totalPending.toLocaleString()}` : '—'}</td>
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4 md:p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg md:text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-400" /> Daily Diary
          </h2>
          {/* Date picker with prev/next day */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
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

      {/* Two grouped tables */}
      <DiaryTable title="Main Drivers" rows={group1} />
      <DiaryTable title="Other Drivers" rows={others} />
    </div>
  );
}
