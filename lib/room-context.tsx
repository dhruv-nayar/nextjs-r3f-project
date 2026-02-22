'use client'

import { createContext, useContext, useState, ReactNode, useRef, useEffect, useCallback } from 'react'
import { Room, RoomConfig, ItemInstance } from '@/types/room'
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
  // Copy/paste
  clipboardInstance: ItemInstance | null
  copyInstance: (instanceId: string) => void
  pasteInstance: () => string | null // Returns new instance ID or null
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

  // Use empty array as default - never use DEFAULT_ROOMS for new/empty projects
  const currentHomeRooms = homeContext.currentHome?.rooms || []

  const [rooms, setRoomsState] = useState<Room[]>(currentHomeRooms)
  const [currentRoomId, setCurrentRoomId] = useState<string>(currentHomeRooms[0]?.id || '')

  // Track home ID to detect project switches
  const prevHomeIdRef = useRef<string | null>(null)

  // Sync when home context's rooms are updated (e.g., when instances are added via HomeContext)
  // Use a ref to track the last synced updatedAt to avoid unnecessary updates
  const lastSyncedUpdatedAt = useRef<string | undefined>(undefined)

  // Sync with home context when current home changes
  useEffect(() => {
    const currentHomeId = homeContext.currentHomeId || null

    // Detect home switch (including initial load)
    if (prevHomeIdRef.current !== currentHomeId) {
      console.log('[RoomContext] Home changed from', prevHomeIdRef.current, 'to', currentHomeId)

      // Reset the lastSyncedUpdatedAt to allow the next sync effect to run
      lastSyncedUpdatedAt.current = undefined

      if (homeContext.currentHome) {
        const newRooms = homeContext.currentHome.rooms || []
        console.log('[RoomContext] Syncing rooms for new home, count:', newRooms.length)
        setRoomsState(newRooms)
        setHistoryIndex(0)
        setHistory([JSON.parse(JSON.stringify(newRooms))])
        if (newRooms.length > 0) {
          setCurrentRoomId(newRooms[0].id)
        } else {
          setCurrentRoomId('')
        }
      } else {
        // No home loaded - reset to empty state
        console.log('[RoomContext] No home loaded, resetting to empty state')
        setRoomsState([])
        setCurrentRoomId('')
        setHistoryIndex(0)
        setHistory([[]])
      }

      prevHomeIdRef.current = currentHomeId
    }
  }, [homeContext.currentHomeId, homeContext.currentHome])

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
    queueMicrotask(() => recordHistory(newRooms))
  }

  const addRoom = (room: Room) => {
    setRoomsState(prev => {
      const newState = [...prev, room]
      // Defer history recording to next tick to avoid setState-during-render
      queueMicrotask(() => recordHistory(newState))
      return newState
    })
  }

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    setRoomsState(prev => {
      const newState = prev.map(r => (r.id === roomId ? { ...r, ...updates } : r))
      // Defer history recording and sync to next tick to avoid setState-during-render
      queueMicrotask(() => {
        recordHistory(newState)
        // Two-way sync: Update V2 floorplan data when room properties change
        if (homeContext.currentHomeId) {
          homeContext.syncRoomChangesToFloorplanV2(homeContext.currentHomeId, roomId, updates)
        }
      })
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
      queueMicrotask(() => recordHistory(newState))
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
      queueMicrotask(() => recordHistory(newState))
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
      queueMicrotask(() => recordHistory(newState))
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
      queueMicrotask(() => recordHistory(filtered))
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
      const newIndex = historyIndex - 1
      const historyEntry = history[newIndex]
      if (!historyEntry) {
        console.warn('[RoomContext] undo: history entry is undefined at index', newIndex)
        return
      }
      isUndoRedoRef.current = true
      setHistoryIndex(newIndex)
      setRoomsState(JSON.parse(JSON.stringify(historyEntry)))
      setTimeout(() => {
        isUndoRedoRef.current = false
      }, 0)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      const historyEntry = history[newIndex]
      if (!historyEntry) {
        console.warn('[RoomContext] redo: history entry is undefined at index', newIndex)
        return
      }
      isUndoRedoRef.current = true
      setHistoryIndex(newIndex)
      setRoomsState(JSON.parse(JSON.stringify(historyEntry)))
      setTimeout(() => {
        isUndoRedoRef.current = false
      }, 0)
    }
  }

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  // Clipboard for copy/paste
  const [clipboardInstance, setClipboardInstance] = useState<ItemInstance | null>(null)

  // Copy an instance to clipboard
  const copyInstance = useCallback((instanceId: string) => {
    // Find the instance across all rooms
    for (const room of rooms) {
      const instance = room.instances?.find(i => i.id === instanceId)
      if (instance) {
        // Deep clone the instance
        setClipboardInstance(JSON.parse(JSON.stringify(instance)))
        console.log('[RoomContext] Copied instance:', instanceId)
        return
      }
    }
    console.warn('[RoomContext] Instance not found for copy:', instanceId)
  }, [rooms])

  // Paste clipboard instance into current room with offset
  const pasteInstance = useCallback((): string | null => {
    if (!clipboardInstance || !currentRoomId) {
      console.warn('[RoomContext] Cannot paste: no clipboard or no current room')
      return null
    }

    const newInstanceId = `instance-${Date.now()}`
    const newInstance: ItemInstance = {
      ...clipboardInstance,
      id: newInstanceId,
      roomId: currentRoomId,
      // Offset position by 1 foot in X and Z
      position: {
        x: clipboardInstance.position.x + 1,
        y: clipboardInstance.position.y,
        z: clipboardInstance.position.z + 1
      },
      // Clear wall placement and parent surface (paste to floor)
      wallPlacement: undefined,
      parentSurfaceId: undefined,
      parentSurfaceType: undefined,
      placedAt: new Date().toISOString()
    }

    // Add to current room
    setRoomsState(prev => {
      const newState = prev.map(room => {
        if (room.id !== currentRoomId) return room
        return {
          ...room,
          instances: [...(room.instances || []), newInstance]
        }
      })
      queueMicrotask(() => recordHistory(newState))
      return newState
    })

    console.log('[RoomContext] Pasted instance:', newInstanceId)
    return newInstanceId
  }, [clipboardInstance, currentRoomId])

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
        redo,
        clipboardInstance,
        copyInstance,
        pasteInstance
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
