# 08 — Reusable UI (`components/ui/*`, `icons`, `AdapterVisualizer`, `LogConsole`, `layout/*`)

Layer 2: the building blocks every screen composes. Most are thin, prop-driven, and stateless.

---

## `src/components/ui/primitives.tsx` — the design-system kit

Defines an `Accent` union (`cyan|magenta|lime|amber|rose`) and `ACCENT_HEX` map so any component
can be themed by passing `accent="magenta"`. `accentHex(a)` exposes the hex for inline styles.

- **`Panel({children, glow, className})`** — the frosted-glass card (`.glass` class). If `glow` is
  set, an inline `boxShadow` adds a colored halo. The base container of almost every section.
- **`SectionTitle({eyebrow, title, desc})`** — the neon eyebrow + heading + description block atop
  each screen.
- **`Stat({label, value, sub, accent})`** — the big neon metric card. `value` is rendered in a
  colored, glowing, monospace font. Used everywhere numbers are headlined (Train metric cards,
  LoRA estimates, Evaluate results).
- **`NeonButton({accent, variant, size, onClick})`** — the primary button. `variant='solid'` fills
  with an accent gradient + glow; `variant='ghost'` is an outlined tint. Wrapped in
  `<motion.button>` for hover-scale/tap-shrink. Disabled state dims and drops the glow.
- **`Chip({active, accent, onClick})`** — a pill/tag. When `active`, it lights up in the accent
  color. Used for LoRA target toggles, presets, dataset format badges.
- **`Segmented<T>({value, options, onChange, accent})`** — a segmented control (radio-as-buttons).
  The selected option gets an accent background. This is the workhorse input on the LoRA screen
  (quantization, scheduler, learning rate, batch size, etc.) and the Train speed selector. Generic
  over the value type `T` so it stays type-safe for string unions.
- **`Toggle({checked, onChange, accent})`** — an animated switch; the knob springs left/right via
  `<motion.span layout>`.
- **`Slider({value, min, max, step, onChange, format})`** — a styled range input with a live
  formatted value label above it (rank, alpha, dropout, epochs, warmup).
- **`Field({label, hint, children})`** — a labeled wrapper that puts a `label` (and optional right
  `hint`) above any control. Keeps the LoRA form visually consistent.

▸ **Pattern:** these are *controlled* components — they receive `value` + `onChange` and own no
state. State lives in the store; primitives just render it and report user intent back up.

---

## `src/components/ui/Background.tsx`

▸ A `position:fixed`, `-z-10` layer behind everything. Stacks: a `radial-fade` color wash, the
`cyber-grid` (CSS gridlines), two blurred drifting neon "orbs," and a vignette. Pure CSS/DOM, no
props — it just sets the cyberpunk mood.

---

## `src/components/icons.tsx`

▸ A hand-rolled inline-SVG icon set (`IconCpu`, `IconDatabase`, `IconLayers`, `IconPlay`,
`IconPause`, `IconGauge`, `IconRocket`, `IconCode`, `IconFlame`, …). A shared `base()` helper sets
common attributes (24×24 viewBox, `stroke="currentColor"`, round caps) so icons inherit text color
and size via props. No icon dependency = smaller bundle and consistent styling.

---

## `src/components/AdapterVisualizer.tsx` — the transformer diagram

```tsx
const dims = moduleDims(model)                          // real per-module shapes
const isActive = t => lora.targets.includes(t)          // is this module adapted?
```
▸ Renders a single **decoder block** (labeled `× N layers`) split into Self-Attention
(`q/k/v/o_proj`) and MLP (`gate/up/down_proj`) rows. Each `ModuleNode` shows the module's real
`in×out` dims (from `moduleDims`) and, **if it's a selected LoRA target**, a pulsing `+LoRA r=…`
badge. An animated gradient bar sweeps left→right to imply data flow.
▸ Below, three cards summarize: frozen base params, number of injected adapters
(`targets × layers`), and rank/alpha with the effective scale `alpha/r`.
▸ This is a *view of the LoRA config* — toggle a target on the LoRA screen and the corresponding
node lights up here. It ties the abstract config to the actual architecture.

---

## `src/components/LogConsole.tsx` — the streaming terminal

```tsx
const ref = useRef(null)
useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
```
▸ A fake terminal (traffic-light header + mono body). The `useEffect` **auto-scrolls to the
bottom** whenever `logs` changes, so new lines are always visible — the key "live tail" behavior.
▸ `KIND_STYLE`/`KIND_PREFIX` maps each log `kind` (system/metric/eval/save/success/warn) to a
color and a leading glyph. Each line has a CSS `log-line` slide-in animation and a stable `key={id}`
(from the store's `logId`). Renders `store.logs` directly.

---

## `src/components/layout/Shell.tsx` — the app frame

▸ The two-part chrome shown once you enter the lab:
- **Left sidebar:** the Forge logo (clicking calls `onHome` → back to Landing) and the **stepper**
  built by mapping a `STEPS` array (`{id, label, icon, group}`) → nav buttons. The active step is
  highlighted; clicking one calls `setStep`. Grouped under Configure / Run / Analyze / Ship. A
  footer shows the live `status` dot and run count.
- **Top bar:** the current model chip, the run-name chip (when a run exists), and a GitHub link.
- **Content:** wraps `{children}` in a `<motion.div key={step}>` so **switching steps cross-fades**
  the screen. This is where the current screen component renders.

## `src/components/layout/StepNav.tsx`

▸ The Back/Continue footer used by the config screens. Takes `back`/`next` step ids (and optional
`onNext` side-effect). Clicking Continue runs `onNext?.()` then `setStep(next)`. Keeps navigation
consistent without each screen re-implementing it.

---

**Takeaway:** Layer 2 is almost pure presentation — controlled inputs and views. The intelligence
stays in the store/lib. Next, how screens assemble these into the 9 workflow steps —
[`09-screens.md`](09-screens.md).
