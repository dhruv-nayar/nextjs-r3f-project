# Floorplan Room Detection System

## Overview

The floorplan editor uses automatic room detection to identify and create rooms from closed shapes formed by walls. The system detects rooms regardless of the order in which walls are drawn.

## How It Works

### 1. Cycle Detection Algorithm

The system uses a "rightmost turn" algorithm to find all closed loops in the wall graph:

- **File**: `lib/utils/floorplan-geometry.ts`
- **Function**: `detectAllRooms()`
- **Algorithm**: Traces paths through walls by always taking the rightmost turn at each vertex
- **Result**: Finds all possible cycles in the wall network

### 2. Validation Pipeline

Detected cycles go through several validation steps:

#### Step 1: Simple Polygon Check (`isSimplePolygon`)
- Verifies the cycle forms a non-self-intersecting polygon
- Tests both possible starting vertices for the traversal
- Checks each edge pair for intersections
- **Filters out**: Bowtie shapes, figure-8s, and other self-intersecting paths

#### Step 2: Elementary Cycle Filter (`filterElementaryCycles`)
- Filters out cycles that contain other cycles within them
- Uses point-in-polygon testing to detect internal vertices
- Keeps only minimal/face cycles
- **Filters out**: Large cycles that encompass multiple smaller rooms

#### Step 3: Outer Boundary Removal
- Identifies and removes the outermost cycle (the building boundary)
- Based on perimeter calculation (largest perimeter = outer boundary)
- **Result**: Only interior rooms remain

### 3. Room Creation and Reconciliation

**Auto-Detection on Wall Creation**:
- After every wall is created, `autoDetectRooms()` is called
- Detects new closed shapes and creates rooms for them
- Avoids duplicates by comparing normalized wall ID sets

**Reconciliation on Wall Deletion**:
- When a wall is deleted, `reconcileRooms()` is called
- Removes rooms that referenced the deleted wall
- Re-detects remaining valid closed shapes
- Creates merged rooms if two rooms became one

## Known Issues and Limitations

### 1. Bowtie/Self-Intersecting Room Detection

**Issue**: When walls create a bowtie or figure-8 pattern, the system may detect self-intersecting "rooms" with overlapping regions.

**Visual Example**:
```
  /\
 /  \
 \  /
  \/
```
Two triangular rooms sharing a center vertex can be detected as a single bowtie shape.

**Status**: Improved with `isSimplePolygon()` validation that tries both starting vertices, but some edge cases may remain.

**Workaround**: Draw rooms separately without shared internal vertices.

---

### 2. Overlapping Rooms with Diagonal Internal Walls

**Issue**: When a diagonal wall crosses through a space, the cycle detection may create multiple overlapping room regions with different colored fills.

**Observed Behavior**:
- A diagonal line across a pentagon creates two overlapping colored regions
- The same space gets multiple room assignments
- Room boundaries don't align with actual enclosed spaces

**Root Cause**: The elementary cycle filter checks if vertices are inside polygons, but doesn't catch all cases where cycles share edges or create overlapping regions through different wall combinations.

**Status**: Partially mitigated by `filterElementaryCycles()`, but complex diagonal patterns still problematic.

---

### 3. Random Line Creating Invalid Cycle Detection

**Issue**: Adding a disconnected line that doesn't close any space can cause the algorithm to detect invalid cycles that span across the entire floor plan.

**Observed Behavior**:
- A single line at the top of a floor plan causes strange room coloring
- Multiple overlapping colored regions appear
- Rooms detected don't correspond to actual enclosed spaces

**Root Cause**: The graph-based cycle detection finds paths through all connected walls, including paths that traverse through the space in geometrically invalid ways.

**Status**: Improved with polygon validation, but graph topology can still produce unexpected cycles.

---

### 4. Complex Topologies with Multiple Internal Walls

**Issue**: In floor plans with star-shaped patterns, radial walls, or multiple crossing diagonal walls:
- System may miss some valid rooms
- May detect incorrect room boundaries
- May create overlapping room regions

**Example Cases**:
- Multiple diagonal walls intersecting at different points
- Star-shaped or radial wall patterns from a center point
- Highly irregular polygon shapes with many vertices

**Status**: Ongoing limitation of the rightmost-turn algorithm

### 5. Vertex Ordering Ambiguity

**Issue**: When reconstructing a polygon from a cycle of walls, there can be ambiguity about which vertex to start from, potentially leading to incorrect traversal order.

**Current Mitigation**: `isSimplePolygon()` tries both possible starting vertices

**Remaining Cases**: May not catch all ambiguous cases in very complex graphs

### 6. Performance with Large Wall Networks

**Issue**: The cycle detection algorithm runs in O(E²) time where E is the number of edges (walls).

**Impact**: May become slow with very large floorplans (100+ walls)

**Potential Solution**: Consider spatial indexing or incremental updates

### 7. Floating Point Precision

**Issue**: Geometric calculations use floating point arithmetic, which can lead to precision issues.

**Impact**:
- Edge intersection tests may miss nearly-collinear cases
- Point-in-polygon tests may be incorrect near boundaries

**Current Epsilon**: 0.01 feet (~0.12 inches) for intersection detection

### 8. Non-Planar Wall Configurations

**Issue**: The system assumes a planar graph (walls don't cross except at vertices). If walls visually overlap but don't share vertices, behavior is undefined.

**Expected Usage**: Users should split walls at intersection points

## Future Improvements

### High Priority
1. **Better handling of complex internal walls**: Improve elementary cycle detection
2. **Validation feedback**: Show users which walls form invalid topologies
3. **Room merging UX**: When deleting shared walls, ask user to confirm merge

### Medium Priority
1. **Performance optimization**: Incremental room detection instead of full re-detection
2. **Spatial indexing**: For faster point-in-polygon and intersection tests
3. **Undo/redo support**: Maintain room state history

### Low Priority
1. **Room splitting tools**: Allow users to manually divide rooms
2. **Multi-level support**: Handle different floor heights
3. **Advanced validation**: Detect and warn about degenerate cases

## Testing Scenarios

### Working Cases ✓
- Simple rectangular rooms
- L-shaped and irregular polygons
- Sequential wall drawing that closes back to start
- Non-sequential wall drawing (any order)
- Deleting walls that open rooms
- Deleting shared walls between two rooms (merge)
- Simple triangular and pentagonal rooms
- Most convex polygons with 3-8 sides

### Known Problem Cases ⚠️
- **Bowtie patterns**: Two triangular rooms sharing a center vertex
- **Diagonal internal walls**: Single diagonal across a larger room
- **Disconnected lines**: Random lines that don't close spaces but trigger cycle detection
- **Complex star/radial patterns**: Multiple diagonals from center points
- **Overlapping room regions**: Multiple cycles sharing walls creating overlapping fills
- Highly irregular shapes with many vertices (20+)
- Rooms with very small dimensions (<0.5 feet)

### Untested Cases ❓
- Concave polygons with extreme angles
- Nearly collinear wall segments
- Very large floorplans (1000+ walls)
- Curved or arc walls (if added in future)

## Code Architecture

```
detectAllRooms()
├── buildSortedAdjacency() - Build angle-sorted edge list
├── traceCycle() - Trace rightmost-turn paths
├── normalizeCycle() - Deduplicate cycles
├── isSimplePolygon() - Validate non-self-intersecting
├── filterElementaryCycles() - Remove nested cycles
│   ├── getCyclePolygon() - Build polygon from cycle
│   └── isPointInPolygon() - Ray casting test
└── Remove outer boundary by perimeter

autoDetectRooms()
└── Create rooms for new cycles

reconcileRooms()
├── Remove rooms with deleted walls
└── Detect and create merged rooms
```

## Related Files

- `lib/utils/floorplan-geometry.ts` - Core detection algorithms
- `components/floorplan/FloorplanCanvasV2.tsx` - UI integration
- `types/floorplan-v2.ts` - Type definitions

## References

- [Planar Cycle Detection](https://en.wikipedia.org/wiki/Cycle_(graph_theory)#Fundamental_cycles)
- [Point-in-Polygon Algorithm](https://en.wikipedia.org/wiki/Point_in_polygon)
- [Line Segment Intersection](https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection)
