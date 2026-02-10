import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ItemLibraryProvider } from "@/lib/item-library-context";
import { HomeProvider } from "@/lib/home-context";
import { RoomProvider } from "@/lib/room-context";
import { FurnitureHoverProvider } from "@/lib/furniture-hover-context";
import { RoomHoverProvider } from "@/lib/room-hover-context";
import { FurnitureSelectionProvider } from "@/lib/furniture-selection-context";
import { ControlsProvider } from "@/lib/controls-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "3D Home Editor",
  description: "Design and visualize your home in 3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ItemLibraryProvider>
          <HomeProvider>
            <RoomProvider>
              <RoomHoverProvider>
                <FurnitureHoverProvider>
                  <FurnitureSelectionProvider>
                    <ControlsProvider>
                      {children}
                    </ControlsProvider>
                  </FurnitureSelectionProvider>
                </FurnitureHoverProvider>
              </RoomHoverProvider>
            </RoomProvider>
          </HomeProvider>
        </ItemLibraryProvider>
      </body>
    </html>
  );
}
