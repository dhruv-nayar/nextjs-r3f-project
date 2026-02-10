'use client'

import * as THREE from 'three'
import { useMemo } from 'react'
import { useRoomHover } from '@/lib/room-hover-context'

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
}

function createGridTexture(gridSize: number = 64) {
  const canvas = document.createElement('canvas')
  canvas.width = gridSize
  canvas.height = gridSize
  const ctx = canvas.getContext('2d')!

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, gridSize, gridSize)

  // Black grid lines
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1

  // Draw grid
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, gridSize)
  ctx.moveTo(0, 0)
  ctx.lineTo(gridSize, 0)
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function createWallWithDoor(wallWidth: number, wallHeight: number, doorWidth: number, doorHeight: number, doorPosition: number) {
  const shape = new THREE.Shape()

  // Create outer rectangle (wall)
  shape.moveTo(-wallWidth / 2, 0)
  shape.lineTo(wallWidth / 2, 0)
  shape.lineTo(wallWidth / 2, wallHeight)
  shape.lineTo(-wallWidth / 2, wallHeight)
  shape.lineTo(-wallWidth / 2, 0)

  // Create hole for door (inner rectangle)
  const hole = new THREE.Path()
  const doorX = doorPosition * wallWidth
  const doorY = 0

  hole.moveTo(doorX - doorWidth / 2, doorY)
  hole.lineTo(doorX + doorWidth / 2, doorY)
  hole.lineTo(doorX + doorWidth / 2, doorY + doorHeight)
  hole.lineTo(doorX - doorWidth / 2, doorY + doorHeight)
  hole.lineTo(doorX - doorWidth / 2, doorY)

  shape.holes.push(hole)

  return new THREE.ShapeGeometry(shape)
}

export function Room({ width, height, depth, position = [0, 0, 0], doors = [], roomId }: RoomProps) {
  const gridTexture = useMemo(() => createGridTexture(), [])
  const { hoveredRoomId, setHoveredRoomId } = useRoomHover()
  const isHovered = roomId && hoveredRoomId === roomId

  // Check which walls have doors
  const hasDoorOnWall = (wall: string) => doors.some(door => door.wall === wall)
  const getDoorOnWall = (wall: string) => doors.find(door => door.wall === wall)

  // Create wall geometries with doors
  const northWallGeometry = useMemo(() => {
    const door = getDoorOnWall('north')
    if (door) {
      return createWallWithDoor(width, height, door.width, door.height, door.position)
    }
    return null
  }, [width, height, doors])

  const southWallGeometry = useMemo(() => {
    const door = getDoorOnWall('south')
    if (door) {
      return createWallWithDoor(width, height, door.width, door.height, door.position)
    }
    return null
  }, [width, height, doors])

  const eastWallGeometry = useMemo(() => {
    const door = getDoorOnWall('east')
    if (door) {
      return createWallWithDoor(depth, height, door.width, door.height, door.position)
    }
    return null
  }, [depth, height, doors])

  const westWallGeometry = useMemo(() => {
    const door = getDoorOnWall('west')
    if (door) {
      return createWallWithDoor(depth, height, door.width, door.height, door.position)
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          map={gridTexture}
          map-repeat={[width, depth]}
          side={THREE.DoubleSide}
          emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
          emissiveIntensity={isHovered ? 0.4 : 0}
        />
      </mesh>

      {/* Floor Outline when hovered */}
      {isHovered && (
        <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(width, depth)]} />
          <lineBasicMaterial color="#00ffff" linewidth={3} />
        </lineSegments>
      )}

      {/* No ceiling - removed so we can see inside */}

      {/* South wall (negative Z) - Back wall */}
      {southWallGeometry ? (
        <mesh position={[0, 0, -depth / 2]} receiveShadow>
          <primitive object={southWallGeometry} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[width, height]}
            side={THREE.DoubleSide}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
      ) : (
        <mesh position={[0, height / 2, -depth / 2]} receiveShadow>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[width, height]}
            side={THREE.DoubleSide}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
      )}

      {/* South wall outline when hovered */}
      {isHovered && !southWallGeometry && (
        <lineSegments position={[0, height / 2, -depth / 2]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
          <lineBasicMaterial color="#00ffff" linewidth={2} />
        </lineSegments>
      )}

      {/* North wall (positive Z) - Front wall - partially transparent */}
      {northWallGeometry ? (
        <mesh position={[0, 0, depth / 2]} receiveShadow>
          <primitive object={northWallGeometry} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[width, height]}
            side={THREE.DoubleSide}
            transparent
            opacity={0.3}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.5 : 0}
          />
        </mesh>
      ) : (
        <mesh position={[0, height / 2, depth / 2]} receiveShadow>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[width, height]}
            side={THREE.DoubleSide}
            transparent
            opacity={0.3}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.5 : 0}
          />
        </mesh>
      )}

      {/* North wall outline when hovered */}
      {isHovered && !northWallGeometry && (
        <lineSegments position={[0, height / 2, depth / 2]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
          <lineBasicMaterial color="#00ffff" linewidth={2} />
        </lineSegments>
      )}

      {/* West wall (negative X) - Left wall */}
      {westWallGeometry ? (
        <mesh position={[-width / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <primitive object={westWallGeometry} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[depth, height]}
            side={THREE.DoubleSide}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
      ) : (
        <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[depth, height]} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[depth, height]}
            side={THREE.DoubleSide}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
      )}

      {/* West wall outline when hovered */}
      {isHovered && !westWallGeometry && (
        <lineSegments position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(depth, height)]} />
          <lineBasicMaterial color="#00ffff" linewidth={2} />
        </lineSegments>
      )}

      {/* East wall (positive X) - Right wall */}
      {eastWallGeometry ? (
        <mesh position={[width / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
          <primitive object={eastWallGeometry} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[depth, height]}
            side={THREE.DoubleSide}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
      ) : (
        <mesh position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
          <planeGeometry args={[depth, height]} />
          <meshStandardMaterial
            map={gridTexture}
            map-repeat={[depth, height]}
            side={THREE.DoubleSide}
            emissive={isHovered ? new THREE.Color(0x00ffff) : new THREE.Color(0x000000)}
            emissiveIntensity={isHovered ? 0.3 : 0}
          />
        </mesh>
      )}

      {/* East wall outline when hovered */}
      {isHovered && !eastWallGeometry && (
        <lineSegments position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(depth, height)]} />
          <lineBasicMaterial color="#00ffff" linewidth={2} />
        </lineSegments>
      )}
    </group>
  )
}
