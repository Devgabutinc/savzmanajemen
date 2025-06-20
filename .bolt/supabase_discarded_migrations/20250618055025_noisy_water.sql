/*
  # Initial Schema for SAVZ Financial Management System

  1. New Tables
    - `transaction_categories` - Categories for different types of transactions
    - `payment_methods` - Available payment methods (Cash, Dana, BCA, etc.)
    - `transactions` - Main transaction records
    - `dtf_inventory` - DTF roll inventory management
    - `custom_sales` - Custom production sales tracking
    - `rd_expenses` - Research & Development expenses
    - `monthly_allocations` - Monthly recurring allocations (depreciation, etc.)
    - `daily_summaries` - Cached daily financial summaries

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their data
*/

-- Transaction Categories
CREATE TABLE IF NOT EXISTS transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  description text,
  color text DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payment Methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet')),
  balance numeric(15,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Main Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES transaction_categories(id) ON DELETE RESTRICT,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  description text NOT NULL,
  reference_number text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- DTF Inventory
CREATE TABLE IF NOT EXISTS dtf_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  roll_name text NOT NULL,
  total_length_cm numeric(10,2) NOT NULL,
  used_length_cm numeric(10,2) DEFAULT 0,
  remaining_length_cm numeric(10,2) GENERATED ALWAYS AS (total_length_cm - used_length_cm) STORED,
  cost_per_cm numeric(10,4) NOT NULL,
  purchase_date date NOT NULL,
  supplier text,
  notes text,
  is_finished boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Custom Sales
CREATE TABLE IF NOT EXISTS custom_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dtf_roll_id uuid REFERENCES dtf_inventory(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  length_used_cm numeric(10,2) NOT NULL,
  dtf_cost numeric(10,2) GENERATED ALWAYS AS (length_used_cm * (SELECT cost_per_cm FROM dtf_inventory WHERE id = dtf_roll_id)) STORED,
  press_cost numeric(10,2) NOT NULL DEFAULT 0,
  other_costs numeric(10,2) DEFAULT 0,
  total_hpp numeric(10,2) GENERATED ALWAYS AS (dtf_cost + press_cost + other_costs) STORED,
  selling_price numeric(10,2) NOT NULL,
  profit numeric(10,2) GENERATED ALWAYS AS (selling_price - total_hpp) STORED,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- R&D Expenses
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

-- Daily Summaries (for performance)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  total_income numeric(15,2) DEFAULT 0,
  total_expenses numeric(15,2) DEFAULT 0,
  net_profit numeric(15,2) GENERATED ALWAYS AS (total_income - total_expenses) STORED,
  custom_sales_count integer DEFAULT 0,
  custom_sales_profit numeric(10,2) DEFAULT 0,
  rd_expenses numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, summary_date)
);

-- Enable RLS
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dtf_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE rd_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- Policies for transaction_categories (shared among all users)
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

-- Policies for payment_methods (shared among all users)
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

-- Policies for transactions
CREATE POLICY "Users can manage their own transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for dtf_inventory
CREATE POLICY "Users can manage their own DTF inventory"
  ON dtf_inventory
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for custom_sales
CREATE POLICY "Users can manage their own custom sales"
  ON custom_sales
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for rd_expenses
CREATE POLICY "Users can manage their own R&D expenses"
  ON rd_expenses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for monthly_allocations
CREATE POLICY "Users can manage their own monthly allocations"
  ON monthly_allocations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for daily_summaries
CREATE POLICY "Users can manage their own daily summaries"
  ON daily_summaries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert default data
INSERT INTO transaction_categories (name, type, description, color) VALUES
  ('Penjualan Custom', 'income', 'Pendapatan dari layanan custom', '#059669'),
  ('Penjualan Produk', 'income', 'Pendapatan dari penjualan produk fashion', '#059669'),
  ('Lain-lain', 'income', 'Pendapatan lainnya', '#6B7280'),
  ('Bahan Baku', 'expense', 'Pembelian bahan untuk produksi', '#DC2626'),
  ('R&D', 'expense', 'Biaya riset dan pengembangan', '#7C3AED'),
  ('Operasional', 'expense', 'Biaya operasional harian', '#EA580C'),
  ('Listrik', 'expense', 'Biaya listrik dan utilitas', '#0891B2'),
  ('Depresiasi', 'expense', 'Depresiasi peralatan', '#6B7280'),
  ('Transportasi', 'expense', 'Biaya pengiriman dan transportasi', '#DC2626');

INSERT INTO payment_methods (name, type, balance) VALUES
  ('Kas Tunai', 'cash', 0),
  ('Dana', 'ewallet', 0),
  ('BCA', 'bank', 0),
  ('BNI', 'bank', 0),
  ('Mandiri', 'bank', 0);