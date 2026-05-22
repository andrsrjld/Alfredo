---
name: Zenith Technical
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c3c5d7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8d90a0'
  outline-variant: '#434654'
  surface-tint: '#b5c4ff'
  primary: '#b5c4ff'
  on-primary: '#00297b'
  primary-container: '#648aff'
  on-primary-container: '#00236c'
  inverse-primary: '#1853d7'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffb688'
  on-tertiary: '#512400'
  tertiary-container: '#e17214'
  on-tertiary-container: '#471e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b5c4ff'
  on-primary-fixed: '#00164d'
  on-primary-fixed-variant: '#003cac'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#ffdbc7'
  tertiary-fixed-dim: '#ffb688'
  on-tertiary-fixed: '#311300'
  on-tertiary-fixed-variant: '#733600'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
  gutter: 24px
  margin: 40px
---

## Brand & Style

The design system is rooted in **Ultra-Minimalism** with a heavy emphasis on technical precision and cognitive clarity. It is designed for high-focus environments—such as developer tools, financial terminals, or high-end SaaS—where visual noise is the enemy of productivity. 

The aesthetic is characterized by a "void-like" canvas using a near-black base, where hierarchy is established not through heavy blocks of color, but through light, air, and microscopic detail. The emotional response should be one of calm authority, sophisticated engineering, and premium restraint. Every element exists only if it serves a functional purpose; decoration is replaced by intentional whitespace and hairline borders.

## Colors

The palette is strictly curated to maintain a low-light, high-focus environment. 

- **Canvas:** The primary background is #080808, providing a deep charcoal depth that reduces eye strain and makes white text appear crisp but not vibrating.
- **Accent:** A soft electric blue (#4D7BFF) is used sparingly. It is reserved for primary actions, focus states, and critical status indicators.
- **Neutrals:** Grayscale tones are derived from cool zinc palettes. Surfaces should use #1A1A1A to create subtle separation from the background.
- **Borders:** Use #27272A for standard structural lines. Borders should feel like "hairlines"—present enough to define space, but thin enough to fade into the periphery.

## Typography

This design system utilizes **Geist** as its primary typeface to evoke a clean, technical, and modern feel. For auxiliary data and system labels, **JetBrains Mono** is introduced to reinforce the "engineered" aesthetic.

- **Weight & Contrast:** Favor Medium (500) for headers to provide presence without bulk. Use Regular (400) for all body text to maintain an airy feel.
- **Rhythm:** Line heights are generous (1.6x for body text) to compensate for the dark background, preventing text from feeling cramped or difficult to scan.
- **Caps & Spacing:** Use "label-sm" in all-caps with increased letter spacing for category headers or metadata to create a distinct visual layer from standard prose.

## Layout & Spacing

The layout philosophy is built on a **Strict Fixed Grid** for desktop and a **Fluid Content Model** for mobile. 

- **Grid:** Use a 12-column grid on desktop (1280px max-width) with 24px gutters. Elements should align strictly to the grid edges to maintain a sense of structural integrity.
- **Whitespace:** Emphasize "Macro-whitespace" (64px+) between major sections to allow the UI to breathe. This prevents the dark theme from feeling heavy or claustrophobic.
- **Scaling:** On mobile, margins reduce to 20px, and vertical spacing ("xl") compresses to 40px to ensure content density remains functional for touch interaction.

## Elevation & Depth

Elevation in this design system is achieved through **Tonal Layering** and **Subtle Outlines** rather than traditional heavy shadows.

- **Surface Tiers:** Use #080808 for the base, #121212 for secondary containers (like cards), and #1A1A1A for floating elements (like menus).
- **Outlines:** Every elevated element must have a 1px border (#27272A). This provides the "cut-out" look essential for minimalism.
- **Shadows:** Avoid large, dark shadows. Instead, use a single "Ambient Glow" shadow for floating modals: `0 20px 40px rgba(0, 0, 0, 0.5)`.
- **Glassmorphism:** For overlays and navigation bars, use a 12px backdrop blur with a 60% opacity fill of the background color to maintain context of the content beneath.

## Shapes

The shape language is **Soft-Geometric**. We avoid the playfulness of large rounded corners in favor of a precise, professional "Technical Softness."

- **Standard Radius:** 4px (0.25rem) for buttons, inputs, and small components. This provides a subtle hint of approachability while maintaining a sharp, grid-aligned feel.
- **Large Radius:** 8px (0.5rem) for cards and modals.
- **Interactive States:** Use sharp corners for focus rings to emphasize the digital/technical nature of the system.

## Components

### Buttons
- **Primary:** Solid #4D7BFF background with white text. 4px border radius. No shadow.
- **Secondary:** Transparent background with a #27272A border. Text in white.
- **Ghost:** No border or background. Text in #A1A1AA, shifting to white on hover.

### Input Fields
- **Default State:** Background #121212, border #27272A, text #FFFFFF.
- **Focus State:** Border color shifts to #4D7BFF with a subtle 2px outer glow of the same color.
- **Placeholder:** #52525B (muted gray).

### Cards
- Surfaces should be #121212. Borders are mandatory (#27272A). 
- Internal padding should be generous (24px or 32px) to maintain the "airy" brand promise.

### Chips & Tags
- Small, uppercase labels using JetBrains Mono. 
- Background #1A1A1A with a #27272A border. Height should be minimal (24px).

### Lists
- Use thin dividers (#1A1A1A) between list items. 
- Hover states for list items should use a subtle background shift to #121212 rather than a border change.

### Checkboxes & Radios
- Custom-styled squares (check) and circles (radio) using the Primary Accent color for the active state. 
- The inactive state is a simple #27272A outline.
