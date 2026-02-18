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
