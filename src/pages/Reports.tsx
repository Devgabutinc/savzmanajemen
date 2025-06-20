import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, BarChart3, PieChart, Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'

interface Transaction {
  id: string
  amount: number
  transaction_date: string
  category_id: string
  payment_method_id: string
  type: 'income' | 'expense'
}

interface TransactionCategory {
  id: string
  name: string
  type: 'income' | 'expense'
}

interface PaymentMethod {
  id: string
  name: string
  type: string
  balance?: number | null // saldo tersimpan di DB
}

const Reports = () => {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<TransactionCategory[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [rdExpenses, setRdExpenses] = useState<any[]>([])
  const [startDate, setStartDate] = useState(format(subDays(new Date(),30),'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(),'yyyy-MM-dd'))

  useEffect(() => {
    fetchReportsData()
  }, [startDate, endDate])

  const fetchReportsData = async () => {
    try {
      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true })

      if (transactionsError) throw transactionsError
      setTransactions(transactionsData || [])

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('transaction_categories')
        .select('*')

      if (categoriesError) throw categoriesError
      setCategories(categoriesData || [])

      // Fetch payment methods (include balance)
      const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
        .from('payment_methods')
        .select('*')

      if (paymentMethodsError) throw paymentMethodsError
      setPaymentMethods(paymentMethodsData || [])

      // Fetch R&D or other expense table (rd_expenses)
      const { data: rdData, error: rdErr } = await supabase
        .from('rd_expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)

      if (rdErr) throw rdErr
      setRdExpenses(rdData || [])

      // Fetch custom sales (for COGS)
      const { data: salesData, error: salesErr } = await supabase
        .from('custom_sales')
        .select('*')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)

      if (salesErr) throw salesErr
      setSales(salesData || [])
    } catch (error) {
      console.error('Error fetching reports data:', error)
    }
  }

  const calculateTotalIncome = () => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }

  const calculateTotalExpense = () => {
    const trxExp = transactions.filter(t => t.type === 'expense').reduce((s,t)=>s+(t.amount||0),0)
    const rdExp = rdExpenses.reduce((s,r)=>s+(r.amount||0),0)
    const cogsExp = sales.reduce((s,cs)=>s+parseFloat(cs.cogs||'0'),0)
    return trxExp + rdExp + cogsExp
  }

  const calculateNetProfit = () => {
    return calculateTotalIncome() - calculateTotalExpense()
  }

  // --- Helpers ---
  const getExpenseByCategory = () => {
    const combined = [
      ...transactions.filter(t => t.type === 'expense').map(e => ({ nameId: e.category_id, amount: e.amount })),
      ...rdExpenses.map(r => ({ nameId: r.category_id || null, amount: r.amount })),
      ...sales.map(s => ({ nameId: 'COGS', amount: parseFloat(s.cogs||'0') }))
    ]

    const expensesByCategory = combined
      .reduce((acc, curr) => {
        const category = categories.find(c => c.id === curr.nameId)
        const catName = category ? category.name : (curr.nameId==='COGS' ? 'Harga Pokok Penjualan' : 'Tanpa Kategori')
        acc[catName] = (acc[catName] || 0) + (curr.amount || 0)
        return acc
      }, {} as { [key: string]: number })

    return Object.entries(expensesByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }

  const getInflow = (pmId: string) =>
    transactions.filter(t => t.payment_method_id === pmId && t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0)

  const getOutflow = (pmId: string) => {
    const trxOut = transactions.filter(t => t.payment_method_id === pmId && t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0)
    const rdOut = rdExpenses.filter(r => r.payment_method_id === pmId).reduce((s, r) => s + (r.amount || 0), 0)
    return trxOut + rdOut
  }

  const getNet = (pmId: string) => getInflow(pmId) - getOutflow(pmId)

  const getSaldo = (pm: PaymentMethod) => (pm.balance || 0) // saldo sudah mutakhir

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-semibold">Laporan</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border p-2 rounded" />
          <span>-</span>
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border p-2 rounded" />
          <button
            onClick={() => {setStartDate(format(subDays(new Date(),30),'yyyy-MM-dd')); setEndDate(format(new Date(),'yyyy-MM-dd'))}}
            className="flex items-center px-3 py-2 border rounded-md hover:bg-gray-50"
          >
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="ml-2">Bulan Ini</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Income Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Pendapatan</h3>
              <p className="text-2xl font-semibold text-green-600">
                Rp{calculateTotalIncome().toLocaleString('id-ID')}
              </p>
            </div>
            <BarChart3 className="w-6 h-6 text-green-500" />
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Pengeluaran</h3>
              <p className="text-2xl font-semibold text-red-600">
                Rp{calculateTotalExpense().toLocaleString('id-ID')}
              </p>
            </div>
            <BarChart3 className="w-6 h-6 text-red-500" />
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Keuntungan Bersih</h3>
              <p className="text-2xl font-semibold text-blue-600">
                Rp{calculateNetProfit().toLocaleString('id-ID')}
              </p>
            </div>
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Top 5 Expense Categories */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium mb-4">5 Kategori Pengeluaran Terbesar</h2>
        <div className="space-y-4">
          {getExpenseByCategory().map(([category, amount], index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-gray-600">{category}</span>
              <span className="font-medium text-red-600">
                Rp{amount.toLocaleString('id-ID')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method Distribution */}
      <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
        <h2 className="text-lg font-medium mb-4">Metode Pembayaran (In/Out/Saldo)</h2>
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 text-sm">
              <th className="px-4 py-2 text-left">Metode</th>
              <th className="px-4 py-2 text-right">Masuk</th>
              <th className="px-4 py-2 text-right">Keluar</th>
              <th className="px-4 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {paymentMethods.map((method) => (
              <tr key={method.id} className="border-t text-sm">
                <td className="px-4 py-2">{method.name}</td>
                <td className="px-4 py-2 text-right text-green-600">Rp{getInflow(method.id).toLocaleString('id-ID')}</td>
                <td className="px-4 py-2 text-right text-red-600">Rp{getOutflow(method.id).toLocaleString('id-ID')}</td>
                <td className="px-4 py-2 text-right font-medium">Rp{getSaldo(method).toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { Reports }
