import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react';

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

export default function GoogleSheetsImport() {
  const [mappedImportData, setMappedImportData] = useState<ImportData>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState<{
    drivers: { success: number; errors: string[] };
    rickshaws: { success: number; errors: string[] };
    transactions: { success: number; errors: string[] };
  }>({ drivers: { success: 0, errors: [] }, rickshaws: { success: 0, errors: [] }, transactions: { success: 0, errors: [] } });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file) {
      alert('Please select a file to import');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file (.csv extension required)');
      return;
    }

    setIsProcessing(true);
    setImportResults({ drivers: { success: 0, errors: [] }, rickshaws: { success: 0, errors: [] }, transactions: { success: 0, errors: [] } });

    try {
      console.log('Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File appears to be empty or invalid');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      console.log('Parsed headers:', headers);
      console.log('Data rows count:', data.length);

      analyzeAndMapData(data, headers);
    } catch (error) {
      console.error('Error processing file:', error);
      alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeAndMapData = (data: any[], headers: string[]) => {
    const mappedData: ImportData = {
      drivers: [],
      rickshaws: [],
      transactions: []
    };

    // Try to identify the data type based on headers
    const hasDriverFields = headers.some(h => ['name', 'driver', 'driver_name'].includes(h));
    const hasRickshawFields = headers.some(h => ['rickshaw', 'number', 'rickshaw_number'].includes(h));
    const hasTransactionFields = headers.some(h => ['amount', 'date', 'type', 'category'].includes(h));

    if (hasDriverFields && !hasTransactionFields) {
      // Map as drivers data
      mappedData.drivers = data.map(row => ({
        name: row.name || row.driver_name || row.driver || '',
        phone: row.phone || '',
        join_date: row.join_date || row.date || new Date().toISOString().split('T')[0]
      })).filter(d => d.name);
    }

    if (hasRickshawFields && !hasTransactionFields) {
      // Map as rickshaws data
      mappedData.rickshaws = data.map(row => ({
        number: row.number || row.rickshaw_number || row.rickshaw || '',
        purchase_date: row.purchase_date || row.date || new Date().toISOString().split('T')[0],
        investment_cost: parseFloat(row.investment_cost || row.cost || row.amount || '0')
      })).filter(r => r.number);
    }

    if (hasTransactionFields) {
      // Map as transactions data
      mappedData.transactions = data.map(row => ({
        date: row.date || new Date().toISOString().split('T')[0],
        type: (row.type?.toLowerCase() === 'expense' || row.category?.toLowerCase().includes('fuel') || row.category?.toLowerCase().includes('maintenance') ? 'expense' : 
               (row.type?.toLowerCase() === 'pending' || row.category?.toLowerCase().includes('pending')) ? 'pending' : 'income') as 'income' | 'expense' | 'pending',
        category: row.category || 'other',
        amount: parseFloat(row.amount || '0'),
        rickshaw_number: row.rickshaw_number || row.rickshaw || undefined,
        driver_name: row.driver_name || row.driver || undefined,
        notes: row.notes || row.description || ''
      })).filter(t => t.amount > 0);
    }

    setMappedImportData(mappedData);
  };

  const importDataToDatabase = async () => {
    setIsProcessing(true);
    const results = {
      drivers: { success: 0, errors: [] },
      rickshaws: { success: 0, errors: [] },
      transactions: { success: 0, errors: [] }
    };

    try {
      const token = localStorage.getItem('auth_token');
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      // Import drivers
      if (mappedImportData.drivers?.length) {
        for (const driver of mappedImportData.drivers) {
          try {
            const response = await fetch('/api/drivers', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(driver)
            });
            
            if (response.ok) {
              results.drivers.success++;
            } else {
              const error = await response.json();
              results.drivers.errors.push(`Failed to import driver ${driver.name}: ${error.error}`);
            }
          } catch (error) {
            results.drivers.errors.push(`Failed to import driver ${driver.name}: ${error}`);
          }
        }
      }

      // Import rickshaws
      if (mappedImportData.rickshaws?.length) {
        for (const rickshaw of mappedImportData.rickshaws) {
          try {
            const response = await fetch('/api/rickshaws', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(rickshaw)
            });
            
            if (response.ok) {
              results.rickshaws.success++;
            } else {
              const error = await response.json();
              results.rickshaws.errors.push(`Failed to import rickshaw ${rickshaw.number}: ${error.error}`);
            }
          } catch (error) {
            results.rickshaws.errors.push(`Failed to import rickshaw ${rickshaw.number}: ${error}`);
          }
        }
      }

      // Import transactions
      if (mappedImportData.transactions?.length) {
        for (const transaction of mappedImportData.transactions) {
          try {
            // Get driver and rickshaw IDs if names are provided
            let driverId = null;
            let rickshawId = null;

            if (transaction.driver_name) {
              const driversResponse = await fetch('/api/drivers', { headers: authHeaders });
              const drivers = await driversResponse.json();
              if (Array.isArray(drivers)) {
                const driver = drivers.find((d: any) => d.name.toLowerCase() === transaction.driver_name?.toLowerCase());
                driverId = driver ? driver.id : null;
              }
            }

            if (transaction.rickshaw_number) {
              const rickshawsResponse = await fetch('/api/rickshaws', { headers: authHeaders });
              const rickshaws = await rickshawsResponse.json();
              if (Array.isArray(rickshaws)) {
                const rickshaw = rickshaws.find((r: any) => r.number.toLowerCase() === transaction.rickshaw_number?.toLowerCase());
                rickshawId = rickshaw ? rickshaw.id : null;
              }
            }

            const transactionData = {
              date: transaction.date,
              type: transaction.type,
              category: transaction.category,
              amount: transaction.amount,
              rickshaw_id: rickshawId,
              driver_id: driverId,
              notes: transaction.notes
            };

            const response = await fetch('/api/transactions', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(transactionData)
            });
            
            if (response.ok) {
              results.transactions.success++;
            } else {
              const error = await response.json();
              results.transactions.errors.push(`Failed to import transaction: ${error.error}`);
            }
          } catch (error) {
            results.transactions.errors.push(`Failed to import transaction: ${error}`);
          }
        }
      }

      setImportResults(results);
      
      if (results.drivers.success > 0 || results.rickshaws.success > 0 || results.transactions.success > 0) {
        alert(`Import completed successfully!\nDrivers: ${results.drivers.success}\nRickshaws: ${results.rickshaws.success}\nTransactions: ${results.transactions.success}`);
      }
    } catch (error) {
      alert(`Import failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const template = `name,phone,join_date
John Doe,0300-1234567,2024-01-15
Jane Smith,0300-9876543,2024-02-20

rickshaw_number,purchase_date,investment_cost
RS-001,2024-01-01,150000
RS-002,2024-02-15,120000

date,type,category,amount,rickshaw_number,driver_name,notes
2024-01-15,income,rent,15000,RS-001,John Doe,Monthly rent
2024-01-20,expense,fuel,2000,RS-001,John Doe,Fuel expense
2024-01-25,expense,maintenance,3000,RS-001,John Doe,Regular maintenance`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rickshaw-manager-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <Upload className="w-8 h-8 text-zinc-600" />
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Import from Google Sheets</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Import from Google Sheets</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Open your Google Sheet</li>
          <li>Click <strong>File → Download → Comma-separated values (.csv)</strong></li>
          <li>Save the CSV file to your computer</li>
          <li>Upload the CSV file using the uploader below</li>
          <li>Review the mapped data and click "Import Data"</li>
        </ol>
      </div>

      {/* File Upload Area */}
      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-300 bg-zinc-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-zinc-900 mb-2">
          {isDragging ? 'Drop your file here' : 'Drag & Drop CSV File Here'}
        </h3>
        <p className="text-sm text-zinc-600 mb-4">or</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileUpload}
          className="hidden"
          id="csv-file-input"
        />
        <button
          onClick={() => {
            console.log('Browse button clicked');
            fileInputRef.current?.click();
          }}
          className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
        >
          <Upload className="w-4 h-4" />
          Browse Files
        </button>
      </div>

      {/* Template Download */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Download Template</h3>
        <p className="text-sm text-zinc-600 mb-4">
          Not sure about the format? Download our template file to see the expected structure.
        </p>
        <button
          onClick={downloadTemplate}
          className="px-6 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors font-medium flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download CSV Template
        </button>
      </div>

      {/* Data Preview */}
      {Object.keys(mappedImportData).some(key => mappedImportData[key as keyof ImportData]?.length > 0) && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">Data Preview</h3>
          
          {mappedImportData.drivers?.length > 0 && (
            <div className="mb-6">
              <h4 className="text-base font-medium text-emerald-600 mb-3">Drivers ({mappedImportData.drivers.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-zinc-200">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Name</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Phone</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Join Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedImportData.drivers.slice(0, 5).map((driver, index) => (
                      <tr key={index}>
                        <td className="border border-zinc-200 px-4 py-2">{driver.name}</td>
                        <td className="border border-zinc-200 px-4 py-2">{driver.phone}</td>
                        <td className="border border-zinc-200 px-4 py-2">{driver.join_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedImportData.drivers.length > 5 && (
                  <p className="text-sm text-zinc-500 mt-2">... and {mappedImportData.drivers.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          {mappedImportData.rickshaws?.length > 0 && (
            <div className="mb-6">
              <h4 className="text-base font-medium text-blue-600 mb-3">Rickshaws ({mappedImportData.rickshaws.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-zinc-200">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Number</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Purchase Date</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Investment Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedImportData.rickshaws.slice(0, 5).map((rickshaw, index) => (
                      <tr key={index}>
                        <td className="border border-zinc-200 px-4 py-2">{rickshaw.number}</td>
                        <td className="border border-zinc-200 px-4 py-2">{rickshaw.purchase_date}</td>
                        <td className="border border-zinc-200 px-4 py-2">Rs. {rickshaw.investment_cost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedImportData.rickshaws.length > 5 && (
                  <p className="text-sm text-zinc-500 mt-2">... and {mappedImportData.rickshaws.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          {mappedImportData.transactions?.length > 0 && (
            <div className="mb-6">
              <h4 className="text-base font-medium text-purple-600 mb-3">Transactions ({mappedImportData.transactions.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-zinc-200">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Date</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Type</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Category</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Amount</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Rickshaw</th>
                      <th className="border border-zinc-200 px-4 py-2 text-left">Driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedImportData.transactions.slice(0, 5).map((transaction, index) => (
                      <tr key={index}>
                        <td className="border border-zinc-200 px-4 py-2">{transaction.date}</td>
                        <td className="border border-zinc-200 px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            transaction.type === 'income' ? 'bg-emerald-100 text-emerald-700' :
                            transaction.type === 'expense' ? 'bg-rose-100 text-rose-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="border border-zinc-200 px-4 py-2">{transaction.category}</td>
                        <td className="border border-zinc-200 px-4 py-2">Rs. {transaction.amount.toLocaleString()}</td>
                        <td className="border border-zinc-200 px-4 py-2">{transaction.rickshaw_number || '-'}</td>
                        <td className="border border-zinc-200 px-4 py-2">{transaction.driver_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedImportData.transactions.length > 5 && (
                  <p className="text-sm text-zinc-500 mt-2">... and {mappedImportData.transactions.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={importDataToDatabase}
              disabled={isProcessing}
              className="px-8 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium disabled:bg-zinc-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import Data
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Import Results */}
      {(importResults.drivers.success > 0 || importResults.rickshaws.success > 0 || importResults.transactions.success > 0) && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200/60">
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">Import Results</h3>
          
          <div className="space-y-4">
            {importResults.drivers.success > 0 && (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <span>Successfully imported {importResults.drivers.success} drivers</span>
              </div>
            )}
            
            {importResults.rickshaws.success > 0 && (
              <div className="flex items-center gap-2 text-blue-600">
                <CheckCircle className="w-5 h-5" />
                <span>Successfully imported {importResults.rickshaws.success} rickshaws</span>
              </div>
            )}
            
            {importResults.transactions.success > 0 && (
              <div className="flex items-center gap-2 text-purple-600">
                <CheckCircle className="w-5 h-5" />
                <span>Successfully imported {importResults.transactions.success} transactions</span>
              </div>
            )}

            {(importResults.drivers.errors.length > 0 || importResults.rickshaws.errors.length > 0 || importResults.transactions.errors.length > 0) && (
              <div className="mt-4">
                <h4 className="text-base font-medium text-rose-600 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Errors
                </h4>
                <div className="space-y-1 text-sm text-rose-600">
                  {importResults.drivers.errors.map((error, index) => (
                    <div key={`driver-error-${index}`}>{error}</div>
                  ))}
                  {importResults.rickshaws.errors.map((error, index) => (
                    <div key={`rickshaw-error-${index}`}>{error}</div>
                  ))}
                  {importResults.transactions.errors.map((error, index) => (
                    <div key={`transaction-error-${index}`}>{error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
