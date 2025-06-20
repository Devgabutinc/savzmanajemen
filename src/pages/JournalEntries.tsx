import React, { useState, useEffect } from 'react'
import { Search, FileText, ArrowLeftRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CHART_OF_ACCOUNTS } from '../constants/chartOfAccounts'
import { formatReference } from '../utils/accounting'
import { exportToPdf } from '../utils/pdfExport'
import { logoBase64 } from '../../logoBase64'

interface Transaction {
  id: string
  amount: number
  transaction_date: string
  sale_date?: string
  expense_date?: string
  type: 'income' | 'expense' | 'capital'
  description: string
  payment_method: {
    name: string
    account_code: string
  }
  reference: string
  source: 'transactions' | 'custom_sales' | 'rd_expenses' | 'inventory' | 'cogs'
  notes?: string
  category_id?: string
  account_code: string
}

interface Account {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
}

const JournalEntries = () => {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [entries, setEntries] = useState<any[]>([])

  useEffect(() => {
    fetchAllTransactions()
    fetchJournalEntries()
  }, [])

  const fetchAllTransactions = async () => {
    try {
      // Fetch from transactions with account_code
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          payment_method:payment_method_id(
            name,
            account_code
          )
        `)
        .order('transaction_date', { ascending: false })

      // Fetch custom sales with payment method and account_code
      const { data: customSalesData, error: customSalesError } = await supabase
        .from('custom_sales')
        .select('*, payment_methods(*)')
        .order('sale_date', { ascending: false })

      // Fetch from rd_expenses with account_code
      const { data: rdExpensesData, error: rdExpensesError } = await supabase
        .from('rd_expenses')
        .select('*')
        .order('expense_date', { ascending: false })

      // Combine all data and normalize
      const combinedTransactions: Transaction[] = [
        ...(transactionsData || []).map(t => ({
          id: t.id,
          amount: t.amount,
          type: t.type as 'income' | 'expense' | 'capital',
          description: t.description || '',
          payment_method: t.payment_method || { name: '', account_code: '' },
          reference: `TRX - ${t.reference_number || '0001'}`,
          source: 'transactions' as const,
          transaction_date: t.transaction_date || new Date().toISOString(),
          category_id: t.category_id,
          account_code: t.payment_method?.account_code || ''
        })),
        ...(customSalesData || []).flatMap(s => {
          const incomeTx: Transaction = {
            id: s.id,
            amount: parseFloat(s.selling_price || '0'),
            type: 'income',
            description: s.notes || '',
            payment_method: s.payment_methods || { name: '', account_code: '' },
            reference: `CS - ${s.customer_name || 'Unnamed'}`,
            source: 'custom_sales' as const,
            sale_date: s.sale_date || new Date().toISOString(),
            notes: s.notes,
            account_code: s.payment_methods?.account_code || ''
          }

          const cogsAmount = parseFloat(s.cogs || '0')
          const cogsTx: Transaction | null = cogsAmount > 0 ? {
            id: `cogs-${s.id}`,
            amount: cogsAmount,
            type: 'expense',
            description: 'Harga Pokok Penjualan',
            payment_method: { name: '', account_code: '1500' }, // Persediaan Barang
            reference: `COGS-${s.id.toString().slice(-4)}`,
            source: 'cogs' as const,
            sale_date: s.sale_date || new Date().toISOString(),
            account_code: '1500'
          } : null

          return cogsTx ? [incomeTx, cogsTx] : [incomeTx]
        }),
        ...(rdExpensesData || []).map(e => ({
          id: e.id,
          amount: e.amount,
          type: e.type as 'income' | 'expense',
          description: e.description || '',
          payment_method: e.payment_method || { name: '', account_code: '' },
          reference: `R&D - ${e.category}`,
          source: 'rd_expenses' as const,
          expense_date: e.expense_date || new Date().toISOString(),
          account_code: e.payment_method?.account_code || ''
        }))
      ]

      // Sort by date
      combinedTransactions.sort((a, b) => 
        new Date(b.transaction_date || b.sale_date || b.expense_date).getTime() - 
        new Date(a.transaction_date || a.sale_date || a.expense_date).getTime()
      )

      setTransactions(combinedTransactions)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const fetchJournalEntries = async () => {
    try {
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('id, account_code')
        .eq('account_code', '1300')

      if (paymentMethods && paymentMethods.length > 0) {
        // Capital from Fahri
        const fahriCapital = await supabase
          .from('journal_entries')
          .insert([{
            amount: 700000,
            description: 'Setoran Modal – Fahri',
            debit_account_id: (
              await supabase
                .from('accounts')
                .select('id')
                .eq('code', '1300')
            ).data?.[0]?.id,
            credit_account_id: (
              await supabase
                .from('accounts')
                .select('id')
                .eq('code', '3100')
            ).data?.[0]?.id,
            created_at: '2025-06-19T00:00:00+07:00'
          }])

        // Capital from Doni
        const doniCapital = await supabase
          .from('journal_entries')
          .insert([{
            amount: 300000,
            description: 'Setoran Modal – Doni',
            debit_account_id: (
              await supabase
                .from('accounts')
                .select('id')
                .eq('code', '1300')
            ).data?.[0]?.id,
            credit_account_id: (
              await supabase
                .from('accounts')
                .select('id')
                .eq('code', '3200')
            ).data?.[0]?.id,
            created_at: '2025-06-19T00:00:00+07:00'
          }])

        // Operating Expenses
        const operatingExpenses = [
          { amount: 30000, description: 'Buku Gambar, Tip-X', account: '6000' },
          { amount: 54000, description: 'Domain & Email Profesional', account: '6100' },
          { amount: 76000, description: 'Followers', account: '6200' },
          { amount: 127500, description: 'Packing Kardus', account: '1500' },
          { amount: 35000, description: 'Excel Template Pembukuan', account: '6000' },
          { amount: 50000, description: 'RND Tshirt Cititex Awal', account: '7000' },
          { amount: 45000, description: 'RND DTF (Linggajaya)', account: '7000' },
          { amount: 97000, description: 'RND Cititex Riset 1Set', account: '7000' },
          { amount: 39000, description: 'RND Kaos LA 1', account: '7000' },
          { amount: 96000, description: 'RND Kaos Oversize & Boxy', account: '7000' },
          { amount: 39000, description: 'RND Kaos LA 2', account: '7000' },
          { amount: 45000, description: 'RND DTF Part 2', account: '7000' },
          { amount: 45000, description: 'RND DTF Part 3', account: '7000' },
          { amount: 45000, description: 'Pembelian Roll PO BACH#1', account: '1500' },
          { amount: 175000, description: 'Pembelian Roll Custom Sajadah', account: '1500' }
        ]

        // Get account IDs first
        const accountIds = await Promise.all(
          operatingExpenses.map(async expense => {
            const { data: debitAccount } = await supabase
              .from('accounts')
              .select('id')
              .eq('code', expense.account)
            
            const { data: creditAccount } = await supabase
              .from('accounts')
              .select('id')
              .eq('code', '1300')
            
            return {
              expense,
              debitAccountId: debitAccount?.[0]?.id,
              creditAccountId: creditAccount?.[0]?.id
            }
          })
        )

        // Insert operating expenses
        const expenseEntries = accountIds.map(({ expense, debitAccountId, creditAccountId }) => ({
          amount: expense.amount,
          description: expense.description,
          debit_account_id: debitAccountId,
          credit_account_id: creditAccountId,
          created_at: '2025-06-19T00:00:00+07:00'
        }))

        await supabase
          .from('journal_entries')
          .insert(expenseEntries)

        // Custom Sale
        const { data: ewalletAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('code', '1300')

        const { data: incomeAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('code', '4000')

        const customSale = await supabase
          .from('journal_entries')
          .insert([{
            amount: 480000,
            description: 'Penjualan ke EVI',
            debit_account_id: ewalletAccount?.[0]?.id,
            credit_account_id: incomeAccount?.[0]?.id,
            created_at: '2025-06-19T00:00:00+07:00'
          }])
      }

      // Get all journal entries
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('*')
        .order('created_at')

      setEntries(journalEntries || [])
    } catch (error) {
      console.error('Error fetching journal entries:', error)
    }
  }

  const getAccountCode = (type: string, source: string, paymentMethod?: string): string => {
    switch (source) {
      case 'custom_sales':
        return '1000' // Pendapatan Penjualan Custom
      case 'rd_expenses':
        return '2000' // Biaya R&D
      case 'cogs':
        return '1500' // Persediaan Barang
      case 'inventory':
        return '1500' // Persediaan Barang
      default:
        switch (type) {
          case 'income':
            return '1000' // Pendapatan Umum
          case 'expense':
            return '2000' // Biaya Operasional
          case 'capital':
            return '3000' // Modal / Ekuitas
          default:
            return ''
        }
    }
  }

  const getAccountName = (type: string, source: string, paymentMethod?: string): string => {
    const code = getAccountCode(type, source, paymentMethod)
    return CHART_OF_ACCOUNTS[code]?.name || ''
  }

  const formatTransactionAsJournal = (transaction: Transaction) => {
    if (transaction.source === 'cogs') {
      return {
        id: transaction.id,
        date: transaction.transaction_date || transaction.sale_date || transaction.expense_date,
        description: transaction.description,
        debit_account: {
          code: '5000',
          name: CHART_OF_ACCOUNTS['5000'].name,
          type: 'expense'
        },
        credit_account: {
          code: '1300',
          name: CHART_OF_ACCOUNTS['1300'].name,
          type: 'asset'
        },
        amount: Math.round(transaction.amount * 100) / 100,
        reference: formatReference(transaction.source, transaction)
      }
    }

    if (transaction.type === 'capital') {
      const equityAccount = { code: '3000', name: CHART_OF_ACCOUNTS['3000'].name, type: 'equity' as const }
      const cashAccount  = { code: '1100', name: CHART_OF_ACCOUNTS['1100'].name, type: 'asset' as const }

      const withdrawId = '50d48c12-2f79-4949-bfb2-dacf18982155' // Penarikan Modal
      const isWithdraw = transaction.category_id === withdrawId

      return {
        id: transaction.id,
        date: transaction.transaction_date,
        description: transaction.description || (isWithdraw ? 'Penarikan Modal' : 'Setoran Modal'),
        debit_account: isWithdraw ? equityAccount : cashAccount,
        credit_account: isWithdraw ? cashAccount : equityAccount,
        amount: Math.round(transaction.amount * 100) / 100,
        reference: formatReference(transaction.source, transaction)
      }
    }

    const amount = Math.round(transaction.amount * 100) / 100

    // Untuk penjualan custom, akun kredit menggunakan metode pembayaran
    const creditAccount = {
      code: transaction.source === 'custom_sales' 
        ? getAccountCode('income', transaction.source, transaction.payment_method?.name)
        : transaction.account_code || '2000', // Default to Biaya Operasional if account_code is missing
      name: transaction.source === 'custom_sales' 
        ? getAccountName('income', transaction.source, transaction.payment_method?.name)
        : CHART_OF_ACCOUNTS[transaction.account_code]?.name || CHART_OF_ACCOUNTS['2000'].name || 'Akun Tidak Ditemukan',
      type: transaction.type as 'income' | 'expense'
    }

    const debitAccount = {
      code: transaction.source === 'custom_sales' 
        ? '2000' // Biaya Operasional for custom sales
        : transaction.account_code || '1300', // Default to E-Wallet if account_code is missing
      name: transaction.source === 'custom_sales' 
        ? CHART_OF_ACCOUNTS['2000'].name
        : CHART_OF_ACCOUNTS[transaction.account_code]?.name || CHART_OF_ACCOUNTS['1300'].name || 'Akun Tidak Ditemukan',
      type: 'expense'
    }

    // Gunakan notes jika ada, jika tidak gunakan description
    const description = transaction.notes || transaction.description || ''

    return {
      id: transaction.id,
      date: transaction.transaction_date || transaction.sale_date || transaction.expense_date,
      description,
      debit_account: debitAccount,
      credit_account: creditAccount,
      amount,
      reference: formatReference(transaction.source, transaction)
    }
  }

  const filteredTransactions = transactions.filter((transaction: Transaction) => {
    const matchesSearch = (transaction.description || '').toLowerCase().includes(searchTerm.toLowerCase())

    // Determine date field
    const dateStr = transaction.transaction_date || transaction.sale_date || transaction.expense_date || ''
    const dateOk =
      (!startDate || dateStr >= startDate) &&
      (!endDate || dateStr <= endDate)

    return matchesSearch && dateOk
  })

  const journalEntries = filteredTransactions.map((transaction: Transaction) => formatTransactionAsJournal(transaction))

  // --- PDF Export ---
  const handleExportPdf = () => {
    if (journalEntries.length === 0) {
      alert('Tidak ada data untuk diexport.')
      return
    }

    const headers = ['Tanggal', 'Deskripsi', 'Akun Debit', 'Akun Kredit', 'Jumlah', 'Referensi']

    const rows = journalEntries.map((entry) => [
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-semibold">Jurnal Umum</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari jurnal..."
              className="w-48 sm:w-64 px-8 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
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

      {/* Daftar Jurnal */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akun Debit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akun Kredit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referensi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {journalEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.date ? format(new Date(entry.date), 'dd MMM yyyy', { locale: pt }) : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.description || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(entry.debit_account?.code || '') + ' - ' + (entry.debit_account?.name || '')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(entry.credit_account?.code || '') + ' - ' + (entry.credit_account?.name || '')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.amount ? `Rp${entry.amount.toLocaleString('id-ID')}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.reference || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export { JournalEntries }
