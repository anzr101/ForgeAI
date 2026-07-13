# 09 — Screens (`src/screens/*.tsx`)

Layer 3: one file per workflow step. Each screen is a *composition* — it reads the store, calls
lib math for display, and arranges Layer-2 components. Business logic stays in store/lib.

---

## `Landing.tsx` — the marketing hero (pre-lab)

▸ Not part of the stepper. Rendered by `App` when `launched=false`. Sections: sticky nav, hero
headline + CTAs (all call `onLaunch`), an animated pipeline strip (Model→…→Deploy), a feature
grid, a "covers the stack" chip cloud (`LoRA`, `QLoRA`, `PEFT`, … `vLLM`), and a closing CTA.
Pure presentation with framer-motion `whileInView` fade-ups. `onLaunch` flips `App.launched`.

---

## `ModelStep.tsx` — step 1

```ts
const { modelId, setModel } = useForge()
const selected = getModel(modelId)
```
▸ Maps `MODELS` → selectable cards (each shows real params, layers, hidden, context, license).
Clicking calls `setModel(id)`. Below, `<Stat>`s show the selected model's hidden/intermediate/
vocab/repo. `StepNav next="dataset"`.

---

## `DatasetStep.tsx` — step 2

▸ Maps `DATASETS` → cards (rows, avg tokens, task, format badge). Selecting calls `setDataset`. A
sticky side panel renders the dataset's `sample` (instruction/input/output) as a formatted record —
so you see what the model will train on. `StepNav back="model" next="lora"`.

---

## `LoraStep.tsx` — step 3 (the config cockpit)

The busiest screen. Left column = controls, right column = **live estimates** recomputed every
render:

```ts
const tp = trainableParams(model, lora)
const vram = estimateVram(model, lora, train)
const steps = totalSteps(dataset.rows, train)
const { secPerStep, tokensPerSec } = throughput(model, train)
const eta = secPerStep * steps
const fits = gpuFit(vram.total)
```
▸ **Controls** (all `Segmented`/`Slider`/`Chip`/`Toggle` wired to `setLora`/`setTrain`): rank,
alpha, dropout, target-module chips + presets (Q/V only, Attention, All linear), quantization,
scheduler, learning rate, max-seq-len, batch, grad-accum, epochs, warmup, W&B toggle, seed
randomizer.
▸ **Live panel:** trainable params + %, adapter MB, a `<StackBar>` of the VRAM breakdown, a "fits
X" chip (`smallestFit`), a run-plan list (steps, effective batch, throughput, ETA), and per-GPU
fit bars (`gpuFit`). Because these derive from the store on every render, **moving any control
instantly updates every number** — no store round-trip needed for the math.
▸ Below the controls sits `<AdapterVisualizer>`.
▸ The green **Start training run** button calls `store.start()` (see store doc), which flips to the
Train screen and begins the heartbeat.

---

## `TrainStep.tsx` — step 4 (the live dashboard)

```ts
const s = useForge()                                   // subscribes to the whole store
const last = s.metrics.at(-1)
const lastEval = [...s.metrics].reverse().find(m => m.evalLoss != null)?.evalLoss
const progress = s.currentStep / s.total
const etaRemaining = throughput(model, s.train).secPerStep * (s.total - s.currentStep)
```
▸ **Idle branch:** if no run has started (`status idle && metrics empty`), shows a "Ready to forge"
splash with a Start button.
▸ **Controls** switch on `status`: running → Pause/Stop; paused → Resume/Stop; completed →
Evaluate/New-run. A `Segmented` sets `simSpeed` (0.5–4×) via `setSimSpeed`.
▸ **Progress bar** animates to `progress`. **Six `<Stat>` cards** show train loss, eval loss +
perplexity, LR, throughput, VRAM, and ETA/Elapsed — all read from the latest metric/store values.
▸ **`<MetricChart points={s.metrics}>`** is the loss curve; two **`<RadialGauge>`**s show GPU
util/mem; **`<GpuMeter>`** is the equalizer; **`<LogConsole logs={s.logs}>`** streams the log.
▸ On completion a lime banner offers Evaluate / Export. **This screen is a pure mirror of the store
— all motion comes from the tick loop mutating state.**

---

## `EvaluateStep.tsx` — step 5

```ts
const run = runs[runs.length - 1]                      // latest completed run
if (!run) return <EmptyState/>                          // nothing to show yet
const score = clamp(round(100 * (1 - (run.finalEval - 0.6)/2.4)), 6, 99)   // heuristic quality
```
▸ Reads the latest `RunSummary`. Derives a 0–100 "quality score" from `finalEval`. Shows result
`<Stat>`s (loss, eval, perplexity, score, adapter size), a **before→after benchmark** panel
(animated bars from a base baseline to `after = base + f(score)`), and a **sample generation**
(base model = a hedged reply; fine-tuned = the dataset's `sample.output`). Checkpoints render as a
`<Sparkline>` + table. CTA → Compare.

---

## `CompareStep.tsx` — step 6 (experiment tracking)

```ts
const A = runs.find(r => r.id === compareA)
const B = runs.find(r => r.id === compareB)
const selected = dedupe([A,B])                          // never plot one run twice
```
▸ Empty state until ≥1 run exists. Renders **all `runs[]`** in a W&B-style table; each row has
`A`/`B` assign buttons (`setCompare`). The **`<OverlayChart>`** (a local SVG component) plots each
selected run's checkpoint-loss curve in its `color`. A **diff table** lists config/metric rows and
highlights where A ≠ B. `selected` is de-duplicated so assigning the same run to A and B (or the
single-run case) doesn't crash on duplicate keys. CTA → Quantize.

---

## `QuantizeStep.tsx` — step 7

```ts
const [method, setMethod] = useState('gguf'); const [bits, setBits] = useState(4)   // LOCAL state
const effBpw = method==='gguf' ? (bits===4?4.5:bits===5?5.5:8.5) : bits
const quantMB = model.params * (effBpw/8) / 1e6
const reduction = 1 - quantMB / fp16MB
const script = generateQuantizeScript(method, bits, model, runName)
```
▸ Note: this screen keeps `method`/`bits` in **local `useState`** (screen-scoped, not global — it
doesn't belong in the shared store). Three format cards (GGUF/AWQ/GPTQ) show computed size &
quality; selecting one updates the size bars, a size/reduction/quality readout, and a live-generated
quantize script (with copy/download via `useCopy`/`download`). `StepNav next="deploy"`.

---

## `DeployStep.tsx` — step 8 (simulated serving)

```ts
const [phase, setPhase] = useState('idle')             // idle → deploying → live (LOCAL state)
const deploy = () => { setPhase('deploying'); /* setInterval steps through STAGES */ → 'live' }
```
▸ A self-contained UI simulation (no store, no real network). Clicking Deploy animates through
staged messages (merge → load shards → KV cache → warmup → start server) then flips to a **live**
state: a fake OpenAI-compatible endpoint, latency/throughput `<Stat>`s, copyable cURL + Python
snippets, and a toy **playground** whose `send()` echoes a dataset-flavored reply. Demonstrates the
*shape* of serving without a backend.

---

## `ExportStep.tsx` — step 9 (the payoff)

```ts
const input: CodegenInput = useMemo(() => ({ model, dataset, lora, train, runName }), [...])
const files = useMemo(() => ({
  train:    { name:'train.py',         code: generateTrainPy(input) },
  reqs:     { name:'requirements.txt', code: generateRequirements(input.train) },
  notebook: { name:`${runName}.ipynb`, code: generateNotebook(input) },
  quantize: { name:'quantize.sh',      code: generateQuantizeScript('gguf',4,model,runName) },
}), [input])
```
▸ Bundles the **current config** into a `CodegenInput` and calls the generators from
[`codegen`](04-lib-codegen.md). A tabbed view switches between the four files; each supports copy
(`useCopy`) and download (`download`). "Download all" fires staggered downloads; an "Open Colab"
link is provided. **This is where the simulation becomes reproducible reality.** `StepNav back="deploy"`.

---

**Takeaway:** screens are thin. They read store + call lib, compose Layer-2 components, and route
via `StepNav`/`setStep`. The only screen-local state is genuinely ephemeral UI (Quantize's
method/bits, Deploy's phase). Next: the entry point that stitches it all —
[`10-app-and-config.md`](10-app-and-config.md).
