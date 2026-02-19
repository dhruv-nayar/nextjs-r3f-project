/**
 * Wall Segment Utilities
 *
 * Core algorithms for two-sided wall segments:
 * - Normal calculation (consistent direction convention)
 * - Segment computation (2D → 3D transformation)
 * - Side assignment (determine A/B for room boundaries)
 * - Exterior detection
 */

import type { FloorplanVertex, FloorplanRoomV3 } from '@/types/floorplan-v2'
import type {
  WallSegment,
  ComputedWallSegment,
  WallSideStyle,
  DEFAULT_INTERIOR_STYLE,
  DEFAULT_EXTERIOR_STYLE,
} from '@/types/wall-segment'

/**
 * Calculate distance between two points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate wall normal vector (perpendicular to wall, pointing LEFT)
 *
 * Convention:
 * - For wall from start (S) to end (E)
 * - Direction D = E - S
 * - Normal N = perpendicular to D, pointing LEFT
 * - N = (-D.y, D.x) normalized
 *
 * Side A faces positive normal (left of travel direction)
 * Side B faces negative normal (right of travel direction)
 */
export function calculateWallNormal(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number } {
  const dx = endX - startX
  const dy = endY - startY
  const length = Math.sqrt(dx * dx + dy * dy)

  if (length < 0.001) {
    // Zero-length wall, return default normal
    return { x: 0, y: 1 }
  }

  // Perpendicular pointing left (counterclockwise 90 degrees)
  // If direction is (dx, dy), perpendicular left is (-dy, dx)
  return {
    x: -dy / length,
    y: dx / length,
  }
}

/**
 * Compute global center offset from segment endpoints
 * This matches the centering logic in convertV2To3D (which computes from room bounds)
 *
 * Important: We compute from segment endpoints rather than all vertices to ensure
 * we match the bounds that convertV2To3D computes from room polygons. This avoids
 * issues with orphan vertices that aren't part of any room/wall.
 */
export function computeGlobalCenter(
  vertices: FloorplanVertex[],
  segments?: WallSegment[]
): { x: number; y: number } {
  // If no segments provided, fall back to using all vertices
  if (!segments || segments.length === 0) {
    if (vertices.length === 0) {
      return { x: 0, y: 0 }
    }

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const v of vertices) {
      minX = Math.min(minX, v.x)
      maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y)
      maxY = Math.max(maxY, v.y)
    }

    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    }
  }

  // Compute bounds from segment endpoints only
  const vertexMap = new Map(vertices.map(v => [v.id, v]))
  const usedVertexIds = new Set<string>()

  for (const segment of segments) {
    usedVertexIds.add(segment.startVertexId)
    usedVertexIds.add(segment.endVertexId)
  }

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const vertexId of usedVertexIds) {
    const v = vertexMap.get(vertexId)
    if (!v) continue

    minX = Math.min(minX, v.x)
    maxX = Math.max(maxX, v.x)
    minY = Math.min(minY, v.y)
    maxY = Math.max(maxY, v.y)
  }

  if (minX === Infinity) {
    return { x: 0, y: 0 }
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  }
}

/**
 * Compute 3D rendering data for a wall segment
 *
 * Transforms 2D floorplan coords to 3D scene coords using the same
 * transformation as convertV2To3D:
 * - Coordinates are negated and centered around the global center
 * - 2D: (x, y) on floorplan canvas
 * - 3D: (-x + centerX, height, -y + centerY) - negated and centered
 */
export function computeWallSegment(
  segment: WallSegment,
  vertices: FloorplanVertex[],
  globalCenter?: { x: number; y: number }
): ComputedWallSegment | null {
  const vertexMap = new Map(vertices.map(v => [v.id, v]))
  const start = vertexMap.get(segment.startVertexId)
  const end = vertexMap.get(segment.endVertexId)

  if (!start || !end) {
    console.warn(`[computeWallSegment] Missing vertices for segment ${segment.id}`)
    return null
  }

  const length = distance(start.x, start.y, end.x, end.y)

  if (length < 0.01) {
    console.warn(`[computeWallSegment] Zero-length segment ${segment.id}`)
    return null
  }

  // Use provided center or compute from vertices
  const center = globalCenter || computeGlobalCenter(vertices)

  // Calculate normal (in 2D floorplan space)
  const normal = calculateWallNormal(start.x, start.y, end.x, end.y)

  // Calculate center position (in 2D)
  const centerX = (start.x + end.x) / 2
  const centerY = (start.y + end.y) / 2

  // Convert to 3D coordinates - MUST MATCH convertV2To3D transformation
  // The transform is: position3D = [-(x - center.x), 0, -(y - center.y)]
  // This negates and centers the coordinates
  const position3D: [number, number, number] = [
    -(centerX - center.x),
    segment.height / 2,
    -(centerY - center.y),
  ]

  // Calculate rotation around Y axis
  // Wall direction in 3D XZ plane after negation: (-(end.x - start.x), -(end.y - start.y))
  // Which simplifies to: (-dx, -dz) where dx = end.x - start.x, dz = end.y - start.y
  const dx = end.x - start.x
  const dz = end.y - start.y
  // After negation, direction becomes (-dx, -dz)
  // PlaneGeometry width is along local X, rotated by angle around Y
  // atan2(-(-dz), -dx) = atan2(dz, -dx)
  const angle = Math.atan2(dz, -dx)

  const rotation3D: [number, number, number] = [0, angle, 0]

  return {
    segment,
    startPoint: { x: start.x, y: start.y },
    endPoint: { x: end.x, y: end.y },
    length,
    normal,
    position3D,
    rotation3D,
  }
}

/**
 * Determine which side of each segment faces into a room
 *
 * Algorithm:
 * 1. Walk the room boundary in order
 * 2. For each segment, check if we traverse start→end or end→start
 * 3. If start→end: room is on RIGHT (side B)
 * 4. If end→start: room is on LEFT (side A)
 * 5. Verify winding order and flip if necessary
 */
export function assignRoomSides(
  room: FloorplanRoomV3,
  segments: WallSegment[],
  vertices: FloorplanVertex[]
): Record<string, 'A' | 'B'> {
  const segmentMap = new Map(segments.map(s => [s.id, s]))
  const sides: Record<string, 'A' | 'B'> = {}

  if (room.boundarySegmentIds.length === 0) {
    return sides
  }

  // Walk the boundary and track which vertex we're at
  let currentVertexId: string | null = null

  for (let i = 0; i < room.boundarySegmentIds.length; i++) {
    const segmentId = room.boundarySegmentIds[i]
    const segment = segmentMap.get(segmentId)

    if (!segment) {
      console.warn(`[assignRoomSides] Missing segment ${segmentId} for room ${room.id}`)
      continue
    }

    if (currentVertexId === null) {
      // First segment - determine starting direction using next segment
      const nextIndex = (i + 1) % room.boundarySegmentIds.length
      const nextSegmentId = room.boundarySegmentIds[nextIndex]
      const nextSegment = segmentMap.get(nextSegmentId)

      if (!nextSegment) {
        // Can't determine direction, assume start→end
        currentVertexId = segment.startVertexId
      } else {
        // Find shared vertex between this segment and next
        if (
          segment.endVertexId === nextSegment.startVertexId ||
          segment.endVertexId === nextSegment.endVertexId
        ) {
          // This segment's end connects to next segment
          currentVertexId = segment.startVertexId
        } else {
          // This segment's start connects to next segment
          currentVertexId = segment.endVertexId
        }
      }
    }

    // Determine traversal direction
    if (currentVertexId === segment.startVertexId) {
      // Traversing start→end: room is on RIGHT (side B)
      sides[segmentId] = 'B'
      currentVertexId = segment.endVertexId
    } else if (currentVertexId === segment.endVertexId) {
      // Traversing end→start: room is on LEFT (side A)
      sides[segmentId] = 'A'
      currentVertexId = segment.startVertexId
    } else {
      // Gap in boundary - shouldn't happen with valid data
      console.warn(`[assignRoomSides] Gap in boundary at segment ${segmentId}`)
      // Try to continue by finding a connected vertex
      sides[segmentId] = 'A' // Default
      currentVertexId = segment.endVertexId
    }
  }

  // Verify winding order (should be counterclockwise for interior rooms)
  const isCounterClockwise = verifyCounterClockwiseWinding(room, segments, vertices)
  if (!isCounterClockwise) {
    // Flip all sides
    for (const segmentId of Object.keys(sides)) {
      sides[segmentId] = sides[segmentId] === 'A' ? 'B' : 'A'
    }
  }

  return sides
}

/**
 * Get room polygon vertices from boundary segments
 */
export function getRoomPolygon(
  room: FloorplanRoomV3,
  segments: WallSegment[],
  vertices: FloorplanVertex[]
): Array<{ x: number; y: number }> | null {
  const segmentMap = new Map(segments.map(s => [s.id, s]))
  const vertexMap = new Map(vertices.map(v => [v.id, v]))

  const polygon: Array<{ x: number; y: number }> = []
  let currentVertexId: string | null = null

  for (let i = 0; i < room.boundarySegmentIds.length; i++) {
    const segmentId = room.boundarySegmentIds[i]
    const segment = segmentMap.get(segmentId)

    if (!segment) continue

    if (currentVertexId === null) {
      // First segment - determine starting vertex
      const nextIndex = (i + 1) % room.boundarySegmentIds.length
      const nextSegmentId = room.boundarySegmentIds[nextIndex]
      const nextSegment = segmentMap.get(nextSegmentId)

      if (nextSegment) {
        if (
          segment.endVertexId === nextSegment.startVertexId ||
          segment.endVertexId === nextSegment.endVertexId
        ) {
          currentVertexId = segment.startVertexId
        } else {
          currentVertexId = segment.endVertexId
        }
      } else {
        currentVertexId = segment.startVertexId
      }
    }

    // Add current vertex to polygon
    const vertex = vertexMap.get(currentVertexId)
    if (vertex) {
      polygon.push({ x: vertex.x, y: vertex.y })
    }

    // Move to next vertex
    if (currentVertexId === segment.startVertexId) {
      currentVertexId = segment.endVertexId
    } else {
      currentVertexId = segment.startVertexId
    }
  }

  return polygon.length >= 3 ? polygon : null
}

/**
 * Check if room boundary is counterclockwise (positive signed area)
 */
export function verifyCounterClockwiseWinding(
  room: FloorplanRoomV3,
  segments: WallSegment[],
  vertices: FloorplanVertex[]
): boolean {
  const polygon = getRoomPolygon(room, segments, vertices)
  if (!polygon || polygon.length < 3) return true // Default to true

  // Calculate signed area using shoelace formula
  let signedArea = 0
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    signedArea += polygon[i].x * polygon[j].y
    signedArea -= polygon[j].x * polygon[i].y
  }

  return signedArea > 0 // Positive = counterclockwise
}

/**
 * Mark exterior segments and assign default exterior styles
 *
 * A segment is exterior if one of its sides doesn't face any room.
 */
export function markExteriorSegments(
  segments: WallSegment[],
  rooms: FloorplanRoomV3[]
): WallSegment[] {
  // Build map of which rooms reference each segment side
  const sideReferences = new Map<string, { A: string | null; B: string | null }>()

  for (const segment of segments) {
    sideReferences.set(segment.id, { A: null, B: null })
  }

  for (const room of rooms) {
    for (const segmentId of room.boundarySegmentIds) {
      const side = room.segmentSides[segmentId]
      const refs = sideReferences.get(segmentId)
      if (refs && side) {
        refs[side] = room.id
      }
    }
  }

  // Update segments with room references and exterior status
  return segments.map(segment => {
    const refs = sideReferences.get(segment.id)
    if (!refs) return segment

    const isExterior = refs.A === null || refs.B === null

    return {
      ...segment,
      isExterior,
      sideA: {
        ...segment.sideA,
        roomId: refs.A,
      },
      sideB: {
        ...segment.sideB,
        roomId: refs.B,
      },
    }
  })
}

/**
 * Update a wall side's style
 */
export function updateWallSideStyle(
  segments: WallSegment[],
  segmentId: string,
  side: 'A' | 'B',
  styleUpdates: Partial<WallSideStyle>
): WallSegment[] {
  return segments.map(segment => {
    if (segment.id !== segmentId) return segment

    const sideKey = side === 'A' ? 'sideA' : 'sideB'
    return {
      ...segment,
      [sideKey]: {
        ...segment[sideKey],
        style: {
          ...segment[sideKey].style,
          ...styleUpdates,
        },
      },
    }
  })
}

/**
 * Find which segment and side a point is closest to
 * Used for click detection on walls
 */
export function findClosestWallSide(
  point: { x: number; y: number },
  segments: WallSegment[],
  vertices: FloorplanVertex[],
  maxDistance: number = 1.0
): { segmentId: string; side: 'A' | 'B' } | null {
  const vertexMap = new Map(vertices.map(v => [v.id, v]))

  let closest: { segmentId: string; side: 'A' | 'B'; distance: number } | null = null

  for (const segment of segments) {
    const start = vertexMap.get(segment.startVertexId)
    const end = vertexMap.get(segment.endVertexId)

    if (!start || !end) continue

    // Calculate distance from point to line segment
    const dist = pointToSegmentDistance(
      point.x,
      point.y,
      start.x,
      start.y,
      end.x,
      end.y
    )

    if (dist > maxDistance) continue

    if (!closest || dist < closest.distance) {
      // Determine which side the point is on
      const normal = calculateWallNormal(start.x, start.y, end.x, end.y)

      // Vector from wall center to point
      const centerX = (start.x + end.x) / 2
      const centerY = (start.y + end.y) / 2
      const toPointX = point.x - centerX
      const toPointY = point.y - centerY

      // Dot product with normal tells us which side
      const dot = toPointX * normal.x + toPointY * normal.y

      closest = {
        segmentId: segment.id,
        side: dot >= 0 ? 'A' : 'B',
        distance: dist,
      }
    }
  }

  return closest ? { segmentId: closest.segmentId, side: closest.side } : null
}

/**
 * Calculate perpendicular distance from point to line segment
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy

  if (lengthSq < 0.0001) {
    // Zero-length segment, return distance to point
    return distance(px, py, x1, y1)
  }

  // Project point onto line, clamped to segment
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))

  // Closest point on segment
  const closestX = x1 + t * dx
  const closestY = y1 + t * dy

  return distance(px, py, closestX, closestY)
}

/**
 * Project point onto segment and return parameter t (0 to 1)
 */
export function projectPointOntoSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy

  if (lengthSq < 0.0001) {
    return 0
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq
  return Math.max(0, Math.min(1, t))
}

// ============================================================================
// Door Validation and Management
// ============================================================================

/**
 * Minimum distance from wall edge (corner) to door edge
 * Prevents doors from being placed too close to corners
 */
export const MIN_EDGE_DISTANCE = 0.5 // feet (~6 inches)

/**
 * Minimum distance between adjacent doors
 */
export const MIN_DOOR_SPACING = 0.5 // feet

/**
 * Default door dimensions
 */
export const DEFAULT_DOOR_WIDTH = 3 // feet
export const DEFAULT_DOOR_HEIGHT = 7 // feet

/**
 * Door validation error types
 */
export type DoorValidationError =
  | 'wall_too_short'
  | 'too_close_to_start'
  | 'too_close_to_end'
  | 'overlaps_existing_door'
  | 'door_too_tall'
  | 'invalid_dimensions'
  | null

/**
 * Result of door placement validation
 */
export interface DoorValidationResult {
  valid: boolean
  error: DoorValidationError
  message: string | null
  suggestedPosition?: number // Nearest valid position, if applicable
}

/**
 * Calculate wall segment length from vertices
 */
export function getSegmentLength(
  segment: WallSegment,
  vertices: FloorplanVertex[]
): number {
  const vertexMap = new Map(vertices.map(v => [v.id, v]))
  const start = vertexMap.get(segment.startVertexId)
  const end = vertexMap.get(segment.endVertexId)

  if (!start || !end) return 0

  return distance(start.x, start.y, end.x, end.y)
}

/**
 * Validate if a door can be placed at a specific position on a wall segment
 *
 * Validation rules:
 * 1. Wall must be long enough: length >= doorWidth + 2 * MIN_EDGE_DISTANCE
 * 2. Door position must be at least MIN_EDGE_DISTANCE from wall start
 * 3. Door end must be at least MIN_EDGE_DISTANCE from wall end
 * 4. Door must not overlap with existing doors (including MIN_DOOR_SPACING)
 * 5. Door height must be less than wall height
 * 6. Door dimensions must be positive
 */
export function canPlaceDoor(
  segment: WallSegment,
  wallLength: number,
  doorPosition: number,
  doorWidth: number = DEFAULT_DOOR_WIDTH,
  doorHeight: number = DEFAULT_DOOR_HEIGHT
): DoorValidationResult {
  // Validate door dimensions
  if (doorWidth <= 0 || doorHeight <= 0) {
    return {
      valid: false,
      error: 'invalid_dimensions',
      message: 'Door dimensions must be positive',
    }
  }

  // Check if door is too tall for wall
  if (doorHeight > segment.height) {
    return {
      valid: false,
      error: 'door_too_tall',
      message: `Door height (${doorHeight}ft) exceeds wall height (${segment.height}ft)`,
    }
  }

  // Check if wall is long enough
  const minWallLength = doorWidth + 2 * MIN_EDGE_DISTANCE
  if (wallLength < minWallLength) {
    return {
      valid: false,
      error: 'wall_too_short',
      message: `Wall is too short (${wallLength.toFixed(1)}ft). Minimum ${minWallLength.toFixed(1)}ft needed for a ${doorWidth}ft door.`,
    }
  }

  // Check if door is too close to wall start
  if (doorPosition < MIN_EDGE_DISTANCE) {
    return {
      valid: false,
      error: 'too_close_to_start',
      message: `Door is too close to wall corner. Minimum ${MIN_EDGE_DISTANCE}ft from edge required.`,
      suggestedPosition: MIN_EDGE_DISTANCE,
    }
  }

  // Check if door end is too close to wall end
  const doorEnd = doorPosition + doorWidth
  const maxPosition = wallLength - MIN_EDGE_DISTANCE
  if (doorEnd > maxPosition) {
    return {
      valid: false,
      error: 'too_close_to_end',
      message: `Door extends too close to wall corner. Minimum ${MIN_EDGE_DISTANCE}ft from edge required.`,
      suggestedPosition: wallLength - doorWidth - MIN_EDGE_DISTANCE,
    }
  }

  // Check for overlap with existing doors
  for (const existingDoor of segment.doors) {
    const existingStart = existingDoor.position - MIN_DOOR_SPACING
    const existingEnd = existingDoor.position + existingDoor.width + MIN_DOOR_SPACING

    const newStart = doorPosition
    const newEnd = doorPosition + doorWidth

    // Check if ranges overlap
    if (newStart < existingEnd && newEnd > existingStart) {
      return {
        valid: false,
        error: 'overlaps_existing_door',
        message: `Door overlaps with existing door. Minimum ${MIN_DOOR_SPACING}ft spacing required.`,
      }
    }
  }

  return {
    valid: true,
    error: null,
    message: null,
  }
}

/**
 * Find a valid position for a door near the requested position
 * Returns null if no valid position exists
 */
export function findValidDoorPosition(
  segment: WallSegment,
  wallLength: number,
  requestedPosition: number,
  doorWidth: number = DEFAULT_DOOR_WIDTH,
  doorHeight: number = DEFAULT_DOOR_HEIGHT
): number | null {
  // First check if requested position is valid
  const result = canPlaceDoor(segment, wallLength, requestedPosition, doorWidth, doorHeight)
  if (result.valid) {
    return requestedPosition
  }

  // If wall is too short, no valid position exists
  if (result.error === 'wall_too_short' || result.error === 'invalid_dimensions' || result.error === 'door_too_tall') {
    return null
  }

  // If suggested position provided, try it
  if (result.suggestedPosition !== undefined) {
    const suggestedResult = canPlaceDoor(segment, wallLength, result.suggestedPosition, doorWidth, doorHeight)
    if (suggestedResult.valid) {
      return result.suggestedPosition
    }
  }

  // Try to find a valid position by scanning the wall
  const step = 0.25 // feet
  const minPos = MIN_EDGE_DISTANCE
  const maxPos = wallLength - doorWidth - MIN_EDGE_DISTANCE

  // Search outward from requested position
  for (let offset = 0; offset <= wallLength; offset += step) {
    // Try position to the right
    const rightPos = requestedPosition + offset
    if (rightPos >= minPos && rightPos <= maxPos) {
      const rightResult = canPlaceDoor(segment, wallLength, rightPos, doorWidth, doorHeight)
      if (rightResult.valid) {
        return rightPos
      }
    }

    // Try position to the left
    const leftPos = requestedPosition - offset
    if (leftPos >= minPos && leftPos <= maxPos) {
      const leftResult = canPlaceDoor(segment, wallLength, leftPos, doorWidth, doorHeight)
      if (leftResult.valid) {
        return leftPos
      }
    }
  }

  return null
}

/**
 * Add a door to a wall segment (immutable - returns new segment)
 * Returns null if door placement is invalid
 */
export function addDoorToSegment(
  segment: WallSegment,
  wallLength: number,
  position: number,
  width: number = DEFAULT_DOOR_WIDTH,
  height: number = DEFAULT_DOOR_HEIGHT
): WallSegment | null {
  const validation = canPlaceDoor(segment, wallLength, position, width, height)
  if (!validation.valid) {
    console.warn('[addDoorToSegment] Invalid door placement:', validation.message)
    return null
  }

  const newDoor: import('@/types/wall-segment').WallSegmentDoor = {
    id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    position,
    width,
    height,
  }

  return {
    ...segment,
    doors: [...segment.doors, newDoor],
  }
}

/**
 * Remove a door from a wall segment (immutable - returns new segment)
 */
export function removeDoorFromSegment(
  segment: WallSegment,
  doorId: string
): WallSegment {
  return {
    ...segment,
    doors: segment.doors.filter(d => d.id !== doorId),
  }
}

/**
 * Update a door's properties (immutable - returns new segment)
 */
export function updateDoorInSegment(
  segment: WallSegment,
  doorId: string,
  updates: Partial<Omit<import('@/types/wall-segment').WallSegmentDoor, 'id'>>
): WallSegment {
  return {
    ...segment,
    doors: segment.doors.map(door =>
      door.id === doorId ? { ...door, ...updates } : door
    ),
  }
}

/**
 * Get the center position of a wall segment in 2D coordinates
 */
export function getSegmentCenter(
  segment: WallSegment,
  vertices: FloorplanVertex[]
): { x: number; y: number } | null {
  const vertexMap = new Map(vertices.map(v => [v.id, v]))
  const start = vertexMap.get(segment.startVertexId)
  const end = vertexMap.get(segment.endVertexId)

  if (!start || !end) return null

  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

/**
 * Convert a click position (2D floorplan coords) to door position along wall
 * Returns the distance from segment start vertex to the click point
 */
export function clickPositionToDoorPosition(
  clickX: number,
  clickY: number,
  segment: WallSegment,
  vertices: FloorplanVertex[]
): number | null {
  const vertexMap = new Map(vertices.map(v => [v.id, v]))
  const start = vertexMap.get(segment.startVertexId)
  const end = vertexMap.get(segment.endVertexId)

  if (!start || !end) return null

  // Project click point onto the wall segment
  const t = projectPointOntoSegment(clickX, clickY, start.x, start.y, end.x, end.y)

  // Convert t (0-1) to distance from start
  const segmentLength = distance(start.x, start.y, end.x, end.y)
  return t * segmentLength
}
