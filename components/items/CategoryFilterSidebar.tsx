import { cn } from '@/lib/design-system'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/Typography'
import Button from '@/components/ui/Button'

/**
 * CategoryFilterSidebar Component
 * Sidebar panel for filtering items by category
 *
 * Features:
 * - Category list with counts
 * - Visual indicator for selected category
 * - Add New Item button
 */

interface Category {
  value: string
  label: string
}

interface CategoryFilterSidebarProps {
  /** List of available categories */
  categories: Category[]
  /** Currently selected category */
  selectedCategory: string
  /** Callback when category selection changes */
  onCategoryChange: (category: string) => void
  /** Item count per category */
  itemCounts: Record<string, number>
  /** Optional callback for Add New Item button */
  onAddNewClick?: () => void
  /** Additional CSS classes */
  className?: string
}

export function CategoryFilterSidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  itemCounts,
  onAddNewClick,
  className = ''
}: CategoryFilterSidebarProps) {
  return (
    <Panel sticky width="w-64" className={className}>
      <div className="space-y-6">
        {/* Quick Filters Section */}
        <div>
          <SectionHeader className="mb-4">Quick Filters</SectionHeader>
          <div className="space-y-1">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => onCategoryChange(cat.value)}
                className={cn(
                  'w-full text-left px-3 py-2 transition-colors font-body text-sm',
                  selectedCategory === cat.value
                    ? 'text-graphite'
                    : 'text-taupe/70 hover:text-graphite'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-4 flex-shrink-0">
                      {selectedCategory === cat.value ? '•' : ''}
                    </span>
                    <span className="truncate">{cat.label}</span>
                  </div>
                  <span className="text-xs text-taupe/40 flex-shrink-0">
                    {itemCounts[cat.value] || 0}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Add New Item Button */}
        {onAddNewClick && (
          <div className="pt-6 border-t border-taupe/5">
            <Button variant="primary" fullWidth onClick={onAddNewClick}>
              Add New Item
            </Button>
          </div>
        )}
      </div>
    </Panel>
  )
}
