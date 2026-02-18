'use client'

import { useState, useCallback } from 'react'
import { cloneImageData } from '@/lib/mask-utils'
import type { MaskHistoryState } from '@/types/mask-correction'

const MAX_HISTORY_SIZE = 50

/**
 * Hook for managing undo/redo history of mask ImageData
 * Snapshots are taken on stroke completion (mouseup) to capture full strokes
 */
export function useMaskHistory(initialMask: ImageData | null) {
  const [history, setHistory] = useState<MaskHistoryState>({
    past: [],
    present: initialMask,
    future: []
  })

  /**
   * Reset history with a new initial mask
   */
  const reset = useCallback((newInitialMask: ImageData) => {
    setHistory({
      past: [],
      present: cloneImageData(newInitialMask),
      future: []
    })
  }, [])

  /**
   * Take a snapshot of the current mask state
   * Called after each completed stroke (mouseup)
   */
  const snapshot = useCallback((newMaskData: ImageData) => {
    setHistory((prev) => {
      if (!prev.present) {
        return {
          past: [],
          present: cloneImageData(newMaskData),
          future: []
        }
      }

      // Add current present to past, set new data as present, clear future
      const newPast = [...prev.past, cloneImageData(prev.present)]

      // Limit history size to prevent memory issues
      if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift()
      }

      return {
        past: newPast,
        present: cloneImageData(newMaskData),
        future: []
      }
    })
  }, [])

  /**
   * Undo to the previous mask state
   */
  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0 || !prev.present) {
        return prev
      }

      const newPast = [...prev.past]
      const previousState = newPast.pop()!

      return {
        past: newPast,
        present: previousState,
        future: [cloneImageData(prev.present), ...prev.future]
      }
    })
  }, [])

  /**
   * Redo to the next mask state
   */
  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0 || !prev.present) {
        return prev
      }

      const newFuture = [...prev.future]
      const nextState = newFuture.shift()!

      return {
        past: [...prev.past, cloneImageData(prev.present)],
        present: nextState,
        future: newFuture
      }
    })
  }, [])

  /**
   * Clear all history except the current state
   */
  const clearHistory = useCallback(() => {
    setHistory((prev) => ({
      past: [],
      present: prev.present,
      future: []
    }))
  }, [])

  return {
    maskData: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyLength: history.past.length,
    undo,
    redo,
    snapshot,
    reset,
    clearHistory
  }
}

export type UseMaskHistoryReturn = ReturnType<typeof useMaskHistory>
