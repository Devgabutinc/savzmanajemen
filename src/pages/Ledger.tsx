import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CHART_OF_ACCOUNTS } from '../constants/chartOfAccounts'
import { Loader2, RefreshCw } from 'lucide-react'

interface LedgerRow {
  code: string
  name: string
  debit: number
  credit: number
  balance: number
}

type Source = 'transactions' | 'custom_sales' | 'rd_expenses' | 'inventory' | 'cogs' | 'dtf_inventory'

interface RawTx {
  id: string
  amount: number
  type: 'income' | 'expense' | 'capital'
  description?: string
  payment_method?: { name: string; account_code?: string }
  source: Source
}

export default function Ledger() {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchLedger()
  }, [])

  const fetchLedger = async () => {
    try {
      setLoading(true)
      // --- fetch all sources similar to JournalEntries ---
      const { data: trx } = await supabase.from('transactions').select(`*, payment_method:payment_method_id(name, account_code)`)

      const { data: sales } = await supabase.from('custom_sales').select('*, payment_methods(*)')

      const { data: rd } = await supabase.from('rd_expenses').select('*')

      const { data: dtf } = await supabase.from('dtf_inventory').select('*')

      // normalize
      const combined: RawTx[] = [
        ...(trx || []).map(t => ({
          id: t.id,
          amount: t.amount,
          type: t.type,
          payment_method: t.payment_method,
          source: 'transactions',
        })),
        ...(sales || []).flatMap(s => {
          const arr: RawTx[] = [
            { id: s.id, amount: parseFloat(s.selling_price || '0'), type: 'income', payment_method: s.payment_methods, source: 'custom_sales' },
          ]
          const cogsAmount = parseFloat(s.cogs || '0')
          if (cogsAmount > 0) {
            arr.push({ id: `cogs-${s.id}`, amount: cogsAmount, type: 'expense', source: 'cogs' })
          }
          return arr
        }),
        ...(rd || []).map(e => ({ id: e.id, amount: e.amount, type: 'expense', description: e.description, source: 'rd_expenses', payment_method: e.payment_method || e.payment_methods || { name: e.payment_method_name || '' } })),
        ...(dtf || []).map(e => ({ id: e.id, amount: e.cost_per_cm * e.total_length_cm / 100, type: 'expense', source: 'dtf_inventory', payment_method: e.payment_method || e.payment_methods || { name: e.payment_method_name || '' } }))
      ]

      // Initialize map with all defined account codes
      const map: Record<string, { debit: number; credit: number; balance: number }> = {}
      Object.keys(CHART_OF_ACCOUNTS).forEach(code => {
        map[code] = { debit: 0, credit: 0, balance: 0 }
      })

      // Get payment methods
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('account_code, balance, id')
        .eq('account_code', '1300')
        .order('account_code')

      // Initialize balances from payment methods
      paymentMethods?.forEach(pm => {
        if (map[pm.account_code]) {
          map[pm.account_code].balance = pm.balance || 0
        }
      })

      // Get account ID for E-Wallet once
      const { data: ewalletAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('code', '1300')

      const ewalletAccountId = ewalletAccount?.[0]?.id

      // Get transactions
      const { data: ewalletTx } = await supabase
        .from('transactions')
        .select('amount, type, created_at')
        .eq('payment_method_id', paymentMethods?.[0]?.id)
        .order('created_at')

      // Get R&D expenses
      const { data: rdExpenses } = await supabase
        .from('rd_expenses')
        .select('amount, created_at')
        .eq('payment_method_id', paymentMethods?.[0]?.id)
        .order('created_at')

      // Get custom sales
      const { data: customSales } = await supabase
        .from('custom_sales')
        .select('selling_price, total_hpp, profit, sale_date')
        .eq('payment_method_id', paymentMethods?.[0]?.id)
        .order('sale_date')

      // Get DTF inventory
      const { data: dtfInventory } = await supabase
        .from('dtf_inventory')
        .select('cost_per_cm, total_length_cm, purchase_date')
        .eq('payment_method_id', paymentMethods?.[0]?.id)
        .order('purchase_date')

      // Get journal entries
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('amount, debit_account_id, credit_account_id, created_at')
        .eq('debit_account_id', ewalletAccountId)
        .or(`credit_account_id.eq.${ewalletAccountId}`)
        .order('created_at')

      // Process transactions
      if (paymentMethods && paymentMethods.length > 0) {
        const ewalletBalance = paymentMethods[0].balance || 0
        map['1300'].balance = ewalletBalance
        
        // Process transactions in chronological order
        const allTransactions = [
          ...(ewalletTx || []).map(tx => ({
            date: tx.created_at,
            type: tx.type,
            amount: tx.amount,
            source: 'transactions'
          })),
          ...(rdExpenses || []).map(e => ({
            date: e.created_at,
            type: 'expense',
            amount: e.amount,
            source: 'rd_expenses'
          })),
          ...(customSales || []).map(s => ({
            date: s.sale_date,
            type: 'income',
            amount: parseFloat(s.selling_price || '0') + parseFloat(s.profit || '0'),
            source: 'custom_sales'
          })),
          ...(dtfInventory || []).map(i => ({
            date: i.purchase_date,
            type: 'expense',
            amount: (parseFloat(i.cost_per_cm || '0') * parseFloat(i.total_length_cm || '0')) / 100,
            source: 'dtf_inventory'
          })),
          ...(journalEntries || []).map(je => ({
            date: je.created_at,
            type: je.debit_account_id === ewalletAccountId ? 'debit' : 'credit',
            amount: je.amount,
            source: 'journal_entries'
          }))
        ].sort((a, b) => a.date.localeCompare(b.date))

        // Process transactions in order
        allTransactions.forEach(tx => {
          const debitCode = getAccountCode(tx, true)
          const creditCode = getAccountCode(tx, false)
          
          if (debitCode && map[debitCode]) {
            map[debitCode].debit += tx.amount
          }
          if (creditCode && map[creditCode]) {
            map[creditCode].credit += tx.amount
          }
        })

        // Calculate final balance for each account
        Object.keys(map).forEach(code => {
          if (CHART_OF_ACCOUNTS[code]?.type === 'asset' || CHART_OF_ACCOUNTS[code]?.type === 'expense') {
            map[code].balance = map[code].balance + (map[code].debit - map[code].credit)
          } else {
            map[code].balance = map[code].balance + (map[code].credit - map[code].debit)
          }
        })
      }

      // Update rows
      setRows(Object.values(map).map(row => ({
        code: row.code,
        name: CHART_OF_ACCOUNTS[row.code]?.name || '',
        debit: row.debit,
        credit: row.credit,
        balance: row.balance
      })))
    } catch (e) {
      console.error('fetch ledger', e)
    } finally {
      setLoading(false)
    }
  }

  const handleRecalc = async () => {
    try {
      setLoading(true)
      await fetchLedger()
      alert('Saldo berhasil diperbarui')
    } catch (e) {
      console.error('Recalc error', e)
      alert('Gagal memperbarui saldo')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Buku Besar</h1>
        <button
          onClick={handleRecalc}
          disabled={loading}
          className={`flex items-center gap-1 rounded px-3 py-1 text-sm text-white ${loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw size={16} />} {loading ? 'Memproses…' : 'Hitung Ulang'}
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Kode</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Akun</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Debit</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Kredit</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.code}>
                <td className="px-4 py-2 whitespace-nowrap text-gray-700">{r.code}</td>
                <td className="px-4 py-2 whitespace-nowrap text-gray-700">{r.name}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-red-600">{formatCurrency(r.debit)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-green-600">{formatCurrency(r.credit)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right font-medium">{formatCurrency(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const getAccountCode = (tx: RawTx, isDebit: boolean): string => {
  if (tx.source === 'custom_sales') {
    return isDebit ? '1000' : '4000'
  }
  if (tx.source === 'cogs') {
    return isDebit ? '5000' : '1500'
  }
  if (tx.source === 'rd_expenses') {
    return isDebit ? '7000' : '1300'
  }
  if (tx.source === 'dtf_inventory') {
    return isDebit ? '1500' : '1300'
  }
  if (tx.source === 'journal_entries') {
    return isDebit ? '1300' : '3000'
  }
  if (tx.type === 'capital') {
    return isDebit ? '1300' : '3000'
  }
  if (tx.type === 'income') {
    return isDebit ? '1300' : '4000'
  }
  if (tx.type === 'expense') {
    return isDebit ? '7000' : '1300'
  }
  return isDebit ? '1300' : '2000'
}
