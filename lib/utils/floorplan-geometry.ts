/**
 * Geometry utilities for wall-first floorplan editor
 */

import {
  FloorplanVertex,
  FloorplanWallV2,
  FloorplanRoomV2,
  FloorplanDoorV2,
  SNAP_DISTANCE,
  WALL_SNAP_DISTANCE,
  generateId,
  snapToGrid,
} from '@/types/floorplan-v2'
import { Room, SharedWall, SharedWallDoor, Vector3 } from '@/types/room'

/**
 * Calculate distance between two points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

/**
 * Find a vertex within snap distance of the given point
 */
export function findNearbyVertex(
  x: number,
  y: number,
  vertices: FloorplanVertex[],
  snapDistance: number = SNAP_DISTANCE
): FloorplanVertex | null {
  let closest: FloorplanVertex | null = null
  let closestDist = snapDistance

  for (const vertex of vertices) {
    const d = distance(x, y, vertex.x, vertex.y)
    if (d < closestDist) {
      closestDist = d
      closest = vertex
    }
  }

  return closest
}

/**
 * Calculate the perpendicular distance from a point to a line segment
 * Returns both the distance and the closest point on the segment
 */
export function pointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { distance: number; closestPoint: { x: number; y: number } } {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    // Segment is a point
    return {
      distance: distance(px, py, x1, y1),
      closestPoint: { x: x1, y: y1 },
    }
  }

  // Project point onto line segment, clamping to [0, 1]
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))

  const closestX = x1 + t * dx
  const closestY = y1 + t * dy

  return {
    distance: distance(px, py, closestX, closestY),
    closestPoint: { x: closestX, y: closestY },
  }
}

/**
 * Find a wall near the given point (for splitting)
 * Returns the wall and the closest point on it
 */
export function findNearbyWall(
  x: number,
  y: number,
  walls: FloorplanWallV2[],
  vertices: FloorplanVertex[],
  snapDistance: number = WALL_SNAP_DISTANCE
): { wall: FloorplanWallV2; point: { x: number; y: number } } | null {
  const vertexMap = new Map(vertices.map((v) => [v.id, v]))
  let closest: { wall: FloorplanWallV2; point: { x: number; y: number } } | null = null
  let closestDist = snapDistance

  for (const wall of walls) {
    const start = vertexMap.get(wall.startVertexId)
    const end = vertexMap.get(wall.endVertexId)
    if (!start || !end) continue

    const result = pointToSegment(x, y, start.x, start.y, end.x, end.y)

    // Don't snap to endpoints (those are handled by vertex snapping)
    const distToStart = distance(result.closestPoint.x, result.closestPoint.y, start.x, start.y)
    const distToEnd = distance(result.closestPoint.x, result.closestPoint.y, end.x, end.y)
    if (distToStart < 0.3 || distToEnd < 0.3) continue

    if (result.distance < closestDist) {
      closestDist = result.distance
      closest = { wall, point: result.closestPoint }
    }
  }

  return closest
}

/**
 * Find a door near the given point
 * Returns the door, its wall, and the door's center point
 */
export function findNearbyDoor(
  x: number,
  y: number,
  walls: FloorplanWallV2[],
  vertices: FloorplanVertex[],
  snapDistance: number = 0.5
): { wall: FloorplanWallV2; door: FloorplanDoorV2; centerPoint: { x: number; y: number } } | null {
  let closestResult: { wall: FloorplanWallV2; door: FloorplanDoorV2; centerPoint: { x: number; y: number } } | null = null
  let closestDistance = Infinity

  for (const wall of walls) {
    if (!wall.doors || wall.doors.length === 0) continue

    const startV = vertices.find(v => v.id === wall.startVertexId)
    const endV = vertices.find(v => v.id === wall.endVertexId)
    if (!startV || !endV) continue

    const dx = endV.x - startV.x
    const dy = endV.y - startV.y
    const wallLength = Math.sqrt(dx * dx + dy * dy)

    for (const door of wall.doors) {
      // Calculate door center position on wall
      const doorCenterPos = door.position + door.width / 2
      const doorCenterX = startV.x + (dx / wallLength) * doorCenterPos
      const doorCenterY = startV.y + (dy / wallLength) * doorCenterPos

      // Distance from click to door center
      const dist = distance(x, y, doorCenterX, doorCenterY)

      // Check if click is within door opening range (half width on each side + snap distance)
      const clickableRadius = door.width / 2 + snapDistance
      if (dist <= clickableRadius && dist < closestDistance) {
        closestDistance = dist
        closestResult = {
          wall,
          door,
          centerPoint: { x: doorCenterX, y: doorCenterY }
        }
      }
    }
  }

  return closestResult
}

/**
 * Split a wall at a given point, creating a new vertex and two walls
 * Returns the new vertex and updates to make
 */
export function splitWallAtPoint(
  wall: FloorplanWallV2,
  point: { x: number; y: number },
  vertices: FloorplanVertex[],
  walls: FloorplanWallV2[],
  rooms: FloorplanRoomV2[]
): {
  newVertex: FloorplanVertex
  newWalls: [FloorplanWallV2, FloorplanWallV2]
  updatedRooms: FloorplanRoomV2[]
} {
  // Snap point to grid
  const snappedX = snapToGrid(point.x)
  const snappedY = snapToGrid(point.y)

  // Create new vertex at split point
  const newVertex: FloorplanVertex = {
    id: generateId('vertex'),
    x: snappedX,
    y: snappedY,
  }

  // Create two new walls from the split
  const wall1: FloorplanWallV2 = {
    id: generateId('wall'),
    startVertexId: wall.startVertexId,
    endVertexId: newVertex.id,
  }

  const wall2: FloorplanWallV2 = {
    id: generateId('wall'),
    startVertexId: newVertex.id,
    endVertexId: wall.endVertexId,
  }

  // Update any rooms that reference the original wall
  const updatedRooms = rooms.map((room) => {
    const wallIndex = room.wallIds.indexOf(wall.id)
    if (wallIndex === -1) return room

    // Replace the original wall with the two new walls (maintaining order)
    const newWallIds = [...room.wallIds]
    newWallIds.splice(wallIndex, 1, wall1.id, wall2.id)
    return { ...room, wallIds: newWallIds }
  })

  return {
    newVertex,
    newWalls: [wall1, wall2],
    updatedRooms,
  }
}

/**
 * Build an adjacency map from walls
 * Maps vertex ID -> array of { wall, otherVertexId }
 */
export function buildAdjacencyMap(
  walls: FloorplanWallV2[]
): Map<string, Array<{ wall: FloorplanWallV2; otherVertexId: string }>> {
  const adjacency = new Map<string, Array<{ wall: FloorplanWallV2; otherVertexId: string }>>()

  for (const wall of walls) {
    // Add edge from start to end
    if (!adjacency.has(wall.startVertexId)) {
      adjacency.set(wall.startVertexId, [])
    }
    adjacency.get(wall.startVertexId)!.push({ wall, otherVertexId: wall.endVertexId })

    // Add edge from end to start (walls are bidirectional)
    if (!adjacency.has(wall.endVertexId)) {
      adjacency.set(wall.endVertexId, [])
    }
    adjacency.get(wall.endVertexId)!.push({ wall, otherVertexId: wall.startVertexId })
  }

  return adjacency
}

/**
 * Detect a closed room from the walls created during drawing
 * Uses the drawing vertex path to find the walls that form the room
 */
export function detectRoomFromDrawing(
  drawingVertexIds: string[],
  closingVertexId: string,
  walls: FloorplanWallV2[]
): string[] | null {
  // Find the index where we're closing back to
  const closeIndex = drawingVertexIds.indexOf(closingVertexId)
  if (closeIndex === -1) return null

  // The room is formed by vertices from closeIndex to the end
  const roomVertexIds = drawingVertexIds.slice(closeIndex)
  if (roomVertexIds.length < 3) return null // Need at least 3 vertices for a room

  // Build a set of vertex pairs for quick lookup
  const wallMap = new Map<string, FloorplanWallV2>()
  for (const wall of walls) {
    const key1 = `${wall.startVertexId}-${wall.endVertexId}`
    const key2 = `${wall.endVertexId}-${wall.startVertexId}`
    wallMap.set(key1, wall)
    wallMap.set(key2, wall)
  }

  // Find walls connecting consecutive vertices in the loop
  const roomWallIds: string[] = []
  for (let i = 0; i < roomVertexIds.length; i++) {
    const v1 = roomVertexIds[i]
    const v2 = roomVertexIds[(i + 1) % roomVertexIds.length]
    const key = `${v1}-${v2}`
    const wall = wallMap.get(key)
    if (!wall) {
      console.warn('Missing wall between vertices', v1, v2)
      return null
    }
    roomWallIds.push(wall.id)
  }

  return roomWallIds
}

/**
 * Detect all rooms in the wall network using cycle detection
 * This finds ALL closed loops, not just the one being drawn
 *
 * Uses the "rightmost turn" algorithm:
 * 1. For each directed edge, trace the boundary by always taking the rightmost turn
 * 2. Collect all unique cycles
 * 3. Filter out the outer boundary (largest perimeter)
 */
export function detectAllRooms(
  walls: FloorplanWallV2[],
  vertices: FloorplanVertex[]
): string[][] {
  if (walls.length < 3 || vertices.length < 3) return []

  const vertexMap = new Map(vertices.map((v) => [v.id, v]))

  // Build adjacency map with edges sorted by angle (for rightmost turn)
  const adjacency = buildSortedAdjacency(walls, vertexMap)

  // Find all cycles by tracing from each directed edge
  const cycles = new Set<string>() // Store as sorted wall ID strings for deduplication

  for (const wall of walls) {
    // Try both directions
    const cycle1 = traceCycle(wall.startVertexId, wall.id, adjacency, walls, vertexMap)
    const cycle2 = traceCycle(wall.endVertexId, wall.id, adjacency, walls, vertexMap)

    if (cycle1) cycles.add(normalizeCycle(cycle1))
    if (cycle2) cycles.add(normalizeCycle(cycle2))
  }

  // Convert back to arrays and filter out outer boundary
  const allCycles = Array.from(cycles).map(s => s.split(','))

  // Filter: Keep only cycles with >= 3 walls
  const validCycles = allCycles.filter(cycle => cycle.length >= 3)

  // Remove outer boundary (cycle with largest perimeter)
  if (validCycles.length > 1) {
    const perimeters = validCycles.map(cycle => calculateCyclePerimeter(cycle, walls, vertexMap))
    const maxPerimeter = Math.max(...perimeters)
    return validCycles.filter((_, i) => perimeters[i] < maxPerimeter - 0.1) // Keep non-outer cycles
  }

  return validCycles
}

/**
 * Build adjacency map with edges sorted by angle for rightmost-turn traversal
 */
function buildSortedAdjacency(
  walls: FloorplanWallV2[],
  vertexMap: Map<string, FloorplanVertex>
): Map<string, Array<{ wallId: string; toVertexId: string; angle: number }>> {
  const adjacency = new Map<string, Array<{ wallId: string; toVertexId: string; angle: number }>>()

  for (const wall of walls) {
    const startV = vertexMap.get(wall.startVertexId)
    const endV = vertexMap.get(wall.endVertexId)
    if (!startV || !endV) continue

    // Edge from start to end
    const angle1 = Math.atan2(endV.y - startV.y, endV.x - startV.x)
    if (!adjacency.has(wall.startVertexId)) {
      adjacency.set(wall.startVertexId, [])
    }
    adjacency.get(wall.startVertexId)!.push({
      wallId: wall.id,
      toVertexId: wall.endVertexId,
      angle: angle1
    })

    // Edge from end to start (walls are bidirectional)
    const angle2 = Math.atan2(startV.y - endV.y, startV.x - endV.x)
    if (!adjacency.has(wall.endVertexId)) {
      adjacency.set(wall.endVertexId, [])
    }
    adjacency.get(wall.endVertexId)!.push({
      wallId: wall.id,
      toVertexId: wall.startVertexId,
      angle: angle2
    })
  }

  // Sort edges by angle for each vertex (counterclockwise)
  for (const edges of adjacency.values()) {
    edges.sort((a, b) => a.angle - b.angle)
  }

  return adjacency
}

/**
 * Trace a cycle starting from a vertex along a wall, always taking the rightmost turn
 */
function traceCycle(
  startVertexId: string,
  startWallId: string,
  adjacency: Map<string, Array<{ wallId: string; toVertexId: string; angle: number }>>,
  walls: FloorplanWallV2[],
  vertexMap: Map<string, FloorplanVertex>
): string[] | null {
  const wallMap = new Map(walls.map(w => [w.id, w]))
  const visitedWalls: string[] = []
  const maxSteps = 100 // Prevent infinite loops

  let currentVertexId = startVertexId
  let currentWallId = startWallId
  let steps = 0

  while (steps < maxSteps) {
    visitedWalls.push(currentWallId)

    // Move to the other end of current wall
    const currentWall = wallMap.get(currentWallId)
    if (!currentWall) return null

    const nextVertexId = currentWall.startVertexId === currentVertexId
      ? currentWall.endVertexId
      : currentWall.startVertexId

    // Check if we've completed the cycle
    if (nextVertexId === startVertexId && visitedWalls.length >= 3) {
      return visitedWalls
    }

    // Find the rightmost turn at this vertex
    // The rightmost turn is the edge with the smallest angle difference (clockwise)
    const edges = adjacency.get(nextVertexId)
    if (!edges || edges.length < 2) return null // Dead end or no choices

    // Calculate the incoming angle (angle we came from, reversed)
    const currentVertex = vertexMap.get(nextVertexId)
    const prevVertex = vertexMap.get(currentVertexId)
    if (!currentVertex || !prevVertex) return null

    const incomingAngle = Math.atan2(
      prevVertex.y - currentVertex.y,
      prevVertex.x - currentVertex.x
    )

    // Find the edge with the smallest positive angle difference (rightmost turn)
    let bestEdge: { wallId: string; toVertexId: string; angle: number } | null = null
    let minAngleDiff = Infinity

    for (const edge of edges) {
      // Skip the wall we came from
      if (edge.wallId === currentWallId) continue

      // Calculate angle difference (normalized to 0-2π)
      let angleDiff = edge.angle - incomingAngle
      while (angleDiff < 0) angleDiff += 2 * Math.PI
      while (angleDiff > 2 * Math.PI) angleDiff -= 2 * Math.PI

      if (angleDiff < minAngleDiff) {
        minAngleDiff = angleDiff
        bestEdge = edge
      }
    }

    if (!bestEdge) return null

    // Move to the next wall
    currentVertexId = nextVertexId
    currentWallId = bestEdge.wallId
    steps++
  }

  return null // Didn't complete a cycle
}

/**
 * Normalize a cycle for deduplication (smallest wall ID first, maintain order)
 */
function normalizeCycle(wallIds: string[]): string {
  if (wallIds.length === 0) return ''

  // Find the index of the smallest wall ID
  let minIndex = 0
  for (let i = 1; i < wallIds.length; i++) {
    if (wallIds[i] < wallIds[minIndex]) {
      minIndex = i
    }
  }

  // Rotate array to start with smallest ID
  const rotated = [...wallIds.slice(minIndex), ...wallIds.slice(0, minIndex)]

  // Also consider the reversed version and pick the lexicographically smaller one
  const reversed = [rotated[0], ...rotated.slice(1).reverse()]

  const rotatedStr = rotated.join(',')
  const reversedStr = reversed.join(',')

  return rotatedStr < reversedStr ? rotatedStr : reversedStr
}

/**
 * Calculate the perimeter of a cycle (sum of wall lengths)
 */
function calculateCyclePerimeter(
  wallIds: string[],
  walls: FloorplanWallV2[],
  vertexMap: Map<string, FloorplanVertex>
): number {
  const wallMap = new Map(walls.map(w => [w.id, w]))
  let perimeter = 0

  for (const wallId of wallIds) {
    const wall = wallMap.get(wallId)
    if (!wall) continue

    const startV = vertexMap.get(wall.startVertexId)
    const endV = vertexMap.get(wall.endVertexId)
    if (!startV || !endV) continue

    const length = Math.sqrt(
      (endV.x - startV.x) ** 2 + (endV.y - startV.y) ** 2
    )
    perimeter += length
  }

  return perimeter
}

/**
 * Get ordered polygon points for a room (for rendering)
 */
export function getRoomPolygon(
  room: FloorplanRoomV2,
  walls: FloorplanWallV2[],
  vertices: FloorplanVertex[]
): Array<{ x: number; y: number }> | null {
  if (room.wallIds.length < 3) return null

  const wallMap = new Map(walls.map((w) => [w.id, w]))
  const vertexMap = new Map(vertices.map((v) => [v.id, v]))

  // Start with the first wall
  const firstWall = wallMap.get(room.wallIds[0])
  if (!firstWall) return null

  const points: Array<{ x: number; y: number }> = []
  let currentVertexId = firstWall.startVertexId

  // Walk through walls to collect ordered vertices
  for (const wallId of room.wallIds) {
    const wall = wallMap.get(wallId)
    if (!wall) return null

    const vertex = vertexMap.get(currentVertexId)
    if (!vertex) return null

    points.push({ x: vertex.x, y: vertex.y })

    // Move to the other end of this wall
    currentVertexId =
      wall.startVertexId === currentVertexId ? wall.endVertexId : wall.startVertexId
  }

  return points
}

/**
 * Check if a wall already exists between two vertices
 */
export function wallExists(
  startVertexId: string,
  endVertexId: string,
  walls: FloorplanWallV2[]
): boolean {
  return walls.some(
    (w) =>
      (w.startVertexId === startVertexId && w.endVertexId === endVertexId) ||
      (w.startVertexId === endVertexId && w.endVertexId === startVertexId)
  )
}

/**
 * Get all walls connected to a vertex
 */
export function getConnectedWalls(
  vertexId: string,
  walls: FloorplanWallV2[]
): FloorplanWallV2[] {
  return walls.filter(
    (w) => w.startVertexId === vertexId || w.endVertexId === vertexId
  )
}

/**
 * Check if two line segments intersect (excluding endpoints)
 * Used to detect self-intersecting shapes
 */
export function segmentsIntersect(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number
): boolean {
  // Calculate direction vectors
  const d1x = ax2 - ax1
  const d1y = ay2 - ay1
  const d2x = bx2 - bx1
  const d2y = by2 - by1

  // Calculate cross product
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false // Parallel lines

  const t = ((bx1 - ax1) * d2y - (by1 - ay1) * d2x) / cross
  const u = ((bx1 - ax1) * d1y - (by1 - ay1) * d1x) / cross

  // Check if intersection is within both segments (excluding endpoints)
  const epsilon = 0.01
  return t > epsilon && t < 1 - epsilon && u > epsilon && u < 1 - epsilon
}

// ============================================
// V2 to 3D Conversion
// ============================================

/**
 * Calculate bounding box for a polygon room
 */
export function getRoomBounds(
  room: FloorplanRoomV2,
  walls: FloorplanWallV2[],
  vertices: FloorplanVertex[]
): { minX: number; maxX: number; minY: number; maxY: number; width: number; depth: number } | null {
  const polygon = getRoomPolygon(room, walls, vertices)
  if (!polygon || polygon.length < 3) return null

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    depth: maxY - minY,
  }
}

/**
 * Convert V2 floorplan data to 3D Room objects
 *
 * Coordinate system conversion:
 * - 2D: Origin at top-left, Y points down (canvas coordinates)
 * - 3D: Origin at center, Y points up, Z points "forward" (into screen)
 * - 2D X → 3D X (but centered)
 * - 2D Y → 3D Z (but centered and possibly inverted)
 */
export function convertV2To3D(
  vertices: FloorplanVertex[],
  walls: FloorplanWallV2[],
  rooms: FloorplanRoomV2[],
  homeId: string
): { rooms: Room[]; sharedWalls: SharedWall[] } {
  if (rooms.length === 0) {
    return { rooms: [], sharedWalls: [] }
  }

  const rooms3D: Room[] = []

  // Calculate overall bounds to center the layout
  let globalMinX = Infinity, globalMaxX = -Infinity
  let globalMinY = Infinity, globalMaxY = -Infinity

  for (const room of rooms) {
    const bounds = getRoomBounds(room, walls, vertices)
    if (bounds) {
      globalMinX = Math.min(globalMinX, bounds.minX)
      globalMaxX = Math.max(globalMaxX, bounds.maxX)
      globalMinY = Math.min(globalMinY, bounds.minY)
      globalMaxY = Math.max(globalMaxY, bounds.maxY)
    }
  }

  const centerX = (globalMinX + globalMaxX) / 2
  const centerY = (globalMinY + globalMaxY) / 2

  // Convert each room
  for (const room of rooms) {
    const bounds = getRoomBounds(room, walls, vertices)
    if (!bounds) continue

    // Get the polygon vertices for this room
    const polygon2D = getRoomPolygon(room, walls, vertices)
    if (!polygon2D || polygon2D.length < 3) continue

    // Calculate room center in 2D
    const roomCenterX = (bounds.minX + bounds.maxX) / 2
    const roomCenterY = (bounds.minY + bounds.maxY) / 2

    // Convert to 3D position (center at origin)
    // Negate to match the existing floorplan converter behavior
    const position3D: [number, number, number] = [
      -(roomCenterX - centerX),
      0,  // Ground level
      -(roomCenterY - centerY),
    ]

    // Convert polygon to room-local 3D coordinates
    // 2D (x, y) -> 3D (x, z) with room-center at origin
    const polygon3D = polygon2D.map(p => ({
      x: -(p.x - roomCenterX),  // Negate to match position3D transform
      z: -(p.y - roomCenterY),
    }))

    // Get wall height from V2 data (use first wall's height or default to 10)
    const roomWalls = room.wallIds.map(id => walls.find(w => w.id === id)).filter(Boolean) as FloorplanWallV2[]
    const wallHeight = roomWalls[0]?.height ?? 10

    // Convert doors from V2 walls to 3D room doors
    const doors3D: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position: number; width: number; height: number }> = []

    console.log(`[convertV2To3D] Converting doors for room ${room.name}:`, roomWalls.filter(w => w.doors && w.doors.length > 0).length, 'walls with doors')

    for (const wall of roomWalls) {
      if (!wall.doors || wall.doors.length === 0) continue

      console.log(`[convertV2To3D] Wall ${wall.id} has ${wall.doors.length} doors`)

      const startV = vertices.find(v => v.id === wall.startVertexId)
      const endV = vertices.find(v => v.id === wall.endVertexId)
      if (!startV || !endV) continue

      // Calculate wall vector and length
      const wallDx = endV.x - startV.x
      const wallDy = endV.y - startV.y
      const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy)

      // Determine which edge of the bounding box this wall is closest to
      const wallMidX = (startV.x + endV.x) / 2
      const wallMidY = (startV.y + endV.y) / 2

      // Calculate distances to each edge
      // NOTE: Coordinates are negated when converting to 3D (lines 707-710),
      // so we need to swap east/west and north/south to match 3D orientation
      const distToNorth = Math.abs(wallMidY - bounds.minY)  // minY → north after negation
      const distToSouth = Math.abs(wallMidY - bounds.maxY)  // maxY → south after negation
      const distToEast = Math.abs(wallMidX - bounds.minX)   // minX → east after negation
      const distToWest = Math.abs(wallMidX - bounds.maxX)   // maxX → west after negation

      const minDist = Math.min(distToNorth, distToSouth, distToEast, distToWest)
      let wallSide: 'north' | 'south' | 'east' | 'west'
      let edgeLength: number

      if (minDist === distToNorth) {
        wallSide = 'north'
        edgeLength = bounds.width
      } else if (minDist === distToSouth) {
        wallSide = 'south'
        edgeLength = bounds.width
      } else if (minDist === distToEast) {
        wallSide = 'east'
        edgeLength = bounds.depth
      } else {
        wallSide = 'west'
        edgeLength = bounds.depth
      }

      // Convert each door on this wall
      for (const door of wall.doors) {
        // Door position in V2 is feet from wall start
        // In 3D, position is -0.5 to 0.5 where 0 is center
        const doorCenterPos = door.position + door.width / 2
        const positionRatio = doorCenterPos / wallLength

        // Map to approximate position on the bounding box edge
        // This is simplified - assumes the wall roughly aligns with the edge
        const position3D = (positionRatio - 0.5) * (wallLength / edgeLength)

        const door3D = {
          wall: wallSide,
          position: Math.max(-0.5, Math.min(0.5, position3D)), // Clamp to valid range
          width: door.width,
          height: door.height,
        }
        console.log(`[convertV2To3D] Adding door to ${wallSide} wall:`, JSON.stringify(door3D))
        doors3D.push(door3D)
      }
    }

    console.log(`[convertV2To3D] Total doors converted for room ${room.name}:`, doors3D.length)

    // Calculate camera position
    const maxDimension = Math.max(bounds.width, bounds.depth)
    const cameraDistance = maxDimension * 1.5
    const cameraPosition: Vector3 = {
      x: position3D[0] + cameraDistance * 0.7,
      y: wallHeight + 8,
      z: position3D[2] + cameraDistance * 0.7,
    }

    // Create Room object with polygon data
    const room3D: Room = {
      id: room.id,
      name: room.name,
      homeId,
      dimensions: {
        width: bounds.width,
        depth: bounds.depth,
        height: wallHeight,
      },
      position: position3D,
      polygon: polygon3D,  // Include polygon vertices for arbitrary shape rendering
      doors: doors3D,
      instances: [],
      cameraPosition,
      cameraTarget: {
        x: position3D[0],
        y: wallHeight / 2,
        z: position3D[2],
      },
      lighting: {
        ambient: { intensity: Math.PI / 2 },
      },
    }

    console.log(`[convertV2To3D] Final 3D room for ${room.name}:`, {
      dimensions: room3D.dimensions,
      doors: room3D.doors,
      doorCount: room3D.doors?.length || 0
    })

    rooms3D.push(room3D)
  }

  // In the wall-first V2 architecture, walls are single entities shared between rooms
  // PolygonRooms render walls directly from polygon vertices using V2 wall data
  //
  // IMPORTANT: We do NOT create SharedWall components for V2 floorplans because:
  // 1. SharedWall calculations use bounding boxes (room.dimensions.width/depth)
  // 2. PolygonRoom calculations use actual polygon edge geometry
  // 3. When both render the same wall, door holes DON'T ALIGN due to different calculations
  // 4. This causes visible misalignment where holes appear narrower or offset
  //
  // V2 architecture handles sharing at the data level: adjacent rooms reference the same
  // wall IDs. Each wall edge is rendered once by the PolygonRoom that owns it.
  const sharedWalls: SharedWall[] = []

  // DISABLED: SharedWall detection causes double-rendering and door misalignment for V2
  // const sharedWalls: SharedWall[] = detectSharedWallsV2(rooms, walls, vertices, rooms3D, centerX, centerY)

  return { rooms: rooms3D, sharedWalls }
}

/**
 * Detect shared walls between V2 rooms
 * In V2, walls are already shared by design - we just need to identify
 * which walls are shared between which rooms for proper 3D rendering
 */
function detectSharedWallsV2(
  rooms: FloorplanRoomV2[],
  walls: FloorplanWallV2[],
  vertices: FloorplanVertex[],
  rooms3D: Room[],
  centerX: number,
  centerY: number
): SharedWall[] {
  const sharedWalls: SharedWall[] = []
  const tolerance = 0.5  // feet

  // Check each pair of rooms for adjacency
  for (let i = 0; i < rooms3D.length; i++) {
    for (let j = i + 1; j < rooms3D.length; j++) {
      const room1 = rooms3D[i]
      const room2 = rooms3D[j]

      const pos1 = room1.position || [0, 0, 0]
      const pos2 = room2.position || [0, 0, 0]
      const dim1 = room1.dimensions || { width: 10, depth: 10, height: 10 }
      const dim2 = room2.dimensions || { width: 10, depth: 10, height: 10 }

      // Calculate wall positions for each room
      const room1North = pos1[2] + dim1.depth / 2
      const room1South = pos1[2] - dim1.depth / 2
      const room1East = pos1[0] + dim1.width / 2
      const room1West = pos1[0] - dim1.width / 2

      const room2North = pos2[2] + dim2.depth / 2
      const room2South = pos2[2] - dim2.depth / 2
      const room2East = pos2[0] + dim2.width / 2
      const room2West = pos2[0] - dim2.width / 2

      // Check for horizontal shared walls (north-south adjacency)
      if (Math.abs(room1North - room2South) < tolerance) {
        const overlapMin = Math.max(room1West, room2West)
        const overlapMax = Math.min(room1East, room2East)
        if (overlapMax > overlapMin) {
          const wallCenter = (overlapMin + overlapMax) / 2
          const wallWidth = overlapMax - overlapMin

          // Collect doors from both rooms on the shared wall sides
          const sharedDoors: SharedWallDoor[] = []

          // Room1's north wall doors
          const room1NorthDoors = (room1.doors || []).filter(d => d.wall === 'north')
          for (let doorIdx = 0; doorIdx < room1NorthDoors.length; doorIdx++) {
            const door = room1NorthDoors[doorIdx]
            // Convert from room-relative to shared-wall-relative position
            // door.position is -0.5 to 0.5 relative to room width
            const doorWorldX = pos1[0] + door.position * dim1.width
            const doorRelativeX = (doorWorldX - wallCenter) / wallWidth  // -0.5 to 0.5 relative to shared wall
            sharedDoors.push({ id: `${room1.id}-north-${doorIdx}`, fromRoomId: room1.id, position: doorRelativeX, width: door.width, height: door.height })
          }

          // Room2's south wall doors
          const room2SouthDoors = (room2.doors || []).filter(d => d.wall === 'south')
          for (let doorIdx = 0; doorIdx < room2SouthDoors.length; doorIdx++) {
            const door = room2SouthDoors[doorIdx]
            const doorWorldX = pos2[0] + door.position * dim2.width
            const doorRelativeX = (doorWorldX - wallCenter) / wallWidth
            // Only add if not already present (rooms may have same door)
            if (!sharedDoors.some(d => Math.abs(d.position - doorRelativeX) < 0.01)) {
              sharedDoors.push({ id: `${room2.id}-south-${doorIdx}`, fromRoomId: room2.id, position: doorRelativeX, width: door.width, height: door.height })
            }
          }

          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [wallCenter, 0, (room1North + room2South) / 2],
            width: wallWidth,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'east-west',
            doors: sharedDoors,
          })
        }
      }

      if (Math.abs(room1South - room2North) < tolerance) {
        const overlapMin = Math.max(room1West, room2West)
        const overlapMax = Math.min(room1East, room2East)
        if (overlapMax > overlapMin) {
          const wallCenter = (overlapMin + overlapMax) / 2
          const wallWidth = overlapMax - overlapMin

          const sharedDoors: SharedWallDoor[] = []

          // Room1's south wall doors
          const room1SouthDoors = (room1.doors || []).filter(d => d.wall === 'south')
          for (let doorIdx = 0; doorIdx < room1SouthDoors.length; doorIdx++) {
            const door = room1SouthDoors[doorIdx]
            const doorWorldX = pos1[0] + door.position * dim1.width
            const doorRelativeX = (doorWorldX - wallCenter) / wallWidth
            sharedDoors.push({ id: `${room1.id}-south-${doorIdx}`, fromRoomId: room1.id, position: doorRelativeX, width: door.width, height: door.height })
          }

          // Room2's north wall doors
          const room2NorthDoors = (room2.doors || []).filter(d => d.wall === 'north')
          for (let doorIdx = 0; doorIdx < room2NorthDoors.length; doorIdx++) {
            const door = room2NorthDoors[doorIdx]
            const doorWorldX = pos2[0] + door.position * dim2.width
            const doorRelativeX = (doorWorldX - wallCenter) / wallWidth
            if (!sharedDoors.some(d => Math.abs(d.position - doorRelativeX) < 0.01)) {
              sharedDoors.push({ id: `${room2.id}-north-${doorIdx}`, fromRoomId: room2.id, position: doorRelativeX, width: door.width, height: door.height })
            }
          }

          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [wallCenter, 0, (room1South + room2North) / 2],
            width: wallWidth,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'east-west',
            doors: sharedDoors,
          })
        }
      }

      // Check for vertical shared walls (east-west adjacency)
      if (Math.abs(room1East - room2West) < tolerance) {
        const overlapMin = Math.max(room1South, room2South)
        const overlapMax = Math.min(room1North, room2North)
        if (overlapMax > overlapMin) {
          const wallCenter = (overlapMin + overlapMax) / 2
          const wallWidth = overlapMax - overlapMin

          const sharedDoors: SharedWallDoor[] = []

          // Room1's east wall doors
          const room1EastDoors = (room1.doors || []).filter(d => d.wall === 'east')
          for (let doorIdx = 0; doorIdx < room1EastDoors.length; doorIdx++) {
            const door = room1EastDoors[doorIdx]
            // For north-south walls, position relates to depth (Z axis)
            const doorWorldZ = pos1[2] + door.position * dim1.depth
            const doorRelativeZ = (doorWorldZ - wallCenter) / wallWidth
            sharedDoors.push({ id: `${room1.id}-east-${doorIdx}`, fromRoomId: room1.id, position: doorRelativeZ, width: door.width, height: door.height })
          }

          // Room2's west wall doors
          const room2WestDoors = (room2.doors || []).filter(d => d.wall === 'west')
          for (let doorIdx = 0; doorIdx < room2WestDoors.length; doorIdx++) {
            const door = room2WestDoors[doorIdx]
            const doorWorldZ = pos2[2] + door.position * dim2.depth
            const doorRelativeZ = (doorWorldZ - wallCenter) / wallWidth
            if (!sharedDoors.some(d => Math.abs(d.position - doorRelativeZ) < 0.01)) {
              sharedDoors.push({ id: `${room2.id}-west-${doorIdx}`, fromRoomId: room2.id, position: doorRelativeZ, width: door.width, height: door.height })
            }
          }

          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [(room1East + room2West) / 2, 0, wallCenter],
            width: wallWidth,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'north-south',
            doors: sharedDoors,
          })
        }
      }

      if (Math.abs(room1West - room2East) < tolerance) {
        const overlapMin = Math.max(room1South, room2South)
        const overlapMax = Math.min(room1North, room2North)
        if (overlapMax > overlapMin) {
          const wallCenter = (overlapMin + overlapMax) / 2
          const wallWidth = overlapMax - overlapMin

          const sharedDoors: SharedWallDoor[] = []

          // Room1's west wall doors
          const room1WestDoors = (room1.doors || []).filter(d => d.wall === 'west')
          for (let doorIdx = 0; doorIdx < room1WestDoors.length; doorIdx++) {
            const door = room1WestDoors[doorIdx]
            const doorWorldZ = pos1[2] + door.position * dim1.depth
            const doorRelativeZ = (doorWorldZ - wallCenter) / wallWidth
            sharedDoors.push({ id: `${room1.id}-west-${doorIdx}`, fromRoomId: room1.id, position: doorRelativeZ, width: door.width, height: door.height })
          }

          // Room2's east wall doors
          const room2EastDoors = (room2.doors || []).filter(d => d.wall === 'east')
          for (let doorIdx = 0; doorIdx < room2EastDoors.length; doorIdx++) {
            const door = room2EastDoors[doorIdx]
            const doorWorldZ = pos2[2] + door.position * dim2.depth
            const doorRelativeZ = (doorWorldZ - wallCenter) / wallWidth
            if (!sharedDoors.some(d => Math.abs(d.position - doorRelativeZ) < 0.01)) {
              sharedDoors.push({ id: `${room2.id}-east-${doorIdx}`, fromRoomId: room2.id, position: doorRelativeZ, width: door.width, height: door.height })
            }
          }

          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [(room1West + room2East) / 2, 0, wallCenter],
            width: wallWidth,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'north-south',
            doors: sharedDoors,
          })
        }
      }
    }
  }

  return sharedWalls
}
