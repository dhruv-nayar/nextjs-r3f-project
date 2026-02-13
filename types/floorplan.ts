// ============================================
// 2D Floorplan Types for Home Builder
// ============================================

/**
 * 2D point in canvas space
 * Can represent pixels or feet depending on context
 */
export interface Point2D {
  x: number
  y: number
}

/**
 * Wall side in 2D top-down view
 * - top: Upper edge of room (becomes north/+Z in 3D)
 * - bottom: Lower edge of room (becomes south/-Z in 3D)
 * - left: Left edge of room (becomes west/-X in 3D)
 * - right: Right edge of room (becomes east/+X in 3D)
 */
export type WallSide = 'top' | 'bottom' | 'left' | 'right'

/**
 * Door placement in 2D floorplan
 */
export interface FloorplanDoor {
  id: string
  wallSide: WallSide          // Which wall the door is on
  position: number            // Distance from wall start in feet
  width: number               // Door width in feet (default 3)
  height: number              // Door height in feet (default 7)
}

/**
 * Rectangle-based room in 2D floorplan
 * Positioned with (x, y) as top-left corner
 */
export interface FloorplanRoom {
  id: string
  name: string

  // Rectangle position & dimensions (all in feet)
  x: number                   // Top-left X coordinate
  y: number                   // Top-left Y coordinate
  width: number               // Width along X-axis
  height: number              // Depth (becomes Z-axis depth in 3D)

  // 3D conversion properties
  wallHeight: number          // Wall height for 3D conversion (default 10ft)
  doors: FloorplanDoor[]      // Doors on room walls

  // Visual properties for editor
  color?: string              // Color for room differentiation
  fabricObjectId?: string     // Reference to Fabric.js canvas object
}

/**
 * Reference image for underlaying floorplan drawings
 */
export interface ReferenceImage {
  url: string                 // Image URL or data URL
  opacity: number             // Opacity 0-1 (default 0.5)
  x: number                   // Offset X in feet
  y: number                   // Offset Y in feet
  width: number               // Image width in feet (real-world dimensions)
  height: number              // Image height in feet (real-world dimensions)
  scale: number               // User scale adjustment (default 1.0)
  locked: boolean             // Lock position/movement (default false)
}

/**
 * Complete 2D floorplan document
 * This is the source of truth that gets converted to 3D rooms
 */
export interface FloorplanData {
  id: string
  homeId: string              // Parent home reference

  // Canvas configuration
  canvasWidth: number         // Canvas width in feet (default 50)
  canvasHeight: number        // Canvas height in feet (default 50)

  // Floorplan content
  rooms: FloorplanRoom[]      // All rooms in the floorplan

  // Optional reference image
  referenceImage?: ReferenceImage

  // Metadata
  createdAt: string
  updatedAt: string
}

/**
 * Tool types for floorplan editor
 */
export type FloorplanTool = 'select' | 'drawRoom' | 'placeDoor' | 'delete' | 'pan'

/**
 * Bounding box for calculating layout bounds
 */
export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}
