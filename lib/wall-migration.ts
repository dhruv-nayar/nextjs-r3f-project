/**
 * Wall Migration: V2 → V3
 *
 * Converts FloorplanDataV2 (wall-first) to FloorplanDataV3 (two-sided segments)
 *
 * Migration process:
 * 1. Convert FloorplanWallV2 → WallSegment (with default styles)
 * 2. Convert FloorplanRoomV2 → FloorplanRoomV3 (with side assignments)
 * 3. Run partitioning to split segments at intersections
 * 4. Assign room references to segment sides
 * 5. Mark exterior segments
 */

import type {
  FloorplanDataV2,
  FloorplanDataV3,
  FloorplanRoomV2,
  FloorplanRoomV3,
  FloorplanVertex,
  FloorplanWallV2,
} from '@/types/floorplan-v2'
import type {
  WallSegment,
  WallSegmentDoor,
  WallSideStyle,
} from '@/types/wall-segment'
import {
  DEFAULT_INTERIOR_STYLE,
  DEFAULT_EXTERIOR_STYLE,
  generateWallSegmentId,
  generateStyleId,
} from '@/types/wall-segment'
import { assignRoomSides, markExteriorSegments } from './wall-segment-utils'
import { partitionWalls } from './wall-partitioning'

/**
 * Deduplicate segments that are at the same position
 * Checks both by vertex IDs and by actual coordinates
 * Returns the deduplicated segments and a mapping of old IDs to new IDs
 */
function deduplicateSegments(
  segments: WallSegment[],
  vertices: FloorplanVertex[]
): {
  segments: WallSegment[]
  idMapping: Map<string, string>
} {
  const idMapping = new Map<string, string>()
  const vertexMap = new Map(vertices.map(v => [v.id, v]))

  // Track segments by their position (rounded coordinates)
  const segmentsByPosition = new Map<string, WallSegment>()
  const TOLERANCE = 0.5 // feet

  for (const segment of segments) {
    const start = vertexMap.get(segment.startVertexId)
    const end = vertexMap.get(segment.endVertexId)

    if (!start || !end) {
      // Keep segments with missing vertices
      idMapping.set(segment.id, segment.id)
      continue
    }

    // Create a position-based key (rounded and sorted)
    // This catches walls with different vertex IDs but same position
    const coords = [
      { x: Math.round(start.x / TOLERANCE) * TOLERANCE, y: Math.round(start.y / TOLERANCE) * TOLERANCE },
      { x: Math.round(end.x / TOLERANCE) * TOLERANCE, y: Math.round(end.y / TOLERANCE) * TOLERANCE },
    ].sort((a, b) => a.x - b.x || a.y - b.y)

    const posKey = `${coords[0].x},${coords[0].y}-${coords[1].x},${coords[1].y}`

    if (segmentsByPosition.has(posKey)) {
      // Duplicate found - map this ID to the existing segment's ID
      const existing = segmentsByPosition.get(posKey)!
      idMapping.set(segment.id, existing.id)
      console.log(`[Migration] Dedup by position: ${segment.id} → ${existing.id} (at ${posKey})`)
    } else {
      // First occurrence - keep it
      segmentsByPosition.set(posKey, segment)
      idMapping.set(segment.id, segment.id)
    }
  }

  return {
    segments: Array.from(segmentsByPosition.values()),
    idMapping,
  }
}

/**
 * Convert a V2 wall to a V3 wall segment
 */
function convertWallToSegment(wall: FloorplanWallV2): WallSegment {
  // Convert doors
  const doors: WallSegmentDoor[] = (wall.doors ?? []).map(door => ({
    id: door.id,
    position: door.position,
    width: door.width,
    height: door.height,
  }))

  return {
    id: wall.id, // Preserve original ID for reference
    startVertexId: wall.startVertexId,
    endVertexId: wall.endVertexId,
    height: wall.height ?? 10,
    sideA: {
      roomId: null, // Will be assigned later
      style: {
        ...DEFAULT_INTERIOR_STYLE,
        id: generateStyleId(),
      },
    },
    sideB: {
      roomId: null, // Will be assigned later
      style: {
        ...DEFAULT_INTERIOR_STYLE,
        id: generateStyleId(),
      },
    },
    doors,
  }
}

/**
 * Convert a V2 room to a V3 room with placeholder side assignments
 */
function convertRoomToV3(room: FloorplanRoomV2): FloorplanRoomV3 {
  return {
    id: room.id,
    name: room.name,
    color: room.color,
    boundarySegmentIds: room.wallIds, // Same IDs initially
    segmentSides: {}, // Will be computed later
  }
}

/**
 * Migrate FloorplanDataV2 to FloorplanDataV3
 *
 * Full migration with:
 * - Wall → Segment conversion
 * - Room side assignment
 * - Partitioning at intersections
 * - Exterior marking
 */
export function migrateV2ToV3(v2Data: FloorplanDataV2): FloorplanDataV3 {
  console.log('[Migration] Starting V2 → V3 migration')
  console.log(`[Migration] Input: ${v2Data.walls.length} walls, ${v2Data.rooms.length} rooms`)

  // Log wall details to detect duplicates
  const vertexMap = new Map(v2Data.vertices.map(v => [v.id, v]))
  console.log('[Migration] Wall details:', v2Data.walls.map(w => {
    const start = vertexMap.get(w.startVertexId)
    const end = vertexMap.get(w.endVertexId)
    return {
      id: w.id,
      start: start ? `(${Math.round(start.x)}, ${Math.round(start.y)})` : 'missing',
      end: end ? `(${Math.round(end.x)}, ${Math.round(end.y)})` : 'missing',
    }
  }))

  // Check for duplicate walls (same start/end vertices)
  const wallsByVertices = new Map<string, string[]>()
  for (const wall of v2Data.walls) {
    // Create a normalized key (sorted vertex IDs)
    const key = [wall.startVertexId, wall.endVertexId].sort().join('-')
    if (!wallsByVertices.has(key)) {
      wallsByVertices.set(key, [])
    }
    wallsByVertices.get(key)!.push(wall.id)
  }
  const duplicates = Array.from(wallsByVertices.entries()).filter(([_, ids]) => ids.length > 1)
  if (duplicates.length > 0) {
    console.warn('[Migration] Found duplicate walls:', duplicates)
  }

  // Step 1: Convert walls to segments
  let initialSegments = v2Data.walls.map(convertWallToSegment)
  console.log(`[Migration] Converted ${initialSegments.length} walls to segments`)

  // Step 1.5: Deduplicate segments at same position
  // This handles cases where V2 data has two walls at the same location
  const { segments: deduplicatedSegments, idMapping } = deduplicateSegments(initialSegments, v2Data.vertices)
  if (deduplicatedSegments.length < initialSegments.length) {
    console.log(`[Migration] Deduplicated: ${initialSegments.length} → ${deduplicatedSegments.length} segments`)
    initialSegments = deduplicatedSegments
  }

  // Step 2: Convert rooms to V3 format (placeholder sides)
  // Apply ID mapping if walls were deduplicated
  let rooms: FloorplanRoomV3[] = v2Data.rooms.map(room => {
    const v3Room = convertRoomToV3(room)
    // Remap wall IDs if there were duplicates
    v3Room.boundarySegmentIds = v3Room.boundarySegmentIds.map(id => idMapping.get(id) || id)
    return v3Room
  })
  console.log(`[Migration] Converted ${rooms.length} rooms`)

  // Step 3: Compute side assignments for each room
  for (const room of rooms) {
    room.segmentSides = assignRoomSides(room, initialSegments, v2Data.vertices)
  }
  console.log(`[Migration] Computed side assignments for all rooms`)

  // Step 4: Run partitioning to split segments at intersections
  let partitioned = partitionWalls(v2Data.vertices, initialSegments, rooms)
  console.log(`[Migration] After partitioning: ${partitioned.segments.length} segments, ${partitioned.vertices.length} vertices`)

  // Step 4.5: Deduplicate AGAIN after partitioning
  // Partitioning may create segments that overlap with existing ones
  const postPartitionDedup = deduplicateSegments(partitioned.segments, partitioned.vertices)
  if (postPartitionDedup.segments.length < partitioned.segments.length) {
    console.log(`[Migration] Post-partition dedup: ${partitioned.segments.length} → ${postPartitionDedup.segments.length} segments`)

    // Update room references with new ID mapping
    const updatedRooms = partitioned.rooms.map(room => ({
      ...room,
      boundarySegmentIds: room.boundarySegmentIds.map(id => postPartitionDedup.idMapping.get(id) || id),
    }))

    partitioned = {
      ...partitioned,
      segments: postPartitionDedup.segments,
      rooms: updatedRooms,
    }
  }

  // Step 5: Mark exterior segments and assign room references
  const segmentsWithExterior = markExteriorSegments(partitioned.segments, partitioned.rooms)

  // Step 6: Apply exterior styling to exterior-facing sides
  const finalSegments = segmentsWithExterior.map(segment => {
    const updatedSegment = { ...segment }

    if (segment.sideA.roomId === null) {
      updatedSegment.sideA = {
        ...segment.sideA,
        style: {
          ...DEFAULT_EXTERIOR_STYLE,
          id: segment.sideA.style.id,
        },
      }
    }

    if (segment.sideB.roomId === null) {
      updatedSegment.sideB = {
        ...segment.sideB,
        style: {
          ...DEFAULT_EXTERIOR_STYLE,
          id: segment.sideB.style.id,
        },
      }
    }

    return updatedSegment
  })

  console.log(`[Migration] Migration complete`)

  return {
    version: 3,
    vertices: partitioned.vertices,
    wallSegments: finalSegments,
    rooms: partitioned.rooms,
    canvasWidth: v2Data.canvasWidth,
    canvasHeight: v2Data.canvasHeight,
    pixelsPerFoot: v2Data.pixelsPerFoot,
    createdAt: v2Data.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Check if data is V3 format
 */
export function isV3Data(data: FloorplanDataV2 | FloorplanDataV3): data is FloorplanDataV3 {
  return 'version' in data && data.version === 3 && 'wallSegments' in data
}

/**
 * Load floorplan data, auto-migrating if necessary
 */
export function loadFloorplanData(
  v2Data: FloorplanDataV2 | null,
  v3Data: FloorplanDataV3 | null
): FloorplanDataV3 | null {
  // Prefer V3 if available
  if (v3Data) {
    console.log('[Migration] Using existing V3 data')
    return v3Data
  }

  // Migrate V2 if available
  if (v2Data) {
    console.log('[Migration] Migrating V2 data to V3')
    return migrateV2ToV3(v2Data)
  }

  return null
}

/**
 * Create V3 data from scratch (empty floorplan)
 */
export function createEmptyV3Data(): FloorplanDataV3 {
  return {
    version: 3,
    vertices: [],
    wallSegments: [],
    rooms: [],
    canvasWidth: 900,
    canvasHeight: 600,
    pixelsPerFoot: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Update wall segment style
 * Returns a new array with the updated segment
 */
export function updateSegmentStyle(
  segments: WallSegment[],
  segmentId: string,
  side: 'A' | 'B',
  updates: Partial<WallSideStyle>
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
          ...updates,
        },
      },
    }
  })
}

/**
 * Get room name for a wall side (for UI display)
 */
export function getRoomNameForSide(
  segment: WallSegment,
  side: 'A' | 'B',
  rooms: FloorplanRoomV3[]
): string {
  const roomId = side === 'A' ? segment.sideA.roomId : segment.sideB.roomId

  if (roomId === null) {
    return 'Exterior'
  }

  const room = rooms.find(r => r.id === roomId)
  return room?.name ?? 'Unknown Room'
}
