import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Download, TrendingUp, TrendingDown, DollarSign, Car, Users, Filter } from 'lucide-react';
import { Driver, Transaction } from '../types';

export default function Reports({ selectedDriverId }: { selectedDriverId?: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedReportDriver, setSelectedReportDriver] = useState<string>(selectedDriverId || '');
  const [reportPeriod, setReportPeriod] = useState<string>('1month');
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('Rs.');

  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/drivers', { headers }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) setDrivers(data);
    });
  }, []);

  useEffect(() => {
    setSelectedReportDriver(selectedDriverId || '');
  }, [selectedDriverId]);

  const generateReport = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (reportPeriod) {
      case '1month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '2months':
        startDate.setMonth(startDate.getMonth() - 2);
        break;
      case '6months':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2000);
        break;
    }

    const query = new URLSearchParams({
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      driver_id: selectedReportDriver
    }).toString();

    try {
      const res = await fetch(`/api/transactions?${query}`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [reportPeriod, selectedReportDriver]);

  const calculateStats = () => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const pending = transactions.filter(t => t.category === 'rent_pending').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;

    return { income, expense, pending, profit };
  };

  const stats = calculateStats();

  const exportReport = () => {
    const reportData = {
      driver: selectedReportDriver ? drivers.find(d => d.id === selectedReportDriver)?.name : 'All Drivers',
      period: reportPeriod,
      startDate: new Date(new Date().setMonth(new Date().getMonth() - (reportPeriod === '1month' ? 1 : reportPeriod === '2months' ? 2 : reportPeriod === '6months' ? 6 : reportPeriod === '1year' ? 12 : 300))).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      stats,
      transactions
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${selectedReportDriver || 'all'}_${reportPeriod}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-cyan-50 via-white to-teal-50 p-6 md:p-8 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl md:text-4xl font-bold text-zinc-900 tracking-tight">Reports</h2>
          <button 
            onClick={exportReport}
            className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 text-sm font-medium"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      {/* Report Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Driver
            </label>
            <select 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-sm"
              value={selectedReportDriver}
              onChange={(e) => setSelectedReportDriver(e.target.value)}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-zinc-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Report Period
            </label>
            <select 
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-sm"
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
            >
              <option value="1month">Last 1 Month</option>
              <option value="2months">Last 2 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last 1 Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <button 
            onClick={generateReport}
            disabled={loading}
            className="w-full md:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-medium disabled:opacity-50"
          >
            <Filter className="w-4 h-4" /> {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-3 transition-all duration-300 hover:shadow-lg group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">Total Income</p>
            <h3 className="text-xl font-bold text-zinc-900 font-number tracking-tight">
              {currency}{stats.income.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-3 transition-all duration-300 hover:shadow-lg group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-rose-500/10 group-hover:scale-110 transition-transform duration-300">
              <TrendingDown className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">Total Expense</p>
            <h3 className="text-xl font-bold text-zinc-900 font-number tracking-tight">
              {currency}{stats.expense.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-3 transition-all duration-300 hover:shadow-lg group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">Net Profit</p>
            <h3 className={`text-xl font-bold font-number tracking-tight ${stats.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {stats.profit >= 0 ? '+' : ''}{currency}{stats.profit.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200/60 flex flex-col gap-3 transition-all duration-300 hover:shadow-lg group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-amber-500/10 group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-1">Transactions</p>
            <h3 className="text-xl font-bold text-zinc-900 font-number tracking-tight">
              {transactions.length}
            </h3>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-zinc-100">
          <h3 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-500" />
            Transaction Details
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">Rickshaw</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                    Loading report data...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No transactions found for the selected period
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-900">
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                        t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-900 capitalize">{t.category.replace('_', ' ')}</td>
                    <td className={`px-4 py-3 text-sm font-medium font-number ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {t.type === 'income' ? '+' : '-'}{currency}{t.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{t.driver_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{t.rickshaw_number || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
