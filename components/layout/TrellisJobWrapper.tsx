'use client'

import { useEffect } from 'react'
import { TrellisJobIndicator } from '@/components/items/TrellisJobIndicator'
import { useItemLibrary } from '@/lib/item-library-context'

export function TrellisJobWrapper({ children }: { children: React.ReactNode }) {
  const { updateItem } = useItemLibrary()

  // Global listener for GLB generation completion
  // This ensures the item is updated even if user navigates away from item detail page
  useEffect(() => {
    const handleGlbComplete = (event: CustomEvent<{ itemId: string; modelPath: string; jobId: string }>) => {
      const { itemId, modelPath } = event.detail
      console.log('[TrellisJobWrapper] GLB generation complete, updating item:', itemId)
      updateItem(itemId, { modelPath })
    }

    // Listen for GLB completion events
    window.addEventListener('trellis-glb-complete', handleGlbComplete as EventListener)

    return () => {
      window.removeEventListener('trellis-glb-complete', handleGlbComplete as EventListener)
    }
  }, [updateItem])

  return (
    <>
      {children}
      <TrellisJobIndicator />
    </>
  )
}
