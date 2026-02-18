'use client'

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react'
import { Item, ItemCategory } from '@/types/room'
import { ItemRow } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { loadFromStorage, saveToStorage, STORAGE_KEYS } from './storage'

interface ItemLibraryContextType {
  items: Item[]
  isLoading: boolean
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
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

// Convert database row to Item interface
function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    modelPath: row.model_path || undefined,
    thumbnailPath: row.thumbnail_path || undefined,
    images: row.images || undefined,
    parametricShape: row.parametric_shape || undefined,
    generationStatus: row.generation_status || undefined,
    dimensions: row.dimensions,
    category: row.category as ItemCategory,
    tags: row.tags || [],
    placementType: row.placement_type as Item['placementType'] || undefined,
    materialOverrides: row.material_overrides || undefined,
    defaultRotation: row.default_rotation || undefined,
    productUrl: row.product_url || undefined,
    isCustom: row.is_custom,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Convert Item to database row format
function itemToRow(item: Item): Omit<ItemRow, 'created_at' | 'updated_at'> {
  return {
    id: item.id,
    name: item.name,
    description: item.description || null,
    model_path: item.modelPath || null,
    thumbnail_path: item.thumbnailPath || null,
    images: item.images || null,
    parametric_shape: item.parametricShape || null,
    generation_status: item.generationStatus || null,
    dimensions: item.dimensions,
    category: item.category,
    tags: item.tags || [],
    placement_type: item.placementType || null,
    material_overrides: item.materialOverrides || null,
    default_rotation: item.defaultRotation || null,
    product_url: item.productUrl || null,
    is_custom: item.isCustom,
  }
}

export function ItemLibraryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load items from Supabase and subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient()

    async function loadItems() {
      try {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[ItemLibrary] Failed to load items from Supabase:', error)
          // Fall back to localStorage on error
          const localItems = loadFromStorage<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS)
          setItems(localItems)
          setIsLoading(false)
          return
        }

        if (data && data.length > 0) {
          setItems(data.map(rowToItem))
        } else {
          // No items in Supabase - seed with defaults and migrate localStorage
          await seedAndMigrateItems(supabase)
        }
      } catch (err) {
        console.error('[ItemLibrary] Error loading items:', err)
        // Fall back to localStorage
        const localItems = loadFromStorage<Item[]>(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS)
        setItems(localItems)
      } finally {
        setIsLoading(false)
      }
    }

    async function seedAndMigrateItems(supabase: ReturnType<typeof createClient>) {
      // Check for localStorage items to migrate
      const localItems = loadFromStorage<Item[]>(STORAGE_KEYS.ITEMS, [])
      const itemsToInsert = [...DEFAULT_ITEMS]

      // Add custom items from localStorage that aren't defaults
      const defaultIds = new Set(DEFAULT_ITEMS.map(i => i.id))
      for (const localItem of localItems) {
        if (!defaultIds.has(localItem.id) && localItem.isCustom) {
          itemsToInsert.push(localItem)
          console.log('[ItemLibrary] Migrating localStorage item:', localItem.name)
        }
      }

      // Insert all items
      const { data, error } = await supabase
        .from('items')
        .upsert(itemsToInsert.map(itemToRow))
        .select()

      if (error) {
        console.error('[ItemLibrary] Failed to seed items:', error)
        setItems(localItems.length > 0 ? localItems : DEFAULT_ITEMS)
      } else if (data) {
        setItems(data.map(rowToItem))
        console.log('[ItemLibrary] Seeded and migrated items to Supabase')

        // Clear localStorage items since they're now in Supabase
        if (localItems.length > 0) {
          saveToStorage(STORAGE_KEYS.ITEMS, [])
        }
      }
    }

    loadItems()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('items_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        (payload) => {
          console.log('[ItemLibrary] Realtime update:', payload.eventType)

          if (payload.eventType === 'INSERT') {
            const newItem = rowToItem(payload.new as ItemRow)
            setItems(prev => {
              // Avoid duplicates
              if (prev.some(i => i.id === newItem.id)) {
                return prev.map(i => i.id === newItem.id ? newItem : i)
              }
              return [newItem, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = rowToItem(payload.new as ItemRow)
            setItems(prev => prev.map(item =>
              item.id === updatedItem.id ? updatedItem : item
            ))
          } else if (payload.eventType === 'DELETE') {
            const deletedItem = payload.old as ItemRow
            setItems(prev => prev.filter(item => item.id !== deletedItem.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Listen for GLB generation completion and auto-update items
  useEffect(() => {
    const handleGlbComplete = (event: CustomEvent<{
      itemId: string
      modelPath: string
      jobId: string
    }>) => {
      const { itemId, modelPath } = event.detail
      if (!modelPath) return

      // Update via Supabase (will trigger realtime update)
      const supabase = createClient()
      supabase
        .from('items')
        .update({
          model_path: modelPath,
          generation_status: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .then(({ error }) => {
          if (error) {
            console.error('[ItemLibrary] Failed to update item with model:', error)
          } else {
            console.log(`[ItemLibrary] Auto-updated item ${itemId} with model: ${modelPath}`)
          }
        })
    }

    window.addEventListener('trellis-glb-complete', handleGlbComplete as EventListener)
    return () => {
      window.removeEventListener('trellis-glb-complete', handleGlbComplete as EventListener)
    }
  }, [])

  const addItem = useCallback(async (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const newItem: Item = {
      ...itemData,
      id: `item-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Optimistically update local state
    setItems(prev => [newItem, ...prev])

    // Insert into Supabase
    const supabase = createClient()
    const { error } = await supabase
      .from('items')
      .insert(itemToRow(newItem))

    if (error) {
      console.error('[ItemLibrary] Failed to add item to Supabase:', error)
      // Keep the optimistic update - it will sync when connection is restored
    }

    return newItem.id
  }, [])

  const updateItem = useCallback((id: string, updates: Partial<Omit<Item, 'id' | 'createdAt'>>) => {
    // Optimistically update local state
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updates, updatedAt: new Date().toISOString() }
          : item
      )
    )

    // Update in Supabase
    const supabase = createClient()
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Map camelCase to snake_case
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.modelPath !== undefined) dbUpdates.model_path = updates.modelPath
    if (updates.thumbnailPath !== undefined) dbUpdates.thumbnail_path = updates.thumbnailPath
    if (updates.images !== undefined) dbUpdates.images = updates.images
    if (updates.parametricShape !== undefined) dbUpdates.parametric_shape = updates.parametricShape
    if (updates.generationStatus !== undefined) dbUpdates.generation_status = updates.generationStatus
    if (updates.dimensions !== undefined) dbUpdates.dimensions = updates.dimensions
    if (updates.category !== undefined) dbUpdates.category = updates.category
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags
    if (updates.placementType !== undefined) dbUpdates.placement_type = updates.placementType
    if (updates.materialOverrides !== undefined) dbUpdates.material_overrides = updates.materialOverrides
    if (updates.defaultRotation !== undefined) dbUpdates.default_rotation = updates.defaultRotation
    if (updates.productUrl !== undefined) dbUpdates.product_url = updates.productUrl
    if (updates.isCustom !== undefined) dbUpdates.is_custom = updates.isCustom

    supabase
      .from('items')
      .update(dbUpdates)
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[ItemLibrary] Failed to update item in Supabase:', error)
        }
      })
  }, [])

  const deleteItem = useCallback((id: string) => {
    // Optimistically update local state
    setItems(prev => prev.filter(item => item.id !== id))

    // Delete from Supabase
    const supabase = createClient()
    supabase
      .from('items')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('[ItemLibrary] Failed to delete item from Supabase:', error)
        }
      })
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
        isLoading,
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
