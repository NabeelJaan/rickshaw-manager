import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportData {
  drivers?: Array<{name: string; phone: string; join_date: string}>;
  rickshaws?: Array<{number: string; purchase_date: string; investment_cost: number}>;
  transactions?: Array<{
    date: string;
    type: 'income' | 'expense' | 'pending';
    category: string;
    amount: number;
    rickshaw_number?: string;
    driver_name?: string;
    notes?: string;
  }>;
}

export default function SimpleImport() {
  const [importData, setImportData] = useState<ImportData>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [availableDrivers, setAvailableDrivers] = useState<Array<{id: string, name: string}>>([]);
  const [currency, setCurrency] = useState('Rs.'); // Added this line

  const getCurrentMonthYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  // Load available drivers when component mounts
  React.useEffect(() => {
    // Load currency from settings
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) {
      setCurrency(savedCurrency);
    }
    
    // Listen for storage changes (when settings are updated)
    const handleStorageChange = () => {
      const newCurrency = localStorage.getItem('currency');
      if (newCurrency) {
        setCurrency(newCurrency);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdated', handleStorageChange);
    };
  }, []);

  React.useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/drivers', { headers })
      .then(res => res.json())
      .then(drivers => {
        if (Array.isArray(drivers)) {
          setAvailableDrivers(drivers);
          // Try to find "Waseem" automatically
          const waseem = drivers.find((d: any) => d.name.toLowerCase().includes('waseem'));
          if (waseem) {
            setSelectedDriver(waseem.id);
          }
        }
      })
      .catch(err => console.error('Failed to load drivers:', err));
  }, []);

  const handleTestClick = () => {
    alert('SimpleImport test button is working!');
    console.log('SimpleImport button clicked');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.size, file.type);
    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        console.log('Raw file content (first 1000 chars):', text.substring(0, 1000));
        console.log('File content length:', text.length);
        
        const lines = text.split('\n').filter(line => line.trim());
        console.log('Total lines:', lines.length);
        
        if (lines.length < 2) {
          alert('File is empty or invalid');
          setIsProcessing(false);
          return;
        }

        // Your CSV has months side-by-side in columns
        const allTransactions = [];
        
        // Define the month sections based on your actual CSV format
        const monthSections = [
          { name: 'October', year: 2025, month: 10, startCol: 0, hasRemarks: false },
          { name: 'November', year: 2025, month: 11, startCol: 6, hasRemarks: false },
          { name: 'December', year: 2025, month: 12, startCol: 12, hasRemarks: true },
          { name: 'January', year: 2026, month: 1, startCol: 18, hasRemarks: true },
          { name: 'February', year: 2026, month: 2, startCol: 24, hasRemarks: true },
          { name: 'March', year: 2026, month: 3, startCol: 30, hasRemarks: true }
        ];
        
        // Find the header line with all the column names
        let headerLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          console.log('Line', i, ':', lines[i]);
          if (lines[i].includes('Date,Rent Paid,Rent Pending,Rickshaw Work,Net Profit')) {
            headerLineIndex = i;
            console.log('Found header at line', i, ':', lines[i]);
            break;
          }
        }
        
        if (headerLineIndex === -1) {
          alert('Could not find header line in CSV file');
          setIsProcessing(false);
          return;
        }
        
        console.log('Found header line at index:', headerLineIndex);
        
        // Let's examine the header line structure
        const headerLine = lines[headerLineIndex];
        const headerParts = headerLine.split(',').map(p => p.trim());
        console.log('Header parts count:', headerParts.length);
        console.log('Header parts:', headerParts);
        
        // Show the first few data lines to understand the structure
        console.log('=== First 3 data lines ===');
        for (let i = headerLineIndex + 1; i < Math.min(headerLineIndex + 4, lines.length); i++) {
          const line = lines[i];
          const parts = line.split(',').map(p => p.trim());
          console.log('Data line', i, 'parts count:', parts.length);
          console.log('Data line', i, ':', parts);
        }
        
        // Process data lines (skip header and total lines)
        for (let i = headerLineIndex + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          console.log('Processing data line:', i, line);
          
          // Skip empty lines, total lines, and separator lines
          if (!line || line.includes('Total') || line.includes('====') || line === '' || line.split(',').filter(p => p.trim()).length <= 1) {
            console.log('Skipping line (empty/total/separator):', line);
            continue;
          }
          
          // Split the line into parts
          const parts = line.split(',').map(p => p.trim());
          console.log('Line parts:', parts);
          
          // Get the day number (first column)
          const dayNum = parseInt(parts[0]);
          if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
            console.log('Skipping line - invalid day number:', parts[0]);
            continue;
          }
          
          console.log('Processing day:', dayNum);
          
          // Process each month section
          for (const section of monthSections) {
            console.log('Processing month:', section.name, section.year, 'startCol:', section.startCol);
            
            // Calculate the actual column indices for this month
            const dateCol = section.startCol;
            const rentPaidCol = section.startCol + 1;
            const rentPendingCol = section.startCol + 2;
            const rickshawWorkCol = section.startCol + 3;
            const netProfitCol = section.startCol + 4;
            const remarksCol = section.hasRemarks ? section.startCol + 5 : -1;
            
            // Check if this month has data for this day
            if (parts.length > rentPaidCol) {
              const rentPaid = parseFloat(parts[rentPaidCol]) || 0;
              const rentPending = parseFloat(parts[rentPendingCol]) || 0;
              const rickshawWork = parseFloat(parts[rickshawWorkCol]) || 0;
              const netProfit = parseFloat(parts[netProfitCol]) || 0;
              const remarks = remarksCol >= 0 && parts[remarksCol] ? parts[remarksCol] : '';
              
              console.log(`${section.name} amounts - Rent Paid:`, rentPaid, 'Rent Pending:', rentPending, 'Rickshaw Work:', rickshawWork, 'Net Profit:', netProfit, 'Remarks:', remarks);
              
              // Create proper date format
              const transactionDate = `${section.year}-${section.month.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
              
              // Create transactions for any non-zero amounts with proper types
              if (rentPaid > 0) {
                allTransactions.push({
                  date: transactionDate,
                  type: 'income' as const,
                  category: 'rent',
                  amount: rentPaid,
                  rickshaw_number: undefined,
                  driver_name: undefined,
                  notes: `Rent paid - ${section.name} ${section.year}${remarks ? ' - ' + remarks : ''}`,
                  driver_id: selectedDriver
                });
              }
              
              if (rentPending > 0) {
                allTransactions.push({
                  date: transactionDate,
                  type: 'pending' as const,
                  category: 'rent',
                  amount: rentPending,
                  rickshaw_number: undefined,
                  driver_name: undefined,
                  notes: `Rent pending - ${section.name} ${section.year}${remarks ? ' - ' + remarks : ''}`,
                  driver_id: selectedDriver
                });
              }
              
              if (rickshawWork > 0) {
                allTransactions.push({
                  date: transactionDate,
                  type: 'income' as const,
                  category: 'rickshaw work',
                  amount: rickshawWork,
                  rickshaw_number: undefined,
                  driver_name: undefined,
                  notes: `Rickshaw work - ${section.name} ${section.year}${remarks ? ' - ' + remarks : ''}`,
                  driver_id: selectedDriver
                });
              }
              
              if (netProfit > 0) {
                allTransactions.push({
                  date: transactionDate,
                  type: 'income' as const,
                  category: 'net profit',
                  amount: netProfit,
                  rickshaw_number: undefined,
                  driver_name: undefined,
                  notes: `Net profit - ${section.name} ${section.year}${remarks ? ' - ' + remarks : ''}`,
                  driver_id: selectedDriver
                });
              }
              
              // Handle expenses from remarks - look for expense indicators
              if (remarks && remarks.trim()) {
                // Check if this remark indicates an expense
                const expenseKeywords = ['oil', 'timing chain', 'chain', 'bearing', 'break', 'tube', 'repair', 'service', 'parts'];
                const isExpense = expenseKeywords.some(keyword => remarks.toLowerCase().includes(keyword));
                
                if (isExpense) {
                  // Try to extract expense amount from the data
                  // Look for additional amounts that might be expenses
                  let expenseAmount = 0;
                  
                  // Check if there are amounts in other columns that could be expenses
                  for (let j = rentPaidCol; j < parts.length; j++) {
                    if (j !== rentPaidCol && j !== rentPendingCol && j !== rickshawWorkCol && j !== netProfitCol) {
                      const amount = parseFloat(parts[j]) || 0;
                      if (amount > 0) {
                        expenseAmount += amount;
                      }
                    }
                  }
                  
                  // If we found expense amounts, create expense transactions
                  if (expenseAmount > 0) {
                    allTransactions.push({
                      date: transactionDate,
                      type: 'expense' as const,
                      category: 'maintenance',
                      amount: expenseAmount,
                      rickshaw_number: undefined,
                      driver_name: undefined,
                      notes: `Expense - ${remarks} - ${section.name} ${section.year}`,
                      driver_id: selectedDriver
                    });
                    console.log(`Created expense transaction: ${expenseAmount} for ${remarks}`);
                  } else {
                    // Create a 0-amount expense transaction just for tracking
                    allTransactions.push({
                      date: transactionDate,
                      type: 'expense' as const,
                      category: 'maintenance',
                      amount: 0,
                      rickshaw_number: undefined,
                      driver_name: undefined,
                      notes: `Expense note - ${remarks} - ${section.name} ${section.year}`,
                      driver_id: selectedDriver
                    });
                    console.log(`Created expense note: ${remarks}`);
                  }
                }
              }
            }
          }
        }
        
        console.log('Total transactions found:', allTransactions.length);
        console.log('Sample transactions:', allTransactions.slice(0, 10));
        
        // Group transactions by month to see what we got
        const transactionsByMonth: { [key: string]: any[] } = {};
        allTransactions.forEach(tx => {
          const monthKey = tx.date.substring(0, 7); // YYYY-MM
          if (!transactionsByMonth[monthKey]) {
            transactionsByMonth[monthKey] = [];
          }
          transactionsByMonth[monthKey].push(tx);
        });
        console.log('Transactions by month:', transactionsByMonth);

        const mappedData: ImportData = {
          drivers: [],
          rickshaws: [],
          transactions: allTransactions
        };

        console.log('Final mapped data:', mappedData);
        setImportData(mappedData);
        setIsProcessing(false);
        
        // Create summary message
        const monthSummary = Object.entries(transactionsByMonth).map(([month, txs]) => `${month}: ${txs.length} transactions`).join(', ');
        alert(`File processed successfully!\nFound ${allTransactions.length} total transactions\n${monthSummary}\n\nCheck console for detailed parsing info.`);
      } catch (error) {
        console.error('Error processing file:', error);
        alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsProcessing(false);
      }
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    console.log('=== IMPORT DEBUG START ===');
    console.log('Import data object:', importData);
    console.log('Drivers length:', importData.drivers?.length || 0);
    console.log('Rickshaws length:', importData.rickshaws?.length || 0);
    console.log('Transactions length:', importData.transactions?.length || 0);
    console.log('Selected driver:', selectedDriver);
    console.log('Available drivers:', availableDrivers);
    
    const driverName = availableDrivers.find(d => d.id.toString() === selectedDriver.toString())?.name || 'Unknown';
    console.log('Resolved driver name:', driverName);
    console.log('Available drivers with IDs:', availableDrivers.map(d => ({ id: d.id, name: d.name, type: typeof d.id })));
    console.log('Selected driver ID:', selectedDriver, 'type:', typeof selectedDriver);
    
    if (!selectedDriver) {
      alert('Please select a driver before importing data.');
      return;
    }
    
    if (!importData.drivers?.length && !importData.rickshaws?.length && !importData.transactions?.length) {
      alert('No data to import. Please upload a CSV file first.\n\nDebug info:\n' + JSON.stringify(importData, null, 2));
      return;
    }

    alert(`Starting import for ${driverName}:\nDrivers: ${importData.drivers?.length || 0}\nRickshaws: ${importData.rickshaws?.length || 0}\nTransactions: ${importData.transactions?.length || 0}`);
    
    setIsProcessing(true);
    
    try {
      // Import drivers
      const token = localStorage.getItem('auth_token');
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      if (importData.drivers?.length) {
        console.log('Importing drivers...');
        for (const driver of importData.drivers) {
          console.log('Importing driver:', driver);
          const response = await fetch('/api/drivers', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(driver)
          });
          
          if (response.ok) {
            console.log('✅ Driver imported:', driver.name);
          } else {
            const error = await response.json();
            console.error('❌ Failed to import driver:', driver.name, error);
          }
        }
      }

      // Import rickshaws
      if (importData.rickshaws?.length) {
        console.log('Importing rickshaws...');
        for (const rickshaw of importData.rickshaws) {
          console.log('Importing rickshaw:', rickshaw);
          const response = await fetch('/api/rickshaws', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(rickshaw)
          });
          
          if (response.ok) {
            console.log('✅ Rickshaw imported:', rickshaw.number);
          } else {
            const error = await response.json();
            console.error('❌ Failed to import rickshaw:', rickshaw.number, error);
          }
        }
      }

      // Import transactions
      if (importData.transactions?.length) {
        console.log('Importing transactions...');
        console.log('Selected driver ID:', selectedDriver);
        console.log('Available drivers:', availableDrivers);
        
        for (const transaction of importData.transactions) {
          console.log('Importing transaction:', transaction);
          const transactionData = {
            ...transaction,
            driver_id: selectedDriver
          };
          console.log('Sending transaction data:', transactionData);
          
          const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(transactionData)
          });
          
          if (response.ok) {
            console.log('✅ Transaction imported for', driverName, ':', transaction.date, transaction.amount);
          } else {
            const error = await response.json();
            console.error('❌ Failed to import transaction:', transaction.date, error);
          }
        }
      }

      console.log('=== IMPORT DEBUG END ===');
      alert(`Import completed for ${driverName}! Check console for detailed results.\nYou can now view the data in the Dashboard and Transactions tabs.`);
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center gap-4 mb-8">
        <Upload className="w-8 h-8 text-zinc-600" />
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Simple CSV Import</h2>
      </div>

      {/* Driver Selection */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Select Driver</h3>
        <select
          value={selectedDriver}
          onChange={(e) => setSelectedDriver(e.target.value)}
          className="w-full px-4 py-3 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">Select a driver...</option>
          {availableDrivers.map(driver => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
        {selectedDriver && (
          <p className="mt-2 text-sm text-emerald-600">
            ✓ Transactions will be assigned to: {availableDrivers.find(d => d.id === selectedDriver)?.name}
          </p>
        )}
      </div>

      {/* Test Button */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Test Button Function</h3>
        <button
          onClick={handleTestClick}
          className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
        >
          Test SimpleImport Button
        </button>
      </div>

      {/* File Upload */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Select CSV File</h3>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileUpload}
          className="w-full px-4 py-3 border border-zinc-300 rounded-lg text-sm"
          disabled={isProcessing}
        />
        {isProcessing && <p className="mt-2 text-sm text-zinc-600">Processing file...</p>}
      </div>

      {/* Data Preview */}
      {(importData.drivers?.length > 0 || importData.rickshaws?.length > 0 || importData.transactions?.length > 0) && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">Data Preview</h3>
          
          {importData.drivers?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-base font-medium text-emerald-600 mb-2">Drivers ({importData.drivers.length})</h4>
              <div className="text-sm text-zinc-600">
                {importData.drivers.slice(0, 3).map((driver, index) => (
                  <div key={index}>• {driver.name} ({driver.phone})</div>
                ))}
                {importData.drivers.length > 3 && <div>... and {importData.drivers.length - 3} more</div>}
              </div>
            </div>
          )}

          {importData.rickshaws?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-base font-medium text-blue-600 mb-2">Rickshaws ({importData.rickshaws.length})</h4>
              <div className="text-sm text-zinc-600">
                {importData.rickshaws.slice(0, 3).map((rickshaw, index) => (
                  <div key={index}>• {rickshaw.number} - {currency} {rickshaw.investment_cost.toLocaleString()}</div>
                ))}
                {importData.rickshaws.length > 3 && <div>... and {importData.rickshaws.length - 3} more</div>}
              </div>
            </div>
          )}

          {importData.transactions?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-base font-medium text-purple-600 mb-2">Transactions ({importData.transactions.length})</h4>
              <div className="text-sm text-zinc-600">
                {importData.transactions.slice(0, 3).map((transaction, index) => (
                  <div key={index}>• {transaction.date} - {transaction.type} - {currency} {transaction.amount.toLocaleString()}</div>
                ))}
                {importData.transactions.length > 3 && <div>... and {importData.transactions.length - 3} more</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Button */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Import Data</h3>
        <button
          onClick={handleImport}
          disabled={isProcessing}
          className="px-8 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium disabled:bg-zinc-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Import Data'}
        </button>
      </div>
    </div>
  );
}
