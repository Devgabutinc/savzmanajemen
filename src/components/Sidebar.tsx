import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, DollarSign, FlaskRound as Flask, Package, CreditCard, FileText, LogOut, Menu, X, BookOpen } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

const menuItems = [
  { path: '/', icon: BarChart3, label: 'Dashboard', color: 'text-blue-500' },
  { path: '/transactions', icon: DollarSign, label: 'Transaksi', color: 'text-green-500' },
  { path: '/rd-expenses', icon: Flask, label: 'R&D Expenses', color: 'text-purple-500' },
  { path: '/custom-sales', icon: Package, label: 'Penjualan Custom', color: 'text-orange-500' },
  { path: '/payment-methods', icon: CreditCard, label: 'Kas & Bank', color: 'text-teal-500' },
  { path: '/ledger', icon: BookOpen, label: 'Buku Besar', color: 'text-gray-500' },
  { path: '/journal', icon: BookOpen, label: 'Jurnal Umum', color: 'text-gray-400' },
  { path: '/income-statement', icon: FileText, label: 'Laba/Rugi', color: 'text-indigo-500' },
  { path: '/reports', icon: FileText, label: 'Laporan', color: 'text-indigo-400' },
]

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 
        w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">SAVZ</h1>
            <button
              onClick={onToggle}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => window.innerWidth < 1024 && onToggle()}
                  className={`
                    flex items-center px-4 py-3 rounded-lg transition-colors duration-200
                    ${isActive 
                      ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-500' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-500' : item.color}`} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span className="font-medium">Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}