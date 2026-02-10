'use client'

import { useState, useEffect } from 'react'
import { getStorageInfo, clearAllStorage } from '@/lib/storage'

export function StorageInfo() {
  const [isOpen, setIsOpen] = useState(false)
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0, percentage: 0, available: false })
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStorageInfo(getStorageInfo())
    }
  }, [isOpen])

  const handleClearData = () => {
    if (clearAllStorage()) {
      alert('All data cleared! The page will reload.')
      window.location.reload()
    } else {
      alert('Failed to clear data')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 p-3 bg-black/60 backdrop-blur-md rounded-full shadow-lg border border-white/10 hover:bg-black/70 transition-colors z-40"
        title="Storage Settings"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-6 w-80 bg-black/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 z-40">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Settings</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white"
              >
                ×
              </button>
            </div>

            {/* Storage Info */}
            <div className="mb-4">
              <h4 className="text-white/80 text-sm font-medium mb-2">Storage</h4>
              {storageInfo.available ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Used:</span>
                    <span>{formatBytes(storageInfo.used)}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all"
                      style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-white/60 text-center">
                    {storageInfo.percentage.toFixed(1)}% used
                  </div>
                </div>
              ) : (
                <p className="text-white/50 text-xs">Storage not available</p>
              )}
            </div>

            {/* Auto-save Status */}
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-200 text-xs">Auto-save enabled</span>
              </div>
              <p className="text-green-200/60 text-xs mt-1">
                Changes are saved automatically
              </p>
            </div>

            {/* Clear Data */}
            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-500/30"
              >
                Clear All Data
              </button>
              <p className="text-white/40 text-xs mt-2">
                This will delete all homes, items, and settings
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-white text-xl font-bold mb-4">Clear All Data?</h3>
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-200 text-sm mb-2">
                <strong>Warning:</strong> This action cannot be undone!
              </p>
              <p className="text-red-200/70 text-xs">
                All homes, rooms, items, and settings will be permanently deleted.
              </p>
            </div>
            <p className="text-white/70 mb-6">
              The app will reload with default data. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
