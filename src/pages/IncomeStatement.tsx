import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatAmount } from '../utils/accounting'
import { exportToPdf } from '../utils/pdfExport'
import { logoBase64 } from '../../logoBase64'
import { FileText, TrendingUp } from 'lucide-react'

interface AccountBalance {
  code: string
  name: string
  type: string
  balance: number
}

export default function IncomeStatement() {
  const [loading, setLoading] = useState(true)
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch journal entries to calculate account balances
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select(`
          *,
          debit_account:debit_account_id(code, name, type),
          credit_account:credit_account_id(code, name, type)
        `)
        .gte('date', startDate || '1900-01-01')
        .lte('date', endDate || '2099-12-31')

      // Calculate balances for income and expense accounts
      const balanceMap: Record<string, { name: string; type: string; debit: number; credit: number }> = {}

      journalEntries?.forEach(entry => {
        const debitAccount = entry.debit_account
        const creditAccount = entry.credit_account
        const amount = parseFloat(entry.amount || '0')

        // Process debit account
        if (debitAccount && (debitAccount.type === 'income' || debitAccount.type === 'expense')) {
          if (!balanceMap[debitAccount.code]) {
            balanceMap[debitAccount.code] = {
              name: debitAccount.name,
              type: debitAccount.type,
              debit: 0,
              credit: 0
            }
          }
          balanceMap[debitAccount.code].debit += amount
        }

        // Process credit account
        if (creditAccount && (creditAccount.type === 'income' || creditAccount.type === 'expense')) {
          if (!balanceMap[creditAccount.code]) {
            balanceMap[creditAccount.code] = {
              name: creditAccount.name,
              type: creditAccount.type,
              debit: 0,
              credit: 0
            }
          }
          balanceMap[creditAccount.code].credit += amount
        }
      })

      // Convert to account balances
      const balances: AccountBalance[] = Object.entries(balanceMap).map(([code, data]) => ({
        code,
        name: data.name,
        type: data.type,
        balance: data.type === 'income' ? data.credit - data.debit : data.debit - data.credit
      }))

      setAccountBalances(balances)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const { revenue, expenses, grossProfit, netProfit } = useMemo(() => {
    const revenue = accountBalances
      .filter(acc => acc.type === 'income')
      .reduce((sum, acc) => sum + Math.max(0, acc.balance), 0)

    const expenses = accountBalances
      .filter(acc => acc.type === 'expense')
      .reduce((sum, acc) => sum + Math.max(0, acc.balance), 0)

    const grossProfit = revenue
    const netProfit = revenue - expenses

    return { revenue, expenses, grossProfit, netProfit }
  }, [accountBalances])

  const handleExportPdf = () => {
    const headers = ['Keterangan', 'Jumlah']
    const rows = [
      ['PENDAPATAN', ''],
      ...accountBalances
        .filter(acc => acc.type === 'income' && acc.balance > 0)
        .map(acc => [`  ${acc.name} (${acc.code})`, formatAmount(acc.balance)]),
      ['Total Pendapatan', formatAmount(revenue)],
      ['', ''],
      ['BEBAN', ''],
      ...accountBalances
        .filter(acc => acc.type === 'expense' && acc.balance > 0)
        .map(acc => [`  ${acc.name} (${acc.code})`, formatAmount(acc.balance)]),
      ['Total Beban', formatAmount(expenses)],
      ['', ''],
      ['LABA BERSIH', formatAmount(netProfit)],
    ]

    const subtitle = startDate || endDate ? `Periode ${startDate || '…'} s/d ${endDate || '…'}` : 'Semua periode'

    exportToPdf('Laporan Laba/Rugi', headers, rows, {
      subtitle,
      printedAt: `Dicetak ${new Date().toLocaleString('id-ID')}`,
      logoBase64,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const incomeAccounts = accountBalances.filter(acc => acc.type === 'income' && acc.balance > 0)
  const expenseAccounts = accountBalances.filter(acc => acc.type === 'expense' && acc.balance > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            Laporan Laba/Rugi
          </h1>
          <p className="text-gray-600">Laporan kinerja keuangan berdasarkan akun pendapatan dan beban</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="border p-2 rounded" 
          />
          <span>-</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="border p-2 rounded" 
          />
          <button 
            onClick={handleExportPdf} 
            className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded"
          >
            <FileText className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Pendapatan</p>
              <p className="text-2xl font-bold text-green-600">{formatAmount(revenue)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Beban</p>
              <p className="text-2xl font-bold text-red-600">{formatAmount(expenses)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-500 transform rotate-180" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Laba Bersih</p>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatAmount(netProfit)}
              </p>
            </div>
            <TrendingUp className={`w-8 h-8 ${netProfit >= 0 ? 'text-green-500' : 'text-red-500 transform rotate-180'}`} />
          </div>
        </div>
      </div>

      {/* Income Statement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Laporan Laba/Rugi</h3>
          {(startDate || endDate) && (
            <p className="text-sm text-gray-600 mt-1">
              Periode {startDate || '…'} s/d {endDate || '…'}
            </p>
          )}
        </div>
        
        <div className="p-6">
          <table className="min-w-full">
            <tbody className="divide-y divide-gray-200">
              {/* Revenue Section */}
              <tr className="bg-green-50">
                <td className="py-3 font-bold text-green-800">PENDAPATAN</td>
                <td className="py-3 text-right font-bold text-green-800"></td>
              </tr>
              {incomeAccounts.map(account => (
                <tr key={account.code}>
                  <td className="py-2 pl-6">{account.name} ({account.code})</td>
                  <td className="py-2 text-right">{formatAmount(account.balance)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 font-semibold bg-green-50">
                <td className="py-3 text-green-800">Total Pendapatan</td>
                <td className="py-3 text-right text-green-800">{formatAmount(revenue)}</td>
              </tr>

              {/* Spacer */}
              <tr>
                <td className="py-2"></td>
                <td className="py-2"></td>
              </tr>

              {/* Expenses Section */}
              <tr className="bg-red-50">
                <td className="py-3 font-bold text-red-800">BEBAN</td>
                <td className="py-3 text-right font-bold text-red-800"></td>
              </tr>
              {expenseAccounts.map(account => (
                <tr key={account.code}>
                  <td className="py-2 pl-6">{account.name} ({account.code})</td>
                  <td className="py-2 text-right">{formatAmount(account.balance)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 font-semibold bg-red-50">
                <td className="py-3 text-red-800">Total Beban</td>
                <td className="py-3 text-right text-red-800">{formatAmount(expenses)}</td>
              </tr>

              {/* Net Profit */}
              <tr className={`border-t-4 border-gray-400 font-bold text-lg ${netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <td className={`py-4 ${netProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  LABA BERSIH
                </td>
                <td className={`py-4 text-right ${netProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {formatAmount(netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}