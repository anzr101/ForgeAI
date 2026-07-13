# 03 — `src/lib/schedule.ts` — the simulation engine

This file turns a static config into *time-varying* numbers: the learning-rate curve, the loss
curve, gradient norms, and eval loss. It is what makes the dashboard feel alive — and because it
is **seeded**, the same config always produces the same run.

---

## `makeRng(seed)` — a deterministic PRNG (mulberry32)

```ts
export function makeRng(seed: number): () => number {
  let a = seed >>> 0                       // force to unsigned 32-bit int
  return () => {
    a |= 0                                 // keep a as a 32-bit int
    a = (a + 0x6d2b79f5) | 0               // advance internal state by a fixed odd constant
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296   // → float in [0,1)
  }
}
```
▸ **Why not `Math.random()`?** `Math.random()` can't be seeded, so runs wouldn't be reproducible
and the Compare screen would be meaningless. mulberry32 is a tiny, well-distributed seedable PRNG.
▸ `seed >>> 0` — coerces the seed to an unsigned 32-bit integer (the algorithm works on uint32).
▸ The body is the standard mulberry32 bit-mixing: add a magic constant, XOR-shift, multiply
(`Math.imul` = true 32-bit multiply), mix again.
▸ Final line normalizes the uint32 to `[0,1)` by dividing by 2³². The returned closure is a
generator — call it repeatedly for a reproducible stream.
▸ **Data-flow note:** the store creates one `rng` per run in `start()` and threads it through
every `stepLoss`/`gradNorm`/`evalLoss` call, so the *sequence* of draws is fixed by the seed.

---

## `gauss(rng)` — normal noise via Box–Muller

```ts
export function gauss(rng) {
  let u = 0, v = 0
  while (u === 0) u = rng()                // avoid log(0)
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
```
▸ Converts two uniform draws into one standard-normal (mean 0, sd 1) sample — the Box–Muller
transform. Used to add realistic *bell-curved* jitter to loss and grad-norm rather than ugly
uniform noise. The `while` guards prevent `log(0) = -∞`.

---

## `lrAt(step, total, warmup, peak, scheduler)` — the LR schedule

```ts
export function lrAt(step, total, warmup, peak, scheduler) {
  if (step < warmup && warmup > 0) return peak * (step / warmup)     // linear warm-up
  const progress = total > warmup ? (step - warmup) / (total - warmup) : 1
  const p = Math.min(1, Math.max(0, progress))                       // clamp 0..1
  switch (scheduler) {
    case 'cosine':   return peak * 0.5 * (1 + Math.cos(Math.PI * p)) // peak → 0 on a cosine
    case 'linear':   return peak * (1 - p)                           // straight line to 0
    case 'constant': default: return peak                            // flat
  }
}
```
▸ Mirrors HuggingFace's `get_scheduler` behavior exactly, so the curve you see matches what real
training would do.
▸ **Warm-up:** for the first `warmup` steps the LR ramps linearly from 0 → `peak`. This is why the
LR line rises at the start.
▸ **Post-warmup `progress`** is renormalized to 0..1 over the *remaining* steps, then shaped by the
scheduler: cosine (smooth decay to 0), linear (straight decay), or constant.
▸ The tick loop calls this every step; the value shows as `learning_rate` in the logs and feeds
the loss model indirectly via `dyn`.

---

## `DATASET_DIFFICULTY` — a per-dataset knob

```ts
const DATASET_DIFFICULTY = { alpaca:0.0, dolly:0.02, oasst1:0.05, gsm8k:0.18, codealpaca:0.1,
                             ultrachat:0.06 }
```
▸ Hand-assigned "hardness." Math (GSM8K, 0.18) converges to a higher loss floor than simple
instruction data (Alpaca, 0.0). This makes dataset choice visibly matter.

---

## `deriveDynamics(model, datasetId, rows, lora, train)` — the behavioral fingerprint

This runs **once per run** (in `start()`), producing the `Dynamics` object every later call reads.

```ts
const diff     = DATASET_DIFFICULTY[datasetId] ?? 0.05
const billions = model.params / 1e9

const L0 = 2.35 - 0.08*Math.log(billions) + diff*1.4          // starting loss
```
▸ **L0 (initial loss):** bigger models start lower (`-0.08·ln(params)`); harder datasets start
higher (`+diff·1.4`). Base ≈ 2.35 nats.

```ts
const capacity      = trainableParams(model, lora) / model.params   // ~0.001–0.02
const capacityScore = Math.min(0.18, capacity * 12)
const lrScore = 1 - Math.min(1, Math.abs(Math.log(train.learningRate / 2e-4)) / 2.2)
const Lmin = Math.max(0.35, L0 * (0.62 - capacityScore - 0.12*lrScore + diff*0.5))
```
▸ **capacityScore** — more trainable params (bigger `r`, more targets) → more capacity → lower
achievable floor. Capped at 0.18 so it can't dominate.
▸ **lrScore** — a "goodness of learning rate" in [0,1] that **peaks at 2e-4** (the LoRA sweet
spot). It's `1 − |ln(lr / 2e-4)| / 2.2`, so both too-low and too-high LRs score worse.
▸ **Lmin (loss floor):** the value the loss asymptotes to. Lower with more capacity and a good LR;
higher for hard datasets. Floored at 0.35 so it never hits an unrealistic zero.

```ts
const k = (2.4 + train.epochs*0.9) * (0.6 + 0.6*lrScore)        // decay speed
```
▸ **k (decay rate):** how fast loss falls toward `Lmin`. More epochs and a better LR → faster
convergence → a steeper early curve.

```ts
const overfit = Math.max(0, train.epochs - 1) * (20000 / Math.max(rows,1500)) * 0.02
const evalGap = 0.04 + Math.min(0.35, overfit)
```
▸ **evalGap (overfitting):** grows when you train a **small** dataset for **many epochs**. It's
the gap by which eval loss drifts above train loss late in the run. `20000/rows` makes small
datasets overfit faster.

```ts
const instability = train.learningRate > 4e-4
  ? Math.min(0.4, (train.learningRate - 4e-4)*1200) : 0.015
```
▸ **instability:** the per-step probability of a loss *spike*. Basically zero for sane LRs, but
climbs once LR exceeds 4e-4 — crank the LR and you'll see the loss curve get jagged, exactly like
real divergence.

```ts
return { L0, Lmin, k, noise: 0.035 + diff*0.12, evalGap, gradNorm0: 0.9 + diff*0.8, instability }
```
▸ Packages the fingerprint: floor, ceiling, decay speed, noise amplitude, overfit gap, starting
grad-norm, and spike chance. **This object is the run's DNA.**

---

## `smoothLoss(dyn, progress)` — the ideal (noiseless) curve

```ts
export const smoothLoss = (dyn, progress) =>
  dyn.Lmin + (dyn.L0 - dyn.Lmin) * Math.exp(-dyn.k * progress)
```
▸ Exponential decay from `L0` (at progress 0) toward `Lmin` (at progress 1), at rate `k`. This is
the clean skeleton; the next function adds realism on top.

---

## `stepLoss(dyn, step, total, rng)` — the noisy per-step loss

```ts
export function stepLoss(dyn, step, total, rng) {
  const p = step / total
  const base  = smoothLoss(dyn, p)
  const noise = gauss(rng) * dyn.noise * (0.45 + 0.55*(1 - p))     // more jitter early
  const spike = rng() < dyn.instability ? rng() * dyn.noise * 6 : 0 // rare upward spike
  return Math.max(0.05, base + noise + spike)
}
```
▸ Takes the smooth value and adds two things: **Gaussian noise** whose amplitude *shrinks* as
training progresses (`0.45 + 0.55·(1−p)` — noisy early, calmer late, just like real loss), and a
**spike** that fires with probability `instability`.
▸ `Math.max(0.05, …)` clamps to keep loss positive.
▸ Draws from `rng` — so the exact wiggle is reproducible for a given seed.

---

## `stepGradNorm(dyn, progress, rng)` and `evalLossAt(dyn, progress, rng)`

```ts
export const stepGradNorm = (dyn, progress, rng) => Math.max(0.02,
  dyn.gradNorm0 * (0.35 + 0.65*Math.exp(-2.2*progress)) + gauss(rng)*0.06)

export const evalLossAt = (dyn, progress, rng) => Math.max(0.1,
  smoothLoss(dyn, progress) * (1 + dyn.evalGap*progress) + gauss(rng)*0.02)
```
▸ **gradNorm** decays from `gradNorm0` toward ~35% of it (gradients shrink as the model settles),
plus light noise.
▸ **evalLoss** = the smooth train loss *inflated* by `evalGap·progress` — i.e. eval tracks train
early but diverges upward late when overfitting. `perplexity` (shown elsewhere) is just
`exp(evalLoss)`.

---

**Takeaway:** `deriveDynamics` compresses the whole config into 7 numbers; `stepLoss`/`gradNorm`/
`evalLoss` expand those back into a believable, reproducible time series. Next: how this config
becomes *real Python* — [`04-lib-codegen.md`](04-lib-codegen.md).
