import { describe, it, expect } from 'vitest'
import { isJournalBalanced, JournalEntry } from '../src/utils/journalBalance'

describe('Journal Balance Utility', () => {
  it('returns true when total debit equals total credit', () => {
    const entries: JournalEntry[] = [
      { debit_account: { code: '1100' }, credit_account: { code: '1000' }, amount: 100 },
      { debit_account: { code: '2000' }, credit_account: { code: '1100' }, amount: 50 },
      { debit_account: { code: '1300' }, credit_account: { code: '2000' }, amount: 50 }
    ]
    expect(isJournalBalanced(entries)).toBe(true)
  })
})
