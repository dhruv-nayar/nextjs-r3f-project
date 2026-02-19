/**
 * Wall Partitioning
 *
 * Algorithms for splitting wall segments at intersection points
 * so that different portions can be styled independently.
 *
 * Use cases:
 * - Wall shared by two rooms (T-junction)
 * - Wall extending beyond a room (interior vs exterior portions)
 * - Multiple rooms meeting at a vertex
 */

import type { FloorplanVertex, FloorplanRoomV3 } from '@/types/floorplan-v2'
import { generateId } from '@/types/floorplan-v2'
import type { WallSegment, WallSegmentDoor } from '@/types/wall-segment'
import { generateWallSegmentId, generateStyleId } from '@/types/wall-segment'
import {
  distance,
  pointToSegmentDistance,
  projectPointOntoSegment,
} from './wall-segment-utils'

/**
 * A point where a segment should be split
 */
export interface SplitPoint {
  segmentId: string
  position: number        // Distance along segment from start (feet)
  vertexId?: string       // Existing vertex at this point (if any)
  reason: 'vertex' | 'intersection' | 'room-boundary'
}

/**
 * Result of partitioning operation
 */
export interface PartitionResult {
  vertices: FloorplanVertex[]
  segments: WallSegment[]
  rooms: FloorplanRoomV3[]
}

/**
 * Find all points where segments should be split
 *
 * Detects:
 * 1. Vertices that lie ON a segment (not at endpoints)
 * 2. Segment-segment intersections
 */
export function findSplitPoints(
  vertices: FloorplanVertex[],
  segments: WallSegment[]
): SplitPoint[] {
  const splitPoints: SplitPoint[] = []
  const vertexMap = new Map(vertices.map(v => [v.id, v]))

  const TOLERANCE = 0.1 // feet

  for (const segment of segments) {
    const start = vertexMap.get(segment.startVertexId)
    const end = vertexMap.get(segment.endVertexId)

    if (!start || !end) continue

    const segmentLength = distance(start.x, start.y, end.x, end.y)

    if (segmentLength < TOLERANCE) continue

    // 1. Check if any other vertex lies ON this segment (not at endpoints)
    for (const vertex of vertices) {
      if (vertex.id === segment.startVertexId || vertex.id === segment.endVertexId) {
        continue
      }

      const distToSegment = pointToSegmentDistance(
        vertex.x,
        vertex.y,
        start.x,
        start.y,
        end.x,
        end.y
      )

      if (distToSegment < TOLERANCE) {
        // Vertex is on the segment line
        const t = projectPointOntoSegment(
          vertex.x,
          vertex.y,
          start.x,
          start.y,
          end.x,
          end.y
        )
        const posAlongSegment = t * segmentLength

        // Only split if not too close to endpoints
        if (posAlongSegment > TOLERANCE && posAlongSegment < segmentLength - TOLERANCE) {
          splitPoints.push({
            segmentId: segment.id,
            position: posAlongSegment,
            vertexId: vertex.id,
            reason: 'vertex',
          })
        }
      }
    }

    // 2. Check for segment-segment intersections
    for (const otherSegment of segments) {
      if (otherSegment.id === segment.id) continue

      const otherStart = vertexMap.get(otherSegment.startVertexId)
      const otherEnd = vertexMap.get(otherSegment.endVertexId)

      if (!otherStart || !otherEnd) continue

      const intersection = segmentIntersection(
        start.x,
        start.y,
        end.x,
        end.y,
        otherStart.x,
        otherStart.y,
        otherEnd.x,
        otherEnd.y
      )

      if (intersection && intersection.t > 0.01 && intersection.t < 0.99) {
        // There's an intersection in the middle of the segment
        const posAlongSegment = intersection.t * segmentLength

        // Check if there's already a vertex at this point
        const existingVertexId = findVertexAtPoint(
          vertices,
          intersection.x,
          intersection.y,
          TOLERANCE
        )

        splitPoints.push({
          segmentId: segment.id,
          position: posAlongSegment,
          vertexId: existingVertexId || undefined,
          reason: 'intersection',
        })
      }
    }
  }

  return splitPoints
}

/**
 * Calculate segment-segment intersection
 * Returns parameter t for first segment (0 = start, 1 = end) and intersection point
 */
export function segmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): { t: number; u: number; x: number; y: number } | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)

  if (Math.abs(denom) < 0.0001) {
    // Parallel or coincident
    return null
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

  // Check if intersection is within both segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      t,
      u,
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    }
  }

  return null
}

/**
 * Find vertex at a specific point (within tolerance)
 */
function findVertexAtPoint(
  vertices: FloorplanVertex[],
  x: number,
  y: number,
  tolerance: number
): string | null {
  for (const vertex of vertices) {
    if (distance(vertex.x, vertex.y, x, y) < tolerance) {
      return vertex.id
    }
  }
  return null
}

/**
 * Split a segment at a given point
 */
export function splitSegmentAtPoint(
  segment: WallSegment,
  position: number,
  vertices: FloorplanVertex[],
  existingVertexId?: string
): {
  newVertex: FloorplanVertex | null
  segment1: WallSegment
  segment2: WallSegment
} {
  const vertexMap = new Map(vertices.map(v => [v.id, v]))
  const start = vertexMap.get(segment.startVertexId)!
  const end = vertexMap.get(segment.endVertexId)!
  const segmentLength = distance(start.x, start.y, end.x, end.y)

  // Calculate split point coordinates
  const t = position / segmentLength
  const splitX = start.x + t * (end.x - start.x)
  const splitY = start.y + t * (end.y - start.y)

  // Use existing vertex or create new one
  const splitVertexId = existingVertexId || generateId('vertex')
  const newVertex: FloorplanVertex | null = existingVertexId
    ? null
    : {
        id: splitVertexId,
        x: Math.round(splitX * 2) / 2, // Snap to 0.5ft grid
        y: Math.round(splitY * 2) / 2,
      }

  // Partition doors between the two new segments
  const doors1: WallSegmentDoor[] = []
  const doors2: WallSegmentDoor[] = []

  for (const door of segment.doors) {
    const doorEnd = door.position + door.width

    if (doorEnd <= position) {
      // Door entirely in first segment
      doors1.push({ ...door, id: door.id })
    } else if (door.position >= position) {
      // Door entirely in second segment - adjust position
      doors2.push({
        ...door,
        id: door.id,
        position: door.position - position,
      })
    } else {
      // Door spans the split point
      // Keep door in segment where most of it lies
      const doorMid = door.position + door.width / 2
      if (doorMid < position) {
        doors1.push({ ...door, id: door.id })
      } else {
        doors2.push({
          ...door,
          id: door.id,
          position: Math.max(0, door.position - position),
        })
      }
    }
  }

  // Create two new segments
  const segment1: WallSegment = {
    id: generateWallSegmentId(),
    startVertexId: segment.startVertexId,
    endVertexId: splitVertexId,
    height: segment.height,
    baseHeight: segment.baseHeight,
    sideA: {
      roomId: segment.sideA.roomId,
      style: { ...segment.sideA.style, id: generateStyleId() },
    },
    sideB: {
      roomId: segment.sideB.roomId,
      style: { ...segment.sideB.style, id: generateStyleId() },
    },
    doors: doors1,
    isExterior: segment.isExterior,
    parentWallId: segment.id,
  }

  const segment2: WallSegment = {
    id: generateWallSegmentId(),
    startVertexId: splitVertexId,
    endVertexId: segment.endVertexId,
    height: segment.height,
    baseHeight: segment.baseHeight,
    sideA: {
      roomId: segment.sideA.roomId,
      style: { ...segment.sideA.style, id: generateStyleId() },
    },
    sideB: {
      roomId: segment.sideB.roomId,
      style: { ...segment.sideB.style, id: generateStyleId() },
    },
    doors: doors2,
    isExterior: segment.isExterior,
    parentWallId: segment.id,
  }

  return { newVertex, segment1, segment2 }
}

/**
 * Update room references after a segment split
 */
export function updateRoomReferences(
  rooms: FloorplanRoomV3[],
  oldSegmentId: string,
  newSegment1Id: string,
  newSegment2Id: string
): FloorplanRoomV3[] {
  return rooms.map(room => {
    const segmentIndex = room.boundarySegmentIds.indexOf(oldSegmentId)
    if (segmentIndex === -1) return room

    // Replace old segment with the two new ones
    const newBoundaryIds = [...room.boundarySegmentIds]
    newBoundaryIds.splice(segmentIndex, 1, newSegment1Id, newSegment2Id)

    // Copy the side reference to both new segments
    const oldSide = room.segmentSides[oldSegmentId]
    const newSegmentSides = { ...room.segmentSides }
    delete newSegmentSides[oldSegmentId]
    newSegmentSides[newSegment1Id] = oldSide
    newSegmentSides[newSegment2Id] = oldSide

    return {
      ...room,
      boundarySegmentIds: newBoundaryIds,
      segmentSides: newSegmentSides,
    }
  })
}

/**
 * Full partitioning pass
 *
 * 1. Find all split points
 * 2. Group by segment and sort by position
 * 3. Split segments at all points
 * 4. Update room references
 */
export function partitionWalls(
  vertices: FloorplanVertex[],
  segments: WallSegment[],
  rooms: FloorplanRoomV3[]
): PartitionResult {
  // Find all split points
  const splitPoints = findSplitPoints(vertices, segments)

  if (splitPoints.length === 0) {
    // No splitting needed
    return { vertices, segments, rooms }
  }

  // Group split points by segment
  const splitsBySegment = new Map<string, SplitPoint[]>()
  for (const sp of splitPoints) {
    if (!splitsBySegment.has(sp.segmentId)) {
      splitsBySegment.set(sp.segmentId, [])
    }
    splitsBySegment.get(sp.segmentId)!.push(sp)
  }

  // Sort each group by position (ascending)
  for (const points of splitsBySegment.values()) {
    points.sort((a, b) => a.position - b.position)
  }

  // Process each segment
  let currentVertices = [...vertices]
  let currentSegments = [...segments]
  let currentRooms = [...rooms]

  for (const [segmentId, points] of splitsBySegment) {
    // Find the segment to split
    let segmentToSplit = currentSegments.find(s => s.id === segmentId)
    if (!segmentToSplit) continue

    // Split at each point (process in reverse order to maintain positions)
    const sortedPoints = [...points].sort((a, b) => b.position - a.position)

    for (const point of sortedPoints) {
      const segment = currentSegments.find(s => s.id === segmentToSplit!.id)
      if (!segment) continue

      const result = splitSegmentAtPoint(
        segment,
        point.position,
        currentVertices,
        point.vertexId
      )

      // Add new vertex if created
      if (result.newVertex) {
        currentVertices = [...currentVertices, result.newVertex]
      }

      // Replace old segment with two new ones
      currentSegments = currentSegments.filter(s => s.id !== segment.id)
      currentSegments.push(result.segment1, result.segment2)

      // Update room references
      currentRooms = updateRoomReferences(
        currentRooms,
        segment.id,
        result.segment1.id,
        result.segment2.id
      )

      // Update reference for next iteration
      segmentToSplit = result.segment2
    }
  }

  return {
    vertices: currentVertices,
    segments: currentSegments,
    rooms: currentRooms,
  }
}

/**
 * Deduplicate split points that are very close together
 */
export function deduplicateSplitPoints(
  points: SplitPoint[],
  tolerance: number = 0.1
): SplitPoint[] {
  if (points.length <= 1) return points

  const sorted = [...points].sort((a, b) => a.position - b.position)
  const result: SplitPoint[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1]
    const current = sorted[i]

    if (current.position - prev.position > tolerance) {
      result.push(current)
    } else {
      // Merge: prefer vertex-based split points
      if (current.vertexId && !prev.vertexId) {
        result[result.length - 1] = current
      }
    }
  }

  return result
}
