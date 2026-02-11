import Link from 'next/link'
import { cn } from '@/lib/design-system'
import { ItemName, CategoryLabel } from '@/components/ui/Typography'
import { ItemThumbnail } from '@/components/items/ItemThumbnail'

/**
 * ItemCard Component
 * Card component for displaying individual items in a grid
 *
 * Features:
 * - Item thumbnail with hover effect
 * - Category label
 * - Item name
 * - Links to item detail page
 */

interface ItemCardProps {
  /** Unique item identifier */
  id: string
  /** Item name */
  name: string
  /** Item category */
  category: string
  /** Optional thumbnail image path */
  thumbnailPath?: string
  /** Additional CSS classes */
  className?: string
}

export function ItemCard({
  id,
  name,
  category,
  thumbnailPath,
  className = ''
}: ItemCardProps) {
  return (
    <Link
      href={`/items/${id}`}
      className={cn('group overflow-hidden cursor-pointer', className)}
    >
      {/* Thumbnail */}
      <div className="aspect-square relative shadow-sm group-hover:shadow-md transition-shadow duration-200">
        <ItemThumbnail category={category} name={name} thumbnailPath={thumbnailPath} />
      </div>

      {/* Info Section */}
      <div className="pt-2">
        <CategoryLabel className="mb-1">{category}</CategoryLabel>
        <ItemName className="truncate">{name}</ItemName>
      </div>
    </Link>
  )
}

/**
 * AddItemCard Component
 * Special card for adding new items
 */

interface AddItemCardProps {
  /** Callback when card is clicked */
  onClick: () => void
  /** Additional CSS classes */
  className?: string
}

export function AddItemCard({ onClick, className = '' }: AddItemCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-2 border-dashed border-taupe/15 rounded-lg aspect-square',
        'flex flex-col items-center justify-center gap-3',
        'hover:border-taupe/30 transition-all group',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full border-2 border-taupe/30 flex items-center justify-center text-2xl text-taupe/40 group-hover:border-taupe/50 group-hover:text-taupe/60 transition-colors">
        +
      </div>
      <span className="font-body text-sm text-taupe/60 group-hover:text-taupe/80 transition-colors uppercase tracking-wide">
        Add New Item
      </span>
    </button>
  )
}
