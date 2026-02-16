/**
 * Selection Types for Unified Selection System
 * Handles selection of rooms, walls (virtual), floors (virtual), and furniture
 */

export type WallSide = 'north' | 'south' | 'east' | 'west'

// Selection type discriminators
export interface RoomSelection {
  type: 'room'
  roomId: string
}

export interface WallSelection {
  type: 'wall'
  roomId: string
  side: WallSide
}

export interface FloorSelection {
  type: 'floor'
  roomId: string
}

export interface FurnitureSelection {
  type: 'furniture'
  instanceId: string
  roomId: string
}

export type Selection = RoomSelection | WallSelection | FloorSelection | FurnitureSelection | null

// Type guards for selection types
export function isRoomSelection(selection: Selection): selection is RoomSelection {
  return selection?.type === 'room'
}

export function isWallSelection(selection: Selection): selection is WallSelection {
  return selection?.type === 'wall'
}

export function isFloorSelection(selection: Selection): selection is FloorSelection {
  return selection?.type === 'floor'
}

export function isFurnitureSelection(selection: Selection): selection is FurnitureSelection {
  return selection?.type === 'furniture'
}

/**
 * Grid settings for a single surface (wall or floor)
 */
export interface SurfaceGridSettings {
  enabled: boolean
  spacing: number      // Grid spacing in feet (e.g., 0.5, 1, 2)
  showRulers: boolean  // Show ruler marks on edges
}

/**
 * Default grid settings for a new surface
 */
export const DEFAULT_SURFACE_GRID_SETTINGS: SurfaceGridSettings = {
  enabled: false,
  spacing: 1,
  showRulers: true,
}

/**
 * Grid state for an entire room (all surfaces)
 */
export interface RoomGridState {
  floor: SurfaceGridSettings
  walls: Record<WallSide, SurfaceGridSettings>
}

/**
 * Create default grid state for a room
 */
export function createDefaultRoomGridState(): RoomGridState {
  return {
    floor: { ...DEFAULT_SURFACE_GRID_SETTINGS },
    walls: {
      north: { ...DEFAULT_SURFACE_GRID_SETTINGS },
      south: { ...DEFAULT_SURFACE_GRID_SETTINGS },
      east: { ...DEFAULT_SURFACE_GRID_SETTINGS },
      west: { ...DEFAULT_SURFACE_GRID_SETTINGS },
    },
  }
}

/**
 * Wall display names for UI
 */
export const WALL_DISPLAY_NAMES: Record<WallSide, string> = {
  north: 'North Wall',
  south: 'South Wall',
  east: 'East Wall',
  west: 'West Wall',
}

/**
 * Grid spacing options for dropdowns
 */
export const GRID_SPACING_OPTIONS = [
  { value: 0.5, label: "6 inches" },
  { value: 1, label: "1 foot" },
  { value: 2, label: "2 feet" },
]
