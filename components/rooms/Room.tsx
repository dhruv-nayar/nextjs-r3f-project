'use client'

import * as THREE from 'three'
import { useMemo, useCallback } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { useRoomHover } from '@/lib/room-hover-context'
import { useSelection } from '@/lib/selection-context'
import { WallSide, RoomGridState, createDefaultRoomGridState } from '@/types/selection'
import { FloorMeasurementGrid, WallMeasurementGrid } from './MeasurementGrid'

interface Door {
  wall: 'north' | 'south' | 'east' | 'west'  // Which wall (north=+Z, south=-Z, east=+X, west=-X)
  position: number  // Position along the wall (-0.5 to 0.5, where 0 is center)
  width: number     // Door width in feet
  height: number    // Door height in feet
}

interface RoomProps {
  width: number   // in feet
  height: number  // in feet
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
  gridSettings?: RoomGridState  // Optional grid overlay settings
}

function createWallWithDoors(
  wallWidth: number,
  wallHeight: number,
  doors: Array<{ width: number; height: number; position: number }>
) {
  const shape = new THREE.Shape()

  // Create outer rectangle (wall)
  shape.moveTo(-wallWidth / 2, 0)
  shape.lineTo(wallWidth / 2, 0)
  shape.lineTo(wallWidth / 2, wallHeight)
  shape.lineTo(-wallWidth / 2, wallHeight)
  shape.lineTo(-wallWidth / 2, 0)

  // Create hole for each door
  doors.forEach(door => {
    const hole = new THREE.Path()
    const doorX = door.position * wallWidth
    const doorY = 0

    hole.moveTo(doorX - door.width / 2, doorY)
    hole.lineTo(doorX + door.width / 2, doorY)
    hole.lineTo(doorX + door.width / 2, doorY + door.height)
    hole.lineTo(doorX - door.width / 2, doorY + door.height)
    hole.lineTo(doorX - door.width / 2, doorY)

    shape.holes.push(hole)
  })

  return new THREE.ShapeGeometry(shape)
}

export function Room({ width, height, depth, position = [0, 0, 0], doors = [], roomId, excludedWalls, gridSettings }: RoomProps) {
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
      selectWall(roomId, side)
    }
  }, [roomId, selectWall])

  const handleFloorClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (roomId) {
      selectFloor(roomId)
    }
  }, [roomId, selectFloor])

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

  // Create wall geometries with doors
  const northWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('north')
    if (wallDoors.length > 0) {
      return createWallWithDoors(width, height, wallDoors)
    }
    return null
  }, [width, height, doors])

  const southWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('south')
    if (wallDoors.length > 0) {
      return createWallWithDoors(width, height, wallDoors)
    }
    return null
  }, [width, height, doors])

  const eastWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('east')
    if (wallDoors.length > 0) {
      return createWallWithDoors(depth, height, wallDoors)
    }
    return null
  }, [depth, height, doors])

  const westWallGeometry = useMemo(() => {
    const wallDoors = getDoorsOnWall('west')
    if (wallDoors.length > 0) {
      return createWallWithDoors(depth, height, wallDoors)
    }
    return null
  }, [depth, height, doors])

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

      {/* No ceiling - removed so we can see inside */}

      {/* South wall (negative Z) - Back wall */}
      {shouldRenderWall('south') && (
        <>
          {southWallGeometry ? (
            <mesh
              position={[0, 0, -depth / 2]}
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
              position={[0, height / 2, -depth / 2]}
              receiveShadow
              onClick={(e) => handleWallClick('south', e)}
              onPointerOver={(e) => handleWallHover('south', true, e)}
              onPointerOut={(e) => handleWallHover('south', false, e)}
            >
              <planeGeometry args={[width, height]} />
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
            <lineSegments position={[0, height / 2, -depth / 2]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
              <lineBasicMaterial color={isWallSelectedFn('south') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* South wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={width}
            wallHeight={height}
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
              position={[0, 0, depth / 2]}
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
              position={[0, height / 2, depth / 2]}
              receiveShadow
              onClick={(e) => handleWallClick('north', e)}
              onPointerOver={(e) => handleWallHover('north', true, e)}
              onPointerOut={(e) => handleWallHover('north', false, e)}
            >
              <planeGeometry args={[width, height]} />
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
            <lineSegments position={[0, height / 2, depth / 2]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
              <lineBasicMaterial color={isWallSelectedFn('north') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* North wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={width}
            wallHeight={height}
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
              position={[-width / 2, 0, 0]}
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
              position={[-width / 2, height / 2, 0]}
              rotation={[0, Math.PI / 2, 0]}
              receiveShadow
              onClick={(e) => handleWallClick('west', e)}
              onPointerOver={(e) => handleWallHover('west', true, e)}
              onPointerOut={(e) => handleWallHover('west', false, e)}
            >
              <planeGeometry args={[depth, height]} />
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
            <lineSegments position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(depth, height)]} />
              <lineBasicMaterial color={isWallSelectedFn('west') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* West wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={depth}
            wallHeight={height}
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
              position={[width / 2, 0, 0]}
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
              position={[width / 2, height / 2, 0]}
              rotation={[0, -Math.PI / 2, 0]}
              receiveShadow
              onClick={(e) => handleWallClick('east', e)}
              onPointerOver={(e) => handleWallHover('east', true, e)}
              onPointerOut={(e) => handleWallHover('east', false, e)}
            >
              <planeGeometry args={[depth, height]} />
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
            <lineSegments position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <edgesGeometry args={[new THREE.PlaneGeometry(depth, height)]} />
              <lineBasicMaterial color={isWallSelectedFn('east') ? "#ffa500" : "#00ffff"} linewidth={2} />
            </lineSegments>
          )}

          {/* East wall Measurement Grid */}
          <WallMeasurementGrid
            wallWidth={depth}
            wallHeight={height}
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
