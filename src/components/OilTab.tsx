import { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';
import { Driver, Rickshaw } from '../types';
import { toYMD, formatDate } from '../utils/date';
import OilWeeklyTable from './OilWeeklyTable';

const ymdOf = (d: any) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : toYMD(d));
const isOil = (tx: any) =>
  (tx.category && tx.category.toLowerCase().includes('oil')) || (tx.notes && /\boil\b/i.test(tx.notes));

export default function OilTab() {
  const [rickshaws, setRickshaws] = useState<Rickshaw[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [oilChanges, setOilChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('Rs.');

  const load = async () => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const [rk, dr, tx] = await Promise.all([
        fetch('/api/rickshaws', { headers }).then(r => r.json()),
        fetch('/api/drivers', { headers }).then(r => r.json()),
        fetch('/api/transactions', { headers }).then(r => r.json()),
      ]);
      const rkList: Rickshaw[] = Array.isArray(rk) ? rk : [];
      const drList: Driver[] = Array.isArray(dr) ? dr : [];
      setRickshaws(rkList);
      setDrivers(drList);
      setOilChanges(
        (Array.isArray(tx) ? tx : [])
          .filter(isOil)
          .map((t: any) => ({ ...t, resolved_driver_id: t.driver_id ?? null }))
          .sort((a: any, b: any) => ymdOf(b.date).localeCompare(ymdOf(a.date))),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('currency');
    if (saved) setCurrency(saved);
    load();
  }, []);

  const recent = oilChanges.slice(0, 20);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4 md:p-5 rounded-2xl shadow-sm">
        <h2 className="text-lg md:text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-400" /> Oil Changes
        </h2>
        <p className="text-xs md:text-sm text-zinc-400 mt-1">Oil must be changed once a week for every rickshaw.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-zinc-200/60 px-4 py-12 text-center text-zinc-500 text-sm">Loading...</div>
      ) : (
        <>
          <OilWeeklyTable oilChanges={oilChanges} rickshaws={rickshaws} drivers={drivers} currency={currency} onLogged={load} />

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h3 className="font-semibold text-zinc-900 text-sm md:text-base">Recent Oil Changes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium">Rickshaw</th>
                    <th className="text-left px-4 py-2.5 font-medium">Driver</th>
                    <th className="text-right px-4 py-2.5 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recent.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No oil changes recorded yet.</td></tr>
                  )}
                  {recent.map(tx => (
                    <tr key={tx.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-number whitespace-nowrap">{formatDate(ymdOf(tx.date), { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-2.5">{tx.rickshaw_number || rickshaws.find(r => r.id === tx.rickshaw_id)?.number || '-'}</td>
                      <td className="px-4 py-2.5 font-medium text-zinc-900">{tx.driver_name || drivers.find(d => d.id === tx.driver_id)?.name || '-'}</td>
                      <td className="px-4 py-2.5 text-right font-number font-semibold text-blue-700 whitespace-nowrap">{currency} {(Number(tx.amount) || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
