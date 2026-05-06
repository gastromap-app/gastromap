# GastroMap Design System (DESIGN.md)

This file serves as the single source of truth for design tokens and principles, enabling Open Design skills.

## 🎨 Color Palette (OKLCH & HSL)
- **Background**: `hsl(var(--background))`
- **Foreground**: `hsl(var(--foreground))`
- **Primary**: `hsl(var(--primary))` (OKLCH equivalent: `oklch(58% 0.233 277.117)`)
- **Secondary**: `hsl(var(--secondary))`
- **Accent**: `hsl(var(--accent))`
- **Surface (Liquid Dark)**: `hsl(220 20% 6%)`
- **Elevated**: `hsl(220 20% 9%)`

## 🔠 Typography
- **Primary Font**: `Inter`, `Helvetica Neue`, `Arial`, `sans-serif`
- **Scale**:
  - `display`: 3rem (800 weight, -0.03em tracking)
  - `h1`: 1.75rem (800 weight)
  - `h2`: 1.375rem (700 weight)
  - `body`: 0.9375rem (400 weight)
  - `eyebrow`: 0.6875rem (700 weight, 0.14em tracking)

## 📐 Layout & Depth
- **Grid**: Standard 12-column or 2/3 + 1/3 split for dashboards.
- **Radius**:
  - `card`: 24px (rounded-3xl)
  - `image`: 16px (rounded-2xl)
  - `input`: 12px
- **Effects**:
  - **Liquid Glass**: `backdrop-blur-xl`, `bg-white/5` or `bg-black/5`.
  - **Aurora**: Animated gradients using `aurora-1`, `aurora-2`, `aurora-3` keyframes.

## 🧭 Principles
1. **Liquid Transparency**: Prefer glass effects and transparent backgrounds for sections (like ManifestoSection).
2. **High-Contrast Dark Mode**: Use deep midnight surfaces (`oklch(25.33% 0.016 252.42)`) with vibrant accent colors.
3. **Motion First**: Every entry should be staggered. Use `framer-motion` for parallax and scroll-linked effects.
