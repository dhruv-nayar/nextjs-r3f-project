-- Run this in Supabase SQL Editor (supabase.com → SQL Editor → New Query)

-- Create the trellis_jobs table
CREATE TABLE trellis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rembg', 'trellis')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  message TEXT,
  error TEXT,
  input_image_urls TEXT[],
  seed INTEGER,
  texture_size INTEGER,
  download_urls TEXT[],
  result_urls TEXT[],
  callback_url TEXT,
  webhook_received BOOLEAN DEFAULT FALSE,
  webhook_received_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for faster queries
CREATE INDEX idx_trellis_jobs_status ON trellis_jobs(status);
CREATE INDEX idx_trellis_jobs_item_id ON trellis_jobs(item_id);
CREATE INDEX idx_trellis_jobs_job_id ON trellis_jobs(job_id);

-- Enable Row Level Security (required by Supabase)
ALTER TABLE trellis_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust if you add auth later)
CREATE POLICY "Allow all operations" ON trellis_jobs FOR ALL USING (true);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE trellis_jobs;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trellis_jobs_updated_at
  BEFORE UPDATE ON trellis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Mask Corrections table (for training data)
-- ============================================

-- Create the mask_corrections table
CREATE TABLE mask_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL,
  image_index INTEGER NOT NULL,
  original_url TEXT NOT NULL,
  original_mask_url TEXT,           -- Alpha extracted from auto-processed image
  corrected_mask_url TEXT NOT NULL,
  corrected_processed_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,                    -- Brush sizes, tools used, duration, etc.
  training_label TEXT CHECK (training_label IN ('approved', 'rejected', 'needs_review')),
  reviewed_at TIMESTAMPTZ
);

-- Create indexes for mask_corrections
CREATE INDEX idx_mask_corrections_item ON mask_corrections(item_id);
CREATE INDEX idx_mask_corrections_label ON mask_corrections(training_label);
CREATE INDEX idx_mask_corrections_created ON mask_corrections(created_at);

-- Enable Row Level Security
ALTER TABLE mask_corrections ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust if you add auth later)
CREATE POLICY "Allow all operations" ON mask_corrections FOR ALL USING (true);

-- Auto-update updated_at timestamp
CREATE TRIGGER mask_corrections_updated_at
  BEFORE UPDATE ON mask_corrections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Homes table (for project/home data)
-- ============================================

-- Create the homes table
CREATE TABLE homes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_path TEXT,

  -- Nested data as JSONB (mirrors localStorage structure)
  rooms JSONB NOT NULL DEFAULT '[]',
  shared_walls JSONB,
  floorplan_data JSONB,        -- V1: Rectangle-based
  floorplan_data_v2 JSONB,     -- V2: Wall-first polygon
  floorplan_data_v3 JSONB,     -- V3: Two-sided wall segments

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for homes
CREATE INDEX idx_homes_updated ON homes(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE homes ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-user mode, no auth)
CREATE POLICY "Allow all operations" ON homes FOR ALL USING (true);

-- Enable Realtime for live updates (multi-tab sync)
ALTER PUBLICATION supabase_realtime ADD TABLE homes;

-- Auto-update updated_at timestamp
CREATE TRIGGER homes_updated_at
  BEFORE UPDATE ON homes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
