import Link from 'next/link'
import { cn } from '@/lib/design-system'
import { PageTitle } from '@/components/ui/Typography'
import { VerticalDivider } from '@/components/ui/Divider'
import { Dropdown } from '@/components/ui/Dropdown'

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
}

export function Navbar({ activeTab, className = '' }: NavbarProps) {
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
            <div className="flex items-baseline gap-6">
              <Link
                href="/items"
                className={cn(
                  'font-body font-medium text-sm pb-1 transition-colors',
                  activeTab === 'inventory'
                    ? 'text-graphite border-b-2 border-graphite'
                    : 'text-taupe/70 hover:text-graphite'
                )}
              >
                Inventory
              </Link>
              <Dropdown
                label="Projects"
                header="Recent Projects"
                options={[
                  { label: 'Living Room Design', value: 'living-room' },
                  { label: 'Kitchen Remodel', value: 'kitchen' },
                  { label: 'Bedroom Setup', value: 'bedroom' },
                  { label: 'Office Space', value: 'office' },
                  { label: 'Patio Design', value: 'patio' },
                ]}
                showSeparator
                footerOption={{ label: 'See All', value: 'see-all' }}
              />
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
