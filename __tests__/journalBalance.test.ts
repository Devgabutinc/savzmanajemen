import { describe, it, expect } from 'vitest'
import { 
  isJournalBalanced, 
  getAccountBalances, 
  verifyAccountingEquation,
  JournalEntry 
} from '../src/utils/journalBalance'
import { Decimal } from 'decimal.js'

describe('Journal Balance Utility', () => {
  it('returns true when journal entries are properly balanced', () => {
    const entries: JournalEntry[] = [
      { debit_account: { code: '1100' }, credit_account: { code: '3000' }, amount: 1000 }, // Cash from Capital
      { debit_account: { code: '1500' }, credit_account: { code: '1100' }, amount: 500 },  // Inventory from Cash
      { debit_account: { code: '1100' }, credit_account: { code: '4000' }, amount: 800 }   // Cash from Sales
    ]
    expect(isJournalBalanced(entries)).toBe(true)
  })

  it('calculates correct account balances', () => {
    const entries: JournalEntry[] = [
      { debit_account: { code: '1100' }, credit_account: { code: '3000' }, amount: 1000 }, // Cash +1000, Capital -1000
      { debit_account: { code: '1500' }, credit_account: { code: '1100' }, amount: 500 },  // Inventory +500, Cash -500
      { debit_account: { code: '1100' }, credit_account: { code: '4000' }, amount: 800 }   // Cash +800, Sales -800
    ]
    
    const balances = getAccountBalances(entries)
    
    expect(balances['1100'].toNumber()).toBe(1300) // Cash: 1000 - 500 + 800 = 1300
    expect(balances['1500'].toNumber()).toBe(500)  // Inventory: 500
    expect(balances['3000'].toNumber()).toBe(-1000) // Capital: -1000 (credit balance)
    expect(balances['4000'].toNumber()).toBe(-800)  // Sales: -800 (credit balance)
  })

  it('verifies the accounting equation', () => {
    const entries: JournalEntry[] = [
      { debit_account: { code: '1100' }, credit_account: { code: '3000' }, amount: 1000 }, // Cash from Capital
      { debit_account: { code: '1500' }, credit_account: { code: '1100' }, amount: 300 },  // Inventory from Cash
      { debit_account: { code: '1100' }, credit_account: { code: '4000' }, amount: 500 },  // Cash from Sales
      { debit_account: { code: '2000' }, credit_account: { code: '1100' }, amount: 200 }   // Expense from Cash
    ]
    
    const accountTypes = {
      '1100': 'asset' as const,    // Cash
      '1500': 'asset' as const,    // Inventory
      '2000': 'expense' as const,  // Operating Expense
      '3000': 'equity' as const,   // Capital
      '4000': 'income' as const    // Sales
    }
    
    expect(verifyAccountingEquation(entries, accountTypes)).toBe(true)
  })

  it('handles empty journal entries', () => {
    const entries: JournalEntry[] = []
    expect(isJournalBalanced(entries)).toBe(true)
    
    const balances = getAccountBalances(entries)
    expect(Object.keys(balances)).toHaveLength(0)
  })

  it('handles single journal entry', () => {
    const entries: JournalEntry[] = [
      { debit_account: { code: '1100' }, credit_account: { code: '3000' }, amount: 1000 }
    ]
    
    expect(isJournalBalanced(entries)).toBe(true)
    
    const balances = getAccountBalances(entries)
    expect(balances['1100'].toNumber()).toBe(1000)
    expect(balances['3000'].toNumber()).toBe(-1000)
  })

  it('detects unbalanced entries in account balances', () => {
    const entries: JournalEntry[] = [
      { debit_account: { code: '1100' }, credit_account: { code: '3000' }, amount: 1000 },
      { debit_account: { code: '1500' }, credit_account: { code: '1100' }, amount: 1500 } // More than available cash
    ]
    
    const balances = getAccountBalances(entries)
    expect(balances['1100'].toNumber()).toBe(-500) // Cash would be negative
    expect(balances['1500'].toNumber()).toBe(1500) // Inventory
    expect(balances['3000'].toNumber()).toBe(-1000) // Capital
  })
})