'use client'

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react'
import { Item, ItemCategory } from '@/types/room'
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from './storage'

interface ItemLibraryContextType {
  items: Item[]
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateItem: (id: string, updates: Partial<Omit<Item, 'id' | 'createdAt'>>) => void
  deleteItem: (id: string) => void
  getItem: (id: string) => Item | undefined
  getItemsByCategory: (category: ItemCategory) => Item[]
  searchItems: (query: string) => Item[]
  getItemsByTags: (tags: string[]) => Item[]
}

const ItemLibraryContext = createContext<ItemLibraryContextType | undefined>(undefined)

// Default items seeded from actual models in the project
const DEFAULT_ITEMS: Item[] = [
  {
    id: 'item-omhu-sofa',
    name: 'Omhu Sofa',
    description: 'Modern sectional sofa with clean lines',
    modelPath: '/models/omhu_sofa/omhu_sofa_1.glb',
    dimensions: {
      width: 6.56,
      height: 2.3,
      depth: 3.28
    },
    category: 'seating',
    tags: ['sofa', 'modern', 'seating'],
    placementType: 'floor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-whiteback-chair',
    name: 'Whiteback Wood Chair',
    description: 'Classic wooden chair with white back',
    modelPath: '/models/whiteback-wood-chair.glb',
    dimensions: {
      width: 1.5,
      height: 3,
      depth: 1.5
    },
    category: 'seating',
    tags: ['chair', 'wood', 'classic'],
    placementType: 'floor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-extending-table',
    name: 'Extending Table',
    description: 'Modern extending dining table',
    modelPath: '/models/extending_table/extended_table.glb',
    dimensions: {
      width: 6,
      height: 2.5,
      depth: 3.5
    },
    category: 'table',
    tags: ['table', 'dining', 'modern', 'extending'],
    placementType: 'floor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-sundays-dream-bed',
    name: "Sunday's Dream Bed",
    description: 'Comfortable modern bed frame',
    modelPath: '/models/beds/sundays_dream_bed.glb',
    dimensions: {
      width: 6,
      height: 2.5,
      depth: 7
    },
    category: 'bed',
    tags: ['bed', 'modern', 'bedroom', 'furniture'],
    placementType: 'floor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  // Wall-mounted items
  {
    id: 'item-wall-sconce',
    name: 'Wall Sconce Light',
    description: 'Modern wall-mounted light fixture',
    parametricShape: {
      type: 'extrusion',
      points: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.8 },
        { x: 0.25, y: 1.2 },
        { x: 0, y: 0.8 }
      ],
      height: 0.3,
      color: '#d4af37'  // Gold color
    },
    dimensions: {
      width: 0.5,
      height: 1.2,
      depth: 0.3
    },
    category: 'lighting',
    tags: ['sconce', 'wall', 'light', 'modern'],
    placementType: 'wall',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-picture-frame',
    name: 'Picture Frame',
    description: 'Wall-mounted picture frame',
    parametricShape: {
      type: 'extrusion',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1.5 },
        { x: 0, y: 1.5 }
      ],
      height: 0.1,
      color: '#4a3728'  // Brown frame
    },
    dimensions: {
      width: 2,
      height: 1.5,
      depth: 0.1
    },
    category: 'decoration',
    tags: ['frame', 'picture', 'wall', 'art'],
    placementType: 'wall',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  // Ceiling-mounted items
  {
    id: 'item-pendant-light',
    name: 'Pendant Light',
    description: 'Modern ceiling-mounted pendant lamp',
    parametricShape: {
      type: 'extrusion',
      points: [
        { x: 0, y: 0 },
        { x: 0.8, y: 0 },
        { x: 0.6, y: 1 },
        { x: 0.2, y: 1 }
      ],
      height: 0.6,
      color: '#f5f5f5'  // White/cream
    },
    dimensions: {
      width: 0.8,
      height: 1,
      depth: 0.6
    },
    category: 'lighting',
    tags: ['pendant', 'ceiling', 'light', 'modern'],
    placementType: 'ceiling',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-ceiling-fan',
    name: 'Ceiling Fan',
    description: 'Ceiling-mounted fan with light',
    parametricShape: {
      type: 'extrusion',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 0.3 },
        { x: 1.5, y: 0.5 },
        { x: 0.5, y: 0.5 },
        { x: 0, y: 0.3 }
      ],
      height: 2,
      color: '#8b4513'  // Brown wood color
    },
    dimensions: {
      width: 2,
      height: 0.5,
      depth: 2
    },
    category: 'lighting',
    tags: ['fan', 'ceiling', 'modern'],
    placementType: 'ceiling',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  }
]

export function ItemLibraryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load items from localStorage on mount
  useEffect(() => {
    const loadedItems = loadFromStorage<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS)
    setItems(loadedItems)
    setIsLoaded(true)
  }, [])

  // Save items to localStorage whenever they change (debounced)
  useEffect(() => {
    if (!isLoaded) return // Don't save on initial load

    const timeoutId = setTimeout(() => {
      saveToStorage(STORAGE_KEYS.ITEMS, items)
    }, 500) // Debounce for 500ms

    return () => clearTimeout(timeoutId)
  }, [items, isLoaded])

  // Listen for GLB generation completion and auto-update items
  useEffect(() => {
    const handleGlbComplete = (event: CustomEvent<{
      itemId: string
      modelPath: string
      jobId: string
    }>) => {
      const { itemId, modelPath } = event.detail
      if (!modelPath) return

      // Update the item with the new model path
      setItems(prev => prev.map(item => {
        if (item.id !== itemId) return item

        return {
          ...item,
          modelPath,
          generationStatus: undefined, // Clear generation status
          updatedAt: new Date().toISOString(),
        }
      }))

      console.log(`[ItemLibrary] Auto-updated item ${itemId} with model: ${modelPath}`)
    }

    window.addEventListener('trellis-glb-complete', handleGlbComplete as EventListener)
    return () => {
      window.removeEventListener('trellis-glb-complete', handleGlbComplete as EventListener)
    }
  }, [])

  const addItem = useCallback((itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newItem: Item = {
      ...itemData,
      id: `item-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setItems(prev => [...prev, newItem])
    return newItem.id
  }, [])

  const updateItem = useCallback((id: string, updates: Partial<Omit<Item, 'id' | 'createdAt'>>) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item
      )
    )
  }, [])

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const getItem = useCallback((id: string) => {
    return items.find(item => item.id === id)
  }, [items])

  const getItemsByCategory = useCallback((category: ItemCategory) => {
    return items.filter(item => item.category === category)
  }, [items])

  const searchItems = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase()
    return items.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(lowerQuery)
      const descMatch = item.description?.toLowerCase().includes(lowerQuery)
      const tagMatch = item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      return nameMatch || descMatch || tagMatch
    })
  }, [items])

  const getItemsByTags = useCallback((tags: string[]) => {
    return items.filter(item =>
      tags.some(tag => item.tags.includes(tag))
    )
  }, [items])

  return (
    <ItemLibraryContext.Provider
      value={{
        items,
        addItem,
        updateItem,
        deleteItem,
        getItem,
        getItemsByCategory,
        searchItems,
        getItemsByTags
      }}
    >
      {children}
    </ItemLibraryContext.Provider>
  )
}

export function useItemLibrary() {
  const context = useContext(ItemLibraryContext)
  if (context === undefined) {
    throw new Error('useItemLibrary must be used within an ItemLibraryProvider')
  }
  return context
}
