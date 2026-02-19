'use client'

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react'
import { Home, Room, ItemInstance, Vector3 } from '@/types/room'
import { FloorplanData } from '@/types/floorplan'
import { FloorplanDataV2, FloorplanDataV3 } from '@/types/floorplan-v2'
import { HomeRow } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from './storage'
import { convertFloorplanTo3D } from './floorplan/floorplan-converter'
import { convertV2To3D } from './utils/floorplan-geometry'
import { copyHome as copyHomeUtil, CopyMode } from './utils/copy-home'

interface HomeContextType {
  homes: Home[]
  currentHomeId: string | null
  currentHome: Home | null
  isLoading: boolean
  createHome: (name: string, rooms: Room[]) => void
  copyHome: (homeId: string, mode: CopyMode) => string | null
  deleteHome: (homeId: string) => void
  switchHome: (homeId: string) => void
  updateHome: (homeId: string, updates: Partial<Home>) => void
  renameHome: (homeId: string, newName: string) => void
  updateHomeThumbnail: (homeId: string, thumbnailPath: string) => void

  // NEW: Instance management
  addInstanceToRoom: (roomId: string, itemId: string, position: Vector3) => string
  updateInstance: (instanceId: string, updates: Partial<ItemInstance>) => void
  deleteInstance: (instanceId: string) => void
  deleteAllInstancesOfItem: (itemId: string) => void
  getInstancesForItem: (itemId: string) => Array<{
    instance: ItemInstance
    room: Room
    home: Home
  }>

  // Floorplan V1 integration
  setFloorplanData: (homeId: string, floorplan: FloorplanData) => void
  getFloorplanData: (homeId: string) => FloorplanData | undefined
  buildRoomsFromFloorplan: (homeId: string, floorplan: FloorplanData) => void

  // Floorplan V2 (wall-first) integration
  setFloorplanDataV2: (homeId: string, data: FloorplanDataV2) => void
  getFloorplanDataV2: (homeId: string) => FloorplanDataV2 | undefined
  buildRoomsFromFloorplanV2: (homeId: string, data: FloorplanDataV2) => void

  // Two-way sync: 3D → V2
  syncRoomChangesToFloorplanV2: (homeId: string, roomId: string, updates: Partial<Room>) => void

  // Floorplan V3 (two-sided wall segments with styles/doors)
  setFloorplanDataV3: (homeId: string, data: FloorplanDataV3) => void
  getFloorplanDataV3: (homeId: string) => FloorplanDataV3 | undefined

  // Force immediate save (bypasses debounce)
  flushHomesToStorage: () => void
}

const HomeContext = createContext<HomeContextType | undefined>(undefined)

// Convert database row to Home interface
function rowToHome(row: HomeRow): Home {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    thumbnailPath: row.thumbnail_path || undefined,
    rooms: row.rooms || [],
    sharedWalls: row.shared_walls || undefined,
    floorplanData: row.floorplan_data || undefined,
    floorplanDataV2: row.floorplan_data_v2 || undefined,
    floorplanDataV3: row.floorplan_data_v3 || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Convert Home interface to database row format
function homeToRow(home: Home): Omit<HomeRow, 'created_at' | 'updated_at'> {
  return {
    id: home.id,
    name: home.name,
    description: home.description || null,
    thumbnail_path: home.thumbnailPath || null,
    rooms: home.rooms || [],
    shared_walls: home.sharedWalls || null,
    floorplan_data: home.floorplanData || null,
    floorplan_data_v2: home.floorplanDataV2 || null,
    floorplan_data_v3: home.floorplanDataV3 || null,
  }
}

export function HomeProvider({ children }: { children: ReactNode }) {
  const [homes, setHomes] = useState<Home[]>([])
  const [currentHomeId, setCurrentHomeId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

  // Debounce timer ref for Supabase updates
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingUpdatesRef = useRef<Map<string, Partial<Home>>>(new Map())

  // Load homes from Supabase on mount
  useEffect(() => {
    const supabase = createClient()

    async function loadHomes() {
      try {
        const { data, error } = await supabase
          .from('homes')
          .select('*')
          .order('updated_at', { ascending: false })

        if (error) {
          console.error('[HomeContext] Supabase error, falling back to localStorage:', error)
          loadFromLocalStorage()
          return
        }

        if (data && data.length > 0) {
          console.log('[HomeContext] Loaded', data.length, 'homes from Supabase')
          setHomes(data.map(rowToHome))
        } else {
          // Supabase is empty - check for localStorage migration
          await migrateFromLocalStorage(supabase)
        }
      } catch (err) {
        console.error('[HomeContext] Error loading homes:', err)
        loadFromLocalStorage()
      } finally {
        setIsLoading(false)
      }
    }

    function loadFromLocalStorage() {
      const localHomes = loadFromStorage<Home[]>(STORAGE_KEYS.HOMES, [])
      console.log('[HomeContext] Loaded', localHomes.length, 'homes from localStorage')
      setHomes(localHomes)
      setIsLoading(false)
    }

    async function migrateFromLocalStorage(supabase: ReturnType<typeof createClient>) {
      const localHomes = loadFromStorage<Home[]>(STORAGE_KEYS.HOMES, [])

      if (localHomes.length === 0) {
        console.log('[HomeContext] No homes to migrate')
        setHomes([])
        return
      }

      console.log('[HomeContext] Migrating', localHomes.length, 'homes from localStorage to Supabase')

      // Insert all homes
      const { data, error } = await supabase
        .from('homes')
        .upsert(localHomes.map(homeToRow))
        .select()

      if (error) {
        console.error('[HomeContext] Migration failed:', error)
        setHomes(localHomes)
      } else if (data) {
        setHomes(data.map(rowToHome))
        // Clear localStorage after successful migration
        saveToStorage(STORAGE_KEYS.HOMES, [])
        console.log('[HomeContext] Migration complete, localStorage cleared')
      }
    }

    // Load current home ID from localStorage (simple preference, no need to migrate)
    const loadedCurrentHomeId = loadFromStorage<string>(STORAGE_KEYS.CURRENT_HOME_ID, '')
    setCurrentHomeId(loadedCurrentHomeId)

    loadHomes()
  }, [])

  // Subscribe to realtime updates for multi-tab sync
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('homes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'homes' },
        (payload) => {
          console.log('[HomeContext] Realtime update:', payload.eventType)

          if (payload.eventType === 'INSERT') {
            const newHome = rowToHome(payload.new as HomeRow)
            setHomes(prev => {
              // Avoid duplicates (might already have it from optimistic update)
              if (prev.some(h => h.id === newHome.id)) {
                return prev.map(h => h.id === newHome.id ? newHome : h)
              }
              return [newHome, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedHome = rowToHome(payload.new as HomeRow)
            setHomes(prev => prev.map(home =>
              home.id === updatedHome.id ? updatedHome : home
            ))
          } else if (payload.eventType === 'DELETE') {
            const deletedHome = payload.old as HomeRow
            setHomes(prev => prev.filter(home => home.id !== deletedHome.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Save current home ID to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveToStorage(STORAGE_KEYS.CURRENT_HOME_ID, currentHomeId)
    }
  }, [currentHomeId, isLoading])

  // Helper to save a home to Supabase (debounced)
  const saveHomeToSupabase = useCallback((homeId: string, updates: Partial<Home>) => {
    // Accumulate updates
    const existing = pendingUpdatesRef.current.get(homeId) || {}
    pendingUpdatesRef.current.set(homeId, { ...existing, ...updates })

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout (500ms debounce)
    saveTimeoutRef.current = setTimeout(async () => {
      const supabase = createClient()

      for (const [id, partialHome] of pendingUpdatesRef.current) {
        // Get the full home to convert properly
        const fullHome = homes.find(h => h.id === id)
        if (!fullHome) continue

        const mergedHome = { ...fullHome, ...partialHome }
        const row = homeToRow(mergedHome)

        const { error } = await supabase
          .from('homes')
          .update({
            ...row,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (error) {
          console.error('[HomeContext] Failed to save home to Supabase:', error)
        }
      }

      pendingUpdatesRef.current.clear()
    }, 500)
  }, [homes])

  const currentHome = homes.find(h => h.id === currentHomeId) || null

  const createHome = useCallback((name: string, rooms: Room[]) => {
    const newHome: Home = {
      id: `home-${Date.now()}`,
      name,
      rooms,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Optimistic update
    setHomes(prev => [...prev, newHome])
    setCurrentHomeId(newHome.id)

    // Insert into Supabase
    const supabase = createClient()
    supabase
      .from('homes')
      .insert(homeToRow(newHome))
      .then(({ error }) => {
        if (error) {
          console.error('[HomeContext] Failed to create home in Supabase:', error)
        }
      })

    return newHome.id
  }, [])

  const copyHome = useCallback((homeId: string, mode: CopyMode): string | null => {
    const sourceHome = homes.find(h => h.id === homeId)
    if (!sourceHome) {
      console.error('[HomeContext] Cannot copy: home not found', homeId)
      return null
    }

    const newHome = copyHomeUtil(sourceHome, mode)
    console.log('[HomeContext] Copying home:', sourceHome.name, '→', newHome.name, 'mode:', mode)

    // Optimistic update
    setHomes(prev => [...prev, newHome])

    // Insert into Supabase
    const supabase = createClient()
    supabase
      .from('homes')
      .insert(homeToRow(newHome))
      .then(({ error }) => {
        if (error) {
          console.error('[HomeContext] Failed to copy home to Supabase:', error)
          // Rollback on error
          setHomes(prev => prev.filter(h => h.id !== newHome.id))
        } else {
          console.log('[HomeContext] Home copied successfully:', newHome.id)
        }
      })

    return newHome.id
  }, [homes])

  const deleteHome = useCallback((homeId: string) => {
    // Optimistic update
    setHomes(prev => {
      const filtered = prev.filter(h => h.id !== homeId)
      if (homeId === currentHomeId && filtered.length > 0) {
        setCurrentHomeId(filtered[0].id)
      }
      return filtered
    })

    // Delete from Supabase
    const supabase = createClient()
    supabase
      .from('homes')
      .delete()
      .eq('id', homeId)
      .then(({ error }) => {
        if (error) {
          console.error('[HomeContext] Failed to delete home from Supabase:', error)
        }
      })
  }, [currentHomeId])

  const switchHome = useCallback((homeId: string) => {
    if (homes.find(h => h.id === homeId)) {
      setCurrentHomeId(homeId)
    }
  }, [homes])

  const updateHome = useCallback((homeId: string, updates: Partial<Home>) => {
    const updatedAt = new Date().toISOString()

    // Optimistic update
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, ...updates, updatedAt }
          : home
      )
    )

    // Save to Supabase (debounced)
    saveHomeToSupabase(homeId, { ...updates, updatedAt })
  }, [saveHomeToSupabase])

  const renameHome = useCallback((homeId: string, newName: string) => {
    if (!newName.trim()) return

    const updatedAt = new Date().toISOString()

    // Optimistic update
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, name: newName.trim(), updatedAt }
          : home
      )
    )

    // Save to Supabase (debounced)
    saveHomeToSupabase(homeId, { name: newName.trim(), updatedAt })
  }, [saveHomeToSupabase])

  const updateHomeThumbnail = useCallback((homeId: string, thumbnailPath: string) => {
    const updatedAt = new Date().toISOString()

    // Optimistic update
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, thumbnailPath, updatedAt }
          : home
      )
    )

    // Save to Supabase (debounced)
    saveHomeToSupabase(homeId, { thumbnailPath, updatedAt })
  }, [saveHomeToSupabase])

  // Instance management methods
  const addInstanceToRoom = useCallback((roomId: string, itemId: string, position: Vector3): string => {
    const instanceId = `instance-${Date.now()}`
    const newInstance: ItemInstance = {
      id: instanceId,
      itemId,
      roomId,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      scaleMultiplier: { x: 1, y: 1, z: 1 },
      placedAt: new Date().toISOString()
    }

    const updatedAt = new Date().toISOString()

    // Optimistic update
    setHomes(prev =>
      prev.map(home => {
        const hasRoom = home.rooms.some(r => r.id === roomId)
        if (!hasRoom) return home

        const updatedRooms = home.rooms.map(room =>
          room.id === roomId
            ? { ...room, instances: [...(room.instances || []), newInstance] }
            : room
        )

        // Also trigger Supabase save for this home
        saveHomeToSupabase(home.id, { rooms: updatedRooms, updatedAt })

        return { ...home, rooms: updatedRooms, updatedAt }
      })
    )

    return instanceId
  }, [saveHomeToSupabase])

  const updateInstance = useCallback((instanceId: string, updates: Partial<ItemInstance>) => {
    const updatedAt = new Date().toISOString()

    setHomes(prev =>
      prev.map(home => {
        const hasInstance = home.rooms.some(r =>
          (r.instances || []).some(i => i.id === instanceId)
        )
        if (!hasInstance) return home

        const updatedRooms = home.rooms.map(room => ({
          ...room,
          instances: (room.instances || []).map(instance =>
            instance.id === instanceId
              ? { ...instance, ...updates }
              : instance
          )
        }))

        saveHomeToSupabase(home.id, { rooms: updatedRooms, updatedAt })

        return { ...home, rooms: updatedRooms, updatedAt }
      })
    )
  }, [saveHomeToSupabase])

  const deleteInstance = useCallback((instanceId: string) => {
    const updatedAt = new Date().toISOString()

    setHomes(prev =>
      prev.map(home => {
        const hasInstance = home.rooms.some(r =>
          (r.instances || []).some(i => i.id === instanceId)
        )
        if (!hasInstance) return home

        const updatedRooms = home.rooms.map(room => {
          const instances = room.instances || []
          const deletedInstance = instances.find(inst => inst.id === instanceId)

          if (!deletedInstance) {
            return {
              ...room,
              instances: instances.filter(instance => instance.id !== instanceId)
            }
          }

          // Reparent children
          const updatedInstances = instances
            .filter(instance => instance.id !== instanceId)
            .map(instance => {
              if (instance.parentSurfaceId === instanceId) {
                const worldPosition = {
                  x: instance.position.x + deletedInstance.position.x,
                  y: instance.position.y,
                  z: instance.position.z + deletedInstance.position.z
                }
                return {
                  ...instance,
                  position: worldPosition,
                  parentSurfaceId: 'floor',
                  parentSurfaceType: 'floor' as const
                }
              }
              return instance
            })

          return { ...room, instances: updatedInstances }
        })

        saveHomeToSupabase(home.id, { rooms: updatedRooms, updatedAt })

        return { ...home, rooms: updatedRooms, updatedAt }
      })
    )
  }, [saveHomeToSupabase])

  const getInstancesForItem = useCallback((itemId: string) => {
    const results: Array<{
      instance: ItemInstance
      room: Room
      home: Home
    }> = []

    homes.forEach(home => {
      home.rooms.forEach(room => {
        const instances = room.instances || []
        instances.forEach(instance => {
          if (instance.itemId === itemId) {
            results.push({ instance, room, home })
          }
        })
      })
    })

    return results
  }, [homes])

  const deleteAllInstancesOfItem = useCallback((itemId: string) => {
    const updatedAt = new Date().toISOString()

    setHomes(prev =>
      prev.map(home => {
        const hasItem = home.rooms.some(r =>
          (r.instances || []).some(i => i.itemId === itemId)
        )
        if (!hasItem) return home

        const updatedRooms = home.rooms.map(room => ({
          ...room,
          instances: (room.instances || []).filter(instance => instance.itemId !== itemId)
        }))

        saveHomeToSupabase(home.id, { rooms: updatedRooms, updatedAt })

        return { ...home, rooms: updatedRooms, updatedAt }
      })
    )
  }, [saveHomeToSupabase])

  // Floorplan V1 methods
  const setFloorplanData = useCallback((homeId: string, floorplan: FloorplanData) => {
    const updatedAt = new Date().toISOString()

    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, floorplanData: floorplan, updatedAt }
          : home
      )
    )

    saveHomeToSupabase(homeId, { floorplanData: floorplan, updatedAt })
  }, [saveHomeToSupabase])

  const getFloorplanData = useCallback((homeId: string): FloorplanData | undefined => {
    const home = homes.find(h => h.id === homeId)
    return home?.floorplanData
  }, [homes])

  const buildRoomsFromFloorplan = useCallback((homeId: string, floorplan: FloorplanData) => {
    console.log('[buildRoomsFromFloorplan] Starting conversion for home:', homeId)

    const { rooms: rooms3D, sharedWalls } = convertFloorplanTo3D(floorplan)
    const updatedAt = new Date().toISOString()

    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, rooms: rooms3D, sharedWalls, floorplanData: floorplan, updatedAt }
          : home
      )
    )

    // Immediate save for navigation
    const supabase = createClient()
    const home = homes.find(h => h.id === homeId)
    if (home) {
      const updatedHome = { ...home, rooms: rooms3D, sharedWalls, floorplanData: floorplan, updatedAt }
      supabase
        .from('homes')
        .update({ ...homeToRow(updatedHome), updated_at: updatedAt })
        .eq('id', homeId)
        .then(({ error }) => {
          if (error) console.error('[HomeContext] Failed to save floorplan:', error)
        })
    }

    console.log('[buildRoomsFromFloorplan] Completed')
  }, [homes])

  // Floorplan V2 methods
  const setFloorplanDataV2 = useCallback((homeId: string, data: FloorplanDataV2) => {
    const updatedAt = new Date().toISOString()

    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, floorplanDataV2: data, updatedAt }
          : home
      )
    )

    saveHomeToSupabase(homeId, { floorplanDataV2: data, updatedAt })
  }, [saveHomeToSupabase])

  const getFloorplanDataV2 = useCallback((homeId: string): FloorplanDataV2 | undefined => {
    const home = homes.find(h => h.id === homeId)
    return home?.floorplanDataV2
  }, [homes])

  const buildRoomsFromFloorplanV2 = useCallback((homeId: string, data: FloorplanDataV2) => {
    console.log('[buildRoomsFromFloorplanV2] Starting conversion for home:', homeId)

    const { rooms: rooms3D, sharedWalls } = convertV2To3D(
      data.vertices,
      data.walls,
      data.rooms,
      homeId
    )

    const roomsWithHomeId = rooms3D.map(room => ({ ...room, homeId }))
    const updatedAt = new Date().toISOString()

    // Optimistic update
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, rooms: roomsWithHomeId, sharedWalls, floorplanDataV2: data, updatedAt }
          : home
      )
    )

    // Immediate save to Supabase (critical for navigation)
    const supabase = createClient()
    const home = homes.find(h => h.id === homeId)
    if (home) {
      const updatedHome = {
        ...home,
        rooms: roomsWithHomeId,
        sharedWalls,
        floorplanDataV2: data,
        updatedAt
      }
      supabase
        .from('homes')
        .update({ ...homeToRow(updatedHome), updated_at: updatedAt })
        .eq('id', homeId)
        .then(({ error }) => {
          if (error) console.error('[HomeContext] Failed to save V2 floorplan:', error)
          else console.log('[buildRoomsFromFloorplanV2] Saved to Supabase')
        })
    }

    console.log('[buildRoomsFromFloorplanV2] Completed')
  }, [homes])

  // V3 Floorplan methods
  const setFloorplanDataV3 = useCallback((homeId: string, data: FloorplanDataV3) => {
    console.log('[HomeContext] setFloorplanDataV3 called for home:', homeId)
    const updatedAt = new Date().toISOString()

    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, floorplanDataV3: data, updatedAt }
          : home
      )
    )

    saveHomeToSupabase(homeId, { floorplanDataV3: data, updatedAt })
  }, [saveHomeToSupabase])

  const getFloorplanDataV3 = useCallback((homeId: string): FloorplanDataV3 | undefined => {
    const home = homes.find(h => h.id === homeId)
    return home?.floorplanDataV3
  }, [homes])

  // Two-way sync: 3D → V2
  const syncRoomChangesToFloorplanV2 = useCallback((homeId: string, roomId: string, updates: Partial<Room>) => {
    const home = homes.find(h => h.id === homeId)
    if (!home || !home.floorplanDataV2) return

    const v2Data = home.floorplanDataV2
    let hasChanges = false

    const v2RoomIndex = v2Data.rooms.findIndex(r => r.id === roomId)
    if (v2RoomIndex === -1) return

    const updatedRooms = [...v2Data.rooms]
    const v2Room = { ...updatedRooms[v2RoomIndex] }

    // Sync room name
    if (updates.name && updates.name !== v2Room.name) {
      v2Room.name = updates.name
      hasChanges = true
    }

    // Sync wall height
    if (updates.dimensions?.height) {
      const newHeight = updates.dimensions.height
      const updatedWalls = v2Data.walls.map(wall => {
        if (v2Room.wallIds.includes(wall.id) && wall.height !== newHeight) {
          hasChanges = true
          return { ...wall, height: newHeight }
        }
        return wall
      })

      if (hasChanges) {
        const updatedV2Data: FloorplanDataV2 = {
          ...v2Data,
          rooms: updatedRooms.map((r, i) => (i === v2RoomIndex ? v2Room : r)),
          walls: updatedWalls,
          updatedAt: new Date().toISOString(),
        }
        setFloorplanDataV2(homeId, updatedV2Data)
        return
      }
    }

    if (hasChanges) {
      updatedRooms[v2RoomIndex] = v2Room
      const updatedV2Data: FloorplanDataV2 = {
        ...v2Data,
        rooms: updatedRooms,
        updatedAt: new Date().toISOString(),
      }
      setFloorplanDataV2(homeId, updatedV2Data)
    }
  }, [homes, setFloorplanDataV2])

  // Force flush - now just triggers immediate Supabase save
  const flushHomesToStorage = useCallback(() => {
    console.log('[HomeContext] Flushing homes to Supabase immediately')

    // Clear pending debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Save all pending updates immediately
    const supabase = createClient()
    for (const [id, partialHome] of pendingUpdatesRef.current) {
      const fullHome = homes.find(h => h.id === id)
      if (!fullHome) continue

      const mergedHome = { ...fullHome, ...partialHome }
      const row = homeToRow(mergedHome)

      supabase
        .from('homes')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[HomeContext] Flush failed:', error)
        })
    }

    pendingUpdatesRef.current.clear()

    // Also save to localStorage as backup
    saveToStorage(STORAGE_KEYS.HOMES, homes)
  }, [homes])

  return (
    <HomeContext.Provider
      value={{
        homes,
        currentHomeId,
        currentHome,
        isLoading,
        createHome,
        copyHome,
        deleteHome,
        switchHome,
        updateHome,
        renameHome,
        updateHomeThumbnail,
        addInstanceToRoom,
        updateInstance,
        deleteInstance,
        deleteAllInstancesOfItem,
        getInstancesForItem,
        setFloorplanData,
        getFloorplanData,
        buildRoomsFromFloorplan,
        setFloorplanDataV2,
        getFloorplanDataV2,
        buildRoomsFromFloorplanV2,
        syncRoomChangesToFloorplanV2,
        setFloorplanDataV3,
        getFloorplanDataV3,
        flushHomesToStorage
      }}
    >
      {children}
    </HomeContext.Provider>
  )
}

export function useHome() {
  const context = useContext(HomeContext)
  if (context === undefined) {
    throw new Error('useHome must be used within a HomeProvider')
  }
  return context
}
