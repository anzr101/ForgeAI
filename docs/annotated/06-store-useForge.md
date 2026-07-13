# 06 — `src/store/useForge.ts` — the store & the tick loop

The single source of truth and the simulation driver. Everything the UI shows lives here;
everything that *changes over time* is pushed here by `tick()`. Read this slowly — it's the heart.

---

## Imports & constants

```ts
import { create } from 'zustand'
… types, getModel, getDataset, lora math, schedule math …

const RUN_COLORS = ['#22d3ee','#e879f9','#a3e635','#fbbf24','#fb7185','#818cf8']
const TICKS = 56          // a run is ALWAYS rendered as 56 points, regardless of real step count
```
▸ `RUN_COLORS` — assigned round-robin to completed runs so each is distinguishable in the Compare
overlay.
▸ **`TICKS = 56`** — the master resolution knob. A run with 3,000 optimizer steps and one with
50,000 both produce 56 chart points and finish in the same wall-clock time. This decouples "how
big the run claims to be" from "how long the animation takes."

---

## Module-level (non-React) variables — the pattern to understand

```ts
let timer = null            // setInterval handle
let rng = makeRng(42)       // the seeded PRNG for the current run
let dyn                     // the Dynamics fingerprint for the current run
let tickCount = 0           // how many ticks have fired
let logId = 0               // monotonic id for log lines (React keys)
let evalEvery = 6           // emit an eval every N ticks
let saveEvery = 12          // save a checkpoint every N ticks
let adapterMB = 0           // precomputed adapter size for checkpoints
let startedAt = 0
```
▸ **Why outside the store?** These must persist across React re-renders but must **not** trigger
re-renders when they change. The `setInterval` handle, the RNG stream position, and per-run
counters are implementation detail, not view state. Keeping them as module-level `let`s (a
singleton, since the store is a singleton) is the idiomatic way to hold "instance" data alongside
a Zustand store.

---

## Defaults

```ts
const defaultLora = { r:16, alpha:32, dropout:0.05,
  targets:['q_proj','k_proj','v_proj','o_proj','gate_proj','up_proj','down_proj'] }
const defaultTrain = { learningRate:2e-4, epochs:1, batchSize:4, gradAccum:4, maxSeqLen:1024,
  warmupRatio:0.03, scheduler:'cosine', quant:'4bit', loggingSteps:10, evalSteps:50,
  saveSteps:100, wandb:true, seed:42 }
```
▸ Sensible QLoRA starting point: rank-16 adapters on all 7 linear modules, 4-bit base, lr 2e-4,
cosine schedule — the "known-good" recipe, so a first-time user gets a healthy-looking run.

---

## Helpers: `makeRunName`, `clearTimer`

```ts
function makeRunName(modelId, datasetId, r) {
  const tag = Math.random().toString(36).slice(2, 6)         // 4-char random suffix
  return `${modelId}-${datasetId}-r${r}-${tag}`               // e.g. llama-3.2-3b-alpaca-r16-ab12
}
function clearTimer() { if (timer) { clearInterval(timer); timer = null } }
```
▸ `makeRunName` builds a unique, human-readable run id (used as the `RunSummary.id`, so the `tag`
prevents collisions between two runs of the same config).
▸ `clearTimer` — the single place that stops the heartbeat; called by pause/stop/finalize/reset.

---

## The store factory & `pushLog`

```ts
export const useForge = create((set, get) => {
  const pushLog = (kind, text) =>
    set(s => ({ logs: [...s.logs.slice(-180), { id: logId++, kind, text }] }))
```
▸ `create((set,get)=>({...}))` — Zustand's factory. `set` merges partial state (and notifies
subscribers); `get` reads current state.
▸ `pushLog` appends a log line and **caps the array at 180** (`slice(-180)`) so a long run doesn't
grow unbounded. `logId++` gives each line a stable React key. `kind` selects the color in
`LogConsole`.

---

## `finalize()` — snapshot a finished run

```ts
const finalize = () => {
  clearTimer()
  const s = get()
  const last = s.metrics[s.metrics.length - 1]
  const finalEval = evalLossAt(dyn, 1, makeRng(s.train.seed + 999))   // eval at progress = 1
  const finalLoss = last?.loss ?? dyn.Lmin
  const finalPpl = Math.exp(finalEval)
  pushLog('success', `Training complete · final loss … · eval …`)
  pushLog('save', `Adapter saved → outputs/${s.runName} (… MB)`)

  const summary: RunSummary = { id:s.runName, name:s.runName, modelId, datasetId,
    lora, train, totalSteps:s.total, trainableParams:trainableParams(model,s.lora),
    totalParams:model.params, vramGB:estimateVram(...).total, finalLoss, finalEval, finalPpl,
    checkpoints:s.checkpoints, color:RUN_COLORS[s.runs.length % 6], createdAt:Date.now(),
    durationSec:s.simElapsed }

  set(st => {
    const runs = [...st.runs.filter(r => r.id !== summary.id), summary]
    const priorValid = st.compareA && st.compareA !== summary.id && runs.some(r=>r.id===st.compareA)
    const compareA = priorValid ? st.compareA : (runs.length>1 ? runs[runs.length-2].id : null)
    return { status:'completed', runs, compareA, compareB: summary.id }
  })
}
```
▸ Stops the timer, then builds an **immutable `RunSummary`** that *copies* the config (so later
edits don't mutate history) plus the final metrics. `finalEval` uses a fresh RNG seeded at
`seed+999` so the final eval number is deterministic but independent of the tick stream.
▸ `color` cycles through `RUN_COLORS` by `runs.length`.
▸ The `set` de-dupes by `id` (replace if re-run), then chooses compare slots: **B** = the new run,
**A** = a *different* prior run (or `null` if this is the first). This is the fix that prevents the
Compare screen from plotting a run against itself.

---

## `tick()` — one simulated step (the heartbeat)

```ts
const tick = () => {
  const s = get()
  if (s.status !== 'running') return                 // guard: no-op if paused/finished
  tickCount += 1
  const stepsPerTick = s.total / TICKS                // how many "real" steps this tick represents
  const step = Math.min(s.total, Math.round(tickCount * stepsPerTick))
  const p = step / s.total
  const model = getModel(s.modelId)
  const { secPerStep, tokensPerSec } = throughput(model, s.train)

  const lr = lrAt(step, s.total, Math.round(s.total*s.train.warmupRatio),
                  s.train.learningRate, s.train.scheduler)
  const loss = stepLoss(dyn, step, s.total, rng)
  const gradNorm = stepGradNorm(dyn, p, rng)
  const point = { step, loss, lr, gradNorm }

  let doEval = tickCount % evalEvery === 0
  if (doEval) point.evalLoss = evalLossAt(dyn, p, rng)
  const doSave = tickCount % saveEvery === 0 && step < s.total
```
▸ **Guard** — if the user paused, the interval may still fire once; the early return makes it safe.
▸ `stepsPerTick`/`step` — convert tick number → simulated global step. `p` is progress 0..1.
▸ Pulls `lr`, `loss`, `gradNorm` from the math layer (note: `loss` and `gradNorm` consume the
shared `rng`, advancing its deterministic stream).
▸ Eval/checkpoint events fire on tick multiples (`evalEvery`/`saveEvery`), which were computed in
`start()` from the user's `evalSteps`/`saveSteps`.

```ts
  const epoch = (p * s.train.epochs).toFixed(2)
  pushLog('metric', `{'loss': …, 'grad_norm': …, 'learning_rate': …, 'epoch': ${epoch}}`)
  if (doEval) pushLog('eval', `[eval] step … · eval_loss … · perplexity …`)

  set(st => {
    const metrics = [...st.metrics, point]                                    // append chart point
    const gpuUtil = doSave||doEval ? 42+rng()*18 : 88+rng()*11                 // dip during eval/save
    const vram = estimateVram(model, st.lora, st.train).total
    const gpuMem = vram * (0.96 + rng()*0.05)
    const tokPerSec = tokensPerSec * (0.9 + rng()*0.16)
    const simElapsed = st.simElapsed + secPerStep * stepsPerTick               // simulated wall-clock
    let checkpoints = st.checkpoints
    if (doSave) checkpoints = [...st.checkpoints, { id:`checkpoint-${step}`, step, loss,
      evalLoss:…, perplexity:exp(evalLoss), adapterMB, createdAt:Date.now() }]
    return { currentStep:step, metrics, gpuUtil, gpuMem, tokPerSec, simElapsed, checkpoints }
  })

  if (doSave) pushLog('save', `Saving checkpoint → checkpoint-${step}`)
  if (step >= s.total) finalize()
}
```
▸ Emits an **HF-Trainer-style log dict** each tick (`{'loss':…, 'grad_norm':…, …}`) — this is why
the console reads like a real training run.
▸ The `set` is the frame the UI renders: it appends the metric point, jitters the GPU meters
(util **dips** to 40–60% during eval/checkpoint, else 88–99%), nudges VRAM and throughput, and
accrues `simElapsed`. A checkpoint is appended on save ticks.
▸ When `step >= total`, `finalize()` closes the run.
▸ **Every value the dashboard animates originates in this one `set`.**

---

## The returned state object + actions

Initial state (config defaults, `status:'idle'`, empty run arrays) then the actions:

```ts
setStep, setModel, setDataset, setLora(patch), setTrain(patch), setCompare(which,id)
```
▸ Plain setters. `setLora`/`setTrain` take a **partial** and spread-merge it, so a slider can
update one field (`setTrain({ learningRate: 3e-4 })`) without touching the rest.

```ts
setSimSpeed: (speed) => { set({simSpeed:speed}); if (running) { clearTimer();
  timer = setInterval(tick, 640/speed) } }
```
▸ Changing speed **re-creates the interval** at a new period (`640/speed` ms) so it takes effect
immediately mid-run. Data density is unchanged (still 56 ticks) — only the delay between ticks.

```ts
start: () => { … resolve model/dataset … total = totalSteps(...) … runName = makeRunName(...) …
  rng = makeRng(seed); dyn = deriveDynamics(...); tickCount=0; adapterMB=tp*2/1e6;
  evalEvery = max(2, round(evalSteps/total*TICKS)); saveEvery = max(3, round(saveSteps/total*TICKS));
  logId=0; set({status:'running', step:'train', total, runName, metrics:[], logs:[], checkpoints:[]});
  pushLog×6 (loading shards, tokenizer, trainable %, "Starting training for N steps");
  clearTimer(); timer = setInterval(tick, 640/simSpeed) }
```
▸ The **setup ritual** (traced in DATA_FLOW Phase 2): seed the RNG, derive dynamics, translate the
user's `evalSteps`/`saveSteps` into *tick* cadences, reset run state, jump to the Train screen,
print the fake preamble logs, and start the heartbeat.

```ts
pause:  () => { clearTimer(); set({status:'paused'}); pushLog('warn','…paused…') }
resume: () => { set({status:'running'}); clearTimer(); timer=setInterval(tick,640/simSpeed) }
stop:   () => { pushLog('warn','…stopped early…'); finalize() }     // finalize with partial run
resetRun: () => { clearTimer(); tickCount=0; set({status:'idle', metrics:[], logs:[], …}) }
```
▸ **pause** stops the timer but keeps state; **resume** restarts it (the guard in `tick` plus the
preserved `tickCount` make this seamless); **stop** finalizes early (you still get a saved run from
the partial curve); **resetRun** wipes the live run back to idle without touching `runs[]` history.

---

**Takeaway:** `useForge` = config + live-run state + `runs[]` history, driven by a `setInterval`
that reads the math layer and writes 56 frames of data. Every screen is just a *view* of this.
Next, how those frames become pixels: [`07-charts.md`](07-charts.md).
