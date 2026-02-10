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

// Default items seeded from the furniture catalog and existing models
const DEFAULT_ITEMS: Item[] = [
  // Real models that exist in the project
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  // Placeholder items from catalog (models may not exist yet)
  {
    id: 'item-generic-chair',
    name: 'Chair',
    description: 'Generic chair placeholder',
    modelPath: '/models/chair.glb',
    dimensions: {
      width: 1.5,
      height: 3,
      depth: 1.5
    },
    category: 'seating',
    tags: ['chair', 'generic'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-generic-table',
    name: 'Table',
    description: 'Generic table placeholder',
    modelPath: '/models/table.glb',
    dimensions: {
      width: 4,
      height: 2.5,
      depth: 3
    },
    category: 'table',
    tags: ['table', 'generic'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-generic-bed',
    name: 'Bed',
    description: 'Generic bed placeholder',
    modelPath: '/models/bed.glb',
    dimensions: {
      width: 6,
      height: 2,
      depth: 7
    },
    category: 'bed',
    tags: ['bed', 'generic'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-generic-desk',
    name: 'Desk',
    description: 'Generic desk placeholder',
    modelPath: '/models/desk.glb',
    dimensions: {
      width: 4,
      height: 2.5,
      depth: 2
    },
    category: 'table',
    tags: ['desk', 'generic', 'office'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-generic-bookshelf',
    name: 'Bookshelf',
    description: 'Generic bookshelf placeholder',
    modelPath: '/models/bookshelf.glb',
    dimensions: {
      width: 3,
      height: 6,
      depth: 1
    },
    category: 'storage',
    tags: ['bookshelf', 'storage', 'generic'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-generic-lamp',
    name: 'Lamp',
    description: 'Generic lamp placeholder',
    modelPath: '/models/lamp.glb',
    dimensions: {
      width: 1,
      height: 2,
      depth: 1
    },
    category: 'lighting',
    tags: ['lamp', 'lighting', 'generic'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCustom: false
  },
  {
    id: 'item-generic-plant',
    name: 'Plant',
    description: 'Generic plant decoration',
    modelPath: '/models/plant.glb',
    dimensions: {
      width: 1.5,
      height: 2,
      depth: 1.5
    },
    category: 'decoration',
    tags: ['plant', 'decoration', 'generic'],
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
