'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/design-system'
import { PageTitle } from '@/components/ui/Typography'
import { VerticalDivider } from '@/components/ui/Divider'
import { Dropdown } from '@/components/ui/Dropdown'
import { useHome } from '@/lib/home-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { getStorageInfo, clearAllStorage } from '@/lib/storage'

/**
 * Navbar Component
 * Main navigation bar for Studio OMHU application
 *
 * Features:
 * - Studio OMHU branding
 * - Navigation tabs (Inventory, Projects)
 * - Icon buttons (Search, User)
 */

interface NavbarProps {
  /** Active navigation tab */
  activeTab?: 'inventory' | 'projects'
  /** Additional CSS classes */
  className?: string
  /** Breadcrumb text to show after the active tab */
  breadcrumb?: string
  /** Optional callback for Build 3D Model button (when on floorplan page) */
  onBuild3DModel?: () => void
}

export function Navbar({ activeTab, className = '', breadcrumb, onBuild3DModel }: NavbarProps) {
  const { homes, currentHomeId, switchHome, renameHome } = useHome()
  const { items } = useItemLibrary()
  const router = useRouter()
  const pathname = usePathname()
  const isFloorplanPage = pathname === '/floorplan'
  const currentHome = homes.find(h => h.id === currentHomeId)

  // Auto-save indicator state
  const [showSaving, setShowSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [storageInfo, setStorageInfo] = useState({ used: 0, total: 0, percentage: 0, available: false })

  // Editable project name state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Show saving indicator when data changes
  useEffect(() => {
    setShowSaving(true)
    setLastSaved(new Date())

    const timer = setTimeout(() => {
      setShowSaving(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [homes, items])

  // Load storage info when settings panel opens
  useEffect(() => {
    if (showSettings) {
      setStorageInfo(getStorageInfo())
    }
  }, [showSettings])

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  const handleStartEditName = () => {
    if (currentHome) {
      setEditNameValue(currentHome.name)
      setIsEditingName(true)
    }
  }

  const handleSaveName = () => {
    if (currentHome && editNameValue.trim() && editNameValue !== currentHome.name) {
      renameHome(currentHome.id, editNameValue.trim())
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleClearData = () => {
    if (clearAllStorage()) {
      alert('All data cleared! The page will reload.')
      window.location.reload()
    } else {
      alert('Failed to clear data')
    }
  }

  return (
    <nav className={cn('sticky top-0 z-50 bg-porcelain border-b border-taupe/5', className)}>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center gap-2">
            <span className="text-taupe text-xl">△</span>
            <PageTitle>Studio OMHU</PageTitle>
          </div>

          {/* Right Side Navigation */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Link
                  href="/items"
                  className={cn(
                    'font-body font-medium text-sm transition-colors',
                    activeTab === 'inventory'
                      ? 'text-graphite border-b-2 border-graphite'
                      : 'text-taupe/70 hover:text-graphite'
                  )}
                >
                  Inventory
                </Link>
                {breadcrumb && activeTab === 'inventory' && (
                  <>
                    <svg className="w-4 h-4 text-taupe/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-body font-medium text-sm text-graphite">{breadcrumb}</span>
                  </>
                )}
              </div>

              {/* Projects Navigation - Show as dropdown on inventory page, breadcrumb on projects page */}
              {activeTab === 'inventory' ? (
                <Dropdown
                  label="Projects"
                  header="Recent Projects"
                  value={undefined}
                  buttonClassName="font-body text-sm text-taupe/70 font-light hover:text-graphite transition-colors flex items-center gap-1"
                  headerOption={{
                    label: 'All Projects',
                    value: 'all-projects',
                    onClick: () => router.push('/homes')
                  }}
                  options={homes.map(home => ({
                    label: home.name,
                    value: home.id,
                    onClick: () => {
                      switchHome(home.id)
                      router.push('/')
                    }
                  }))}
                  showSeparator
                  footerOption={{
                    label: '+ Create Project',
                    value: 'create-project',
                    onClick: () => router.push('/homes')
                  }}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Dropdown
                    label="Projects"
                    header="Recent Projects"
                    value={currentHomeId || undefined}
                    alwaysShowLabel
                    buttonClassName="font-body text-sm text-graphite font-medium transition-colors flex items-center gap-1"
                    headerOption={{
                      label: 'All Projects',
                      value: 'all-projects',
                      onClick: () => router.push('/homes')
                    }}
                    options={homes.map(home => ({
                      label: home.name,
                      value: home.id,
                      onClick: () => {
                        switchHome(home.id)
                        router.push('/')
                      }
                    }))}
                    showSeparator
                    footerOption={{
                      label: '+ Create Project',
                      value: 'create-project',
                      onClick: () => router.push('/homes')
                    }}
                  />
                  {currentHome && (
                    <>
                      <svg className="w-4 h-4 text-taupe/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {isEditingName ? (
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onBlur={handleSaveName}
                          onKeyDown={handleNameKeyDown}
                          className="font-body font-medium text-sm text-graphite bg-transparent border-b border-sage focus:outline-none px-0 py-0 min-w-[100px]"
                        />
                      ) : (
                        <button
                          onClick={handleStartEditName}
                          className="font-body font-medium text-sm text-graphite hover:text-sage transition-colors cursor-text"
                          title="Click to rename project"
                        >
                          {currentHome.name}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Auto-save indicator - only show on projects pages when we have a current home */}
              {activeTab !== 'inventory' && currentHomeId && (showSaving || lastSaved) && (
                <div className="flex items-center gap-2 ml-3">
                  {showSaving ? (
                    <>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-graphite/70 text-sm font-body">Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-graphite/50 text-sm font-body">Saved</span>
                    </>
                  )}
                </div>
              )}

              {/* Context-aware action button - Only show Build 3D Model on floorplan page */}
              {activeTab !== 'inventory' && currentHomeId && isFloorplanPage && onBuild3DModel && (
                <button
                  onClick={onBuild3DModel}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Build 3D model from floorplan"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Build 3D Model
                </button>
              )}
            </div>

            <VerticalDivider />

            <div className="flex items-center gap-3">
              <button
                className="p-2 hover:bg-taupe/5 rounded-lg flex items-center justify-center transition-colors"
                aria-label="Search"
              >
                <svg className="w-5 h-5 text-taupe/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
              <button
                className="p-2 hover:bg-taupe/5 rounded-lg flex items-center justify-center transition-colors"
                aria-label="User profile"
              >
                <svg className="w-5 h-5 text-taupe/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-taupe/5 rounded-lg flex items-center justify-center transition-colors"
                  aria-label="Settings"
                >
                  <svg
                    className="w-5 h-5 text-taupe/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>

                {/* Settings Dropdown Panel */}
                {showSettings && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-taupe/10 z-50">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-graphite font-display font-semibold">Settings</h3>
                        <button
                          onClick={() => setShowSettings(false)}
                          className="text-taupe/60 hover:text-graphite text-xl leading-none"
                        >
                          ×
                        </button>
                      </div>

                      {/* Storage Info */}
                      <div className="mb-4">
                        <h4 className="text-graphite/80 text-sm font-medium mb-2 font-body">Storage</h4>
                        {storageInfo.available ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-taupe/60 font-body">
                              <span>Used:</span>
                              <span>{formatBytes(storageInfo.used)}</span>
                            </div>
                            <div className="w-full bg-taupe/10 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-blue-500 h-full transition-all"
                                style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-taupe/60 text-center font-body">
                              {storageInfo.percentage.toFixed(1)}% used
                            </div>
                          </div>
                        ) : (
                          <p className="text-taupe/50 text-xs font-body">Storage not available</p>
                        )}
                      </div>

                      {/* Auto-save Status */}
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-green-800 text-xs font-body">Auto-save enabled</span>
                        </div>
                        <p className="text-green-700/60 text-xs mt-1 font-body">
                          Changes are saved automatically
                        </p>
                      </div>

                      {/* Clear Data */}
                      <div className="border-t border-taupe/10 pt-4">
                        <button
                          onClick={() => {
                            setShowSettings(false)
                            setShowClearConfirm(true)
                          }}
                          className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors border border-red-200 font-body"
                        >
                          Clear All Data
                        </button>
                        <p className="text-taupe/40 text-xs mt-2 font-body">
                          This will delete all homes, items, and settings
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-taupe/20">
            <h3 className="text-graphite text-xl font-display font-bold mb-4">Clear All Data?</h3>
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm mb-2 font-body">
                <strong>Warning:</strong> This action cannot be undone!
              </p>
              <p className="text-red-700/70 text-xs font-body">
                All homes, rooms, items, and settings will be permanently deleted.
              </p>
            </div>
            <p className="text-graphite/70 mb-6 font-body">
              The app will reload with default data. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 bg-taupe/10 hover:bg-taupe/20 text-graphite rounded-lg font-medium transition-colors font-body"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors font-body"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
