/**
 * React hooks for working with background jobs
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  getAllJobs,
  getJobsByStatus,
  getJobsByItemId,
  getJobStats,
  BackgroundJob,
  JobStatus,
  createJob as createJobInternal,
  JobType
} from './background-jobs'
import { startBackgroundJobProcessor } from './background-job-processor'

/**
 * Hook to get all jobs with auto-refresh
 */
export function useBackgroundJobs(refreshInterval = 1000) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([])

  const refresh = useCallback(() => {
    setJobs(getAllJobs())
  }, [])

  useEffect(() => {
    // Initial load
    refresh()

    // Set up polling
    const interval = setInterval(refresh, refreshInterval)

    return () => clearInterval(interval)
  }, [refresh, refreshInterval])

  return { jobs, refresh }
}

/**
 * Hook to get jobs for a specific item
 */
export function useItemJobs(itemId: string, refreshInterval = 1000) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([])

  const refresh = useCallback(() => {
    setJobs(getJobsByItemId(itemId))
  }, [itemId])

  useEffect(() => {
    // Initial load
    refresh()

    // Set up polling
    const interval = setInterval(refresh, refreshInterval)

    return () => clearInterval(interval)
  }, [refresh, refreshInterval])

  return { jobs, refresh }
}

/**
 * Hook to get job statistics
 */
export function useJobStats(refreshInterval = 2000) {
  const [stats, setStats] = useState(() => getJobStats())

  useEffect(() => {
    // Initial load
    setStats(getJobStats())

    // Set up polling
    const interval = setInterval(() => {
      setStats(getJobStats())
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  return stats
}

/**
 * Hook to create background jobs
 */
export function useCreateBackgroundJob() {
  const createJob = useCallback(
    (type: JobType, itemId: string, input: BackgroundJob['input']) => {
      return createJobInternal(type, itemId, input)
    },
    []
  )

  return createJob
}

/**
 * Hook to start the background job processor on mount
 */
export function useBackgroundJobProcessor() {
  useEffect(() => {
    // Start the processor when component mounts
    startBackgroundJobProcessor()

    console.log('Background job processor initialized')

    // Note: We don't stop the processor on unmount
    // because we want it to continue running across page navigations
  }, [])
}

/**
 * Hook to get processing status for a specific item
 */
export function useItemProcessingStatus(itemId: string) {
  const { jobs } = useItemJobs(itemId, 1000)

  const status = {
    hasJobs: jobs.length > 0,
    hasPending: jobs.some(j => j.status === 'pending'),
    hasProcessing: jobs.some(j => j.status === 'processing'),
    hasCompleted: jobs.some(j => j.status === 'completed'),
    hasFailed: jobs.some(j => j.status === 'failed'),
    isProcessing: jobs.some(j => j.status === 'pending' || j.status === 'processing'),
    allCompleted: jobs.length > 0 && jobs.every(j => j.status === 'completed'),

    // Get specific job types
    rembgJob: jobs.find(j => j.type === 'rembg'),
    glbJob: jobs.find(j => j.type === 'glb_generation'),

    // Get results
    processedImageUrl: jobs.find(j => j.type === 'rembg' && j.status === 'completed')?.output?.processedImageUrl,
    glbUrl: jobs.find(j => j.type === 'glb_generation' && j.status === 'completed')?.output?.glbUrl,

    jobs
  }

  return status
}
