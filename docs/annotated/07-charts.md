# 07 — `src/components/charts.tsx` — hand-drawn SVG charts

No chart library. Every visualization is raw SVG so the neon aesthetic is fully controllable.
All of these are **pure presentational** components — they take data props and draw; they hold no
state and never touch the store.

The universal trick: define a fixed `viewBox` coordinate space (e.g. `0 0 620 220`) and scale it
to the container with `width="100%"`. Map data → coordinates with two helper functions `x()` and
`y()`.

---

## `MetricChart({ points, height, showEval })` — the loss curve

```ts
const W=620, padL=40, padR=14, padT=14, padB=22       // viewBox width + inner padding
if (points.length < 2) return <placeholder "awaiting first optimizer step…">
```
▸ Needs ≥2 points to draw a line; before that it shows a mono placeholder.

```ts
const maxStep = points.at(-1).step
const all = [...losses, ...evalLosses]
let minV = min(all), maxV = max(all); const span = maxV-minV
minV -= span*0.12; maxV += span*0.12                  // 12% vertical breathing room

const x = s => padL + (s/maxStep) * (W-padL-padR)     // step  → x pixel
const y = v => padT + (1 - (v-minV)/(maxV-minV)) * (H-padT-padB)   // value → y pixel (inverted)
```
▸ The two mapping functions are the core of every SVG chart here. `y` is **inverted** (`1 - …`)
because SVG's y-axis grows downward but we want smaller loss = higher on screen.
▸ Auto-scaling to the data (min/max with padding) means the curve always fills the panel nicely
as loss shrinks.

```ts
const line = points.map(p => `${x(p.step)},${y(p.loss)}`).join(' ')      // polyline points
const area = `${padL},${H-padB} ${line} ${x(maxStep)},${H-padB}`          // closed area under line
```
▸ `line` is the train-loss polyline. `area` closes that path down to the baseline so it can be
filled with the cyan gradient (`<linearGradient id="lossArea">`).

▸ The render then draws: horizontal grid lines + value labels (`gridVals`), the gradient area, the
train polyline (cyan→magenta gradient stroke), a dashed lime **eval** polyline + dots (only if
`showEval` and eval points exist), and a **pulsing head dot** (`<motion.circle>` animating
`r` and `opacity`) at the latest point to signal "live." Endpoints are labeled `step 0` / `maxStep`.
▸ Data source: this receives `store.metrics` directly, so it redraws every tick.

---

## `RadialGauge({ value, label, sub, color, size })` — the ring meters

```ts
const r = size/2 - 8
const c = 2*Math.PI*r                                  // full circumference
const v = clamp(value, 0, 1)
```
▸ A ring gauge = a circle whose stroke is partially "erased" via `stroke-dasharray`/`dashoffset`.
`c` is the full circumference (the dash length).

```tsx
<svg className="-rotate-90">   {/* rotate so 0% starts at top, not right */}
  <circle … stroke="#141a29" />                        {/* track (background ring) */}
  <motion.circle … strokeDasharray={c}
     initial={{ strokeDashoffset: c }}                 // start fully "empty"
     animate={{ strokeDashoffset: c*(1-v) }}           // reveal v fraction of the ring
     transition={{ type:'spring' }} />
</svg>
<div absolute-centered>{label}{sub}</div>              {/* the % text in the middle */}
```
▸ `strokeDashoffset = c*(1-v)` reveals exactly `v` of the ring; animating it makes the gauge
*sweep* to its new value. The `initial={{ strokeDashoffset: c }}` (added as a fix) gives
framer-motion a defined starting value so it doesn't warn about animating from `undefined`.
▸ `-rotate-90` on the SVG moves the start point from 3 o'clock to 12 o'clock.
▸ Used twice on the Train screen for GPU **util** and **mem**.

---

## `GpuMeter({ util })` — the equalizer bars

```tsx
const bars = 28; const active = util/100
{Array.from({length:bars}).map((_,i) => {
  const base = 0.2 + Math.abs(Math.sin(i*0.7))*0.5           // fixed per-bar baseline shape
  return <motion.div animate={{ height: `${max(6, base*active*100*(0.6+Math.random()*0.7))}%` }}
                     transition={{ duration:0.34 }} /> })}
```
▸ 28 flex bars whose heights are re-randomized each render around a sine-shaped baseline, scaled by
`active` (current utilization). framer-motion tweens the height change (0.34 s) so it reads as a
pulsing audio-equalizer. Bars tint magenta when util is very high (>85%). Pure eye-candy driven by
the single `util` number.

---

## `StackBar({ segments, total, max })` — the VRAM breakdown

```tsx
<div class="track">
  {segments.map((s,i) => {
    const left = sum of previous segment values
    return <div style={{ left:`${left/max*100}%`, width:`${s.value/max*100}%`, background:s.color }} />
  })}
  <div class="marker" style={{ left:`${total/max*100}%` }} />   {/* total peak line */}
</div>
{legend of segments with colors + values}
```
▸ A horizontal stacked bar. Each segment is absolutely positioned by accumulating the widths of
prior segments (`left`) — so base, optimizer, gradients, activations, overhead stack left→right.
A rose marker shows the total peak. On the LoRA screen this visualizes `estimateVram()`'s
component breakdown, so you *see* what's eating VRAM.

---

## `Sparkline({ values, color, height })` — tiny inline trend

```ts
const pts = values.map((v,i) => `${i/(values.length-1)*W},${height - (v-min)/span*(height-4) - 2}`)
return <svg preserveAspectRatio="none"><polyline points={pts} /></svg>
```
▸ A minimal, axis-less polyline for small trend previews (e.g. checkpoint-loss trajectory on the
Evaluate screen). `preserveAspectRatio="none"` lets it stretch to any container width.

---

**Takeaway:** all charts share the "fixed viewBox + `x()`/`y()` mappers + `<polyline>`" recipe;
framer-motion adds life. They're dumb views of store data. Next: the rest of the UI —
[`08-components.md`](08-components.md).
