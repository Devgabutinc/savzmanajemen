import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Edit, Trash2, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { exportToPdf } from '../utils/pdfExport'
import { logoBase64 } from '../../logoBase64'

interface BaseTransaction {
  id: string
  amount: number
  type: 'income' | 'expense' | 'capital'
  description: string
  transaction_date: string
  reference_number?: string
  category?: { name: string; color: string }
  payment_method: { name: string; account_code: string }
  source: 'transactions' | 'rd_expenses' | 'dtf_inventory' | 'custom_sales'
  source_id: string
  account_code: string
}

interface Transaction extends BaseTransaction {
  source: 'transactions'
}

interface RDExpense extends BaseTransaction {
  source: 'rd_expenses'
  category: string
  supplier: string
  is_failed_experiment: boolean
}

interface DTFInventory extends BaseTransaction {
  source: 'dtf_inventory'
  roll_name: string
  supplier: string
  total_length_cm: number
  cost_per_meter: number
}

interface CustomSale extends BaseTransaction {
  source: 'custom_sales'
  customer_name: string
  length_used_cm: number
  profit: number
}

interface UnifiedTransaction extends BaseTransaction {
  // Common fields for all transaction types
  category?: { name: string; color: string }
  supplier?: string
  customer_name?: string
  length_used_cm?: number
  profit?: number
  is_failed_experiment?: boolean
}

interface TransactionForm {
  amount: string
  type: 'income' | 'expense' | 'capital'
  description: string
  transaction_date: string
  reference_number: string
  category_id: string
  payment_method_id: string
  source: 'transactions' | 'rd_expenses' | 'dtf_inventory' | 'custom_sales'
  source_id: string
}

export function Transactions() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([])
  const [categories, setCategories] = useState<Array<{id: string, name: string, type: string, color: string}>>([])
  const [paymentMethods, setPaymentMethods] = useState<Array<{id: string, name: string, account_code: string}>>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'capital'>('all')
  const { user } = useAuth()
  const [form, setForm] = useState<TransactionForm>({
    amount: '',
    type: 'expense',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    category_id: '',
    payment_method_id: '',
    source: 'transactions',
    source_id: '',
  })

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('transaction_categories')
        .select('id, name, type, color')

      // Fetch payment methods
      const { data: paymentMethodsData } = await supabase
        .from('payment_methods')
        .select('id, name, account_code')
        .eq('is_active', true)

      // Fetch transactions
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select(`
          *,
          category:transaction_categories(name, color),
          payment_method:payment_methods(name, account_code)
        `)
        .eq('user_id', user?.id)
        .order('transaction_date', { ascending: false })

      // Fetch RD expenses
      const { data: rdExpensesData } = await supabase
        .from('rd_expenses')
        .select(`
          *,
          payment_method:payment_methods(name, account_code)
        `)
        .eq('user_id', user?.id)
        .order('expense_date', { ascending: false })

      // Fetch DTF inventory
      const { data: dtfInventoryData } = await supabase
        .from('dtf_inventory')
        .select(`
          *,
          payment_method:payment_methods(name, account_code)
        `)
        .eq('user_id', user?.id)
        .order('purchase_date', { ascending: false })

      // Fetch custom sales
      const { data: customSalesData } = await supabase
        .from('custom_sales')
        .select(`
          *,
          payment_method:payment_methods(name, account_code),
          dtf_roll:dtf_inventory(roll_name)
        `)
        .eq('user_id', user?.id)
        .order('sale_date', { ascending: false })

      // Map all transactions to UnifiedTransaction format
      const allTransactions: UnifiedTransaction[] = [
        // Add transactions
        ...(transactionsData?.map(t => ({
          id: t.id,
          amount: parseFloat(t.amount),
          type: t.type,
          description: t.description,
          transaction_date: t.transaction_date,
          reference_number: t.reference_number,
          category: t.category,
          payment_method: t.payment_method,
          source: 'transactions',
          source_id: t.id,
          account_code: t.payment_method.account_code,
        })) || []),

        // Add RD expenses
        ...(rdExpensesData?.map(e => ({
          id: e.id,
          amount: parseFloat(e.amount),
          type: 'expense',
          description: e.description,
          transaction_date: e.expense_date,
          reference_number: e.supplier,
          category: categoriesData?.find(c => c.id === e.category),
          payment_method: e.payment_method,
          source: 'rd_expenses',
          source_id: e.id,
          category_name: e.category,
          supplier: e.supplier,
          is_failed_experiment: e.is_failed_experiment,
          account_code: e.payment_method.account_code,
        })) || []),

        // Add DTF inventory
        ...(dtfInventoryData?.map(i => ({
          id: i.id,
          amount: parseFloat(i.total_length_cm) * parseFloat(i.cost_per_cm),
          type: 'expense',
          description: `Pembelian Roll ${i.roll_name}`,
          transaction_date: i.purchase_date,
          reference_number: i.supplier,
          category: categoriesData?.find(c => c.name === 'Pembelian Bahan'),
          payment_method: i.payment_method,
          source: 'dtf_inventory',
          source_id: i.id,
          roll_name: i.roll_name,
          supplier: i.supplier,
          total_length_cm: parseFloat(i.total_length_cm),
          cost_per_meter: parseFloat(i.cost_per_meter),
          account_code: i.payment_method.account_code,
        })) || []),

        // Add custom sales
        ...(customSalesData?.map(s => ({
          id: s.id,
          amount: parseFloat(s.selling_price),
          type: 'income',
          description: `Penjualan ke ${s.customer_name}`,
          transaction_date: s.sale_date,
          reference_number: s.dtf_roll?.roll_name,
          category: categoriesData?.find(c => c.name === 'Penjualan'),
          payment_method: s.payment_method,
          source: 'custom_sales',
          source_id: s.id,
          customer_name: s.customer_name,
          length_used_cm: parseFloat(s.length_used_cm),
          profit: parseFloat(s.profit),
          account_code: s.payment_method.account_code,
        })) || [])
      ]

      // Assign synthetic categories where missing
      const addSyntheticCategory = (t: UnifiedTransaction) => {
        if (t.category) return t
        switch (t.source) {
          case 'rd_expenses':
            t.category = { name: 'R&D', color: '#f59e0b' }
            break
          case 'custom_sales':
            t.category = { name: 'Penjualan Custom', color: '#10b981' }
            break
          case 'dtf_inventory':
            t.category = { name: 'Pembelian Bahan Baku', color: '#6366f1' }
            break
        }
        return t
      }

      const withCats = allTransactions.map(addSyntheticCategory)

      // Sort
      withCats.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())

      setTransactions(withCats)
      setCategories(categoriesData || [])
      setPaymentMethods(paymentMethodsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Build payload and convert "" to null for nullable UUID/text fields
      const rawData: Record<string, any> = {
        ...form,
        amount: parseFloat(form.amount),
        user_id: user?.id,
      }

      const nullableKeys = ['category_id', 'payment_method_id', 'source_id', 'reference_number'] as const
      nullableKeys.forEach(k => {
        if (rawData[k] === '') rawData[k] = null
      })

      // Ensure default source value
      if (!rawData.source) rawData.source = 'transactions'

      const transactionData = rawData

      if (editingId) {
        await supabase
          .from('transactions')
          .update(transactionData)
          .eq('id', editingId)
      } else {
        await supabase
          .from('transactions')
          .insert([transactionData])
      }

      setShowForm(false)
      setEditingId(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving transaction:', error)
    }
  }

  const handleEdit = (transaction: UnifiedTransaction) => {
    setForm({
      amount: transaction.amount.toString(),
      type: transaction.type,
      description: transaction.description,
      transaction_date: transaction.transaction_date,
      reference_number: transaction.reference_number || '',
      category_id: '', // You'd need to get the category_id from the transaction
      payment_method_id: '', // You'd need to get the payment_method_id from the transaction
      source: transaction.source,
      source_id: transaction.source_id,
    })
    setEditingId(transaction.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      try {
        await supabase
          .from('transactions')
          .delete()
          .eq('id', id)
        fetchData()
      } catch (error) {
        console.error('Error deleting transaction:', error)
      }
    }
  }

  const resetForm = () => {
    setForm({
      amount: '',
      type: 'expense',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      category_id: '',
      payment_method_id: '',
      source: 'transactions',
      source_id: '',
    })
  }

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || transaction.type === filterType
    const inDateRange = (!startDate || transaction.transaction_date >= startDate) &&
                       (!endDate || transaction.transaction_date <= endDate)
    return matchesSearch && matchesFilter && inDateRange
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleExportPdf = () => {
    const rows = filteredTransactions.map(t => [
      t.transaction_date,
      t.description,
      t.type === 'expense' ? formatCurrency(t.amount) : '',
      t.type === 'income' ? formatCurrency(t.amount) : '',
      t.type === 'capital' ? formatCurrency(t.amount) : '',
    ])
    const subtitle = (startDate || endDate)
      ? `Periode ${startDate || '…'} s/d ${endDate || '…'}`
      : 'Semua periode'

    exportToPdf(
      'Daftar Transaksi',
      ['Tanggal', 'Deskripsi', 'Pengeluaran', 'Pemasukan', 'Modal'],
      rows,
      {
        subtitle,
        printedAt: `Dicetak ${new Date().toLocaleString('id-ID')}`,
        logoBase64,
      }
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transaksi</h2>
          <p className="text-gray-600">Kelola semua transaksi keuangan</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Transaksi
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari transaksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="capital">Modal</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Dari</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <label className="text-sm text-gray-600">s/d</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleExportPdf}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            <FileText className="w-5 h-5 mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.transaction_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{transaction.description}</div>
                      {transaction.reference_number && (
                        <div className="text-gray-500 text-xs">Ref: {transaction.reference_number}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: transaction.category?.color }}
                    >
                      {transaction.category?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.payment_method.name} ({transaction.account_code})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <span className={transaction.type === 'income' ? 'text-green-600' : transaction.type === 'expense' ? 'text-red-600' : 'text-blue-600'}>
                      {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}{formatCurrency(transaction.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(transaction)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Transaksi' : 'Tambah Transaksi'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipe
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' | 'capital' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="expense">Pengeluaran</option>
                    <option value="income">Pemasukan</option>
                    <option value="capital">Modal</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Deskripsi transaksi"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih kategori</option>
                  {categories
                    .filter(cat => cat.type === form.type)
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={form.payment_method_id}
                  onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih metode</option>
                  {paymentMethods.map(method => (
                    <option key={method.id} value={method.id}>
                      {method.name} ({method.account_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={form.transaction_date}
                    onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    No. Referensi
                  </label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Opsional"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingId ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}