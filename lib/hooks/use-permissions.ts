'use client'

import { useMobile } from '@/lib/mobile-context'

export interface Permissions {
  // Projects (READ-ONLY on mobile)
  canCreateProject: boolean
  canCopyProject: boolean
  canDeleteProject: boolean
  canModifyProject: boolean
  canRenameProject: boolean
  canInspectFurniture: boolean  // Tap to see item details

  // Inventory (FULL capabilities on mobile)
  canCreateItem: boolean
  canUploadImages: boolean
  canGenerateModel: boolean
  canEditItem: boolean
  canDeleteItem: boolean

  // Item Creators
  canUseRugCreator: boolean
  canUseFrameCreator: boolean
  canUseShelfCreator: boolean
  canUseCustomCreator: boolean

  // 3D Viewer
  canPanZoom: boolean
  canMoveObjects: boolean     // Drag furniture in project
  canPlaceObjects: boolean    // Add new furniture to project
}

export function usePermissions(): Permissions {
  const { isMobile } = useMobile()

  return {
    // Projects - READ-ONLY on mobile
    canCreateProject: !isMobile,
    canCopyProject: !isMobile,
    canDeleteProject: !isMobile,
    canModifyProject: !isMobile,
    canRenameProject: !isMobile,
    canInspectFurniture: !isMobile,  // Visual walkthrough only on mobile

    // Inventory - FULL capabilities on mobile
    canCreateItem: true,
    canUploadImages: true,
    canGenerateModel: true,
    canEditItem: true,
    canDeleteItem: true,

    // Item Creators - Simple ones on mobile, complex ones desktop-only
    canUseRugCreator: true,
    canUseFrameCreator: true,
    canUseShelfCreator: !isMobile,
    canUseCustomCreator: !isMobile,

    // 3D Viewer
    canPanZoom: true,  // Always allowed
    canMoveObjects: !isMobile,   // Project editing only on desktop
    canPlaceObjects: !isMobile,  // Project editing only on desktop
  }
}
