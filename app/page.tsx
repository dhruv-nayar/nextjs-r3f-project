import { RoomScene } from "@/components/rooms/RoomScene";
import { RoomNavigation } from "@/components/rooms/RoomNavigation";
import { Controls } from "@/components/Controls";
import { FurnitureSidebar } from "@/components/furniture/FurnitureSidebar";
import { FurnitureEditor } from "@/components/furniture/FurnitureEditor";
import { TopBar } from "@/components/TopBar";
import { HomeNavigation } from "@/components/homes/HomeNavigation";
import { StorageInfo } from "@/components/settings/StorageInfo";
import { AutoSaveIndicator } from "@/components/settings/AutoSaveIndicator";
import Link from "next/link";

export default function Home() {
  return (
    <>
      {/* Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-white">3D Home Editor</h1>
              <div className="flex gap-4">
                <Link
                  href="/items"
                  className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Items
                </Link>
                <Link
                  href="/homes"
                  className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Homes
                </Link>
                <div className="px-4 py-2 text-white bg-blue-600/50 rounded-lg font-medium border border-blue-500">
                  Editor
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 3D Scene */}
      <main className="w-full h-screen">
        <RoomScene />
      </main>

      {/* UI Overlays */}
      <HomeNavigation />
      <TopBar />
      <RoomNavigation />
      <Controls />
      <FurnitureSidebar />
      <FurnitureEditor />
      <StorageInfo />
      <AutoSaveIndicator />
    </>
  );
}
