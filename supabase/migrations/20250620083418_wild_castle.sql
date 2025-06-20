/*
  # Fix Ledger Balance System

  1. Create proper journal entry functions for all transaction types
  2. Fix balance calculation in ledger
  3. Add missing journal entries for custom sales
  4. Ensure all transactions create proper journal entries
  5. Add function to recalculate all balances
*/

-- Function to create journal entries for custom sales
CREATE OR REPLACE FUNCTION create_custom_sales_journal_entries()
RETURNS TRIGGER AS $$
DECLARE
  debit_account_id uuid;
  credit_account_id uuid;
  payment_account_code text;
  cogs_account_id uuid;
  inventory_account_id uuid;
BEGIN
  -- Get payment method account code
  SELECT account_code INTO payment_account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  -- 1. Record the sale: Debit Cash/Bank/E-wallet, Credit Sales Revenue
  SELECT id INTO debit_account_id FROM accounts WHERE code = payment_account_code;
  SELECT id INTO credit_account_id FROM accounts WHERE code = '4000'; -- Sales Revenue
  
  INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
  VALUES (NEW.sale_date, 'Penjualan ke ' || NEW.customer_name, debit_account_id, credit_account_id, NEW.selling_price, 'SALE-' || NEW.id::text);
  
  -- 2. Record COGS: Debit COGS, Credit Inventory
  SELECT id INTO debit_account_id FROM accounts WHERE code = '5000'; -- COGS
  SELECT id INTO credit_account_id FROM accounts WHERE code = '1500'; -- Inventory
  
  INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
  VALUES (NEW.sale_date, 'COGS untuk penjualan ke ' || NEW.customer_name, debit_account_id, credit_account_id, NEW.cogs, 'COGS-' || NEW.id::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and create new one for custom sales journal entries
DROP TRIGGER IF EXISTS create_custom_sales_journal_entries_trigger ON custom_sales;
CREATE TRIGGER create_custom_sales_journal_entries_trigger
  AFTER INSERT ON custom_sales
  FOR EACH ROW EXECUTE FUNCTION create_custom_sales_journal_entries();

-- Function to get account by code with error handling
CREATE OR REPLACE FUNCTION get_account_id_by_code(account_code text)
RETURNS uuid AS $$
DECLARE
  account_id uuid;
BEGIN
  SELECT id INTO account_id FROM accounts WHERE code = account_code;
  
  IF account_id IS NULL THEN
    RAISE EXCEPTION 'Account with code % not found', account_code;
  END IF;
  
  RETURN account_id;
END;
$$ LANGUAGE plpgsql;

-- Improved function to create journal entries for transactions
CREATE OR REPLACE FUNCTION create_journal_entries()
RETURNS TRIGGER AS $$
DECLARE
  debit_account_id uuid;
  credit_account_id uuid;
  payment_account_code text;
BEGIN
  -- Get payment method account code
  SELECT account_code INTO payment_account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  IF payment_account_code IS NULL THEN
    RAISE EXCEPTION 'Payment method account code not found for payment_method_id %', NEW.payment_method_id;
  END IF;
  
  IF NEW.type = 'income' THEN
    -- Debit: Cash/Bank/E-wallet, Credit: Income
    debit_account_id := get_account_id_by_code(payment_account_code);
    credit_account_id := get_account_id_by_code('4000');
    
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (NEW.transaction_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'TRX-' || NEW.id::text);
    
  ELSIF NEW.type = 'expense' THEN
    -- Debit: Expense, Credit: Cash/Bank/E-wallet
    debit_account_id := get_account_id_by_code('2000');
    credit_account_id := get_account_id_by_code(payment_account_code);
    
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (NEW.transaction_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'TRX-' || NEW.id::text);
    
  ELSIF NEW.type = 'capital' THEN
    -- Debit: Cash/Bank/E-wallet, Credit: Capital
    debit_account_id := get_account_id_by_code(payment_account_code);
    credit_account_id := get_account_id_by_code('3000');
    
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (NEW.transaction_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'TRX-' || NEW.id::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Improved function to create journal entries for R&D expenses
CREATE OR REPLACE FUNCTION create_rd_expenses_journal_entries()
RETURNS TRIGGER AS $$
DECLARE
  debit_account_id uuid;
  credit_account_id uuid;
  payment_account_code text;
BEGIN
  -- Get payment method account code
  SELECT account_code INTO payment_account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  IF payment_account_code IS NULL THEN
    RAISE EXCEPTION 'Payment method account code not found for payment_method_id %', NEW.payment_method_id;
  END IF;
  
  -- Debit: R&D Expense (7000), Credit: Cash/Bank/E-wallet
  debit_account_id := get_account_id_by_code('7000');
  credit_account_id := get_account_id_by_code(payment_account_code);
  
  INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
  VALUES (NEW.expense_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'RD-' || NEW.id::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Improved function to create journal entries for DTF inventory
CREATE OR REPLACE FUNCTION create_dtf_inventory_journal_entries()
RETURNS TRIGGER AS $$
DECLARE
  debit_account_id uuid;
  credit_account_id uuid;
  payment_account_code text;
  total_cost numeric;
BEGIN
  -- Get payment method account code
  SELECT account_code INTO payment_account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  IF payment_account_code IS NULL THEN
    RAISE EXCEPTION 'Payment method account code not found for payment_method_id %', NEW.payment_method_id;
  END IF;
  
  -- Calculate total cost
  total_cost = NEW.total_length_cm * NEW.cost_per_cm;
  
  -- Debit: Inventory (1500), Credit: Cash/Bank/E-wallet
  debit_account_id := get_account_id_by_code('1500');
  credit_account_id := get_account_id_by_code(payment_account_code);
  
  INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
  VALUES (NEW.purchase_date, 'Pembelian DTF Roll: ' || NEW.roll_name, debit_account_id, credit_account_id, total_cost, 'DTF-' || NEW.id::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate all balances from journal entries
CREATE OR REPLACE FUNCTION recalculate_all_balances()
RETURNS void AS $$
DECLARE
  account_record RECORD;
  debit_total numeric;
  credit_total numeric;
  calculated_balance numeric;
BEGIN
  -- Loop through all accounts
  FOR account_record IN SELECT * FROM accounts LOOP
    -- Calculate total debits for this account
    SELECT COALESCE(SUM(amount), 0) INTO debit_total
    FROM journal_entries 
    WHERE debit_account_id = account_record.id;
    
    -- Calculate total credits for this account
    SELECT COALESCE(SUM(amount), 0) INTO credit_total
    FROM journal_entries 
    WHERE credit_account_id = account_record.id;
    
    -- Calculate balance based on account type and normal balance
    IF account_record.normal_balance = 'debit' THEN
      calculated_balance = debit_total - credit_total;
    ELSE
      calculated_balance = credit_total - debit_total;
    END IF;
    
    -- Update account balance
    UPDATE accounts 
    SET balance = calculated_balance 
    WHERE id = account_record.id;
  END LOOP;
  
  RAISE NOTICE 'All account balances have been recalculated from journal entries';
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate payment method balances
CREATE OR REPLACE FUNCTION recalculate_payment_method_balances()
RETURNS void AS $$
DECLARE
  pm_record RECORD;
  total_balance numeric;
BEGIN
  -- Loop through all payment methods
  FOR pm_record IN SELECT * FROM payment_methods LOOP
    -- Get balance from corresponding account
    SELECT COALESCE(balance, 0) INTO total_balance
    FROM accounts 
    WHERE code = pm_record.account_code;
    
    -- Update payment method balance
    UPDATE payment_methods 
    SET balance = total_balance 
    WHERE id = pm_record.id;
  END LOOP;
  
  RAISE NOTICE 'All payment method balances have been recalculated';
END;
$$ LANGUAGE plpgsql;

-- Create RPC function for recalculating balances (callable from frontend)
CREATE OR REPLACE FUNCTION recalc_balances_rpc()
RETURNS void AS $$
BEGIN
  PERFORM recalculate_all_balances();
  PERFORM recalculate_payment_method_balances();
END;
$$ LANGUAGE plpgsql;

-- Function to regenerate all journal entries (for fixing existing data)
CREATE OR REPLACE FUNCTION regenerate_journal_entries()
RETURNS void AS $$
DECLARE
  trx_record RECORD;
  rd_record RECORD;
  dtf_record RECORD;
  sale_record RECORD;
BEGIN
  -- Clear existing journal entries
  DELETE FROM journal_entries;
  
  -- Regenerate journal entries for transactions
  FOR trx_record IN 
    SELECT t.*, pm.account_code 
    FROM transactions t 
    JOIN payment_methods pm ON t.payment_method_id = pm.id 
  LOOP
    IF trx_record.type = 'income' THEN
      INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
      VALUES (
        trx_record.transaction_date, 
        trx_record.description, 
        get_account_id_by_code(trx_record.account_code),
        get_account_id_by_code('4000'),
        trx_record.amount, 
        'TRX-' || trx_record.id::text
      );
    ELSIF trx_record.type = 'expense' THEN
      INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
      VALUES (
        trx_record.transaction_date, 
        trx_record.description, 
        get_account_id_by_code('2000'),
        get_account_id_by_code(trx_record.account_code),
        trx_record.amount, 
        'TRX-' || trx_record.id::text
      );
    ELSIF trx_record.type = 'capital' THEN
      INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
      VALUES (
        trx_record.transaction_date, 
        trx_record.description, 
        get_account_id_by_code(trx_record.account_code),
        get_account_id_by_code('3000'),
        trx_record.amount, 
        'TRX-' || trx_record.id::text
      );
    END IF;
  END LOOP;
  
  -- Regenerate journal entries for R&D expenses
  FOR rd_record IN 
    SELECT r.*, pm.account_code 
    FROM rd_expenses r 
    JOIN payment_methods pm ON r.payment_method_id = pm.id 
  LOOP
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (
      rd_record.expense_date, 
      rd_record.description, 
      get_account_id_by_code('7000'),
      get_account_id_by_code(rd_record.account_code),
      rd_record.amount, 
      'RD-' || rd_record.id::text
    );
  END LOOP;
  
  -- Regenerate journal entries for DTF inventory
  FOR dtf_record IN 
    SELECT d.*, pm.account_code 
    FROM dtf_inventory d 
    JOIN payment_methods pm ON d.payment_method_id = pm.id 
  LOOP
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (
      dtf_record.purchase_date, 
      'Pembelian DTF Roll: ' || dtf_record.roll_name, 
      get_account_id_by_code('1500'),
      get_account_id_by_code(dtf_record.account_code),
      dtf_record.total_length_cm * dtf_record.cost_per_cm, 
      'DTF-' || dtf_record.id::text
    );
  END LOOP;
  
  -- Regenerate journal entries for custom sales
  FOR sale_record IN 
    SELECT c.*, pm.account_code 
    FROM custom_sales c 
    JOIN payment_methods pm ON c.payment_method_id = pm.id 
  LOOP
    -- Sales entry
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (
      sale_record.sale_date, 
      'Penjualan ke ' || sale_record.customer_name, 
      get_account_id_by_code(sale_record.account_code),
      get_account_id_by_code('4000'),
      sale_record.selling_price, 
      'SALE-' || sale_record.id::text
    );
    
    -- COGS entry
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (
      sale_record.sale_date, 
      'COGS untuk penjualan ke ' || sale_record.customer_name, 
      get_account_id_by_code('5000'),
      get_account_id_by_code('1500'),
      sale_record.cogs, 
      'COGS-' || sale_record.id::text
    );
  END LOOP;
  
  RAISE NOTICE 'All journal entries have been regenerated';
END;
$$ LANGUAGE plpgsql;

-- Create RPC function for regenerating journal entries (callable from frontend)
CREATE OR REPLACE FUNCTION regenerate_journal_entries_rpc()
RETURNS void AS $$
BEGIN
  PERFORM regenerate_journal_entries();
  PERFORM recalculate_all_balances();
  PERFORM recalculate_payment_method_balances();
END;
$$ LANGUAGE plpgsql;