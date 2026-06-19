import { useState, useEffect } from 'react';
import { Calculator, Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Driver, Transaction } from '../types';

interface DriverProfit {
  id: string;
  name: string;
  earning: number;
  expense: number;
  net: number;
}

export default function NetProfit() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('Rs.');
  const [period, setPeriod] = useState<string>('all');

  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) setCurrency(savedCurrency);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/drivers', { headers })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setDrivers(data); });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const endDate = new Date();
      const startDate = new Date();
      switch (period) {
        case '1month': startDate.setMonth(startDate.getMonth() - 1); break;
        case '3months': startDate.setMonth(startDate.getMonth() - 3); break;
        case '6months': startDate.setMonth(startDate.getMonth() - 6); break;
        case '1year': startDate.setFullYear(startDate.getFullYear() - 1); break;
        case 'all': startDate.setFullYear(2000); break;
      }

      const query = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      }).toString();

      try {
        const res = await fetch(`/api/transactions?${query}`, { headers });
        const data = await res.json();
        if (Array.isArray(data)) setTransactions(data);
      } catch (e) {
        console.error('Error fetching net profit data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  // Build per-driver totals
  const rows: DriverProfit[] = drivers.map(d => {
    const dId = String(d.id);
    const driverTx = transactions.filter(t => String(t.driver_id) === dId);
    const earning = driverTx
      .filter(t => t.type === 'income' && t.category !== 'rent_pending')
      .reduce((s, t) => s + t.amount, 0);
    const expense = driverTx
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    return { id: dId, name: d.name, earning, expense, net: earning - expense };
  }).sort((a, b) => b.net - a.net);

  const totals = rows.reduce(
    (acc, r) => ({ earning: acc.earning + r.earning, expense: acc.expense + r.expense, net: acc.net + r.net }),
    { earning: 0, expense: 0, net: 0 }
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4 md:p-5 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 md:gap-3">
          <h2 className="text-lg md:text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <Calculator className="w-5 h-5 text-emerald-400" /> Net Profit
          </h2>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-white/10 text-white text-[11px] md:text-xs px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none"
            >
              <option className="text-zinc-900" value="all">All Time</option>
              <option className="text-zinc-900" value="1month">Last 1 Month</option>
              <option className="text-zinc-900" value="3months">Last 3 Months</option>
              <option className="text-zinc-900" value="6months">Last 6 Months</option>
              <option className="text-zinc-900" value="1year">Last 1 Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white p-3.5 md:p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-2">
          <div className="p-2 md:p-2.5 rounded-xl bg-emerald-500/10 w-fit">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
          </div>
          <p className="text-[11px] md:text-xs font-medium text-zinc-500">Total Earning</p>
          <h3 className="text-base md:text-xl font-bold text-zinc-900 tracking-tight">{currency}{totals.earning.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-3.5 md:p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-2">
          <div className="p-2 md:p-2.5 rounded-xl bg-rose-500/10 w-fit">
            <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-rose-500" />
          </div>
          <p className="text-[11px] md:text-xs font-medium text-zinc-500">Total Expenses</p>
          <h3 className="text-base md:text-xl font-bold text-zinc-900 tracking-tight">{currency}{totals.expense.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-3.5 md:p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-2">
          <div className="p-2 md:p-2.5 rounded-xl bg-blue-500/10 w-fit">
            <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
          </div>
          <p className="text-[11px] md:text-xs font-medium text-zinc-500">Net Profit</p>
          <h3 className={`text-base md:text-xl font-bold tracking-tight ${totals.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totals.net >= 0 ? '+' : ''}{currency}{totals.net.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        <div className="p-3 md:p-5 border-b border-zinc-100">
          <h3 className="text-sm md:text-base font-semibold text-zinc-900 flex items-center gap-1.5 md:gap-2">
            <Calculator className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-500" />
            Profit by Driver
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50/80 border-b border-zinc-100">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Driver Name</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Earning</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Expenses</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-right text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs md:text-sm text-zinc-500">No drivers found</td></tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-3 md:px-4 py-2 md:py-3 text-[11px] md:text-sm font-medium text-zinc-900">{r.name}</td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-right text-[11px] md:text-sm font-medium text-emerald-600 font-number">{currency}{r.earning.toLocaleString()}</td>
                    <td className="px-3 md:px-4 py-2 md:py-3 text-right text-[11px] md:text-sm font-medium text-rose-600 font-number">{currency}{r.expense.toLocaleString()}</td>
                    <td className={`px-3 md:px-4 py-2 md:py-3 text-right text-[11px] md:text-sm font-bold font-number ${r.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {r.net >= 0 ? '+' : ''}{currency}{r.net.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && rows.length > 0 && (
              <tfoot className="bg-zinc-50/80 border-t border-zinc-200">
                <tr>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-[11px] md:text-sm font-bold text-zinc-900">Total</td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-right text-[11px] md:text-sm font-bold text-emerald-700 font-number">{currency}{totals.earning.toLocaleString()}</td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-right text-[11px] md:text-sm font-bold text-rose-700 font-number">{currency}{totals.expense.toLocaleString()}</td>
                  <td className={`px-3 md:px-4 py-2 md:py-3 text-right text-[11px] md:text-sm font-bold font-number ${totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {totals.net >= 0 ? '+' : ''}{currency}{totals.net.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
