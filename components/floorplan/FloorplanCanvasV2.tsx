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
  ViewportState,
  DEFAULT_VIEWPORT,
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_SENSITIVITY,
} from '@/types/floorplan-v2'
import {
  findNearbyVertex,
  findNearbyWall,
  findNearbyDoor,
  splitWallAtPoint,
  detectRoomFromDrawing,
  detectAllRooms,
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

  // Viewport state for infinite canvas pan/zoom
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const viewportRef = useRef<ViewportState>(DEFAULT_VIEWPORT) // Ref for smooth zoom
  const [isPanMode, setIsPanMode] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [viewportStart, setViewportStart] = useState({ x: 0, y: 0 })

  // Keep ref in sync with state
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

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

  // Track shift key and space key (for pan mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true)

      // Space key activates pan mode (Figma-style)
      if (e.code === 'Space' && !e.repeat) {
        // Don't capture if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault() // Prevent page scroll
        setIsPanMode(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(false)

      // Release pan mode when space is released
      if (e.code === 'Space') {
        setIsPanMode(false)
        setIsPanning(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Convert screen pixels to world coordinates (feet)
  const screenToWorld = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const canvasCenterX = canvas.width / 2
    const canvasCenterY = canvas.height / 2

    // Account for any scaling between CSS size and canvas internal size
    const cssScaleX = canvas.width / rect.width
    const cssScaleY = canvas.height / rect.height

    // Screen position relative to canvas center (in canvas pixels)
    const relX = (screenX - rect.left) * cssScaleX - canvasCenterX
    const relY = (screenY - rect.top) * cssScaleY - canvasCenterY

    // Convert to world coordinates (feet)
    // Apply inverse scale and add viewport offset
    const worldX = (relX / (PIXELS_PER_FOOT * viewport.scale)) + viewport.offsetX
    const worldY = (relY / (PIXELS_PER_FOOT * viewport.scale)) + viewport.offsetY

    return { x: worldX, y: worldY }
  }, [viewport])

  // Convert world coordinates (feet) to screen pixels
  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const canvasCenterX = canvas.width / 2
    const canvasCenterY = canvas.height / 2

    // Subtract viewport offset to get relative position
    const relX = worldX - viewport.offsetX
    const relY = worldY - viewport.offsetY

    // Apply scale and translate to screen center
    const screenX = (relX * PIXELS_PER_FOOT * viewport.scale) + canvasCenterX
    const screenY = (relY * PIXELS_PER_FOOT * viewport.scale) + canvasCenterY

    return { x: screenX, y: screenY }
  }, [viewport])

  // Get visible world bounds (in feet)
  const getVisibleBounds = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return { minX: 0, maxX: 30, minY: 0, maxY: 20 }

    const halfWidth = (canvas.width / 2) / (PIXELS_PER_FOOT * viewport.scale)
    const halfHeight = (canvas.height / 2) / (PIXELS_PER_FOOT * viewport.scale)

    return {
      minX: viewport.offsetX - halfWidth,
      maxX: viewport.offsetX + halfWidth,
      minY: viewport.offsetY - halfHeight,
      maxY: viewport.offsetY + halfHeight
    }
  }, [viewport])

  // Handle scroll wheel zoom - uses refs to avoid jittery updates from rapid trackpad events
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number | null = null
    let pendingZoom: { scale: number; offsetX: number; offsetY: number } | null = null

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const currentViewport = viewportRef.current
      const rect = canvas.getBoundingClientRect()
      const canvasCenterX = canvas.width / 2
      const canvasCenterY = canvas.height / 2

      const cssScaleX = canvas.width / rect.width
      const cssScaleY = canvas.height / rect.height

      // Screen position relative to canvas center (in canvas pixels)
      const relX = (e.clientX - rect.left) * cssScaleX - canvasCenterX
      const relY = (e.clientY - rect.top) * cssScaleY - canvasCenterY

      // Get mouse position in world coords BEFORE zoom (using current viewport from ref)
      const mouseWorldX = (relX / (PIXELS_PER_FOOT * currentViewport.scale)) + currentViewport.offsetX
      const mouseWorldY = (relY / (PIXELS_PER_FOOT * currentViewport.scale)) + currentViewport.offsetY

      // Calculate new scale with reduced sensitivity for trackpad
      const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentViewport.scale * (1 + zoomDelta)))

      // New offset to keep mouseWorld under cursor
      const newOffsetX = mouseWorldX - (relX / (PIXELS_PER_FOOT * newScale))
      const newOffsetY = mouseWorldY - (relY / (PIXELS_PER_FOOT * newScale))

      // Store pending zoom to batch with requestAnimationFrame
      pendingZoom = {
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY
      }

      // Update ref immediately for next event calculation
      viewportRef.current = pendingZoom

      // Batch state updates with requestAnimationFrame
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (pendingZoom) {
            setViewport(pendingZoom)
          }
          rafId = null
        })
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, []) // No dependencies - uses refs for current values

  // Get canvas coordinates from mouse event (in feet)
  // Now uses viewport-aware transformation
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
      return screenToWorld(e.clientX, e.clientY)
    },
    [screenToWorld]
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

  // Auto-detect and create rooms for any new closed shapes
  const autoDetectRooms = useCallback((currentWalls: FloorplanWallV2[], currentVertices: FloorplanVertex[]) => {
    // Debug: Log current state
    console.log('[autoDetectRooms] Walls:', currentWalls.length, currentWalls.map(w => ({
      id: w.id.slice(-4),
      from: w.startVertexId.slice(-4),
      to: w.endVertexId.slice(-4)
    })))
    console.log('[autoDetectRooms] Vertices:', currentVertices.length)

    // Detect all closed shapes
    const detectedCycles = detectAllRooms(currentWalls, currentVertices)

    console.log('[autoDetectRooms] Detected cycles:', detectedCycles.length, detectedCycles.map(c => c.map(id => id.slice(-4))))

    if (detectedCycles.length === 0) return

    // Helper to normalize a wall ID array for comparison (sort it)
    const normalizeWallIds = (wallIds: string[]) => [...wallIds].sort().join(',')

    // Get all existing room wall ID sets
    const existingRoomWallSets = new Set(
      rooms.map(room => normalizeWallIds(room.wallIds))
    )

    // Find new cycles that don't already have rooms
    const newCycles = detectedCycles.filter(cycle => {
      const normalizedCycle = normalizeWallIds(cycle)
      return !existingRoomWallSets.has(normalizedCycle)
    })

    // Create rooms for new cycles
    newCycles.forEach(wallIds => {
      createRoom(wallIds)
    })
  }, [rooms, createRoom])

  // Reconcile rooms after wall deletion - removes invalid rooms and creates merged rooms
  const reconcileRooms = useCallback((currentWalls: FloorplanWallV2[], currentVertices: FloorplanVertex[], deletedWallId?: string) => {
    // Helper to normalize a wall ID array for comparison (sort it)
    const normalizeWallIds = (wallIds: string[]) => [...wallIds].sort().join(',')

    // First, remove any rooms that referenced the deleted wall
    let remainingRooms = rooms
    if (deletedWallId) {
      remainingRooms = rooms.filter(room => !room.wallIds.includes(deletedWallId))
      setRooms(remainingRooms)
    }

    // Detect all valid closed shapes from current walls
    const detectedCycles = detectAllRooms(currentWalls, currentVertices)

    // Create a map of existing room wall sets
    const existingRoomWallSets = new Set(
      remainingRooms.map(room => normalizeWallIds(room.wallIds))
    )

    // Find new cycles that don't have rooms yet (e.g., merged rooms)
    const newCycles = detectedCycles.filter(cycle => {
      const normalizedCycle = normalizeWallIds(cycle)
      return !existingRoomWallSets.has(normalizedCycle)
    })

    // Create rooms for new cycles
    newCycles.forEach(wallIds => {
      createRoom(wallIds)
    })
  }, [rooms, createRoom])

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

    // Find orphaned vertices (no connected walls)
    const vertexIdsToCheck = [wall.startVertexId, wall.endVertexId]
    const orphanedVertices = vertexIdsToCheck.filter(vId => {
      const hasConnections = updatedWalls.some(
        w => w.startVertexId === vId || w.endVertexId === vId
      )
      return !hasConnections
    })

    // Remove orphaned vertices
    let updatedVertices = vertices
    if (orphanedVertices.length > 0) {
      updatedVertices = vertices.filter(v => !orphanedVertices.includes(v.id))
      setVertices(updatedVertices)
    }

    // Reconcile rooms: remove invalid rooms, create merged rooms
    reconcileRooms(updatedWalls, updatedVertices, wallId)

    setSelectedWallId(null)
  }, [walls, vertices, reconcileRooms])

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
      // Clicking existing vertex - create wall and auto-detect any closed shapes
      const { updatedWalls } = createWall(lastVertexId, nearVertex.id, walls)

      // Auto-detect any closed shapes formed by this wall
      autoDetectRooms(updatedWalls, vertices)

      // Check if this closes the current drawing path
      if (drawingVertexIds.includes(nearVertex.id)) {
        // Drawing path closed - reset to start fresh
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

        const { wall: newWall, updatedWalls: wallsAfterNewWall } = createWall(lastVertexId, newVertex.id, wallsAfterSplit)
        if (newWall) {
          // Auto-detect any closed shapes formed by this wall
          autoDetectRooms(wallsAfterNewWall, [...vertices, newVertex])
          setDrawingVertexIds([...drawingVertexIds, newVertex.id])
        }
      } else {
        // Create new vertex and wall
        const snappedX = snapToGrid(clickX)
        const snappedY = snapToGrid(clickY)
        const newVertex = createVertex(snappedX, snappedY)
        const { updatedWalls: wallsAfterNewWall } = createWall(lastVertexId, newVertex.id, walls)
        // Auto-detect any closed shapes formed by this wall
        autoDetectRooms(wallsAfterNewWall, [...vertices, newVertex])
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
    createRoom,
    autoDetectRooms
  ])

  // Handle canvas click - route to appropriate mode handler
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Ignore clicks when panning
      if (isPanMode || isPanning) return

      const { x, y } = getCanvasCoords(e)

      switch (editorMode) {
        case EditorMode.SELECT:
          handleSelectClick(x, y)
          break
        case EditorMode.DRAW_WALLS:
          handleDrawWallsClick(x, y)
          break
      }
    },
    [isPanMode, isPanning, editorMode, getCanvasCoords, handleSelectClick, handleDrawWallsClick]
  )

  // Handle mouse down (for dragging in SELECT mode or panning)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Pan mode takes priority
      if (isPanMode) {
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY })
        setViewportStart({ x: viewport.offsetX, y: viewport.offsetY })
        e.preventDefault()
        return
      }

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
    [isPanMode, viewport, editorMode, getCanvasCoords, vertices]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Handle panning - use ref for smoother updates
      if (isPanning && isPanMode) {
        const currentScale = viewportRef.current.scale
        const dx = (e.clientX - panStart.x) / (PIXELS_PER_FOOT * currentScale)
        const dy = (e.clientY - panStart.y) / (PIXELS_PER_FOOT * currentScale)

        const newViewport = {
          scale: currentScale,
          offsetX: viewportStart.x - dx,
          offsetY: viewportStart.y - dy
        }
        viewportRef.current = newViewport
        setViewport(newViewport)
        return
      }

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
    [isPanning, isPanMode, panStart, viewportStart, getCanvasCoords, isDragging, selectedVertexId, moveVertex, vertices, walls, shiftHeld, editorMode, drawingVertexIds, snapTo45Degrees]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
    }
    setIsDragging(false)
  }, [isPanning])

  // Handle mouse leave canvas
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false)
    setIsDragging(false)
    setHoverVertex(null)
    setHoverWall(null)
    setHoverDoor(null)
  }, [])

  // Handle key press for mode switching and actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't process shortcuts when in pan mode (Space held)
      if (isPanMode) return

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

      // Escape - cancel current action and return to SELECT
      if (e.key === 'Escape') {
        if (editorMode === EditorMode.DRAW_WALLS) {
          // Cancel current drawing path
          setDrawingVertexIds([])
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
  }, [isPanMode, editorMode, selectedVertexId, selectedWallId, walls, deleteWall])

  // Notify parent of data changes
  useEffect(() => {
    if (onChange) {
      onChange({ vertices, walls, rooms })
    }
  }, [vertices, walls, rooms, onChange])

  // Canvas rendering with viewport transforms
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear entire canvas
    ctx.fillStyle = '#FAFAFA'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Calculate visible bounds (in feet)
    const bounds = getVisibleBounds()

    // Apply viewport transformation
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(viewport.scale, viewport.scale)
    ctx.translate(-viewport.offsetX * PIXELS_PER_FOOT, -viewport.offsetY * PIXELS_PER_FOOT)

    // Determine grid density based on zoom level
    const showInchDots = viewport.scale >= 0.5

    // Draw grid dots at every inch (only when zoomed in enough)
    if (showInchDots) {
      ctx.fillStyle = '#D0D0D0'
      const inchStep = 1 / 12 // feet
      const startX = Math.floor(bounds.minX * 12) / 12
      const startY = Math.floor(bounds.minY * 12) / 12

      for (let x = startX; x <= bounds.maxX; x += inchStep) {
        for (let y = startY; y <= bounds.maxY; y += inchStep) {
          ctx.beginPath()
          ctx.arc(x * PIXELS_PER_FOOT, y * PIXELS_PER_FOOT, GRID_DOT_RADIUS / viewport.scale, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    // Draw foot lines (dashed)
    ctx.strokeStyle = '#A0A0A0'
    ctx.lineWidth = 1 / viewport.scale
    ctx.setLineDash(GRID_LINE_DASH.map(v => v / viewport.scale))

    const startFootX = Math.floor(bounds.minX)
    const startFootY = Math.floor(bounds.minY)

    // Vertical foot lines
    for (let x = startFootX; x <= bounds.maxX + 1; x++) {
      ctx.beginPath()
      ctx.moveTo(x * PIXELS_PER_FOOT, bounds.minY * PIXELS_PER_FOOT)
      ctx.lineTo(x * PIXELS_PER_FOOT, bounds.maxY * PIXELS_PER_FOOT)
      ctx.stroke()
    }

    // Horizontal foot lines
    for (let y = startFootY; y <= bounds.maxY + 1; y++) {
      ctx.beginPath()
      ctx.moveTo(bounds.minX * PIXELS_PER_FOOT, y * PIXELS_PER_FOOT)
      ctx.lineTo(bounds.maxX * PIXELS_PER_FOOT, y * PIXELS_PER_FOOT)
      ctx.stroke()
    }

    ctx.setLineDash([])

    // Draw grid labels (at appropriate density based on zoom)
    const labelStep = viewport.scale < 0.5 ? 5 : viewport.scale < 1 ? 2 : 1
    ctx.fillStyle = '#999'
    ctx.font = `${10 / viewport.scale}px sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    for (let ft = Math.ceil(bounds.minX / labelStep) * labelStep; ft <= bounds.maxX; ft += labelStep) {
      ctx.fillText(`${ft}`, ft * PIXELS_PER_FOOT + 2, bounds.minY * PIXELS_PER_FOOT + 2)
    }
    ctx.textBaseline = 'bottom'
    for (let ft = Math.ceil(bounds.minY / labelStep) * labelStep; ft <= bounds.maxY; ft += labelStep) {
      ctx.fillText(`${ft}`, bounds.minX * PIXELS_PER_FOOT + 2, ft * PIXELS_PER_FOOT - 2)
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
    console.log('[render] Rooms:', rooms.length, 'Walls:', walls.length, 'Vertices:', vertices.length)
    for (const room of rooms) {
      const polygon = getRoomPolygon(room, walls, vertices)
      console.log(`[render] Room ${room.name}: wallIds=${room.wallIds.map(id => id.slice(-4)).join(',')} polygon=${polygon?.length || 0} points`)
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

        // Room name (larger font) - scaled for zoom
        ctx.font = `bold ${13 / viewport.scale}px sans-serif`
        ctx.fillText(room.name, feetToPixels(centerX), feetToPixels(centerY) - 8 / viewport.scale)

        // Room dimensions (smaller, lighter font) - scaled for zoom
        ctx.font = `${11 / viewport.scale}px sans-serif`
        ctx.fillStyle = '#666'
        ctx.fillText(`${areaSquareFeet.toFixed(0)} sq ft`, feetToPixels(centerX), feetToPixels(centerY) + 6 / viewport.scale)
      }
    }

    // Draw walls (with door gaps if present)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2 / viewport.scale
    for (const wall of walls) {
      const start = vertexMap.get(wall.startVertexId)
      const end = vertexMap.get(wall.endVertexId)
      if (!start || !end) continue

      const doors = wall.doors || []
      const dx = end.x - start.x
      const dy = end.y - start.y
      const wallLength = Math.sqrt(dx * dx + dy * dy)

      // Determine wall color (line widths scaled for zoom)
      let strokeColor = '#333'
      let lineWidth = 2 / viewport.scale
      if (selectedWallId === wall.id) {
        strokeColor = '#FF6B35'
        lineWidth = 4 / viewport.scale
      } else if (hoverWall?.wall.id === wall.id) {
        strokeColor = '#FF9800'
        lineWidth = 4 / viewport.scale
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

          // Determine door colors based on selection and hover (line widths scaled for zoom)
          let doorSwingColor = 'rgba(76, 175, 80, 0.4)'  // Default: semi-transparent green
          let doorLeafColor = '#4CAF50'                   // Default: solid green
          let doorSwingLineWidth = 1 / viewport.scale
          let doorLeafLineWidth = 2 / viewport.scale

          if (selectedDoorId === door.id && selectedDoorWallId === wall.id) {
            doorSwingColor = 'rgba(255, 107, 53, 0.6)'   // Selected: semi-transparent orange
            doorLeafColor = '#FF6B35'                      // Selected: solid orange
            doorSwingLineWidth = 2 / viewport.scale
            doorLeafLineWidth = 3 / viewport.scale
          } else if (hoverDoor?.door.id === door.id && hoverDoor?.wall.id === wall.id) {
            doorSwingColor = 'rgba(255, 152, 0, 0.5)'    // Hover: semi-transparent orange
            doorLeafColor = '#FF9800'                      // Hover: orange
            doorSwingLineWidth = 1.5 / viewport.scale
            doorLeafLineWidth = 2.5 / viewport.scale
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

        // Draw preview line (scaled for zoom)
        ctx.strokeStyle = '#2196F3'
        ctx.lineWidth = 2 / viewport.scale
        ctx.setLineDash([5 / viewport.scale, 5 / viewport.scale])
        ctx.beginPath()
        ctx.moveTo(feetToPixels(lastVertex.x), feetToPixels(lastVertex.y))
        ctx.lineTo(feetToPixels(previewX), feetToPixels(previewY))
        ctx.stroke()
        ctx.setLineDash([])

        // Draw length label at midpoint (scaled for zoom)
        if (lengthFeet > 0.5) { // Only show label if line is long enough
          const midX = (lastVertex.x + previewX) / 2
          const midY = (lastVertex.y + previewY) / 2
          const label = formatFeetInches(lengthFeet)

          ctx.font = `bold ${14 / viewport.scale}px sans-serif`
          const metrics = ctx.measureText(label)
          const padding = 6 / viewport.scale
          const labelX = feetToPixels(midX)
          const labelY = feetToPixels(midY) - 10 / viewport.scale

          // Background box
          ctx.fillStyle = '#2196F3'
          ctx.fillRect(
            labelX - metrics.width / 2 - padding,
            labelY - 16 / viewport.scale,
            metrics.width + padding * 2,
            24 / viewport.scale
          )

          // Text
          ctx.fillStyle = '#FFFFFF'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, labelX, labelY - 4 / viewport.scale)
        }
      }
    }

    // Draw wall length badge on hover (scaled for zoom)
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

        ctx.font = `bold ${14 / viewport.scale}px sans-serif`
        const metrics = ctx.measureText(label)
        const padding = 6 / viewport.scale
        const labelX = feetToPixels(midX)
        const labelY = feetToPixels(midY) - 10 / viewport.scale

        // Background box
        ctx.fillStyle = '#FF9800' // Orange for hover
        ctx.fillRect(
          labelX - metrics.width / 2 - padding,
          labelY - 16 / viewport.scale,
          metrics.width + padding * 2,
          24 / viewport.scale
        )

        // Text
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, labelX, labelY - 4 / viewport.scale)
      }
    }

    // Draw wall length badges while dragging a vertex
    if (isDragging && selectedVertexId) {
      // Find all walls connected to the dragged vertex
      const connectedWalls = walls.filter(
        (w) => w.startVertexId === selectedVertexId || w.endVertexId === selectedVertexId
      )

      for (const wall of connectedWalls) {
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

          ctx.font = `bold ${14 / viewport.scale}px sans-serif`
          const metrics = ctx.measureText(label)
          const padding = 6 / viewport.scale
          const labelX = feetToPixels(midX)
          const labelY = feetToPixels(midY) - 10 / viewport.scale

          // Background box (green for dragging)
          ctx.fillStyle = '#4CAF50'
          ctx.fillRect(
            labelX - metrics.width / 2 - padding,
            labelY - 16 / viewport.scale,
            metrics.width + padding * 2,
            24 / viewport.scale
          )

          // Text
          ctx.fillStyle = '#FFFFFF'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, labelX, labelY - 4 / viewport.scale)
        }
      }
    }

    // Draw vertices (scaled for zoom)
    for (const vertex of vertices) {
      const px = feetToPixels(vertex.x)
      const py = feetToPixels(vertex.y)

      // Determine vertex color (radii scaled for zoom)
      let color = '#333'
      let radius = 4 / viewport.scale
      if (selectedVertexId === vertex.id) {
        color = '#FF5722'
        radius = 6 / viewport.scale
      } else if (hoverVertex?.id === vertex.id) {
        color = '#2196F3'
        radius = 5 / viewport.scale
      } else if (drawingVertexIds.includes(vertex.id)) {
        color = '#4CAF50'
      }

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px, py, radius, 0, Math.PI * 2)
      ctx.fill()

      // White border for visibility
      ctx.strokeStyle = '#FFF'
      ctx.lineWidth = 1 / viewport.scale
      ctx.stroke()
    }

    // Draw snap preview point on wall (only in DRAW_WALLS mode)
    if (hoverWall && editorMode === EditorMode.DRAW_WALLS) {
      ctx.fillStyle = '#FF9800'
      ctx.beginPath()
      ctx.arc(
        feetToPixels(hoverWall.point.x),
        feetToPixels(hoverWall.point.y),
        5 / viewport.scale,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }

    // Restore canvas state (undo viewport transform)
    ctx.restore()
  }, [
    viewport,
    getVisibleBounds,
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
        <div className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
          {Math.round(viewport.scale * 100)}%
        </div>
        {isPanMode && (
          <div className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded">
            Pan mode (Space)
          </div>
        )}
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
          cursor: isPanning
            ? 'grabbing'
            : isPanMode
            ? 'grab'
            : isDragging
            ? 'grabbing'
            : editorMode === EditorMode.DRAW_WALLS
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

    </div>
  )
}
