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
 * ExtrusionShape: A user-drawn 2D polygon that gets extruded to 3D
 * This allows users to create custom items without needing 3D modeling tools
 */
export interface ExtrusionShape {
  type: 'extrusion'
  points: Array<{ x: number; y: number }>  // 2D polygon vertices (closed, in feet)
  height: number                            // Extrusion depth in feet
  color: string                             // Hex color (e.g., "#FF5733")
}

/**
 * RugShape: A flat rectangular rug with an image texture on top
 */
export interface RugShape {
  type: 'rug'
  width: number           // feet (X-axis)
  depth: number           // feet (Z-axis)
  thickness: number       // feet (Y-axis, typically 0.02-0.1)
  texturePath: string     // URL to uploaded texture image
}

/**
 * FrameShape: A picture frame with image, mat, and frame layers
 */
export interface FrameShape {
  type: 'frame'
  imagePath: string       // URL to uploaded image
  imageWidth: number      // feet
  imageHeight: number     // feet
  matWidth: number        // feet (mat border width)
  matColor: string        // hex color
  frameWidth: number      // feet (frame border width)
  frameDepth: number      // feet (frame thickness)
  frameColor: string      // hex color
}

/**
 * ShelfShape: A simple floating shelf (box)
 */
export interface ShelfShape {
  type: 'shelf'
  width: number           // feet (X-axis)
  height: number          // feet (Y-axis, shelf thickness)
  depth: number           // feet (Z-axis)
  color: string           // hex color
}

// ============================================
// Enhanced Shapes with Per-Face Materials
// ============================================

/**
 * How a texture should be applied to a face
 */
export type TextureFitMode = 'stretch' | 'tile'

/**
 * Material definition for a single face
 */
export interface FaceMaterial {
  color: string                    // Hex color (base color, also used as fallback)
  texturePath?: string             // URL to texture image (optional)
  textureMode?: TextureFitMode     // How to apply texture (default: 'stretch')
  textureRepeat?: {                // Only used when textureMode === 'tile'
    x: number                      // Repeat count on X axis
    y: number                      // Repeat count on Y axis
  }
  metalness?: number               // 0-1 (default: 0.1)
  roughness?: number               // 0-1 (default: 0.7)
}

/**
 * Face identifiers for an extruded polygon
 * For an N-sided polygon, there are N+2 faces:
 * - 'top' and 'bottom' caps
 * - 'side-0' through 'side-(N-1)' for each edge
 */
export type ExtrusionFaceId = 'top' | 'bottom' | `side-${number}`

/**
 * Per-face material mapping for an extrusion shape
 * Key is the face identifier, value is the material
 */
export type ExtrusionFaceMaterials = {
  [key in ExtrusionFaceId]?: FaceMaterial
}

/**
 * ExtrusionShapeV2: Enhanced extrusion with per-face materials
 * Replaces single-color ExtrusionShape for new creations
 */
export interface ExtrusionShapeV2 {
  type: 'extrusion-v2'
  points: Array<{ x: number; y: number }>  // 2D polygon vertices (closed, in feet)
  height: number                            // Extrusion depth in feet
  defaultMaterial: FaceMaterial             // Fallback for faces without specific materials
  faceMaterials?: ExtrusionFaceMaterials    // Per-face material overrides
}

/**
 * A single positioned/rotated shape within a composite item
 */
export interface CompositeShapePart {
  id: string                                // Unique identifier within the composite
  name: string                              // Display name (e.g., "Base", "Top section")
  shape: ExtrusionShapeV2                   // The shape data

  // Transform relative to composite origin
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }  // Radians

  // Editing state
  locked: boolean                           // If true, cannot be selected/edited
  visible: boolean                          // If false, hidden in preview
}

/**
 * CompositeShape: Multiple shapes combined into one item
 * Allows building complex furniture from simple extruded parts
 */
export interface CompositeShape {
  type: 'composite'
  parts: CompositeShapePart[]
}

/**
 * ParametricShape: Union of all procedurally-generated shape types
 */
export type ParametricShape =
  | ExtrusionShape      // Legacy single-color extrusion
  | ExtrusionShapeV2    // Enhanced per-face materials
  | CompositeShape      // Multi-shape composition
  | RugShape
  | FrameShape
  | ShelfShape

/**
 * MaterialOverride: Customization for a specific material in a 3D model
 */
export interface MaterialOverride {
  materialName: string      // THREE.js material.name
  materialIndex?: number    // Fallback for unnamed materials
  baseColor?: string        // Hex color (e.g., "#FF5733")
  metalness?: number        // 0-1 (optional)
  roughness?: number        // 0-1 (optional)
  // Texture override (reskin)
  texturePath?: string              // URL to texture image
  textureMode?: 'stretch' | 'tile'  // How to fit texture on surface
  textureRepeat?: { x: number; y: number }  // Repeat count for tile mode
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

  // Surface capability
  isSurface?: boolean           // Can other items be placed on this? (rugs, shelves)

  // Variant support
  parentItemId?: string         // If set, this item is a variant of the parent item
  variantName?: string          // Short label for this variant: "Red", "Large", "Oak"

  // Metadata
  createdAt: string
  updatedAt: string
  isCustom: boolean             // User-uploaded vs built-in
}

/**
 * WallPlacement: Position data for wall-mounted items
 * Uses wall-relative coordinates for intuitive editing
 */
export interface WallPlacement {
  roomId: string
  wallSide: 'north' | 'south' | 'east' | 'west'
  heightFromFloor: number    // feet (Y position relative to floor)
  lateralOffset: number      // feet (offset from wall center, positive = right when facing wall)
  normalOffset: number       // feet (distance from wall surface, typically item depth/2)
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
  position: Vector3             // feet (world coords for floor items, relative for surface children)
  rotation: Vector3             // radians
  scaleMultiplier: Vector3      // User scale adjustment (default: {x:1, y:1, z:1})

  // Surface hierarchy
  parentSurfaceId?: string      // 'floor' or instance ID of parent surface
  parentSurfaceType?: 'floor' | 'item'  // Discriminator for parent type

  // Wall placement (only for wall-mounted items)
  wallPlacement?: WallPlacement

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
