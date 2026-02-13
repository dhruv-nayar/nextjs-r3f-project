import { RoomScene } from "@/components/rooms/RoomScene";
import { RoomNavigation } from "@/components/rooms/RoomNavigation";
import { Controls } from "@/components/Controls";
import { FurnitureSidebar } from "@/components/furniture/FurnitureSidebar";
import { FurnitureEditor } from "@/components/furniture/FurnitureEditor";
import { StorageInfo } from "@/components/settings/StorageInfo";
import { AutoSaveIndicator } from "@/components/settings/AutoSaveIndicator";
import { Navbar } from "@/components/layout/Navbar";

export default function Home() {
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
      <StorageInfo />
      <AutoSaveIndicator />
    </>
  );
}
