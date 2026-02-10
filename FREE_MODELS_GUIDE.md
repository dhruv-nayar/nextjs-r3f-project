# Free 3D Model Sources Guide

This project uses **1 THREE.JS UNIT = 1 FOOT** as the global scale. When downloading or creating models, ensure they follow this scale.

## 🎯 Best Free Model Sources (Ranked by Quality)

### 1. **Poly Pizza** ⭐ BEST FOR BEGINNERS
- **URL**: https://poly.pizza
- **License**: CC0 (Public Domain) - Use anywhere, no attribution needed
- **Quality**: Good to Excellent
- **File Format**: GLB/GLTF
- **Search Examples**:
  - "chair" - https://poly.pizza/?q=chair
  - "table" - https://poly.pizza/?q=table
  - "sofa" - https://poly.pizza/?q=sofa
  - "bed" - https://poly.pizza/?q=bed
  - "desk" - https://poly.pizza/?q=desk

**How to use:**
1. Search for furniture type
2. Click model → Download GLB
3. Place in `/public/models/` folder
4. Scale appropriately (see scaling guide below)

---

### 2. **Sketchfab** ⭐ LARGEST LIBRARY
- **URL**: https://sketchfab.com/3d-models
- **License**: Various (check each model)
- **Filter by**: Free, Downloadable
- **Quality**: Varies (Low to Excellent)
- **File Format**: GLB/GLTF, FBX, OBJ

**How to filter for free models:**
1. Go to https://sketchfab.com/3d-models
2. Click "Filters" → Check "Downloadable"
3. Scroll to "Price" → Select "Free"
4. Search for furniture (e.g., "modern chair")

**Direct Search URLs:**
- Chairs: https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount&q=chair
- Tables: https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount&q=table
- Sofas: https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount&q=sofa

**⚠️ Check License**: Always verify the Creative Commons license allows your use case.

---

### 3. **Quaternius** ⭐ GAME ASSETS (LOW POLY)
- **URL**: https://quaternius.com
- **License**: CC0 (Public Domain)
- **Quality**: Low-poly but stylized
- **Perfect for**: Quick prototyping, stylized scenes

**Collections:**
- Ultimate Furniture Pack: https://quaternius.com/packs/ultimatefurniture.html
- House Interior Pack: https://quaternius.com/packs/houseinterior.html

---

### 4. **Kenney Assets**
- **URL**: https://kenney.nl/assets
- **License**: CC0 (Public Domain)
- **Quality**: Low-poly, clean
- **Perfect for**: Prototyping

**Furniture Packs:**
- Furniture Kit: https://kenney.nl/assets/furniture-kit
- Interior Kit: https://kenney.nl/assets/interior-kit

---

### 5. **CGTrader Free Section**
- **URL**: https://www.cgtrader.com/free-3d-models
- **License**: Royalty-free (check individual licenses)
- **Quality**: Professional
- **File Format**: FBX, OBJ, GLB

**Search by category:**
- https://www.cgtrader.com/free-3d-models/furniture
- https://www.cgtrader.com/free-3d-models/interior

---

### 6. **Free3D**
- **URL**: https://free3d.com
- **License**: Varies (check each)
- **Quality**: Mixed
- **Categories**: Furniture, Interior

**Direct furniture link:**
- https://free3d.com/3d-models/furniture

---

### 7. **TurboSquid Free**
- **URL**: https://www.turbosquid.com/Search/3D-Models/free
- **License**: Free (with attribution typically)
- **Quality**: Professional
- **Note**: Requires account

---

## 📐 Scaling Guide

After downloading a model, you'll likely need to scale it. Here's how:

### Understanding the Scale
- **1 unit = 1 foot** in this project
- A 6-foot tall person = 6 units tall
- A 3ft x 2ft table = 3 x 2 units

### Common Furniture Dimensions (in feet/units):

| Furniture | Width | Depth | Height |
|-----------|-------|-------|--------|
| Dining Chair | 1.5 | 1.5 | 3 |
| Dining Table | 5 | 3 | 2.5 |
| Sofa | 7 | 3 | 2.5 |
| Coffee Table | 4 | 2 | 1.5 |
| Desk | 5 | 2.5 | 2.5 |
| Bookshelf | 3 | 1 | 6 |
| Bed (Queen) | 5 | 6.6 | 2 |
| Nightstand | 2 | 1.5 | 2 |

### How to Scale Models

**Method 1: In Code**
```typescript
const furnitureItem: FurnitureItem = {
  id: 'chair-1',
  name: 'Dining Chair',
  modelPath: '/models/chair.glb',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1.5, y: 1.5, z: 1.5 }, // Adjust this!
  category: 'seating'
}
```

**Method 2: In Blender** (before exporting)
1. Import your model
2. Press `S` (scale)
3. Type the scale factor
4. File → Export → glTF 2.0 (.glb)

---

## 🔧 Model Optimization

Many downloaded models are too large for web. Optimize them:

### Using gltf-pipeline (Command Line)
```bash
# Install
npm install -g gltf-pipeline

# Optimize/compress
gltf-pipeline -i input.glb -o output.glb -d
```

### Using Blender
1. Import model
2. Select all objects
3. Decimation: Modifiers → Add Modifier → Decimate
4. Ratio: 0.5 (reduces polygons by 50%)
5. Export as GLB with compression

### Using Online Tools
- **glTF Viewer**: https://gltf-viewer.donmccurdy.com/
- **glTF Report**: Shows file size, polygon count
- **Optimize**: Some viewers have built-in optimization

---

## 🎨 Creating Your Own from Photos

### Option 1: Luma AI (Easiest)
- **URL**: https://lumalabs.ai
- **How**: Upload 1 photo → Wait 5-10 min → Download GLB
- **Quality**: Good for simple objects
- **Cost**: Free tier available

### Option 2: Polycam (Best Quality)
- **URL**: https://poly.cam
- **How**: Take 50-100 photos → Process → Download
- **Quality**: Excellent
- **Cost**: Free tier available
- **App**: iOS and Android

### Option 3: Photogrammetry (Free, Advanced)
- **Tool**: Meshroom (free) - https://alicevision.org/#meshroom
- **How**: Take 50-100 photos → Process → Clean in Blender
- **Quality**: Professional
- **Time**: 1-2 hours per object

---

## 📦 Recommended Starting Pack

For quick prototyping, download these:

### Minimal Set (5 models):
1. **Chair** - Poly Pizza: https://poly.pizza/?q=chair
2. **Table** - Poly Pizza: https://poly.pizza/?q=table
3. **Sofa** - Poly Pizza: https://poly.pizza/?q=sofa
4. **Bed** - Poly Pizza: https://poly.pizza/?q=bed
5. **Plant** - Poly Pizza: https://poly.pizza/?q=plant

### Full Room Set (15+ models):
- Download Quaternius Ultimate Furniture Pack
- Or search Sketchfab for "furniture pack"

---

## 🚀 Quick Start Workflow

1. **Download model** from Poly Pizza or Sketchfab
2. **Save** to `/public/models/your-model.glb`
3. **Test scale** by adding to a room:
   ```typescript
   {
     id: 'test-1',
     name: 'My Chair',
     modelPath: '/models/your-model.glb',
     position: { x: 0, y: 0, z: 0 },
     rotation: { x: 0, y: 0, z: 0 },
     scale: { x: 1, y: 1, z: 1 }, // Adjust until correct size
     category: 'seating'
   }
   ```
4. **Adjust scale** if too big/small
5. **Repeat** for more furniture!

---

## ❓ Troubleshooting

### Model is too large/small
- Adjust the `scale` property
- 1 foot tall in real life = 1 unit tall in scene

### Model doesn't load
- Check file path is correct
- Verify .glb file is in `/public/models/`
- Check browser console for errors

### Model looks dark
- Add more lighting in room config
- Check if model has materials/textures

### Model is too detailed (slow)
- Use gltf-pipeline to compress
- Or find a low-poly version

---

## 📚 Additional Resources

- **Three.js GLB Format**: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
- **Blender to Web**: https://www.youtube.com/results?search_query=blender+gltf+export
- **3D Model Licenses**: https://creativecommons.org/licenses/

---

**Happy modeling! 🎉**
