# Architecture

## 1. The core idea

Forge looks like a live GPU training dashboard, but there is **no GPU and no backend**. It is a
single-page React app that runs a **deterministic simulation** of a LoRA/QLoRA fine-tuning run.
The trick that makes it convincing: every number is derived from **real formulas** (parameter
counts, VRAM, learning-rate schedules, loss decay) rather than being faked.

```
            ┌──────────────────────────────────────────────────────────┐
            │                     THE BIG PICTURE                        │
            └──────────────────────────────────────────────────────────┘

   USER PICKS            PURE MATH (src/lib)            STATE (Zustand)        UI (React)
  ┌───────────┐        ┌────────────────────┐        ┌────────────────┐     ┌───────────┐
  │  model    │        │ lora.ts            │        │ useForge.ts    │     │ screens/  │
  │  dataset  │──────▶ │  trainableParams() │──────▶ │  config +      │────▶│ components│
  │  LoRA cfg │ config │  estimateVram()    │  facts │  run state +   │ read│  charts   │
  │  train cfg│        │ schedule.ts        │        │  tick() loop   │     │           │
  └───────────┘        │  lrAt(), stepLoss()│        └───────┬────────┘     └───────────┘
        ▲              └────────────────────┘                │  every 640ms          │
        │                                                    ▼                       │
        │              ┌────────────────────┐        ┌────────────────┐              │
        └───────────── │ codegen.ts         │◀───────│ metrics[], logs│◀─────────────┘
           "export"    │  generateTrainPy() │ config │ checkpoints[]  │   renders
                       └────────────────────┘        └────────────────┘
```

## 2. Layered design

The code is organized in strict dependency layers. **Lower layers never import higher layers.**

```
  Layer 4  ── src/App.tsx ──────────────── routing (landing vs lab) + screen switch
                    │
  Layer 3  ── src/screens/*.tsx ────────── one file per workflow step (Model…Export)
                    │
  Layer 2  ── src/components/*.tsx ──────── reusable UI (charts, primitives, visualizer)
                    │
  Layer 1b ── src/store/useForge.ts ────── single source of truth + the tick() loop
                    │
  Layer 1a ── src/lib/*.ts ─────────────── pure functions: the math + code generator
                    │
  Layer 0  ── src/data/*.ts, src/types.ts  static data (models, datasets) + type vocabulary
```

- **Layer 0 (data & types):** No logic. `types.ts` defines every shape; `data/models.ts`,
  `data/datasets.ts`, `data/gpus.ts` are hand-curated constants with *real* numbers.
- **Layer 1a (lib):** Pure, testable, framework-agnostic functions. If you deleted React,
  these would still run in Node. This is where the "physics" lives.
- **Layer 1b (store):** The only stateful, non-pure module. Wraps the lib functions in a
  Zustand store and drives them with a timer.
- **Layer 2–4 (UI):** React. Reads from the store, calls lib functions for display math,
  renders SVG/HTML. Contains almost no business logic.

## 3. Folder map

```
src/
├── types.ts                 # Every TypeScript interface/type used app-wide
├── main.tsx                 # ReactDOM entry point
├── App.tsx                  # Top-level: landing vs. lab, maps step -> screen component
├── index.css                # Tailwind layers + the cyberpunk design tokens
│
├── data/                    # LAYER 0 — static, real-world constants
│   ├── models.ts            #   5 models w/ true hidden/layers/heads dims
│   ├── datasets.ts          #   6 HF datasets w/ real row counts & samples
│   └── gpus.ts              #   Reference GPUs for the "will it fit?" check
│
├── lib/                     # LAYER 1a — pure functions
│   ├── lora.ts              #   trainableParams, estimateVram, throughput, gpuFit
│   ├── schedule.ts          #   makeRng, lrAt, deriveDynamics, stepLoss (the simulator)
│   ├── codegen.ts           #   generate train.py / requirements / notebook / quantize
│   ├── format.ts            #   number & string formatters (fmtParams, fmtBytes…)
│   └── io.ts                #   useCopy() hook + download() helper
│
├── store/
│   └── useForge.ts          # LAYER 1b — Zustand store + tick() simulation loop
│
├── components/              # LAYER 2 — reusable UI
│   ├── charts.tsx           #   MetricChart, RadialGauge, GpuMeter, StackBar, Sparkline
│   ├── icons.tsx            #   Inline SVG icon set
│   ├── AdapterVisualizer.tsx#   The transformer-stack diagram
│   ├── LogConsole.tsx       #   The streaming trainer-log terminal
│   ├── ui/
│   │   ├── primitives.tsx   #   Panel, Stat, NeonButton, Slider, Toggle, Segmented…
│   │   └── Background.tsx   #   The animated grid/orb backdrop
│   └── layout/
│       ├── Shell.tsx        #   Sidebar stepper + top bar + content frame
│       └── StepNav.tsx      #   Back/Continue footer
│
└── screens/                 # LAYER 3 — one per workflow step
    ├── Landing.tsx          #   Marketing hero (before entering the lab)
    ├── ModelStep.tsx        #   1. pick model
    ├── DatasetStep.tsx      #   2. pick dataset
    ├── LoraStep.tsx         #   3. configure LoRA + hyperparams (live estimates)
    ├── TrainStep.tsx        #   4. the live training dashboard
    ├── EvaluateStep.tsx     #   5. results, benchmarks, sample generations
    ├── CompareStep.tsx      #   6. W&B-style run comparison
    ├── QuantizeStep.tsx     #   7. GGUF/AWQ/GPTQ size/quality math
    ├── DeployStep.tsx       #   8. simulated vLLM endpoint + playground
    └── ExportStep.tsx       #   9. the real generated code
```

## 4. State model (what the store holds)

`useForge` is one big object. Mentally split it into four groups:

1. **Config** (what the user chose): `modelId`, `datasetId`, `lora`, `train`.
2. **Navigation:** `step` (which screen), plus `App.tsx`'s local `launched` flag.
3. **Live run state:** `status` (idle/running/paused/completed), `currentStep`, `total`,
   `metrics[]` (the loss curve), `logs[]`, `gpuUtil`, `gpuMem`, `tokPerSec`, `checkpoints[]`.
4. **History:** `runs[]` (every completed run) + `compareA`/`compareB` selections.

**Module-level (non-React) variables** in `useForge.ts` hold things that must survive re-renders
but shouldn't trigger them: the `setInterval` handle (`timer`), the seeded RNG (`rng`), the
derived `dyn`amics, and counters (`tickCount`, `logId`). This is a deliberate pattern — see
[`annotated/06-store-useForge.md`](annotated/06-store-useForge.md).

## 5. The simulation loop (the heartbeat)

When the user clicks **Start**, `start()` seeds the RNG, computes `dynamics` from the config,
resets the run state, then calls `setInterval(tick, 640 / simSpeed)`. Each `tick`:

1. advances `currentStep` by `total / 56` (the run always spans **56 logged points**),
2. computes learning rate (`lrAt`), loss (`stepLoss`), grad norm (`stepGradNorm`),
3. pushes a `MetricPoint` and a formatted log line,
4. occasionally emits an eval or a checkpoint,
5. jitters `gpuUtil` / `gpuMem` / `tokPerSec` for the animated meters,
6. when `currentStep >= total`, calls `finalize()` which snapshots the run into `runs[]`.

Because the RNG is seeded from `train.seed`, **the same config always produces the same run** —
which is what makes the Compare screen meaningful.

## 6. Rendering & theming

- **Styling:** Tailwind CSS. The cyberpunk palette (void black, neon cyan/magenta/lime) is
  defined in `tailwind.config.js`; reusable classes (`.glass`, `.neon-cyan`, `.chip`) live in
  `src/index.css` under `@layer components`.
- **Motion:** `framer-motion` for page transitions, number pops, gauge sweeps, and the GPU
  equalizer bars.
- **Charts:** No chart library. Everything (`MetricChart`, `RadialGauge`, `GpuMeter`,
  `StackBar`, `Sparkline`) is hand-drawn SVG in `components/charts.tsx`, so the neon aesthetic
  is fully controllable.

## 7. Build & deploy

- **Bundler:** Vite. `vite.config.ts` sets `base: './'` so the *same* build works at a domain
  root (Vercel) and at a sub-path (`/ForgeAI/` on GitHub Pages).
- **CI/CD:** `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push
  to `main`. `vercel.json` makes the repo one-click importable to Vercel too.

## 8. Why these choices

| Decision | Reason |
|---|---|
| No backend | A GPU behind a public URL is infeasible/expensive; a simulation is deployable and free. |
| Real math, not fake numbers | Makes the lab *educational* — tuning `r` or `lr` changes outcomes correctly. |
| Zustand over Redux/Context | Tiny, no boilerplate, works cleanly with a `setInterval` outside React. |
| Hand-rolled SVG charts | Full control of the neon look; zero chart-lib weight. |
| Seeded RNG | Reproducibility → the Compare screen can meaningfully diff two runs. |
| Vite + `base:'./'` | One artifact deploys to both Vercel and GitHub Pages. |
