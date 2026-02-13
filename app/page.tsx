'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { RoomScene } from "@/components/rooms/RoomScene";
import { RoomNavigation } from "@/components/rooms/RoomNavigation";
import { Controls } from "@/components/Controls";
import { FurnitureSidebar } from "@/components/furniture/FurnitureSidebar";
import { FurnitureEditor } from "@/components/furniture/FurnitureEditor";
import { Navbar } from "@/components/layout/Navbar";

function HomeContent() {
  const searchParams = useSearchParams()
  const { switchHome } = useHome()
  const homeId = searchParams.get('homeId')

  // Switch to the home specified in the URL query param
  useEffect(() => {
    if (homeId) {
      switchHome(homeId)
    }
  }, [homeId, switchHome])

  return (
    <>
      {/* Navigation Bar */}
      <Navbar />

      {/* 3D Scene */}
      <main className="w-full h-screen bg-porcelain">
        <RoomScene />
      </main>

      {/* UI Overlays */}
      <RoomNavigation />
      <Controls />
      <FurnitureSidebar />
      <FurnitureEditor />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-porcelain flex items-center justify-center">
        <p className="text-taupe/70">Loading...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
