import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface LayoutProps {
  title: string
}

export function Layout({ title }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuToggle={toggleSidebar} title={title} />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}