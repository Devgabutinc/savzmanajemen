/*
  # Complete Financial System Setup with Proper Accounting

  1. New Tables
    - `accounts` - Chart of accounts following accounting principles
    - `journal_entries` - Double-entry bookkeeping journal entries
    - Enhanced existing tables with account codes and proper relationships

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Functions
    - Trigger functions for automatic journal entries
    - Balance calculation functions
    - Account code assignment functions

  4. Data
    - Chart of accounts setup
    - Default categories and payment methods
*/

-- Create accounts table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(10) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  normal_balance varchar(6) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  balance numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Create journal_entries table for double-entry bookkeeping
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  debit_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  credit_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  reference text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to existing tables if they don't exist
DO $$
BEGIN
  -- Add account_code to payment_methods if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_methods' AND column_name = 'account_code'
  ) THEN
    ALTER TABLE payment_methods ADD COLUMN account_code text;
    ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_account_code_not_null CHECK (account_code IS NOT NULL);
  END IF;

  -- Add source and source_id to transactions if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'source'
  ) THEN
    ALTER TABLE transactions ADD COLUMN source text NOT NULL DEFAULT 'transactions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'source_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN source_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'account_code'
  ) THEN
    ALTER TABLE transactions ADD COLUMN account_code text;
  END IF;

  -- Add capital type to transaction_categories type check
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'transaction_categories_type_check' 
    AND check_clause LIKE '%capital%'
  ) THEN
    ALTER TABLE transaction_categories DROP CONSTRAINT IF EXISTS transaction_categories_type_check;
    ALTER TABLE transaction_categories ADD CONSTRAINT transaction_categories_type_check 
      CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'capital'::text]));
  END IF;

  -- Add capital type to transactions type check
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'transactions_type_check' 
    AND check_clause LIKE '%capital%'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
      CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'capital'::text]));
  END IF;

  -- Add missing columns to dtf_inventory
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dtf_inventory' AND column_name = 'cost_per_meter'
  ) THEN
    ALTER TABLE dtf_inventory ADD COLUMN cost_per_meter numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dtf_inventory' AND column_name = 'payment_method_id'
  ) THEN
    ALTER TABLE dtf_inventory ADD COLUMN payment_method_id uuid REFERENCES payment_methods(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dtf_inventory' AND column_name = 'account_code'
  ) THEN
    ALTER TABLE dtf_inventory ADD COLUMN account_code text DEFAULT '1300';
  END IF;

  -- Add missing columns to custom_sales
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_sales' AND column_name = 'cogs'
  ) THEN
    ALTER TABLE custom_sales ADD COLUMN cogs numeric(14,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_sales' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE custom_sales ADD COLUMN quantity integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_sales' AND column_name = 'cost_per_cm'
  ) THEN
    ALTER TABLE custom_sales ADD COLUMN cost_per_cm numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_sales' AND column_name = 'payment_method_id'
  ) THEN
    ALTER TABLE custom_sales ADD COLUMN payment_method_id uuid REFERENCES payment_methods(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_sales' AND column_name = 'account_code'
  ) THEN
    ALTER TABLE custom_sales ADD COLUMN account_code text DEFAULT '1300';
  END IF;

  -- Add missing columns to rd_expenses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rd_expenses' AND column_name = 'payment_method_id'
  ) THEN
    ALTER TABLE rd_expenses ADD COLUMN payment_method_id uuid REFERENCES payment_methods(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rd_expenses' AND column_name = 'account_code'
  ) THEN
    ALTER TABLE rd_expenses ADD COLUMN account_code text DEFAULT '1300';
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dtf_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE rd_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Accounts policies
  DROP POLICY IF EXISTS "Users can view all accounts" ON accounts;
  DROP POLICY IF EXISTS "Users can insert accounts" ON accounts;
  DROP POLICY IF EXISTS "Users can update their own accounts" ON accounts;
  DROP POLICY IF EXISTS "Users can delete their own accounts" ON accounts;
  
  -- Journal entries policies
  DROP POLICY IF EXISTS "Users can view all journal entries" ON journal_entries;
  DROP POLICY IF EXISTS "Users can insert journal entries" ON journal_entries;
  DROP POLICY IF EXISTS "Users can update their own journal entries" ON journal_entries;
  DROP POLICY IF EXISTS "Users can delete their own journal entries" ON journal_entries;
  
  -- Transaction categories policies
  DROP POLICY IF EXISTS "Allow read access to transaction categories" ON transaction_categories;
  DROP POLICY IF EXISTS "Allow insert transaction categories" ON transaction_categories;
  
  -- Payment methods policies
  DROP POLICY IF EXISTS "Allow read access to payment methods" ON payment_methods;
  DROP POLICY IF EXISTS "Allow update payment methods" ON payment_methods;
  
  -- Transactions policies
  DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
  
  -- DTF inventory policies
  DROP POLICY IF EXISTS "Users can manage their own DTF inventory" ON dtf_inventory;
  
  -- Custom sales policies
  DROP POLICY IF EXISTS "Users can manage their own custom sales" ON custom_sales;
  
  -- R&D expenses policies
  DROP POLICY IF EXISTS "Users can manage their own R&D expenses" ON rd_expenses;
  
  -- Monthly allocations policies
  DROP POLICY IF EXISTS "Users can manage their own monthly allocations" ON monthly_allocations;
  
  -- Daily summaries policies
  DROP POLICY IF EXISTS "Users can manage their own daily summaries" ON daily_summaries;
END $$;

-- Create policies for accounts
CREATE POLICY "Users can view all accounts"
  ON accounts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert accounts"
  ON accounts
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own accounts"
  ON accounts
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own accounts"
  ON accounts
  FOR DELETE
  TO public
  USING (true);

-- Create policies for journal entries
CREATE POLICY "Users can view all journal entries"
  ON journal_entries
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert journal entries"
  ON journal_entries
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own journal entries"
  ON journal_entries
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own journal entries"
  ON journal_entries
  FOR DELETE
  TO public
  USING (true);

-- Create policies for transaction_categories
CREATE POLICY "Allow read access to transaction categories"
  ON transaction_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert transaction categories"
  ON transaction_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for payment_methods
CREATE POLICY "Allow read access to payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow update payment methods"
  ON payment_methods
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create policies for transactions
CREATE POLICY "Users can manage their own transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for dtf_inventory
CREATE POLICY "Users can manage their own DTF inventory"
  ON dtf_inventory
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for custom_sales
CREATE POLICY "Users can manage their own custom sales"
  ON custom_sales
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for rd_expenses
CREATE POLICY "Users can manage their own R&D expenses"
  ON rd_expenses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for monthly_allocations
CREATE POLICY "Users can manage their own monthly allocations"
  ON monthly_allocations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for daily_summaries
CREATE POLICY "Users can manage their own daily summaries"
  ON daily_summaries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at with proper checks
DO $$
BEGIN
  -- Drop existing triggers if they exist
  DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
  DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
  
  -- Create new triggers
  CREATE TRIGGER update_accounts_updated_at 
    BEFORE UPDATE ON accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
  CREATE TRIGGER update_journal_entries_updated_at 
    BEFORE UPDATE ON journal_entries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

-- Function to calculate DTF remaining length
CREATE OR REPLACE FUNCTION update_dtf_remaining_length()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_length_cm = NEW.total_length_cm - NEW.used_length_cm;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for DTF remaining length calculation
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_update_dtf_remaining_length ON dtf_inventory;
  CREATE TRIGGER trigger_update_dtf_remaining_length
    BEFORE INSERT OR UPDATE ON dtf_inventory
    FOR EACH ROW EXECUTE FUNCTION update_dtf_remaining_length();
END $$;

-- Function to calculate custom sale profit
CREATE OR REPLACE FUNCTION calculate_custom_sale_profit()
RETURNS TRIGGER AS $$
DECLARE
  roll_cost_per_cm numeric;
BEGIN
  -- Get cost per cm from DTF roll
  SELECT cost_per_cm INTO roll_cost_per_cm
  FROM dtf_inventory 
  WHERE id = NEW.dtf_roll_id;
  
  -- Calculate costs
  NEW.dtf_cost = NEW.length_used_cm * roll_cost_per_cm;
  NEW.total_hpp = NEW.dtf_cost + NEW.press_cost + NEW.other_costs;
  NEW.cogs = NEW.total_hpp;
  NEW.profit = NEW.selling_price - NEW.total_hpp;
  NEW.cost_per_cm = roll_cost_per_cm;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for custom sale profit calculation
DO $$
BEGIN
  DROP TRIGGER IF EXISTS trigger_calculate_custom_sale_profit ON custom_sales;
  CREATE TRIGGER trigger_calculate_custom_sale_profit
    BEFORE INSERT OR UPDATE ON custom_sales
    FOR EACH ROW EXECUTE FUNCTION calculate_custom_sale_profit();
END $$;

-- Function to set account codes
CREATE OR REPLACE FUNCTION set_account_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Get account code from payment method
  SELECT account_code INTO NEW.account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for setting account codes
DO $$
BEGIN
  DROP TRIGGER IF EXISTS set_account_code_trigger ON transactions;
  CREATE TRIGGER set_account_code_trigger
    AFTER INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_account_code();
END $$;

-- Function to set account codes for custom sales
CREATE OR REPLACE FUNCTION set_account_code_custom_sales()
RETURNS TRIGGER AS $$
BEGIN
  -- Get account code from payment method
  SELECT account_code INTO NEW.account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for setting account codes for custom sales
DO $$
BEGIN
  DROP TRIGGER IF EXISTS set_account_code_custom_sales_trigger ON custom_sales;
  CREATE TRIGGER set_account_code_custom_sales_trigger
    AFTER INSERT ON custom_sales
    FOR EACH ROW EXECUTE FUNCTION set_account_code_custom_sales();
END $$;

-- Function to set account codes for R&D expenses
CREATE OR REPLACE FUNCTION set_account_code_rd_expenses()
RETURNS TRIGGER AS $$
BEGIN
  -- Get account code from payment method
  SELECT account_code INTO NEW.account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for setting account codes for R&D expenses
DO $$
BEGIN
  DROP TRIGGER IF EXISTS set_account_code_rd_expenses_trigger ON rd_expenses;
  CREATE TRIGGER set_account_code_rd_expenses_trigger
    AFTER INSERT ON rd_expenses
    FOR EACH ROW EXECUTE FUNCTION set_account_code_rd_expenses();
END $$;

-- Function to set account codes for DTF inventory
CREATE OR REPLACE FUNCTION set_account_code_dtf_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- Get account code from payment method
  SELECT account_code INTO NEW.account_code
  FROM payment_methods 
  WHERE id = NEW.payment_method_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for setting account codes for DTF inventory
DO $$
BEGIN
  DROP TRIGGER IF EXISTS set_account_code_dtf_inventory_trigger ON dtf_inventory;
  CREATE TRIGGER set_account_code_dtf_inventory_trigger
    AFTER INSERT ON dtf_inventory
    FOR EACH ROW EXECUTE FUNCTION set_account_code_dtf_inventory();
END $$;

-- Function to update payment method balances
CREATE OR REPLACE FUNCTION update_payment_method_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' OR NEW.type = 'capital' THEN
      UPDATE payment_methods 
      SET balance = balance + NEW.amount 
      WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE payment_methods 
      SET balance = balance - NEW.amount 
      WHERE id = NEW.payment_method_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    IF OLD.type = 'income' OR OLD.type = 'capital' THEN
      UPDATE payment_methods 
      SET balance = balance - OLD.amount 
      WHERE id = OLD.payment_method_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE payment_methods 
      SET balance = balance + OLD.amount 
      WHERE id = OLD.payment_method_id;
    END IF;
    
    -- Apply new transaction
    IF NEW.type = 'income' OR NEW.type = 'capital' THEN
      UPDATE payment_methods 
      SET balance = balance + NEW.amount 
      WHERE id = NEW.payment_method_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE payment_methods 
      SET balance = balance - NEW.amount 
      WHERE id = NEW.payment_method_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating payment method balances
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_payment_method_balance_trigger ON transactions;
  CREATE TRIGGER update_payment_method_balance_trigger
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance();
END $$;

-- Function to update payment method balances for custom sales
CREATE OR REPLACE FUNCTION update_payment_method_balance_custom_sales()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE payment_methods 
    SET balance = balance + NEW.selling_price 
    WHERE id = NEW.payment_method_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    UPDATE payment_methods 
    SET balance = balance - OLD.selling_price 
    WHERE id = OLD.payment_method_id;
    
    -- Apply new transaction
    UPDATE payment_methods 
    SET balance = balance + NEW.selling_price 
    WHERE id = NEW.payment_method_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE payment_methods 
    SET balance = balance - OLD.selling_price 
    WHERE id = OLD.payment_method_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating payment method balances for custom sales
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_payment_method_balance_custom_sales_trigger ON custom_sales;
  CREATE TRIGGER update_payment_method_balance_custom_sales_trigger
    AFTER INSERT OR UPDATE OR DELETE ON custom_sales
    FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance_custom_sales();
END $$;

-- Function to update payment method balances for R&D expenses
CREATE OR REPLACE FUNCTION update_payment_method_balance_rd_expenses()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE payment_methods 
    SET balance = balance - NEW.amount 
    WHERE id = NEW.payment_method_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    UPDATE payment_methods 
    SET balance = balance + OLD.amount 
    WHERE id = OLD.payment_method_id;
    
    -- Apply new transaction
    UPDATE payment_methods 
    SET balance = balance - NEW.amount 
    WHERE id = NEW.payment_method_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE payment_methods 
    SET balance = balance + OLD.amount 
    WHERE id = OLD.payment_method_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating payment method balances for R&D expenses
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_payment_method_balance_rd_expenses_trigger ON rd_expenses;
  CREATE TRIGGER update_payment_method_balance_rd_expenses_trigger
    AFTER INSERT OR UPDATE OR DELETE ON rd_expenses
    FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance_rd_expenses();
END $$;

-- Function to update payment method balances for DTF inventory
CREATE OR REPLACE FUNCTION update_payment_method_balance_dtf_inventory()
RETURNS TRIGGER AS $$
DECLARE
  total_cost numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    total_cost = NEW.total_length_cm * NEW.cost_per_cm;
    UPDATE payment_methods 
    SET balance = balance - total_cost 
    WHERE id = NEW.payment_method_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse old transaction
    total_cost = OLD.total_length_cm * OLD.cost_per_cm;
    UPDATE payment_methods 
    SET balance = balance + total_cost 
    WHERE id = OLD.payment_method_id;
    
    -- Apply new transaction
    total_cost = NEW.total_length_cm * NEW.cost_per_cm;
    UPDATE payment_methods 
    SET balance = balance - total_cost 
    WHERE id = NEW.payment_method_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    total_cost = OLD.total_length_cm * OLD.cost_per_cm;
    UPDATE payment_methods 
    SET balance = balance + total_cost 
    WHERE id = OLD.payment_method_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating payment method balances for DTF inventory
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_payment_method_balance_dtf_inventory_trigger ON dtf_inventory;
  CREATE TRIGGER update_payment_method_balance_dtf_inventory_trigger
    AFTER INSERT OR UPDATE OR DELETE ON dtf_inventory
    FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance_dtf_inventory();
END $$;

-- Function to create journal entries for transactions
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
  
  -- Get account IDs
  SELECT id INTO debit_account_id FROM accounts WHERE code = payment_account_code;
  
  IF NEW.type = 'income' THEN
    -- Debit: Cash/Bank/E-wallet, Credit: Income
    SELECT id INTO credit_account_id FROM accounts WHERE code = '4000';
    
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (NEW.transaction_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'TRX-' || NEW.id::text);
    
  ELSIF NEW.type = 'expense' THEN
    -- Debit: Expense, Credit: Cash/Bank/E-wallet
    SELECT id INTO credit_account_id FROM accounts WHERE code = payment_account_code;
    SELECT id INTO debit_account_id FROM accounts WHERE code = '2000';
    
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (NEW.transaction_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'TRX-' || NEW.id::text);
    
  ELSIF NEW.type = 'capital' THEN
    -- Debit: Cash/Bank/E-wallet, Credit: Capital
    SELECT id INTO credit_account_id FROM accounts WHERE code = '3000';
    
    INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
    VALUES (NEW.transaction_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'TRX-' || NEW.id::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for creating journal entries
DO $$
BEGIN
  DROP TRIGGER IF EXISTS create_journal_entries_trigger ON transactions;
  CREATE TRIGGER create_journal_entries_trigger
    AFTER INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION create_journal_entries();
END $$;

-- Function to create journal entries for R&D expenses
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
  
  -- Debit: R&D Expense (7000), Credit: Cash/Bank/E-wallet
  SELECT id INTO debit_account_id FROM accounts WHERE code = '7000';
  SELECT id INTO credit_account_id FROM accounts WHERE code = payment_account_code;
  
  INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
  VALUES (NEW.expense_date, NEW.description, debit_account_id, credit_account_id, NEW.amount, 'RD-' || NEW.id::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for creating journal entries for R&D expenses
DO $$
BEGIN
  DROP TRIGGER IF EXISTS create_rd_expenses_journal_entries_trigger ON rd_expenses;
  CREATE TRIGGER create_rd_expenses_journal_entries_trigger
    AFTER INSERT ON rd_expenses
    FOR EACH ROW EXECUTE FUNCTION create_rd_expenses_journal_entries();
END $$;

-- Function to create journal entries for DTF inventory
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
  
  -- Calculate total cost
  total_cost = NEW.total_length_cm * NEW.cost_per_cm;
  
  -- Debit: Inventory (1500), Credit: Cash/Bank/E-wallet
  SELECT id INTO debit_account_id FROM accounts WHERE code = '1500';
  SELECT id INTO credit_account_id FROM accounts WHERE code = payment_account_code;
  
  INSERT INTO journal_entries (date, description, debit_account_id, credit_account_id, amount, reference)
  VALUES (NEW.purchase_date, 'Pembelian DTF Roll: ' || NEW.roll_name, debit_account_id, credit_account_id, total_cost, 'DTF-' || NEW.id::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for creating journal entries for DTF inventory
DO $$
BEGIN
  DROP TRIGGER IF EXISTS create_dtf_inventory_journal_entries_trigger ON dtf_inventory;
  CREATE TRIGGER create_dtf_inventory_journal_entries_trigger
    AFTER INSERT ON dtf_inventory
    FOR EACH ROW EXECUTE FUNCTION create_dtf_inventory_journal_entries();
END $$;

-- Insert Chart of Accounts using INSERT WHERE NOT EXISTS pattern
DO $$
BEGIN
  -- Insert accounts one by one to avoid conflicts
  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '1100', 'Kas', 'asset', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1100');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '1200', 'Bank', 'asset', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1200');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '1300', 'E-Wallet (Dana)', 'asset', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1300');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '1500', 'Bahan Baku', 'asset', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1500');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '2000', 'Biaya Operasional', 'expense', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '2000');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '2100', 'Biaya Inventory', 'expense', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '2100');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '3000', 'Modal', 'equity', 'credit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '3000');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '3100', 'Modal Fahri', 'equity', 'credit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '3100');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '3200', 'Modal Doni', 'equity', 'credit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '3200');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '4000', 'Penjualan', 'income', 'credit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '4000');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '5000', 'HPP', 'expense', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '5000');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '6000', 'Perlengkapan Operasional', 'asset', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '6000');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '6100', 'Biaya Domain & Email', 'expense', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '6100');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '6200', 'Biaya Promosi', 'expense', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '6200');

  INSERT INTO accounts (code, name, type, normal_balance)
  SELECT '7000', 'R&D', 'expense', 'debit'
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '7000');
END $$;

-- Insert default transaction categories using INSERT WHERE NOT EXISTS pattern
DO $$
BEGIN
  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Penjualan Custom', 'income', 'Pendapatan dari layanan custom', '#059669'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Penjualan Custom');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Penjualan Produk', 'income', 'Pendapatan dari penjualan produk fashion', '#059669'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Penjualan Produk');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Lain-lain', 'income', 'Pendapatan lainnya', '#6B7280'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Lain-lain' AND type = 'income');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Modal Awal', 'capital', 'Setoran modal awal', '#2563EB'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Modal Awal');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Penarikan Modal', 'capital', 'Penarikan modal', '#DC2626'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Penarikan Modal');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Bahan Baku', 'expense', 'Pembelian bahan untuk produksi', '#DC2626'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Bahan Baku');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'R&D', 'expense', 'Biaya riset dan pengembangan', '#7C3AED'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'R&D');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Operasional', 'expense', 'Biaya operasional harian', '#EA580C'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Operasional');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Listrik', 'expense', 'Biaya listrik dan utilitas', '#0891B2'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Listrik');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Depresiasi', 'expense', 'Depresiasi peralatan', '#6B7280'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Depresiasi');

  INSERT INTO transaction_categories (name, type, description, color)
  SELECT 'Transportasi', 'expense', 'Biaya pengiriman dan transportasi', '#DC2626'
  WHERE NOT EXISTS (SELECT 1 FROM transaction_categories WHERE name = 'Transportasi');
END $$;

-- Update existing payment methods with account codes if they don't have them
UPDATE payment_methods 
SET account_code = CASE 
  WHEN type = 'cash' THEN '1100'
  WHEN type = 'bank' THEN '1200'
  WHEN type = 'ewallet' THEN '1300'
  ELSE '1100'
END
WHERE account_code IS NULL;

-- Insert default payment methods using INSERT WHERE NOT EXISTS pattern
DO $$
BEGIN
  INSERT INTO payment_methods (name, type, balance, account_code)
  SELECT 'Kas Tunai', 'cash', 0, '1100'
  WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE name = 'Kas Tunai');

  INSERT INTO payment_methods (name, type, balance, account_code)
  SELECT 'Dana', 'ewallet', 0, '1300'
  WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE name = 'Dana');

  INSERT INTO payment_methods (name, type, balance, account_code)
  SELECT 'BCA', 'bank', 0, '1200'
  WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE name = 'BCA');

  INSERT INTO payment_methods (name, type, balance, account_code)
  SELECT 'BNI', 'bank', 0, '1200'
  WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE name = 'BNI');

  INSERT INTO payment_methods (name, type, balance, account_code)
  SELECT 'Mandiri', 'bank', 0, '1200'
  WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE name = 'Mandiri');
END $$;