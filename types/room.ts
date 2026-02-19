export interface Vector3 {
  x: number
  y: number
  z: number
}

/**
 * Per-wall height overrides
 * If undefined, the wall uses the room's default height (dimensions.height)
 */
export interface WallHeights {
  north?: number  // Override for north wall
  south?: number  // Override for south wall
  east?: number   // Override for east wall
  west?: number   // Override for west wall
}

// ============================================
// NEW: Items & Instances Architecture
// ============================================

export type ItemCategory = 'seating' | 'table' | 'storage' | 'bed' | 'decoration' | 'lighting' | 'other'

export type PlacementType = 'floor' | 'wall' | 'ceiling'

/**
 * ParametricShape: A user-drawn 2D polygon that gets extruded to 3D
 * This allows users to create custom items without needing 3D modeling tools
 */
export interface ParametricShape {
  type: 'extrusion'
  points: Array<{ x: number; y: number }>  // 2D polygon vertices (closed, in feet)
  height: number                            // Extrusion depth in feet
  color: string                             // Hex color (e.g., "#FF5733")
}

/**
 * MaterialOverride: Customization for a specific material in a 3D model
 */
export interface MaterialOverride {
  materialName: string      // THREE.js material.name
  materialIndex?: number    // Fallback for unnamed materials
  baseColor?: string        // Hex color (e.g., "#FF5733")
  metalness?: number        // 0-1 (optional, for future)
  roughness?: number        // 0-1 (optional, for future)
}

/**
 * Item: A reusable 3D model template in the user's library
 * Think of this as a "stamp" that can be placed multiple times
 *
 * Items can be either:
 * 1. GLB model-based (modelPath set)
 * 2. Parametric shape-based (parametricShape set)
 */
export interface Item {
  id: string                    // e.g., "item_chair_001"
  name: string                  // "Modern Office Chair"
  description?: string          // "Ergonomic mesh back chair"

  // Model source (one of these should be set)
  modelPath?: string            // "/models/whiteback-wood-chair.glb" (for GLB models)
  parametricShape?: ParametricShape  // For user-created extruded shapes

  thumbnailPath?: string        // "/thumbnails/chair_thumb.jpg"
  images?: ImagePair[]          // All uploaded images (original and processed versions)

  // Generation status (for tracking async operations)
  generationStatus?: {
    isGenerating: boolean       // True when model generation is in progress
    startedAt?: string          // ISO timestamp when generation started
    selectedImageUrls?: string[] // Which images were selected for generation
  }

  // Default real-world dimensions
  dimensions: {
    width: number               // feet (X axis)
    height: number              // feet (Y axis)
    depth: number               // feet (Z axis)
  }

  // Default rotation for placed instances (in radians)
  // X = pitch (tilt forward/back), Z = roll (tilt left/right)
  // Y rotation is handled at instance level for furniture orientation
  defaultRotation?: {
    x: number                   // 0, PI/2, PI, or 3*PI/2 (90° increments)
    z: number                   // 0, PI/2, PI, or 3*PI/2 (90° increments)
  }

  // Organization
  category: ItemCategory
  tags: string[]                // ["office", "modern", "mesh"]

  // Placement & Links
  placementType?: PlacementType // Where item should be placed (floor, wall, ceiling)
  productUrl?: string           // Link to product page

  // Customization
  materialOverrides?: MaterialOverride[] // Custom colors/materials

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
  /** Dimensions extracted from GLB bounding box (in feet) */
  dimensions?: { width: number; height: number; depth: number }
}

/**
 * Image pair containing original and processed (background removed) versions
 */
export interface ImagePair {
  original: string
  processed: string | null  // null if background removal failed
}

/**
 * Result from image upload
 */
export interface ImageUploadResult {
  imagePaths: string[]  // All image paths (both original and processed) for backward compatibility
  imagePairs: ImagePair[]  // Pairs of original and processed images
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

/**
 * Door opening in a 3D room wall
 * Formalized from Room.tsx component
 */
export interface Door {
  wall: 'north' | 'south' | 'east' | 'west'  // Which wall (north=+Z, south=-Z, east=+X, west=-X)
  position: number  // Position along the wall (-0.5 to 0.5, where 0 is center)
  width: number     // Door width in feet
  height: number    // Door height in feet
}

// ============================================
// Shared Wall Architecture (Z-Fighting Solution)
// ============================================

/**
 * Door on a shared wall, specified in wall-relative coordinates
 */
export interface SharedWallDoor {
  id: string
  fromRoomId: string       // Which room this door belongs to
  position: number         // Position along wall (feet from wall's left edge)
  width: number            // Door width (feet)
  height: number           // Door height (feet)
}

/**
 * SharedWall: A wall shared between two adjacent rooms
 * Rendered as a single geometry with holes for doors from both rooms
 * This eliminates z-fighting by having only one surface at the shared position
 */
export interface SharedWall {
  id: string
  room1Id: string          // First room
  room2Id: string          // Second room

  // Position in 3D world space
  position: [number, number, number]  // Center of wall

  // Wall dimensions
  width: number            // Length along the wall (X or Z axis, in feet)
  height: number           // Vertical height (Y axis, in feet)

  // Wall orientation
  orientation: 'east-west' | 'north-south'  // Which axis the wall runs along

  // Doors on this wall
  doors: SharedWallDoor[]
}

export interface Room {
  id: string
  name: string
  homeId?: string               // NEW: explicit parent home reference
  floorplan?: FloorplanConfig

  // NEW: instances instead of furniture
  instances?: ItemInstance[]    // Use this going forward
  furniture?: FurnitureItem[]   // DEPRECATED: kept for migration

  // NEW: Floorplan integration
  floorplanRoomId?: string      // Reference to FloorplanRoom source
  dimensions?: {                // Explicit dimensions from floorplan
    width: number               // Width in feet (X-axis)
    depth: number               // Depth in feet (Z-axis)
    height: number              // Height in feet (Y-axis, default for all walls)
  }
  wallHeights?: WallHeights     // Per-wall height overrides
  doors?: Door[]                // Door openings in walls
  position?: [number, number, number]  // Position offset for the room

  // NEW: SharedWall support - which walls to exclude from rendering
  excludedWalls?: {
    north?: boolean
    south?: boolean
    east?: boolean
    west?: boolean
  }

  // NEW: Grid settings for measurement overlay on surfaces
  gridSettings?: import('./selection').RoomGridState

  // V2: Polygon vertices for arbitrary room shapes (wall-first floorplan)
  polygon?: Array<{ x: number; z: number }>

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
  floorplanData?: import('./floorplan').FloorplanData  // V1: Rectangle-based floorplan
  floorplanDataV2?: import('./floorplan-v2').FloorplanDataV2  // V2: Wall-first polygon floorplan
  floorplanDataV3?: import('./floorplan-v2').FloorplanDataV3  // V3: Two-sided wall segments with styles/doors
  sharedWalls?: SharedWall[]    // Shared walls between adjacent rooms
  createdAt: string
  updatedAt: string
}
