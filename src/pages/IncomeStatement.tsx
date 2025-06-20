import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatAmount } from '../utils/accounting'
import { exportToPdf } from '../utils/pdfExport'
import { logoBase64 } from '../../logoBase64'
import { FileText } from 'lucide-react'

export default function IncomeStatement() {
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [rdExpenses, setRdExpenses] = useState<any[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // 1. Transactions table
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')

      setTransactions(transactions || [])

      // 2. Custom sales
      const { data: sales } = await supabase
        .from('custom_sales')
        .select('*')

      setSales(sales || [])

      // 3. R&D expenses table
      const { data: rd } = await supabase
        .from('rd_expenses')
        .select('amount, expense_date')

      setRdExpenses(rd || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const { revenue, cogs, expenses, grossProfit, netProfit } = useMemo(() => {
    const inRange = (dateStr: string) => {
      if (!dateStr) return false
      return (!startDate || dateStr >= startDate) && (!endDate || dateStr <= endDate)
    }

    // transactions revenue/expense
    const trxIncome = transactions
      .filter(t => t.type === 'income' && inRange(t.transaction_date))
      .reduce((s, t) => s + (t.amount || 0), 0)
    const trxExpense = transactions
      .filter(t => t.type === 'expense' && inRange(t.transaction_date))
      .reduce((s, t) => s + (t.amount || 0), 0)

    const salesRevenue = sales.filter(s => inRange(s.sale_date)).reduce((s, cs) => s + parseFloat(cs.selling_price || '0'), 0)
    const salesCogs = sales.filter(s => inRange(s.sale_date)).reduce((s, cs) => s + parseFloat(cs.cogs || '0'), 0)

    const rdTotal = rdExpenses.filter(r => inRange(r.expense_date)).reduce((s, r) => s + (r.amount || 0), 0)

    const revenue = trxIncome + salesRevenue
    const cogs = salesCogs
    const expenses = trxExpense + rdTotal
    const grossProfit = revenue - cogs
    const netProfit = grossProfit - expenses
    return { revenue, cogs, expenses, grossProfit, netProfit }
  }, [transactions, sales, rdExpenses, startDate, endDate])

  const handleExportPdf = () => {
    const headers = ['Keterangan', 'Jumlah']
    const rows = [
      ['Pendapatan (1000)', formatAmount(revenue)],
      ['Harga Pokok Penjualan (5000)', `(${formatAmount(cogs)})`],
      ['Laba Kotor', formatAmount(grossProfit)],
      ['Beban Operasional (2000)', `(${formatAmount(expenses)})`],
      ['Laba Bersih', formatAmount(netProfit)],
    ]

    const subtitle = startDate || endDate ? `Periode ${startDate || '…'} s/d ${endDate || '…'}` : 'Semua periode'

    exportToPdf('Laporan Laba/Rugi', headers, rows, {
      subtitle,
      printedAt: `Dicetak ${new Date().toLocaleString('id-ID')}`,
      logoBase64,
    })
  }

  if (loading) return <p>Memuat...</p>

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold">Laporan Laba/Rugi</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-1 rounded" />
          <span>-</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-1 rounded" />
          <button onClick={handleExportPdf} className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded">
            <FileText className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>
      <table className="min-w-full border divide-y divide-gray-200">
        <tbody className="divide-y divide-gray-200">
          <tr>
            <td className="py-2">Pendapatan (1000)</td>
            <td className="py-2 text-right">{formatAmount(revenue)}</td>
          </tr>
          <tr>
            <td className="py-2 pl-6">Harga Pokok Penjualan (5000)</td>
            <td className="py-2 text-right">({formatAmount(cogs)})</td>
          </tr>
          <tr className="font-semibold">
            <td className="py-2">Laba Kotor</td>
            <td className="py-2 text-right">{formatAmount(grossProfit)}</td>
          </tr>
          <tr>
            <td className="py-2 pl-6">Beban Operasional (2000)</td>
            <td className="py-2 text-right">({formatAmount(expenses)})</td>
          </tr>
          <tr className="font-bold">
            <td className="py-2">Laba Bersih</td>
            <td className="py-2 text-right">{formatAmount(netProfit)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
