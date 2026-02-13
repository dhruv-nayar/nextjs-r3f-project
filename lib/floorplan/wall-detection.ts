/**
 * Wall Detection for Door Placement
 *
 * Detects which wall of which room was clicked based on pointer coordinates.
 * Used when placing doors on room walls.
 */

import { FloorplanRoom, Point2D, WallSide, MIN_DOOR_CORNER_DISTANCE } from '@/types/floorplan'
import type { Canvas, Group } from 'fabric'

const PIXELS_PER_FOOT = 10
const DETECTION_THRESHOLD = 15  // pixels - how close to wall edge to trigger detection

export interface WallClickResult {
  room: FloorplanRoom | null
  wallSide: WallSide
  position: number  // Position along wall in feet
}

/**
 * Detect which wall was clicked (using canvas objects for accurate positions)
 *
 * @param point - Click point in canvas coordinates (pixels)
 * @param canvas - Fabric.js canvas instance
 * @param rooms - All rooms in the floorplan (for data reference)
 * @param pixelsPerFoot - Scale factor (default 10)
 * @param threshold - Detection threshold in pixels (default 15)
 * @returns Wall click information or null if no wall detected
 */
export function detectWallClick(
  point: Point2D,
  rooms: FloorplanRoom[],
  pixelsPerFoot: number = PIXELS_PER_FOOT,
  threshold: number = DETECTION_THRESHOLD,
  canvas?: Canvas
): WallClickResult {
  // If canvas is provided, use visual bounds from canvas objects
  if (canvas) {
    return detectWallClickFromCanvas(point, canvas, rooms, pixelsPerFoot, threshold)
  }

  // Fallback: use stored room data
  for (const room of rooms) {
    const bounds = getRoomBounds(room, pixelsPerFoot)

    // Check top wall
    if (isNearHorizontalWall(point, bounds.top, bounds.left, bounds.right, threshold)) {
      return {
        room,
        wallSide: 'top',
        position: (point.x - bounds.left) / pixelsPerFoot
      }
    }

    // Check bottom wall
    if (isNearHorizontalWall(point, bounds.bottom, bounds.left, bounds.right, threshold)) {
      return {
        room,
        wallSide: 'bottom',
        position: (point.x - bounds.left) / pixelsPerFoot
      }
    }

    // Check left wall
    if (isNearVerticalWall(point, bounds.left, bounds.top, bounds.bottom, threshold)) {
      return {
        room,
        wallSide: 'left',
        position: (point.y - bounds.top) / pixelsPerFoot
      }
    }

    // Check right wall
    if (isNearVerticalWall(point, bounds.right, bounds.top, bounds.bottom, threshold)) {
      return {
        room,
        wallSide: 'right',
        position: (point.y - bounds.top) / pixelsPerFoot
      }
    }
  }

  // No wall detected
  return {
    room: null,
    wallSide: 'top',
    position: 0
  }
}

/**
 * Detect wall click using actual canvas object positions
 */
function detectWallClickFromCanvas(
  point: Point2D,
  canvas: Canvas,
  rooms: FloorplanRoom[],
  pixelsPerFoot: number,
  threshold: number
): WallClickResult {
  // Get all room objects from canvas
  const roomObjects = canvas.getObjects().filter(obj => obj.get('objectType') === 'room') as Group[]

  for (const roomObj of roomObjects) {
    const roomId = roomObj.get('roomId') as string
    const room = rooms.find(r => r.id === roomId)
    if (!room) continue

    // Get visual bounds from the canvas object
    const bounds = getCanvasObjectBounds(roomObj, pixelsPerFoot)

    // Check top wall
    if (isNearHorizontalWall(point, bounds.top, bounds.left, bounds.right, threshold)) {
      return {
        room,
        wallSide: 'top',
        position: (point.x - bounds.left) / pixelsPerFoot
      }
    }

    // Check bottom wall
    if (isNearHorizontalWall(point, bounds.bottom, bounds.left, bounds.right, threshold)) {
      return {
        room,
        wallSide: 'bottom',
        position: (point.x - bounds.left) / pixelsPerFoot
      }
    }

    // Check left wall
    if (isNearVerticalWall(point, bounds.left, bounds.top, bounds.bottom, threshold)) {
      return {
        room,
        wallSide: 'left',
        position: (point.y - bounds.top) / pixelsPerFoot
      }
    }

    // Check right wall
    if (isNearVerticalWall(point, bounds.right, bounds.top, bounds.bottom, threshold)) {
      return {
        room,
        wallSide: 'right',
        position: (point.y - bounds.top) / pixelsPerFoot
      }
    }
  }

  return {
    room: null,
    wallSide: 'top',
    position: 0
  }
}

/**
 * Get bounds from canvas object (accounts for current visual position)
 */
function getCanvasObjectBounds(group: Group, pixelsPerFoot: number) {
  const left = group.left || 0
  const top = group.top || 0
  const width = (group.width || 0) * (group.scaleX || 1)
  const height = (group.height || 0) * (group.scaleY || 1)

  // Groups are centered, so convert to top-left bounds
  return {
    left: left - width / 2,
    top: top - height / 2,
    right: left + width / 2,
    bottom: top + height / 2,
    width,
    height
  }
}

/**
 * Get room bounds in pixels from stored data
 */
function getRoomBounds(room: FloorplanRoom, pixelsPerFoot: number) {
  return {
    left: room.x * pixelsPerFoot,
    top: room.y * pixelsPerFoot,
    right: (room.x + room.width) * pixelsPerFoot,
    bottom: (room.y + room.height) * pixelsPerFoot
  }
}

/**
 * Check if point is near a horizontal wall (top or bottom)
 */
function isNearHorizontalWall(
  point: Point2D,
  wallY: number,
  leftX: number,
  rightX: number,
  threshold: number
): boolean {
  return (
    Math.abs(point.y - wallY) < threshold &&
    point.x >= leftX - threshold &&
    point.x <= rightX + threshold
  )
}

/**
 * Check if point is near a vertical wall (left or right)
 */
function isNearVerticalWall(
  point: Point2D,
  wallX: number,
  topY: number,
  bottomY: number,
  threshold: number
): boolean {
  return (
    Math.abs(point.x - wallX) < threshold &&
    point.y >= topY - threshold &&
    point.y <= bottomY + threshold
  )
}

/**
 * Validate door position on wall
 * Ensures door is not too close to corners
 */
export function validateDoorPosition(
  wallSide: WallSide,
  position: number,  // feet from wall start
  doorWidth: number,  // feet
  room: FloorplanRoom,
  minCornerDistance: number = 1  // feet
): { valid: boolean, error?: string } {
  const wallLength = getWallLength(wallSide, room)

  // Check if door fits on wall
  if (position < 0 || position + doorWidth > wallLength) {
    return {
      valid: false,
      error: 'Door does not fit on wall'
    }
  }

  // Check minimum distance from left corner
  if (position < minCornerDistance) {
    return {
      valid: false,
      error: `Door must be at least ${minCornerDistance}ft from corner`
    }
  }

  // Check minimum distance from right corner
  if (position + doorWidth > wallLength - minCornerDistance) {
    return {
      valid: false,
      error: `Door must be at least ${minCornerDistance}ft from corner`
    }
  }

  return { valid: true }
}

/**
 * Get wall length based on wall side
 */
function getWallLength(wallSide: WallSide, room: FloorplanRoom): number {
  switch (wallSide) {
    case 'top':
    case 'bottom':
      return room.width  // Horizontal walls
    case 'left':
    case 'right':
      return room.height  // Vertical walls
  }
}

/**
 * Snap door position to grid (optional, for Phase 2)
 */
export function snapToGrid(position: number, gridSize: number = 1): number {
  return Math.round(position / gridSize) * gridSize
}

/**
 * Get closest valid door position
 * Adjusts position if too close to corners
 */
export function getClosestValidPosition(
  wallSide: WallSide,
  position: number,
  doorWidth: number,
  room: FloorplanRoom,
  minCornerDistance: number = MIN_DOOR_CORNER_DISTANCE
): number {
  const wallLength = getWallLength(wallSide, room)

  // Clamp to wall bounds
  let validPosition = Math.max(0, Math.min(position, wallLength - doorWidth))

  // Adjust if too close to left corner
  if (validPosition < minCornerDistance) {
    validPosition = minCornerDistance
  }

  // Adjust if too close to right corner
  if (validPosition + doorWidth > wallLength - minCornerDistance) {
    validPosition = wallLength - doorWidth - minCornerDistance
  }

  return validPosition
}
