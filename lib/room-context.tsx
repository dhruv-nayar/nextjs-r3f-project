'use client'

import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react'
import { Room, RoomConfig } from '@/types/room'
import { SCALE } from './constants'
import { useHome } from './home-context'

interface RoomContextType {
  rooms: Room[]
  currentRoom: Room | null
  setRooms: (rooms: Room[]) => void
  addRoom: (room: Room) => void
  updateRoom: (roomId: string, updates: Partial<Room>) => void
  updateFurniture: (furnitureId: string, updates: any) => void // DEPRECATED: use updateInstance
  updateInstance: (instanceId: string, updates: any) => void // NEW: for item instances
  deleteInstance: (instanceId: string) => void // NEW: delete item instance
  deleteRoom: (roomId: string) => void
  switchRoom: (roomId: string) => void
  currentRoomId: string | null
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

const RoomContext = createContext<RoomContextType | undefined>(undefined)

// Default sample rooms - DEPRECATED (using home context now)
// Keeping for backwards compatibility if no home is loaded
const DEFAULT_ROOMS: Room[] = [
  {
    id: 'living-room',
    name: 'Living Room',
    instances: [
      {
        id: 'default-instance-chair-1',
        itemId: 'item-whiteback-chair',
        roomId: 'living-room',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
        scaleMultiplier: { x: 1, y: 1, z: 1 },
        placedAt: new Date().toISOString()
      }
    ],
    cameraPosition: { x: 20, y: 15, z: 30 },  // Pull back to see both rooms
    cameraTarget: { x: 10, y: 2, z: 0 },  // Look at center between rooms
    lighting: {
      ambient: { intensity: Math.PI / 2 }
    }
  },
  {
    id: 'lounge',
    name: 'Lounge',
    instances: [
      {
        id: 'default-instance-sofa-1',
        itemId: 'item-omhu-sofa',
        roomId: 'lounge',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scaleMultiplier: { x: 1, y: 1, z: 1 },
        placedAt: new Date().toISOString()
      }
    ],
    cameraPosition: { x: 20, y: 15, z: 30 },  // Pull back to see both rooms
    cameraTarget: { x: 10, y: 2, z: 0 },  // Look at center between rooms
    lighting: {
      ambient: { intensity: Math.PI / 2 }
    }
  }
]

const MAX_HISTORY_SIZE = 50

export function RoomProvider({ children }: { children: ReactNode }) {
  const homeContext = useHome()
  const currentHomeRooms = homeContext.currentHome?.rooms || DEFAULT_ROOMS

  const [rooms, setRoomsState] = useState<Room[]>(currentHomeRooms)
  const [currentRoomId, setCurrentRoomId] = useState<string>(currentHomeRooms[0]?.id || '')

  // Sync with home context when current home changes
  useEffect(() => {
    if (homeContext.currentHome) {
      setRoomsState(homeContext.currentHome.rooms)
      setHistoryIndex(0)
      setHistory([JSON.parse(JSON.stringify(homeContext.currentHome.rooms))])
      if (homeContext.currentHome.rooms.length > 0) {
        setCurrentRoomId(homeContext.currentHome.rooms[0].id)
      }
    }
  }, [homeContext.currentHomeId])

  // Sync when home context's rooms are updated (e.g., when instances are added via HomeContext)
  // Use a ref to track the last synced updatedAt to avoid unnecessary updates
  const lastSyncedUpdatedAt = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (homeContext.currentHome && !isUndoRedoRef.current) {
      // Only sync if updatedAt actually changed (prevents update loops)
      if (lastSyncedUpdatedAt.current === homeContext.currentHome.updatedAt) {
        return
      }
      lastSyncedUpdatedAt.current = homeContext.currentHome.updatedAt

      const newRooms = homeContext.currentHome.rooms
      setRoomsState(newRooms)

      // If current room ID no longer exists in the new rooms, select the first room
      if (newRooms.length > 0 && !newRooms.find(r => r.id === currentRoomId)) {
        setCurrentRoomId(newRooms[0].id)
      }
    }
  }, [homeContext.currentHome?.rooms, homeContext.currentHome?.updatedAt, currentRoomId])

  // History management
  const [history, setHistory] = useState<Room[][]>([JSON.parse(JSON.stringify(currentHomeRooms))])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUndoRedoRef = useRef(false)

  const currentRoom = rooms.find(r => r.id === currentRoomId) || null

  // Record state to history (called after each mutation)
  const recordHistory = (newState: Room[]) => {
    if (isUndoRedoRef.current) return // Don't record during undo/redo

    setHistory(prev => {
      // Remove any future states if we're not at the end
      const newHistory = prev.slice(0, historyIndex + 1)
      // Add new state (deep clone)
      const updatedHistory = [...newHistory, JSON.parse(JSON.stringify(newState))]
      // Limit history size
      if (updatedHistory.length > MAX_HISTORY_SIZE) {
        return updatedHistory.slice(-MAX_HISTORY_SIZE)
      }
      return updatedHistory
    })
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_SIZE - 1))

    // Update the home context with new rooms
    if (homeContext.currentHomeId) {
      homeContext.updateHome(homeContext.currentHomeId, { rooms: newState })
    }
  }

  const setRooms = (newRooms: Room[]) => {
    setRoomsState(newRooms)
    recordHistory(newRooms)
  }

  const addRoom = (room: Room) => {
    setRoomsState(prev => {
      const newState = [...prev, room]
      recordHistory(newState)
      return newState
    })
  }

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    setRoomsState(prev => {
      const newState = prev.map(room => (room.id === roomId ? { ...room, ...updates } : room))
      recordHistory(newState)
      return newState
    })
  }

  const updateFurniture = (furnitureId: string, updates: any) => {
    setRoomsState(prev => {
      const newState = prev.map(room => ({
        ...room,
        furniture: room.furniture ? room.furniture.map(item =>
          item.id === furnitureId ? { ...item, ...updates } : item
        ) : undefined
      }))
      recordHistory(newState)
      return newState
    })
  }

  // NEW: Update item instances
  const updateInstance = (instanceId: string, updates: any) => {
    setRoomsState(prev => {
      const newState = prev.map(room => ({
        ...room,
        instances: room.instances ? room.instances.map(instance =>
          instance.id === instanceId ? { ...instance, ...updates } : instance
        ) : undefined
      }))
      recordHistory(newState)
      return newState
    })
  }

  // NEW: Delete item instance
  const deleteInstance = (instanceId: string) => {
    setRoomsState(prev => {
      const newState = prev.map(room => ({
        ...room,
        instances: room.instances ? room.instances.filter(instance =>
          instance.id !== instanceId
        ) : undefined
      }))
      recordHistory(newState)
      return newState
    })
  }

  const deleteRoom = (roomId: string) => {
    setRoomsState(prev => {
      const filtered = prev.filter(r => r.id !== roomId)
      // If deleting current room, switch to first available room
      if (roomId === currentRoomId && filtered.length > 0) {
        setCurrentRoomId(filtered[0].id)
      }
      recordHistory(filtered)
      return filtered
    })
  }

  const switchRoom = (roomId: string) => {
    if (rooms.find(r => r.id === roomId)) {
      setCurrentRoomId(roomId)
    }
  }

  // Undo/Redo functions
  const undo = () => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setRoomsState(JSON.parse(JSON.stringify(history[newIndex])))
      setTimeout(() => {
        isUndoRedoRef.current = false
      }, 0)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setRoomsState(JSON.parse(JSON.stringify(history[newIndex])))
      setTimeout(() => {
        isUndoRedoRef.current = false
      }, 0)
    }
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history.length])

  return (
    <RoomContext.Provider
      value={{
        rooms,
        currentRoom,
        setRooms,
        addRoom,
        updateRoom,
        updateFurniture,
        updateInstance,
        deleteInstance,
        deleteRoom,
        switchRoom,
        currentRoomId,
        canUndo,
        canRedo,
        undo,
        redo
      }}
    >
      {children}
    </RoomContext.Provider>
  )
}

export function useRoom() {
  const context = useContext(RoomContext)
  if (context === undefined) {
    throw new Error('useRoom must be used within a RoomProvider')
  }
  return context
}
