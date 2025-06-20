import React from 'react'
import { DivideIcon as LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  trend?: {
    value: string
    isPositive: boolean
  }
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal'
}

const colorClasses = {
  blue: 'bg-blue-500 text-blue-50',
  green: 'bg-green-500 text-green-50',
  red: 'bg-red-500 text-red-50',
  purple: 'bg-purple-500 text-purple-50',
  orange: 'bg-orange-500 text-orange-50',
  teal: 'bg-teal-500 text-teal-50',
}

export function StatCard({ title, value, icon: Icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{trend.isPositive ? '+' : ''}{trend.value}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}