import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CHART_OF_ACCOUNTS } from '../constants/chartOfAccounts'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'

interface LedgerRow {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  debit: number
  credit: number
  balance: number
}

export default function Ledger() {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [isBalanced, setIsBalanced] = useState(true)

  useEffect(() => {
    fetchLedger()
  }, [startDate, endDate])

  const fetchLedger = async () => {
    try {
      setLoading(true)
      
      // Fetch all journal entries with account information
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select(`
          *,
          debit_account:debit_account_id(code, name, type, normal_balance),
          credit_account:credit_account_id(code, name, type, normal_balance)
        `)
        .gte('date', startDate || '1900-01-01')
        .lte('date', endDate || '2099-12-31')
        .order('date')

      // Initialize ledger with all accounts from chart of accounts
      const ledgerMap: Record<string, LedgerRow> = {}
      
      Object.values(CHART_OF_ACCOUNTS).forEach(account => {
        ledgerMap[account.code] = {
          code: account.code,
          name: account.name,
          type: account.type,
          debit: 0,
          credit: 0,
          balance: 0
        }
      })

      // Process journal entries
      let totalDebits = 0
      let totalCredits = 0

      journalEntries?.forEach(entry => {
        const debitAccount = entry.debit_account
        const creditAccount = entry.credit_account
        const amount = parseFloat(entry.amount || '0')

        totalDebits += amount
        totalCredits += amount

        if (debitAccount && ledgerMap[debitAccount.code]) {
          ledgerMap[debitAccount.code].debit += amount
        }

        if (creditAccount && ledgerMap[creditAccount.code]) {
          ledgerMap[creditAccount.code].credit += amount
        }
      })

      // Check if journal is balanced
      setIsBalanced(Math.abs(totalDebits - totalCredits) < 0.01)

      // Calculate balances based on account type and normal balance
      Object.values(ledgerMap).forEach(account => {
        if (account.type === 'asset' || account.type === 'expense') {
          // Assets and expenses have normal debit balance
          account.balance = account.debit - account.credit
        } else {
          // Liabilities, equity, and income have normal credit balance
          account.balance = account.credit - account.debit
        }
      })

      // Convert to array and sort by account code
      const ledgerRows = Object.values(ledgerMap).sort((a, b) => a.code.localeCompare(b.code))
      
      setRows(ledgerRows)
    } catch (error) {
      console.error('Error fetching ledger:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRecalc = async () => {
    try {
      setLoading(true)
      
      // Call the recalculate function
      const { error } = await supabase.rpc('recalc_balances_rpc')
      if (error) throw error
      
      await fetchLedger()
      alert('Buku besar berhasil diperbarui')
    } catch (error) {
      console.error('Recalc error:', error)
      alert('Gagal memperbarui buku besar')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerateJournals = async () => {
    if (!confirm('Apakah Anda yakin ingin meregenerasi semua jurnal? Ini akan menghapus jurnal yang ada dan membuatnya ulang dari data transaksi.')) {
      return
    }

    try {
      setLoading(true)
      
      // Call the regenerate function
      const { error } = await supabase.rpc('regenerate_journal_entries_rpc')
      if (error) throw error
      
      await fetchLedger()
      alert('Jurnal berhasil diregenerasi dan saldo diperbarui')
    } catch (error) {
      console.error('Regenerate error:', error)
      alert('Gagal meregenerasi jurnal')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(value)

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'asset': return 'text-blue-600'
      case 'liability': return 'text-red-600'
      case 'equity': return 'text-purple-600'
      case 'income': return 'text-green-600'
      case 'expense': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'asset': return 'Aset'
      case 'liability': return 'Kewajiban'
      case 'equity': return 'Ekuitas'
      case 'income': return 'Pendapatan'
      case 'expense': return 'Beban'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  // Group accounts by type
  const groupedAccounts = rows.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = []
    }
    acc[account.type].push(account)
    return acc
  }, {} as Record<string, LedgerRow[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Buku Besar</h1>
          <p className="text-gray-600">Saldo akun berdasarkan prinsip akuntansi</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Dari:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-2 rounded"
            />
            <label className="text-sm text-gray-600">s/d:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-2 rounded"
            />
          </div>
          <button
            onClick={handleRegenerateJournals}
            disabled={loading}
            className={`flex items-center gap-1 rounded px-3 py-2 text-sm text-white ${
              loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle size={16} />}
            {loading ? 'Memproses…' : 'Regenerasi Jurnal'}
          </button>
          <button
            onClick={handleRecalc}
            disabled={loading}
            className={`flex items-center gap-1 rounded px-3 py-2 text-sm text-white ${
              loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={16} />}
            {loading ? 'Memproses…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`p-4 rounded-lg ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={`font-medium ${isBalanced ? 'text-green-800' : 'text-red-800'}`}>
            {isBalanced ? 'Jurnal Seimbang' : 'Jurnal Tidak Seimbang - Periksa Entri Jurnal'}
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedAccounts).map(([type, accounts]) => (
          <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className={`text-lg font-semibold ${getAccountTypeColor(type)}`}>
                {getAccountTypeLabel(type)}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Kode</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Nama Akun</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Debit</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Kredit</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.map(account => (
                    <tr key={account.code} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-mono">
                        {account.code}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {account.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-red-600">
                        {account.debit > 0 ? formatCurrency(account.debit) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-green-600">
                        {account.credit > 0 ? formatCurrency(account.credit) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                        <span className={account.balance >= 0 ? 'text-gray-900' : 'text-red-600'}>
                          {formatCurrency(Math.abs(account.balance))}
                          {account.balance < 0 && ' (Cr)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Ringkasan Neraca</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium text-blue-600 mb-2">Total Aset</h4>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(
                (groupedAccounts.asset || []).reduce((sum, acc) => sum + Math.max(0, acc.balance), 0)
              )}
            </p>
          </div>
          <div>
            <h4 className="font-medium text-red-600 mb-2">Total Kewajiban</h4>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(
                (groupedAccounts.liability || []).reduce((sum, acc) => sum + Math.max(0, acc.balance), 0)
              )}
            </p>
          </div>
          <div>
            <h4 className="font-medium text-purple-600 mb-2">Total Ekuitas</h4>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(
                (groupedAccounts.equity || []).reduce((sum, acc) => sum + Math.max(0, acc.balance), 0)
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}