/*
  # Complete Financial System Setup with Proper Accounting

  1. New Tables
    - `accounts` - Chart of accounts following accounting principles
    - `journal_entries` - Double-entry bookkeeping journal entries
    - `transaction_categories` - Transaction categories
    - `payment_methods` - Payment methods with account codes
    - `transactions` - Main transactions with account codes
    - `dtf_inventory` - DTF inventory management
    - `custom_sales` - Custom sales tracking
    - `rd_expenses` - R&D expenses tracking
    - `monthly_allocations` - Monthly budget allocations
    - `daily_summaries` - Daily financial summaries

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

-- Transaction Categories
CREATE TABLE IF NOT EXISTS transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'capital')),
  description text,
  color text DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payment Methods with account codes
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet')),
  balance numeric(15,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  account_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT payment_methods_account_code_not_null CHECK (account_code IS NOT NULL)
);

-- Main Transactions with account codes
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES transaction_categories(id) ON DELETE RESTRICT,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'capital')),
  description text NOT NULL,
  reference_number text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  source text NOT NULL DEFAULT 'transactions',
  source_id uuid,
  account_code text
);

-- DTF Inventory with account codes
CREATE TABLE IF NOT EXISTS dtf_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_name text NOT NULL,
  total_length_cm numeric(10,2) NOT NULL,
  used_length_cm numeric(10,2) DEFAULT 0,
  remaining_length_cm numeric(10,2) DEFAULT 0,
  cost_per_cm numeric(10,4) NOT NULL,
  cost_per_meter numeric DEFAULT NULL,
  purchase_date date NOT NULL,
  supplier text,
  notes text,
  is_finished boolean DEFAULT false,
  payment_method_id uuid REFERENCES payment_methods(id),
  account_code text DEFAULT '1300',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Custom Sales with account codes
CREATE TABLE IF NOT EXISTS custom_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dtf_roll_id uuid REFERENCES dtf_inventory(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  length_used_cm numeric(10,2) NOT NULL,
  dtf_cost numeric(10,2) DEFAULT 0,
  press_cost numeric(10,2) NOT NULL DEFAULT 0,
  other_costs numeric(10,2) DEFAULT 0,
  total_hpp numeric(10,2) DEFAULT 0,
  cogs numeric(14,2),
  selling_price numeric(10,2) NOT NULL,
  profit numeric(10,2) DEFAULT 0,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  quantity integer NOT NULL DEFAULT 1,
  cost_per_cm numeric DEFAULT 0,
  payment_method_id uuid REFERENCES payment_methods(id),
  account_code text DEFAULT '1300',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- R&D Expenses with account codes
CREATE TABLE IF NOT EXISTS rd_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier text,
  is_failed_experiment boolean DEFAULT false,
  notes text,
  payment_method_id uuid REFERENCES payment_methods(id),
  account_code text DEFAULT '1300',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Monthly Allocations
CREATE TABLE IF NOT EXISTS monthly_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  category text NOT NULL,
  allocation_month date NOT NULL,
  description text,
  is_recurring boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Daily Summaries
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  total_income numeric(15,2) DEFAULT 0,
  total_expenses numeric(15,2) DEFAULT 0,
  net_profit numeric(15,2) DEFAULT 0,
  custom_sales_count integer DEFAULT 0,
  custom_sales_profit numeric(10,2) DEFAULT 0,
  rd_expenses numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, summary_date)
);

-- Enable RLS
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

-- Create triggers for updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate DTF remaining length
CREATE OR REPLACE FUNCTION update_dtf_remaining_length()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_length_cm = NEW.total_length_cm - NEW.used_length_cm;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for DTF remaining length calculation
CREATE TRIGGER trigger_update_dtf_remaining_length
  BEFORE INSERT OR UPDATE ON dtf_inventory
  FOR EACH ROW EXECUTE FUNCTION update_dtf_remaining_length();

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
CREATE TRIGGER trigger_calculate_custom_sale_profit
  BEFORE INSERT OR UPDATE ON custom_sales
  FOR EACH ROW EXECUTE FUNCTION calculate_custom_sale_profit();

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
CREATE TRIGGER set_account_code_trigger
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_account_code();

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
CREATE TRIGGER set_account_code_custom_sales_trigger
  AFTER INSERT ON custom_sales
  FOR EACH ROW EXECUTE FUNCTION set_account_code_custom_sales();

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
CREATE TRIGGER set_account_code_rd_expenses_trigger
  AFTER INSERT ON rd_expenses
  FOR EACH ROW EXECUTE FUNCTION set_account_code_rd_expenses();

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
CREATE TRIGGER set_account_code_dtf_inventory_trigger
  AFTER INSERT ON dtf_inventory
  FOR EACH ROW EXECUTE FUNCTION set_account_code_dtf_inventory();

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
CREATE TRIGGER update_payment_method_balance_trigger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance();

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
CREATE TRIGGER update_payment_method_balance_custom_sales_trigger
  AFTER INSERT OR UPDATE OR DELETE ON custom_sales
  FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance_custom_sales();

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
CREATE TRIGGER update_payment_method_balance_rd_expenses_trigger
  AFTER INSERT OR UPDATE OR DELETE ON rd_expenses
  FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance_rd_expenses();

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
CREATE TRIGGER update_payment_method_balance_dtf_inventory_trigger
  AFTER INSERT OR UPDATE OR DELETE ON dtf_inventory
  FOR EACH ROW EXECUTE FUNCTION update_payment_method_balance_dtf_inventory();

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
CREATE TRIGGER create_journal_entries_trigger
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION create_journal_entries();

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
CREATE TRIGGER create_rd_expenses_journal_entries_trigger
  AFTER INSERT ON rd_expenses
  FOR EACH ROW EXECUTE FUNCTION create_rd_expenses_journal_entries();

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
CREATE TRIGGER create_dtf_inventory_journal_entries_trigger
  AFTER INSERT ON dtf_inventory
  FOR EACH ROW EXECUTE FUNCTION create_dtf_inventory_journal_entries();

-- Insert Chart of Accounts
INSERT INTO accounts (code, name, type, normal_balance) VALUES
  ('1100', 'Kas', 'asset', 'debit'),
  ('1200', 'Bank', 'asset', 'debit'),
  ('1300', 'E-Wallet (Dana)', 'asset', 'debit'),
  ('1500', 'Bahan Baku', 'asset', 'debit'),
  ('2000', 'Biaya Operasional', 'expense', 'debit'),
  ('2100', 'Biaya Inventory', 'expense', 'debit'),
  ('3000', 'Modal', 'equity', 'credit'),
  ('3100', 'Modal Fahri', 'equity', 'credit'),
  ('3200', 'Modal Doni', 'equity', 'credit'),
  ('4000', 'Penjualan', 'income', 'credit'),
  ('5000', 'HPP', 'expense', 'debit'),
  ('6000', 'Perlengkapan Operasional', 'asset', 'debit'),
  ('6100', 'Biaya Domain & Email', 'expense', 'debit'),
  ('6200', 'Biaya Promosi', 'expense', 'debit'),
  ('7000', 'R&D', 'expense', 'debit')
ON CONFLICT (code) DO NOTHING;

-- Insert default transaction categories
INSERT INTO transaction_categories (name, type, description, color) VALUES
  ('Penjualan Custom', 'income', 'Pendapatan dari layanan custom', '#059669'),
  ('Penjualan Produk', 'income', 'Pendapatan dari penjualan produk fashion', '#059669'),
  ('Lain-lain', 'income', 'Pendapatan lainnya', '#6B7280'),
  ('Modal Awal', 'capital', 'Setoran modal awal', '#2563EB'),
  ('Penarikan Modal', 'capital', 'Penarikan modal', '#DC2626'),
  ('Bahan Baku', 'expense', 'Pembelian bahan untuk produksi', '#DC2626'),
  ('R&D', 'expense', 'Biaya riset dan pengembangan', '#7C3AED'),
  ('Operasional', 'expense', 'Biaya operasional harian', '#EA580C'),
  ('Listrik', 'expense', 'Biaya listrik dan utilitas', '#0891B2'),
  ('Depresiasi', 'expense', 'Depresiasi peralatan', '#6B7280'),
  ('Transportasi', 'expense', 'Biaya pengiriman dan transportasi', '#DC2626')
ON CONFLICT DO NOTHING;

-- Insert default payment methods with proper account codes
INSERT INTO payment_methods (name, type, balance, account_code) VALUES
  ('Kas Tunai', 'cash', 0, '1100'),
  ('Dana', 'ewallet', 0, '1300'),
  ('BCA', 'bank', 0, '1200'),
  ('BNI', 'bank', 0, '1200'),
  ('Mandiri', 'bank', 0, '1200')
ON CONFLICT (name) DO NOTHING;