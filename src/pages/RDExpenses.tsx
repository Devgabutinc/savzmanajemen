import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Edit, Trash2, FlaskRound as Flask, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface RDExpense {
  id: string
  category: string
  description: string
  amount: number
  expense_date: string
  supplier?: string
  is_failed_experiment: boolean
  payment_method_id?: string
  payment_method?: {
    name: string
    account_code: string
  }
  notes?: string
  account_code: string
}

interface RDExpenseForm {
  category: string
  description: string
  amount: string
  expense_date: string
  supplier: string
  is_failed_experiment: boolean
  payment_method_id: string
  notes: string
}

const RD_CATEGORIES = [
  'Bahan Eksperimen',
  'Sample Produk',
  'Trial & Error',
  'Peralatan R&D',
  'Konsultasi',
  'Lain-lain'
]

export function RDExpenses() {
  const [expenses, setExpenses] = useState<RDExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterFailed, setFilterFailed] = useState<string>('all')
  const { user } = useAuth()
  const [paymentMethods, setPaymentMethods] = useState<{id:string,name:string,type:string,account_code:string}[]>([])

  const [form, setForm] = useState<RDExpenseForm>({
    category: RD_CATEGORIES[0],
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    supplier: '',
    is_failed_experiment: false,
    payment_method_id: '',
    notes: '',
  })

  useEffect(() => {
    if (user) {
      fetchExpenses()
      fetchPaymentMethods()
    }
  }, [user])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const { data } = await supabase
        .from('rd_expenses')
        .select('*')
        .eq('user_id', user?.id)
        .order('expense_date', { ascending: false })

      setExpenses(data || [])
    } catch (error) {
      console.error('Error fetching R&D expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPaymentMethods = async () => {
    const { data } = await supabase
      .from('payment_methods')
      .select('id,name,type,account_code')
      .eq('is_active', true)
    setPaymentMethods(data || [])
    if (data && data.length && !form.payment_method_id) {
      setForm(f => ({ ...f, payment_method_id: data[0].id }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const expenseData = {
        ...form,
        amount: parseFloat(form.amount),
        user_id: user?.id,
        payment_method_id: form.payment_method_id || null,
      }

      if (editingId) {
        await supabase
          .from('rd_expenses')
          .update(expenseData)
          .eq('id', editingId)
      } else {
        await supabase
          .from('rd_expenses')
          .insert([expenseData])
      }

      setShowForm(false)
      setEditingId(null)
      resetForm()
      fetchExpenses()
    } catch (error) {
      console.error('Error saving R&D expense:', error)
    }
  }

  const handleEdit = (expense: RDExpense) => {
    setForm({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      expense_date: expense.expense_date,
      supplier: expense.supplier || '',
      is_failed_experiment: expense.is_failed_experiment,
      payment_method_id: expense.payment_method_id || paymentMethods[0]?.id || '',
      notes: expense.notes || '',
    })
    setEditingId(expense.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus expense R&D ini?')) {
      try {
        await supabase
          .from('rd_expenses')
          .delete()
          .eq('id', id)
        fetchExpenses()
      } catch (error) {
        console.error('Error deleting R&D expense:', error)
      }
    }
  }

  const resetForm = () => {
    setForm({
      category: RD_CATEGORIES[0],
      description: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      supplier: '',
      is_failed_experiment: false,
      payment_method_id: paymentMethods[0]?.id || '',
      notes: '',
    })
  }

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (expense.supplier && expense.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = filterCategory === 'all' || expense.category === filterCategory
    const matchesFailed = filterFailed === 'all' || 
                         (filterFailed === 'failed' && expense.is_failed_experiment) ||
                         (filterFailed === 'success' && !expense.is_failed_experiment)
    return matchesSearch && matchesCategory && matchesFailed
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const failedExpenses = filteredExpenses.filter(e => e.is_failed_experiment).reduce((sum, expense) => sum + expense.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">R&D Expenses</h2>
          <p className="text-gray-600">Kelola biaya riset dan pengembangan</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah R&D Expense
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total R&D</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalExpenses)}</p>
            </div>
            <Flask className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Eksperimen Gagal</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(failedExpenses)}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">
                {totalExpenses > 0 ? `${(((totalExpenses - failedExpenses) / totalExpenses) * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <Flask className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari R&D expense..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">Semua Kategori</option>
              {RD_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={filterFailed}
              onChange={(e) => setFilterFailed(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">Semua Status</option>
              <option value="success">Berhasil</option>
              <option value="failed">Gagal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategori
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(expense.expense_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{expense.description}</div>
                      {expense.notes && (
                        <div className="text-gray-500 text-xs mt-1">{expense.notes}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.supplier || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {expense.is_failed_experiment ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Gagal
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Berhasil
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
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

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit R&D Expense' : 'Tambah R&D Expense'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  >
                    {RD_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Deskripsi R&D expense"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={form.payment_method_id}
                    onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Nama supplier"
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={form.is_failed_experiment}
                    onChange={(e) => setForm({ ...form, is_failed_experiment: e.target.checked })}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Eksperimen gagal</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Catatan tambahan..."
                />
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
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