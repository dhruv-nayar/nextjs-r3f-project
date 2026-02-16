/**
 * Fabric.js Utilities for Floorplan Editor
 *
 * Helper functions for creating and manipulating Fabric.js objects
 * in the 2D floorplan canvas.
 */

import {
  Canvas,
  Rect,
  Text,
  Line,
  Image as FabricImage,
  TEvent,
  Object as FabricObject,
  Group
} from 'fabric'
import { FloorplanRoom, FloorplanDoor, WallSide } from '@/types/floorplan'

const PIXELS_PER_FOOT = 10  // Default scale: 10 pixels = 1 foot

/**
 * Create a room rectangle with label (grouped together)
 * @param room - The room data
 * @param pixelsPerFoot - Scale factor
 * @param opacity - Optional opacity for semi-transparent rooms (when reference image visible)
 */
export function createRoomRect(
  room: FloorplanRoom,
  pixelsPerFoot: number = PIXELS_PER_FOOT,
  opacity: number = 1
): Group {
  const rectWidth = room.width * pixelsPerFoot
  const rectHeight = room.height * pixelsPerFoot

  const rect = new Rect({
    left: 0,
    top: 0,
    width: rectWidth,
    height: rectHeight,
    fill: room.color || '#E3F2FD',
    stroke: '#1976D2',
    strokeWidth: 2,
    originX: 'center',
    originY: 'center',
    opacity  // Apply opacity for semi-transparency
  })

  // Create label centered on rectangle
  // Truncate text if it would be wider than the room
  const maxTextWidth = rectWidth - 16  // 8px padding on each side
  let displayName = room.name

  // Create temp text to measure width
  const tempLabel = new Text(room.name, {
    fontSize: 14,
    fontFamily: 'Arial, sans-serif'
  })

  // Truncate with ellipsis if too wide
  if (tempLabel.width && tempLabel.width > maxTextWidth && maxTextWidth > 30) {
    while (displayName.length > 1) {
      displayName = displayName.slice(0, -1)
      tempLabel.set('text', displayName + '...')
      if (tempLabel.width && tempLabel.width <= maxTextWidth) break
    }
    displayName = displayName + '...'
  } else if (maxTextWidth <= 30) {
    // Room too small for text, hide it
    displayName = ''
  }

  const label = new Text(displayName, {
    left: 0,
    top: 0,
    fontSize: 14,
    fill: '#333',
    fontFamily: 'Arial, sans-serif',
    originX: 'center',
    originY: 'center'
  })

  // Group them together
  const group = new Group([rect, label], {
    left: room.x * pixelsPerFoot + rectWidth / 2,
    top: room.y * pixelsPerFoot + rectHeight / 2,
    selectable: true,
    hasControls: true,
    lockRotation: true,
    cornerStyle: 'circle',
    cornerColor: '#1976D2',
    cornerSize: 8,
    transparentCorners: false,
    subTargetCheck: false  // Select the group, not individual items
  })

  // Store room ID as custom property on the group
  group.set('roomId', room.id)
  group.set('objectType', 'room')

  return group
}

/**
 * Create a door marker (red line on wall edge)
 */
export function createDoorMarker(
  room: FloorplanRoom,
  door: FloorplanDoor,
  pixelsPerFoot: number = PIXELS_PER_FOOT
): Line {
  const roomPixelX = room.x * pixelsPerFoot
  const roomPixelY = room.y * pixelsPerFoot
  const doorWidthPixels = door.width * pixelsPerFoot
  const doorPositionPixels = door.position * pixelsPerFoot

  let x1: number, y1: number, x2: number, y2: number

  switch (door.wallSide) {
    case 'top':
      x1 = roomPixelX + doorPositionPixels
      y1 = roomPixelY
      x2 = x1 + doorWidthPixels
      y2 = y1
      break
    case 'bottom':
      x1 = roomPixelX + doorPositionPixels
      y1 = roomPixelY + room.height * pixelsPerFoot
      x2 = x1 + doorWidthPixels
      y2 = y1
      break
    case 'left':
      x1 = roomPixelX
      y1 = roomPixelY + doorPositionPixels
      x2 = x1
      y2 = y1 + doorWidthPixels
      break
    case 'right':
      x1 = roomPixelX + room.width * pixelsPerFoot
      y1 = roomPixelY + doorPositionPixels
      x2 = x1
      y2 = y1 + doorWidthPixels
      break
  }

  const line = new Line([x1, y1, x2, y2], {
    stroke: '#D32F2F',
    strokeWidth: 4,
    selectable: true,
    hasControls: false,
    hasBorders: true,
    borderColor: '#FF5722',
    cornerStyle: 'circle',
    cornerColor: '#D32F2F'
  })

  line.set('doorId', door.id)
  line.set('roomId', room.id)
  line.set('objectType', 'door')

  return line
}

/**
 * Create reference image from URL
 * Supports rotation and proportional resizing (aspect ratio locked)
 */
export async function createReferenceImage(
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opacity: number,
  scale: number,
  locked: boolean,
  pixelsPerFoot: number = PIXELS_PER_FOOT,
  rotation: number = 0
): Promise<FabricImage> {
  const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })

  // Calculate scale to fit specified dimensions
  const scaleX = (width * pixelsPerFoot) / (img.width || 1) * scale
  const scaleY = (height * pixelsPerFoot) / (img.height || 1) * scale

  // Store original aspect ratio
  const aspectRatio = (img.width || 1) / (img.height || 1)

  img.set({
    left: x * pixelsPerFoot,
    top: y * pixelsPerFoot,
    scaleX,
    scaleY,
    opacity,
    angle: rotation,
    selectable: !locked,
    evented: !locked,
    // Enable rotation and resizing
    lockRotation: locked,
    // Lock aspect ratio for proportional resize
    lockUniScaling: true,
    // Controls appearance
    cornerStyle: 'circle',
    cornerColor: '#4CAF50',
    cornerSize: 10,
    transparentCorners: false,
    borderColor: '#4CAF50',
    borderScaleFactor: 2
  })

  img.set('objectType', 'referenceImage')
  img.set('aspectRatio', aspectRatio)

  return img
}

/**
 * Setup zoom and pan controls for canvas
 */
export function setupZoomPan(canvas: Canvas) {
  // Mouse wheel zoom
  canvas.on('mouse:wheel', (opt: TEvent<WheelEvent>) => {
    const delta = opt.e.deltaY
    let zoom = canvas.getZoom()
    zoom *= 0.999 ** delta

    // Limit zoom range
    if (zoom > 20) zoom = 20
    if (zoom < 0.1) zoom = 0.1

    // Zoom to pointer position
    canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom)

    opt.e.preventDefault()
    opt.e.stopPropagation()
  })

  // Pan with middle mouse button or space+drag
  let isPanning = false
  let lastPosX = 0
  let lastPosY = 0

  canvas.on('mouse:down', (opt: TEvent<MouseEvent>) => {
    const evt = opt.e
    // Middle mouse button or Alt+drag
    if (evt.button === 1 || (evt.altKey && evt.button === 0)) {
      isPanning = true
      canvas.selection = false
      lastPosX = evt.clientX
      lastPosY = evt.clientY
    }
  })

  canvas.on('mouse:move', (opt: TEvent<MouseEvent>) => {
    if (isPanning) {
      const evt = opt.e
      const vpt = canvas.viewportTransform!
      vpt[4] += evt.clientX - lastPosX
      vpt[5] += evt.clientY - lastPosY
      canvas.requestRenderAll()
      lastPosX = evt.clientX
      lastPosY = evt.clientY
    }
  })

  canvas.on('mouse:up', () => {
    if (isPanning) {
      canvas.setViewportTransform(canvas.viewportTransform!)
      isPanning = false
      canvas.selection = true
    }
  })
}

/**
 * Update room rectangle position and size
 */
export function updateRoomRect(
  rect: Rect,
  room: FloorplanRoom,
  pixelsPerFoot: number = PIXELS_PER_FOOT
) {
  rect.set({
    left: room.x * pixelsPerFoot,
    top: room.y * pixelsPerFoot,
    width: room.width * pixelsPerFoot,
    height: room.height * pixelsPerFoot,
    fill: room.color
  })
}

/**
 * Update room label position and text
 * Truncates text if wider than room
 */
export function updateRoomLabel(
  label: Text,
  room: FloorplanRoom,
  pixelsPerFoot: number = PIXELS_PER_FOOT
) {
  const rectWidth = room.width * pixelsPerFoot
  const maxTextWidth = rectWidth - 16  // 8px padding on each side
  let displayName = room.name

  // Create temp text to measure width
  const tempLabel = new Text(room.name, {
    fontSize: 14,
    fontFamily: 'Arial, sans-serif'
  })

  // Truncate with ellipsis if too wide
  if (tempLabel.width && tempLabel.width > maxTextWidth && maxTextWidth > 30) {
    while (displayName.length > 1) {
      displayName = displayName.slice(0, -1)
      tempLabel.set('text', displayName + '...')
      if (tempLabel.width && tempLabel.width <= maxTextWidth) break
    }
    displayName = displayName + '...'
  } else if (maxTextWidth <= 30) {
    // Room too small for text, hide it
    displayName = ''
  }

  label.set({
    left: room.x * pixelsPerFoot + (room.width * pixelsPerFoot) / 2,
    top: room.y * pixelsPerFoot + (room.height * pixelsPerFoot) / 2,
    text: displayName
  })
}

/**
 * Convert Fabric group/rectangle to FloorplanRoom coordinates
 */
export function fabricRectToRoom(
  obj: Group | Rect,
  pixelsPerFoot: number = PIXELS_PER_FOOT
): { x: number, y: number, width: number, height: number } {
  // For groups, get the bounding box
  const left = obj.left || 0
  const top = obj.top || 0
  const width = (obj.width || 0) * (obj.scaleX || 1)
  const height = (obj.height || 0) * (obj.scaleY || 1)

  // Groups are centered, so convert back to top-left coordinates
  return {
    x: (left - width / 2) / pixelsPerFoot,
    y: (top - height / 2) / pixelsPerFoot,
    width: width / pixelsPerFoot,
    height: height / pixelsPerFoot
  }
}

/**
 * Highlight object (for selection)
 */
export function highlightObject(obj: FabricObject, highlight: boolean) {
  if (highlight) {
    obj.set({
      stroke: '#FF9800',
      strokeWidth: 3
    })
  } else {
    obj.set({
      stroke: '#1976D2',
      strokeWidth: 2
    })
  }
}

/**
 * Get all objects of a specific type
 */
export function getObjectsByType(
  canvas: Canvas,
  objectType: string
): FabricObject[] {
  return canvas.getObjects().filter((obj: FabricObject) => obj.get('objectType') === objectType)
}

/**
 * Get object by custom ID
 */
export function getObjectById(
  canvas: Canvas,
  idKey: string,
  idValue: string
): FabricObject | undefined {
  return canvas.getObjects().find((obj: FabricObject) => obj.get(idKey) === idValue)
}

/**
 * Clear all objects from canvas
 */
export function clearCanvas(canvas: Canvas) {
  canvas.clear()
  canvas.backgroundColor = '#ffffff'
}

/**
 * Fit canvas to viewport
 */
export function fitCanvasToViewport(
  canvas: Canvas,
  containerWidth: number,
  containerHeight: number
) {
  const canvasWidth = canvas.getWidth()
  const canvasHeight = canvas.getHeight()

  const scaleX = containerWidth / canvasWidth
  const scaleY = containerHeight / canvasHeight
  const scale = Math.min(scaleX, scaleY, 1)  // Don't zoom in, only out

  canvas.setZoom(scale)
  canvas.renderAll()
}
