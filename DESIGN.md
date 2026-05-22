---
name: Precision Minimalist
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#47464a'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#78767b'
  outline-variant: '#c8c5ca'
  surface-tint: '#5f5e60'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1d'
  on-primary-container: '#858386'
  inverse-primary: '#c8c6c8'
  secondary: '#5d5e60'
  on-secondary: '#ffffff'
  secondary-container: '#dfdfe0'
  on-secondary-container: '#616364'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1b22'
  on-tertiary-container: '#83838c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e1e4'
  primary-fixed-dim: '#c8c6c8'
  on-primary-fixed: '#1c1b1d'
  on-primary-fixed-variant: '#474649'
  secondary-fixed: '#e2e2e3'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1d'
  on-secondary-fixed-variant: '#454748'
  tertiary-fixed: '#e3e1ec'
  tertiary-fixed-dim: '#c6c5cf'
  on-tertiary-fixed: '#1a1b22'
  on-tertiary-fixed-variant: '#46464e'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  border: '#E4E4E7'
  input: '#E4E4E7'
  ring: '#09090B'
  foreground: '#09090B'
  muted-foreground: '#71717A'
typography:
  h1:
    fontFamily: Outfit
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  h2:
    fontFamily: Outfit
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  h3:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 14px
  label-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 12px
  h1-mobile:
    fontFamily: Outfit
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
The design system is rooted in the philosophy of functional minimalism—where clarity is prioritized over decoration. It targets professional environments, SaaS platforms, and developer tools that require high information density without sacrificing aesthetic elegance. 

The visual style is **Corporate / Modern**, characterized by generous negative space, a monochromatic palette, and ultra-crisp interface elements. It leverages the "Shadcn" aesthetic: a blend of high-contrast utility and understated sophistication. The emotional response should be one of reliability, precision, and "quiet" efficiency.

## Colors
The palette is strictly neutral, utilizing the "Zinc" color scale to create hierarchy through tonal contrast rather than hue. 

- **Primary**: Used for high-emphasis actions and text.
- **Secondary**: Applied to soft backgrounds, hover states, and structural tabs.
- **Tertiary**: Reserved for secondary text and decorative icons.
- **Neutral**: The foundation for surfaces and background layers.

The "Named Colors" provide specific utility roles: `border` ensures a consistent structural hair-line across the UI, while `muted-foreground` handles descriptions and less critical metadata.

## Typography
Outfit is used exclusively to maintain a geometric, modern rhythm. The type system relies on tight line heights and subtle negative letter spacing for headlines to create a "locked-in," professional feel.

Body text is optimized for readability with a standard 1.5x line-height ratio. Labels and UI metadata utilize medium weights (500) to distinguish them from standard body copy without needing color shifts.

## Layout & Spacing
The system uses a strictly linear 4px-based scale. Layouts should follow a **Fixed Grid** approach for dashboard environments, centering content within a maximum width of 1440px on desktop.

- **Desktop**: 12-column grid with 24px gutters.
- **Tablet**: 8-column grid with 16px gutters.
- **Mobile**: 4-column grid with 16px gutters.

Components use a "spacing-first" hierarchy where parent containers typically use `lg` (24px) padding, while internal elements are grouped with `sm` (8px) or `md` (16px) gaps.

## Elevation & Depth
Depth is achieved through **Low-contrast outlines** rather than heavy shadows. This maintains the clean, flat aesthetic essential to the design system.

- **Level 0 (Flat)**: Background surfaces (`#FFFFFF`).
- **Level 1 (Layered)**: Surfaces like cards or modals use a 1px solid border (`#E4E4E7`).
- **Level 2 (Interactive)**: Buttons and active elements may use an extremely soft, diffused shadow (0px 1px 2px rgba(0,0,0,0.05)) to suggest "clickability" without breaking the flat plane.
- **Focus States**: High-contrast rings (`#09090B`) with a 2px offset are used for accessibility and navigation clarity.

## Shapes
The shape language follows the `rounded-md` standard. The standard radius for primary UI components (buttons, inputs, cards) is **0.5rem (8px)**. 

Smaller elements like Tags/Chips may use `rounded-sm` (4px), while large containers like Modals or Side Panels should scale up to `rounded-xl` (24px) to soften the overall interface.

## Components

### Buttons
- **Primary**: Solid `#09090B` background with `#FFFFFF` text. No border.
- **Secondary**: Solid `#F4F4F5` background with `#09090B` text.
- **Outline**: Transparent background with a 1px `#E4E4E7` border.
- **Ghost**: No background or border; subtle `#F4F4F5` background appears on hover.

### Input Fields
- **Default**: 1px solid `#E4E4E7` border, 8px padding, and 14px (body-sm) text.
- **Focus**: Border color remains consistent, but a 2px "ring" of `#09090B` is applied via box-shadow.

### Cards
- White background, 1px `#E4E4E7` border, 0.5rem corner radius. 
- Headers inside cards should use `h3` or `label-md` for clear sectioning.

### Chips/Badges
- Small, uppercase, or medium-weight text with high-contrast background (Primary) or muted background (Secondary). Radius should be 0.5rem to match the button style.

### Lists & Tables
- Minimalist rows separated by 1px `#E4E4E7` horizontal dividers. No vertical borders. Header rows use `label-sm` with `muted-foreground` color.
