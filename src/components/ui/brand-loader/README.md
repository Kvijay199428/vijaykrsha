# BrandLoader

A self-contained, animated brand/loading indicator. Installs directly into
your `src/components/ui/` folder like any other UI component — no build
step, no required dependencies beyond React.

## Install

Copy this folder to:

```
src/components/ui/brand-loader/
```

So you end up with:

```
src/components/ui/brand-loader/
├── BrandLoader.tsx
├── animations.css
├── brand-loader.css
├── fonts.ts
├── types.ts
└── index.ts
```

## Add your font (optional)

Drop a `.woff2` file at:

```
public/.font/YourFontName.woff2
```

If you skip this, `BrandLoader` just inherits the surrounding font.

## Use

```tsx
import { BrandLoader } from "@/components/ui/brand-loader";

export default function Loading() {
  return <BrandLoader brand="VEGA" font="Orbitron" animation="scan" />;
}
```

### Props

| Prop         | Type                                                                 | Default   |
|--------------|-----------------------------------------------------------------------|-----------|
| `brand`      | `string` (required)                                                    | —         |
| `font`       | `string \| { name; weight?; src? }`                                    | inherited |
| `animation`  | one of 162 presets below, or `"custom"`                                | `"fade"`  |
| `size`       | `"sm" \| "md" \| "lg" \| "xl"`                                          | `"md"`    |
| `speed`      | `"slow" \| "normal" \| "fast"`                                         | `"normal"`|
| `fullscreen` | `boolean`                                                              | `false`   |
| `className`  | `string`                                                               | —         |
| `style`      | `BrandLoaderCSSProperties` (typed `React.CSSProperties` + CSS vars)   | —         |
| `ariaLabel`  | `string`                                                               | `Loading {brand}` |

### Animation presets (162 + `custom`)

**Original set (12)** — `fade` · `pulse` · `scan` · `glitch` · `typing` · `reveal` · `shimmer` · `bounce` · `flicker` · `wave` · `blur` · `neon`

**Motion / entrance (10)** — `slide-up` · `slide-down` · `slide-left` · `slide-right` · `zoom-in` · `zoom-out` · `rotate-in` · `roll-in` · `drop` · `rise`

**3D / perspective (4)** — `flip-x` · `flip-y` · `letter-spin` · `perspective-tilt`

**Playful / squash (15)** — `elastic` · `swing` · `rubber` · `jelly` · `heartbeat` · `wobble` · `shake-x` · `shake-y` · `tilt` · `squeeze` · `stretch` · `skew` · `skew-bounce` · `mirror` · `warp`

**Rotation / strobe (4)** — `spin-slow` · `spin-fast` · `flash` · `strobe`

**Sweep / reveal (7)** — `underline-sweep` · `gradient-shift` · `rainbow` · `peekaboo` · `curtain` · `iris` · `wipe-diagonal`

**Ambient / idle (4)** — `levitate` · `drift` · `sway` · `tracking-pulse`

**Texture / glitch family (2)** — `static-noise` · `chromatic`

**Per-letter sequenced (4)** — `typewriter` · `cascade` · `letter-fade` · `letter-pop`

**Directional bounce-in (5)** — `bounce-in` · `bounce-in-up` · `bounce-in-down` · `bounce-in-left` · `bounce-in-right`

**Directional fade (5)** — `fade-in-up` · `fade-in-down` · `fade-in-left` · `fade-in-right` · `fade-out-pulse`

**Directional flip (4)** — `flip-in-x` · `flip-in-y` · `flip-out-x` · `flip-out-y`

**Directional zoom (4)** — `zoom-in-up` · `zoom-in-down` · `zoom-in-left` · `zoom-in-right`

**Rotation family (3)** — `rotate-cw` · `rotate-ccw` · `rotate-in-corner`

**Light speed / jello / blink (4)** — `light-speed-in` · `light-speed-out` · `jello` · `blink`

**Liquid / organic (8)** — `liquid-wave` · `morph` · `blob` · `ripple` · `melt` · `drip` · `ooze` · `breathe`

**Retro / CRT / cyberpunk (10)** — `crt-flicker` · `vhs-glitch` · `scanlines` · `hologram` · `cyberpunk-glow` · `terminal-blink` · `pixelate` · `static-tv` · `tracking-error` · `neon-sign-flicker`

**Glass / material (6)** — `glass-shine` · `frosted` · `glossy-sheen` · `mica` · `aurora` · `prism`

**Paper / origami (5)** — `fold-in` · `unfold` · `paper-flip` · `crease` · `ribbon-wave`

**Nature-inspired (6)** — `flame-flicker` · `water-ripple` · `wind-sway` · `ember-glow` · `smoke-rise` · `cloud-drift`

**Celestial / orbit (6)** — `comet` · `shooting-star` · `orbit` · `pendulum` · `metronome` · `seesaw`

**Sequential mechanisms (8)** — `accordion` · `zipper` · `domino` · `ripple-wave` · `pop-in` · `pop-out` · `snap-in` · `magnet-pulse`

**Spin / spiral (5)** — `vortex` · `spiral-in` · `spiral-out` · `tornado` · `earthquake`

**Glitch family expansion (7)** — `glitch-rgb` · `glitch-slice` · `datamosh` · `binary-flicker` · `matrix-rain` · `code-scroll` · `dot-trail`

**Sweep / radar (2)** — `progress-sweep` · `radar-sweep`

**Mouse / pointer-interactive (12)** — `cursor-follow` · `magnetic-pull` · `tilt-3d` · `spotlight-cursor` · `cursor-glow` · `parallax-cursor` · `repel-letters` · `attract-letters` · `ripple-click` · `hover-scale` · `hover-glitch` · `hover-underline`

> **Per-letter presets** render each character as its own `.brand-loader__letter` span, handled automatically — no extra props needed: `wave`, `letter-spin`, `typewriter`, `cascade`, `letter-fade`, `letter-pop`, `zipper`, `domino`, `matrix-rain`, `repel-letters`, `attract-letters`. Everything else renders `brand` as plain text.

### Mouse / pointer-interactive presets

These 12 respond to the cursor and need no setup beyond picking the preset — `BrandLoader.tsx` attaches the necessary listeners only when one of these is selected, so there's zero overhead for every other preset.

- **Cursor-tracking (6)** — `cursor-follow`, `magnetic-pull`, `tilt-3d`, `spotlight-cursor`, `cursor-glow`, `parallax-cursor`. On `mousemove`, the component writes the pointer position to `--mx`/`--my` (0–100%) and `--mx-c`/`--my-c` (-1..1) on the loader element; the CSS for each preset reads those. Resets to centered on `mouseleave`.
- **Letter-magnetism (2)** — `repel-letters` pushes nearby letters away from the cursor; `attract-letters` pulls them gently toward it. Computed per-letter from real bounding-box distance (70px radius), applied as inline transforms, with a spring-back CSS transition on `mouseleave`.
- **Click (1)** — `ripple-click` spawns an expanding ripple `<span>` at the click point (React state, self-removes via `onAnimationEnd`).
- **Pure CSS `:hover` (3)** — `hover-scale`, `hover-glitch`, `hover-underline` need no JavaScript at all; they only animate while the cursor is over the loader.

```tsx
<BrandLoader brand="VEGA" animation="tilt-3d" />
<BrandLoader brand="VEGA" animation="repel-letters" />
<BrandLoader brand="VEGA" animation="ripple-click" />
```

### Weighted / custom fonts

```tsx
<BrandLoader brand="VEGA" font={{ name: "Orbitron", weight: 700 }} />
// -> /.font/Orbitron/700.woff2

<BrandLoader brand="VEGA" font={{ name: "MyBrand", src: "/assets/MyBrand.woff2" }} />
```

### Custom animation

```tsx
<BrandLoader brand="VEGA" animation="custom" className="vega-loader" />
```

```css
.vega-loader .brand-loader__text {
  animation: vega-entry 1.5s cubic-bezier(0.16, 1, 0.3, 1) infinite alternate;
}
@keyframes vega-entry {
  from { opacity: 0; transform: translateY(20px) scale(0.9); filter: blur(10px); }
  to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
```

### CSS variable overrides

`style` is typed to accept the component's own CSS custom properties directly — no `as React.CSSProperties` cast needed:

```tsx
<BrandLoader
  brand="VEGA"
  animation="scan"
  style={{ "--brand-loader-duration": "4s", "--brand-loader-color": "#d4af37" }}
/>
```

Notes:
- Respects `prefers-reduced-motion` automatically.
- Accessible by default (`role="status"`, screen-reader text, `aria-label`).
- No Tailwind or UI-library dependency — plain CSS + CSS variables
  (`--brand-loader-duration`, `--brand-loader-color`) for easy overrides.
