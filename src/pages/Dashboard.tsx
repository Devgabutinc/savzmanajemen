import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Package, FlaskRound as Flask } from 'lucide-react'
import { StatCard } from '../components/StatCard'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns'

interface DashboardData {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  customSalesCount: number
  rdExpenses: number
  monthlyData: Array<{
    month: string
    income: number
    expenses: number
    profit: number
  }>
  paymentMethodBalances: Array<{
    name: string
    balance: number
    type: string
  }>
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch current month's summary
      const currentMonth = new Date().toISOString().slice(0, 7)
      
      // Get transactions for current month
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user?.id)
        .gte('transaction_date', `${currentMonth}-01`)

      // Get custom sales for current month
      const { data: customSales } = await supabase
        .from('custom_sales')
        .select('profit, selling_price, cogs')
        .eq('user_id', user?.id)
        .gte('sale_date', `${currentMonth}-01`)

      // Get R&D expenses for current month (include payment_method_id)
      const { data: rdExpenses } = await supabase
        .from('rd_expenses')
        .select('amount, payment_method_id')
        .eq('user_id', user?.id)
        .gte('expense_date', `${currentMonth}-01`)

      // Get active payment methods with their balances
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('id, name, type, balance')
        .eq('is_active', true)

      // Convert string balance to number
      const paymentMethodBalances = (paymentMethods ?? []).map(pm => ({
        name: pm.name,
        type: pm.type,
        balance: parseFloat(pm.balance),
      }))

      // Calculate totals
      const trxExpense = (transactions ?? [])
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0)

      const rdExpenseSum = (rdExpenses ?? []).reduce((sum,r)=> sum + Number(r.amount),0)

      const cogsExpense = (customSales ?? []).reduce((sum,s)=> sum + Number(s.cogs || 0),0)

      const totalExpenses = trxExpense + rdExpenseSum + cogsExpense

      const totalIncome = (transactions ?? [])
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0)

      const customSalesProfit = (customSales ?? [])
        .reduce((sum, s) => sum + Number(s.profit), 0)

      const netProfit = totalIncome - totalExpenses + customSalesProfit

      // Log payment method balances for debugging
      console.log('Payment Method Balances:', paymentMethodBalances)

      // --- Monthly cashflow real data ---
      const firstMonth = subMonths(new Date(), 5) // 5 months ago inclusive
      const fromDate = format(startOfMonth(firstMonth), 'yyyy-MM-dd')

      // Fetch data for the last 6 months once
      const { data: trx6m } = await supabase
        .from('transactions')
        .select('amount, type, transaction_date')
        .eq('user_id', user?.id)
        .gte('transaction_date', fromDate)

      const { data: sales6m } = await supabase
        .from('custom_sales')
        .select('cogs, profit, sale_date')
        .eq('user_id', user?.id)
        .gte('sale_date', fromDate)

      const { data: rd6m } = await supabase
        .from('rd_expenses')
        .select('amount, expense_date')
        .eq('user_id', user?.id)
        .gte('expense_date', fromDate)

      // Helper to month key
      const toKey = (d: string) => d.slice(0,7)

      const map: { [key: string]: { income:number, expense:number, profitAdj:number } } = {}

      // init keys for each month to ensure zero
      for (let i=5;i>=0;i--){
        const dt = subMonths(new Date(), i)
        const key = format(dt,'yyyy-MM')
        map[key] = { income:0, expense:0, profitAdj:0 }
      }

      const trxArr = Array.isArray(trx6m) ? trx6m : []
      trxArr.forEach(t=>{
        const key = toKey(t.transaction_date)
        if(!map[key]) return
        if(t.type==='income') map[key].income += Number(t.amount)
        if(t.type==='expense') map[key].expense += Number(t.amount)
      })

      const salesArr = Array.isArray(sales6m) ? sales6m : []
      salesArr.forEach(s=>{
        const key = toKey(s.sale_date)
        if(!map[key]) return
        map[key].expense += parseFloat(s.cogs||'0')
        map[key].profitAdj += Number(s.profit)
      })

      const rdArr = Array.isArray(rd6m) ? rd6m : []
      rdArr.forEach(r=>{
        const key = toKey(r.expense_date)
        if(!map[key]) return
        map[key].expense += Number(r.amount)
      })

      const monthlyData = Object.keys(map).sort().map(key=>{
        const item = map[key]
        const profit = item.income - item.expense + item.profitAdj
        const monthLabel = new Date(key+'-01').toLocaleDateString('id-ID',{ month:'short'})
        return { month: monthLabel, income: item.income, expenses: item.expense, profit }
      })

      setData({
        totalIncome,
        totalExpenses,
        netProfit,
        customSalesCount: (customSales ?? []).length,
        rdExpenses: (rdExpenses ?? []).reduce((sum, r) => sum + Number(r.amount), 0),
        monthlyData,
        paymentMethodBalances,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Gagal memuat data dashboard</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pemasukan (Bulan Ini)"
          value={formatCurrency(data.totalIncome)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Pengeluaran (Bulan Ini)"
          value={formatCurrency(data.totalExpenses)}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          title="Profit Bersih (Bulan Ini)"
          value={formatCurrency(data.netProfit)}
          icon={TrendingUp}
          color={data.netProfit >= 0 ? "green" : "red"}
        />
        <StatCard
          title="Custom Sales (Bulan Ini)"
          value={data.customSalesCount.toString()}
          icon={Package}
          color="blue"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Cashflow */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cashflow Bulanan</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="income" stroke="#059669" strokeWidth={2} name="Pemasukan" />
                <Line type="monotone" dataKey="expenses" stroke="#DC2626" strokeWidth={2} name="Pengeluaran" />
                <Line type="monotone" dataKey="profit" stroke="#2563EB" strokeWidth={2} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Balances */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Saldo Kas & Bank</h3>
          <div className="space-y-4">
            {data.paymentMethodBalances.map((method, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    method.type === 'cash' ? 'bg-green-500' :
                    method.type === 'bank' ? 'bg-blue-500' : 'bg-purple-500'
                  }`} />
                  <span className="font-medium text-gray-900">{method.name}</span>
                </div>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(method.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">R&D Expenses</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(data.rdExpenses)}</p>
            </div>
            <Flask className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Margin Profit</p>
              <p className="text-2xl font-bold text-green-600">
                {data.totalIncome > 0 ? `${((data.netProfit / data.totalIncome) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Rata-rata Order</p>
              <p className="text-2xl font-bold text-blue-600">
                {data.customSalesCount > 0 ? 
                  formatCurrency(data.totalIncome / data.customSalesCount) : 
                  formatCurrency(0)
                }
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>
    </div>
  )
}