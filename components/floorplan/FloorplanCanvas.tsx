'use client'

import { useEffect, useRef, useState } from 'react'
import { Canvas as FabricCanvas, Rect, Text, Line, Image as FabricImage, TEvent, Group } from 'fabric'
import { useFloorplan } from '@/lib/contexts/floorplan-context'
import { FloorplanRoom, FloorplanDoor, Point2D } from '@/types/floorplan'
import {
  createRoomRect,
  createDoorMarker,
  setupZoomPan,
  updateRoomRect,
  updateRoomLabel,
  fabricRectToRoom,
  getObjectById,
  clearCanvas,
  createReferenceImage
} from '@/lib/floorplan/fabric-utils'
import { detectWallClick, getClosestValidPosition } from '@/lib/floorplan/wall-detection'

const PIXELS_PER_FOOT = 10
const SNAP_THRESHOLD = 20 // pixels (2 feet)
const WALL_TOLERANCE = 0.2 // feet tolerance for shared wall detection (same as converter)

interface FloorplanCanvasProps {
  width?: number
  height?: number
}

/**
 * Find rooms that share a wall with the given room at the door position
 */
function findSharedWallRooms(
  room: FloorplanRoom,
  wallSide: import('@/types/floorplan').WallSide,
  doorPosition: number,
  doorWidth: number,
  allRooms: FloorplanRoom[]
): Array<{ room: FloorplanRoom, wallSide: import('@/types/floorplan').WallSide, position: number }> {
  const sharedRooms: Array<{ room: FloorplanRoom, wallSide: import('@/types/floorplan').WallSide, position: number }> = []

  // Calculate the door's absolute position on the wall
  let doorStartX: number, doorEndX: number, doorStartY: number, doorEndY: number

  switch (wallSide) {
    case 'top':
      doorStartX = room.x + doorPosition
      doorEndX = doorStartX + doorWidth
      doorStartY = doorEndY = room.y
      break
    case 'bottom':
      doorStartX = room.x + doorPosition
      doorEndX = doorStartX + doorWidth
      doorStartY = doorEndY = room.y + room.height
      break
    case 'left':
      doorStartX = doorEndX = room.x
      doorStartY = room.y + doorPosition
      doorEndY = doorStartY + doorWidth
      break
    case 'right':
      doorStartX = doorEndX = room.x + room.width
      doorStartY = room.y + doorPosition
      doorEndY = doorStartY + doorWidth
      break
  }

  console.log('[findSharedWallRooms] Door absolute coordinates:', {
    wallSide,
    doorPosition,
    doorStartX,
    doorEndX,
    doorStartY,
    doorEndY
  })

  // Check all other rooms
  allRooms.forEach(otherRoom => {
    if (otherRoom.id === room.id) return

    // Check if any wall of the other room shares the door position
    const checks = [
      {
        // Other room's top wall = our bottom wall
        condition: wallSide === 'bottom' &&
                  Math.abs(otherRoom.y - (room.y + room.height)) < WALL_TOLERANCE &&
                  doorStartX < (otherRoom.x + otherRoom.width) && doorEndX > otherRoom.x,
        wallSide: 'top' as const,
        position: doorStartX - otherRoom.x
      },
      {
        // Other room's bottom wall = our top wall
        condition: wallSide === 'top' &&
                  Math.abs((otherRoom.y + otherRoom.height) - room.y) < WALL_TOLERANCE &&
                  doorStartX < (otherRoom.x + otherRoom.width) && doorEndX > otherRoom.x,
        wallSide: 'bottom' as const,
        position: doorStartX - otherRoom.x
      },
      {
        // Other room's left wall = our right wall
        condition: wallSide === 'right' &&
                  Math.abs(otherRoom.x - (room.x + room.width)) < WALL_TOLERANCE &&
                  doorStartY < (otherRoom.y + otherRoom.height) && doorEndY > otherRoom.y,
        wallSide: 'left' as const,
        position: doorStartY - otherRoom.y
      },
      {
        // Other room's right wall = our left wall
        condition: wallSide === 'left' &&
                  Math.abs((otherRoom.x + otherRoom.width) - room.x) < WALL_TOLERANCE &&
                  doorStartY < (otherRoom.y + otherRoom.height) && doorEndY > otherRoom.y,
        wallSide: 'right' as const,
        position: doorStartY - otherRoom.y
      }
    ]

    checks.forEach(check => {
      if (check.condition) {
        console.log('[findSharedWallRooms] Found shared room:', {
          otherRoomId: otherRoom.id,
          otherRoomName: otherRoom.name,
          otherRoomPosition: { x: otherRoom.x, y: otherRoom.y },
          otherRoomSize: { width: otherRoom.width, height: otherRoom.height },
          calculatedWallSide: check.wallSide,
          calculatedPosition: check.position,
          calculation: `${check.wallSide === 'top' || check.wallSide === 'bottom' ? 'doorStartX' : 'doorStartY'} - otherRoom.${check.wallSide === 'top' || check.wallSide === 'bottom' ? 'x' : 'y'} = ${check.wallSide === 'top' || check.wallSide === 'bottom' ? doorStartX : doorStartY} - ${check.wallSide === 'top' || check.wallSide === 'bottom' ? otherRoom.x : otherRoom.y} = ${check.position}`
        })
        sharedRooms.push({
          room: otherRoom,
          wallSide: check.wallSide,
          position: check.position
        })
      }
    })
  })

  return sharedRooms
}

export function FloorplanCanvas({ width = 800, height = 600 }: FloorplanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<FabricCanvas | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStartPoint, setDrawStartPoint] = useState<Point2D | null>(null)
  const [tempRect, setTempRect] = useState<Rect | null>(null)
  const isModifyingRef = useRef(false)
  const snapGuideLinesRef = useRef<Line[]>([])
  const wallHighlightRef = useRef<Line | null>(null)

  const {
    floorplanData,
    selectedRoomId,
    selectedDoorId,
    activeTool,
    addRoom,
    updateRoom,
    selectRoom,
    addDoor,
    selectDoor,
    getRoom,
    setActiveTool,
    updateReferenceImage
  } = useFloorplan()

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new FabricCanvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#F7F5F2',
      selection: activeTool === 'select'
    })

    fabricCanvasRef.current = canvas

    // Setup zoom and pan
    setupZoomPan(canvas)

    // Cleanup
    return () => {
      canvas.dispose()
      fabricCanvasRef.current = null
    }
  }, [width, height])

  // Update canvas selection mode based on active tool
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Clear any active drawing state when switching tools
    if (activeTool !== 'drawRoom' && tempRect) {
      canvas.remove(tempRect)
      setIsDrawing(false)
      setDrawStartPoint(null)
      setTempRect(null)
    }

    // Clear wall highlight when switching away from placeDoor
    if (activeTool !== 'placeDoor' && wallHighlightRef.current) {
      canvas.remove(wallHighlightRef.current)
      wallHighlightRef.current = null
    }

    canvas.selection = activeTool === 'select'
    canvas.defaultCursor = getCursorForTool(activeTool)

    // Make all objects selectable/unselectable based on tool
    const objects = canvas.getObjects()
    objects.forEach(obj => {
      const objectType = obj.get('objectType')
      if (objectType === 'room' || objectType === 'door') {
        obj.set({
          selectable: activeTool === 'select',
          evented: activeTool === 'select',
          hasControls: activeTool === 'select',
          hasBorders: activeTool === 'select'
        })
      }
    })

    canvas.requestRenderAll()
  }, [activeTool, tempRect])

  // Also update selectability when floorplanData changes (after new rooms are added)
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Small delay to ensure objects are fully added to canvas
    const timeoutId = setTimeout(() => {
      canvas.getObjects().forEach(obj => {
        const objectType = obj.get('objectType')
        if (objectType === 'room' || objectType === 'door') {
          obj.set({
            selectable: activeTool === 'select',
            evented: activeTool === 'select',
            hasControls: activeTool === 'select',
            hasBorders: activeTool === 'select'
          })
        }
      })
      canvas.requestRenderAll()
    }, 10)

    return () => clearTimeout(timeoutId)
  }, [floorplanData, activeTool])

  // Render rooms and doors (only when data changes, NOT when selection changes)
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas || !floorplanData) return

    // Skip re-render if currently modifying objects (dragging/resizing)
    // But allow initial render
    if (isModifyingRef.current && canvas.getObjects().length > 0) {
      return
    }

    // Clear canvas
    clearCanvas(canvas)

    // Render reference image first (background)
    if (floorplanData.referenceImage) {
      createReferenceImage(
        floorplanData.referenceImage.url,
        floorplanData.referenceImage.x,
        floorplanData.referenceImage.y,
        floorplanData.referenceImage.width,
        floorplanData.referenceImage.height,
        floorplanData.referenceImage.opacity,
        floorplanData.referenceImage.scale,
        floorplanData.referenceImage.locked,
        PIXELS_PER_FOOT,
        floorplanData.referenceImage.rotation || 0
      ).then(img => {
        canvas.add(img)
        // Send to back - use sendObjectToBack if available, otherwise use insertAt
        if ('sendObjectToBack' in canvas) {
          (canvas as any).sendObjectToBack(img)
        } else {
          // Move to index 0 (back)
          canvas.remove(img)
          canvas.insertAt(0, img)
        }
        canvas.renderAll()
      }).catch(err => {
        console.error('Failed to load reference image:', err)
      })
    }

    // Render rooms (semi-transparent if reference image is visible)
    const roomOpacity = (floorplanData.referenceImage?.opacity ?? 0) > 0 ? 0.7 : 1
    floorplanData.rooms.forEach(room => {
      const roomGroup = createRoomRect(room, PIXELS_PER_FOOT, roomOpacity)
      canvas.add(roomGroup)
    })

    // Render doors (deduplicated for shared walls)
    // Track rendered door positions to avoid duplicates on shared walls
    const renderedDoorPositions = new Set<string>()

    floorplanData.rooms.forEach(room => {
      room.doors.forEach(door => {
        // Calculate absolute door position
        let doorX: number, doorY: number

        switch (door.wallSide) {
          case 'top':
            doorX = room.x + door.position + door.width / 2
            doorY = room.y
            break
          case 'bottom':
            doorX = room.x + door.position + door.width / 2
            doorY = room.y + room.height
            break
          case 'left':
            doorX = room.x
            doorY = room.y + door.position + door.width / 2
            break
          case 'right':
            doorX = room.x + room.width
            doorY = room.y + door.position + door.width / 2
            break
        }

        // Create unique position key (rounded to avoid floating point issues)
        const posKey = `${doorX.toFixed(2)},${doorY.toFixed(2)}`

        // Only render if we haven't rendered a door at this position
        if (!renderedDoorPositions.has(posKey)) {
          renderedDoorPositions.add(posKey)
          const doorMarker = createDoorMarker(room, door, PIXELS_PER_FOOT)
          canvas.add(doorMarker)
        }
      })
    })

    canvas.renderAll()
  }, [floorplanData])

  // Handle selection highlighting separately (without re-rendering everything)
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    // Update room highlighting
    canvas.getObjects().forEach(obj => {
      const objectType = obj.get('objectType')

      if (objectType === 'room') {
        const isSelected = obj.get('roomId') === selectedRoomId
        // For groups, update the rect inside the group
        const group = obj as Group
        const rectInGroup = group.getObjects().find(item => item.type === 'Rect')
        if (rectInGroup) {
          rectInGroup.set({
            stroke: isSelected ? '#FF9800' : '#1976D2',
            strokeWidth: isSelected ? 3 : 2
          })
        }
      } else if (objectType === 'door') {
        const isSelected = obj.get('doorId') === selectedDoorId
        obj.set({
          stroke: isSelected ? '#FF5722' : '#D32F2F',
          strokeWidth: isSelected ? 6 : 4
        })
      }
    })

    canvas.requestRenderAll()
  }, [selectedRoomId, selectedDoorId])

  // Handle object selection
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    const handleSelection = (e: TEvent) => {
      const obj = e.selected?.[0]
      if (!obj) return

      const objectType = obj.get('objectType')

      if (objectType === 'room') {
        const roomId = obj.get('roomId') as string
        selectRoom(roomId)
      } else if (objectType === 'door') {
        const doorId = obj.get('doorId') as string
        selectDoor(doorId)
      }
    }

    const handleDeselection = () => {
      if (activeTool === 'select') {
        selectRoom(null)
        selectDoor(null)
      }
    }

    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleDeselection)

    return () => {
      canvas.off('selection:created', handleSelection)
      canvas.off('selection:updated', handleSelection)
      canvas.off('selection:cleared', handleDeselection)
    }
  }, [activeTool, selectRoom, selectDoor])

  // Handle room modification (resize/move) with wall snapping
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas || !floorplanData) return

    const handleObjectMoving = (e: TEvent) => {
      isModifyingRef.current = true

      const obj = e.target
      if (!obj || obj.get('objectType') !== 'room') return

      // Clear previous snap guide lines
      snapGuideLinesRef.current.forEach(line => canvas.remove(line))
      snapGuideLinesRef.current = []

      const movingGroup = obj as Group
      const movingRoomId = obj.get('roomId') as string

      // Get bounds of moving room (groups are centered, so calculate edges)
      const movingLeft = (movingGroup.left || 0) - (movingGroup.width || 0) * (movingGroup.scaleX || 1) / 2
      const movingTop = (movingGroup.top || 0) - (movingGroup.height || 0) * (movingGroup.scaleY || 1) / 2
      const movingRight = movingLeft + (movingGroup.width || 0) * (movingGroup.scaleX || 1)
      const movingBottom = movingTop + (movingGroup.height || 0) * (movingGroup.scaleY || 1)

      let snapX: number | null = null
      let snapY: number | null = null
      let snapLineX: number | null = null
      let snapLineY: number | null = null

      // Check all other rooms for snapping
      canvas.getObjects().forEach(otherObj => {
        if (otherObj.get('objectType') !== 'room') return
        if (otherObj.get('roomId') === movingRoomId) return // Skip self

        const otherGroup = otherObj as Group
        const otherLeft = (otherGroup.left || 0) - (otherGroup.width || 0) * (otherGroup.scaleX || 1) / 2
        const otherTop = (otherGroup.top || 0) - (otherGroup.height || 0) * (otherGroup.scaleY || 1) / 2
        const otherRight = otherLeft + (otherGroup.width || 0) * (otherGroup.scaleX || 1)
        const otherBottom = otherTop + (otherGroup.height || 0) * (otherGroup.scaleY || 1)

        // Check horizontal snapping (left-right, right-left alignment)
        if (Math.abs(movingRight - otherLeft) < SNAP_THRESHOLD) {
          // Snap right edge of moving room to left edge of other room
          snapX = otherLeft - (movingGroup.width || 0) * (movingGroup.scaleX || 1) / 2
          snapLineX = otherLeft
        } else if (Math.abs(movingLeft - otherRight) < SNAP_THRESHOLD) {
          // Snap left edge of moving room to right edge of other room
          snapX = otherRight + (movingGroup.width || 0) * (movingGroup.scaleX || 1) / 2
          snapLineX = otherRight
        } else if (Math.abs(movingLeft - otherLeft) < SNAP_THRESHOLD) {
          // Snap left edges together
          snapX = otherLeft + (movingGroup.width || 0) * (movingGroup.scaleX || 1) / 2
          snapLineX = otherLeft
        } else if (Math.abs(movingRight - otherRight) < SNAP_THRESHOLD) {
          // Snap right edges together
          snapX = otherRight - (movingGroup.width || 0) * (movingGroup.scaleX || 1) / 2
          snapLineX = otherRight
        }

        // Check vertical snapping (top-bottom, bottom-top alignment)
        if (Math.abs(movingBottom - otherTop) < SNAP_THRESHOLD) {
          // Snap bottom edge of moving room to top edge of other room
          snapY = otherTop - (movingGroup.height || 0) * (movingGroup.scaleY || 1) / 2
          snapLineY = otherTop
        } else if (Math.abs(movingTop - otherBottom) < SNAP_THRESHOLD) {
          // Snap top edge of moving room to bottom edge of other room
          snapY = otherBottom + (movingGroup.height || 0) * (movingGroup.scaleY || 1) / 2
          snapLineY = otherBottom
        } else if (Math.abs(movingTop - otherTop) < SNAP_THRESHOLD) {
          // Snap top edges together
          snapY = otherTop + (movingGroup.height || 0) * (movingGroup.scaleY || 1) / 2
          snapLineY = otherTop
        } else if (Math.abs(movingBottom - otherBottom) < SNAP_THRESHOLD) {
          // Snap bottom edges together
          snapY = otherBottom - (movingGroup.height || 0) * (movingGroup.scaleY || 1) / 2
          snapLineY = otherBottom
        }
      })

      // Apply snapping if found
      if (snapX !== null) {
        movingGroup.set({ left: snapX })
      }
      if (snapY !== null) {
        movingGroup.set({ top: snapY })
      }

      if (snapX !== null || snapY !== null) {
        movingGroup.setCoords() // Update object coordinates
      }

      // Draw snap guide lines
      if (snapLineX !== null) {
        const guideLine = new Line([snapLineX, 0, snapLineX, canvas.height || 600], {
          stroke: '#FF6B00',
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          opacity: 0.7
        })
        canvas.add(guideLine)
        snapGuideLinesRef.current.push(guideLine)
      }
      if (snapLineY !== null) {
        const guideLine = new Line([0, snapLineY, canvas.width || 800, snapLineY], {
          stroke: '#FF6B00',
          strokeWidth: 2,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          opacity: 0.7
        })
        canvas.add(guideLine)
        snapGuideLinesRef.current.push(guideLine)
      }

      canvas.requestRenderAll()
    }

    const handleObjectModifying = () => {
      isModifyingRef.current = true
    }

    const handleObjectModified = (e: TEvent) => {
      // Clear snap guide lines when done dragging
      snapGuideLinesRef.current.forEach(line => canvas.remove(line))
      snapGuideLinesRef.current = []

      const obj = e.target
      if (!obj || obj.get('objectType') !== 'room') {
        isModifyingRef.current = false
        return
      }

      const roomId = obj.get('roomId') as string
      const roomGroup = obj as Group

      const { x, y, width, height } = fabricRectToRoom(roomGroup, PIXELS_PER_FOOT)

      updateRoom(roomId, { x, y, width, height })

      // Allow re-render after a short delay to ensure state update completes
      setTimeout(() => {
        isModifyingRef.current = false
        canvas.renderAll()
      }, 50)
    }

    const handleReferenceImageModified = (e: TEvent) => {
      const obj = e.target
      if (!obj || obj.get('objectType') !== 'referenceImage') return

      const img = obj as FabricImage

      // Calculate new position, size, and rotation
      const newX = (img.left || 0) / PIXELS_PER_FOOT
      const newY = (img.top || 0) / PIXELS_PER_FOOT
      const newRotation = img.angle || 0

      // Calculate new scale based on current scaleX (proportional)
      const originalAspectRatio = img.get('aspectRatio') as number || 1
      const currentScaleX = img.scaleX || 1

      // Get original width/height from current reference image data
      if (floorplanData?.referenceImage) {
        const originalScale = floorplanData.referenceImage.scale
        const baseScaleX = (floorplanData.referenceImage.width * PIXELS_PER_FOOT) / (img.width || 1) * originalScale
        const newScale = (currentScaleX / baseScaleX) * originalScale

        updateReferenceImage({
          x: newX,
          y: newY,
          rotation: newRotation,
          scale: newScale > 0 ? newScale : originalScale
        })
      }
    }

    canvas.on('object:moving', handleObjectMoving)
    canvas.on('object:scaling', handleObjectModifying)
    canvas.on('object:rotating', handleObjectModifying)
    canvas.on('object:modified', handleObjectModified)
    canvas.on('object:modified', handleReferenceImageModified)

    return () => {
      canvas.off('object:moving', handleObjectMoving)
      canvas.off('object:scaling', handleObjectModifying)
      canvas.off('object:rotating', handleObjectModifying)
      canvas.off('object:modified', handleObjectModified)
      canvas.off('object:modified', handleReferenceImageModified)
    }
  }, [updateRoom, updateReferenceImage, floorplanData])

  // Handle mouse events for drawing tools
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas || !floorplanData) return

    // Helper to get pointer position in canvas coordinates
    const getPointer = (e: TEvent): { x: number, y: number } => {
      // In Fabric v6, e.pointer already accounts for viewport transform
      if (e.pointer) {
        return { x: e.pointer.x, y: e.pointer.y }
      }
      // Fallback to screen coordinates
      return { x: e.e.offsetX, y: e.e.offsetY }
    }

    const handleMouseDown = (e: TEvent) => {
      const pointer = getPointer(e)

      if (activeTool === 'drawRoom') {
        // Start drawing room rectangle
        setIsDrawing(true)
        setDrawStartPoint(pointer)

        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: 'rgba(33, 150, 243, 0.2)',
          stroke: '#2196F3',
          strokeWidth: 2,
          selectable: false,
          evented: false
        })

        canvas.add(rect)
        setTempRect(rect)
      } else if (activeTool === 'placeDoor') {
        // Update room positions from canvas before detecting wall click
        const currentRooms = floorplanData.rooms.map(room => {
          const roomObj = canvas.getObjects().find(obj =>
            obj.get('objectType') === 'room' && obj.get('roomId') === room.id
          ) as Group | undefined

          if (roomObj) {
            const bounds = fabricRectToRoom(roomObj, PIXELS_PER_FOOT)
            return { ...room, ...bounds }
          }
          return room
        })

        // Detect wall click using current room positions
        const wallClick = detectWallClick(pointer, currentRooms, PIXELS_PER_FOOT)

        if (wallClick.room) {
          // Get valid door position
          const doorWidth = 3  // Default door width
          const validPosition = getClosestValidPosition(
            wallClick.wallSide,
            wallClick.position,
            doorWidth,
            wallClick.room
          )

          // Check if this wall is shared with another room (use current positions)
          const sharedRooms = findSharedWallRooms(
            wallClick.room,
            wallClick.wallSide,
            validPosition,
            doorWidth,
            currentRooms
          )

          console.log('[Door Placement] Clicked room:', {
            id: wallClick.room.id,
            name: wallClick.room.name,
            position: { x: wallClick.room.x, y: wallClick.room.y },
            size: { width: wallClick.room.width, height: wallClick.room.height },
            wall: wallClick.wallSide,
            doorPosition: validPosition
          })
          console.log('[Door Placement] Shared rooms:', sharedRooms.map(sr => ({
            id: sr.room.id,
            name: sr.room.name,
            position: { x: sr.room.x, y: sr.room.y },
            size: { width: sr.room.width, height: sr.room.height },
            wall: sr.wallSide,
            doorPosition: sr.position
          })))

          // Add door to the clicked room
          addDoor(wallClick.room.id, {
            wallSide: wallClick.wallSide,
            position: validPosition,
            width: doorWidth,
            height: 7  // Default door height
          })

          // Add door to any rooms sharing this wall
          sharedRooms.forEach(({ room, wallSide, position }) => {
            addDoor(room.id, {
              wallSide,
              position,
              width: doorWidth,
              height: 7
            })
          })

          // Clear wall highlight
          if (wallHighlightRef.current) {
            canvas.remove(wallHighlightRef.current)
            wallHighlightRef.current = null
          }

          // Auto-switch back to select mode after placing door
          setActiveTool('select')
        }
      }
    }

    const handleMouseMove = (e: TEvent) => {
      const pointer = getPointer(e)

      if (activeTool === 'drawRoom') {
        if (!isDrawing || !tempRect || !drawStartPoint) return

        // Calculate width and height
        const width = Math.abs(pointer.x - drawStartPoint.x)
        const height = Math.abs(pointer.y - drawStartPoint.y)

        // Update temp rect
        tempRect.set({
          left: Math.min(pointer.x, drawStartPoint.x),
          top: Math.min(pointer.y, drawStartPoint.y),
          width,
          height
        })

        canvas.renderAll()
      } else if (activeTool === 'placeDoor') {
        // Update room positions from canvas before detecting wall
        const currentRooms = floorplanData.rooms.map(room => {
          const roomObj = canvas.getObjects().find(obj =>
            obj.get('objectType') === 'room' && obj.get('roomId') === room.id
          ) as Group | undefined

          if (roomObj) {
            const bounds = fabricRectToRoom(roomObj, PIXELS_PER_FOOT)
            return { ...room, ...bounds }
          }
          return room
        })

        // Show wall highlight on hover using current positions
        const wallClick = detectWallClick(pointer, currentRooms, PIXELS_PER_FOOT)

        // Clear previous highlight
        if (wallHighlightRef.current) {
          canvas.remove(wallHighlightRef.current)
          wallHighlightRef.current = null
        }

        if (wallClick.room) {
          // Create wall highlight line
          const room = wallClick.room
          const roomPixelX = room.x * PIXELS_PER_FOOT
          const roomPixelY = room.y * PIXELS_PER_FOOT
          const roomWidth = room.width * PIXELS_PER_FOOT
          const roomHeight = room.height * PIXELS_PER_FOOT

          let x1: number, y1: number, x2: number, y2: number

          switch (wallClick.wallSide) {
            case 'top':
              x1 = roomPixelX
              y1 = roomPixelY
              x2 = roomPixelX + roomWidth
              y2 = roomPixelY
              break
            case 'bottom':
              x1 = roomPixelX
              y1 = roomPixelY + roomHeight
              x2 = roomPixelX + roomWidth
              y2 = roomPixelY + roomHeight
              break
            case 'left':
              x1 = roomPixelX
              y1 = roomPixelY
              x2 = roomPixelX
              y2 = roomPixelY + roomHeight
              break
            case 'right':
              x1 = roomPixelX + roomWidth
              y1 = roomPixelY
              x2 = roomPixelX + roomWidth
              y2 = roomPixelY + roomHeight
              break
          }

          const highlight = new Line([x1, y1, x2, y2], {
            stroke: '#4CAF50',
            strokeWidth: 6,
            selectable: false,
            evented: false,
            opacity: 0.6
          })

          canvas.add(highlight)
          wallHighlightRef.current = highlight
          canvas.requestRenderAll()
        }
      }
    }

    const handleMouseUp = (e: TEvent) => {
      if (!isDrawing || !tempRect || !drawStartPoint) return

      const pointer = getPointer(e)

      // Calculate final room dimensions
      const left = Math.min(pointer.x, drawStartPoint.x)
      const top = Math.min(pointer.y, drawStartPoint.y)
      const width = Math.abs(pointer.x - drawStartPoint.x)
      const height = Math.abs(pointer.y - drawStartPoint.y)

      // Remove temp rect
      canvas.remove(tempRect)

      // Only create room if it's large enough (min 30 pixels = 3 feet)
      if (width >= 30 && height >= 30) {
        const roomData = {
          name: `Room ${floorplanData.rooms.length + 1}`,
          x: left / PIXELS_PER_FOOT,
          y: top / PIXELS_PER_FOOT,
          width: width / PIXELS_PER_FOOT,
          height: height / PIXELS_PER_FOOT,
          wallHeight: 10,
          doors: []
        }

        addRoom(roomData)

        // Auto-switch back to select mode after drawing room
        setActiveTool('select')
      }

      // Reset drawing state
      setIsDrawing(false)
      setDrawStartPoint(null)
      setTempRect(null)
    }

    if (activeTool === 'drawRoom' || activeTool === 'placeDoor') {
      canvas.on('mouse:down', handleMouseDown)
      canvas.on('mouse:move', handleMouseMove)
      canvas.on('mouse:up', handleMouseUp)
    }

    return () => {
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
    }
  }, [activeTool, isDrawing, drawStartPoint, tempRect, floorplanData, addRoom, addDoor, setActiveTool])

  return (
    <div className="relative w-full h-full bg-porcelain">
      <canvas ref={canvasRef} />
    </div>
  )
}

function getCursorForTool(tool: string): string {
  switch (tool) {
    case 'drawRoom':
      return 'crosshair'
    case 'placeDoor':
      return 'cell'
    case 'delete':
      return 'not-allowed'
    case 'pan':
      return 'grab'
    default:
      return 'default'
  }
}
