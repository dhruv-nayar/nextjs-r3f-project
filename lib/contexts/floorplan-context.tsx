'use client'

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react'
import {
  FloorplanData,
  FloorplanRoom,
  FloorplanDoor,
  FloorplanTool,
  ReferenceImage,
  Point2D
} from '@/types/floorplan'
import { Room } from '@/types/room'
import { convertFloorplanTo3D, validateFloorplan, assignRoomColor } from '@/lib/floorplan/floorplan-converter'

interface FloorplanContextType {
  // State
  floorplanData: FloorplanData | null
  selectedRoomId: string | null
  selectedDoorId: string | null
  activeTool: FloorplanTool
  canvasZoom: number
  canvasPan: Point2D

  // Room actions
  addRoom: (room: Omit<FloorplanRoom, 'id' | 'color' | 'fabricObjectId'>) => string
  updateRoom: (roomId: string, updates: Partial<FloorplanRoom>) => void
  deleteRoom: (roomId: string) => void
  selectRoom: (roomId: string | null) => void
  getRoom: (roomId: string) => FloorplanRoom | undefined

  // Door actions
  addDoor: (roomId: string, door: Omit<FloorplanDoor, 'id'>) => string
  updateDoor: (roomId: string, doorId: string, updates: Partial<FloorplanDoor>) => void
  deleteDoor: (roomId: string, doorId: string) => void
  selectDoor: (doorId: string | null) => void
  getDoor: (doorId: string) => { room: FloorplanRoom, door: FloorplanDoor } | undefined

  // Reference image
  setReferenceImage: (image: ReferenceImage | undefined) => void
  updateReferenceImage: (updates: Partial<ReferenceImage>) => void

  // Tools
  setActiveTool: (tool: FloorplanTool) => void

  // Canvas
  setCanvasSize: (width: number, height: number) => void
  setCanvasZoom: (zoom: number) => void
  setCanvasPan: (pan: Point2D) => void

  // History (undo/redo)
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Persistence
  initializeFloorplan: (homeId: string, existingData?: FloorplanData) => void

  // 3D Conversion
  build3DModel: () => { rooms: Room[], errors: string[] } | null
}

const FloorplanContext = createContext<FloorplanContextType | undefined>(undefined)

const MAX_HISTORY_LENGTH = 50

interface FloorplanProviderProps {
  children: ReactNode
}

export function FloorplanProvider({ children }: FloorplanProviderProps) {
  const [floorplanData, setFloorplanData] = useState<FloorplanData | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<FloorplanTool>('select')
  const [canvasZoom, setCanvasZoom] = useState<number>(1)
  const [canvasPan, setCanvasPan] = useState<Point2D>({ x: 0, y: 0 })

  // History for undo/redo
  const [history, setHistory] = useState<FloorplanData[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  // Initialize floorplan data
  const initializeFloorplan = useCallback((homeId: string, existingData?: FloorplanData) => {
    const initialData: FloorplanData = existingData || {
      id: `floorplan-${Date.now()}`,
      homeId,
      canvasWidth: 50,
      canvasHeight: 50,
      rooms: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setFloorplanData(initialData)
    setHistory([initialData])
    setHistoryIndex(0)
    setSelectedRoomId(null)
    setSelectedDoorId(null)
    setActiveTool('select')
  }, [])

  // Record history after state changes
  const recordHistory = useCallback((newData: FloorplanData) => {
    setHistory(prev => {
      // Remove any history after current index (when making new changes after undo)
      const newHistory = prev.slice(0, historyIndex + 1)

      // Add new state
      newHistory.push({
        ...newData,
        updatedAt: new Date().toISOString()
      })

      // Limit history length
      if (newHistory.length > MAX_HISTORY_LENGTH) {
        newHistory.shift()
        return newHistory
      }

      return newHistory
    })

    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_LENGTH - 1))
  }, [historyIndex])

  // Update floorplan data and record history
  const updateFloorplanData = useCallback((updater: (prev: FloorplanData) => FloorplanData) => {
    setFloorplanData(prev => {
      if (!prev) return prev
      const newData = updater(prev)
      recordHistory(newData)
      return newData
    })
  }, [recordHistory])

  // Room actions
  const addRoom = useCallback((room: Omit<FloorplanRoom, 'id' | 'color' | 'fabricObjectId'>) => {
    const roomId = `room-${Date.now()}`

    updateFloorplanData(prev => ({
      ...prev,
      rooms: [
        ...prev.rooms,
        {
          ...room,
          id: roomId,
          color: assignRoomColor(prev.rooms.length),
          doors: room.doors || []
        }
      ]
    }))

    return roomId
  }, [updateFloorplanData])

  const updateRoom = useCallback((roomId: string, updates: Partial<FloorplanRoom>) => {
    updateFloorplanData(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId ? { ...room, ...updates } : room
      )
    }))
  }, [updateFloorplanData])

  const deleteRoom = useCallback((roomId: string) => {
    updateFloorplanData(prev => ({
      ...prev,
      rooms: prev.rooms.filter(room => room.id !== roomId)
    }))

    // Clear selection if deleted room was selected
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null)
    }
  }, [updateFloorplanData, selectedRoomId])

  const selectRoom = useCallback((roomId: string | null) => {
    setSelectedRoomId(roomId)
    setSelectedDoorId(null)  // Clear door selection when selecting room
  }, [])

  const getRoom = useCallback((roomId: string): FloorplanRoom | undefined => {
    return floorplanData?.rooms.find(room => room.id === roomId)
  }, [floorplanData])

  // Door actions
  const addDoor = useCallback((roomId: string, door: Omit<FloorplanDoor, 'id'>) => {
    const doorId = `door-${Date.now()}`

    updateFloorplanData(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              doors: [
                ...room.doors,
                {
                  ...door,
                  id: doorId
                }
              ]
            }
          : room
      )
    }))

    return doorId
  }, [updateFloorplanData])

  const updateDoor = useCallback((roomId: string, doorId: string, updates: Partial<FloorplanDoor>) => {
    console.log('[updateDoor] Updating door:', { roomId, doorId, updates })
    updateFloorplanData(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              doors: room.doors.map(door =>
                door.id === doorId ? { ...door, ...updates } : door
              )
            }
          : room
      )
    }))
  }, [updateFloorplanData])

  const deleteDoor = useCallback((roomId: string, doorId: string) => {
    updateFloorplanData(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.id === roomId
          ? {
              ...room,
              doors: room.doors.filter(door => door.id !== doorId)
            }
          : room
      )
    }))

    // Clear selection if deleted door was selected
    if (selectedDoorId === doorId) {
      setSelectedDoorId(null)
    }
  }, [updateFloorplanData, selectedDoorId])

  const selectDoor = useCallback((doorId: string | null) => {
    setSelectedDoorId(doorId)
    setSelectedRoomId(null)  // Clear room selection when selecting door
  }, [])

  const getDoor = useCallback((doorId: string): { room: FloorplanRoom, door: FloorplanDoor } | undefined => {
    if (!floorplanData) return undefined

    for (const room of floorplanData.rooms) {
      const door = room.doors.find(d => d.id === doorId)
      if (door) {
        return { room, door }
      }
    }

    return undefined
  }, [floorplanData])

  // Reference image actions
  const setReferenceImage = useCallback((image: ReferenceImage | undefined) => {
    updateFloorplanData(prev => ({
      ...prev,
      referenceImage: image
    }))
  }, [updateFloorplanData])

  const updateReferenceImage = useCallback((updates: Partial<ReferenceImage>) => {
    updateFloorplanData(prev => ({
      ...prev,
      referenceImage: prev.referenceImage
        ? { ...prev.referenceImage, ...updates }
        : undefined
    }))
  }, [updateFloorplanData])

  // Canvas actions
  const setCanvasSize = useCallback((width: number, height: number) => {
    updateFloorplanData(prev => ({
      ...prev,
      canvasWidth: width,
      canvasHeight: height
    }))
  }, [updateFloorplanData])

  // History actions
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setFloorplanData(history[newIndex])
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setFloorplanData(history[newIndex])
    }
  }, [history, historyIndex])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // 3D Conversion
  const build3DModel = useCallback(() => {
    if (!floorplanData) return null

    // Validate floorplan
    const validation = validateFloorplan(floorplanData)
    if (!validation.valid) {
      return {
        rooms: [],
        errors: validation.errors
      }
    }

    // Convert to 3D (returns both rooms and shared walls)
    const { rooms: rooms3D } = convertFloorplanTo3D(floorplanData)

    return {
      rooms: rooms3D,
      errors: []
    }
  }, [floorplanData])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Redo: Cmd/Ctrl + Shift + Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
      }

      // Delete: Delete or Backspace
      // Don't trigger delete if user is typing in an input/textarea
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

        if (!isTyping) {
          if (selectedRoomId) {
            e.preventDefault()
            deleteRoom(selectedRoomId)
          } else if (selectedDoorId) {
            e.preventDefault()
            const doorInfo = getDoor(selectedDoorId)
            if (doorInfo) {
              deleteDoor(doorInfo.room.id, selectedDoorId)
            }
          }
        }
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedRoomId(null)
        setSelectedDoorId(null)
        setActiveTool('select')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, selectedRoomId, selectedDoorId, deleteRoom, deleteDoor, getDoor])

  const value: FloorplanContextType = {
    // State
    floorplanData,
    selectedRoomId,
    selectedDoorId,
    activeTool,
    canvasZoom,
    canvasPan,

    // Room actions
    addRoom,
    updateRoom,
    deleteRoom,
    selectRoom,
    getRoom,

    // Door actions
    addDoor,
    updateDoor,
    deleteDoor,
    selectDoor,
    getDoor,

    // Reference image
    setReferenceImage,
    updateReferenceImage,

    // Tools
    setActiveTool,

    // Canvas
    setCanvasSize,
    setCanvasZoom,
    setCanvasPan,

    // History
    undo,
    redo,
    canUndo,
    canRedo,

    // Persistence
    initializeFloorplan,

    // 3D Conversion
    build3DModel
  }

  return (
    <FloorplanContext.Provider value={value}>
      {children}
    </FloorplanContext.Provider>
  )
}

export function useFloorplan() {
  const context = useContext(FloorplanContext)
  if (context === undefined) {
    throw new Error('useFloorplan must be used within a FloorplanProvider')
  }
  return context
}
