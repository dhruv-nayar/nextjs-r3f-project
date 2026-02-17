'use client'

import { TrellisJobIndicator } from '@/components/items/TrellisJobIndicator'

export function TrellisJobWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TrellisJobIndicator />
    </>
  )
}
