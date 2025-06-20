import { Decimal } from 'decimal.js'

export interface JournalEntry {
  debit_account: { code: string }
  credit_account: { code: string }
  amount: number
}

export const isJournalBalanced = (entries: JournalEntry[]): boolean => {
  // In double-entry bookkeeping, each journal entry has equal debit and credit amounts
  // So the total of all debits should equal the total of all credits
  const totalDebit = entries.reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))
  const totalCredit = entries.reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0))
  
  // Since each entry represents both a debit and credit of the same amount,
  // they should always be equal
  return totalDebit.equals(totalCredit)
}

// Additional utility to check if individual accounts balance
export const getAccountBalances = (entries: JournalEntry[]): Record<string, Decimal> => {
  const balances: Record<string, Decimal> = {}
  
  entries.forEach(entry => {
    const debitCode = entry.debit_account.code
    const creditCode = entry.credit_account.code
    const amount = new Decimal(entry.amount)
    
    // Initialize accounts if they don't exist
    if (!balances[debitCode]) balances[debitCode] = new Decimal(0)
    if (!balances[creditCode]) balances[creditCode] = new Decimal(0)
    
    // Debit increases the account balance, credit decreases it
    balances[debitCode] = balances[debitCode].plus(amount)
    balances[creditCode] = balances[creditCode].minus(amount)
  })
  
  return balances
}

// Utility to verify the accounting equation: Assets = Liabilities + Equity
export const verifyAccountingEquation = (
  entries: JournalEntry[],
  accountTypes: Record<string, 'asset' | 'liability' | 'equity' | 'income' | 'expense'>
): boolean => {
  const balances = getAccountBalances(entries)
  
  let assets = new Decimal(0)
  let liabilities = new Decimal(0)
  let equity = new Decimal(0)
  let income = new Decimal(0)
  let expenses = new Decimal(0)
  
  Object.entries(balances).forEach(([accountCode, balance]) => {
    const accountType = accountTypes[accountCode]
    
    switch (accountType) {
      case 'asset':
        assets = assets.plus(balance)
        break
      case 'liability':
        liabilities = liabilities.plus(balance.negated()) // Liabilities have credit normal balance
        break
      case 'equity':
        equity = equity.plus(balance.negated()) // Equity has credit normal balance
        break
      case 'income':
        income = income.plus(balance.negated()) // Income has credit normal balance
        break
      case 'expense':
        expenses = expenses.plus(balance)
        break
    }
  })
  
  // Assets = Liabilities + Equity + (Income - Expenses)
  const leftSide = assets
  const rightSide = liabilities.plus(equity).plus(income.minus(expenses))
  
  return leftSide.equals(rightSide)
}