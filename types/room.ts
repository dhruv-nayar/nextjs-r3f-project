export interface Vector3 {
  x: number
  y: number
  z: number
}

// ============================================
// NEW: Items & Instances Architecture
// ============================================

export type ItemCategory = 'seating' | 'table' | 'storage' | 'bed' | 'decoration' | 'lighting' | 'other'

/**
 * Item: A reusable 3D model template in the user's library
 * Think of this as a "stamp" that can be placed multiple times
 */
export interface Item {
  id: string                    // e.g., "item_chair_001"
  name: string                  // "Modern Office Chair"
  description?: string          // "Ergonomic mesh back chair"
  modelPath: string             // "/models/whiteback-wood-chair.glb"
  thumbnailPath?: string        // "/thumbnails/chair_thumb.jpg"

  // Default real-world dimensions
  dimensions: {
    width: number               // feet (X axis)
    height: number              // feet (Y axis)
    depth: number               // feet (Z axis)
  }

  // Organization
  category: ItemCategory
  tags: string[]                // ["office", "modern", "mesh"]

  // Metadata
  createdAt: string
  updatedAt: string
  isCustom: boolean             // User-uploaded vs built-in
}

/**
 * ItemInstance: A specific placement of an Item within a room
 * Multiple instances can reference the same Item
 */
export interface ItemInstance {
  id: string                    // e.g., "instance_001"
  itemId: string                // Reference to Item.id
  roomId: string                // Which room this is in

  // Transform in 3D space
  position: Vector3             // feet
  rotation: Vector3             // radians
  scaleMultiplier: Vector3      // User scale adjustment (default: {x:1, y:1, z:1})

  // Optional overrides
  customName?: string           // "Mom's chair" (overrides Item.name for display)

  // Metadata
  placedAt: string              // ISO timestamp
}

// ============================================
// Upload-related Types
// ============================================

/**
 * Upload progress tracking
 */
export interface UploadProgress {
  fileName: string
  progress: number // 0-100
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
  stage?: 'model' | 'thumbnail' // Which file is being processed
}

/**
 * Result from GLB file upload
 */
export interface GLBUploadResult {
  modelPath: string
  thumbnailPath?: string
}

/**
 * Result from image upload
 */
export interface ImageUploadResult {
  imagePaths: string[]
  selectedThumbnailIndex?: number
}

/**
 * Processing job status (for async operations like TRELLIS)
 */
export interface ProcessingJob {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  downloadUrl?: string
  error?: string
}

// ============================================
// LEGACY: Old FurnitureItem (for migration)
// ============================================

/**
 * @deprecated Use Item + ItemInstance instead
 * Keeping for backwards compatibility during Phase 1 refactor
 */
export interface FurnitureItem {
  id: string
  name: string
  modelPath: string
  position: Vector3
  rotation: Vector3  // In radians
  scale: Vector3
  targetDimensions?: {
    width: number   // Width in feet (X axis)
    height: number  // Height in feet (Y axis)
    depth: number   // Depth in feet (Z axis)
  }
  category?: ItemCategory
}

export interface FloorplanConfig {
  imagePath: string
  widthFeet: number   // Real-world width in feet
  heightFeet: number  // Real-world height in feet
  pixelsPerFoot?: number  // Calculated automatically
}

export interface LightingConfig {
  ambient: {
    intensity: number
    color?: string
  }
  directional?: Array<{
    position: Vector3
    intensity: number
    color?: string
    castShadow?: boolean
  }>
  point?: Array<{
    position: Vector3
    intensity: number
    color?: string
    distance?: number
  }>
}

export interface Room {
  id: string
  name: string
  homeId?: string               // NEW: explicit parent home reference
  floorplan?: FloorplanConfig

  // NEW: instances instead of furniture
  instances?: ItemInstance[]    // Use this going forward
  furniture?: FurnitureItem[]   // DEPRECATED: kept for migration

  cameraPosition: Vector3
  cameraTarget: Vector3
  lighting?: LightingConfig
}

export interface RoomConfig {
  rooms: Room[]
  currentRoomId: string
}

export interface Home {
  id: string
  name: string
  description?: string          // NEW: optional description
  rooms: Room[]
  thumbnailPath?: string        // NEW: auto-generated or manual
  createdAt: string
  updatedAt: string
}
