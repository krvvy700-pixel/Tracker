-- ============================================
-- Customer Tracking CRM — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  shopify_id TEXT,
  payment_method TEXT DEFAULT 'COD',
  financial_status TEXT DEFAULT 'paid',
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_mobile TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  address_line3 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  
  -- Tracking
  tracking_status TEXT DEFAULT 'Order Placed',
  tracking_id TEXT,
  courier_partner TEXT,
  tracking_token UUID DEFAULT uuid_generate_v4() UNIQUE,
  status_updated_at TIMESTAMPTZ DEFAULT now(),
  estimated_delivery DATE,
  
  -- Metadata
  order_total DECIMAL(10,2) DEFAULT 0,
  is_cancelled BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_order_id ON orders(order_id);
CREATE INDEX idx_orders_tracking_token ON orders(tracking_token);
CREATE INDEX idx_orders_customer_mobile ON orders(customer_mobile);
CREATE INDEX idx_orders_tracking_status ON orders(tracking_status);
CREATE INDEX idx_orders_is_cancelled ON orders(is_cancelled);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  brand TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_brand ON order_items(brand);

-- ============================================
-- TEAM USERS TABLE (Role-based access)
-- ============================================
CREATE TABLE team_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',  -- 'admin', 'manager', 'viewer'
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TRACKING HISTORY TABLE (Audit log)
-- ============================================
CREATE TABLE tracking_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tracking_history_order_id ON tracking_history(order_id);

-- ============================================
-- UPLOAD LOG TABLE
-- ============================================
CREATE TABLE upload_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename TEXT,
  total_rows INTEGER DEFAULT 0,
  new_orders INTEGER DEFAULT 0,
  updated_orders INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_logs ENABLE ROW LEVEL SECURITY;

-- Public read access for tracking (via service role key on API)
CREATE POLICY "Allow service role full access on orders" ON orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on order_items" ON order_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on team_users" ON team_users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on tracking_history" ON tracking_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access on upload_logs" ON upload_logs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER team_users_updated_at
  BEFORE UPDATE ON team_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
