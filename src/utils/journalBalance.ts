import { Decimal } from 'decimal.js'

export interface JournalEntry {
  debit_account: { code: string }
  credit_account: { code: string }
  amount: number
}

export const isJournalBalanced = (entries: JournalEntry[]): boolean => {
  const totalDebit = entries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0))
  const totalCredit = entries.reduce((sum, e) => sum.plus(e.amount), new Decimal(0))
  return totalDebit.equals(totalCredit)
}
