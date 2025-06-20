export interface AccountInfo {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
}

export const CHART_OF_ACCOUNTS: Record<string, AccountInfo> = {
  '1100': { code: '1100', name: 'Kas', type: 'asset' },
  '1200': { code: '1200', name: 'Bank', type: 'asset' },
  '1300': { code: '1300', name: 'E-Wallet (Dana)', type: 'asset' },
  '1500': { code: '1500', name: 'Bahan Baku', type: 'asset' },
  '2000': { code: '2000', name: 'Biaya Operasional', type: 'expense' },
  '2100': { code: '2100', name: 'Biaya Inventory', type: 'expense' },
  '3000': { code: '3000', name: 'Modal', type: 'equity' },
  '3100': { code: '3100', name: 'Modal Fahri', type: 'equity' },
  '3200': { code: '3200', name: 'Modal Doni', type: 'equity' },
  '4000': { code: '4000', name: 'Penjualan', type: 'income' },
  '5000': { code: '5000', name: 'HPP', type: 'expense' },
  '6000': { code: '6000', name: 'Perlengkapan Operasional', type: 'asset' },
  '6100': { code: '6100', name: 'Biaya Domain & Email', type: 'expense' },
  '6200': { code: '6200', name: 'Biaya Promosi', type: 'expense' },
  '7000': { code: '7000', name: 'R&D', type: 'expense' }
}

export const getAccountNameByCode = (code: string): string => {
  return CHART_OF_ACCOUNTS[code]?.name || ''
}
