import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { ItemLibraryProvider } from "@/lib/item-library-context";
import { TrellisJobProvider } from "@/lib/trellis-job-context";
import { TrellisJobWrapper } from "@/components/layout/TrellisJobWrapper";
import { HomeProvider } from "@/lib/home-context";
import { RoomProvider } from "@/lib/room-context";
import { FurnitureHoverProvider } from "@/lib/furniture-hover-context";
import { RoomHoverProvider } from "@/lib/room-hover-context";
import { FurnitureSelectionProvider } from "@/lib/furniture-selection-context";
import { SelectionProvider } from "@/lib/selection-context";
import { ResizeModeProvider } from "@/lib/resize-mode-context";
import { InteractionModeProvider } from "@/lib/interaction-mode-context";
import { ControlsProvider } from "@/lib/controls-context";
import { GlobalBackgroundJobManager } from "@/components/GlobalBackgroundJobManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
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
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} antialiased`}
      >
        <ItemLibraryProvider>
          <TrellisJobProvider>
            <HomeProvider>
            <RoomProvider>
              <RoomHoverProvider>
                <FurnitureHoverProvider>
                  <FurnitureSelectionProvider>
                    <SelectionProvider>
                      <ResizeModeProvider>
                        <InteractionModeProvider>
                          <ControlsProvider>
                            <GlobalBackgroundJobManager />
                            <TrellisJobWrapper>
                              {children}
                            </TrellisJobWrapper>
                          </ControlsProvider>
                        </InteractionModeProvider>
                      </ResizeModeProvider>
                    </SelectionProvider>
                  </FurnitureSelectionProvider>
                </FurnitureHoverProvider>
              </RoomHoverProvider>
            </RoomProvider>
          </HomeProvider>
          </TrellisJobProvider>
        </ItemLibraryProvider>
      </body>
    </html>
  );
}
