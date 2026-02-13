'use client'

import { FloorplanProvider } from '@/lib/contexts/floorplan-context'
import { FloorplanToolbar } from './FloorplanToolbar'
import { FloorplanCanvas } from './FloorplanCanvas'
import { FloorplanSidebar } from './FloorplanSidebar'
import { FloorplanData } from '@/types/floorplan'

interface FloorplanEditorProps {
  homeId: string
  initialData?: FloorplanData
}

export function FloorplanEditor({ homeId, initialData }: FloorplanEditorProps) {
  return (
    <FloorplanProvider>
      <FloorplanEditorContent homeId={homeId} initialData={initialData} />
    </FloorplanProvider>
  )
}

function FloorplanEditorContent({ homeId, initialData }: FloorplanEditorProps) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <FloorplanToolbar />

      {/* Main content: Canvas + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            <FloorplanCanvas width={800} height={600} />
          </div>
        </div>

        {/* Sidebar */}
        <FloorplanSidebar />
      </div>
    </div>
  )
}
