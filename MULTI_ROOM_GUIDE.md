# Multi-Room Setup Guide

This project now supports multiple rooms with floorplan upload and furniture placement.

## 🎯 Global Scale System

**IMPORTANT**: This entire project uses a unified scale:

```
1 THREE.JS UNIT = 1 FOOT (real world)
```

Use this scale for:
- Floorplan dimensions
- 3D model creation
- Furniture positioning

### Quick Reference
- 1 inch = 0.0833 units
- 12 inches = 1 unit (1 foot)
- 1 meter = 3.28 units
- Average ceiling height = 8 units (8 feet)
- Door height = 6.67 units (80 inches)

---

## 🏠 Creating Your First Room

### Step 1: Add a New Room
1. Click **"+ Add Room"** button at the top of the screen
2. A new room will be created and selected automatically

### Step 2: Upload a Floorplan
1. Click **"📐 Floorplan"** button
2. Click **"Choose Image"** to upload your floorplan
3. Enter the **real-world dimensions**:
   - Width: feet and inches
   - Height: feet and inches
4. Click **"Upload Floorplan"**

**Example:**
- Image: `my-bedroom.png` (2000px × 1500px)
- Real dimensions: 15 feet 6 inches × 12 feet 0 inches
- Scale calculated: ~130 pixels per foot

### Step 3: Add Furniture
Currently, furniture is added via code. See "Adding Furniture Programmatically" below.

---

## 📏 Preparing Your Floorplan Image

### Option 1: Scan/Photo
1. Take a photo of architectural plans
2. Or scan a hand-drawn floorplan
3. Crop to just the room outline
4. Save as PNG or JPG

### Option 2: Create in Software
**Free tools:**
- **Floorplanner**: https://floorplanner.com (free tier)
- **RoomSketcher**: https://www.roomsketcher.com (free trial)
- **SketchUp Free**: https://www.sketchup.com/plans-and-pricing/sketchup-free
- **SweetHome3D**: http://www.sweethome3d.com/ (free, desktop)

**Export tips:**
- Export as PNG or JPG
- Higher resolution = better (1000-3000px width)
- Include only the floor outline (walls, doors, windows)
- Remove furniture/annotations from the floorplan

### Option 3: Draw by Hand
1. Measure your room with tape measure
2. Draw on graph paper (1 square = 1 foot)
3. Scan or photograph
4. Use the grid to count real dimensions

---

## 🪑 Adding Furniture Programmatically

### Update Room Context
Edit `/lib/room-context.tsx` to add furniture to a room:

```typescript
const DEFAULT_ROOMS: Room[] = [
  {
    id: 'living-room',
    name: 'Living Room',
    furniture: [
      {
        id: 'sofa-1',
        name: 'Sofa',
        modelPath: '/models/sofa.glb',
        position: { x: 0, y: 0, z: 0 },    // Position in feet
        rotation: { x: 0, y: 0, z: 0 },    // Rotation in radians
        scale: { x: 1, y: 1, z: 1 },       // Scale multiplier
        category: 'seating'
      },
      {
        id: 'table-1',
        name: 'Coffee Table',
        modelPath: '/models/table.glb',
        position: { x: 3, y: 0, z: 2 },    // 3 feet right, 2 feet forward
        rotation: { x: 0, y: Math.PI / 4, z: 0 },  // 45° rotation
        scale: { x: 1, y: 1, z: 1 },
        category: 'table'
      }
    ],
    cameraPosition: { x: 0, y: 5.5, z: 20 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    lighting: {
      ambient: { intensity: Math.PI / 2 }
    }
  }
]
```

### Positioning Tips

**Understanding Coordinates:**
- `x`: Left (-) to Right (+)
- `y`: Down (-) to Up (+) [usually 0 for floor-level]
- `z`: Back (-) to Forward (+)

**Typical Y values:**
- Floor items (sofa, bed): `y: 0`
- Elevated (on table): `y: 2.5`
- Wall-mounted: `y: 4`

**Rotation:**
- Rotation is in radians
- 90° = `Math.PI / 2`
- 180° = `Math.PI`
- 270° = `3 * Math.PI / 2`
- 360° = `2 * Math.PI`

---

## 🎬 Using Multiple Rooms

### Switch Between Rooms
Use the dropdown at the top of the screen:
```
Room: [Living Room ▼]
```

### Camera Transitions
When you switch rooms, the camera smoothly animates to the new room's viewpoint.

### Per-Room Settings

Each room can have its own:
- **Floorplan** (different size/image)
- **Furniture** (unique pieces)
- **Camera position** (different viewing angle)
- **Lighting** (brightness, color)

---

## 🎨 Room Configuration Reference

### Full Room Object

```typescript
interface Room {
  id: string                      // Unique identifier
  name: string                    // Display name
  floorplan?: FloorplanConfig    // Optional floorplan image
  furniture: FurnitureItem[]     // Array of furniture
  cameraPosition: Vector3         // Where camera starts
  cameraTarget: Vector3           // What camera looks at
  lighting?: LightingConfig      // Custom lighting
}
```

### Floorplan Config

```typescript
interface FloorplanConfig {
  imagePath: string          // e.g., "/floorplans/bedroom.png"
  widthFeet: number         // Real-world width in feet
  heightFeet: number        // Real-world height in feet
  pixelsPerFoot?: number    // Auto-calculated
}
```

### Furniture Item

```typescript
interface FurnitureItem {
  id: string                 // Unique ID
  name: string              // Display name
  modelPath: string         // Path to GLB file
  position: Vector3          // X, Y, Z in feet
  rotation: Vector3          // X, Y, Z in radians
  scale: Vector3            // Scale multiplier
  category?: string         // 'seating' | 'table' | etc.
}
```

---

## 🔧 Controls

### Mouse/Touchpad
- **Left-click + drag**: Rotate camera around room
- **Right-click + drag**: Pan view
- **Scroll wheel**: Zoom in/out
- **Two-finger pinch**: Zoom (touchpad)

### Control Panel (Left Side)
- **+ / −**: Zoom in/out
- **Arrow buttons**: Pan view
- **⌂ (Home)**: Reset camera to default position

---

## 📸 Example Workflow

Let's create a bedroom:

### 1. Measure Your Room
- Width: 12 feet
- Length: 14 feet

### 2. Draw Floorplan
- Open Paint/Photoshop
- Draw a rectangle
- Add door (3ft opening)
- Add window outlines
- Save as `bedroom.png`

### 3. Upload to Project
- Click "+ Add Room"
- Name it "Bedroom"
- Click "📐 Floorplan"
- Upload `bedroom.png`
- Enter dimensions: 12ft × 14ft

### 4. Add Furniture
Edit `lib/room-context.tsx`:

```typescript
{
  id: 'bedroom',
  name: 'Bedroom',
  furniture: [
    {
      id: 'bed-1',
      name: 'Queen Bed',
      modelPath: '/models/bed.glb',
      position: { x: 0, y: 0, z: -3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      category: 'bed'
    },
    {
      id: 'nightstand-1',
      name: 'Nightstand',
      modelPath: '/models/nightstand.glb',
      position: { x: 3, y: 0, z: -3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      category: 'storage'
    }
  ],
  cameraPosition: { x: 8, y: 5.5, z: 10 },
  cameraTarget: { x: 0, y: 2, z: 0 },
}
```

### 5. View & Adjust
- Reload the page
- Switch to "Bedroom" room
- Adjust furniture positions as needed

---

## 🎯 Tips & Best Practices

### Floorplan Images
- ✅ Use high-contrast images (dark walls on white background)
- ✅ Keep aspect ratio accurate to room
- ✅ Include wall thickness, doors, windows
- ❌ Don't include furniture in floorplan
- ❌ Avoid low-resolution images

### Furniture Placement
- Start with major pieces (bed, sofa)
- Work outward to smaller items
- Leave 2-3 feet for walkways
- Use grid as reference (1 square = 1 foot)

### Camera Setup
- Position camera at comfortable viewing angle
- Target center of room or main furniture
- Height: 5-6 feet (eye level) works well
- Distance: 15-25 feet for full room view

### Performance
- Keep furniture count under 50 items per room
- Use compressed GLB models
- Consider using simpler models for far objects

---

## 🚀 Advanced Features

### Custom Lighting
```typescript
lighting: {
  ambient: { intensity: 2, color: '#ffffff' },
  directional: [{
    position: { x: 10, y: 10, z: 5 },
    intensity: 1.5,
    color: '#fff8dc',
    castShadow: true
  }],
  point: [{
    position: { x: 0, y: 6, z: 0 },  // Ceiling light
    intensity: 1,
    color: '#ffffcc',
    distance: 20
  }]
}
```

### Multiple Floors
Create rooms with different Y positions:
```typescript
// Ground floor
cameraPosition: { x: 0, y: 5.5, z: 20 }

// Second floor
cameraPosition: { x: 0, y: 15.5, z: 20 }  // +10 feet up
```

---

## ❓ Troubleshooting

### Floorplan is wrong size
- Check the dimensions you entered
- Verify image aspect ratio matches real room
- Reload the page after uploading

### Furniture is floating/underground
- Adjust `y` position
- Floor level is `y: 0`
- Most furniture should have `y: 0`

### Can't see furniture
- Check if furniture is outside floorplan bounds
- Verify model file exists at `/public/models/`
- Check browser console for errors

### Camera starts in wrong place
- Update `cameraPosition` in room config
- Use Control Panel home button to reset
- Adjust `cameraTarget` to change what camera looks at

---

## 📚 Next Steps

1. **Add more rooms**: Create floor plans for each room
2. **Download furniture**: See `FREE_MODELS_GUIDE.md`
3. **Create custom models**: Use photos (see guide)
4. **Fine-tune lighting**: Experiment with different intensities
5. **Add interactivity**: Future feature (click furniture to move)

---

**Need help? Check the FREE_MODELS_GUIDE.md for model sources!**
