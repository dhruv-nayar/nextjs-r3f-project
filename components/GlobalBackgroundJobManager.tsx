/**
 * Global Background Job Manager
 *
 * This component should be placed at the root level of your app (in layout.tsx)
 * It automatically starts the background job processor when the app loads
 * and ensures it continues running across all pages.
 */

'use client'

import { useEffect } from 'react'
import { useBackgroundJobProcessor, useJobStats } from '@/lib/use-background-jobs'

export function GlobalBackgroundJobManager() {
  // Start the background job processor
  useBackgroundJobProcessor()

  // Get job statistics for debugging
  const stats = useJobStats(5000) // Update every 5 seconds

  useEffect(() => {
    // Log stats periodically if there are active jobs
    if (stats.pending > 0 || stats.processing > 0) {
      console.log('[Background Jobs]', {
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed
      })
    }
  }, [stats])

  // This component doesn't render anything visible
  return null
}
