-- ============================================
-- BUSINESSES TABLE — Run in Supabase SQL Editor
-- ============================================

CREATE TABLE businesses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  support_email TEXT,
  support_phone TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add business_id to orders
ALTER TABLE orders ADD COLUMN business_id UUID REFERENCES businesses(id);
CREATE INDEX idx_orders_business_id ON orders(business_id);

-- RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role full access on businesses" ON businesses
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-update trigger
CREATE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
