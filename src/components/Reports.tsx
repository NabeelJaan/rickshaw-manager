import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Download, TrendingUp, TrendingDown, DollarSign, Car, Users, Filter, AlertCircle, Star } from 'lucide-react';
import { Driver, Transaction } from '../types';

export default function Reports({ selectedDriverId }: { selectedDriverId?: string }) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedReportDriver, setSelectedReportDriver] = useState<string>(selectedDriverId || '');
  const [reportPeriod, setReportPeriod] = useState<string>('1month');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
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
    // Pending uses driver's pending_balance (cumulative, only increases when entries added)
    const pending = selectedReportDriver
      ? (drivers.find(d => String(d.id) === String(selectedReportDriver))?.pending_balance || 0)
      : drivers.reduce((sum, d) => sum + (d.pending_balance || 0), 0);
    const profit = income - expense;

    return { income, expense, pending, profit };
  };

  const stats = calculateStats();

  // Calculate top driver by profit
  const calculateTopDriver = () => {
    if (selectedReportDriver) return null; // Don't show when single driver selected
    
    const driverProfits = new Map<string, { income: number; expense: number; profit: number }>();
    
    transactions.forEach(t => {
      if (!t.driver_name) return;
      const existing = driverProfits.get(t.driver_name) || { income: 0, expense: 0, profit: 0 };
      
      if (t.type === 'income' && t.category !== 'rent_pending') {
        existing.income += t.amount;
      } else if (t.type === 'expense') {
        existing.expense += t.amount;
      }
      existing.profit = existing.income - existing.expense;
      driverProfits.set(t.driver_name, existing);
    });
    
    let topDriver = null;
    let maxProfit = -Infinity;
    
    driverProfits.forEach((data, name) => {
      if (data.profit > maxProfit) {
        maxProfit = data.profit;
        topDriver = { name, ...data };
      }
    });
    
    return topDriver;
  };

  const topDriver = calculateTopDriver();

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
    <div className="space-y-6 md:space-y-8">
      {/* Header - Clean Apple Style */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[28px] md:text-[34px] font-semibold text-zinc-900 tracking-tight">Reports</h1>
          <p className="text-[13px] md:text-[15px] text-zinc-500 mt-1">Analyze performance and export data</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => exportReport('csv')}
            className="px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-900 rounded-full flex items-center gap-2 transition-all text-[13px] font-medium border border-zinc-200 shadow-sm hover:shadow-md"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
          <button 
            onClick={() => exportReport('json')}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full flex items-center gap-2 transition-all text-[13px] font-medium shadow-sm hover:shadow-md"
          >
            <Download className="w-4 h-4" /> JSON
          </button>
        </div>
      </div>

      {/* Report Filters - Apple Style */}
      <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-zinc-100 p-5 md:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-zinc-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Driver
            </label>
            <select 
              className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px] font-medium text-zinc-900 outline-none"
              value={selectedReportDriver}
              onChange={(e) => setSelectedReportDriver(e.target.value)}
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-zinc-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Filter Type
            </label>
            <select
              className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px] font-medium text-zinc-900 outline-none"
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
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Period
              </label>
              <select 
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px] font-medium text-zinc-900 outline-none"
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
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-zinc-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Month
                </label>
                <select 
                  className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px] font-medium text-zinc-900 outline-none"
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
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-zinc-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Year
                </label>
                <select 
                  className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[13px] font-medium text-zinc-900 outline-none"
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
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-zinc-500">&nbsp;</label>
            <button 
              onClick={generateReport}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl flex items-center justify-center gap-2 transition-all text-[13px] font-medium disabled:opacity-50 shadow-sm"
            >
              <Filter className="w-4 h-4" /> {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards - Apple Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-zinc-100 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-zinc-500">Total Income</p>
            <h3 className="text-[22px] md:text-[26px] font-semibold text-zinc-900 tracking-tight mt-0.5">
              {currency}{stats.income.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-zinc-100 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-rose-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-zinc-500">Total Expense</p>
            <h3 className="text-[22px] md:text-[26px] font-semibold text-zinc-900 tracking-tight mt-0.5">
              {currency}{stats.expense.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-zinc-100 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
            <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-blue-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-zinc-500">Net Profit</p>
            <h3 className={`text-[22px] md:text-[26px] font-semibold tracking-tight mt-0.5 ${stats.profit >= 0 ? 'text-zinc-900' : 'text-rose-600'}`}>
              {stats.profit >= 0 ? '+' : ''}{currency}{stats.profit.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="bg-amber-50/50 p-5 md:p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-amber-100 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] group">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-amber-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-amber-600">Pending Amount</p>
            <h3 className="text-[22px] md:text-[26px] font-semibold text-amber-700 tracking-tight mt-0.5">
              {currency}{stats.pending.toLocaleString()}
            </h3>
          </div>
        </div>

        {topDriver && (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-5 md:p-6 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-yellow-200/60 flex flex-col gap-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] group">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-sm">
                <Star className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" strokeWidth={1.5} />
              </div>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">TOP</span>
            </div>
            <div>
              <p className="text-[13px] font-medium text-amber-600">Top Driver</p>
              <h3 className="text-[18px] md:text-[20px] font-semibold text-amber-900 tracking-tight mt-0.5 truncate">
                {topDriver.name}
              </h3>
              <p className="text-[13px] font-medium text-amber-600 mt-1">
                +{currency}{topDriver.profit.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table - Apple Style */}
      <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] border border-zinc-100 overflow-hidden">
        <div className="px-5 py-4 md:px-6 md:py-5 border-b border-zinc-100">
          <h3 className="text-[17px] font-semibold text-zinc-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-500" strokeWidth={1.5} />
            Transactions
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-5 py-3 md:px-6 md:py-4 text-left text-[12px] font-medium text-zinc-500">Date</th>
                <th className="px-5 py-3 md:px-6 md:py-4 text-left text-[12px] font-medium text-zinc-500">Type</th>
                <th className="px-5 py-3 md:px-6 md:py-4 text-left text-[12px] font-medium text-zinc-500">Category</th>
                <th className="px-5 py-3 md:px-6 md:py-4 text-left text-[12px] font-medium text-zinc-500">Amount</th>
                <th className="px-5 py-3 md:px-6 md:py-4 text-left text-[12px] font-medium text-zinc-500">Driver</th>
                <th className="px-5 py-3 md:px-6 md:py-4 text-left text-[12px] font-medium text-zinc-500">Rickshaw</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 md:px-6 text-center text-[14px] text-zinc-500">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 md:px-6 text-center text-[14px] text-zinc-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className={`transition-colors ${
                    t.category === 'rent_pending' 
                      ? 'bg-amber-50/30' 
                      : 'hover:bg-zinc-50/50'
                  }`}>
                    <td className="px-5 py-3 md:px-6 md:py-4 text-[14px] text-zinc-900">
                      {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 md:px-6 md:py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium ${
                        t.category === 'rent_pending' 
                          ? 'bg-amber-100 text-amber-700' 
                          : t.type === 'income' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-rose-100 text-rose-700'
                      }`}>
                        {t.category === 'rent_pending' ? 'pending' : t.type}
                      </span>
                    </td>
                    <td className={`px-5 py-3 md:px-6 md:py-4 text-[14px] capitalize ${
                      t.category === 'rent_pending' ? 'text-amber-700 font-medium' : 'text-zinc-900'
                    }`}>{t.category.replace('_', ' ')}</td>
                    <td className={`px-5 py-3 md:px-6 md:py-4 text-[14px] font-medium ${
                      t.category === 'rent_pending' 
                        ? 'text-amber-600' 
                        : t.type === 'income' 
                          ? 'text-emerald-600' 
                          : 'text-rose-600'
                    }`}>
                      {t.category === 'rent_pending' ? '+' : t.type === 'income' ? '+' : '-'}{currency}{t.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 md:px-6 md:py-4 text-[14px] text-zinc-600">{t.driver_name || '-'}</td>
                    <td className="px-5 py-3 md:px-6 md:py-4 text-[14px] text-zinc-600">{t.rickshaw_number || '-'}</td>
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
