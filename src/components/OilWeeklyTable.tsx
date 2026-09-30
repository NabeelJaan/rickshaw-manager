import { useState, useEffect, useMemo } from 'react';
import { Droplets, Check, X, Plus } from 'lucide-react';
import { Driver, Rickshaw } from '../types';
import { todayYMD, toYMD, shiftYMD, formatDate } from '../utils/date';

const WEEKS = 8;

const ymdOf = (d: any) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : toYMD(d));

// Monday of the week containing `ymd` (weeks run Mon–Sun)
const weekStart = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return shiftYMD(ymd, -((dow + 6) % 7));
};

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

interface Props {
  oilChanges: any[]; // oil-change transactions (from Drivers.tsx)
  rickshaws: Rickshaw[];
  drivers: Driver[];
  currency: string;
  onLogged: () => void;
}

export default function OilWeeklyTable({ oilChanges, rickshaws, drivers, currency, onLogged }: Props) {
  const today = todayYMD();
  const thisWeek = weekStart(today);
  const weeks = useMemo(
    () => Array.from({ length: WEEKS }, (_, i) => shiftYMD(thisWeek, -7 * i)),
    [thisWeek],
  );

  const [oilCategory, setOilCategory] = useState<string>('maintenance');
  const [logging, setLogging] = useState<number | null>(null);
  const [logAmount, setLogAmount] = useState('');
  const [logDate, setLogDate] = useState(today);
  const [saving, setSaving] = useState(false);

  // Use an existing "oil" expense category if there is one, otherwise maintenance + "Oil change" note
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch('/api/categories', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(cats => {
        if (!Array.isArray(cats)) return;
        const oil = cats.find((c: any) => c.type === 'expense' && /oil/i.test(c.name));
        if (oil) setOilCategory(oil.name);
      })
      .catch(() => {});
  }, []);

  const active = rickshaws.filter(r => (r.status || 'active') === 'active');
  const driverFor = (r: Rickshaw) => drivers.find(d => d.assigned_rickshaw === r.number);

  // rickshaw id -> list of oil-change dates (newest first) + last price
  const byRickshaw = useMemo(() => {
    const map: Record<number, { dates: string[]; lastPrice: number }> = {};
    const numberToId: Record<string, number> = {};
    rickshaws.forEach(r => { numberToId[r.number] = r.id; });
    const driverToRk: Record<number, number> = {};
    drivers.forEach(d => { if (d.assigned_rickshaw && numberToId[d.assigned_rickshaw]) driverToRk[d.id] = numberToId[d.assigned_rickshaw]; });

    [...oilChanges]
      .sort((a, b) => ymdOf(b.date).localeCompare(ymdOf(a.date)))
      .forEach(tx => {
        const rid = tx.rickshaw_id ?? (tx.resolved_driver_id ? driverToRk[tx.resolved_driver_id] : undefined);
        if (!rid) return;
        if (!map[rid]) map[rid] = { dates: [], lastPrice: Number(tx.amount) || 0 };
        map[rid].dates.push(ymdOf(tx.date));
      });
    return map;
  }, [oilChanges, rickshaws, drivers]);

  const doneIn = (rid: number, wk: string) => {
    const end = shiftYMD(wk, 6);
    return (byRickshaw[rid]?.dates || []).filter(d => d >= wk && d <= end);
  };

  const rows = active
    .map(r => {
      const last = byRickshaw[r.id]?.dates[0] || null;
      return { r, driver: driverFor(r), last, doneThisWeek: doneIn(r.id, thisWeek).length > 0 };
    })
    .sort((a, b) => Number(a.doneThisWeek) - Number(b.doneThisWeek) || (a.last || '').localeCompare(b.last || ''));

  const doneCount = rows.filter(x => x.doneThisWeek).length;

  const startLog = (rid: number) => {
    setLogging(rid);
    setLogDate(today);
    setLogAmount(byRickshaw[rid]?.lastPrice ? String(byRickshaw[rid].lastPrice) : '');
  };

  const saveLog = async (r: Rickshaw) => {
    if (!(Number(logAmount) > 0)) return;
    setSaving(true);
    const token = localStorage.getItem('auth_token');
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          date: logDate,
          type: 'expense',
          category: oilCategory,
          amount: Number(logAmount),
          rickshaw_id: r.id,
          driver_id: driverFor(r)?.id ?? null,
          notes: 'Oil change',
        }),
      });
      setLogging(null);
      onLogged();
    } finally {
      setSaving(false);
    }
  };

  const weekLabel = (wk: string) => formatDate(wk, { day: 'numeric', month: 'short' });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 bg-blue-50 border-b border-blue-100">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2 text-sm md:text-base">
          <Droplets className="w-4 h-4" /> Weekly Oil Check
        </h3>
        <span className={`text-xs md:text-sm font-semibold px-2.5 py-1 rounded-full ${
          doneCount === rows.length && rows.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
        }`}>
          This week: <span className="font-number">{doneCount}/{rows.length}</span> done
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium sticky left-0 bg-zinc-50 z-10 min-w-[130px]">Rickshaw</th>
              <th className="text-left px-3 py-2.5 font-medium whitespace-nowrap">Last change</th>
              {weeks.map((wk, i) => (
                <th key={wk} className={`text-center px-2 py-2.5 font-medium whitespace-nowrap ${i === 0 ? 'bg-blue-100/60 text-blue-900' : ''}`}>
                  {i === 0 ? 'This week' : weekLabel(wk)}
                </th>
              ))}
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && (
              <tr><td colSpan={WEEKS + 3} className="px-4 py-8 text-center text-zinc-500">No active rickshaws</td></tr>
            )}
            {rows.map(({ r, driver, last }) => {
              const ago = last ? daysBetween(last, today) : null;
              return (
                <tr key={r.id} className="hover:bg-zinc-50/60">
                  <td className="px-3 py-2.5 sticky left-0 bg-white z-10">
                    <p className="font-semibold text-zinc-900 whitespace-nowrap">{r.number}</p>
                    <p className="text-[11px] text-zinc-500 whitespace-nowrap">{driver?.name || 'No driver'}</p>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {last ? (
                      <>
                        <p className="font-number text-zinc-800">{formatDate(last, { day: 'numeric', month: 'short' })}</p>
                        <p className={`text-[11px] font-medium ${ago! > 7 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {ago === 0 ? 'today' : `${ago} day${ago === 1 ? '' : 's'} ago`}
                        </p>
                      </>
                    ) : <span className="text-[11px] text-rose-600 font-medium">Never</span>}
                  </td>
                  {weeks.map((wk, i) => {
                    const done = doneIn(r.id, wk);
                    return (
                      <td key={wk} className={`px-2 py-2.5 text-center ${i === 0 ? 'bg-blue-50/40' : ''}`}>
                        {done.length > 0 ? (
                          <span className="inline-flex flex-col items-center" title={done.join(', ')}>
                            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center"><Check className="w-3.5 h-3.5" /></span>
                            <span className="text-[10px] text-zinc-500 mt-0.5">{formatDate(done[0], { weekday: 'short' })}</span>
                          </span>
                        ) : (
                          <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-500'}`}>
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {logging === r.id ? (
                      <div className="flex items-center gap-1">
                        <input type="date" value={logDate} max={today} onChange={e => setLogDate(e.target.value)}
                          className="border border-zinc-200 rounded-lg px-1.5 py-1 text-xs w-[120px]" />
                        <input type="number" inputMode="numeric" value={logAmount} onChange={e => setLogAmount(e.target.value)}
                          placeholder={currency} className="border border-zinc-200 rounded-lg px-1.5 py-1 text-xs w-20 font-number" />
                        <button onClick={() => saveLog(r)} disabled={saving || !(Number(logAmount) > 0)}
                          className="p-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-40"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setLogging(null)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => startLog(r.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 inline-flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Log oil
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-zinc-500 border-t border-zinc-100">
        Weeks run Monday–Sunday. Green = oil changed that week, red = missed, amber = still due this week.
      </p>
    </div>
  );
}
