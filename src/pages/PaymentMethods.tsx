import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, CreditCard, Wallet, Banknote, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface PaymentMethod {
  id: string
  name: string
  type: 'cash' | 'bank' | 'ewallet'
  balance: number
  is_active: boolean
}

interface PaymentMethodForm {
  name: string
  type: 'cash' | 'bank' | 'ewallet'
  balance: string
}

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense' | 'capital'
  description: string
  transaction_date: string
  payment_method: { name: string }
}

export function PaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { user } = useAuth()

  const [form, setForm] = useState<PaymentMethodForm>({
    name: '',
    type: 'cash',
    balance: '0',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch payment methods
      const { data: paymentMethodsData } = await supabase
        .from('payment_methods')
        .select('*')
        .order('name')

      // Fetch recent transactions
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select(`
          *,
          payment_method:payment_methods(name)
        `)
        .eq('user_id', user?.id)
        .order('transaction_date', { ascending: false })
        .limit(10)

      setPaymentMethods(paymentMethodsData || [])
      setRecentTransactions(transactionsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const methodData = {
        ...form,
        balance: parseFloat(form.balance),
      }

      if (editingId) {
        await supabase
          .from('payment_methods')
          .update(methodData)
          .eq('id', editingId)
      } else {
        await supabase
          .from('payment_methods')
          .insert([methodData])
      }

      setShowForm(false)
      setEditingId(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving payment method:', error)
    }
  }

  const handleEdit = (method: PaymentMethod) => {
    setForm({
      name: method.name,
      type: method.type,
      balance: method.balance.toString(),
    })
    setEditingId(method.id)
    setShowForm(true)
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await supabase
        .from('payment_methods')
        .update({ is_active: !isActive })
        .eq('id', id)
      fetchData()
    } catch (error) {
      console.error('Error toggling payment method status:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus metode pembayaran ini?')) {
      try {
        await supabase
          .from('payment_methods')
          .delete()
          .eq('id', id)
        fetchData()
      } catch (error) {
        console.error('Error deleting payment method:', error)
      }
    }
  }

  const resetForm = () => {
    setForm({
      name: '',
      type: 'cash',
      balance: '0',
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <Banknote className="w-5 h-5" />
      case 'bank':
        return <CreditCard className="w-5 h-5" />
      case 'ewallet':
        return <Wallet className="w-5 h-5" />
      default:
        return <CreditCard className="w-5 h-5" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'cash':
        return 'bg-green-100 text-green-800'
      case 'bank':
        return 'bg-blue-100 text-blue-800'
      case 'ewallet':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const totalBalance = paymentMethods
    .filter(method => method.is_active)
    .reduce((sum, method) => sum + method.balance, 0)

  const cashBalance = paymentMethods
    .filter(method => method.type === 'cash' && method.is_active)
    .reduce((sum, method) => sum + method.balance, 0)

  const bankBalance = paymentMethods
    .filter(method => method.type === 'bank' && method.is_active)
    .reduce((sum, method) => sum + method.balance, 0)

  const ewalletBalance = paymentMethods
    .filter(method => method.type === 'ewallet' && method.is_active)
    .reduce((sum, method) => sum + method.balance, 0)

  const handleRecalc = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.rpc('recalc_balances_rpc')
      if (error) throw error
      await fetchData()
      alert('Saldo berhasil dihitung ulang')
    } catch (error) {
      console.error('Error recalculating balances:', error)
      alert('Gagal menghitung ulang saldo')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kas & Bank</h2>
          <p className="text-gray-600">Kelola metode pembayaran dan saldo</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRecalc}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Hitung Ulang Saldo
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Metode
          </button>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Saldo</p>
              <p className="text-2xl font-bold text-teal-600">{formatCurrency(totalBalance)}</p>
            </div>
            <CreditCard className="w-8 h-8 text-teal-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Kas Tunai</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(cashBalance)}</p>
            </div>
            <Banknote className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Bank</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(bankBalance)}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">E-Wallet</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(ewalletBalance)}</p>
            </div>
            <Wallet className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Metode Pembayaran</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(method.type)}`}>
                      {getTypeIcon(method.type)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{method.name}</div>
                      <div className="text-sm text-gray-500 capitalize">{method.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(method.balance)}
                      </div>
                      <div className={`text-xs ${method.is_active ? 'text-green-600' : 'text-red-600'}`}>
                        {method.is_active ? 'Aktif' : 'Nonaktif'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleEdit(method)}
                        className="text-teal-600 hover:text-teal-800"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(method.id, method.is_active)}
                        className={`${method.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {method.is_active ? (
                          <TrendingDown className="w-4 h-4" />
                        ) : (
                          <TrendingUp className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(method.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Transaksi Terbaru</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentTransactions.slice(0, 8).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      transaction.type === 'income' ? 'bg-green-500' : transaction.type === 'expense' ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {transaction.description}
                      </div>
                      <div className="text-xs text-gray-500">
                        {transaction.payment_method.name} • {new Date(transaction.transaction_date).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </div>
                  <div className={`font-semibold text-sm ${
                    transaction.type === 'income'
                      ? 'text-green-600'
                      : transaction.type === 'expense'
                        ? 'text-red-600'
                        : 'text-blue-600'
                  }`}>
                    {transaction.type === 'income'
                      ? '+'
                      : transaction.type === 'expense'
                        ? '-'
                        : ''}{formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Nama metode pembayaran"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipe
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'cash' | 'bank' | 'ewallet' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                >
                  <option value="cash">Kas Tunai</option>
                  <option value="bank">Bank</option>
                  <option value="ewallet">E-Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo Awal
                </label>
                <input
                  type="number"
                  value={form.balance}
                  onChange={(e) => setForm({ ...form, balance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="0"
                  required
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
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200"
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