import CHART_OF_ACCOUNTS from '../constants/chartOfAccounts'

export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

export const formatReference = (source: string, data: any): string => {
  switch (source) {
    case 'transactions':
      return `TRX - ${data.reference_number || '0001'}`
    case 'custom_sales': {
      const orderId = data.id.toString().slice(-4)
      return `ORD#${orderId.toUpperCase()}`
    }
    case 'rd_expenses':
      return `R&D - ${data.category || 'Umum'}`
    case 'inventory':
      return `INV - ${data.inventory_name || 'Umum'}`
    case 'cogs': {
      const orderId = data.id.toString().slice(-4)
      return `COGS-ORD#${orderId}`
    }
    default:
      return 'UMUM'
  }
}
