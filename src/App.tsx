import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthForm } from './components/AuthForm'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { RDExpenses } from './pages/RDExpenses'
import { CustomSales } from './pages/CustomSales'
import { PaymentMethods } from './pages/PaymentMethods'
import { Reports } from './pages/Reports'
import IncomeStatement from './pages/IncomeStatement'
import { JournalEntries } from './pages/JournalEntries'
import Ledger from './pages/Ledger'
import { useAuth } from './hooks/useAuth'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return <AuthForm />
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout title="Dashboard" />}>
          <Route index element={<Dashboard />} />
        </Route>
        <Route path="/transactions" element={<Layout title="Transaksi" />}>
          <Route index element={<Transactions />} />
        </Route>
        <Route path="/rd-expenses" element={<Layout title="R&D Expenses" />}>
          <Route index element={<RDExpenses />} />
        </Route>
        <Route path="/custom-sales" element={<Layout title="Penjualan Custom" />}>
          <Route index element={<CustomSales />} />
        </Route>
        <Route path="/payment-methods" element={<Layout title="Kas & Bank" />}>
          <Route index element={<PaymentMethods />} />
        </Route>
        <Route path="/reports" element={<Layout title="Laporan" />}>
          <Route index element={<Reports />} />
        </Route>
        <Route path="/income-statement" element={<Layout title="Laporan Laba/Rugi" />}>
          <Route index element={<IncomeStatement />} />
        </Route>
        <Route path="/ledger" element={<Layout title="Buku Besar" />}>
          <Route index element={<Ledger />} />
        </Route>
        <Route path="/journal" element={<Layout title="Jurnal Umum" />}>
          <Route index element={<JournalEntries />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App