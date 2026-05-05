-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  vintage INTEGER,
  winery TEXT,
  varietal TEXT,
  region TEXT,
  country TEXT,
  barcode TEXT,
  location TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  purchase_price DECIMAL(10,2),
  purchase_date DATE,
  notes TEXT,
  image_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default locations
INSERT INTO locations (name) VALUES
  ('Cellar Rack A'),
  ('Cellar Rack B'),
  ('Kitchen Cabinet'),
  ('Dining Room'),
  ('Basement'),
  ('Garage')
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security (optional, for multi-user support)
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (single-user setup)
CREATE POLICY "Allow all" ON wines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON locations FOR ALL USING (true) WITH CHECK (true);
