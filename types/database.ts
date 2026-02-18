// Supabase database types for trellis_jobs table

export interface TrellisJobRow {
  id: string
  job_id: string
  item_id: string
  user_id: string | null
  type: 'rembg' | 'trellis'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message: string | null
  error: string | null
  input_image_urls: string[] | null
  seed: number | null
  texture_size: number | null
  download_urls: string[] | null
  result_urls: string[] | null
  callback_url: string | null
  webhook_received: boolean
  webhook_received_at: string | null
  retry_count: number
  last_polled_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type TrellisJobInsert = Partial<Omit<TrellisJobRow, 'id' | 'created_at' | 'updated_at'>> & {
  job_id: string
  item_id: string
  type: 'rembg' | 'trellis'
}

export type TrellisJobUpdate = Partial<Omit<TrellisJobRow, 'id' | 'created_at'>>

// Webhook payload from Trellis API
export interface TrellisWebhookPayload {
  job_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  message?: string
  download_urls?: string[]
  download_url?: string  // API sometimes returns singular
  error?: string
}
