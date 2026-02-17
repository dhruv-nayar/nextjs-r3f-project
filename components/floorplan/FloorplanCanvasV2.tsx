'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  FloorplanVertex,
  FloorplanWallV2,
  FloorplanRoomV2,
  FloorplanDoorV2,
  EditorMode,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PIXELS_PER_FOOT,
  PIXELS_PER_INCH,
  SNAP_DISTANCE,
  GRID_SPACING,
  GRID_DOT_RADIUS,
  GRID_LINE_DASH,
  ROOM_COLORS,
  pixelsToFeet,
  feetToPixels,
  snapToGrid,
  generateId,
} from '@/types/floorplan-v2'
import {
  findNearbyVertex,
  findNearbyWall,
  findNearbyDoor,
  splitWallAtPoint,
  detectRoomFromDrawing,
  getRoomPolygon,
  wallExists,
} from '@/lib/utils/floorplan-geometry'
import { FloorplanToolbar } from './FloorplanToolbar'
import { DoorPropertiesPanel } from './DoorPropertiesPanel'

export interface FloorplanV2Data {
  vertices: FloorplanVertex[]
  walls: FloorplanWallV2[]
  rooms: FloorplanRoomV2[]
}

interface FloorplanCanvasV2Props {
  initialData?: FloorplanV2Data
  onChange?: (data: FloorplanV2Data) => void
}

// Helper: Format feet as "XX'YY\"" (e.g., 12.5 feet -> "12'6\"")
function formatFeetInches(feet: number): string {
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)

  if (inches === 0) {
    return `${wholeFeet}'`
  } else if (inches === 12) {
    return `${wholeFeet + 1}'`
  } else {
    return `${wholeFeet}'${inches}"`
  }
}

export function FloorplanCanvasV2({ initialData, onChange }: FloorplanCanvasV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isInitializedRef = useRef(false)

  // Core data
  const [vertices, setVertices] = useState<FloorplanVertex[]>(initialData?.vertices || [])
  const [walls, setWalls] = useState<FloorplanWallV2[]>(initialData?.walls || [])
  const [rooms, setRooms] = useState<FloorplanRoomV2[]>(initialData?.rooms || [])

  // Editor mode state
  const [editorMode, setEditorMode] = useState<EditorMode>(EditorMode.SELECT)

  // Drawing state (used in DRAW_WALLS mode)
  const [drawingVertexIds, setDrawingVertexIds] = useState<string[]>([])
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Selection state (used in SELECT mode)
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null)
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null)
  const [selectedDoorWallId, setSelectedDoorWallId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Hover state
  const [hoverVertex, setHoverVertex] = useState<FloorplanVertex | null>(null)
  const [hoverWall, setHoverWall] = useState<{
    wall: FloorplanWallV2
    point: { x: number; y: number }
  } | null>(null)
  const [hoverDoor, setHoverDoor] = useState<{
    wall: FloorplanWallV2
    door: FloorplanDoorV2
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

  // Delete a wall and clean up orphaned vertices
  const deleteWall = useCallback((wallId: string) => {
    const wall = walls.find(w => w.id === wallId)
    if (!wall) return

    // Remove wall
    const updatedWalls = walls.filter(w => w.id !== wallId)
    setWalls(updatedWalls)

    // Update rooms (remove rooms that used this wall and now have <3 walls)
    setRooms((prev) =>
      prev
        .map(room => ({
          ...room,
          wallIds: room.wallIds.filter(id => id !== wallId)
        }))
        .filter(room => room.wallIds.length >= 3)
    )

    // Find orphaned vertices (no connected walls)
    const vertexIdsToCheck = [wall.startVertexId, wall.endVertexId]
    const orphanedVertices = vertexIdsToCheck.filter(vId => {
      const hasConnections = updatedWalls.some(
        w => w.startVertexId === vId || w.endVertexId === vId
      )
      return !hasConnections
    })

    // Remove orphaned vertices
    if (orphanedVertices.length > 0) {
      setVertices((prev) => prev.filter(v => !orphanedVertices.includes(v.id)))
    }

    setSelectedWallId(null)
  }, [walls])

  // Delete a door from a wall
  const deleteDoor = useCallback((wallId: string, doorId: string) => {
    setWalls(prev => prev.map(wall => {
      if (wall.id === wallId) {
        return {
          ...wall,
          doors: (wall.doors || []).filter(d => d.id !== doorId)
        }
      }
      return wall
    }))

    setSelectedDoorId(null)
    setSelectedDoorWallId(null)
  }, [])

  // Update door properties (position and/or width)
  const updateDoor = useCallback((
    wallId: string,
    doorId: string,
    updates: { position?: number; width?: number }
  ) => {
    const wall = walls.find(w => w.id === wallId)
    if (!wall) return

    const door = wall.doors?.find(d => d.id === doorId)
    if (!door) return

    // Get wall vertices for validation
    const startV = vertices.find(v => v.id === wall.startVertexId)
    const endV = vertices.find(v => v.id === wall.endVertexId)
    if (!startV || !endV) return

    const dx = endV.x - startV.x
    const dy = endV.y - startV.y
    const wallLength = Math.sqrt(dx * dx + dy * dy)

    // Calculate new door properties
    const newPosition = updates.position !== undefined ? updates.position : door.position
    const newWidth = updates.width !== undefined ? updates.width : door.width

    // Validate position bounds (1 ft margin from corners)
    if (newPosition < 1 || newPosition + newWidth > wallLength - 1) {
      alert('Door does not fit at this position')
      return
    }

    // Check for overlap with other doors
    const otherDoors = (wall.doors || []).filter(d => d.id !== doorId)
    for (const otherDoor of otherDoors) {
      const otherStart = otherDoor.position
      const otherEnd = otherDoor.position + otherDoor.width
      const newStart = newPosition
      const newEnd = newPosition + newWidth

      // Check overlap
      if (!(newEnd < otherStart || newStart > otherEnd)) {
        alert('Door overlaps with another door')
        return
      }
    }

    // Update door
    setWalls(prev => prev.map(w => {
      if (w.id === wallId) {
        return {
          ...w,
          doors: (w.doors || []).map(d => {
            if (d.id === doorId) {
              return { ...d, ...updates }
            }
            return d
          })
        }
      }
      return w
    }))
  }, [walls, vertices])

  // Place a door on a wall (finds wall near click point)
  const placeDoorOnWall = useCallback((clickX: number, clickY: number) => {
    // Find wall near click
    const nearWallResult = findNearbyWall(clickX, clickY, walls, vertices, 0.5)
    if (!nearWallResult) return

    const wall = nearWallResult.wall
    if (!wall) return

    const startV = vertices.find(v => v.id === wall.startVertexId)
    const endV = vertices.find(v => v.id === wall.endVertexId)
    if (!startV || !endV) return

    // Calculate wall length
    const dx = endV.x - startV.x
    const dy = endV.y - startV.y
    const wallLength = Math.sqrt(dx * dx + dy * dy)

    // Project click point onto wall to get position
    const wallDx = endV.x - startV.x
    const wallDy = endV.y - startV.y
    const t = ((clickX - startV.x) * wallDx + (clickY - startV.y) * wallDy) / (wallLength ** 2)
    const positionAlongWall = t * wallLength

    // Default door width
    const doorWidth = 3

    // Clamp position to keep door within wall bounds (1 foot margin from corners)
    const position = Math.max(1, Math.min(wallLength - doorWidth - 1, positionAlongWall - doorWidth / 2))

    // Validate: ensure door fits and doesn't overlap with existing doors
    if (position < 1 || position + doorWidth > wallLength - 1) {
      alert('Door does not fit on this wall')
      return
    }

    // Check for overlapping doors
    const existingDoors = wall.doors || []
    for (const existingDoor of existingDoors) {
      const existingStart = existingDoor.position
      const existingEnd = existingDoor.position + existingDoor.width
      const newStart = position
      const newEnd = position + doorWidth

      // Check overlap
      if (!(newEnd < existingStart || newStart > existingEnd)) {
        alert('Door overlaps with an existing door')
        return
      }
    }

    const newDoor: FloorplanDoorV2 = {
      id: generateId('door'),
      position,
      width: doorWidth,
      height: 7  // Default 7 feet
    }

    // Update wall with new door
    const updatedWalls = walls.map(w => {
      if (w.id === wall.id) {
        return {
          ...w,
          doors: [...(w.doors || []), newDoor]
        }
      }
      return w
    })

    setWalls(updatedWalls)
    // Stay in PLACE_DOORS mode (don't exit)
  }, [walls, vertices])

  // SELECT mode handler - select vertices/doors/walls, no auto-drawing
  const handleSelectClick = useCallback((x: number, y: number) => {
    // Priority: vertices > doors > walls > empty

    // Check for nearby vertex
    const nearVertex = findNearbyVertex(x, y, vertices, SNAP_DISTANCE)
    if (nearVertex) {
      setSelectedVertexId(nearVertex.id)
      setSelectedWallId(null)
      setSelectedDoorId(null)
      setSelectedDoorWallId(null)
      return
    }

    // Check for nearby door
    const nearDoor = findNearbyDoor(x, y, walls, vertices, 0.5)
    if (nearDoor) {
      setSelectedDoorId(nearDoor.door.id)
      setSelectedDoorWallId(nearDoor.wall.id)
      setSelectedVertexId(null)
      setSelectedWallId(null)
      return
    }

    // Check for nearby wall
    const nearWall = findNearbyWall(x, y, walls, vertices, 0.5)
    if (nearWall) {
      setSelectedWallId(nearWall.wall.id)
      setSelectedVertexId(null)
      setSelectedDoorId(null)
      setSelectedDoorWallId(null)
      return
    }

    // Click on empty space - deselect all
    setSelectedVertexId(null)
    setSelectedWallId(null)
    setSelectedDoorId(null)
    setSelectedDoorWallId(null)
  }, [vertices, walls])

  // DRAW_WALLS mode handler - create walls by clicking vertices
  const handleDrawWallsClick = useCallback((x: number, y: number) => {
    // Apply 45-degree snapping if shift is held and we're drawing
    let clickX = x
    let clickY = y
    if (shiftHeld && drawingVertexIds.length > 0) {
      const lastVertexId = drawingVertexIds[drawingVertexIds.length - 1]
      const lastVertex = vertices.find((v) => v.id === lastVertexId)
      if (lastVertex) {
        const snapped = snapTo45Degrees(lastVertex.x, lastVertex.y, x, y)
        clickX = snapped.x
        clickY = snapped.y
      }
    }

    // Check for nearby vertex
    const nearVertex = findNearbyVertex(clickX, clickY, vertices, SNAP_DISTANCE)

    if (drawingVertexIds.length === 0) {
      // START DRAWING - first vertex
      if (nearVertex) {
        setDrawingVertexIds([nearVertex.id])
      } else {
        const newVertex = createVertex(clickX, clickY)
        setDrawingVertexIds([newVertex.id])
      }
      return
    }

    // CONTINUE DRAWING
    const lastVertexId = drawingVertexIds[drawingVertexIds.length - 1]

    if (nearVertex && nearVertex.id !== lastVertexId) {
      // Clicking existing vertex - create wall and check for room
      const { updatedWalls } = createWall(lastVertexId, nearVertex.id, walls)

      // Check if this closes a shape
      if (drawingVertexIds.includes(nearVertex.id)) {
        // Shape closed! Detect and create room
        const roomWallIds = detectRoomFromDrawing(
          drawingVertexIds,
          nearVertex.id,
          updatedWalls
        )
        if (roomWallIds) {
          createRoom(roomWallIds)
        }
        setDrawingVertexIds([])
        // Stay in DRAW_WALLS mode to continue drawing
      } else {
        // Continue from this vertex
        setDrawingVertexIds([...drawingVertexIds, nearVertex.id])
      }
    } else {
      // Check for nearby wall to split
      const nearWallResult = findNearbyWall(clickX, clickY, walls, vertices)
      if (nearWallResult) {
        // Split the wall and continue from the new vertex
        const { newVertex, newWalls, updatedRooms } = splitWallAtPoint(
          nearWallResult.wall,
          nearWallResult.point,
          vertices,
          walls,
          rooms
        )

        setVertices((prev) => [...prev, newVertex])
        const wallsAfterSplit = [
          ...walls.filter((w) => w.id !== nearWallResult.wall.id),
          ...newWalls,
        ]
        setWalls(wallsAfterSplit)
        setRooms(updatedRooms)

        const { wall: newWall } = createWall(lastVertexId, newVertex.id, wallsAfterSplit)
        if (newWall) {
          setDrawingVertexIds([...drawingVertexIds, newVertex.id])
        }
      } else {
        // Create new vertex and wall
        const snappedX = snapToGrid(clickX)
        const snappedY = snapToGrid(clickY)
        const newVertex = createVertex(snappedX, snappedY)
        createWall(lastVertexId, newVertex.id, walls)
        setDrawingVertexIds([...drawingVertexIds, newVertex.id])
      }
    }
  }, [
    vertices,
    walls,
    rooms,
    drawingVertexIds,
    shiftHeld,
    snapTo45Degrees,
    createVertex,
    createWall,
    createRoom
  ])

  // PLACE_DOORS mode handler - click on walls to place doors
  const handlePlaceDoorsClick = useCallback((x: number, y: number) => {
    // Find wall near click
    const nearWall = findNearbyWall(x, y, walls, vertices, 0.5)
    if (nearWall) {
      placeDoorOnWall(x, y)
      // Stay in PLACE_DOORS mode for placing multiple doors
    }
  }, [walls, vertices, placeDoorOnWall])

  // Handle canvas click - route to appropriate mode handler
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e)

      switch (editorMode) {
        case EditorMode.SELECT:
          handleSelectClick(x, y)
          break
        case EditorMode.DRAW_WALLS:
          handleDrawWallsClick(x, y)
          break
        case EditorMode.PLACE_DOORS:
          handlePlaceDoorsClick(x, y)
          break
      }
    },
    [editorMode, getCanvasCoords, handleSelectClick, handleDrawWallsClick, handlePlaceDoorsClick]
  )

  // Handle mouse down (for dragging in SELECT mode)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Only handle dragging in SELECT mode
      if (editorMode !== EditorMode.SELECT) return

      const { x, y } = getCanvasCoords(e)

      // Check for nearby vertex to drag
      const nearVertex = findNearbyVertex(x, y, vertices, SNAP_DISTANCE)
      if (nearVertex) {
        setSelectedVertexId(nearVertex.id)
        setSelectedWallId(null)
        setIsDragging(true)
        e.preventDefault()
      }
    },
    [editorMode, getCanvasCoords, vertices]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      let { x, y } = getCanvasCoords(e)

      // Apply 45-degree snapping for preview if shift is held while drawing
      if (shiftHeld && editorMode === EditorMode.DRAW_WALLS && drawingVertexIds.length > 0) {
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

      // Update hover state (priority: vertices > doors > walls)
      const nearVertex = findNearbyVertex(x, y, vertices, SNAP_DISTANCE)
      setHoverVertex(nearVertex)

      if (!nearVertex) {
        const nearDoor = findNearbyDoor(x, y, walls, vertices, 0.5)
        if (nearDoor) {
          setHoverDoor({ wall: nearDoor.wall, door: nearDoor.door })
          setHoverWall(null)
        } else {
          setHoverDoor(null)
          const nearWallResult = findNearbyWall(x, y, walls, vertices)
          setHoverWall(nearWallResult)
        }
      } else {
        setHoverWall(null)
        setHoverDoor(null)
      }
    },
    [getCanvasCoords, isDragging, selectedVertexId, moveVertex, vertices, walls, shiftHeld, editorMode, drawingVertexIds, snapTo45Degrees]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle mouse leave canvas
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false)
    setHoverVertex(null)
    setHoverWall(null)
    setHoverDoor(null)
  }, [])

  // Handle key press for mode switching and actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Mode switching shortcuts (work in all modes)
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        setEditorMode(EditorMode.SELECT)
        setDrawingVertexIds([])
        return
      }

      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        setEditorMode(EditorMode.DRAW_WALLS)
        setSelectedVertexId(null)
        setSelectedWallId(null)
        return
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        setEditorMode(EditorMode.PLACE_DOORS)
        setDrawingVertexIds([])
        setSelectedVertexId(null)
        setSelectedWallId(null)
        return
      }

      // Escape - cancel current action and return to SELECT
      if (e.key === 'Escape') {
        if (editorMode === EditorMode.DRAW_WALLS) {
          // Cancel current drawing path
          setDrawingVertexIds([])
          setEditorMode(EditorMode.SELECT)
        } else if (editorMode === EditorMode.PLACE_DOORS) {
          // Return to SELECT mode
          setEditorMode(EditorMode.SELECT)
        } else {
          // Already in SELECT mode - just clear selections
          setSelectedVertexId(null)
          setSelectedWallId(null)
          setSelectedDoorId(null)
          setSelectedDoorWallId(null)
        }
      }

      // Delete - only works in SELECT mode
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editorMode === EditorMode.SELECT) {
          if (selectedDoorId && selectedDoorWallId) {
            // Delete selected door
            e.preventDefault()
            deleteDoor(selectedDoorWallId, selectedDoorId)
          } else if (selectedWallId) {
            e.preventDefault()
            deleteWall(selectedWallId)
          } else if (selectedVertexId) {
            e.preventDefault()
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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editorMode, selectedVertexId, selectedWallId, walls, deleteWall])

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

    // Draw grid - dots at every inch
    ctx.fillStyle = '#D0D0D0' // Light gray dots
    for (let x = 0; x <= CANVAS_WIDTH; x += PIXELS_PER_INCH) {
      for (let y = 0; y <= CANVAS_HEIGHT; y += PIXELS_PER_INCH) {
        ctx.beginPath()
        ctx.arc(x, y, GRID_DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw fine lines at every foot (dashed)
    ctx.strokeStyle = '#A0A0A0' // Darker gray
    ctx.lineWidth = 1
    ctx.setLineDash(GRID_LINE_DASH)

    // Vertical foot lines
    for (let x = 0; x <= CANVAS_WIDTH; x += PIXELS_PER_FOOT) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }

    // Horizontal foot lines
    for (let y = 0; y <= CANVAS_HEIGHT; y += PIXELS_PER_FOOT) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    ctx.setLineDash([]) // Reset dash

    // Draw grid labels (every foot)
    ctx.fillStyle = '#999'
    ctx.font = '10px sans-serif'
    for (let ft = 0; ft <= pixelsToFeet(CANVAS_WIDTH); ft += 1) {
      const px = feetToPixels(ft)
      if (ft % 2 === 0) { // Only label even feet to avoid clutter
        ctx.fillText(`${ft}`, px + 2, 12)
      }
    }
    for (let ft = 1; ft <= pixelsToFeet(CANVAS_HEIGHT); ft += 1) {
      const py = feetToPixels(ft)
      if (ft % 2 === 0) { // Only label even feet to avoid clutter
        ctx.fillText(`${ft}`, 2, py - 2)
      }
    }

    // Helper: Calculate polygon area using shoelace formula
    const calculatePolygonArea = (polygon: { x: number; y: number }[]): number => {
      let area = 0
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length
        area += polygon[i].x * polygon[j].y
        area -= polygon[j].x * polygon[i].y
      }
      return Math.abs(area / 2)
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

        // Calculate room area
        const areaSquareFeet = calculatePolygonArea(polygon)

        // Draw room name and dimensions in center
        const centerX =
          polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length
        const centerY =
          polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length

        ctx.fillStyle = '#333'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Room name (larger font)
        ctx.font = 'bold 13px sans-serif'
        ctx.fillText(room.name, feetToPixels(centerX), feetToPixels(centerY) - 8)

        // Room dimensions (smaller, lighter font)
        ctx.font = '11px sans-serif'
        ctx.fillStyle = '#666'
        ctx.fillText(`${areaSquareFeet.toFixed(0)} sq ft`, feetToPixels(centerX), feetToPixels(centerY) + 6)
      }
    }

    // Draw walls (with door gaps if present)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    for (const wall of walls) {
      const start = vertexMap.get(wall.startVertexId)
      const end = vertexMap.get(wall.endVertexId)
      if (!start || !end) continue

      const doors = wall.doors || []
      const dx = end.x - start.x
      const dy = end.y - start.y
      const wallLength = Math.sqrt(dx * dx + dy * dy)

      // Determine wall color
      let strokeColor = '#333'
      let lineWidth = 2
      if (selectedWallId === wall.id) {
        strokeColor = '#FF6B35'
        lineWidth = 4
      } else if (hoverWall?.wall.id === wall.id) {
        strokeColor = '#FF9800'
        lineWidth = 4
      }

      if (doors.length === 0) {
        // Simple wall line (no doors)
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.moveTo(feetToPixels(start.x), feetToPixels(start.y))
        ctx.lineTo(feetToPixels(end.x), feetToPixels(end.y))
        ctx.stroke()
      } else {
        // Wall with door gaps
        const sortedDoors = [...doors].sort((a, b) => a.position - b.position)
        let currentPos = 0

        for (const door of sortedDoors) {
          // Draw wall segment before door
          if (door.position > currentPos) {
            const x1 = start.x + (dx / wallLength) * currentPos
            const y1 = start.y + (dy / wallLength) * currentPos
            const x2 = start.x + (dx / wallLength) * door.position
            const y2 = start.y + (dy / wallLength) * door.position

            ctx.strokeStyle = strokeColor
            ctx.lineWidth = lineWidth
            ctx.beginPath()
            ctx.moveTo(feetToPixels(x1), feetToPixels(y1))
            ctx.lineTo(feetToPixels(x2), feetToPixels(y2))
            ctx.stroke()
          }

          // Draw door symbol (architectural style: door leaf + swing arc)
          const doorStartPos = door.position
          const doorEndPos = door.position + door.width

          // Calculate door opening positions
          const doorStartX = start.x + (dx / wallLength) * doorStartPos
          const doorStartY = start.y + (dy / wallLength) * doorStartPos
          const doorEndX = start.x + (dx / wallLength) * doorEndPos
          const doorEndY = start.y + (dy / wallLength) * doorEndPos

          // Calculate perpendicular direction for door swing
          const perpX = -dy / wallLength
          const perpY = dx / wallLength

          // Determine door colors based on selection and hover
          let doorSwingColor = 'rgba(76, 175, 80, 0.4)'  // Default: semi-transparent green
          let doorLeafColor = '#4CAF50'                   // Default: solid green
          let doorSwingLineWidth = 1
          let doorLeafLineWidth = 2

          if (selectedDoorId === door.id && selectedDoorWallId === wall.id) {
            doorSwingColor = 'rgba(255, 107, 53, 0.6)'   // Selected: semi-transparent orange
            doorLeafColor = '#FF6B35'                      // Selected: solid orange
            doorSwingLineWidth = 2
            doorLeafLineWidth = 3
          } else if (hoverDoor?.door.id === door.id && hoverDoor?.wall.id === wall.id) {
            doorSwingColor = 'rgba(255, 152, 0, 0.5)'    // Hover: semi-transparent orange
            doorLeafColor = '#FF9800'                      // Hover: orange
            doorSwingLineWidth = 1.5
            doorLeafLineWidth = 2.5
          }

          // Draw door swing arc (90 degrees)
          ctx.strokeStyle = doorSwingColor
          ctx.lineWidth = doorSwingLineWidth
          ctx.beginPath()
          ctx.arc(
            feetToPixels(doorStartX),
            feetToPixels(doorStartY),
            feetToPixels(door.width),
            Math.atan2(dy, dx),
            Math.atan2(dy, dx) + Math.PI / 2,
            false
          )
          ctx.stroke()

          // Draw door leaf (solid line showing door position when open)
          const doorLeafEndX = doorStartX + perpX * door.width
          const doorLeafEndY = doorStartY + perpY * door.width

          ctx.strokeStyle = doorLeafColor
          ctx.lineWidth = doorLeafLineWidth
          ctx.beginPath()
          ctx.moveTo(feetToPixels(doorStartX), feetToPixels(doorStartY))
          ctx.lineTo(feetToPixels(doorLeafEndX), feetToPixels(doorLeafEndY))
          ctx.stroke()

          currentPos = door.position + door.width
        }

        // Draw remaining wall after last door
        if (currentPos < wallLength) {
          const x1 = start.x + (dx / wallLength) * currentPos
          const y1 = start.y + (dy / wallLength) * currentPos

          ctx.strokeStyle = strokeColor
          ctx.lineWidth = lineWidth
          ctx.beginPath()
          ctx.moveTo(feetToPixels(x1), feetToPixels(y1))
          ctx.lineTo(feetToPixels(end.x), feetToPixels(end.y))
          ctx.stroke()
        }
      }
    }

    // Draw preview line while in DRAW_WALLS mode
    if (editorMode === EditorMode.DRAW_WALLS && drawingVertexIds.length > 0) {
      const lastVertexId = drawingVertexIds[drawingVertexIds.length - 1]
      const lastVertex = vertexMap.get(lastVertexId)
      if (lastVertex) {
        // Determine preview endpoint (with snapping)
        let previewX = mousePos.x
        let previewY = mousePos.y
        if (hoverVertex) {
          previewX = hoverVertex.x
          previewY = hoverVertex.y
        } else if (hoverWall) {
          previewX = hoverWall.point.x
          previewY = hoverWall.point.y
        }

        // Calculate length
        const dx = previewX - lastVertex.x
        const dy = previewY - lastVertex.y
        const lengthFeet = Math.sqrt(dx * dx + dy * dy)

        // Draw preview line
        ctx.strokeStyle = '#2196F3'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(feetToPixels(lastVertex.x), feetToPixels(lastVertex.y))
        ctx.lineTo(feetToPixels(previewX), feetToPixels(previewY))
        ctx.stroke()
        ctx.setLineDash([])

        // Draw length label at midpoint
        if (lengthFeet > 0.5) { // Only show label if line is long enough
          const midX = (lastVertex.x + previewX) / 2
          const midY = (lastVertex.y + previewY) / 2
          const label = formatFeetInches(lengthFeet)

          ctx.save()
          ctx.font = 'bold 14px sans-serif'
          const metrics = ctx.measureText(label)
          const padding = 6
          const labelX = feetToPixels(midX)
          const labelY = feetToPixels(midY) - 10

          // Background box
          ctx.fillStyle = '#2196F3'
          ctx.fillRect(
            labelX - metrics.width / 2 - padding,
            labelY - 16,
            metrics.width + padding * 2,
            24
          )

          // Text
          ctx.fillStyle = '#FFFFFF'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, labelX, labelY - 4)

          ctx.restore()
        }
      }
    }

    // Draw wall length badge on hover
    if (hoverWall && editorMode === EditorMode.SELECT) {
      const wall = hoverWall.wall
      const start = vertexMap.get(wall.startVertexId)
      const end = vertexMap.get(wall.endVertexId)

      if (start && end) {
        // Calculate wall length
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthFeet = Math.sqrt(dx * dx + dy * dy)

        // Draw length label at midpoint
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2
        const label = formatFeetInches(lengthFeet)

        ctx.save()
        ctx.font = 'bold 14px sans-serif'
        const metrics = ctx.measureText(label)
        const padding = 6
        const labelX = feetToPixels(midX)
        const labelY = feetToPixels(midY) - 10

        // Background box
        ctx.fillStyle = '#FF9800' // Orange for hover
        ctx.fillRect(
          labelX - metrics.width / 2 - padding,
          labelY - 16,
          metrics.width + padding * 2,
          24
        )

        // Text
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, labelX, labelY - 4)

        ctx.restore()
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

    // Draw snap preview point on wall (only in DRAW_WALLS mode)
    if (hoverWall && editorMode === EditorMode.DRAW_WALLS) {
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
    editorMode,
    drawingVertexIds,
    hoverVertex,
    hoverWall,
    hoverDoor,
    selectedVertexId,
    selectedWallId,
    selectedDoorId,
    selectedDoorWallId,
  ])

  // Get selected door data for properties panel
  const selectedDoor = selectedDoorId && selectedDoorWallId
    ? (() => {
        const wall = walls.find(w => w.id === selectedDoorWallId)
        const door = wall?.doors?.find(d => d.id === selectedDoorId)
        return wall && door ? { wall, door } : null
      })()
    : null

  // Get mode-specific status message
  const getStatusMessage = () => {
    switch (editorMode) {
      case EditorMode.SELECT:
        if (selectedVertexId) return 'Vertex selected - Drag to move, Delete to remove'
        if (selectedWallId) return 'Wall selected - Delete to remove'
        if (selectedDoorId) return 'Door selected - Adjust properties or Delete to remove'
        return 'Click objects to select, drag vertices to move'

      case EditorMode.DRAW_WALLS:
        if (drawingVertexIds.length === 0) {
          return 'Click to place first vertex'
        } else {
          return 'Click to continue, click start to close room, Escape to cancel'
        }

      case EditorMode.PLACE_DOORS:
        return 'Click on a wall to place a door'
    }
  }

  // Portal toolbar to sidebar
  const toolbarContainer = typeof document !== 'undefined' ? document.getElementById('floorplan-toolbar-container') : null

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar - rendered in sidebar via portal */}
      {toolbarContainer && createPortal(
        <FloorplanToolbar mode={editorMode} onModeChange={setEditorMode} />,
        toolbarContainer
      )}

      {/* Status bar */}
      <div className="flex items-center gap-4 text-sm">
        <div className="px-3 py-1 rounded bg-blue-100 text-blue-800">
          {getStatusMessage()}
        </div>
        {shiftHeld && editorMode === EditorMode.DRAW_WALLS && (
          <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
            45° snap
          </div>
        )}
        <div className="text-gray-500">
          Rooms: {rooms.length} | Walls: {walls.length} | Vertices:{' '}
          {vertices.length}
        </div>
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
        onMouseLeave={handleMouseLeave}
        className="border border-gray-300 rounded"
        style={{
          cursor: isDragging
            ? 'grabbing'
            : editorMode === EditorMode.DRAW_WALLS || editorMode === EditorMode.PLACE_DOORS
            ? 'crosshair'
            : editorMode === EditorMode.SELECT && (hoverVertex || hoverWall || hoverDoor)
            ? 'pointer'
            : 'default',
        }}
      />

      {/* Door Properties Panel */}
      {selectedDoor && (
        <DoorPropertiesPanel
          door={selectedDoor.door}
          wall={selectedDoor.wall}
          vertices={vertices}
          onUpdate={(updates) => updateDoor(selectedDoor.wall.id, selectedDoor.door.id, updates)}
          onDelete={() => deleteDoor(selectedDoor.wall.id, selectedDoor.door.id)}
          onClose={() => {
            setSelectedDoorId(null)
            setSelectedDoorWallId(null)
          }}
        />
      )}

      {/* Instructions */}
      <div className="text-sm text-gray-500 space-y-1">
        <p><strong>Keyboard Shortcuts:</strong> V = Select, W = Draw Walls, D = Place Doors, Escape = Cancel/Return to Select</p>

        {editorMode === EditorMode.SELECT && (
          <>
            <p><strong>Select:</strong> Click objects to select them (vertices, walls, doors). Drag vertices to move them.</p>
            <p><strong>Delete:</strong> Select an object, then press Delete to remove it.</p>
            <p><strong>Edit Doors:</strong> Click a door to open the properties panel and adjust position/width.</p>
          </>
        )}

        {editorMode === EditorMode.DRAW_WALLS && (
          <>
            <p><strong>Draw:</strong> Click to place vertices. Click an existing vertex to close the shape and create a room.</p>
            <p><strong>Shift:</strong> Hold Shift while drawing to snap lines to 45° angles.</p>
            <p><strong>Shared walls:</strong> Click on an existing vertex to share corners. Click on a wall to split it.</p>
          </>
        )}

        {editorMode === EditorMode.PLACE_DOORS && (
          <>
            <p><strong>Place Doors:</strong> Click on any wall to place a 3-foot door opening.</p>
            <p><strong>Note:</strong> Doors must be at least 1 foot from corners and cannot overlap.</p>
          </>
        )}
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
