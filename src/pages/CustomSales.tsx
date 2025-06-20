import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Edit, Trash2, Package, Scissors, TrendingUp, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { exportToPdf } from '../utils/pdfExport'
import { logoBase64 } from '../../logoBase64'

interface DTFRoll {
  id: string
  roll_name: string
  total_length_cm: number
  used_length_cm: number
  remaining_length_cm: number
  cost_per_cm: number
  cost_per_meter: number
  supplier?: string
  is_finished: boolean
  payment_method: {
    name: string
    account_code: string
  }
  account_code: string
}

interface CustomSale {
  id: string
  customer_name: string
  length_used_cm: number
  dtf_cost: number
  press_cost: number
  other_costs: number
  total_hpp: number
  cogs: number
  selling_price: number
  profit: number
  sale_date: string
  notes?: string
  dtf_roll: {
    roll_name: string
  }
  roll_name: string
  payment_method_id: string
  payment_method: {
    name: string
    account_code: string
  }
  name: string
  account_code: string
}

interface CustomSaleForm {
  dtf_roll_id: string
  customer_name: string
  length_used_cm: string
  press_cost: string
  other_costs: string
  selling_price: string
  sale_date: string
  quantity: string
  notes: string
  payment_method_id: string
}

interface DTFInventoryForm {
  roll_name: string
  total_length_cm: string
  cost_per_meter: string
  purchase_date: string
  supplier: string
  notes: string
  payment_method_id: string
}

export function CustomSales() {
  const [sales, setSales] = useState<CustomSale[]>([])
  const [dtfRolls, setDtfRolls] = useState<DTFRoll[]>([])
  const [paymentMethods, setPaymentMethods] = useState<{id: string, name: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [showInventoryForm, setShowInventoryForm] = useState(false)
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null)
  const [inventoryToDelete, setInventoryToDelete] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory'>('sales')
  const { user } = useAuth()

  const [saleForm, setSaleForm] = useState<CustomSaleForm>({
    dtf_roll_id: '',
    customer_name: '',
    length_used_cm: '',
    press_cost: '',
    other_costs: '0',
    selling_price: '',
    sale_date: new Date().toISOString().split('T')[0],
    quantity: '1',
    notes: '',
    payment_method_id: ''
  })

  const [inventoryForm, setInventoryForm] = useState<DTFInventoryForm>({
    roll_name: '',
    total_length_cm: '',
    cost_per_meter: '',
    purchase_date: new Date().toISOString().split('T')[0],
    supplier: '',
    notes: '',
    payment_method_id: ''
  })

  // --- NEW: Filter states ---
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Filtered sales derived from current filters
  const filteredSales = sales.filter((s) => {
    const search = searchTerm.toLowerCase()
    const matchesSearch =
      s.customer_name.toLowerCase().includes(search) ||
      (s.dtf_roll?.roll_name || s.roll_name || '').toLowerCase().includes(search)

    const dateOk =
      (!startDate || s.sale_date >= startDate) &&
      (!endDate || s.sale_date <= endDate)

    return matchesSearch && dateOk
  })

  // --- NEW: PDF Export handler ---
  const handleExportPdf = () => {
    if (filteredSales.length === 0) {
      alert('Tidak ada data untuk diexport.')
      return
    }

    const headers = [
      'Tanggal',
      'Customer',
      'Roll',
      'Panjang (cm)',
      'Harga Jual',
      'HPP',
      'Profit',
      'Metode'
    ]

    const rows = filteredSales.map((s) => [
      s.sale_date,
      s.customer_name,
      s.dtf_roll?.roll_name || s.roll_name,
      s.length_used_cm,
      formatCurrency(s.selling_price),
      formatCurrency(s.total_hpp),
      formatCurrency(s.profit),
      s.payment_method?.name || '-'
    ])

    const subtitle = startDate || endDate ? `Periode ${startDate || '...'} s/d ${endDate || '...'}` : undefined

    exportToPdf('Penjualan Custom', headers, rows, {
      subtitle,
      printedAt: `Dicetak ${new Date().toLocaleString('id-ID')}`,
      logoBase64,
    })
  }

  useEffect(() => {
    if (user) {
      fetchData()
      fetchPaymentMethods()
    }
  }, [user])

  const fetchPaymentMethods = async () => {
    try {
      const { data } = await supabase
        .from('payment_methods')
        .select('id, name')
        .eq('is_active', true)
      
      if (data) {
        setPaymentMethods(data)
        // Set default payment method if none selected
        if (!saleForm.payment_method_id && data.length > 0) {
          setSaleForm(f => ({ ...f, payment_method_id: data[0].id }))
        }
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch custom sales
      const { data: salesData } = await supabase
        .from('custom_sales')
        .select(`
          *,
          dtf_roll:dtf_inventory(roll_name),
          payment_method:payment_methods(name, account_code)
        `)
        .eq('user_id', user?.id)
        .order('sale_date', { ascending: false })

      // Fetch DTF inventory
      const { data: inventoryData } = await supabase
        .from('dtf_inventory')
        .select('*')
        .eq('user_id', user?.id)
        .order('purchase_date', { ascending: false })

      setSales(salesData || [])
      setDtfRolls(inventoryData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const lengthUsed = parseFloat(saleForm.length_used_cm)
      if (lengthUsed > 9999999.99 || lengthUsed < 0) {
        throw new Error('Panjang harus antara 0 dan 9999999.99 cm')
      }

      const pressCost = parseFloat(saleForm.press_cost)
      if (pressCost > 99999.99 || pressCost < 0) {
        throw new Error('Biaya press harus antara 0 dan 99999.99')
      }

      const otherCosts = parseFloat(saleForm.other_costs)
      if (otherCosts > 99999.99 || otherCosts < 0) {
        throw new Error('Biaya lain-lain harus antara 0 dan 99999.99')
      }

      const sellingPrice = parseFloat(saleForm.selling_price)
      if (sellingPrice > 99999999.99 || sellingPrice < 0) {
        throw new Error('Harga jual total harus antara 0 dan 99999999.99')
      }

      const quantity = parseInt(saleForm.quantity)
      if (quantity <= 0) {
        throw new Error('Jumlah harus lebih dari 0')
      }

      if (!saleForm.payment_method_id) {
        throw new Error('Metode pembayaran harus dipilih')
      }

      console.log('Input values:', {
        lengthUsed,
        pressCost,
        otherCosts,
        sellingPrice,
        quantity,
      })

      // Check if dtfRolls is loaded
      if (loading || !dtfRolls || dtfRolls.length === 0) {
        throw new Error('Daftar DTF roll belum dimuat')
      }

      // Validate dtf_roll_id
      const dtfRollId = saleForm.dtf_roll_id?.toString()
      if (!dtfRollId || typeof dtfRollId !== 'string') {
        throw new Error('ID DTF roll tidak valid')
      }

      // Get selected roll first
      const selectedRoll = dtfRolls.find(roll => roll.id === dtfRollId)
      if (!selectedRoll) {
        throw new Error('DTF roll tidak ditemukan')
      }

      // Validate cost_per_cm
      if (selectedRoll.cost_per_cm > 999.9999 || selectedRoll.cost_per_cm < 0) {
        throw new Error('Harga per cm DTF harus antara 0 dan 999.9999')
      }

      // Validate total length used
      if (lengthUsed > selectedRoll.remaining_length_cm) {
        throw new Error(`Total panjang yang digunakan (${lengthUsed} cm) melebihi stok tersedia (${selectedRoll.remaining_length_cm} cm)`) 
      }

      console.log('Length calculations:', {
        lengthUsed,
        rollTotalLength: selectedRoll.total_length_cm,
        rollRemaining: selectedRoll.remaining_length_cm
      })

      // Calculate maximum allowed cost_per_cm
      const maxCostPerCm = Math.min(99999999.99 / lengthUsed, 999.9999)
      console.log('Maximum cost_per_cm calculation:', {
        lengthUsed,
        maxCostPerCm,
        calculation: `min(99999999.99 / ${lengthUsed}, 999.9999) = ${maxCostPerCm}`
      })

      if (selectedRoll.cost_per_cm > maxCostPerCm) {
        throw new Error(`Harga per cm DTF terlalu tinggi. Maksimum yang diperbolehkan adalah ${maxCostPerCm.toFixed(4)}`)
      }

      // Calculate other values
      const totalPressCost = pressCost * quantity
      if (totalPressCost > 99999999.99) {
        throw new Error('Total biaya press melebihi batas maksimum')
      }

      const totalOtherCosts = otherCosts * quantity
      if (totalOtherCosts > 99999999.99) {
        throw new Error('Total biaya lain-lain melebihi batas maksimum')
      }

      // Calculate dtf_cost with validation
      const dtfCost = lengthUsed * selectedRoll.cost_per_cm
      if (dtfCost > 99999999.99) {
        throw new Error('Biaya DTF melebihi batas maksimum')
      }

      const totalHpp = totalPressCost + totalOtherCosts + dtfCost
      const profit = sellingPrice - totalHpp

      // Validate profit
      if (profit < -99999999.99 || profit > 99999999.99) {
        throw new Error('Keuntungan melebihi batas maksimum')
      }

      console.log('Final calculations:', {
        totalHpp,
        profit,
        sellingPrice,
        totalPressCost,
        totalOtherCosts,
        dtfCost
      })

      // Round all numeric values to 2 decimal places
      const roundedValues = {
        length_used_cm: lengthUsed.toFixed(2),
        dtf_cost: dtfCost.toFixed(2),
        press_cost: totalPressCost.toFixed(2),
        other_costs: totalOtherCosts.toFixed(2),
        total_hpp: totalHpp.toFixed(2),
        cogs: totalHpp.toFixed(2),
        selling_price: sellingPrice.toFixed(2),
        profit: profit.toFixed(2),
        cost_per_cm: selectedRoll.cost_per_cm.toFixed(4)
      }

      console.log('Rounded values:', roundedValues)

      const saleData = {
        dtf_roll_id: saleForm.dtf_roll_id,
        customer_name: saleForm.customer_name,
        ...roundedValues,
        sale_date: saleForm.sale_date,
        notes: saleForm.notes,
        quantity: quantity,
        payment_method_id: saleForm.payment_method_id,
        user_id: user?.id
      }

      if (editingSaleId) {
        await supabase
          .from('custom_sales')
          .update(saleData)
          .eq('id', editingSaleId)
      } else {
        await supabase
          .from('custom_sales')
          .insert(saleData)
      }

      fetchData()
      setShowSaleForm(false)
      setEditingSaleId(null)
      setSaleForm({
        dtf_roll_id: '',
        customer_name: '',
        length_used_cm: '',
        press_cost: '',
        other_costs: '0',
        selling_price: '',
        sale_date: new Date().toISOString().split('T')[0],
        quantity: '1',
        notes: '',
        payment_method_id: saleForm.payment_method_id
      })
    } catch (error) {
      console.error('Error saving sale:', error)
      alert(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const totalLength = parseFloat(inventoryForm.total_length_cm)
      const costPerMeter = parseFloat(inventoryForm.cost_per_meter)
      const costPerCm = costPerMeter / 100

      if (totalLength <= 0) {
        throw new Error('Panjang harus lebih dari 0')
      }

      if (costPerMeter <= 0) {
        throw new Error('Harga per meter harus lebih dari 0')
      }

      if (!inventoryForm.payment_method_id) {
        throw new Error('Metode pembayaran harus dipilih')
      }

      const inventoryData = {
        ...inventoryForm,
        total_length_cm: totalLength,
        cost_per_meter: costPerMeter,
        cost_per_cm: costPerCm,
        user_id: user?.id,
      }

      if (editingInventoryId) {
        await supabase
          .from('dtf_inventory')
          .update(inventoryData)
          .eq('id', editingInventoryId)
      } else {
        await supabase
          .from('dtf_inventory')
          .insert([inventoryData])
      }

      fetchData()
      setShowInventoryForm(false)
      setEditingInventoryId(null)
      setInventoryForm({
        roll_name: '',
        total_length_cm: '',
        cost_per_meter: '',
        purchase_date: new Date().toISOString().split('T')[0],
        supplier: '',
        notes: '',
        payment_method_id: ''
      })
    } catch (error) {
      console.error('Error saving inventory:', error)
      alert(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const handleEditSale = (sale: CustomSale) => {
    setSaleForm({
      dtf_roll_id: '', // You'd need to get this from the sale data
      customer_name: sale.customer_name,
      length_used_cm: sale.length_used_cm.toString(),
      press_cost: sale.press_cost.toString(),
      other_costs: sale.other_costs.toString(),
      selling_price: sale.selling_price.toString(),
      sale_date: sale.sale_date,
      quantity: '1',
      notes: sale.notes || '',
      payment_method_id: sale.payment_method_id
    })
    setEditingSaleId(sale.id)
    setShowSaleForm(true)
  }

  const handleDeleteSale = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus penjualan ini?')) {
      try {
        await supabase
          .from('custom_sales')
          .delete()
          .eq('id', id)
        fetchData()
      } catch (error) {
        console.error('Error deleting custom sale:', error)
      }
    }
  }

  const handleEditInventory = async (id: string) => {
    try {
      const { data } = await supabase
        .from('dtf_inventory')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        setInventoryForm({
          roll_name: data.roll_name,
          total_length_cm: data.total_length_cm.toString(),
          cost_per_meter: data.cost_per_meter.toString(),
          purchase_date: data.purchase_date,
          supplier: data.supplier,
          notes: data.notes,
          payment_method_id: data.payment_method_id
        })
        setShowInventoryForm(true)
        setEditingInventoryId(id)
      }
    } catch (error) {
      console.error('Error fetching inventory:', error)
    }
  }

  const handleDeleteInventory = async (id: string) => {
    try {
      await supabase
        .from('dtf_inventory')
        .delete()
        .eq('id', id)

      setInventoryToDelete(null)
      fetchData()
    } catch (error) {
      console.error('Error deleting inventory:', error)
    }
  }

  const handleConfirmDelete = (id: string) => {
    setInventoryToDelete(id)
  }

  const handleCancelDelete = () => {
    setInventoryToDelete(null)
  }

  const resetSaleForm = () => {
    setSaleForm({
      dtf_roll_id: '',
      customer_name: '',
      length_used_cm: '',
      press_cost: '',
      other_costs: '0',
      selling_price: '',
      sale_date: new Date().toISOString().split('T')[0],
      quantity: '1',
      notes: '',
      payment_method_id: ''
    })
  }

  const resetInventoryForm = () => {
    setInventoryForm({
      roll_name: '',
      total_length_cm: '',
      cost_per_meter: '',
      purchase_date: new Date().toISOString().split('T')[0],
      supplier: '',
      notes: '',
      payment_method_id: ''
    })
  }

  const filteredInventory = dtfRolls.filter(roll => 
    roll.roll_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (roll.supplier && roll.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const totalSales = sales.reduce((sum, sale) => sum + sale.selling_price, 0)
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0)
  const totalInventoryValue = dtfRolls.reduce((sum, roll) => sum + (roll.remaining_length_cm * roll.cost_per_cm), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Penjualan Custom</h2>
          <p className="text-gray-600">Kelola penjualan custom dan inventory DTF</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInventoryForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Package className="w-5 h-5 mr-2" />
            Tambah DTF
          </button>
          <button
            onClick={() => setShowSaleForm(true)}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Penjualan
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Penjualan</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalSales)}</p>
            </div>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Profit</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Nilai Inventory</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalInventoryValue)}</p>
            </div>
            <Scissors className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('sales')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'sales'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Penjualan Custom
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inventory'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inventory DTF
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={activeTab === 'sales' ? 'Cari penjualan...' : 'Cari inventory...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filter & Export controls */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="pl-8 pr-2 py-1 border rounded"
                placeholder="Cari..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-1 rounded"
            />
            <span>-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-1 rounded"
            />
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded"
            >
              <FileText className="h-4 w-4" /> Export PDF
            </button>
          </div>

          {/* Content */}
          {activeTab === 'sales' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DTF Roll
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Panjang (cm)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      HPP
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Harga Jual
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sale.sale_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{sale.customer_name}</div>
                        {sale.notes && (
                          <div className="text-gray-500 text-xs">{sale.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.dtf_roll.roll_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {sale.length_used_cm} cm
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                        {formatCurrency(sale.total_hpp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(sale.selling_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className={sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(sale.profit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditSale(sale)}
                            className="text-orange-600 hover:text-orange-800"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nama Roll
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total (cm)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Terpakai (cm)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sisa (cm)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Harga/cm
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
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
                  {filteredInventory.map((roll) => (
                    <tr key={roll.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{roll.roll_name}</div>
                        <div className="text-gray-500 text-xs">
                          {new Date(roll.purchase_date).toLocaleDateString('id-ID')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {roll.total_length_cm}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                        {roll.used_length_cm}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600">
                        {roll.remaining_length_cm}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(roll.cost_per_cm)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {roll.supplier || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {roll.is_finished ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Habis
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Tersedia
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditInventory(roll.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleConfirmDelete(roll.id)}
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
          )}
        </div>
      </div>

      {/* Sale Form Modal */}
      {showSaleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSaleId ? 'Edit Penjualan' : 'Tambah Penjualan Custom'}
            </h3>
            
            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DTF Roll
                </label>
                <select
                  value={saleForm.dtf_roll_id}
                  onChange={(e) => setSaleForm({ ...saleForm, dtf_roll_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih DTF Roll</option>
                  {dtfRolls.filter(roll => !roll.is_finished).map(roll => (
                    <option key={roll.id} value={roll.id}>
                      {roll.roll_name} (Sisa: {roll.remaining_length_cm} cm)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer
                    </label>
                    <input
                      type="text"
                      value={saleForm.customer_name}
                      onChange={(e) => setSaleForm({ ...saleForm, customer_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Nama customer"
                      required
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Panjang Digunakan (cm)
                    </label>
                    <input
                      type="number"
                      value={saleForm.length_used_cm}
                      onChange={(e) => {
                        const value = e.target.value
                        const numValue = value.replace(/[^0-9]/g, '')
                        setSaleForm({ ...saleForm, length_used_cm: numValue })
                      }}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Panjang per unit dalam cm
                    </p>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Harga Jual Total
                    </label>
                    <input
                      type="number"
                      value={saleForm.selling_price}
                      onChange={(e) => {
                        const value = e.target.value
                        const numValue = value.replace(/[^0-9]/g, '')
                        setSaleForm({ ...saleForm, selling_price: numValue })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Total harga jual untuk semua pcs
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Biaya Press
                    </label>
                    <input
                      type="number"
                      value={saleForm.press_cost}
                      onChange={(e) => {
                        const value = e.target.value
                        const numValue = value.replace(/[^0-9]/g, '')
                        setSaleForm({ ...saleForm, press_cost: numValue })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Contoh: 10000 (total)
                    </p>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Biaya Lain-lain
                    </label>
                    <input
                      type="number"
                      value={saleForm.other_costs}
                      onChange={(e) => {
                        const value = e.target.value
                        const numValue = value.replace(/[^0-9]/g, '')
                        setSaleForm({ ...saleForm, other_costs: numValue })
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Contoh: 0 (total)
                    </p>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal Penjualan
                    </label>
                    <input
                      type="date"
                      value={saleForm.sale_date}
                      onChange={(e) => setSaleForm({ ...saleForm, sale_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catatan
                    </label>
                    <textarea
                      value={saleForm.notes}
                      onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={saleForm.payment_method_id}
                  onChange={(e) => setSaleForm({ ...saleForm, payment_method_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih metode pembayaran</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-8">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Detail DTF
                </h4>
                <div className="text-sm text-gray-500 space-y-2">
                  <div>
                    <span className="font-medium">Harga DTF per cm:</span>
                    <span className="ml-2">Rp {dtfRolls.find(roll => roll.id === saleForm.dtf_roll_id)?.cost_per_cm || '0'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Stok Tersedia:</span>
                    <span className="ml-2">{dtfRolls.find(roll => roll.id === saleForm.dtf_roll_id)?.remaining_length_cm || '0'} cm</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaleForm(false)
                    setEditingSaleId(null)
                    resetSaleForm()
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200"
                >
                  {editingSaleId ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inventory Form Modal */}
      {showInventoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingInventoryId ? 'Edit DTF Inventory' : 'Tambah DTF Inventory'}
            </h3>
            
            <form onSubmit={handleInventorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Roll
                </label>
                <input
                  type="text"
                  value={inventoryForm.roll_name}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, roll_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nama roll DTF"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Panjang (cm)
                </label>
                <input
                  type="text"
                  value={inventoryForm.total_length_cm}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value.replace(/[^0-9]/g, '')
                    setInventoryForm({ ...inventoryForm, total_length_cm: numValue })
                  }}
                  placeholder="Contoh: 1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga per meter
                </label>
                <input
                  type="text"
                  value={inventoryForm.cost_per_meter}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value.replace(/[^0-9]/g, '')
                    setInventoryForm({ ...inventoryForm, cost_per_meter: numValue })
                  }}
                  placeholder="Contoh: 45000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal Pembelian
                </label>
                <input
                  type="date"
                  value={inventoryForm.purchase_date}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, purchase_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
                
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={inventoryForm.supplier}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, supplier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nama supplier"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={inventoryForm.payment_method_id}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, payment_method_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="">Pilih metode pembayaran</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={inventoryForm.notes}
                  onChange={(e) => setInventoryForm({ ...inventoryForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Catatan tambahan..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInventoryForm(false)
                    resetInventoryForm()
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {editingInventoryId ? 'Update' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {inventoryToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Hapus DTF Inventory
            </h3>
            
            <p className="text-gray-600 mb-4">
              Apakah Anda yakin ingin menghapus DTF inventory ini?
            </p>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteInventory(inventoryToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}