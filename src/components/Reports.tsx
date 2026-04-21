import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Download, TrendingUp, TrendingDown, DollarSign, Car, Users, Filter } from 'lucide-react';
import { Driver, Transaction } from '../types';

export default function Reports({ selectedDriverId }: { selectedDriverId?: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedReportDriver, setSelectedReportDriver] = useState<string>(selectedDriverId || '');
  const [reportPeriod, setReportPeriod] = useState<string>('1month');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
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
    
    // Calculate date range based on period or month selection
    const endDate = new Date();
    const startDate = new Date();
    
    if (selectedMonth && selectedYear) {
      // If specific month is selected
      const monthIndex = parseInt(selectedMonth) - 1;
      startDate.setFullYear(parseInt(selectedYear), monthIndex, 1);
      endDate.setFullYear(parseInt(selectedYear), monthIndex + 1, 0);
    } else {
      // Use period-based selection
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
  }, [reportPeriod, selectedReportDriver, selectedMonth, selectedYear]);

  const calculateStats = () => {
    const income = transactions.filter(t => t.type === 'income' && t.category !== 'rent_pending').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const pending = transactions.filter(t => t.category === 'rent_pending').reduce((sum, t) => sum + t.amount, 0);
    const profit = income - expense;

    return { income, expense, pending, profit };
  };

  const stats = calculateStats();

  const exportReport = (format: 'json' | 'csv' | 'excel') => {
    const driverName = selectedReportDriver ? drivers.find(d => d.id === selectedReportDriver)?.name : 'All Drivers';
    const periodLabel = selectedMonth && selectedYear 
      ? `${new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : reportPeriod === '1month' ? '1 Month' : reportPeriod === '2months' ? '2 Months' : reportPeriod === '6months' ? '6 Months' : reportPeriod === '1year' ? '1 Year' : 'All Time';
    
    const startDate = selectedMonth && selectedYear
      ? new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString().split('T')[0]
      : new Date(new Date().setMonth(new Date().getMonth() - (reportPeriod === '1month' ? 1 : reportPeriod === '2months' ? 2 : reportPeriod === '6months' ? 6 : reportPeriod === '1year' ? 12 : 300))).toISOString().split('T')[0];
    const endDate = selectedMonth && selectedYear
      ? new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const reportData = {
        driver: driverName,
        period: periodLabel,
        startDate,
        endDate,
        stats,
        transactions
      };

      const dataStr = JSON.stringify(reportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${selectedReportDriver || 'all'}_${selectedMonth || reportPeriod}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    } else if (format === 'csv' || format === 'excel') {
      const headers = ['Date', 'Type', 'Category', 'Amount', 'Driver', 'Rickshaw', 'Notes'];
      let allRows: any[] = [];

      if (!selectedReportDriver) {
        // If all drivers selected, separate by driver
        const driversWithData = [...new Set(transactions.map(t => t.driver_name).filter(Boolean))];
        
        driversWithData.forEach((driverName, index) => {
          const driverTransactions = transactions.filter(t => t.driver_name === driverName);
          const driverIncome = driverTransactions.filter(t => t.type === 'income' && t.category !== 'rent_pending').reduce((sum, t) => sum + t.amount, 0);
          const driverExpense = driverTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          const driverProfit = driverIncome - driverExpense;

          // Add driver section
          allRows.push(['---']);
          allRows.push(['Driver', driverName]);
          allRows.push(['Income', `${currency}${driverIncome.toLocaleString()}`]);
          allRows.push(['Expense', `${currency}${driverExpense.toLocaleString()}`]);
          allRows.push(['Profit', `${currency}${driverProfit.toLocaleString()}`]);
          allRows.push(['Transactions', driverTransactions.length]);
          allRows.push([]); // Empty row
          allRows.push(headers);

          // Add transactions for this driver
          const transactionRows = driverTransactions.map(t => [
            new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            t.type,
            t.category.replace('_', ' '),
            `${t.type === 'income' ? '+' : '-'}${currency}${t.amount.toLocaleString()}`,
            t.driver_name || '-',
            t.rickshaw_number || '-',
            t.notes || ''
          ]);
          allRows.push(...transactionRows);

          // Add separator between drivers
          if (index < driversWithData.length - 1) {
            allRows.push([]); // Empty row
            allRows.push(['---']); // Separator row
            allRows.push([]); // Empty row
          }
        });

        // Add overall summary at the top
        const overallSummary = [
          ['Report Summary'],
          ['Period', periodLabel],
          ['Start Date', startDate],
          ['End Date', endDate],
          ['Total Income', `${currency}${stats.income.toLocaleString()}`],
          ['Total Expense', `${currency}${stats.expense.toLocaleString()}`],
          ['Net Profit', `${currency}${stats.profit.toLocaleString()}`],
          ['Pending Balance', `${currency}${stats.pending.toLocaleString()}`],
          ['Total Transactions', transactions.length],
          [], // Empty row
          ['Drivers in Report', driversWithData.length],
          [], // Empty row
          ...allRows
        ];
        allRows = overallSummary;
      } else {
        // Single driver report
        const summaryRows = [
          ['Report Summary'],
          ['Driver', driverName],
          ['Period', periodLabel],
          ['Start Date', startDate],
          ['End Date', endDate],
          ['Total Income', `${currency}${stats.income.toLocaleString()}`],
          ['Total Expense', `${currency}${stats.expense.toLocaleString()}`],
          ['Net Profit', `${currency}${stats.profit.toLocaleString()}`],
          ['Pending Balance', `${currency}${stats.pending.toLocaleString()}`],
          ['Total Transactions', transactions.length],
          [], // Empty row
          ['Transaction Details'],
          headers
        ];

        const transactionRows = transactions.map(t => [
          new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          t.type,
          t.category.replace('_', ' '),
          `${t.type === 'income' ? '+' : '-'}${currency}${t.amount.toLocaleString()}`,
          t.driver_name || '-',
          t.rickshaw_number || '-',
          t.notes || ''
        ]);

        allRows = [...summaryRows, ...transactionRows];
      }

      // Convert to CSV format
      const csvContent = allRows.map(row => 
        row.map(cell => 
          typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(',')
      ).join('\n');

      // Add BOM for Excel to recognize UTF-8
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${selectedReportDriver || 'all'}_${selectedMonth || reportPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-cyan-50 via-white to-teal-50 p-6 md:p-8 rounded-2xl border border-zinc-200/60 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl md:text-4xl font-bold text-zinc-900 tracking-tight">Reports</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => exportReport('csv')}
              className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Download Excel/CSV
            </button>
            <button 
              onClick={() => exportReport('json')}
              className="flex-1 sm:flex-none bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 text-sm font-medium"
            >
              <Download className="w-4 h-4" /> Download JSON
            </button>
          </div>
        </div>
      </div>

      {/* Report Filters */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <div>
            <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2">
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4" /> Driver
            </label>
            <select 
              className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-xs md:text-sm"
              value={selectedReportDriver}
              onChange={(e) => setSelectedReportDriver(e.target.value)}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2">
              <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" /> Filter Type
            </label>
            <select 
              className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-xs md:text-sm"
              value={selectedMonth ? 'month' : 'period'}
              onChange={(e) => {
                if (e.target.value === 'month') {
                  setSelectedMonth('1');
                } else {
                  setSelectedMonth('');
                }
              }}
            >
              <option value="period">By Period</option>
              <option value="month">By Month</option>
            </select>
          </div>
          {!selectedMonth ? (
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2">
                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" /> Report Period
              </label>
              <select 
                className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-xs md:text-sm"
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
          ) : (
            <>
              <div>
                <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2">
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" /> Month
                </label>
                <select 
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-xs md:text-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1.5 md:mb-2 flex items-center gap-1.5 md:gap-2">
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" /> Year
                </label>
                <select 
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-xs md:text-sm"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <label className="block text-xs md:text-sm font-medium text-zinc-700 mb-1.5 md:mb-2">
              &nbsp;
            </label>
            <button 
              onClick={generateReport}
              disabled={loading}
              className="w-full px-4 md:px-6 py-2 md:py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl flex items-center justify-center gap-2 transition-all text-xs md:text-sm font-medium disabled:opacity-50"
            >
              <Filter className="w-3.5 h-3.5 md:w-4 md:h-4" /> {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>
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
