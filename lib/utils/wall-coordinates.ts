/**
 * Wall coordinate utilities for wall-mounted items
 * Handles conversion between world coordinates and wall-relative coordinates
 */
import * as THREE from 'three'
import { WallPlacement, Vector3 } from '@/types/room'

type WallSide = 'north' | 'south' | 'east' | 'west'

/**
 * Get the wall normal vector (direction the wall side faces)
 * Must match TwoSidedWallSegment's normalToCardinalDirection:
 * - normalY > 0 → 'north' → faces +Z
 * - normalY < 0 → 'south' → faces -Z
 * - normalX > 0 → 'east' → faces +X
 * - normalX < 0 → 'west' → faces -X
 */
export function getWallNormal(wallSide: WallSide): THREE.Vector3 {
  switch (wallSide) {
    case 'north': return new THREE.Vector3(0, 0, 1)   // North-facing wall faces +Z
    case 'south': return new THREE.Vector3(0, 0, -1)  // South-facing wall faces -Z
    case 'east': return new THREE.Vector3(1, 0, 0)    // East-facing wall faces +X
    case 'west': return new THREE.Vector3(-1, 0, 0)   // West-facing wall faces -X
  }
}

/**
 * Get the Y rotation for an item to face the wall's normal direction
 * The item's front face (-Z in local space) should point in the wallSide direction
 */
export function getWallFacingRotation(wallSide: WallSide): number {
  switch (wallSide) {
    case 'north': return Math.PI        // Item faces +Z (north)
    case 'south': return 0              // Item faces -Z (south)
    case 'east': return -Math.PI / 2    // Item faces +X (east)
    case 'west': return Math.PI / 2     // Item faces -X (west)
  }
}

/**
 * Get the lateral direction for a wall (direction along the wall, left to right when facing)
 */
export function getWallLateralDirection(wallSide: WallSide): THREE.Vector3 {
  switch (wallSide) {
    case 'north': return new THREE.Vector3(1, 0, 0)   // +X is right when facing north wall
    case 'south': return new THREE.Vector3(-1, 0, 0)  // -X is right when facing south wall
    case 'east': return new THREE.Vector3(0, 0, 1)    // +Z is right when facing east wall
    case 'west': return new THREE.Vector3(0, 0, -1)   // -Z is right when facing west wall
  }
}

interface WallInfo {
  center: THREE.Vector3
  width: number
  height: number
}

/**
 * Get wall center and dimensions from wall mesh userData
 */
export function getWallInfo(wallMesh: THREE.Mesh): WallInfo {
  const wallSide = wallMesh.userData.wallSide as WallSide
  const roomPosition = wallMesh.userData.roomPosition as [number, number, number] || [0, 0, 0]
  const roomWidth = wallMesh.userData.roomWidth as number || 10
  const roomDepth = wallMesh.userData.roomDepth as number || 10
  const roomHeight = wallMesh.userData.roomHeight as number || 10

  // Calculate wall center based on wall side
  const center = new THREE.Vector3()
  const halfWidth = roomWidth / 2
  const halfDepth = roomDepth / 2
  const halfHeight = roomHeight / 2

  switch (wallSide) {
    case 'north':
      center.set(roomPosition[0], roomPosition[1] + halfHeight, roomPosition[2] + halfDepth)
      return { center, width: roomWidth, height: roomHeight }
    case 'south':
      center.set(roomPosition[0], roomPosition[1] + halfHeight, roomPosition[2] - halfDepth)
      return { center, width: roomWidth, height: roomHeight }
    case 'east':
      center.set(roomPosition[0] + halfWidth, roomPosition[1] + halfHeight, roomPosition[2])
      return { center, width: roomDepth, height: roomHeight }
    case 'west':
      center.set(roomPosition[0] - halfWidth, roomPosition[1] + halfHeight, roomPosition[2])
      return { center, width: roomDepth, height: roomHeight }
  }
}

/**
 * Convert world position to wall-relative placement
 */
export function worldToWallRelative(
  worldPos: THREE.Vector3,
  wallMesh: THREE.Mesh
): Omit<WallPlacement, 'roomId'> {
  const wallSide = wallMesh.userData.wallSide as WallSide
  const wallInfo = getWallInfo(wallMesh)
  const lateralDir = getWallLateralDirection(wallSide)
  const normal = getWallNormal(wallSide)

  // Calculate lateral offset from wall center
  const toPoint = worldPos.clone().sub(wallInfo.center)
  const lateralOffset = toPoint.dot(lateralDir)

  // Height from floor
  const heightFromFloor = worldPos.y

  // Normal offset (distance from wall surface)
  // Positive means item is in front of wall (into room)
  const normalOffset = Math.abs(toPoint.dot(normal))

  return {
    wallSide,
    heightFromFloor,
    lateralOffset,
    normalOffset
  }
}

/**
 * Convert wall-relative placement to world position
 */
export function wallRelativeToWorld(
  wallPlacement: WallPlacement,
  wallMesh: THREE.Mesh
): Vector3 {
  const wallInfo = getWallInfo(wallMesh)
  const lateralDir = getWallLateralDirection(wallPlacement.wallSide)
  const normal = getWallNormal(wallPlacement.wallSide)

  const worldPos = wallInfo.center.clone()

  // Add lateral offset
  worldPos.add(lateralDir.multiplyScalar(wallPlacement.lateralOffset))

  // Set height
  worldPos.y = wallPlacement.heightFromFloor

  // Add normal offset (move away from wall into room)
  worldPos.add(normal.clone().multiplyScalar(wallPlacement.normalOffset))

  return { x: worldPos.x, y: worldPos.y, z: worldPos.z }
}

/**
 * Get a THREE.Plane for the wall surface (for raycasting)
 */
export function getWallPlane(wallMesh: THREE.Mesh): THREE.Plane {
  const wallSide = wallMesh.userData.wallSide as WallSide
  const wallInfo = getWallInfo(wallMesh)
  const normal = getWallNormal(wallSide).negate() // Negate to point outward

  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, wallInfo.center)
}

/**
 * Constrain a point to the wall bounds
 * Returns clamped lateral offset and height
 */
export function constrainToWallBounds(
  wallPlacement: WallPlacement,
  wallMesh: THREE.Mesh,
  itemWidth: number,
  itemHeight: number
): { lateralOffset: number; heightFromFloor: number } {
  const wallInfo = getWallInfo(wallMesh)

  // Calculate max offsets (accounting for item size)
  const maxLateral = (wallInfo.width / 2) - (itemWidth / 2)
  const maxHeight = wallInfo.height - (itemHeight / 2)
  const minHeight = itemHeight / 2

  return {
    lateralOffset: Math.max(-maxLateral, Math.min(maxLateral, wallPlacement.lateralOffset)),
    heightFromFloor: Math.max(minHeight, Math.min(maxHeight, wallPlacement.heightFromFloor))
  }
}

/**
 * Detect if a world position is near a wall edge
 * Returns the adjacent wall if close to edge, null otherwise
 */
export function detectWallEdge(
  worldPos: THREE.Vector3,
  wallMesh: THREE.Mesh,
  edgeThreshold: number = 0.5
): WallSide | null {
  const wallSide = wallMesh.userData.wallSide as WallSide
  const wallInfo = getWallInfo(wallMesh)
  const lateralDir = getWallLateralDirection(wallSide)

  // Calculate how far along the wall the point is
  const toPoint = worldPos.clone().sub(wallInfo.center)
  const lateralPos = toPoint.dot(lateralDir)

  const halfWidth = wallInfo.width / 2

  // Check if near left or right edge
  if (lateralPos > halfWidth - edgeThreshold) {
    // Near right edge - return clockwise next wall
    switch (wallSide) {
      case 'north': return 'east'
      case 'east': return 'south'
      case 'south': return 'west'
      case 'west': return 'north'
    }
  } else if (lateralPos < -halfWidth + edgeThreshold) {
    // Near left edge - return counter-clockwise next wall
    switch (wallSide) {
      case 'north': return 'west'
      case 'west': return 'south'
      case 'south': return 'east'
      case 'east': return 'north'
    }
  }

  return null
}

/**
 * Calculate wall placement from drag position along wall plane
 */
export function dragToWallPlacement(
  dragPoint: THREE.Vector3,
  wallMesh: THREE.Mesh,
  itemWidth: number,
  itemHeight: number,
  itemDepth: number
): Omit<WallPlacement, 'roomId'> {
  const preliminary = worldToWallRelative(dragPoint, wallMesh)

  // Constrain to wall bounds
  const constrained = constrainToWallBounds(
    { ...preliminary, roomId: '' },
    wallMesh,
    itemWidth,
    itemHeight
  )

  return {
    wallSide: preliminary.wallSide,
    heightFromFloor: constrained.heightFromFloor,
    lateralOffset: constrained.lateralOffset,
    normalOffset: itemDepth / 2 // Place front of item at wall surface
  }
}
