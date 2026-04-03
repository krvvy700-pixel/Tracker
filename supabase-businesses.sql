-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Wipes all existing data + sets up businesses
-- ============================================

-- 1. Wipe all data (order matters for foreign keys)
DELETE FROM tracking_history;
DELETE FROM order_items;
DELETE FROM upload_logs;
DELETE FROM orders;

-- 2. Create businesses table (if not already created)
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  support_email TEXT,
  support_phone TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Clear any existing businesses
DELETE FROM businesses;

-- 4. Add business_id column to orders (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN business_id UUID REFERENCES businesses(id);
    CREATE INDEX idx_orders_business_id ON orders(business_id);
  END IF;
END $$;

-- 5. RLS for businesses
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access on businesses" ON businesses;
CREATE POLICY "Allow service role full access on businesses" ON businesses
  FOR ALL USING (true) WITH CHECK (true);

-- Done! Now re-upload your CSV and businesses will be auto-created from brands.
