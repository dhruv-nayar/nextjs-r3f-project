'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/design-system'
import { PageTitle } from '@/components/ui/Typography'
import { VerticalDivider } from '@/components/ui/Divider'
import { Dropdown } from '@/components/ui/Dropdown'
import { useHome } from '@/lib/home-context'

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
  const { homes, currentHomeId, switchHome } = useHome()
  const router = useRouter()
  const pathname = usePathname()
  const isFloorplanPage = pathname === '/floorplan'
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
              <Dropdown
                label="Projects"
                header="Recent Projects"
                value={activeTab === 'inventory' ? undefined : (currentHomeId || undefined)}
                buttonClassName={cn(
                  'font-body text-sm transition-colors flex items-center gap-1',
                  activeTab === 'inventory'
                    ? 'text-taupe/70 font-light hover:text-graphite'
                    : 'text-graphite font-medium'
                )}
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

              {/* Context-aware action button */}
              {activeTab !== 'inventory' && currentHomeId && (
                <>
                  {isFloorplanPage && onBuild3DModel ? (
                    // Show "Build 3D Model" when on floorplan page
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
                  ) : (
                    // Show "Edit Floorplan" when NOT on floorplan page
                    <button
                      onClick={() => router.push(`/floorplan?homeId=${currentHomeId}`)}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5"
                      title="Edit floorplan"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                      </svg>
                      Edit Floorplan
                    </button>
                  )}
                </>
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
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
