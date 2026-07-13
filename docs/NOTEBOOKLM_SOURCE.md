# Forge — Complete Knowledge Base (NotebookLM Source)

> **How to use this file:** Upload it to NotebookLM (or paste into any LLM) as a single source.
> It is self-contained — it explains what Forge is, how it's built, every module, every key
> algorithm, and how to extend it — so you can ask questions like *"How is VRAM estimated?"*,
> *"What happens when I click Start?"*, or *"How do I add a new model?"* and get grounded answers.

---

## 0. TL;DR

Forge is a **dark-cyberpunk web app that simulates fine-tuning open-weight LLMs** (LoRA/QLoRA).
It has **no backend and no GPU**. A React front-end drives a **seeded simulation** whose numbers
come from **real math** (true LoRA parameter counts, VRAM estimates, learning-rate schedules,
loss dynamics). The user walks a 9-step flow — Model → Dataset → LoRA config → Train (live
telemetry) → Evaluate → Compare → Quantize → Deploy → Export — and at the end can export a
**genuinely runnable** `train.py` + Colab notebook. Live at `https://anzr101.github.io/ForgeAI/`.

**The golden rule of the whole codebase:** `config → math → store state → React render`.

---

## 1. Glossary (domain terms used throughout)

- **LoRA (Low-Rank Adaptation):** instead of updating a frozen weight matrix `W (out×in)`, you
  train two small matrices `A (r×in)` and `B (out×r)` and add `B·A` to `W`. Trainable params per
  matrix = `r·(in+out)`. Drastically fewer trainable params than full fine-tuning.
- **QLoRA:** LoRA on top of a base model quantized to 4-bit. Slashes memory so a 7B model fits on
  a 16 GB GPU.
- **r (rank):** LoRA capacity. Higher = more expressive adapter, more params, lower loss floor.
- **alpha:** LoRA scaling numerator; effective scale = `alpha / r`.
- **target modules:** which linear layers get adapters — `q_proj, k_proj, v_proj, o_proj`
  (attention) and `gate_proj, up_proj, down_proj` (MLP).
- **PEFT / TRL / bitsandbytes / transformers:** the HuggingFace libraries the *generated* code
  uses (adapter injection, SFT trainer, quantization, models).
- **VRAM components:** base weights + optimizer states + gradients + activations + overhead.
- **Perplexity:** `exp(eval_loss)` — lower is better.
- **GGUF / AWQ / GPTQ:** post-training quantization formats for deployment (llama.cpp, vLLM).

---

## 2. What's real vs. simulated (important!)

**Real (computed from actual formulas & model configs):**
- Trainable parameter counts and trainable %.
- VRAM estimate and its component breakdown.
- Learning-rate schedule (matches HF `get_scheduler`).
- Total optimizer steps, throughput, ETA.
- The exported `train.py` / notebook / quantize scripts.

**Simulated (but deterministic & config-responsive):**
- The loss/eval curves, gradient norms, GPU utilization, and streaming logs. These come from a
  **seeded** model (`deriveDynamics` + `stepLoss`), so the same config always yields the same run,
  and changing `lr`/`r`/`epochs`/`dataset` visibly changes the outcome.

**Purely cosmetic:** the Deploy screen's endpoint/playground (no real network).

---

## 3. Tech stack

- **React 18 + TypeScript**, bundled by **Vite**.
- **Zustand** for state (one store, `useForge`).
- **framer-motion** for animation.
- **Tailwind CSS** for styling (custom cyberpunk tokens in `tailwind.config.js` + `index.css`).
- **Hand-drawn SVG** charts (no chart library).
- 100% client-side; deploys as a static `dist/` to **GitHub Pages** (CI workflow) or **Vercel**.

---

## 4. Architecture — layers

Strict bottom-up dependency layers (lower never imports higher):

```
Layer 4  App.tsx                 routing (landing vs lab; step → screen)
Layer 3  screens/*.tsx           one file per workflow step
Layer 2  components/*.tsx         reusable UI (charts, primitives, visualizer, console)
Layer 1b store/useForge.ts        single source of truth + tick() simulation loop
Layer 1a lib/*.ts                 pure functions: the math + the code generator
Layer 0  data/*.ts, types.ts      real constants + type vocabulary
```

- **Layer 0** — no logic. `types.ts` = shapes. `data/models.ts`, `data/datasets.ts`,
  `data/gpus.ts` = curated constants with *real* numbers.
- **Layer 1a (lib)** — pure, testable functions (would run in plain Node). The "physics."
- **Layer 1b (store)** — the only stateful module; wraps lib functions and drives them with a timer.
- **Layers 2–4 (UI)** — read the store, call lib for display math, render. Almost no logic.

---

## 5. Folder & file map

```
src/
  types.ts            all TypeScript types
  main.tsx            React root mount
  App.tsx             landing vs lab; maps step → screen
  index.css           Tailwind + cyberpunk tokens/classes
  data/
    models.ts         5 models w/ REAL dims (Llama 3.2 1B/3B, Phi-3, Mistral 7B, Gemma 2 2B)
    datasets.ts       6 HF datasets w/ real rows + samples
    gpus.ts           reference GPUs for "will it fit?"
  lib/
    lora.ts           trainableParams, estimateVram, throughput, totalSteps, gpuFit
    schedule.ts       makeRng, gauss, lrAt, deriveDynamics, stepLoss, evalLossAt (the simulator)
    codegen.ts        generateTrainPy / Requirements / Notebook / QuantizeScript
    format.ts         fmtInt, fmtParams, fmtBytes, fmtPct, fmtDuration, fmtLr, clsx
    io.ts             useCopy() hook, download() helper
  store/useForge.ts   Zustand store + tick loop + finalize + actions
  components/
    charts.tsx        MetricChart, RadialGauge, GpuMeter, StackBar, Sparkline
    icons.tsx         inline SVG icons
    AdapterVisualizer.tsx   transformer-stack diagram
    LogConsole.tsx    streaming trainer log terminal
    ui/primitives.tsx Panel, SectionTitle, Stat, NeonButton, Chip, Segmented, Toggle, Slider, Field
    ui/Background.tsx animated backdrop
    layout/Shell.tsx  sidebar stepper + top bar + content frame
    layout/StepNav.tsx  Back/Continue footer
  screens/
    Landing, ModelStep, DatasetStep, LoraStep, TrainStep,
    EvaluateStep, CompareStep, QuantizeStep, DeployStep, ExportStep
```

---

## 6. State model (the `useForge` store)

One object, four conceptual groups:
1. **Config:** `modelId`, `datasetId`, `lora {r,alpha,dropout,targets}`,
   `train {learningRate,epochs,batchSize,gradAccum,maxSeqLen,warmupRatio,scheduler,quant,
   loggingSteps,evalSteps,saveSteps,wandb,seed}`.
2. **Navigation:** `step` (which screen). (Plus `App`'s local `launched` for Landing-vs-lab.)
3. **Live run:** `status` (idle/running/paused/completed), `currentStep`, `total`, `simElapsed`,
   `simSpeed`, `metrics[]` (the loss curve), `logs[]`, `gpuUtil`, `gpuMem`, `tokPerSec`,
   `checkpoints[]`, `runName`.
4. **History:** `runs[]` (immutable `RunSummary` per finished run), `compareA`, `compareB`.

**Actions:** `setStep, setModel, setDataset, setLora, setTrain, setSimSpeed, setCompare,
start, pause, resume, stop, resetRun`.

**Module-level (non-React) variables** (persist across renders without triggering them):
`timer` (setInterval handle), `rng` (seeded PRNG), `dyn` (run dynamics), `tickCount`, `logId`,
`evalEvery`, `saveEvery`, `adapterMB`.

---

## 7. The key algorithms (with the actual formulas)

### 7.1 Trainable parameters (`lib/lora.ts`)
```
headDim = hidden / heads
kvOut   = kvHeads * headDim              # GQA shrinks k/v
module dims: q,o = [hidden,hidden]; k,v = [hidden,kvOut];
             gate,up = [hidden,intermediate]; down = [intermediate,hidden]
trainable = layers * Σ_over_targets  r·(in + out)
```

### 7.2 VRAM estimate (`lib/lora.ts`)
```
base       = params * bytesPerParam(quant) / GB        # 4bit=0.5, 8bit=1, bf16=2 bytes
optimizer  = trainable * 8 / GB                         # AdamW: 2 fp32 moments
gradients  = trainable * 2 / GB                         # bf16 grads (adapter only)
activations= batch * maxSeqLen * hidden * layers * 2 * 2.5 / GB
overhead   = 1.3
total      = base + optimizer + gradients + activations + overhead
```

### 7.3 Total steps & throughput (`lib/lora.ts`)
```
totalSteps = ceil(rows * epochs / (batch * gradAccum))
tokensPerSec = BASE_TOK_PER_SEC[model] * quantFactor    # 4bit=0.82, 8bit=0.9, none=1
secPerStep   = (batch*gradAccum*maxSeqLen) / tokensPerSec
```

### 7.4 Learning-rate schedule (`lib/schedule.ts`, mirrors HF)
```
if step < warmup:  lr = peak * step/warmup             # linear warm-up
else p = (step-warmup)/(total-warmup):
   cosine  -> peak * 0.5*(1+cos(π·p))
   linear  -> peak * (1-p)
   constant-> peak
```

### 7.5 Run dynamics (`deriveDynamics`, the "DNA" — `lib/schedule.ts`)
```
L0   = 2.35 - 0.08·ln(params_B) + difficulty·1.4        # starting loss
lrScore = 1 - min(1, |ln(lr/2e-4)|/2.2)                 # 1 at the 2e-4 sweet spot
Lmin = max(0.35, L0·(0.62 - capacityScore - 0.12·lrScore + difficulty·0.5))
k    = (2.4 + epochs·0.9)·(0.6 + 0.6·lrScore)           # decay speed
evalGap     = 0.04 + min(0.35, overfit)                 # ↑ small data × many epochs
instability = lr>4e-4 ? min(0.4,(lr-4e-4)·1200) : 0.015 # spike probability
```

### 7.6 Per-step loss (`stepLoss`)
```
smooth = Lmin + (L0-Lmin)·exp(-k·p)                      # exponential decay
loss   = max(0.05, smooth + gauss·noise·(0.45+0.55·(1-p)) + rareSpike)
evalLoss = smooth·(1 + evalGap·p) + small noise; perplexity = exp(evalLoss)
```

### 7.7 Seeded PRNG (`makeRng`, mulberry32)
Deterministic uint32 generator seeded from `train.seed`. Guarantees reproducibility → makes the
Compare screen meaningful.

---

## 8. The simulation loop (what happens over time)

`start()`:
1. resolve model/dataset; `total = totalSteps(...)`; `runName = makeRunName(...)`.
2. `rng = makeRng(seed)`; `dyn = deriveDynamics(...)`; compute `evalEvery`/`saveEvery`/`adapterMB`.
3. reset run state; `set(status:'running', step:'train', …)`; print 6 preamble logs.
4. `timer = setInterval(tick, 640 / simSpeed)`.

`tick()` (fires ~every 640 ms; a run is always **56 ticks** wide via `TICKS=56`):
1. `step = round(tickCount * total/56)`; `p = step/total`.
2. `lr = lrAt(...)`, `loss = stepLoss(dyn,…,rng)`, `gradNorm = stepGradNorm(…)`.
3. push a `MetricPoint`; occasionally attach `evalLoss`; maybe push a `Checkpoint`.
4. emit an HF-style log line (`{'loss':…, 'grad_norm':…, 'learning_rate':…, 'epoch':…}`).
5. `set(...)`: append metric, jitter `gpuUtil` (dips to 40–60% on eval/save, else 88–99%),
   `gpuMem`, `tokPerSec`, accrue `simElapsed`.
6. at `step ≥ total`, `finalize()`.

`finalize()`: stop timer; build an immutable `RunSummary` (copies config + final metrics +
checkpoints, assigns a color); push to `runs[]`; set compare slots (B = new run, A = a different
prior run); `status:'completed'`.

`pause/resume/stop/resetRun`: manage the timer + status; `stop` finalizes early; `resetRun` wipes
the live run to idle without deleting history.

---

## 9. Screen-by-screen behavior

- **Landing** — hero + CTAs; `onLaunch` enters the lab.
- **ModelStep** — pick from `MODELS`; `setModel`.
- **DatasetStep** — pick from `DATASETS`; shows a `sample` record.
- **LoraStep** — all LoRA/hyperparameter controls; a live panel recomputes trainable params,
  adapter MB, a VRAM `StackBar`, GPU-fit bars, steps/ETA on every render; `Start` → `store.start()`.
- **TrainStep** — the live dashboard: metric cards, `MetricChart`, two `RadialGauge`s, `GpuMeter`,
  `LogConsole`; controls switch on `status`; `simSpeed` selector. Pure mirror of the store.
- **EvaluateStep** — latest run's results: quality score, before/after benchmark bars, base-vs-
  fine-tuned sample generation, checkpoint table + sparkline.
- **CompareStep** — W&B-style runs table; assign two runs to A/B; overlay their checkpoint curves;
  diff their configs. `selected` is de-duplicated to avoid drawing a run twice.
- **QuantizeStep** — GGUF/AWQ/GPTQ cards; computes output size (`params·bpw/8`) & reduction;
  generates a real quantize script. Uses **local** `useState` for method/bits.
- **DeployStep** — simulated staged deploy → "live" endpoint + cURL/Python snippets + toy
  playground. Local `phase` state; no real network.
- **ExportStep** — bundles config into `CodegenInput`; tabs over generated `train.py`,
  `requirements.txt`, `.ipynb`, `quantize.sh`; copy/download each.

---

## 10. Styling & motion

- Palette/tokens in `tailwind.config.js` (`void`, `panel`, `line`, `cyan`, `magenta`, `lime`,
  `amber`, `rose`) and reusable classes in `index.css` (`.glass`, `.neon-*`, `.chip`, `.label`,
  `.text-gradient`).
- Motion via framer-motion: page cross-fades (`AnimatePresence` in `App`/`Shell`), number pops,
  gauge sweeps, GPU equalizer, hover/tap on buttons, scroll fade-ins on Landing.
- Charts are hand-drawn SVG: fixed `viewBox` + `x()`/`y()` mapping functions + `<polyline>`; the
  `y` mapping is inverted because SVG y grows downward.

---

## 11. Build & deploy

- `npm run dev` → Vite dev server (port 5173).
- `npm run build` → `tsc --noEmit && vite build` → static `dist/`.
- `vite.config.ts` sets `base:'./'` so one build works at a domain root (Vercel) and a sub-path
  (`/ForgeAI/` on Pages).
- `.github/workflows/deploy.yml` builds + publishes to GitHub Pages on push to `main`.
- `vercel.json` makes the repo one-click importable to Vercel.

---

## 12. How to extend (common tasks)

- **Add a model:** append a `ModelArch` to `data/models.ts` with real `hidden/intermediate/
  layers/heads/kvHeads/vocab` (from its HF `config.json`). Everything (params, VRAM, code) adapts
  automatically. Optionally add a `BASE_TOK_PER_SEC` entry in `lib/lora.ts` for throughput.
- **Add a dataset:** append a `DatasetInfo` to `data/datasets.ts`; add a difficulty entry in
  `DATASET_DIFFICULTY` (`lib/schedule.ts`) if you want its loss floor to differ.
- **Change loss behavior:** edit `deriveDynamics` / `stepLoss` in `lib/schedule.ts`.
- **Change VRAM math:** edit `estimateVram` in `lib/lora.ts`.
- **Add a workflow step:** add to the `Step` union (`types.ts`), the `STEPS` array
  (`layout/Shell.tsx`), and the `SCREENS` map (`App.tsx`); create the screen in `screens/`.
- **Change the generated code:** edit the templates in `lib/codegen.ts` (they interpolate the
  live config, so keep the `${…}` bindings intact).
- **Retheme:** edit the color tokens in `tailwind.config.js` and the `.neon-*`/`.glass` classes in
  `index.css`.

---

## 13. FAQ / anticipated questions

- **Does it actually train a model?** No — it's a faithful simulation. But the exported code
  trains for real on a GPU/Colab.
- **Why do the same settings always give the same curve?** The RNG is seeded from `train.seed`;
  changing the seed (🎲 button) reshuffles the noise.
- **Why does a higher learning rate make the curve jagged?** `deriveDynamics` raises `instability`
  above `lr = 4e-4`, so `stepLoss` injects occasional spikes — mimicking divergence.
- **Why does a 7B model "fit" a 16 GB GPU only in 4-bit?** `estimateVram` scales the base weights
  by `bytesPerParam(quant)`; 4-bit = 0.5 B/param, so base drops from ~14.5 GB to ~3.6 GB.
- **Where's the state?** All in `store/useForge.ts`. Screens are views; the tick loop is the only
  thing that mutates live-run state.
- **How is the loss chart drawn without a chart library?** `MetricChart` in `components/charts.tsx`
  maps `store.metrics` to SVG coordinates and renders a `<polyline>`.
- **Is there a backend?** No. It's fully static; "deploy" just serves `dist/`.

---

## 14. One-paragraph reconstruction

Forge is a static React/TypeScript app. Static data files hold real model/dataset numbers; a pure
`lib/` layer computes LoRA parameter counts, VRAM, schedules, and a seeded loss model, and also
generates real training code. A single Zustand store holds all config + live-run state and runs a
`setInterval` "tick" that walks a run across 56 frames, writing loss/GPU/log values derived from
that math. React screens subscribe to the store and render neon SVG charts and controls; framer-
motion smooths the 56 discrete updates into fluid motion. When finished, the same config object is
compiled into a runnable `train.py`/notebook. Deploy = serve the static `dist/`.
```
config → deriveDynamics(dyn) → setInterval(tick) → store.set(metrics/logs/gpu) → React render
       └────────────────────────────── same config → codegen → real train.py ──────────────────┘
```
