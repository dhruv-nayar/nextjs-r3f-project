/**
 * Wall-First Floorplan Data Structures (V2)
 *
 * Architecture: Vertices → Walls → Rooms
 * - Vertices are shared corner points
 * - Walls connect vertices (single source of truth)
 * - Rooms are computed from closed wall loops
 */

// Editor interaction modes
export enum EditorMode {
  SELECT = 'SELECT',
  DRAW_WALLS = 'DRAW_WALLS',
  PLACE_DOORS = 'PLACE_DOORS'
}

// A point in 2D space (shared corner)
export interface FloorplanVertex {
  id: string
  x: number  // feet from canvas origin
  y: number  // feet from canvas origin
}

// A door opening in a wall
export interface FloorplanDoorV2 {
  id: string
  position: number  // feet from start vertex (left edge of door)
  width: number     // feet (default 3)
  height: number    // feet (default 7)
}

// A wall segment connecting two vertices
export interface FloorplanWallV2 {
  id: string
  startVertexId: string
  endVertexId: string
  height?: number  // wall height in feet (default: 10)
  doors?: FloorplanDoorV2[]  // door openings in this wall
}

// A room is a closed loop of walls
export interface FloorplanRoomV2 {
  id: string
  name: string
  wallIds: string[]  // ordered list of wall IDs forming the closed shape
  color: string      // fill color for rendering
}

// Room colors palette (light, muted tones)
export const ROOM_COLORS = [
  '#E3F2FD', // Light Blue
  '#F3E5F5', // Light Purple
  '#E8F5E9', // Light Green
  '#FFF3E0', // Light Orange
  '#FCE4EC', // Light Pink
  '#E0F2F1', // Light Teal
  '#F1F8E9', // Light Lime
  '#FFF9C4', // Light Yellow
]

// Canvas constants
export const CANVAS_WIDTH = 900   // pixels
export const CANVAS_HEIGHT = 600  // pixels
export const PIXELS_PER_FOOT = 30 // 30 px = 1 ft
export const PIXELS_PER_INCH = PIXELS_PER_FOOT / 12 // 2.5 px = 1 inch
export const SNAP_DISTANCE = 0.5  // feet - snap radius for vertices
export const WALL_SNAP_DISTANCE = 0.3 // feet - snap radius for walls
export const GRID_SPACING = 2     // feet - grid line spacing
export const GRID_DOT_RADIUS = 0.5 // pixels - radius for inch dots
export const GRID_LINE_DASH = [2, 3] // dash pattern for foot lines

// Viewport state for infinite canvas with pan/zoom
export interface ViewportState {
  offsetX: number  // center X in world coords (feet)
  offsetY: number  // center Y in world coords (feet)
  scale: number    // zoom level (1.0 = default)
}

export const DEFAULT_VIEWPORT: ViewportState = {
  offsetX: 15,  // Center on typical floor plan area
  offsetY: 10,
  scale: 1.0
}

export const MIN_SCALE = 0.25
export const MAX_SCALE = 4.0
export const ZOOM_SENSITIVITY = 0.001

// Convert canvas pixels to feet
export function pixelsToFeet(px: number): number {
  return px / PIXELS_PER_FOOT
}

// Convert feet to canvas pixels
export function feetToPixels(ft: number): number {
  return ft * PIXELS_PER_FOOT
}

// Snap to 0.5ft grid
export function snapToGrid(value: number): number {
  return Math.round(value * 2) / 2
}

// Generate unique ID
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Complete V2 floorplan data structure (stored with Home)
export interface FloorplanDataV2 {
  vertices: FloorplanVertex[]
  walls: FloorplanWallV2[]
  rooms: FloorplanRoomV2[]
  // Canvas settings (for consistent editing)
  canvasWidth: number
  canvasHeight: number
  pixelsPerFoot: number
  // Metadata
  createdAt: string
  updatedAt: string
}
