# Data Flow — one training run, traced end to end

This document follows a single user journey and names the exact function/variable at each hop.
Read it with the code open; it is the "call graph" in prose.

## Phase 0 — App boot

```
index.html loads /src/main.tsx
  main.tsx  ->  ReactDOM.createRoot(#root).render(<App/>)
  App.tsx   ->  launched=false  ->  renders <Landing onLaunch={()=>setLaunched(true)}/>
```

`useForge` (the Zustand store) is created once, lazily, the first time any component calls it.
Its initial state: `step:'model'`, `modelId:'llama-3.2-3b'`, `datasetId:'alpaca'`, default
`lora` and `train` configs, `status:'idle'`, empty `metrics/logs/runs`.

## Phase 1 — Entering the lab & choosing config

```
Landing "Launch Lab"  ->  setLaunched(true)  ->  App renders <Shell><ModelStep/></Shell>
```

- **ModelStep** reads `modelId` from the store and lists `MODELS` (from `data/models.ts`).
  Clicking a card calls `setModel(id)` → store updates `modelId` → the whole app re-renders with
  the new model. The stat cards at the bottom read `getModel(modelId)` for live dims.
- **DatasetStep** works identically with `datasetId` / `DATASETS`.
- **LoraStep** is where math becomes visible. On *every* render it recomputes, from the current
  config, using `src/lib/lora.ts`:

  ```
  tp     = trainableParams(model, lora)        // Σ r·(in+out) over targets × layers
  vram   = estimateVram(model, lora, train)    // {base,optimizer,gradients,activations,...}
  steps  = totalSteps(dataset.rows, train)      // rows·epochs / (batch·gradAccum)
  {secPerStep, tokensPerSec} = throughput(model, train)
  fits   = gpuFit(vram.total)                   // per-GPU fits + utilization
  ```

  These flow straight into `<Stat>`, `<StackBar>`, and the GPU-fit bars. **No store writes** —
  it's pure derive-on-render. Moving a slider calls `setLora`/`setTrain`, the store changes, the
  component re-renders, the math re-runs. That's the whole "live estimate" magic.

## Phase 2 — Clicking "Start training run"

`LoraStep` (or `TrainStep`'s idle state) calls `start()` in the store. `start()` does, in order:

```
1. model   = getModel(modelId)                     // resolve config → data
2. dataset = getDataset(datasetId)
3. total   = totalSteps(dataset.rows, train)        // how many optimizer steps
4. runName = makeRunName(...)                        // e.g. llama-3.2-3b-alpaca-r16-ab12
5. tp      = trainableParams(model, lora)

   // seed the (module-level, non-React) simulation variables:
6. rng     = makeRng(train.seed)                     // deterministic PRNG
7. dyn     = deriveDynamics(model, dataset.id, rows, lora, train)   // L0, Lmin, k, noise…
8. tickCount = 0;  adapterMB = tp*2/1e6
9. evalEvery / saveEvery = how many ticks between eval/checkpoint events

   // reset the React run-state and jump to the Train screen:
10. set({ status:'running', step:'train', total, runName, metrics:[], logs:[], checkpoints:[] })

   // emit the fake "loading" preamble logs (shards, tokenizer, trainable %…)
11. pushLog(...) × 6

   // START THE HEARTBEAT:
12. timer = setInterval(tick, 640 / simSpeed)
```

The key handoff: **config → `deriveDynamics()` → `dyn`.** `dyn` is a small object
(`{L0, Lmin, k, noise, evalGap, gradNorm0, instability}`) that encodes *how this specific run
will behave*. A high learning rate raises `instability`; a small dataset over many epochs raises
`evalGap` (overfitting); more LoRA capacity lowers `Lmin` (better floor). Everything downstream
reads `dyn`.

## Phase 3 — Each tick (fires ~every 640 ms)

`tick()` in `useForge.ts` is the simulation core. One tick = one logged training step.

```
tickCount += 1
stepsPerTick = total / 56                      // a run is always 56 points wide
step = round(tickCount * stepsPerTick)          // simulated global step
p    = step / total                             // progress 0..1

lr       = lrAt(step, total, warmupSteps, peakLr, scheduler)   // schedule.ts
loss     = stepLoss(dyn, step, total, rng)                     // schedule.ts (uses rng!)
gradNorm = stepGradNorm(dyn, p, rng)

point = { step, loss, lr, gradNorm }
if (tickCount % evalEvery === 0) point.evalLoss = evalLossAt(dyn, p, rng)

pushLog('metric', "{'loss':…, 'grad_norm':…, 'learning_rate':…, 'epoch':…}")   // HF-style
if (eval)  pushLog('eval',  "[eval] step … eval_loss … perplexity …")

set(st => ({
  currentStep: step,
  metrics: [...st.metrics, point],                 // ← the loss chart's data source
  gpuUtil: eval||save ? 40-60% : 88-99%,           // dips during eval/checkpoint
  gpuMem:  vram.total * (0.96..1.01),
  tokPerSec: tokensPerSec * (0.9..1.06),
  simElapsed: st.simElapsed + secPerStep*stepsPerTick,   // simulated wall-clock
  checkpoints: save ? [...st.checkpoints, ckpt] : st.checkpoints,
}))

if (step >= total) finalize()
```

Every `set(...)` notifies subscribed React components, which re-render:
- `TrainStep` re-reads `metrics` → `<MetricChart>` redraws the SVG polyline.
- `gpuUtil`/`gpuMem` → the two `<RadialGauge>`s animate to new values.
- `logs` → `<LogConsole>` appends a line and auto-scrolls.
- `currentStep`/`total` → the progress bar width animates.

**Why it looks alive:** the store mutates 56 times over ~36 seconds (at 1× speed), and
framer-motion tweens between each value, so discrete updates read as smooth motion.

## Phase 4 — Finalizing

When `step >= total`, `finalize()`:

```
clearTimer()                                   // stop the interval
finalEval = evalLossAt(dyn, 1, rng')            // eval at p=1
build RunSummary { config snapshot, finalLoss, finalEval, finalPpl=exp(eval),
                   trainableParams, vramGB, checkpoints, color, durationSec }
set({ status:'completed', runs:[...runs, summary], compareA, compareB })
```

The completed run is now immutable history in `runs[]`. The Train screen swaps its controls for
a "Run complete" banner (CTA → Evaluate).

## Phase 5 — Analysis screens (read-only consumers of `runs[]`)

- **EvaluateStep** reads `runs[runs.length-1]` (the latest run). It derives a heuristic
  `score` from `finalEval`, renders before/after benchmark bars, and shows a canned
  base-vs-fine-tuned generation using the dataset's sample. Checkpoints render as a table +
  `<Sparkline>`.
- **CompareStep** renders all `runs[]` in a table. The user assigns two to `compareA`/`compareB`
  (`setCompare`). The `<OverlayChart>` plots both runs' checkpoint-loss curves; a diff table
  highlights config differences. (The dedupe in `selected` prevents a run being drawn twice.)

## Phase 6 — Ship screens

- **QuantizeStep** takes `getModel(modelId).params` and a chosen method/bits, computes output
  size (`params * bpw/8`) and reduction, and asks `generateQuantizeScript(...)` for a real script.
- **DeployStep** is a pure UI simulation: a staged progress animation → a "live" endpoint with
  copyable cURL/Python snippets and a toy playground that echoes a dataset-flavored reply.
- **ExportStep** is the payoff. It bundles the current `{model, dataset, lora, train, runName}`
  into a `CodegenInput` and calls `generateTrainPy`, `generateRequirements`, `generateNotebook`,
  `generateQuantizeScript`. The output is **genuinely runnable** — this is the bridge from the
  simulation back to real hardware.

## The one-sentence version

> The user's **config** object is turned into a behavioral fingerprint (`dyn`) by real math;
> a **timer** walks that fingerprint 56 steps forward, writing numbers into a **Zustand store**;
> React **renders** those numbers as neon charts; and the same config is finally **compiled**
> into real Python you can run for real.
