/**
 * Floorplan Converter: 2D → 3D Conversion
 *
 * Converts 2D FloorplanData to 3D Room objects with proper positioning,
 * doors, and camera setup.
 *
 * Coordinate System:
 * - 2D: Origin (0,0) at top-left, Y-axis points down
 * - 3D: Origin (0,0,0) at center, Y-axis points up
 * - Conversion: 2D X → 3D X, 2D Y → 3D Z
 */

import { FloorplanData, FloorplanRoom, FloorplanDoor, WallSide, Bounds } from '@/types/floorplan'
import { Room, Door, Vector3, SharedWall, SharedWallDoor } from '@/types/room'

/**
 * SharedWall candidate detected during conversion
 */
interface SharedWallCandidate {
  room1: FloorplanRoom
  room1Position: [number, number, number]
  room1Wall: 'north' | 'south' | 'east' | 'west'

  room2: FloorplanRoom
  room2Position: [number, number, number]
  room2Wall: 'north' | 'south' | 'east' | 'west'

  wallPosition: number     // The Z or X coordinate where walls meet
  orientation: 'east-west' | 'north-south'
  overlapRange: { min: number; max: number }  // Where walls overlap along their length
}

/**
 * Convert complete 2D floorplan to 3D rooms and shared walls
 * Returns both rooms and shared walls for z-fighting-free rendering
 */
export function convertFloorplanTo3D(floorplanData: FloorplanData): {
  rooms: Room[]
  sharedWalls: SharedWall[]
} {
  const rooms: Room[] = []

  if (floorplanData.rooms.length === 0) {
    return { rooms: [], sharedWalls: [] }
  }

  console.log('\n[convertFloorplanTo3D] Starting conversion')
  console.log('[convertFloorplanTo3D] Floorplan rooms:', floorplanData.rooms.map(r => ({
    id: r.id,
    name: r.name,
    doors: r.doors.length,
    doorDetails: r.doors.map(d => ({
      wallSide: d.wallSide,
      position: d.position,
      width: d.width
    }))
  })))

  // Calculate overall bounds to center the layout
  const bounds = calculateBounds(floorplanData.rooms)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerZ = (bounds.minY + bounds.maxY) / 2

  // Build position adjustments for shared walls
  // This ensures walls that share doors are at EXACTLY the same position
  const positionAdjustments = new Map<string, { x: number, z: number }>()
  const WALL_TOLERANCE = 0.2

  console.log('[Checking for shared walls]')

  for (let i = 0; i < floorplanData.rooms.length; i++) {
    const room1 = floorplanData.rooms[i]
    for (let j = i + 1; j < floorplanData.rooms.length; j++) {
      const room2 = floorplanData.rooms[j]

      console.log(`[Checking] ${room1.id} vs ${room2.id}`)

      // Check if rooms share a wall
      const room1Bottom = room1.y + room1.height
      const room2Top = room2.y
      const room2Bottom = room2.y + room2.height
      const room1Top = room1.y

      console.log(`  Room1: y=${room1.y}, height=${room1.height}, top=${room1Top}, bottom=${room1Bottom}`)
      console.log(`  Room2: y=${room2.y}, height=${room2.height}, top=${room2Top}, bottom=${room2Bottom}`)
      console.log(`  Bottom-Top gap: ${Math.abs(room1Bottom - room2Top).toFixed(3)}`)

      // Room 1 bottom touches Room 2 top (within tolerance)
      if (Math.abs(room1Bottom - room2Top) < WALL_TOLERANCE) {
        const horizontalOverlap = room1.x < (room2.x + room2.width) && (room1.x + room1.width) > room2.x
        if (horizontalOverlap) {
          // Adjust room2's Y position to exactly align with room1
          const avgY = (room1Bottom + room2Top) / 2
          const adjustment1 = avgY - room1Bottom
          const adjustment2 = avgY - room2Top

          const adj1 = positionAdjustments.get(room1.id) || { x: 0, z: 0 }
          const adj2 = positionAdjustments.get(room2.id) || { x: 0, z: 0 }

          positionAdjustments.set(room1.id, { x: adj1.x, z: adj1.z + adjustment1 })
          positionAdjustments.set(room2.id, { x: adj2.x, z: adj2.z + adjustment2 })

          console.log(`[Shared wall alignment] ${room1.id} bottom (${room1Bottom}) ~ ${room2.id} top (${room2Top}), avg=${avgY}`)
        }
      }

      // Similar checks for other wall combinations...
      // (Room 1 top touches Room 2 bottom)
      if (Math.abs(room1Top - room2Bottom) < WALL_TOLERANCE) {
        const horizontalOverlap = room1.x < (room2.x + room2.width) && (room1.x + room1.width) > room2.x
        if (horizontalOverlap) {
          const avgY = (room1Top + room2Bottom) / 2
          const adjustment1 = avgY - room1Top
          const adjustment2 = avgY - room2Bottom

          const adj1 = positionAdjustments.get(room1.id) || { x: 0, z: 0 }
          const adj2 = positionAdjustments.get(room2.id) || { x: 0, z: 0 }

          positionAdjustments.set(room1.id, { x: adj1.x, z: adj1.z + adjustment1 })
          positionAdjustments.set(room2.id, { x: adj2.x, z: adj2.z + adjustment2 })
        }
      }
    }
  }

  // Track room positions for SharedWall detection
  const roomPositions = new Map<string, [number, number, number]>()

  for (const floorplanRoom of floorplanData.rooms) {
    // Calculate 3D position (center the room)
    // 2D (x, y) is top-left; 3D position is center
    const roomCenterX = floorplanRoom.x + floorplanRoom.width / 2
    const roomCenterY2D = floorplanRoom.y + floorplanRoom.height / 2

    // Offset by overall center to place at origin
    // IMPORTANT: Negate both X and Z for proper top-down view orientation
    const adjustment = positionAdjustments.get(floorplanRoom.id) || { x: 0, z: 0 }
    const position3D: [number, number, number] = [
      -(roomCenterX - centerX) - adjustment.x,  // Negate X, also negate adjustment
      0,  // Always at ground level
      -(roomCenterY2D - centerZ) - adjustment.z  // Negate Z, also negate adjustment
    ]

    if (adjustment.x !== 0 || adjustment.z !== 0) {
      console.log(`[Applying adjustment] Room ${floorplanRoom.id}: 2D adjustment (${adjustment.x.toFixed(3)}, ${adjustment.z.toFixed(3)}), 3D becomes (${-adjustment.x.toFixed(3)}, ${-adjustment.z.toFixed(3)})`)
    }

    // Convert doors from 2D to 3D using world-space calculations
    const doors3D = convertDoors(floorplanRoom, position3D, centerX, centerZ)

    // Calculate wall positions in world space for debugging
    const wallPositions = {
      north: position3D[2] + floorplanRoom.height / 2,
      south: position3D[2] - floorplanRoom.height / 2,
      east: position3D[0] + floorplanRoom.width / 2,
      west: position3D[0] - floorplanRoom.width / 2
    }
    console.log(`[convertFloorplanTo3D] Room ${floorplanRoom.id} (${floorplanRoom.name}):`, {
      doors: `${floorplanRoom.doors.length} in 2D → ${doors3D.length} in 3D`,
      position: `(${position3D[0].toFixed(2)}, ${position3D[2].toFixed(2)})`,
      wallPositions: {
        north: wallPositions.north.toFixed(3),
        south: wallPositions.south.toFixed(3),
        east: wallPositions.east.toFixed(3),
        west: wallPositions.west.toFixed(3)
      }
    })

    // Calculate camera position for this room
    const cameraPosition = calculateCameraPosition(
      position3D,
      floorplanRoom.width,
      floorplanRoom.height,
      floorplanRoom.wallHeight
    )

    // Create 3D Room object
    const room3D: Room = {
      id: floorplanRoom.id,
      name: floorplanRoom.name,
      homeId: floorplanData.homeId,
      floorplanRoomId: floorplanRoom.id,
      dimensions: {
        width: floorplanRoom.width,
        depth: floorplanRoom.height,  // 2D height becomes 3D depth (Z-axis)
        height: floorplanRoom.wallHeight
      },
      position: position3D,
      doors: doors3D,
      instances: [],
      cameraPosition,
      cameraTarget: {
        x: position3D[0],
        y: floorplanRoom.wallHeight / 2,
        z: position3D[2]
      },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    }

    rooms.push(room3D)

    // Store position for SharedWall detection
    roomPositions.set(floorplanRoom.id, position3D)
  }

  // Detect shared walls between adjacent rooms
  const sharedWallCandidates = detectSharedWalls(floorplanData.rooms, roomPositions)

  // Create SharedWall objects
  const sharedWalls = sharedWallCandidates.map(candidate =>
    createSharedWall(candidate, centerX, centerZ)
  )

  // Mark rooms to exclude shared walls from rendering
  // Only exclude if SharedWall covers >95% of the wall (to handle partial overlaps)
  const roomsWithExclusions = rooms.map(room => {
    const excludedWalls: Room['excludedWalls'] = {}

    // Find all shared walls that involve this room
    sharedWalls.forEach(wall => {
      if (wall.room1Id === room.id) {
        // This room is room1 in the shared wall
        const candidate = sharedWallCandidates.find(c =>
          c.room1.id === room.id && c.room2.id === wall.room2Id
        )
        if (candidate) {
          // Check coverage percentage
          const wallLength = candidate.orientation === 'east-west'
            ? candidate.room1.width
            : candidate.room1.height
          const overlapLength = candidate.overlapRange.max - candidate.overlapRange.min
          const coverage = overlapLength / wallLength

          if (coverage > 0.95) {
            excludedWalls[candidate.room1Wall] = true
            console.log(`[excludedWalls] ${room.id} excluding ${candidate.room1Wall} (shared with ${wall.room2Id}, coverage: ${(coverage * 100).toFixed(1)}%)`)
          } else {
            console.log(`[excludedWalls] ${room.id} NOT excluding ${candidate.room1Wall} (partial coverage: ${(coverage * 100).toFixed(1)}%)`)
          }
        }
      } else if (wall.room2Id === room.id) {
        // This room is room2 in the shared wall
        const candidate = sharedWallCandidates.find(c =>
          c.room2.id === room.id && c.room1.id === wall.room1Id
        )
        if (candidate) {
          // Check coverage percentage
          const wallLength = candidate.orientation === 'east-west'
            ? candidate.room2.width
            : candidate.room2.height
          const overlapLength = candidate.overlapRange.max - candidate.overlapRange.min
          const coverage = overlapLength / wallLength

          if (coverage > 0.95) {
            excludedWalls[candidate.room2Wall] = true
            console.log(`[excludedWalls] ${room.id} excluding ${candidate.room2Wall} (shared with ${wall.room1Id}, coverage: ${(coverage * 100).toFixed(1)}%)`)
          } else {
            console.log(`[excludedWalls] ${room.id} NOT excluding ${candidate.room2Wall} (partial coverage: ${(coverage * 100).toFixed(1)}%)`)
          }
        }
      }
    })

    return Object.keys(excludedWalls).length > 0
      ? { ...room, excludedWalls }
      : room
  })

  console.log(`[convertFloorplanTo3D] Complete: ${roomsWithExclusions.length} rooms, ${sharedWalls.length} shared walls`)

  return {
    rooms: roomsWithExclusions,
    sharedWalls
  }
}

/**
 * Detect which walls should be rendered (exclude shared walls to prevent z-fighting)
 */
function detectWallsToRender(
  room: FloorplanRoom,
  allRooms: FloorplanRoom[],
  roomPosition3D: [number, number, number]
): Array<'north' | 'south' | 'east' | 'west'> {
  const WALL_TOLERANCE = 0.15  // Tolerance for wall position matching
  const wallsToExclude: Array<'north' | 'south' | 'east' | 'west'> = []

  // Calculate this room's wall positions in 3D
  const ourWalls = {
    north: roomPosition3D[2] + room.height / 2,
    south: roomPosition3D[2] - room.height / 2,
    east: roomPosition3D[0] + room.width / 2,
    west: roomPosition3D[0] - room.width / 2
  }

  // Check each other room for shared walls
  for (const otherRoom of allRooms) {
    if (otherRoom.id === room.id) continue

    // We need to calculate the other room's 3D position to compare wall positions
    // For simplicity, we'll use a heuristic: if rooms are adjacent in 2D, check if we should exclude

    // Check if walls align in 2D (simplified check)
    const room1Bottom = room.y + room.height
    const room2Top = otherRoom.y
    const room1Top = room.y
    const room2Bottom = otherRoom.y + otherRoom.height
    const room1Right = room.x + room.width
    const room2Left = otherRoom.x
    const room1Left = room.x
    const room2Right = otherRoom.x + otherRoom.width

    // South wall shared (our bottom meets their top)
    if (Math.abs(room1Bottom - room2Top) < 0.2) {
      const horizontalOverlap = room.x < (otherRoom.x + otherRoom.width) && (room.x + room.width) > otherRoom.x
      if (horizontalOverlap && room.id > otherRoom.id) {
        wallsToExclude.push('south')
        console.log(`[Wall exclusion] ${room.id} excluding SOUTH (shared with ${otherRoom.id})`)
      }
    }

    // North wall shared (our top meets their bottom)
    if (Math.abs(room1Top - room2Bottom) < 0.2) {
      const horizontalOverlap = room.x < (otherRoom.x + otherRoom.width) && (room.x + room.width) > otherRoom.x
      if (horizontalOverlap && room.id > otherRoom.id) {
        wallsToExclude.push('north')
        console.log(`[Wall exclusion] ${room.id} excluding NORTH (shared with ${otherRoom.id})`)
      }
    }

    // East wall shared (our right meets their left)
    if (Math.abs(room1Right - room2Left) < 0.2) {
      const verticalOverlap = room.y < (otherRoom.y + otherRoom.height) && (room.y + room.height) > otherRoom.y
      if (verticalOverlap && room.id > otherRoom.id) {
        wallsToExclude.push('east')
        console.log(`[Wall exclusion] ${room.id} excluding EAST (shared with ${otherRoom.id})`)
      }
    }

    // West wall shared (our left meets their right)
    if (Math.abs(room1Left - room2Right) < 0.2) {
      const verticalOverlap = room.y < (otherRoom.y + otherRoom.height) && (room.y + room.height) > otherRoom.y
      if (verticalOverlap && room.id > otherRoom.id) {
        wallsToExclude.push('west')
        console.log(`[Wall exclusion] ${room.id} excluding WEST (shared with ${otherRoom.id})`)
      }
    }
  }

  const wallsToRender = (['north', 'south', 'east', 'west'] as const).filter(
    wall => !wallsToExclude.includes(wall)
  )

  console.log(`[Wall rendering] ${room.id}: rendering ${wallsToRender.join(', ')}`)

  return wallsToRender
}

/**
 * Calculate bounding box for all rooms
 */
function calculateBounds(rooms: FloorplanRoom[]): Bounds {
  if (rooms.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const room of rooms) {
    minX = Math.min(minX, room.x)
    maxX = Math.max(maxX, room.x + room.width)
    minY = Math.min(minY, room.y)
    maxY = Math.max(maxY, room.y + room.height)
  }

  return { minX, maxX, minY, maxY }
}

/**
 * Convert 2D doors to 3D door openings using world-space calculations
 */
function convertDoors(
  room: FloorplanRoom,
  roomPosition3D: [number, number, number],
  centerX: number,
  centerZ: number
): Door[] {
  return room.doors.map(door => {
    // Calculate door's absolute X position in 2D world space, then convert to 3D
    let doorAbsoluteX2D: number
    let doorAbsoluteX3D: number
    let doorAbsoluteZ3D: number

    switch (door.wallSide) {
      case 'top':
      case 'bottom':
        // Door is along a horizontal wall (runs along X-axis)
        doorAbsoluteX2D = room.x + door.position
        doorAbsoluteX3D = -(doorAbsoluteX2D - centerX)
        // Use the wall's actual 3D Z position (accounts for alignment adjustments)
        doorAbsoluteZ3D = door.wallSide === 'top'
          ? roomPosition3D[2] + room.height / 2  // North wall
          : roomPosition3D[2] - room.height / 2  // South wall
        break
      case 'left':
      case 'right':
        // Door is along a vertical wall (runs along Z-axis)
        doorAbsoluteX3D = door.wallSide === 'left'
          ? roomPosition3D[0] - room.width / 2   // West wall
          : roomPosition3D[0] + room.width / 2   // East wall
        // Calculate Z from 2D position
        const doorAbsoluteZ2D = room.y + door.position
        doorAbsoluteZ3D = -(doorAbsoluteZ2D - centerZ)
        break
    }

    // Calculate normalized position relative to room center
    let normalizedPosition: number
    const wallOrientation = wallSideToOrientation(door.wallSide)

    if (wallOrientation === 'north' || wallOrientation === 'south') {
      // Door is on a north/south wall (runs along X-axis)
      const doorOffsetFromRoomCenter = doorAbsoluteX3D - roomPosition3D[0]
      normalizedPosition = doorOffsetFromRoomCenter / room.width
    } else {
      // Door is on an east/west wall (runs along Z-axis)
      const doorOffsetFromRoomCenter = doorAbsoluteZ3D - roomPosition3D[2]
      normalizedPosition = doorOffsetFromRoomCenter / room.height
    }

    const door3D = {
      wall: wallOrientation,
      position: normalizedPosition,
      width: door.width,
      height: door.height
    }

    console.log(`[convertDoors] Room ${room.id} (${room.name}):`, {
      '2D': { wallSide: door.wallSide, position: door.position },
      '3D world': `(${doorAbsoluteX3D.toFixed(2)}, ${doorAbsoluteZ3D.toFixed(2)})`,
      'normalized': normalizedPosition.toFixed(3),
      'wall': door3D.wall
    })

    return door3D
  })
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
      return room.height  // Vertical walls (2D height = 3D depth)
  }
}

/**
 * Convert 2D wall side to 3D wall orientation
 *
 * Mapping (accounts for coordinate flip in position conversion):
 * - top    → north (+Z direction)
 * - bottom → south (-Z direction)
 * - left   → west  (-X direction)
 * - right  → east  (+X direction)
 */
function wallSideToOrientation(side: WallSide): 'north' | 'south' | 'east' | 'west' {
  const map: Record<WallSide, 'north' | 'south' | 'east' | 'west'> = {
    top: 'north',
    bottom: 'south',
    left: 'west',
    right: 'east'
  }
  return map[side]
}

/**
 * Calculate camera position for viewing a room
 * Positions camera at an angle above and to the side of the room
 */
function calculateCameraPosition(
  roomPosition: [number, number, number],
  width: number,
  depth: number,
  height: number
): Vector3 {
  // Calculate distance based on room size
  const maxDimension = Math.max(width, depth)
  const distance = maxDimension * 1.5

  // Position camera at an angle (northeast direction, elevated)
  return {
    x: roomPosition[0] + distance * 0.7,
    y: height + 8,  // 8 feet above wall height
    z: roomPosition[2] + distance * 0.7
  }
}

// ============================================
// SharedWall Detection & Creation
// ============================================

/**
 * Calculate overlap range between two line segments
 * Returns null if no overlap
 */
function calculateOverlapRange(
  a1: number,
  a2: number,
  b1: number,
  b2: number
): { min: number; max: number } | null {
  const min = Math.max(a1, b1)
  const max = Math.min(a2, b2)

  if (max > min) {
    return { min, max }
  }

  return null
}

/**
 * Detect all shared walls between rooms
 * Returns candidates for SharedWall creation
 */
function detectSharedWalls(
  rooms: FloorplanRoom[],
  roomPositions: Map<string, [number, number, number]>
): SharedWallCandidate[] {
  const candidates: SharedWallCandidate[] = []
  const tolerance = 0.2  // ft (same as current wall alignment tolerance)

  console.log('\n[detectSharedWalls] Checking for shared walls...')

  // Check every pair of rooms
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const room1 = rooms[i]
      const room2 = rooms[j]
      const pos1 = roomPositions.get(room1.id)!
      const pos2 = roomPositions.get(room2.id)!

      // Calculate wall positions for each room
      const room1North = pos1[2] + room1.height / 2  // +Z
      const room1South = pos1[2] - room1.height / 2  // -Z
      const room1East = pos1[0] + room1.width / 2    // +X
      const room1West = pos1[0] - room1.width / 2    // -X

      const room2North = pos2[2] + room2.height / 2
      const room2South = pos2[2] - room2.height / 2
      const room2East = pos2[0] + room2.width / 2
      const room2West = pos2[0] - room2.width / 2

      // Check Room1's north wall vs Room2's south wall
      if (Math.abs(room1North - room2South) < tolerance) {
        const overlapX = calculateOverlapRange(
          pos1[0] - room1.width / 2,  // room1 left
          pos1[0] + room1.width / 2,  // room1 right
          pos2[0] - room2.width / 2,  // room2 left
          pos2[0] + room2.width / 2   // room2 right
        )

        if (overlapX) {
          console.log(`[Shared wall] ${room1.id} north ↔ ${room2.id} south at Z=${((room1North + room2South) / 2).toFixed(3)}`)
          candidates.push({
            room1,
            room1Position: pos1,
            room1Wall: 'north',
            room2,
            room2Position: pos2,
            room2Wall: 'south',
            wallPosition: (room1North + room2South) / 2,
            orientation: 'east-west',  // Wall runs along X axis
            overlapRange: overlapX
          })
        }
      }

      // Check Room1's south wall vs Room2's north wall
      if (Math.abs(room1South - room2North) < tolerance) {
        const overlapX = calculateOverlapRange(
          pos1[0] - room1.width / 2,
          pos1[0] + room1.width / 2,
          pos2[0] - room2.width / 2,
          pos2[0] + room2.width / 2
        )

        if (overlapX) {
          console.log(`[Shared wall] ${room1.id} south ↔ ${room2.id} north at Z=${((room1South + room2North) / 2).toFixed(3)}`)
          candidates.push({
            room1,
            room1Position: pos1,
            room1Wall: 'south',
            room2,
            room2Position: pos2,
            room2Wall: 'north',
            wallPosition: (room1South + room2North) / 2,
            orientation: 'east-west',
            overlapRange: overlapX
          })
        }
      }

      // Check Room1's east wall vs Room2's west wall
      if (Math.abs(room1East - room2West) < tolerance) {
        const overlapZ = calculateOverlapRange(
          pos1[2] - room1.height / 2,  // room1 back
          pos1[2] + room1.height / 2,  // room1 front
          pos2[2] - room2.height / 2,  // room2 back
          pos2[2] + room2.height / 2   // room2 front
        )

        if (overlapZ) {
          console.log(`[Shared wall] ${room1.id} east ↔ ${room2.id} west at X=${((room1East + room2West) / 2).toFixed(3)}`)
          candidates.push({
            room1,
            room1Position: pos1,
            room1Wall: 'east',
            room2,
            room2Position: pos2,
            room2Wall: 'west',
            wallPosition: (room1East + room2West) / 2,
            orientation: 'north-south',  // Wall runs along Z axis
            overlapRange: overlapZ
          })
        }
      }

      // Check Room1's west wall vs Room2's east wall
      if (Math.abs(room1West - room2East) < tolerance) {
        const overlapZ = calculateOverlapRange(
          pos1[2] - room1.height / 2,
          pos1[2] + room1.height / 2,
          pos2[2] - room2.height / 2,
          pos2[2] + room2.height / 2
        )

        if (overlapZ) {
          console.log(`[Shared wall] ${room1.id} west ↔ ${room2.id} east at X=${((room1West + room2East) / 2).toFixed(3)}`)
          candidates.push({
            room1,
            room1Position: pos1,
            room1Wall: 'west',
            room2,
            room2Position: pos2,
            room2Wall: 'east',
            wallPosition: (room1West + room2East) / 2,
            orientation: 'north-south',
            overlapRange: overlapZ
          })
        }
      }
    }
  }

  console.log(`[detectSharedWalls] Found ${candidates.length} shared wall(s)`)
  return candidates
}

/**
 * Merge overlapping doors into single holes
 * Sort by position, then merge doors that overlap
 */
function mergeDoors(doors: SharedWallDoor[]): SharedWallDoor[] {
  if (doors.length === 0) return []

  // Sort by position along wall
  const sorted = [...doors].sort((a, b) => a.position - b.position)

  const merged: SharedWallDoor[] = []

  for (const door of sorted) {
    if (merged.length === 0) {
      merged.push({ ...door })
      continue
    }

    const last = merged[merged.length - 1]
    const lastEnd = last.position + last.width
    const doorEnd = door.position + door.width

    // Check if doors overlap (within 0.5 ft tolerance)
    if (door.position - lastEnd < 0.5) {
      // Merge: extend the last door to cover both
      const newWidth = Math.max(lastEnd, doorEnd) - last.position
      console.log(`[mergeDoors] Merging doors: ${last.id} + ${door.id}, width ${last.width}ft + ${door.width}ft → ${newWidth.toFixed(2)}ft`)
      last.width = newWidth
      last.height = Math.max(last.height, door.height)
      // Update ID to reflect merge
      last.id = `${last.id}+${door.id}`
    } else {
      // No overlap, add as separate door
      merged.push({ ...door })
    }
  }

  console.log(`[mergeDoors] ${doors.length} doors → ${merged.length} after merging`)
  return merged
}

/**
 * Create a SharedWall from a detected candidate
 * Collects doors from both rooms and merges them
 */
function createSharedWall(candidate: SharedWallCandidate, centerX: number, centerZ: number): SharedWall {
  const {
    room1,
    room2,
    room1Position,
    room2Position,
    room1Wall,
    room2Wall,
    wallPosition,
    orientation,
    overlapRange
  } = candidate

  // Wall dimensions
  const wallWidth = overlapRange.max - overlapRange.min
  const wallCenter = (overlapRange.min + overlapRange.max) / 2

  // Wall height (use maximum of both rooms)
  const wallHeight = Math.max(
    room1.wallHeight || 10,
    room2.wallHeight || 10
  )

  // Position in 3D space
  // Note: Y=0 because ShapeGeometry starts at Y=0 (not centered like PlaneGeometry)
  let position3D: [number, number, number]
  if (orientation === 'east-west') {
    // Wall runs along X axis (north-south wall)
    position3D = [wallCenter, 0, wallPosition]
  } else {
    // Wall runs along Z axis (east-west wall)
    position3D = [wallPosition, 0, wallCenter]
  }

  console.log(`[createSharedWall] ${room1.id}(${room1Wall}) ↔ ${room2.id}(${room2Wall}):`, {
    orientation,
    position: `(${position3D[0].toFixed(2)}, ${position3D[1].toFixed(2)}, ${position3D[2].toFixed(2)})`,
    width: wallWidth.toFixed(2),
    height: wallHeight
  })

  // Collect doors from both rooms
  const doors: SharedWallDoor[] = []

  // Collect Room 1's doors on this wall
  room1.doors
    .filter(door => wallSideToOrientation(door.wallSide) === room1Wall)
    .forEach(door => {
      // Calculate door's absolute position in world space
      let doorWorldPos: number
      if (orientation === 'east-west') {
        // Door position along X axis
        const doorAbsoluteX2D = room1.x + door.position
        doorWorldPos = -(doorAbsoluteX2D - centerX)
      } else {
        // Door position along Z axis
        const doorAbsoluteZ2D = room1.y + door.position
        doorWorldPos = -(doorAbsoluteZ2D - centerZ)
      }

      // Convert to wall-relative coordinates (from wall's left edge)
      const positionAlongWall = doorWorldPos - overlapRange.min

      console.log(`  Room ${room1.id} door: world=${doorWorldPos.toFixed(2)}, wall-relative=${positionAlongWall.toFixed(2)}`)

      doors.push({
        id: door.id,
        fromRoomId: room1.id,
        position: positionAlongWall,
        width: door.width,
        height: door.height
      })
    })

  // Collect Room 2's doors on this wall
  room2.doors
    .filter(door => wallSideToOrientation(door.wallSide) === room2Wall)
    .forEach(door => {
      let doorWorldPos: number
      if (orientation === 'east-west') {
        const doorAbsoluteX2D = room2.x + door.position
        doorWorldPos = -(doorAbsoluteX2D - centerX)
      } else {
        const doorAbsoluteZ2D = room2.y + door.position
        doorWorldPos = -(doorAbsoluteZ2D - centerZ)
      }

      const positionAlongWall = doorWorldPos - overlapRange.min

      console.log(`  Room ${room2.id} door: world=${doorWorldPos.toFixed(2)}, wall-relative=${positionAlongWall.toFixed(2)}`)

      doors.push({
        id: door.id,
        fromRoomId: room2.id,
        position: positionAlongWall,
        width: door.width,
        height: door.height
      })
    })

  // Merge overlapping doors
  const mergedDoors = mergeDoors(doors)

  return {
    id: `shared-wall-${room1.id}-${room2.id}`,
    room1Id: room1.id,
    room2Id: room2.id,
    position: position3D,
    width: wallWidth,
    height: wallHeight,
    orientation,
    doors: mergedDoors
  }
}

/**
 * Validate floorplan data before conversion
 */
export function validateFloorplan(floorplan: FloorplanData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check for at least one room
  if (floorplan.rooms.length === 0) {
    errors.push('Floorplan must contain at least one room')
  }

  // Validate each room
  for (const room of floorplan.rooms) {
    // Check minimum room size (3ft x 3ft)
    if (room.width < 3 || room.height < 3) {
      errors.push(`Room "${room.name}" is too small (minimum 3ft × 3ft)`)
    }

    // Check wall height range (6-15ft)
    if (room.wallHeight < 6 || room.wallHeight > 15) {
      errors.push(`Room "${room.name}" has invalid wall height (must be 6-15ft)`)
    }

    // Validate doors
    for (const door of room.doors) {
      // Check door width (2-6ft)
      if (door.width < 2 || door.width > 6) {
        errors.push(`Door in room "${room.name}" has invalid width (must be 2-6ft)`)
      }

      // Check door position within wall bounds
      const wallLength = getWallLength(door.wallSide, room)
      if (door.position < 0 || door.position > wallLength) {
        errors.push(`Door in room "${room.name}" is positioned outside wall bounds`)
      }

      // Check minimum distance from corners (1ft)
      if (door.position < 1 || door.position > wallLength - 1) {
        errors.push(`Door in room "${room.name}" is too close to corner (minimum 1ft)`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get room color palette for visual differentiation
 */
export function getRoomColorPalette(): string[] {
  return [
    '#E3F2FD', // Light Blue
    '#F3E5F5', // Light Purple
    '#E8F5E9', // Light Green
    '#FFF3E0', // Light Orange
    '#FCE4EC', // Light Pink
    '#E0F2F1', // Light Teal
    '#F1F8E9', // Light Lime
    '#FFF9C4', // Light Yellow
  ]
}

/**
 * Assign color to room based on index
 */
export function assignRoomColor(index: number): string {
  const palette = getRoomColorPalette()
  return palette[index % palette.length]
}

/**
 * Convert 3D rooms back to 2D floorplan
 * (Reverse conversion for existing homes)
 */
export function convert3DToFloorplan(
  homeId: string,
  rooms3D: Room[]
): FloorplanData {
  const floorplanRooms: FloorplanRoom[] = []

  // Convert each 3D room to 2D
  rooms3D.forEach((room3D, index) => {
    // Get dimensions from the room
    const width = room3D.dimensions?.width || 20
    const depth = room3D.dimensions?.depth || 20
    const height = room3D.dimensions?.height || 10

    // Get position (if available) and convert to top-left corner
    const position3D = room3D.position || [0, 0, 0]
    const x = position3D[0] - width / 2  // Center to top-left
    const z = position3D[2] - depth / 2

    // Convert 3D doors to 2D doors
    const doors2D: FloorplanDoor[] = (room3D.doors || []).map((door3D, doorIndex) => {
      // Convert wall orientation
      let wallSide: WallSide = 'top'
      switch (door3D.wall) {
        case 'north': wallSide = 'top'; break
        case 'south': wallSide = 'bottom'; break
        case 'west': wallSide = 'left'; break
        case 'east': wallSide = 'right'; break
      }

      // Convert normalized position (-0.5 to 0.5) to absolute feet
      const wallLength = wallSide === 'top' || wallSide === 'bottom' ? width : depth
      const wallCenter = wallLength / 2
      const position = wallCenter + (door3D.position * wallLength)

      return {
        id: `door-${Date.now()}-${doorIndex}`,
        wallSide,
        position,
        width: door3D.width,
        height: door3D.height
      }
    })

    // Create 2D room
    const floorplanRoom: FloorplanRoom = {
      id: room3D.floorplanRoomId || `room-${Date.now()}-${index}`,
      name: room3D.name || `Room ${index + 1}`,
      x,
      y: z,  // 3D Z becomes 2D Y
      width,
      height: depth,
      wallHeight: height,
      doors: doors2D,
      color: assignRoomColor(index)
    }

    floorplanRooms.push(floorplanRoom)
  })

  // Calculate canvas size to fit all rooms
  let maxX = 50, maxY = 50
  floorplanRooms.forEach(room => {
    maxX = Math.max(maxX, room.x + room.width + 10)
    maxY = Math.max(maxY, room.y + room.height + 10)
  })

  return {
    id: `floorplan-${Date.now()}`,
    homeId,
    canvasWidth: Math.ceil(maxX),
    canvasHeight: Math.ceil(maxY),
    rooms: floorplanRooms,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}
