/**
 * Two-Sided Wall Segment Architecture
 *
 * Walls are first-class entities with independent styling per side.
 * Rooms reference walls (not own them). No more SharedWall complexity.
 *
 * Side Convention:
 * - Normal vector N = perpendicular to wall direction, pointing LEFT
 * - Side A faces positive normal (left of travel direction)
 * - Side B faces negative normal (right of travel direction)
 * - When walking from start to end vertex: A is on left, B is on right
 */

/**
 * Styling for one side of a wall
 */
export interface WallSideStyle {
  id: string
  color: string              // Hex color (e.g., "#FFFFFF")

  // Future: texture support
  textureUrl?: string
  textureRepeat?: { x: number; y: number }

  // Material properties
  roughness?: number         // 0-1, default 0.8
  metalness?: number         // 0-1, default 0
}

/**
 * Default wall styles
 */
export const DEFAULT_INTERIOR_STYLE: WallSideStyle = {
  id: 'default-interior',
  color: '#F5F5F5',
  roughness: 0.8,
  metalness: 0,
}

export const DEFAULT_EXTERIOR_STYLE: WallSideStyle = {
  id: 'default-exterior',
  color: '#E0E0E0',
  roughness: 0.9,
  metalness: 0,
}

/**
 * A door opening in a wall segment
 * Position is relative to segment start vertex
 */
export interface WallSegmentDoor {
  id: string
  position: number           // Distance from segment start (feet)
  width: number              // Door width (feet, default 3)
  height: number             // Door height (feet, default 7)

  // Future: door types
  type?: 'standard' | 'double' | 'sliding' | 'pocket'
  swingDirection?: 'inward-left' | 'inward-right' | 'outward-left' | 'outward-right'
}

/**
 * Reference to a room for one side of a wall
 */
export interface WallSideReference {
  roomId: string | null      // null = exterior or unassigned
  style: WallSideStyle
}

/**
 * A wall segment with two independently styled sides
 *
 * This is the core building block - replaces both individual room walls
 * and the SharedWall concept.
 */
export interface WallSegment {
  id: string

  // Geometry: connects two vertices
  startVertexId: string
  endVertexId: string

  // Vertical dimensions
  height: number             // Wall height in feet (default 10)
  baseHeight?: number        // Height from floor (default 0, for partial walls)

  // Two-sided styling
  sideA: WallSideReference   // Faces positive normal (left of direction)
  sideB: WallSideReference   // Faces negative normal (right of direction)

  // Door openings (cut through both sides)
  doors: WallSegmentDoor[]

  // Metadata
  isExterior?: boolean       // True if any side faces no room
  parentWallId?: string      // If this was split from a larger wall
}

/**
 * Computed wall segment data for rendering
 * Generated from WallSegment + vertices at runtime
 */
export interface ComputedWallSegment {
  segment: WallSegment

  // World-space geometry (2D floorplan coords)
  startPoint: { x: number; y: number }
  endPoint: { x: number; y: number }
  length: number

  // Normal direction (unit vector, perpendicular to wall, facing sideA)
  normal: { x: number; y: number }

  // 3D rendering data
  position3D: [number, number, number]   // Center position in 3D space
  rotation3D: [number, number, number]   // Euler rotation (around Y axis)
}

/**
 * Generate unique ID for wall segments
 */
export function generateWallSegmentId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate unique ID for wall side styles
 */
export function generateStyleId(): string {
  return `style-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new wall segment with default styles
 */
export function createWallSegment(
  startVertexId: string,
  endVertexId: string,
  height: number = 10
): WallSegment {
  const id = generateWallSegmentId()
  return {
    id,
    startVertexId,
    endVertexId,
    height,
    sideA: {
      roomId: null,
      style: { ...DEFAULT_INTERIOR_STYLE, id: generateStyleId() }
    },
    sideB: {
      roomId: null,
      style: { ...DEFAULT_INTERIOR_STYLE, id: generateStyleId() }
    },
    doors: [],
  }
}

/**
 * Create a wall segment door
 */
export function createWallSegmentDoor(
  position: number,
  width: number = 3,
  height: number = 7
): WallSegmentDoor {
  return {
    id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    position,
    width,
    height,
  }
}
