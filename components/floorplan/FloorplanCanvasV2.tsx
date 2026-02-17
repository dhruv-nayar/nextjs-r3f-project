'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  FloorplanVertex,
  FloorplanWallV2,
  FloorplanRoomV2,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PIXELS_PER_FOOT,
  SNAP_DISTANCE,
  GRID_SPACING,
  ROOM_COLORS,
  pixelsToFeet,
  feetToPixels,
  snapToGrid,
  generateId,
} from '@/types/floorplan-v2'
import {
  findNearbyVertex,
  findNearbyWall,
  splitWallAtPoint,
  detectRoomFromDrawing,
  getRoomPolygon,
  wallExists,
} from '@/lib/utils/floorplan-geometry'

export interface FloorplanV2Data {
  vertices: FloorplanVertex[]
  walls: FloorplanWallV2[]
  rooms: FloorplanRoomV2[]
}

interface FloorplanCanvasV2Props {
  initialData?: FloorplanV2Data
  onChange?: (data: FloorplanV2Data) => void
}

export function FloorplanCanvasV2({ initialData, onChange }: FloorplanCanvasV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isInitializedRef = useRef(false)

  // Core data
  const [vertices, setVertices] = useState<FloorplanVertex[]>(initialData?.vertices || [])
  const [walls, setWalls] = useState<FloorplanWallV2[]>(initialData?.walls || [])
  const [rooms, setRooms] = useState<FloorplanRoomV2[]>(initialData?.rooms || [])

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingVertexIds, setDrawingVertexIds] = useState<string[]>([])
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Edit state
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Hover state
  const [hoverVertex, setHoverVertex] = useState<FloorplanVertex | null>(null)
  const [hoverWall, setHoverWall] = useState<{
    wall: FloorplanWallV2
    point: { x: number; y: number }
  } | null>(null)

  // Room counter for naming
  const roomCounterRef = useRef(1)

  // Track shift key state for 45-degree snapping
  const [shiftHeld, setShiftHeld] = useState(false)

  // Initialize from initialData when it changes
  useEffect(() => {
    if (initialData && !isInitializedRef.current) {
      setVertices(initialData.vertices || [])
      setWalls(initialData.walls || [])
      setRooms(initialData.rooms || [])
      // Set room counter to continue from existing rooms
      const maxRoomNum = (initialData.rooms || []).reduce((max, room) => {
        const match = room.name.match(/Room (\d+)/)
        if (match) {
          return Math.max(max, parseInt(match[1], 10))
        }
        return max
      }, 0)
      roomCounterRef.current = maxRoomNum + 1
      isInitializedRef.current = true
    }
  }, [initialData])

  // Track shift key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Get canvas coordinates from mouse event (in feet)
  // Accounts for CSS scaling vs canvas internal resolution
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      // Account for any scaling between CSS size and canvas internal size
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height

      const px = (e.clientX - rect.left) * scaleX
      const py = (e.clientY - rect.top) * scaleY

      return {
        x: pixelsToFeet(px),
        y: pixelsToFeet(py),
      }
    },
    []
  )

  // Snap point to nearest 45-degree angle from origin point
  const snapTo45Degrees = useCallback(
    (originX: number, originY: number, targetX: number, targetY: number): { x: number; y: number } => {
      const dx = targetX - originX
      const dy = targetY - originY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < 0.1) return { x: targetX, y: targetY }

      // Get angle and snap to nearest 45 degrees
      const angle = Math.atan2(dy, dx)
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)

      return {
        x: originX + distance * Math.cos(snappedAngle),
        y: originY + distance * Math.sin(snappedAngle),
      }
    },
    []
  )

  // Create a new vertex
  const createVertex = useCallback((x: number, y: number): FloorplanVertex => {
    const vertex: FloorplanVertex = {
      id: generateId('vertex'),
      x: snapToGrid(x),
      y: snapToGrid(y),
    }
    setVertices((prev) => [...prev, vertex])
    return vertex
  }, [])

  // Create a new wall between two vertices
  // Returns the wall AND the updated walls array (for immediate use before state updates)
  const createWall = useCallback(
    (startVertexId: string, endVertexId: string, currentWalls: FloorplanWallV2[]): { wall: FloorplanWallV2 | null; updatedWalls: FloorplanWallV2[] } => {
      // Check if wall already exists
      if (wallExists(startVertexId, endVertexId, currentWalls)) {
        return { wall: null, updatedWalls: currentWalls }
      }

      const wall: FloorplanWallV2 = {
        id: generateId('wall'),
        startVertexId,
        endVertexId,
      }
      const updatedWalls = [...currentWalls, wall]
      setWalls(updatedWalls)
      return { wall, updatedWalls }
    },
    []
  )

  // Create a new room from wall IDs
  const createRoom = useCallback((wallIds: string[]) => {
    const room: FloorplanRoomV2 = {
      id: generateId('room'),
      name: `Room ${roomCounterRef.current++}`,
      wallIds,
      color: ROOM_COLORS[(rooms.length) % ROOM_COLORS.length],
    }
    setRooms((prev) => [...prev, room])
    return room
  }, [rooms.length])

  // Move a vertex (updates in place)
  const moveVertex = useCallback((vertexId: string, x: number, y: number) => {
    setVertices((prev) =>
      prev.map((v) =>
        v.id === vertexId ? { ...v, x: snapToGrid(x), y: snapToGrid(y) } : v
      )
    )
  }, [])

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      let { x, y } = getCanvasCoords(e)

      // Apply 45-degree snapping if shift is held and we're drawing
      if (shiftHeld && isDrawing && drawingVertexIds.length > 0) {
        const lastVertexId = drawingVertexIds[drawingVertexIds.length - 1]
        const lastVertex = vertices.find((v) => v.id === lastVertexId)
        if (lastVertex) {
          const snapped = snapTo45Degrees(lastVertex.x, lastVertex.y, x, y)
          x = snapped.x
          y = snapped.y
        }
      }

      // Check for nearby vertex first
      const nearVertex = findNearbyVertex(x, y, vertices, SNAP_DISTANCE)

      if (!isDrawing) {
        // START DRAWING
        if (nearVertex) {
          // Start from existing vertex
          setDrawingVertexIds([nearVertex.id])
        } else {
          // Create new vertex
          const newVertex = createVertex(x, y)
          setDrawingVertexIds([newVertex.id])
        }
        setIsDrawing(true)
        return
      }

      // CONTINUE DRAWING
      const lastVertexId = drawingVertexIds[drawingVertexIds.length - 1]

      if (nearVertex && nearVertex.id !== lastVertexId) {
        // Clicking existing vertex - create wall and check for room
        // Use updated walls array for room detection (state hasn't updated yet)
        const { updatedWalls } = createWall(lastVertexId, nearVertex.id, walls)

        // Check if this closes a shape (vertex is in our drawing path)
        if (drawingVertexIds.includes(nearVertex.id)) {
          // Shape closed! Detect room using the UPDATED walls array
          const roomWallIds = detectRoomFromDrawing(
            drawingVertexIds,
            nearVertex.id,
            updatedWalls
          )
          if (roomWallIds) {
            createRoom(roomWallIds)
          }
          setIsDrawing(false)
          setDrawingVertexIds([])
        } else {
          // Continue from this vertex (branch off)
          setDrawingVertexIds([...drawingVertexIds, nearVertex.id])
        }
      } else {
        // Check for nearby wall to split
        const nearWallResult = findNearbyWall(x, y, walls, vertices)
        if (nearWallResult) {
          // Split the wall and continue from the new vertex
          const { newVertex, newWalls, updatedRooms } = splitWallAtPoint(
            nearWallResult.wall,
            nearWallResult.point,
            vertices,
            walls,
            rooms
          )

          // Update state
          setVertices((prev) => [...prev, newVertex])
          const wallsAfterSplit = [
            ...walls.filter((w) => w.id !== nearWallResult.wall.id),
            ...newWalls,
          ]
          setWalls(wallsAfterSplit)
          setRooms(updatedRooms)

          // Create wall from last vertex to new split point
          const { wall: newWall } = createWall(lastVertexId, newVertex.id, wallsAfterSplit)
          if (newWall) {
            setDrawingVertexIds([...drawingVertexIds, newVertex.id])
          }
        } else {
          // Create new vertex and wall (apply grid snap)
          const snappedX = snapToGrid(x)
          const snappedY = snapToGrid(y)
          const newVertex = createVertex(snappedX, snappedY)
          createWall(lastVertexId, newVertex.id, walls)
          setDrawingVertexIds([...drawingVertexIds, newVertex.id])
        }
      }
    },
    [
      getCanvasCoords,
      vertices,
      isDrawing,
      drawingVertexIds,
      walls,
      rooms,
      shiftHeld,
      snapTo45Degrees,
      createVertex,
      createWall,
      createRoom,
    ]
  )

  // Handle mouse down (for dragging)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDrawing) return

      const { x, y } = getCanvasCoords(e)
      const nearVertex = findNearbyVertex(x, y, vertices, SNAP_DISTANCE)

      if (nearVertex) {
        setSelectedVertexId(nearVertex.id)
        setIsDragging(true)
        e.preventDefault()
      }
    },
    [isDrawing, getCanvasCoords, vertices]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      let { x, y } = getCanvasCoords(e)

      // Apply 45-degree snapping for preview if shift is held while drawing
      if (shiftHeld && isDrawing && drawingVertexIds.length > 0) {
        const lastVertexId = drawingVertexIds[drawingVertexIds.length - 1]
        const lastVertex = vertices.find((v) => v.id === lastVertexId)
        if (lastVertex) {
          const snapped = snapTo45Degrees(lastVertex.x, lastVertex.y, x, y)
          x = snapped.x
          y = snapped.y
        }
      }

      setMousePos({ x, y })

      if (isDragging && selectedVertexId) {
        moveVertex(selectedVertexId, x, y)
        return
      }

      // Update hover state
      const nearVertex = findNearbyVertex(x, y, vertices, SNAP_DISTANCE)
      setHoverVertex(nearVertex)

      if (!nearVertex) {
        const nearWallResult = findNearbyWall(x, y, walls, vertices)
        setHoverWall(nearWallResult)
      } else {
        setHoverWall(null)
      }
    },
    [getCanvasCoords, isDragging, selectedVertexId, moveVertex, vertices, walls, shiftHeld, isDrawing, drawingVertexIds, snapTo45Degrees]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle key press (Escape to cancel, Delete to remove)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDrawing) {
          // Cancel drawing - remove any orphan vertices/walls created during this drawing session
          // For simplicity, just reset drawing state (walls remain)
          setIsDrawing(false)
          setDrawingVertexIds([])
        }
        setSelectedVertexId(null)
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedVertexId && !isDrawing) {
          // Delete selected vertex and connected walls
          const connectedWallIds = walls
            .filter(
              (w) =>
                w.startVertexId === selectedVertexId ||
                w.endVertexId === selectedVertexId
            )
            .map((w) => w.id)

          // Remove walls
          setWalls((prev) => prev.filter((w) => !connectedWallIds.includes(w.id)))

          // Remove vertex
          setVertices((prev) => prev.filter((v) => v.id !== selectedVertexId))

          // Update rooms that used these walls
          setRooms((prev) =>
            prev
              .map((room) => ({
                ...room,
                wallIds: room.wallIds.filter((id) => !connectedWallIds.includes(id)),
              }))
              .filter((room) => room.wallIds.length >= 3)
          )

          setSelectedVertexId(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawing, selectedVertexId, walls])

  // Notify parent of data changes
  useEffect(() => {
    if (onChange) {
      onChange({ vertices, walls, rooms })
    }
  }, [vertices, walls, rooms, onChange])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#FAFAFA'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 1
    const gridPx = feetToPixels(GRID_SPACING)
    for (let x = 0; x <= CANVAS_WIDTH; x += gridPx) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 0; y <= CANVAS_HEIGHT; y += gridPx) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    // Draw grid labels (every 2 feet)
    ctx.fillStyle = '#999'
    ctx.font = '10px sans-serif'
    for (let ft = 0; ft <= pixelsToFeet(CANVAS_WIDTH); ft += GRID_SPACING) {
      const px = feetToPixels(ft)
      ctx.fillText(`${ft}`, px + 2, 12)
    }
    for (let ft = GRID_SPACING; ft <= pixelsToFeet(CANVAS_HEIGHT); ft += GRID_SPACING) {
      const py = feetToPixels(ft)
      ctx.fillText(`${ft}`, 2, py - 2)
    }

    // Draw room fills
    const vertexMap = new Map(vertices.map((v) => [v.id, v]))
    for (const room of rooms) {
      const polygon = getRoomPolygon(room, walls, vertices)
      if (polygon && polygon.length >= 3) {
        ctx.fillStyle = room.color
        ctx.beginPath()
        ctx.moveTo(feetToPixels(polygon[0].x), feetToPixels(polygon[0].y))
        for (let i = 1; i < polygon.length; i++) {
          ctx.lineTo(feetToPixels(polygon[i].x), feetToPixels(polygon[i].y))
        }
        ctx.closePath()
        ctx.fill()

        // Draw room name in center
        const centerX =
          polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length
        const centerY =
          polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length
        ctx.fillStyle = '#333'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(room.name, feetToPixels(centerX), feetToPixels(centerY))
      }
    }

    // Draw walls
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    for (const wall of walls) {
      const start = vertexMap.get(wall.startVertexId)
      const end = vertexMap.get(wall.endVertexId)
      if (!start || !end) continue

      // Highlight hovered wall
      if (hoverWall?.wall.id === wall.id) {
        ctx.strokeStyle = '#FF9800'
        ctx.lineWidth = 4
      } else {
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
      }

      ctx.beginPath()
      ctx.moveTo(feetToPixels(start.x), feetToPixels(start.y))
      ctx.lineTo(feetToPixels(end.x), feetToPixels(end.y))
      ctx.stroke()
    }

    // Draw preview line while drawing
    if (isDrawing && drawingVertexIds.length > 0) {
      const lastVertexId = drawingVertexIds[drawingVertexIds.length - 1]
      const lastVertex = vertexMap.get(lastVertexId)
      if (lastVertex) {
        ctx.strokeStyle = '#2196F3'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(feetToPixels(lastVertex.x), feetToPixels(lastVertex.y))

        // Snap to nearby vertex or wall for preview
        if (hoverVertex) {
          ctx.lineTo(feetToPixels(hoverVertex.x), feetToPixels(hoverVertex.y))
        } else if (hoverWall) {
          ctx.lineTo(
            feetToPixels(hoverWall.point.x),
            feetToPixels(hoverWall.point.y)
          )
        } else {
          ctx.lineTo(feetToPixels(mousePos.x), feetToPixels(mousePos.y))
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Draw vertices
    for (const vertex of vertices) {
      const px = feetToPixels(vertex.x)
      const py = feetToPixels(vertex.y)

      // Determine vertex color
      let color = '#333'
      let radius = 4
      if (selectedVertexId === vertex.id) {
        color = '#FF5722'
        radius = 6
      } else if (hoverVertex?.id === vertex.id) {
        color = '#2196F3'
        radius = 5
      } else if (drawingVertexIds.includes(vertex.id)) {
        color = '#4CAF50'
      }

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()

      // White border for visibility
      ctx.strokeStyle = '#FFF'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Draw snap preview point on wall
    if (hoverWall && isDrawing) {
      ctx.fillStyle = '#FF9800'
      ctx.beginPath()
      ctx.arc(
        feetToPixels(hoverWall.point.x),
        feetToPixels(hoverWall.point.y),
        5,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }
  }, [
    vertices,
    walls,
    rooms,
    mousePos,
    isDrawing,
    drawingVertexIds,
    hoverVertex,
    hoverWall,
    selectedVertexId,
  ])

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center gap-4 text-sm">
        <div
          className={`px-3 py-1 rounded ${
            isDrawing
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {isDrawing ? 'Drawing...' : 'Click to start drawing'}
        </div>
        {shiftHeld && isDrawing && (
          <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
            45° snap
          </div>
        )}
        <div className="text-gray-500">
          Rooms: {rooms.length} | Walls: {walls.length} | Vertices:{' '}
          {vertices.length}
        </div>
        {selectedVertexId && (
          <div className="text-orange-600">
            Vertex selected - press Delete to remove
          </div>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="border border-gray-300 rounded cursor-crosshair"
        style={{ cursor: isDragging ? 'grabbing' : isDrawing ? 'crosshair' : 'default' }}
      />

      {/* Instructions */}
      <div className="text-sm text-gray-500 space-y-1">
        <p>
          <strong>Draw:</strong> Click to place vertices. Click an existing
          vertex to close the shape and create a room.
        </p>
        <p>
          <strong>Shift:</strong> Hold Shift while drawing to snap lines to 45° angles.
        </p>
        <p>
          <strong>Shared walls:</strong> Click on an existing vertex to share
          corners. Click on a wall to split it.
        </p>
        <p>
          <strong>Edit:</strong> Click and drag vertices to move them. Press
          Delete to remove.
        </p>
        <p>
          <strong>Cancel:</strong> Press Escape to cancel drawing.
        </p>
      </div>

      {/* Room list */}
      {rooms.length > 0 && (
        <div className="border border-gray-200 rounded p-3">
          <h3 className="font-medium mb-2">Rooms</h3>
          <div className="space-y-1">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center gap-2 text-sm"
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: room.color }}
                />
                <span>{room.name}</span>
                <span className="text-gray-400">
                  ({room.wallIds.length} walls)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
