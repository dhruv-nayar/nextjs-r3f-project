'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const MOBILE_BREAKPOINT = 768

interface MobileContextType {
  isMobile: boolean
  screenWidth: number
}

const MobileContext = createContext<MobileContextType | null>(null)

export function MobileProvider({ children }: { children: ReactNode }) {
  // Start with undefined to detect SSR, then hydrate correctly
  const [screenWidth, setScreenWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
    setScreenWidth(window.innerWidth)

    const handleResize = () => {
      setScreenWidth(window.innerWidth)
    }

    // Use matchMedia for better performance
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)

    // Also listen for window resize for exact width
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // During SSR or before hydration, assume desktop
  const isMobile = hasMounted ? screenWidth <= MOBILE_BREAKPOINT : false

  return (
    <MobileContext.Provider value={{ isMobile, screenWidth }}>
      {children}
    </MobileContext.Provider>
  )
}

export function useMobile() {
  const context = useContext(MobileContext)
  if (!context) {
    throw new Error('useMobile must be used within a MobileProvider')
  }
  return context
}

// Convenience export for the breakpoint constant
export { MOBILE_BREAKPOINT }
