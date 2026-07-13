# 01 — Types & Data (`src/types.ts`, `src/data/*.ts`)

This is Layer 0: no logic, just the **vocabulary** (TypeScript types) and the **real-world
constants** everything else builds on.

---

## `src/types.ts` — the shared vocabulary

Every other file imports shapes from here. Understanding these types = understanding the app's
data model.

```ts
export type Scheduler = 'cosine' | 'linear' | 'constant'
export type Quant = 'none' | '8bit' | '4bit'
export type TargetModule =
  | 'q_proj' | 'k_proj' | 'v_proj' | 'o_proj'      // attention projections
  | 'gate_proj' | 'up_proj' | 'down_proj'          // MLP projections
```
▸ **Scheduler** — the three learning-rate decay shapes `lrAt()` knows how to draw.
▸ **Quant** — precision of the *frozen base model*. `'4bit'` = QLoRA. Drives `bytesPerParam()`.
▸ **TargetModule** — the seven linear layers inside a transformer block that LoRA can adapt.
These exact strings are also what the generated `train.py` passes to `LoraConfig.target_modules`,
so the type doubles as the real HF module names.

```ts
export interface ModelArch {
  id, name, family, hf        // identity: slug, display name, vendor, HuggingFace repo id
  params                      // TOTAL parameter count (real number from config.json)
  hidden, intermediate        // hidden size (d_model) and MLP inner width
  layers, heads, kvHeads      // # decoder blocks, # attn heads, # KV heads (GQA)
  vocab, seqLen               // vocabulary size, native context length
  license, blurb, accent      // display metadata (accent = which neon color to theme with)
}
```
▸ `hidden`, `intermediate`, `layers`, `heads`, `kvHeads` are the **only** fields the math needs —
they let `moduleDims()` reconstruct every weight-matrix shape. `kvHeads < heads` encodes
grouped-query attention (GQA), which shrinks the k/v projections. Everything else is for display.

```ts
export interface LoraConfig  { r, alpha, dropout, targets:TargetModule[] }
export interface TrainConfig { learningRate, epochs, batchSize, gradAccum, maxSeqLen,
                               warmupRatio, scheduler, quant, loggingSteps, evalSteps,
                               saveSteps, wandb, seed }
```
▸ **LoraConfig** — the adapter definition. `r` is rank (capacity), `alpha` is the scaling
numerator (effective scale = `alpha/r`), `targets` is which modules get adapters.
▸ **TrainConfig** — everything the optimizer needs. `seed` is critical: it seeds the RNG so runs
are reproducible. `wandb` only toggles a line in the generated code.

```ts
export interface MetricPoint { step, loss, lr, gradNorm, evalLoss? }
```
▸ One row of the training log = one point on the loss chart. `evalLoss` is optional because eval
only happens every `evalSteps`. `metrics: MetricPoint[]` in the store IS the loss curve.

```ts
export interface Checkpoint { id, step, loss, evalLoss, perplexity, adapterMB, createdAt }
export type RunStatus = 'idle' | 'running' | 'paused' | 'completed'
export interface RunSummary { id, name, modelId, datasetId, lora, train, totalSteps,
                              trainableParams, totalParams, vramGB, finalLoss, finalEval,
                              finalPpl, checkpoints, color, createdAt, durationSec }
```
▸ **Checkpoint** — a saved snapshot during a run (every `saveSteps`). `perplexity = exp(evalLoss)`.
▸ **RunStatus** — the state machine the Train screen's controls switch on.
▸ **RunSummary** — an *immutable snapshot* of a finished run, stored in `runs[]`. It copies the
config so later config edits don't retroactively change history. `color` is assigned round-robin
so runs are distinguishable in the Compare chart.

```ts
export type Step = 'model'|'dataset'|'lora'|'train'|'evaluate'|'compare'|'quantize'|'deploy'|'export'
```
▸ The nine workflow steps. `store.step` holds the current one; `App.tsx` maps it to a screen
component; `Shell.tsx` renders the sidebar from this list.

---

## `src/data/models.ts` — five real models

```ts
export const MODELS: ModelArch[] = [ { id:'llama-3.2-1b', … hidden:2048, layers:16, heads:32,
  kvHeads:8, … }, … ]
export const getModel = (id) => MODELS.find(m => m.id === id) ?? MODELS[0]
```
▸ Each entry's dimensions are the **actual values** from that model's `config.json` on
HuggingFace (Llama 3.2 1B/3B, Phi-3-mini, Mistral 7B, Gemma 2 2B). This is what makes the
parameter and VRAM math *true* rather than decorative — e.g. Llama-3.2-1B genuinely has
hidden=2048, 16 layers, 32 heads, 8 KV heads.
▸ `getModel` is the universal resolver: components and the store hold only a string `id` and call
`getModel(id)` to hydrate the full object. The `?? MODELS[0]` guarantees it never returns
`undefined`, so callers never need null checks.
▸ `accent` ('cyan' | 'magenta' | 'lime' | 'amber') decides the neon color a model card themes to.

---

## `src/data/datasets.ts` — six real HF datasets

```ts
export const DATASETS: DatasetInfo[] = [ { id:'alpaca', hf:'tatsu-lab/alpaca', rows:52002,
  avgTokens:96, format:'alpaca', sample:{instruction, input, output}, … }, … ]
export const getDataset = (id) => DATASETS.find(d => d.id === id) ?? DATASETS[0]
```
▸ `rows` feeds `totalSteps()` (more rows → more optimizer steps). `avgTokens` and `id` feed the
dataset-difficulty lookup in `deriveDynamics()`.
▸ `sample` is a representative record shown on the Dataset screen and reused as the "after"
generation on the Evaluate screen.
▸ `format` ('alpaca'|'chatml'|'sharegpt'|…) is display-only here but tells you which prompt
template the real training would use.

---

## `src/data/gpus.ts` — reference GPUs

```ts
export const GPUS: GpuSpec[] = [ {id:'t4', vram:16, tier:'free'}, {id:'rtx4090', vram:24}, …,
  {id:'a100-80', vram:80} ]
```
▸ A tiny table used only by `gpuFit(totalVram)` in `lib/lora.ts` to answer "will this run fit?".
`vram` (GB) is compared against the estimated peak. Ordered smallest→largest so `smallestFit()`
can return the cheapest card that fits.

---

**Takeaway:** Layer 0 is deliberately dumb. All the intelligence is that the *numbers are real*,
which lets Layer 1 compute believable results. Next: [`02-lib-lora.md`](02-lib-lora.md).
