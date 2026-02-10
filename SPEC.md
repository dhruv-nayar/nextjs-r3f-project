# Items & Homes Architecture Spec

## Overview

This spec formalizes the separation between **Items** (3D model templates) and **Homes** (spaces where item instances are placed). The goal is to enable users to:
1. Manage a personal library of 3D models
2. Create and manage multiple homes/spaces
3. Place any item from their library into any home, with independent positioning

## Core Concepts

### Items (Model Templates)
An **Item** is a reusable 3D model template with metadata. Think of it as a "stamp" that can be placed multiple times across different homes.

**Properties:**
- Unique identifier
- Display name and description
- 3D model file reference (.glb)
- Default/real-world dimensions (width, height, depth in feet)
- Category/tags for organization
- Thumbnail image (optional)
- Creation/modification timestamps

**Key Insight:** Items are templates, not instances. Deleting an item from the library should prompt about existing placements.

### Item Instances (Placements)
An **Item Instance** is a specific placement of an Item within a room.

**Properties:**
- Reference to parent Item ID
- Position (x, y, z in feet)
- Rotation (x, y, z in radians)
- Scale override (if user wants to scale beyond Item's default dimensions)
- Instance-specific name override (optional: "Mom's Chair" vs just "Chair")

**Key Insight:** Multiple instances of the same item can exist in one or many rooms, each with independent transforms.

### Homes
A **Home** is a collection of rooms. The structure already exists but will be enhanced with better organization.

**Properties:**
- Unique identifier
- Name and description
- List of rooms
- Creation/modification timestamps
- Thumbnail/cover image (optional, could be auto-generated from first room)

### Rooms
Rooms remain largely as-is, with instances placed inside them.

**Properties:**
- Dimensions or floorplan
- Camera settings
- Lighting configuration
- List of item instances

---

## Data Model

### Current State
```typescript
// ❌ Current (tightly coupled)
FurnitureItem {
  id: string
  name: string
  modelPath: string  // Embedded in each placement
  position: Vector3
  rotation: Vector3
  scale: Vector3
  targetDimensions?: {...}
  category?: string
}
```

### Proposed State

```typescript
// ✅ New (separated concerns)

// ITEM LIBRARY (reusable templates)
Item {
  id: string                    // e.g., "item_chair_001"
  name: string                  // "Modern Office Chair"
  description?: string          // "Ergonomic mesh back chair"
  modelPath: string             // "/models/whiteback-wood-chair.glb"
  thumbnailPath?: string        // "/thumbnails/chair_thumb.jpg"

  // Default real-world dimensions
  dimensions: {
    width: number               // feet
    height: number
    depth: number
  }

  // Organization
  category: 'seating' | 'table' | 'storage' | 'bed' | 'decoration' | 'lighting' | 'other'
  tags: string[]                // ["office", "modern", "mesh"]

  // Metadata
  createdAt: string
  updatedAt: string
  isCustom: boolean             // User-uploaded vs built-in
}

// ITEM INSTANCES (placements in rooms)
ItemInstance {
  id: string                    // e.g., "instance_001"
  itemId: string                // Reference to Item
  roomId: string                // Which room this is in

  // Transform
  position: Vector3             // feet
  rotation: Vector3             // radians
  scaleMultiplier: Vector3      // User scale adjustment (default: 1,1,1)

  // Optional overrides
  customName?: string           // "Mom's chair" (overrides Item.name)

  // Metadata
  placedAt: string
}

// ROOMS (mostly unchanged)
Room {
  id: string
  name: string
  homeId: string                // NEW: explicit parent home reference

  // Space definition (unchanged)
  dimensions?: {width, height, depth}
  floorplan?: FloorplanConfig
  position: Vector3

  // Instances instead of furniture
  instances: ItemInstance[]     // NEW: was "furniture: FurnitureItem[]"

  // Camera & lighting (unchanged)
  cameraPosition: Vector3
  cameraTarget: Vector3
  lighting?: LightingConfig
}

// HOMES (enhanced)
Home {
  id: string
  name: string
  description?: string          // NEW
  rooms: Room[]
  thumbnailPath?: string        // NEW: auto-generated or manual
  createdAt: string
  updatedAt: string
}
```

---

## User Flows

### 1. Items Library Flow

#### View Items
```
Landing → Items Library
  ├─ Grid/List view of all items
  ├─ Search/filter by name, category, tags
  ├─ Thumbnail + name + dimensions
  └─ Click item → Item Detail View
       ├─ 3D preview (rotate/zoom)
       ├─ Metadata (name, dimensions, category, tags)
       ├─ "Edit" button
       ├─ "Delete" button (with warning if used in homes)
       └─ List of homes/rooms where this item is placed
```

#### Create New Item
```
Items Library → "Add Item" button
  ├─ Upload .glb file
  ├─ Enter name, description
  ├─ Set category
  ├─ Add tags (autocomplete existing)
  ├─ Set default dimensions (or auto-detect from model)
  ├─ Optional: upload custom thumbnail
  └─ Save → Returns to Items Library with new item
```

#### Edit Item
```
Item Detail → "Edit"
  ├─ Modify name, description, category, tags
  ├─ Update dimensions (affects all instances proportionally)
  ├─ Replace model file (risky, show warning)
  └─ Save

Note: Changing dimensions updates all instances' autoScale
```

#### Delete Item
```
Item Detail → "Delete"
  ├─ Check if item is used in any homes
  ├─ If used:
  │   └─ Show modal: "This item is used in 3 rooms across 2 homes. Delete anyway?"
  │       ├─ Cancel
  │       └─ Confirm → Delete item + all instances
  └─ If not used:
      └─ Simple confirmation → Delete
```

### 2. Homes Flow

#### View Homes
```
Landing → Homes (or default view)
  ├─ Card/Grid view of all homes
  ├─ Thumbnail + name + room count
  ├─ "Create New Home" button
  └─ Click home → Home Detail View
```

#### Create New Home
```
Homes → "Create New Home"
  ├─ Enter name, description
  ├─ Optional: upload cover image
  ├─ Create first room:
  │   ├─ Room name
  │   ├─ Dimensions OR upload floorplan
  │   └─ Camera position
  └─ Save → Opens home in editor
```

#### Home Detail View (Editor)
```
Home Editor (current prototype experience)
  ├─ Top bar: Home name, Room selector, Undo/Redo
  ├─ Left sidebar: "Add Items" button
  │   └─ Opens Items Library modal
  │       ├─ Browse/search items
  │       └─ Click to place in current room
  ├─ 3D Canvas: Room with placed instances
  │   ├─ Drag to reposition
  │   ├─ Arrow keys to nudge
  │   └─ Click to select
  ├─ Right sidebar: Instance properties (when selected)
  │   ├─ Item name (with link to Item detail)
  │   ├─ Position XYZ
  │   ├─ Rotation XYZ
  │   ├─ Scale XYZ
  │   ├─ "Remove from room" button
  │   └─ Optional: "Duplicate" button
  └─ Room management
      ├─ Add new room
      ├─ Delete room
      └─ Edit room properties
```

#### Delete Home
```
Home Detail → Settings/Menu → "Delete Home"
  ├─ Confirmation: "Delete [Home Name] and all its rooms?"
  └─ Confirm → Delete home + all rooms + all instances
      (Items in library are NOT deleted)
```

### 3. Cross-Context Actions

#### Placing Items in Rooms
```
Home Editor → "Add Items"
  ├─ Opens modal with Items Library
  ├─ User clicks item
  ├─ Creates new ItemInstance in current room
  ├─ Instance placed at room center (or last clicked position)
  └─ Modal closes, item is selected for immediate editing
```

#### Using Same Item in Multiple Rooms
```
User can add same Item to multiple rooms
  → Each placement creates separate ItemInstance
  → Independent positioning, rotation, scale
  → All instances reference same Item model
```

#### Editing Item from Home Editor
```
Home Editor → Select instance → Right sidebar
  ├─ Click Item name link
  ├─ Opens Item Detail modal/page
  ├─ Edit item properties
  └─ Changes reflect in all instances (dimensions update auto-scale)
```

---

## UI Structure

### New Navigation Structure

```
┌─────────────────────────────────────────┐
│  App Shell                              │
│  ┌──────────────────────────────────┐  │
│  │ Top Nav Bar                       │  │
│  │  [Items] [Homes]  User Menu       │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ Route Content                     │  │
│  │  • /items    → Items Library      │  │
│  │  • /items/:id → Item Detail      │  │
│  │  • /homes    → Homes List         │  │
│  │  • /homes/:id → Home Editor      │  │
│  │  • /         → Redirect to /homes│  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Page Layouts

#### Items Library Page (`/items`)
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ Top Bar                              │ │
│ │  Items Library    [+ Add Item]      │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Search & Filters                     │ │
│ │  🔍 Search   [Category ▼] [Tags ▼]  │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Items Grid                           │ │
│ │  ┌──────┐ ┌──────┐ ┌──────┐         │ │
│ │  │ 🪑   │ │ 🛋️   │ │ 🛏️   │         │ │
│ │  │Chair │ │Sofa  │ │ Bed  │         │ │
│ │  │3'x3' │ │6'x3' │ │6'x7' │         │ │
│ │  └──────┘ └──────┘ └──────┘         │ │
│ │  ┌──────┐ ┌──────┐ ┌──────┐         │ │
│ │  │ 🪴   │ │ 💡   │ │ 📚   │         │ │
│ │  │Plant │ │Lamp  │ │Shelf │         │ │
│ │  └──────┘ └──────┘ └──────┘         │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### Item Detail Page (`/items/:id`)
```
┌─────────────────────────────────────────┐
│ ← Back to Items          [Edit] [Delete] │
├─────────────────────────────────────────┤
│ ┌──────────┐  Modern Office Chair        │
│ │          │  Category: Seating          │
│ │   3D     │  Dimensions: 3'W × 3'H × 2'D│
│ │  Preview │  Tags: office, modern       │
│ │          │                             │
│ └──────────┘  Ergonomic mesh back chair  │
│               with adjustable height...   │
├─────────────────────────────────────────┤
│ Used in 3 homes:                         │
│  • Home 1 > Living Room (2 instances)   │
│  • Home 2 > Office (1 instance)         │
│  • Home 3 > Bedroom (1 instance)        │
└─────────────────────────────────────────┘
```

#### Homes List Page (`/homes`)
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ Homes              [+ Create Home]   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Homes Grid                           │ │
│ │  ┌──────────┐ ┌──────────┐          │ │
│ │  │ [Thumb]  │ │ [Thumb]  │          │ │
│ │  │ Unit 4A  │ │ Studio   │          │ │
│ │  │ 3 rooms  │ │ 1 room   │          │ │
│ │  └──────────┘ └──────────┘          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### Home Editor Page (`/homes/:id`) - Current Prototype
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ [Home ▼] [Room ▼]  [↶][↷]  [Floorplan]│ │
│ └─────────────────────────────────────┘ │
│ ┌────┬───────────────────────────┬────┐ │
│ │    │                           │    │ │
│ │Add │      3D Canvas            │Prop│ │
│ │Items│   (Current room view)     │s   │ │
│ │    │                           │    │ │
│ │🪑  │       🛋️                  │Pos:│ │
│ │🛋️  │   🪑     🪴             │X:5 │ │
│ │🛏️  │                          │Y:0 │ │
│ │💡  │                          │Z:3 │ │
│ │    │                           │    │ │
│ └────┴───────────────────────────┴────┘ │
└─────────────────────────────────────────┘
```

---

## Technical Implementation

### Data Layer (Phase 1: In-Memory)
For initial implementation (no auth), keep everything in React Context with the new structure:

```typescript
// contexts/item-library-context.tsx
ItemLibraryProvider {
  items: Item[]
  addItem(item: Item): void
  updateItem(id: string, updates: Partial<Item>): void
  deleteItem(id: string): void  // Also removes all instances
  getItem(id: string): Item | undefined
  getItemsByCategory(category: string): Item[]
  searchItems(query: string): Item[]
}

// contexts/home-context.tsx (enhanced)
HomeProvider {
  homes: Home[]
  currentHomeId: string | null

  // CRUD
  addHome(home: Home): void
  updateHome(id: string, updates: Partial<Home>): void
  deleteHome(id: string): void

  // Navigation
  setCurrentHome(id: string): void

  // NEW: Instance management
  addInstanceToRoom(roomId: string, itemId: string, position: Vector3): string
  updateInstance(instanceId: string, updates: Partial<ItemInstance>): void
  deleteInstance(instanceId: string): void

  // Queries
  getInstancesForItem(itemId: string): Array<{
    instance: ItemInstance
    room: Room
    home: Home
  }>
}

// contexts/room-context.tsx (updated)
RoomProvider {
  // Update to use instances instead of furniture
  rooms: Room[]  // Room.instances: ItemInstance[]
  currentRoomId: string | null

  addRoom(room: Room): void
  updateRoom(id: string, updates: Partial<Room>): void
  deleteRoom(id: string): void

  // Undo/redo still works with instances
  undo(): void
  redo(): void
}
```

### Data Layer (Phase 2: Persistence)
When adding persistence (localStorage, then database):

**LocalStorage Structure:**
```json
{
  "items": [...],
  "homes": [
    {
      "id": "home_001",
      "name": "Unit 4A",
      "rooms": [
        {
          "id": "room_001",
          "instances": [
            {
              "id": "inst_001",
              "itemId": "item_chair_001",
              "position": {...},
              "rotation": {...},
              "scaleMultiplier": {...}
            }
          ]
        }
      ]
    }
  ]
}
```

**Database Schema (Future):**
```sql
-- Items table
items (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  model_path VARCHAR NOT NULL,
  thumbnail_path VARCHAR,
  dimensions JSON NOT NULL,  -- {width, height, depth}
  category VARCHAR NOT NULL,
  tags JSON,  -- string[]
  is_custom BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Homes table
homes (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  thumbnail_path VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Rooms table
rooms (
  id VARCHAR PRIMARY KEY,
  home_id VARCHAR REFERENCES homes(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  dimensions JSON,  -- {width, height, depth} or null if floorplan
  floorplan JSON,   -- FloorplanConfig or null
  position JSON NOT NULL,  -- {x, y, z}
  camera_position JSON NOT NULL,
  camera_target JSON NOT NULL,
  lighting JSON,
  created_at TIMESTAMP
)

-- Item instances (placements)
item_instances (
  id VARCHAR PRIMARY KEY,
  item_id VARCHAR REFERENCES items(id) ON DELETE CASCADE,
  room_id VARCHAR REFERENCES rooms(id) ON DELETE CASCADE,
  position JSON NOT NULL,  -- {x, y, z}
  rotation JSON NOT NULL,  -- {x, y, z}
  scale_multiplier JSON NOT NULL,  -- {x, y, z}
  custom_name VARCHAR,  -- optional override
  placed_at TIMESTAMP
)
```

### Routing Implementation

**Using Next.js App Router:**
```
app/
├── layout.tsx             (Root layout with providers)
├── page.tsx               (Redirect to /homes)
├── items/
│   ├── page.tsx          (Items Library)
│   └── [id]/
│       └── page.tsx      (Item Detail)
└── homes/
    ├── page.tsx          (Homes List)
    └── [id]/
        └── page.tsx      (Home Editor - current prototype)
```

### Component Refactoring

**Current → New Mapping:**
```
FurnitureLibrary → ItemRenderer
  - Takes Item + ItemInstance props
  - Loads model from Item.modelPath
  - Applies transforms from instance

FurnitureEditor → InstanceEditor
  - Edits ItemInstance properties
  - Shows parent Item info (read-only)
  - Link to Item detail page

FurnitureSidebar → RoomInstancesList
  - Shows instances in current room
  - Click to select instance
  - "Add Items" button to open library modal

FURNITURE_CATALOG → Built-in Items
  - Seed ItemLibraryContext with default items
  - Mark as isCustom: false
```

### 3D Rendering Changes

**Minimal changes needed:**
- Replace `furniture: FurnitureItem[]` with `instances: ItemInstance[]`
- Join instances with items when rendering
- Everything else (positioning, selection, hover) works the same

```typescript
// In Room.tsx or scene renderer
const renderInstances = (instances: ItemInstance[]) => {
  return instances.map(instance => {
    const item = getItem(instance.itemId)
    if (!item) return null

    return (
      <ItemRenderer
        key={instance.id}
        item={item}
        instance={instance}
        isSelected={selectedInstanceId === instance.id}
        isHovered={hoveredInstanceId === instance.id}
        onSelect={() => setSelectedInstance(instance.id)}
        onPositionChange={(pos) => updateInstance(instance.id, {position: pos})}
      />
    )
  })
}
```

---

## Phased Implementation Plan

### Phase 1: Data Model Refactor (Foundation)
**Goal:** Separate Items from Instances without UI changes

- [ ] Create `Item` and `ItemInstance` types
- [ ] Create `ItemLibraryContext` with CRUD operations
- [ ] Update `HomeContext` to use instances instead of furniture
- [ ] Update `RoomContext` to work with instances
- [ ] Refactor components to use new types (internal only)
- [ ] Migrate example home data to new structure
- [ ] Seed item library with current furniture catalog

**Outcome:** App works identically, but data is separated under the hood

### Phase 2: Items Library UI
**Goal:** Users can view and manage their item library

- [ ] Create `/items` page with grid view
- [ ] Implement item search/filter
- [ ] Create item detail page `/items/:id`
- [ ] Add "Create Item" modal with upload
- [ ] Add "Edit Item" functionality
- [ ] Add "Delete Item" with instance checking
- [ ] Show item usage (which homes/rooms)

**Outcome:** Users can manage their item library separately

### Phase 3: Enhanced Home Editor
**Goal:** Place items from library into homes

- [ ] Add "Add Items" button to home editor sidebar
- [ ] Create item library modal for placement
- [ ] Update instance editor to show parent item info
- [ ] Add link from instance to item detail
- [ ] Add "Duplicate Instance" button
- [ ] Improve room management UI

**Outcome:** Complete workflow for items → homes

### Phase 4: Homes List UI
**Goal:** Better home management

- [ ] Create `/homes` page with card view
- [ ] Add home thumbnails (auto-generate or upload)
- [ ] Improve "Create Home" flow
- [ ] Add home descriptions
- [ ] Add home deletion with confirmation
- [ ] Make landing page redirect to `/homes`

**Outcome:** Dedicated homes management page

### Phase 5: Data Persistence
**Goal:** Save state across sessions

- [ ] Add localStorage serialization
- [ ] Auto-save on changes (debounced)
- [ ] Load state on app init
- [ ] Handle migration from old structure (if needed)
- [ ] Add export/import functionality

**Outcome:** Changes persist across browser sessions

### Phase 6: Polish & Features
**Goal:** Improve UX and add nice-to-haves

- [ ] Add keyboard shortcuts documentation
- [ ] Improve drag-and-drop experience
- [ ] Add instance duplication
- [ ] Add bulk selection/operations
- [ ] Add item thumbnail generation from model
- [ ] Add undo/redo for item library operations
- [ ] Performance optimizations (model instancing)

**Outcome:** Production-ready experience

### Phase 7: Future Enhancements (Out of Scope for Now)
- Database persistence with API
- User authentication
- Cloud model storage
- Sharing/collaboration
- Model marketplace
- Mobile/tablet support
- VR/AR preview
- Export to other formats (USD, FBX, etc.)

---

## Design Decisions

### Confirmed Decisions ✅

1. **Instance Naming:**
   - ✅ Users CAN name individual instances (e.g., "Mom's Chair" vs "Chair")
   - Show custom name in UI when set, fallback to Item name

2. **Home Editor Placement:**
   - ✅ New items appear at **room center**
   - Ghost preview: nice-to-have for future

3. **Item Thumbnails:**
   - ✅ Auto-generate from 3D models (low priority, Phase 6+)
   - Allow manual upload as fallback

4. **Item Library Organization:**
   - ✅ Support folders/collections (low priority, Phase 6+)
   - Start with flat list + search/filter by category/tags

### Open Questions / Future Decisions

5. **Deletion Behavior:**
   - When deleting an Item that's used in homes:
     - Show all usages and confirm ✅ (preferred approach)
     - Delete all instances automatically
     - Or: Convert instances to "orphaned" with broken reference?

6. **Multi-Home Features:**
   - Should users be able to copy/move instances between rooms/homes?
   - Should there be a way to duplicate an entire room with all instances?

7. **Scale Behavior:**
   - When updating an Item's dimensions, should all instances update proportionally?
   - Or should instances maintain their absolute size?
   - Should we have a "Reset to Item Default" button on instances?

8. **Item Creation UX:**
   - Should users be able to drag-drop .glb files directly into the browser?
   - Should we support uploading multiple items at once?

---

## Success Metrics

After full implementation, users should be able to:
- ✅ View all their items in one place, searchable and organized
- ✅ Create new items by uploading .glb files
- ✅ Edit item metadata without affecting placements
- ✅ See where each item is used across all homes
- ✅ Create multiple homes, each with multiple rooms
- ✅ Place any item from their library into any room
- ✅ Move, rotate, and scale instances independently
- ✅ Have the same item appear multiple times in different locations
- ✅ Delete items and understand the impact on their homes
- ✅ Have all changes persist across browser sessions

---

## Next Steps

1. **Review this spec** - Discuss any changes or clarifications needed
2. **Start Phase 1** - Begin with data model refactor
3. **Iterate piece by piece** - Complete one phase before moving to next
4. **Test continuously** - Ensure nothing breaks as we refactor

This spec is a living document and will evolve as we build!
