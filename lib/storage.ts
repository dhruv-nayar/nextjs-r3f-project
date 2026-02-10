/**
 * LocalStorage utility for persisting app state
 */

const STORAGE_VERSION = '1.0'
const STORAGE_KEYS = {
  ITEMS: 'homeEditor_items_v1',
  HOMES: 'homeEditor_homes_v1',
  CURRENT_HOME_ID: 'homeEditor_currentHomeId_v1',
  VERSION: 'homeEditor_version'
} as const

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Save data to localStorage with error handling
 */
export function saveToStorage<T>(key: string, data: T): boolean {
  if (!isStorageAvailable()) {
    console.warn('localStorage is not available')
    return false
  }

  try {
    const serialized = JSON.stringify(data)
    localStorage.setItem(key, serialized)

    // Update version
    localStorage.setItem(STORAGE_KEYS.VERSION, STORAGE_VERSION)

    return true
  } catch (error) {
    console.error('Failed to save to localStorage:', error)

    // Check if quota exceeded
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded')
    }

    return false
  }
}

/**
 * Load data from localStorage with error handling
 */
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (!isStorageAvailable()) {
    return defaultValue
  }

  try {
    const serialized = localStorage.getItem(key)

    if (serialized === null) {
      return defaultValue
    }

    return JSON.parse(serialized) as T
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    return defaultValue
  }
}

/**
 * Remove data from localStorage
 */
export function removeFromStorage(key: string): boolean {
  if (!isStorageAvailable()) {
    return false
  }

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error('Failed to remove from localStorage:', error)
    return false
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearAllStorage(): boolean {
  if (!isStorageAvailable()) {
    return false
  }

  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    return true
  } catch (error) {
    console.error('Failed to clear localStorage:', error)
    return false
  }
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): {
  used: number
  total: number
  percentage: number
  available: boolean
} {
  if (!isStorageAvailable()) {
    return { used: 0, total: 0, percentage: 0, available: false }
  }

  try {
    // Estimate used space
    let used = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        const value = localStorage.getItem(key)
        used += (key.length + (value?.length || 0)) * 2 // UTF-16 encoding
      }
    }

    // Most browsers limit localStorage to 5-10MB
    const total = 5 * 1024 * 1024 // Assume 5MB
    const percentage = (used / total) * 100

    return {
      used,
      total,
      percentage: Math.round(percentage * 100) / 100,
      available: true
    }
  } catch (error) {
    console.error('Failed to get storage info:', error)
    return { used: 0, total: 0, percentage: 0, available: false }
  }
}

// Export storage keys for use in contexts
export { STORAGE_KEYS }
