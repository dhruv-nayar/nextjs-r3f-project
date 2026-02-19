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

// ============================================
// Items table types
// ============================================

export interface ItemRow {
  id: string
  name: string
  description: string | null
  model_path: string | null
  thumbnail_path: string | null
  images: Array<{ original: string; processed: string | null }> | null
  parametric_shape: {
    type: 'extrusion'
    points: Array<{ x: number; y: number }>
    height: number
    color: string
  } | {
    type: 'rug'
    width: number
    depth: number
    thickness: number
    texturePath: string
  } | {
    type: 'frame'
    imagePath: string
    imageWidth: number
    imageHeight: number
    matWidth: number
    matColor: string
    frameWidth: number
    frameDepth: number
    frameColor: string
  } | {
    type: 'shelf'
    width: number
    height: number
    depth: number
    color: string
  } | null
  generation_status: {
    isGenerating: boolean
    startedAt?: string
    selectedImageUrls?: string[]
  } | null
  dimensions: {
    width: number
    height: number
    depth: number
  }
  category: string
  tags: string[]
  placement_type: string | null
  material_overrides: Array<{
    materialName: string
    materialIndex?: number
    baseColor?: string
  }> | null
  default_rotation: {
    x: number
    z: number
  } | null
  product_url: string | null
  is_custom: boolean
  created_at: string
  updated_at: string
}

export type ItemInsert = Partial<Omit<ItemRow, 'created_at' | 'updated_at'>> & {
  id: string
  name: string
  dimensions: { width: number; height: number; depth: number }
  category: string
}

export type ItemUpdate = Partial<Omit<ItemRow, 'id' | 'created_at'>>

// ============================================
// Mask Corrections table types (for training data)
// ============================================

export interface MaskCorrectionRow {
  id: string
  item_id: string
  image_index: number
  original_url: string
  original_mask_url: string | null   // Extracted from auto-processed image
  corrected_mask_url: string
  corrected_processed_url: string
  created_at: string
  updated_at: string
  metadata: {
    brushSizes?: number[]
    toolsUsed?: string[]
    correctionDuration?: number
    pixelsModified?: number
    imageWidth?: number
    imageHeight?: number
  } | null
  training_label: 'approved' | 'rejected' | 'needs_review' | null
  reviewed_at: string | null
}

export type MaskCorrectionInsert = Partial<Omit<MaskCorrectionRow, 'id' | 'created_at' | 'updated_at'>> & {
  item_id: string
  image_index: number
  original_url: string
  corrected_mask_url: string
  corrected_processed_url: string
}

export type MaskCorrectionUpdate = Partial<Omit<MaskCorrectionRow, 'id' | 'created_at'>>

// ============================================
// Homes table types
// ============================================

import { Room, SharedWall } from './room'
import { FloorplanData } from './floorplan'
import { FloorplanDataV2, FloorplanDataV3 } from './floorplan-v2'

export interface HomeRow {
  id: string
  name: string
  description: string | null
  thumbnail_path: string | null
  rooms: Room[]
  shared_walls: SharedWall[] | null
  floorplan_data: FloorplanData | null
  floorplan_data_v2: FloorplanDataV2 | null
  floorplan_data_v3: FloorplanDataV3 | null
  created_at: string
  updated_at: string
}

export type HomeInsert = Omit<HomeRow, 'created_at' | 'updated_at'>

export type HomeUpdate = Partial<Omit<HomeRow, 'id' | 'created_at'>>
