import React, { useState, useEffect } from 'react'
import { Search, FileText, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { CHART_OF_ACCOUNTS } from '../constants/chartOfAccounts'
import { exportToPdf } from '../utils/pdfExport'
import { logoBase64 } from '../../logoBase64'

interface JournalEntry {
  id: string
  date: string
  description: string
  debit_account: {
    code: string
    name: string
    type: string
  }
  credit_account: {
    code: string
    name: string
    type: string
  }
  amount: number
  reference: string
}

export function JournalEntries() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchJournalEntries()
  }, [startDate, endDate])

  const fetchJournalEntries = async () => {
    try {
      setLoading(true)
      
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select(`
          *,
          debit_account:debit_account_id(code, name, type),
          credit_account:credit_account_id(code, name, type)
        `)
        .gte('date', startDate || '1900-01-01')
        .lte('date', endDate || '2099-12-31')
        .order('date', { ascending: false })

      setEntries(journalEntries || [])
    } catch (error) {
      console.error('Error fetching journal entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = 
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.debit_account?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.credit_account?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.reference?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const handleExportPdf = () => {
    if (filteredEntries.length === 0) {
      alert('Tidak ada data untuk diexport.')
      return
    }

    const headers = ['Tanggal', 'Deskripsi', 'Akun Debit', 'Akun Kredit', 'Jumlah', 'Referensi']

    const rows = filteredEntries.map((entry) => [
      entry.date ? format(new Date(entry.date), 'dd/MM/yyyy') : '',
      entry.description,
      `${entry.debit_account?.code || ''} - ${entry.debit_account?.name || ''}`,
      `${entry.credit_account?.code || ''} - ${entry.credit_account?.name || ''}`,
      entry.amount ? `Rp${entry.amount.toLocaleString('id-ID')}` : '',
      entry.reference || ''
    ])

    const subtitle = startDate || endDate ? `Periode ${startDate || '…'} s/d ${endDate || '…'}` : 'Semua periode'

    exportToPdf('Jurnal Umum', headers, rows, {
      subtitle,
      printedAt: `Dicetak ${new Date().toLocaleString('id-ID')}`,
      logoBase64,
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Calculate totals for verification
  const totalDebit = filteredEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)
  const totalCredit = filteredEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Jurnal Umum
          </h1>
          <p className="text-gray-600">Catatan transaksi dengan sistem berpasangan</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari jurnal..."
              className="w-48 sm:w-64 px-8 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border p-2 rounded"
          />
          <span>-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border p-2 rounded"
          />
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded"
          >
            <FileText className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`p-4 rounded-lg ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className={`font-medium ${isBalanced ? 'text-green-800' : 'text-red-800'}`}>
              {isBalanced ? 'Jurnal Seimbang' : 'Jurnal Tidak Seimbang'}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            Total Debit: {formatCurrency(totalDebit)} | Total Kredit: {formatCurrency(totalCredit)}
          </div>
        </div>
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akun Debit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akun Kredit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Referensi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.date ? format(new Date(entry.date), 'dd MMM yyyy', { locale: id }) : ''}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {entry.description}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-gray-500">{entry.debit_account?.code}</span>
                      <span>{entry.debit_account?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-gray-500">{entry.credit_account?.code}</span>
                      <span>{entry.credit_account?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {formatCurrency(entry.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredEntries.length === 0 && (
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Belum ada jurnal yang tercatat</p>
        </div>
      )}
    </div>
  )
}