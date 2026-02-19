/**
 * Utility functions for deep copying Home objects with ID regeneration
 *
 * Supports two copy modes:
 * - 'floorplan-only': Copy structure without furniture (instances)
 * - 'with-furniture': Copy everything including placed items
 */

import { Home, Room, ItemInstance, SharedWall, SharedWallDoor } from '@/types/room'
import { FloorplanData, FloorplanRoom } from '@/types/floorplan'
import {
  FloorplanDataV2,
  FloorplanVertex,
  FloorplanWallV2,
  FloorplanRoomV2,
  FloorplanDoorV2,
  FloorplanDataV3,
  FloorplanRoomV3,
} from '@/types/floorplan-v2'
import { WallSegment, WallSideStyle } from '@/types/wall-segment'

export type CopyMode = 'floorplan-only' | 'with-furniture'

/**
 * ID mapping for maintaining internal references during copy
 */
interface IdMap {
  rooms: Record<string, string>
  instances: Record<string, string>
  vertices: Record<string, string>
  walls: Record<string, string>
  doors: Record<string, string>
  wallSegments: Record<string, string>
  floorplanRooms: Record<string, string>
}

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Deep clone an object (simple JSON-based clone)
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Copy instances array with new IDs
 */
function copyInstances(
  instances: ItemInstance[] | undefined,
  newRoomId: string,
  idMap: IdMap
): ItemInstance[] {
  if (!instances || instances.length === 0) return []

  return instances.map((instance) => {
    const newId = generateId('instance')
    idMap.instances[instance.id] = newId

    return {
      ...deepClone(instance),
      id: newId,
      roomId: newRoomId,
      // parentSurfaceId stays the same if 'floor', otherwise needs remapping
      // We'll do a second pass to fix parent references
      placedAt: new Date().toISOString(),
    }
  })
}

/**
 * Fix parent surface references in instances after all instances are copied
 */
function fixInstanceParentReferences(instances: ItemInstance[], idMap: IdMap): void {
  for (const instance of instances) {
    if (instance.parentSurfaceId && instance.parentSurfaceId !== 'floor') {
      // Update to new instance ID if it was mapped
      const newParentId = idMap.instances[instance.parentSurfaceId]
      if (newParentId) {
        instance.parentSurfaceId = newParentId
      }
    }
  }
}

/**
 * Copy a room with new IDs
 */
function copyRoom(
  room: Room,
  newHomeId: string,
  idMap: IdMap,
  includeInstances: boolean
): Room {
  const newRoomId = generateId('room')
  idMap.rooms[room.id] = newRoomId

  const copiedRoom: Room = {
    ...deepClone(room),
    id: newRoomId,
    homeId: newHomeId,
    instances: includeInstances ? copyInstances(room.instances, newRoomId, idMap) : [],
    furniture: [], // Always clear deprecated field
    // floorplanRoomId will be updated after floorplan copy
  }

  return copiedRoom
}

/**
 * Copy FloorplanData (V1 - rectangle-based)
 */
function copyFloorplanDataV1(
  data: FloorplanData,
  newHomeId: string,
  idMap: IdMap
): FloorplanData {
  const now = new Date().toISOString()

  const copiedRooms: FloorplanRoom[] = data.rooms.map((room) => {
    const newRoomId = generateId('fp-room')
    idMap.floorplanRooms[room.id] = newRoomId

    return {
      ...deepClone(room),
      id: newRoomId,
      doors: room.doors.map((door) => ({
        ...door,
        id: generateId('door'),
      })),
    }
  })

  return {
    ...deepClone(data),
    id: generateId('floorplan'),
    homeId: newHomeId,
    rooms: copiedRooms,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Copy FloorplanDataV2 (wall-first polygon)
 */
function copyFloorplanDataV2(
  data: FloorplanDataV2,
  idMap: IdMap
): FloorplanDataV2 {
  const now = new Date().toISOString()

  // Copy vertices with new IDs
  const newVertices: FloorplanVertex[] = data.vertices.map((v) => {
    const newId = generateId('v')
    idMap.vertices[v.id] = newId
    return { ...v, id: newId }
  })

  // Copy walls with updated vertex references
  const newWalls: FloorplanWallV2[] = data.walls.map((wall) => {
    const newId = generateId('wall')
    idMap.walls[wall.id] = newId

    const copiedDoors: FloorplanDoorV2[] = (wall.doors || []).map((door) => {
      const newDoorId = generateId('door')
      idMap.doors[door.id] = newDoorId
      return { ...door, id: newDoorId }
    })

    return {
      ...wall,
      id: newId,
      startVertexId: idMap.vertices[wall.startVertexId],
      endVertexId: idMap.vertices[wall.endVertexId],
      doors: copiedDoors,
    }
  })

  // Copy rooms with updated wall references
  const newRooms: FloorplanRoomV2[] = data.rooms.map((room) => {
    const newRoomId = generateId('fp-room')
    idMap.floorplanRooms[room.id] = newRoomId

    return {
      ...room,
      id: newRoomId,
      wallIds: room.wallIds.map((id) => idMap.walls[id]),
    }
  })

  return {
    ...data,
    vertices: newVertices,
    walls: newWalls,
    rooms: newRooms,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Copy FloorplanDataV3 (two-sided wall segments)
 */
function copyFloorplanDataV3(
  data: FloorplanDataV3,
  idMap: IdMap
): FloorplanDataV3 {
  const now = new Date().toISOString()

  // Copy vertices
  const newVertices: FloorplanVertex[] = data.vertices.map((v) => {
    const newId = generateId('v')
    idMap.vertices[v.id] = newId
    return { ...v, id: newId }
  })

  // First pass: copy rooms to build room ID mapping
  const newRooms: FloorplanRoomV3[] = data.rooms.map((room) => {
    const newRoomId = generateId('fp-room')
    idMap.floorplanRooms[room.id] = newRoomId
    // We'll update boundarySegmentIds and segmentSides in second pass
    return {
      ...deepClone(room),
      id: newRoomId,
    }
  })

  // Copy wall segments
  const newSegments: WallSegment[] = data.wallSegments.map((seg) => {
    const newId = generateId('ws')
    idMap.wallSegments[seg.id] = newId

    // Copy style with new ID
    const copySideStyle = (style: WallSideStyle): WallSideStyle => ({
      ...style,
      id: generateId('style'),
    })

    return {
      ...deepClone(seg),
      id: newId,
      startVertexId: idMap.vertices[seg.startVertexId],
      endVertexId: idMap.vertices[seg.endVertexId],
      sideA: {
        roomId: seg.sideA.roomId ? idMap.floorplanRooms[seg.sideA.roomId] || null : null,
        style: copySideStyle(seg.sideA.style),
      },
      sideB: {
        roomId: seg.sideB.roomId ? idMap.floorplanRooms[seg.sideB.roomId] || null : null,
        style: copySideStyle(seg.sideB.style),
      },
      doors: seg.doors.map((door) => ({
        ...door,
        id: generateId('door'),
      })),
    }
  })

  // Second pass: update room segment references
  for (const room of newRooms) {
    // Get original room to access original segment IDs
    const originalRoom = data.rooms.find(
      (r) => idMap.floorplanRooms[r.id] === room.id
    )
    if (originalRoom) {
      // Update boundarySegmentIds
      room.boundarySegmentIds = originalRoom.boundarySegmentIds.map(
        (id) => idMap.wallSegments[id] || id
      )

      // Update segmentSides keys
      const newSegmentSides: Record<string, 'A' | 'B'> = {}
      for (const [oldSegId, side] of Object.entries(originalRoom.segmentSides)) {
        const newSegId = idMap.wallSegments[oldSegId]
        if (newSegId) {
          newSegmentSides[newSegId] = side
        }
      }
      room.segmentSides = newSegmentSides
    }
  }

  // Copy wall styles library if present
  const newWallStyles = data.wallStyles?.map((style) => ({
    ...style,
    id: generateId('style'),
  }))

  return {
    ...data,
    version: 3,
    vertices: newVertices,
    wallSegments: newSegments,
    rooms: newRooms,
    wallStyles: newWallStyles,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Copy shared walls with updated room references
 */
function copySharedWalls(
  sharedWalls: SharedWall[] | undefined,
  idMap: IdMap
): SharedWall[] | undefined {
  if (!sharedWalls || sharedWalls.length === 0) return undefined

  return sharedWalls.map((wall) => {
    const newDoors: SharedWallDoor[] = wall.doors.map((door) => ({
      ...door,
      id: generateId('swd'),
      fromRoomId: idMap.rooms[door.fromRoomId] || door.fromRoomId,
    }))

    return {
      ...wall,
      id: generateId('sw'),
      room1Id: idMap.rooms[wall.room1Id] || wall.room1Id,
      room2Id: idMap.rooms[wall.room2Id] || wall.room2Id,
      doors: newDoors,
    }
  })
}

/**
 * Main function: Copy a Home with all its data
 *
 * @param source - The home to copy
 * @param mode - 'floorplan-only' or 'with-furniture'
 * @returns A new Home object with regenerated IDs
 */
export function copyHome(source: Home, mode: CopyMode): Home {
  const now = new Date().toISOString()
  const newHomeId = `home-${Date.now()}`

  const idMap: IdMap = {
    rooms: {},
    instances: {},
    vertices: {},
    walls: {},
    doors: {},
    wallSegments: {},
    floorplanRooms: {},
  }

  const includeInstances = mode === 'with-furniture'

  // Copy floorplan data first to build ID mappings
  let floorplanData: FloorplanData | undefined
  let floorplanDataV2: FloorplanDataV2 | undefined
  let floorplanDataV3: FloorplanDataV3 | undefined

  if (source.floorplanData) {
    floorplanData = copyFloorplanDataV1(source.floorplanData, newHomeId, idMap)
  }

  if (source.floorplanDataV2) {
    floorplanDataV2 = copyFloorplanDataV2(source.floorplanDataV2, idMap)
  }

  if (source.floorplanDataV3) {
    floorplanDataV3 = copyFloorplanDataV3(source.floorplanDataV3, idMap)
  }

  // Copy rooms
  const newRooms = source.rooms.map((room) =>
    copyRoom(room, newHomeId, idMap, includeInstances)
  )

  // Fix instance parent references (for items placed on other items)
  if (includeInstances) {
    for (const room of newRooms) {
      if (room.instances) {
        fixInstanceParentReferences(room.instances, idMap)
      }
    }
  }

  // Update floorplanRoomId references in copied rooms
  for (const room of newRooms) {
    if (room.floorplanRoomId && idMap.floorplanRooms[room.floorplanRoomId]) {
      room.floorplanRoomId = idMap.floorplanRooms[room.floorplanRoomId]
    }
  }

  // Copy shared walls
  const newSharedWalls = copySharedWalls(source.sharedWalls, idMap)

  return {
    id: newHomeId,
    name: `${source.name} (Copy)`,
    description: source.description,
    rooms: newRooms,
    thumbnailPath: undefined, // Don't copy thumbnail - will be regenerated
    floorplanData,
    floorplanDataV2,
    floorplanDataV3,
    sharedWalls: newSharedWalls,
    createdAt: now,
    updatedAt: now,
  }
}
