/**
 * Geometry utilities for wall-first floorplan editor
 */

import {
  FloorplanVertex,
  FloorplanWallV2,
  FloorplanRoomV2,
  SNAP_DISTANCE,
  WALL_SNAP_DISTANCE,
  generateId,
  snapToGrid,
} from '@/types/floorplan-v2'
import { Room, SharedWall, Vector3 } from '@/types/room'

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
    const roomWalls = room.wallIds.map(id => walls.find(w => w.id === id)).filter(Boolean)
    const wallHeight = roomWalls[0]?.height ?? 10

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
      doors: [],  // V2 doesn't have doors yet
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

    rooms3D.push(room3D)
  }

  // In the wall-first architecture, walls are already shared
  // We don't need to create separate SharedWall objects for V2
  // The Room component will render walls based on dimensions
  // Shared walls are implicitly handled by the single-wall data model

  // For now, detect which walls should be excluded to prevent double-rendering
  // This is similar to the existing SharedWall detection but simplified
  const sharedWalls: SharedWall[] = detectSharedWallsV2(rooms, walls, vertices, rooms3D, centerX, centerY)

  // Mark rooms to exclude shared walls
  for (const sharedWall of sharedWalls) {
    const room1 = rooms3D.find(r => r.id === sharedWall.room1Id)
    const room2 = rooms3D.find(r => r.id === sharedWall.room2Id)

    if (room1) {
      room1.excludedWalls = room1.excludedWalls || {}
      // Determine which wall to exclude based on orientation and position
      if (sharedWall.orientation === 'east-west') {
        // Horizontal wall - could be north or south
        const room1Pos = room1.position || [0, 0, 0]
        if (sharedWall.position[2] > room1Pos[2]) {
          room1.excludedWalls.north = true
        } else {
          room1.excludedWalls.south = true
        }
      } else {
        // Vertical wall - could be east or west
        const room1Pos = room1.position || [0, 0, 0]
        if (sharedWall.position[0] > room1Pos[0]) {
          room1.excludedWalls.east = true
        } else {
          room1.excludedWalls.west = true
        }
      }
    }

    if (room2) {
      room2.excludedWalls = room2.excludedWalls || {}
      if (sharedWall.orientation === 'east-west') {
        const room2Pos = room2.position || [0, 0, 0]
        if (sharedWall.position[2] > room2Pos[2]) {
          room2.excludedWalls.north = true
        } else {
          room2.excludedWalls.south = true
        }
      } else {
        const room2Pos = room2.position || [0, 0, 0]
        if (sharedWall.position[0] > room2Pos[0]) {
          room2.excludedWalls.east = true
        } else {
          room2.excludedWalls.west = true
        }
      }
    }
  }

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
          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [(overlapMin + overlapMax) / 2, 0, (room1North + room2South) / 2],
            width: overlapMax - overlapMin,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'east-west',
            doors: [],
          })
        }
      }

      if (Math.abs(room1South - room2North) < tolerance) {
        const overlapMin = Math.max(room1West, room2West)
        const overlapMax = Math.min(room1East, room2East)
        if (overlapMax > overlapMin) {
          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [(overlapMin + overlapMax) / 2, 0, (room1South + room2North) / 2],
            width: overlapMax - overlapMin,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'east-west',
            doors: [],
          })
        }
      }

      // Check for vertical shared walls (east-west adjacency)
      if (Math.abs(room1East - room2West) < tolerance) {
        const overlapMin = Math.max(room1South, room2South)
        const overlapMax = Math.min(room1North, room2North)
        if (overlapMax > overlapMin) {
          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [(room1East + room2West) / 2, 0, (overlapMin + overlapMax) / 2],
            width: overlapMax - overlapMin,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'north-south',
            doors: [],
          })
        }
      }

      if (Math.abs(room1West - room2East) < tolerance) {
        const overlapMin = Math.max(room1South, room2South)
        const overlapMax = Math.min(room1North, room2North)
        if (overlapMax > overlapMin) {
          sharedWalls.push({
            id: `shared-${room1.id}-${room2.id}`,
            room1Id: room1.id,
            room2Id: room2.id,
            position: [(room1West + room2East) / 2, 0, (overlapMin + overlapMax) / 2],
            width: overlapMax - overlapMin,
            height: Math.max(dim1.height, dim2.height),
            orientation: 'north-south',
            doors: [],
          })
        }
      }
    }
  }

  return sharedWalls
}
