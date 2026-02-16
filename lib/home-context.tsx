'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { Home, Room, ItemInstance, Vector3 } from '@/types/room'
import { FloorplanData } from '@/types/floorplan'
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from './storage'
import { convertFloorplanTo3D } from './floorplan/floorplan-converter'

interface HomeContextType {
  homes: Home[]
  currentHomeId: string | null
  currentHome: Home | null
  createHome: (name: string, rooms: Room[]) => void
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

  // NEW: Floorplan integration
  setFloorplanData: (homeId: string, floorplan: FloorplanData) => void
  getFloorplanData: (homeId: string) => FloorplanData | undefined
  buildRoomsFromFloorplan: (homeId: string, floorplan: FloorplanData) => void
}

const HomeContext = createContext<HomeContextType | undefined>(undefined)

// Example home based on parsed floorplan (Unit 4A)
// NEW: Using instances instead of furniture
const EXAMPLE_HOME: Home = {
  id: 'example-home',
  name: 'Example Apartment - Unit 4A',
  rooms: [
    {
      id: 'terrace',
      name: 'Terrace',
      homeId: 'example-home',
      instances: [],
      cameraPosition: { x: 20, y: 18, z: 35 },
      cameraTarget: { x: 0, y: 2, z: 17 },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    },
    {
      id: 'living-dining',
      name: 'Living/Dining Area',
      homeId: 'example-home',
      instances: [
        {
          id: 'instance-sofa-1',
          itemId: 'item-omhu-sofa',  // References item in library
          roomId: 'living-dining',
          position: { x: -5, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scaleMultiplier: { x: 1, y: 1, z: 1 },
          placedAt: new Date().toISOString()
        },
        {
          id: 'instance-chair-1',
          itemId: 'item-whiteback-chair',  // References item in library
          roomId: 'living-dining',
          position: { x: 5, y: 0, z: 3 },
          rotation: { x: 0, y: -Math.PI / 2, z: 0 },
          scaleMultiplier: { x: 1, y: 1, z: 1 },
          placedAt: new Date().toISOString()
        }
      ],
      cameraPosition: { x: 25, y: 18, z: 20 },
      cameraTarget: { x: 0, y: 2, z: 5 },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    },
    {
      id: 'bedroom',
      name: 'Bedroom',
      homeId: 'example-home',
      instances: [],
      cameraPosition: { x: 18, y: 15, z: 5 },
      cameraTarget: { x: 0, y: 2, z: -10 },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

export function HomeProvider({ children }: { children: ReactNode }) {
  const [homes, setHomes] = useState<Home[]>([])
  const [currentHomeId, setCurrentHomeId] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)

  // Load homes from localStorage on mount
  useEffect(() => {
    const loadedHomes = loadFromStorage<Home[]>(STORAGE_KEYS.HOMES, [EXAMPLE_HOME])
    const loadedCurrentHomeId = loadFromStorage<string>(STORAGE_KEYS.CURRENT_HOME_ID, EXAMPLE_HOME.id)

    setHomes(loadedHomes)
    setCurrentHomeId(loadedCurrentHomeId)
    setIsLoaded(true)
  }, [])

  // Save homes to localStorage whenever they change (debounced)
  useEffect(() => {
    if (!isLoaded) return // Don't save on initial load

    const timeoutId = setTimeout(() => {
      saveToStorage(STORAGE_KEYS.HOMES, homes)
    }, 500) // Debounce for 500ms

    return () => clearTimeout(timeoutId)
  }, [homes, isLoaded])

  // Save current home ID whenever it changes
  useEffect(() => {
    if (!isLoaded) return

    saveToStorage(STORAGE_KEYS.CURRENT_HOME_ID, currentHomeId)
  }, [currentHomeId, isLoaded])

  const currentHome = homes.find(h => h.id === currentHomeId) || null

  const createHome = (name: string, rooms: Room[]) => {
    const newHome: Home = {
      id: `home-${Date.now()}`,
      name,
      rooms,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setHomes(prev => [...prev, newHome])
    setCurrentHomeId(newHome.id)
    return newHome.id
  }

  const deleteHome = (homeId: string) => {
    setHomes(prev => {
      const filtered = prev.filter(h => h.id !== homeId)
      if (homeId === currentHomeId && filtered.length > 0) {
        setCurrentHomeId(filtered[0].id)
      }
      return filtered
    })
  }

  const switchHome = (homeId: string) => {
    if (homes.find(h => h.id === homeId)) {
      setCurrentHomeId(homeId)
    }
  }

  const updateHome = (homeId: string, updates: Partial<Home>) => {
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, ...updates, updatedAt: new Date().toISOString() }
          : home
      )
    )
  }

  const renameHome = (homeId: string, newName: string) => {
    if (!newName.trim()) return
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, name: newName.trim(), updatedAt: new Date().toISOString() }
          : home
      )
    )
  }

  const updateHomeThumbnail = (homeId: string, thumbnailPath: string) => {
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? { ...home, thumbnailPath, updatedAt: new Date().toISOString() }
          : home
      )
    )
  }

  // NEW: Instance management methods
  const addInstanceToRoom = (roomId: string, itemId: string, position: Vector3): string => {
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

    setHomes(prev =>
      prev.map(home => ({
        ...home,
        rooms: home.rooms.map(room =>
          room.id === roomId
            ? {
                ...room,
                instances: [...(room.instances || []), newInstance]
              }
            : room
        ),
        updatedAt: new Date().toISOString()
      }))
    )

    return instanceId
  }

  const updateInstance = (instanceId: string, updates: Partial<ItemInstance>) => {
    setHomes(prev =>
      prev.map(home => ({
        ...home,
        rooms: home.rooms.map(room => ({
          ...room,
          instances: (room.instances || []).map(instance =>
            instance.id === instanceId
              ? { ...instance, ...updates }
              : instance
          )
        })),
        updatedAt: new Date().toISOString()
      }))
    )
  }

  const deleteInstance = (instanceId: string) => {
    setHomes(prev =>
      prev.map(home => ({
        ...home,
        rooms: home.rooms.map(room => ({
          ...room,
          instances: (room.instances || []).filter(instance => instance.id !== instanceId)
        })),
        updatedAt: new Date().toISOString()
      }))
    )
  }

  const getInstancesForItem = (itemId: string) => {
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
  }

  // Delete all instances of a given item across all homes
  const deleteAllInstancesOfItem = (itemId: string) => {
    setHomes(prev =>
      prev.map(home => ({
        ...home,
        rooms: home.rooms.map(room => ({
          ...room,
          instances: (room.instances || []).filter(instance => instance.itemId !== itemId)
        })),
        updatedAt: new Date().toISOString()
      }))
    )
  }

  // NEW: Floorplan integration methods
  const setFloorplanData = (homeId: string, floorplan: FloorplanData) => {
    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? {
              ...home,
              floorplanData: floorplan,
              updatedAt: new Date().toISOString()
            }
          : home
      )
    )
  }

  const getFloorplanData = (homeId: string): FloorplanData | undefined => {
    const home = homes.find(h => h.id === homeId)
    return home?.floorplanData
  }

  const buildRoomsFromFloorplan = (homeId: string, floorplan: FloorplanData) => {
    console.log('[buildRoomsFromFloorplan] Starting conversion for home:', homeId)
    console.log('[buildRoomsFromFloorplan] Floorplan data:', floorplan)

    // Convert 2D floorplan to 3D rooms and shared walls
    const { rooms: rooms3D, sharedWalls } = convertFloorplanTo3D(floorplan)

    console.log('[buildRoomsFromFloorplan] Converted rooms:', rooms3D)
    console.log('[buildRoomsFromFloorplan] Number of rooms:', rooms3D.length)
    console.log('[buildRoomsFromFloorplan] Number of shared walls:', sharedWalls.length)

    setHomes(prev =>
      prev.map(home =>
        home.id === homeId
          ? {
              ...home,
              rooms: rooms3D,
              sharedWalls,  // NEW: Store shared walls
              floorplanData: floorplan,
              updatedAt: new Date().toISOString()
            }
          : home
      )
    )

    console.log('[buildRoomsFromFloorplan] Homes updated successfully')
  }

  return (
    <HomeContext.Provider
      value={{
        homes,
        currentHomeId,
        currentHome,
        createHome,
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
        buildRoomsFromFloorplan
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
