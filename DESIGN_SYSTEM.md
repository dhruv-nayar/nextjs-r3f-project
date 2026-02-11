# Studio OMHU Design System

## Color Palette

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Porcelain** | `#FAF9F6` | Main background, light surfaces |
| **Floral White** | `#F9F6EE` | Secondary background, cards, panels |
| **Taupe** | `#48392A` | Primary text, warm brown accents |
| **Graphite** | `#2F2F2F` | Dark text, headings |
| **Sage Green** | `#69995D` | Success, positive actions |
| **Scarlet Fire** | `#FF331F` | Danger, destructive actions |

### Color Values

#### CSS HEX
```css
--porcelain: #faf9f6ff;
--floral-white: #f9f6eeff;
--taupe: #48392aff;
--graphite: #2f2f2fff;
--sage-green: #69995dff;
--scarlet-fire: #ff331fff;
```

#### CSS HSL
```css
--porcelain: hsla(45, 29%, 97%, 1);
--floral-white: hsla(44, 48%, 95%, 1);
--taupe: hsla(30, 26%, 22%, 1);
--graphite: hsla(0, 0%, 18%, 1);
--sage-green: hsla(108, 24%, 48%, 1);
--scarlet-fire: hsla(5, 100%, 56%, 1);
```

#### SCSS HEX
```scss
$porcelain: #faf9f6ff;
$floral-white: #f9f6eeff;
$taupe: #48392aff;
$graphite: #2f2f2fff;
$sage-green: #69995dff;
$scarlet-fire: #ff331fff;
```

#### SCSS HSL
```scss
$porcelain: hsla(45, 29%, 97%, 1);
$floral-white: hsla(44, 48%, 95%, 1);
$taupe: hsla(30, 26%, 22%, 1);
$graphite: hsla(0, 0%, 18%, 1);
$sage-green: hsla(108, 24%, 48%, 1);
$scarlet-fire: hsla(5, 100%, 56%, 1);
```

#### SCSS RGB
```scss
$porcelain: rgba(250, 249, 246, 1);
$floral-white: rgba(249, 246, 238, 1);
$taupe: rgba(72, 57, 42, 1);
$graphite: rgba(47, 47, 47, 1);
$sage-green: rgba(105, 153, 93, 1);
$scarlet-fire: rgba(255, 51, 31, 1);
```

#### SCSS Gradients
```scss
$gradient-top: linear-gradient(0deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-right: linear-gradient(90deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-bottom: linear-gradient(180deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-left: linear-gradient(270deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-top-right: linear-gradient(45deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-bottom-right: linear-gradient(135deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-top-left: linear-gradient(225deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-bottom-left: linear-gradient(315deg, #faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
$gradient-radial: radial-gradient(#faf9f6ff, #f9f6eeff, #48392aff, #2f2f2fff, #69995dff, #ff331fff);
```

### Opacity Utilities

Common opacity values for subtle effects:
- `taupe/5` - Very subtle borders (5% opacity)
- `taupe/10` - Subtle borders and dividers (10% opacity)
- `taupe/20` - Dashed borders (20% opacity)
- `taupe/40` - Secondary text (40% opacity)
- `taupe/70` - Tertiary text (70% opacity)

## Typography

### Font Families

- **Display Font**: Playfair Display (weights: 500, 600)
  - Usage: Headings, brand text, emphasis
- **Body Font**: Inter (weights: 300, 400, 500, 600)
  - Usage: Body text, UI elements, labels

### Type Scale

| Element | Class | Size | Weight | Line Height |
|---------|-------|------|--------|-------------|
| Page Title | `text-lg font-display font-medium` | 18px | 500 | Normal |
| Item Name | `text-base font-display` | 16px | Normal | Tight |
| Body Text | `text-sm font-body` | 14px | Normal | Normal |
| Category Label | `text-[10px] font-body font-light` | 10px | 300 | Normal |
| Small Text | `text-xs font-body` | 12px | Normal | Normal |

### Text Colors

- Primary: `text-graphite` - Main content
- Secondary: `text-taupe/70` - Less emphasis
- Tertiary: `text-taupe/40` - Labels, captions
- Muted: `text-taupe/50` - Disabled, placeholders

## Spacing

### Border Radius
- Small: `rounded-lg` (8px)
- Medium: `rounded-xl` (12px)
- Large: `rounded-2xl` (16px)
- Extra Large: `rounded-3xl` (24px)

### Shadows
- Subtle: `shadow-sm` - Default cards
- Medium: `shadow-md` - Hover states
- Large: `shadow-xl` - Dropdowns, modals
- Extra Large: `shadow-2xl` - Modal overlays

### Gaps
- Tight: `gap-2` (8px)
- Default: `gap-3` (12px)
- Medium: `gap-4` (16px)
- Comfortable: `gap-5` (20px)
- Relaxed: `gap-6` (24px)

## Components

### Button Variants
- **Primary**: `bg-sage hover:bg-sage/90` - Main actions
- **Secondary**: White background with border
- **Danger**: `bg-scarlet hover:bg-scarlet/90` - Destructive actions
- **Ghost**: Transparent with hover state

### Card Styles
- Background: `bg-white` or transparent
- Border: `border border-taupe/10` (subtle)
- Shadow: `shadow-sm hover:shadow-md`
- Padding: `p-6` or `p-8`

### Input Fields
- Background: `bg-floral-white`
- Border: `rounded-lg`
- Focus: `focus:outline-none focus:bg-white`
- Placeholder: `placeholder:text-taupe/40`

### Dropdowns
- Background: `bg-white`
- Border: `border border-taupe/10`
- Shadow: `shadow-xl`
- Padding: `py-2`
- Item hover: `hover:bg-taupe/5`

## Layout

### Grid
- Gallery: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Gap: `gap-5` (20px)

### Container
- Max width: `max-w-7xl`
- Padding: `px-6 py-8`

### Sidebar
- Width: `w-64` (256px)
- Background: `bg-floral-white`
- Border: `border border-taupe/5`
- Border radius: `rounded-2xl`

## Interaction States

### Transitions
- Default: `transition-colors` (200ms)
- Shadow: `transition-shadow duration-200`
- All: `transition-all`

### Hover States
- Text: `hover:text-graphite`
- Background: `hover:bg-taupe/5`
- Shadow: `hover:shadow-md`
- Border: `hover:border-taupe/10`

### Active States
- Selected category: Text without background
- Active nav item: `border-b-2 border-graphite`

## Design Principles

1. **Minimalism**: Prefer subtle borders and shadows over heavy visual elements
2. **Hierarchy**: Use font size and weight to establish clear content hierarchy
3. **Spacing**: Generous whitespace for breathing room
4. **Consistency**: Reusable components with consistent styling
5. **Refinement**: Attention to subtle details (font weights, opacity levels, spacing)
