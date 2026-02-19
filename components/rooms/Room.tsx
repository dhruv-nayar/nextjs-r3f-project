'use client'

import * as THREE from 'three'
import { useMemo, useCallback, useRef, useEffect } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { useRoomHover } from '@/lib/room-hover-context'
import { useSelection } from '@/lib/selection-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { WallSide, RoomGridState, createDefaultRoomGridState } from '@/types/selection'
import { WallHeights } from '@/types/room'
import { FloorMeasurementGrid, WallMeasurementGrid } from './MeasurementGrid'
import { useWallMesh } from '@/lib/contexts/wall-mesh-context'
import { useSurfaceMesh } from '@/lib/contexts/surface-mesh-context'

interface Door {
  wall: 'north' | 'south' | 'east' | 'west'  // Which wall (north=+Z, south=-Z, east=+X, west=-X)
  position: number  // Position along the wall (-0.5 to 0.5, where 0 is center)
  width: number     // Door width in feet
  height: number    // Door height in feet
}

interface RoomProps {
  width: number   // in feet
  height: number  // in feet (default height for all walls)
  depth: number   // in feet
  position?: [number, number, number]  // Position offset for the room
  doors?: Door[]   // Optional door openings
  roomId?: string  // Room ID for hover detection
  excludedWalls?: {  // Which walls to exclude from rendering (SharedWall handles them)
    north?: boolean
    south?: boolean
    east?: boolean
    west?: boolean
  }
  wallHeights?: WallHeights  // Per-wall height overrides
  gridSettings?: RoomGridState  // Optional grid overlay settings
}

/**
 * Get the height for a specific wall, using override if provided or default
 */
function getWallHeight(wall: 'north' | 'south' | 'east' | 'west', defaultHeight: number, wallHeights?: WallHeights): number {
  return wallHeights?.[wall] ?? defaultHeight
}

function createWallWithDoors(
  wallWidth: number,
  wallHeight: number,
  doors: Array<{ width: number; height: number; position: number }>
) {
  console.log('[Room createWallWithDoors]', { wallWidth, wallHeight, doorCount: doors.length })

  const shape = new THREE.Shape()

  // Create outer rectangle (wall) centered vertically at origin - CCW winding
  shape.moveTo(-wallWidth / 2, -wallHeight / 2)
  shape.lineTo(wallWidth / 2, -wallHeight / 2)
  shape.lineTo(wallWidth / 2, wallHeight / 2)
  shape.lineTo(-wallWidth / 2, wallHeight / 2)
  shape.closePath()

  // Create hole for each door - CW winding (OPPOSITE of outer shape)
  doors.forEach((door, index) => {
    const doorX = door.position * wallWidth
    const doorLeft = doorX - door.width / 2
    const doorRight = doorX + door.width / 2
    const doorBottom = -wallHeight / 2
    const doorTop = doorBottom + door.height

    console.log(`[Room] Door ${index}:`, {
      position: door.position,
      width: door.width,
      height: door.height,
      doorX,
      doorLeft,
      doorRight,
      wallRange: [-wallWidth / 2, wallWidth / 2],
      doorBottom,
      doorTop
    })

    // Validate door is within wall bounds with margin
    const MARGIN = 0.05 // 0.05 feet margin from edges
    if (doorLeft < -wallWidth / 2 + MARGIN || doorRight > wallWidth / 2 - MARGIN) {
      console.warn(`[Room] Door ${index} is too close to wall bounds, skipping`)
      return
    }

    // Add small inset to ensure hole doesn't touch outer boundary (critical for triangulation)
    const INSET = 0.01
    const insetLeft = doorLeft + INSET
    const insetRight = doorRight - INSET
    const insetBottom = doorBottom + INSET
    const insetTop = doorTop - INSET

    // Create hole with CW winding (opposite of outer shape) - required by THREE.js
    const hole = new THREE.Path()
    hole.moveTo(insetLeft, insetBottom)
    hole.lineTo(insetLeft, insetTop)      // Go up
    hole.lineTo(insetRight, insetTop)     // Go right
    hole.lineTo(insetRight, insetBottom)  // Go down
    hole.closePath()

    shape.holes.push(hole)
  })

  const geometry = new THREE.ShapeGeometry(shape)
  console.log('[Room] Created geometry, vertices:', geometry.attributes.position.count)

  return geometry
}

export function Room({ width, height, depth, position = [0, 0, 0], doors = [], roomId, excludedWalls, wallHeights, gridSettings }: RoomProps) {
  console.log(`[Room] Rendering room ${roomId} with doors:`, doors)

  // Get individual wall heights
  const northHeight = getWallHeight('north', height, wallHeights)
  const southHeight = getWallHeight('south', height, wallHeights)
  const eastHeight = getWallHeight('east', height, wallHeights)
  const westHeight = getWallHeight('west', height, wallHeights)

  // Refs for wall meshes (used for wall/ceiling placement raycasting)
  const northWallRef = useRef<THREE.Mesh>(null)
  const southWallRef = useRef<THREE.Mesh>(null)
  const eastWallRef = useRef<THREE.Mesh>(null)
  const westWallRef = useRef<THREE.Mesh>(null)
  const ceilingRef = useRef<THREE.Mesh>(null)
  const floorMeshRef = useRef<THREE.Mesh>(null)

  // Wall mesh context for item placement
  const { registerWall, unregisterWall, registerCeiling, unregisterCeiling } = useWallMesh()
  const { registerFloorSurface, unregisterFloorSurface } = useSurfaceMesh()

  // Register wall, ceiling, and floor meshes with context
  useEffect(() => {
    if (!roomId) return

    // Register walls that exist (not excluded)
    if (northWallRef.current && !excludedWalls?.north) {
      registerWall(roomId, 'north', northWallRef.current)
    }
    if (southWallRef.current && !excludedWalls?.south) {
      registerWall(roomId, 'south', southWallRef.current)
    }
    if (eastWallRef.current && !excludedWalls?.east) {
      registerWall(roomId, 'east', eastWallRef.current)
    }
    if (westWallRef.current && !excludedWalls?.west) {
      registerWall(roomId, 'west', westWallRef.current)
    }
    if (ceilingRef.current) {
      registerCeiling(roomId, ceilingRef.current)
    }
    // Register floor surface
    if (floorMeshRef.current) {
      registerFloorSurface(roomId, floorMeshRef.current)
    }

    // Cleanup on unmount
    return () => {
      unregisterWall(roomId, 'north')
      unregisterWall(roomId, 'south')
      unregisterWall(roomId, 'east')
      unregisterWall(roomId, 'west')
      unregisterCeiling(roomId)
      unregisterFloorSurface(roomId)
    }
  }, [roomId, excludedWalls, registerWall, unregisterWall, registerCeiling, unregisterCeiling, registerFloorSurface, unregisterFloorSurface])

  // Use provided grid settings or defaults
  const effectiveGridSettings = gridSettings || createDefaultRoomGridState()
  const { hoveredRoomId, setHoveredRoomId } = useRoomHover()
  const {
    selectWall,
    selectFloor,
    isWallSelected,
    isFloorSelected,
    hoveredItem,
    setHoveredItem,
  } = useSelection()
  const { setSelectedFurnitureId } = useFurnitureSelection()

  const isHovered = roomId && hoveredRoomId === roomId

  // Selection state helpers
  const isFloorSelectedHere = roomId ? isFloorSelected(roomId) : false
  const isWallSelectedFn = (side: WallSide) => roomId ? isWallSelected(roomId, side) : false
  const isWallHoveredFn = (side: WallSide) =>
    hoveredItem?.type === 'wall' &&
    hoveredItem.roomId === roomId &&
    hoveredItem.side === side
  const isFloorHoveredHere =
    hoveredItem?.type === 'floor' &&
    hoveredItem.roomId === roomId

  // Click handlers - use MouseEvent for onClick
  const handleWallClick = useCallback((side: WallSide, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (roomId) {
      setSelectedFurnitureId(null) // Clear furniture selection when selecting wall
      selectWall(roomId, side)
    }
  }, [roomId, selectWall, setSelectedFurnitureId])

  const handleFloorClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (roomId) {
      setSelectedFurnitureId(null) // Clear furniture selection when selecting floor
      selectFloor(roomId)
    }
  }, [roomId, selectFloor, setSelectedFurnitureId])

  // Hover handlers for walls/floor - use PointerEvent for onPointerOver/Out
  const handleWallHover = useCallback((side: WallSide, hovered: boolean, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (roomId) {
      setHoveredItem(hovered ? { type: 'wall', roomId, side } : null)
      document.body.style.cursor = hovered ? 'pointer' : 'default'
    }
  }, [roomId, setHoveredItem])

  const handleFloorHover = useCallback((hovered: boolean, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (roomId) {
      setHoveredItem(hovered ? { type: 'floor', roomId } : null)
      document.body.style.cursor = hovered ? 'pointer' : 'default'
    }
  }, [roomId, setHoveredItem])

  // Get emissive color based on selection/hover state
  const getEmissiveColor = (isSelected: boolean, isItemHovered: boolean) => {
    if (isSelected) return new THREE.Color(0xffa500) // Orange for selected
    if (isItemHovered || isHovered) return new THREE.Color(0x00ffff) // Cyan for hovered
    return new THREE.Color(0x000000)
  }

  const getEmissiveIntensity = (isSelected: boolean, isItemHovered: boolean) => {
    if (isSelected) return 0.5
    if (isItemHovered || isHovered) return 0.3
    return 0
  }

  // Helper to check if wall should render
  const shouldRenderWall = (wall: 'north' | 'south' | 'east' | 'west') => {
    return !excludedWalls?.[wall]
  }

  // Get all doors on a specific wall
  const getDoorsOnWall = (wall: string) => doors.filter(door => door.wall === wall)

  // Create wall geometries with doors (using individual wall heights)
  const northWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('north')
    if (wallDoors.length > 0) {
      return createWallWithDoors(width, northHeight, wallDoors)
    }
    return null
  }, [width, northHeight, doors])

  const southWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('south')
    if (wallDoors.length > 0) {
      return createWallWithDoors(width, southHeight, wallDoors)
    }
    return null
  }, [width, southHeight, doors])

  const eastWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('east')
    if (wallDoors.length > 0) {
      return createWallWithDoors(depth, eastHeight, wallDoors)
    }
    return null
  }, [depth, eastHeight, doors])

  const westWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('west')
    if (wallDoors.length > 0) {
      return createWallWithDoors(depth, westHeight, wallDoors)
    }
    return null
  }, [depth, westHeight, doors])

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (roomId) {
          setHoveredRoomId(roomId)
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={() => {
        setHoveredRoomId(null)
        document.body.style.cursor = 'default'
      }}
    >
      {/* Floor */}
      <mesh
        ref={floorMeshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(e) => handleFloorClick(e)}
        onPointerOver={(e) => handleFloorHover(true, e)}
        onPointerOut={(e) => handleFloorHover(false, e)}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#f5f5f5"
          side={THREE.DoubleSide}
          emissive={getEmissiveColor(isFloorSelectedHere, isFloorHoveredHere)}
          emissiveIntensity={getEmissiveIntensity(isFloorSelectedHere, isFloorHoveredHere)}
        />
      </mesh>

      {/* Floor Measurement Grid */}
      <FloorMeasurementGrid
        width={width}
        depth={depth}
        settings={effectiveGridSettings.floor}
        roomPosition={position}
      />

      {/* Floor Outline when hovered or selected */}
      {(isHovered || isFloorSelectedHere || isFloorHoveredHere) && (
        <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(width, depth)]} />
          <lineBasicMaterial color={isFloorSelectedHere ? "#ffa500" : "#00ffff"} linewidth={3} />
        </lineSegments>
      )}

      {/* Invisible ceiling - for raycasting wall/ceiling mounted items */}
      <mesh
        ref={ceilingRef}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, height, 0]}
        visible={false}
      >
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* South wall (negative Z) - Back wall */}
      {shouldRenderWall('south') && (
        <>
          {southWallGeometry ? (
            <mesh
              ref={southWallRef}
              position={[0, southHeight / 2, -depth / 2]}
              receiveShadow
              onClick={(e) => handleWallClick('south', e)}
              onPointerOver={(e) => handleWallHover('south', true, e)}
              onPointerOut={(e) => handleWallHover('south', false, e)}
            >
              <primitive object={southWallGeometry} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('south'), isWallHoveredFn('south'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('south'), isWallHoveredFn('south'))}
              />
            </mesh>
          ) : (
            <mesh
              ref={southWallRef}
              position={[0, southHeight / 2, -depth / 2]}
              receiveShadow
              onClick={(e) => handleWallClick('south', e)}
              onPointerOver={(e) => handleWallHover('south', true, e)}
              onPointerOut={(e) => handleWallHover('south', false, e)}
            >
              <planeGeometry args={[width, southHeight]} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('south'), isWallHoveredFn('south'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('south'), isWallHoveredFn('south'))}
              />
            </mesh>
          )}

          {/* South wall outline when hovered or selected */}
          {(isHovered || isWallSelectedFn('south') || isWallHoveredFn('south')) && !southWallGeometry && (
            <lineSegments position={[0, southHeight / 2, -depth / 2]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(width, southHeight)]} />
              <lineBasicMaterial color={isWallSelectedFn('south') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* South wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={width}
            wallHeight={southHeight}
            settings={effectiveGridSettings.walls.south}
            wallPosition={[0, 0, -depth / 2 + 0.01]}
            wallRotation={[0, 0, 0]}
          />
        </>
      )}

      {/* North wall (positive Z) - Front wall */}
      {shouldRenderWall('north') && (
        <>
          {northWallGeometry ? (
            <mesh
              ref={northWallRef}
              position={[0, northHeight / 2, depth / 2]}
              receiveShadow
              onClick={(e) => handleWallClick('north', e)}
              onPointerOver={(e) => handleWallHover('north', true, e)}
              onPointerOut={(e) => handleWallHover('north', false, e)}
            >
              <primitive object={northWallGeometry} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('north'), isWallHoveredFn('north'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('north'), isWallHoveredFn('north'))}
              />
            </mesh>
          ) : (
            <mesh
              ref={northWallRef}
              position={[0, northHeight / 2, depth / 2]}
              receiveShadow
              onClick={(e) => handleWallClick('north', e)}
              onPointerOver={(e) => handleWallHover('north', true, e)}
              onPointerOut={(e) => handleWallHover('north', false, e)}
            >
              <planeGeometry args={[width, northHeight]} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('north'), isWallHoveredFn('north'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('north'), isWallHoveredFn('north'))}
              />
            </mesh>
          )}

          {/* North wall outline when hovered or selected */}
          {(isHovered || isWallSelectedFn('north') || isWallHoveredFn('north')) && !northWallGeometry && (
            <lineSegments position={[0, northHeight / 2, depth / 2]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(width, northHeight)]} />
              <lineBasicMaterial color={isWallSelectedFn('north') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* North wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={width}
            wallHeight={northHeight}
            settings={effectiveGridSettings.walls.north}
            wallPosition={[0, 0, depth / 2 - 0.01]}
            wallRotation={[0, Math.PI, 0]}
          />
        </>
      )}

      {/* West wall (negative X) - Left wall */}
      {shouldRenderWall('west') && (
        <>
          {westWallGeometry ? (
            <mesh
              ref={westWallRef}
              position={[-width / 2, westHeight / 2, 0]}
              rotation={[0, Math.PI / 2, 0]}
              receiveShadow
              onClick={(e) => handleWallClick('west', e)}
              onPointerOver={(e) => handleWallHover('west', true, e)}
              onPointerOut={(e) => handleWallHover('west', false, e)}
            >
              <primitive object={westWallGeometry} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('west'), isWallHoveredFn('west'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('west'), isWallHoveredFn('west'))}
              />
            </mesh>
          ) : (
            <mesh
              ref={westWallRef}
              position={[-width / 2, westHeight / 2, 0]}
              rotation={[0, Math.PI / 2, 0]}
              receiveShadow
              onClick={(e) => handleWallClick('west', e)}
              onPointerOver={(e) => handleWallHover('west', true, e)}
              onPointerOut={(e) => handleWallHover('west', false, e)}
            >
              <planeGeometry args={[depth, westHeight]} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('west'), isWallHoveredFn('west'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('west'), isWallHoveredFn('west'))}
              />
            </mesh>
          )}

          {/* West wall outline when hovered or selected */}
          {(isHovered || isWallSelectedFn('west') || isWallHoveredFn('west')) && !westWallGeometry && (
            <lineSegments position={[-width / 2, westHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(depth, westHeight)]} />
              <lineBasicMaterial color={isWallSelectedFn('west') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* West wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={depth}
            wallHeight={westHeight}
            settings={effectiveGridSettings.walls.west}
            wallPosition={[-width / 2 + 0.01, 0, 0]}
            wallRotation={[0, Math.PI / 2, 0]}
          />
        </>
      )}

      {/* East wall (positive X) - Right wall */}
      {shouldRenderWall('east') && (
        <>
          {eastWallGeometry ? (
            <mesh
              ref={eastWallRef}
              position={[width / 2, eastHeight / 2, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              receiveShadow
              onClick={(e) => handleWallClick('east', e)}
              onPointerOver={(e) => handleWallHover('east', true, e)}
              onPointerOut={(e) => handleWallHover('east', false, e)}
            >
              <primitive object={eastWallGeometry} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('east'), isWallHoveredFn('east'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('east'), isWallHoveredFn('east'))}
              />
            </mesh>
          ) : (
            <mesh
              ref={eastWallRef}
              position={[width / 2, eastHeight / 2, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              receiveShadow
              onClick={(e) => handleWallClick('east', e)}
              onPointerOver={(e) => handleWallHover('east', true, e)}
              onPointerOut={(e) => handleWallHover('east', false, e)}
            >
              <planeGeometry args={[depth, eastHeight]} />
              <meshStandardMaterial
                color="#e8e8e8"
                side={THREE.DoubleSide}
                emissive={getEmissiveColor(isWallSelectedFn('east'), isWallHoveredFn('east'))}
                emissiveIntensity={getEmissiveIntensity(isWallSelectedFn('east'), isWallHoveredFn('east'))}
              />
            </mesh>
          )}

          {/* East wall outline when hovered or selected */}
          {(isHovered || isWallSelectedFn('east') || isWallHoveredFn('east')) && !eastWallGeometry && (
            <lineSegments position={[width / 2, eastHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(depth, eastHeight)]} />
              <lineBasicMaterial color={isWallSelectedFn('east') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* East wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={depth}
            wallHeight={eastHeight}
            settings={effectiveGridSettings.walls.east}
            wallPosition={[width / 2 - 0.01, 0, 0]}
            wallRotation={[0, -Math.PI / 2, 0]}
          />
        </>
      )}

      {/* Doors are rendered as cutouts (holes) in wall geometry via createWallWithDoor() */}
      {/* SharedWalls handle door cutouts for shared walls */}
    </group>
  )
}
