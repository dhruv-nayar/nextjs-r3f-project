# Quick Start Guide - Multi-Room 3D Viewer

Welcome! Your project now has a complete multi-room 3D viewer system with floorplan upload capability.

## 🚀 What's Running

The dev server should be running at: **http://localhost:3000**

You should see:
- A 3D scene with a grid floor
- 4 colored placeholder "furniture" boxes (sofa, table, 2 chairs)
- Navigation bar at top center
- Camera controls on the left side

## 📐 Global Scale System

**Everything uses this scale:**
```
1 THREE.JS UNIT = 1 FOOT
```

So when you place furniture:
- Position `{ x: 5, y: 0, z: 3 }` means **5 feet right, 3 feet forward**
- A sofa with scale `{ x: 7, y: 2.5, z: 3 }` is **7ft wide × 2.5ft tall × 3ft deep**

## 🎮 Controls

### Mouse/Touchpad
- **Drag**: Rotate camera around the room
- **Scroll/Pinch**: Zoom in and out
- **Right-drag**: Pan the view

### Control Panel (Left Side)
- **+**: Zoom in
- **−**: Zoom out
- **Arrow buttons**: Pan view (up, down, left, right)
- **⌂**: Reset camera to starting position

## 🏠 Your First Room

### 1. Add a New Room
Click **"+ Add Room"** at the top of the screen

### 2. Upload a Floorplan
1. Click **"📐 Floorplan"** button
2. Click "Choose Image" and select your floorplan
   - You can use the sample: `/public/SAMPLE_FLOORPLAN.svg`
   - Or any image of a floor plan
3. Enter real-world dimensions:
   - Example: 20 feet × 15 feet
4. Click "Upload Floorplan"

**Don't have a floorplan?** You can still use the grid view - each grid square = 1 foot

### 3. Add Furniture

Edit the file `/lib/room-context.tsx`:

```typescript
furniture: [
  {
    id: 'my-sofa',
    name: 'My Sofa',
    modelPath: '/models/sofa.glb',  // Your 3D model
    position: { x: 0, y: 0, z: -5 },  // 5 feet back from center
    rotation: { x: 0, y: 0, z: 0 },   // No rotation
    scale: { x: 7, y: 2.5, z: 3 },    // 7ft × 2.5ft × 3ft
    category: 'seating'
  }
]
```

## 📦 Getting 3D Furniture Models

See **`FREE_MODELS_GUIDE.md`** for complete instructions!

### Quick Links (Best Free Sources)

1. **Poly Pizza** (easiest, CC0):
   - https://poly.pizza
   - Search "chair", "table", "sofa", etc.
   - Download GLB → put in `/public/models/`

2. **Sketchfab** (largest library):
   - https://sketchfab.com/3d-models
   - Filter: Downloadable, Free
   - Check license before using

3. **Quaternius** (game assets, CC0):
   - https://quaternius.com/packs/ultimatefurniture.html
   - Furniture packs, all free

### Download and Use a Model

```bash
# 1. Download a model from Poly Pizza or Sketchfab
# 2. Save to /public/models/
mv ~/Downloads/chair.glb public/models/chair.glb

# 3. Reference in code
modelPath: '/models/chair.glb'
```

## 🎨 Creating Models from Your Photos

### Option 1: Luma AI (5-10 minutes)
1. Go to https://lumalabs.ai
2. Upload 1 photo of your furniture
3. Wait ~10 minutes
4. Download GLB file
5. Save to `/public/models/`

### Option 2: Polycam (Best quality)
1. Download Polycam app (iOS/Android)
2. Take 50-100 photos walking around furniture
3. Process scan
4. Download GLB
5. Save to `/public/models/`

**Important:** Models must be scaled to match our system (1 unit = 1 foot)

## 📏 Scaling Your Models

After downloading a model, you'll likely need to adjust the scale:

```typescript
scale: { x: 1, y: 1, z: 1 }  // Too small/big? Adjust these numbers
```

**Reference sizes (typical furniture in feet):**
- Dining Chair: 1.5 × 3 × 1.5 (W × H × D)
- Sofa: 7 × 2.5 × 3
- Coffee Table: 4 × 1.5 × 2
- Bed (Queen): 5 × 2 × 6.6
- Bookshelf: 3 × 6 × 1

## 🗂 Project Structure

```
nextjs-r3f-project/
├── lib/
│   ├── constants.ts          # Global scale settings
│   ├── room-context.tsx      # Room management (EDIT THIS for furniture)
│   └── controls-context.tsx  # Camera controls
├── components/
│   ├── rooms/
│   │   ├── RoomScene.tsx     # Main 3D scene
│   │   └── RoomNavigation.tsx # Top navigation bar
│   ├── floorplan/
│   │   ├── FloorplanUpload.tsx # Upload modal
│   │   └── Floorplan.tsx      # 3D floorplan renderer
│   ├── furniture/
│   │   └── FurnitureLibrary.tsx # Furniture renderer
│   └── Controls.tsx          # Left sidebar controls
├── public/
│   ├── models/               # PUT YOUR 3D MODELS HERE (.glb files)
│   ├── floorplans/          # Uploaded floorplans go here
│   └── SAMPLE_FLOORPLAN.svg  # Sample floorplan
├── types/
│   └── room.ts              # TypeScript types
├── FREE_MODELS_GUIDE.md     # Complete guide to finding models
├── MULTI_ROOM_GUIDE.md      # Detailed usage guide
└── QUICK_START.md           # This file
```

## 🎯 Common Tasks

### Add Furniture to Current Room
1. Open `/lib/room-context.tsx`
2. Find `DEFAULT_ROOMS` array
3. Add to the `furniture` array
4. Save and reload page

### Change Camera View
In `/lib/room-context.tsx`, adjust:
```typescript
cameraPosition: { x: 0, y: 5.5, z: 20 },  // Where camera is
cameraTarget: { x: 0, y: 0, z: 0 },       // What camera looks at
```

### Add New Room
Click "+ Add Room" button or edit `DEFAULT_ROOMS` array

### Remove Placeholder Furniture
In `/lib/room-context.tsx`, set `furniture: []`

## ❓ Troubleshooting

### I see colored boxes instead of furniture
- This is normal! The boxes are placeholders
- Download real 3D models and replace the `modelPath`
- See `FREE_MODELS_GUIDE.md`

### My floorplan is the wrong size
- Click "📐 Floorplan" again
- Re-upload with correct dimensions
- Make sure you measured your real room correctly

### Furniture is floating or underground
- Adjust the `y` position in furniture config
- `y: 0` = floor level
- Most furniture should have `y: 0`

### Model doesn't load
- Check file path: `/public/models/yourmodel.glb`
- In code, use: `modelPath: '/models/yourmodel.glb'` (no "public")
- Check browser console for errors (F12)

### Camera controls don't work
- Make sure you're not clicking on the UI elements
- Try clicking in the center of the screen
- Check browser console for errors

## 📚 Next Steps

### Beginner Path
1. ✅ View the default scene with placeholder furniture
2. Download 3 models from Poly Pizza (chair, table, sofa)
3. Replace placeholder `modelPath` values
4. Upload a simple floorplan
5. Adjust furniture positions

### Advanced Path
1. Create accurate floorplans in Floorplanner/SketchUp
2. Take photos of real furniture with Polycam
3. Process 3D scans into GLB files
4. Create multiple rooms (bedroom, kitchen, etc.)
5. Fine-tune lighting and camera angles

## 🎉 You're Ready!

Start by:
1. Exploring the default scene
2. Reading `FREE_MODELS_GUIDE.md` (5 min)
3. Downloading 1-2 models from Poly Pizza (10 min)
4. Adding them to your room (5 min)

**Total time to first custom furniture: ~20 minutes**

---

**Questions?** Check the detailed guides:
- `FREE_MODELS_GUIDE.md` - Where to get 3D models
- `MULTI_ROOM_GUIDE.md` - Complete room system documentation

**Happy building! 🏗️**
