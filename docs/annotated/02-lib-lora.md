# 02 — `src/lib/lora.ts` — the LoRA & VRAM math

This is the "physics engine." Pure functions, no React, no state. If you understand this file you
understand *why* the numbers on screen are believable.

---

## `moduleDims(model)` — reconstruct every weight-matrix shape

```ts
export function moduleDims(m: ModelArch): Record<TargetModule, [number, number]> {
  const headDim = m.hidden / m.heads          // size of ONE attention head
  const kvOut   = m.kvHeads * headDim          // total width of the K/V projection (GQA)
  return {
    q_proj:    [m.hidden, m.hidden],           // query:  hidden -> hidden
    k_proj:    [m.hidden, kvOut],              // key:    hidden -> kvOut  (smaller under GQA)
    v_proj:    [m.hidden, kvOut],              // value:  hidden -> kvOut
    o_proj:    [m.hidden, m.hidden],           // output: hidden -> hidden
    gate_proj: [m.hidden, m.intermediate],     // MLP gate:  hidden -> intermediate
    up_proj:   [m.hidden, m.intermediate],     // MLP up:    hidden -> intermediate
    down_proj: [m.intermediate, m.hidden],     // MLP down:  intermediate -> hidden
  }
}
```
▸ `headDim = hidden / heads` — standard transformer geometry: the hidden vector is split evenly
across attention heads.
▸ `kvOut = kvHeads * headDim` — the crucial GQA detail. In grouped-query attention there are
fewer K/V heads than Q heads, so the k/v projections output a *narrower* vector than q/o. For
Llama-3.2 (heads=24 or 32, kvHeads=8) this makes k/v adapters much cheaper. Ignoring this would
overcount parameters.
▸ Each entry is `[in_features, out_features]` for that `nn.Linear`. These are the exact shapes
PEFT sees when it injects a LoRA adapter, which is why the count that follows is *real*.

---

## `trainableParams(model, lora)` — the real LoRA parameter count

```ts
export function trainableParams(m: ModelArch, lora: LoraConfig): number {
  const dims = moduleDims(m)
  let perLayer = 0
  for (const t of lora.targets) {
    const [inDim, outDim] = dims[t]
    perLayer += lora.r * (inDim + outDim)      // A(r×in) + B(out×r) = r·(in+out)
  }
  return perLayer * m.layers                    // same adapters in every decoder block
}
```
▸ The heart of LoRA: a frozen weight `W ∈ ℝ^{out×in}` gets two small trainable matrices,
`A ∈ ℝ^{r×in}` and `B ∈ ℝ^{out×r}`, whose product `B·A` is added to `W`. Parameter count =
`r·in + out·r = r·(in+out)`.
▸ The loop sums that over only the **selected** `targets`, so toggling a module chip on the LoRA
screen changes this number immediately.
▸ `× m.layers` because the same set of adapters is added to **every** decoder block.
▸ This is the number printed as "trainable params" and in the generated code's
`trainable params: … || all params: … || trainable%: …` log line.

---

## `bytesPerParam(quant)` — precision → bytes

```ts
export const bytesPerParam = (q: Quant): number =>
  q === '4bit' ? 0.5 : q === '8bit' ? 1 : 2      // 4-bit=½ byte, 8-bit=1, bf16/fp16=2
```
▸ Maps the base-model precision to storage cost. QLoRA's 4-bit quantization is the whole reason a
7B model fits on a 16 GB card — this function is where that shrink enters the VRAM math.

---

## `estimateVram(model, lora, train)` — peak VRAM, broken into parts

```ts
const GB = 1024 ** 3
const trainable = trainableParams(m, lora)

const base       = (m.params * bytesPerParam(train.quant)) / GB   // frozen weights
const optimizer  = (trainable * 8) / GB                           // AdamW: 2 fp32 moments = 8B
const gradients  = (trainable * 2) / GB                           // bf16 grads for adapter only
const activations= (batch * maxSeqLen * hidden * layers * 2 * 2.5) / GB   // fwd activations
const overhead   = 1.3                                             // CUDA context + kernels
const total      = base + optimizer + gradients + activations + overhead
```
▸ **base** — the frozen model weights held at training precision. Dominates for 7B/4-bit
(≈3.6 GB) and for bf16 (≈14.5 GB). Uses `m.params` (total) × bytes/param.
▸ **optimizer** — AdamW stores two fp32 moment tensors (m, v) per *trainable* parameter → 8 bytes
each. Because LoRA freezes the base, this is tiny (only the adapter counts). This is the second
reason LoRA saves memory.
▸ **gradients** — one bf16 gradient per trainable parameter (2 bytes), again adapter-only.
▸ **activations** — the forward-pass tensors kept for backprop. Modeled as
`batch × seqLen × hidden × layers × 2 bytes × 2.5`. The `2.5` fudge factor accounts for the
several activation tensors per layer under gradient checkpointing; it's calibrated so a
Mistral-7B/batch-1/seq-2048 run lands near the real ~1.5–2 GB.
▸ **overhead** — a flat 1.3 GB for the CUDA context, kernels, and allocator cache.
▸ The function returns each component rounded (via `round1`/`round2` at the bottom) plus `total`,
so the `<StackBar>` on the LoRA screen can render the breakdown, not just one number.

---

## `throughput(model, train)` — tokens/sec, step time

```ts
const BASE_TOK_PER_SEC = { 'llama-3.2-1b':5600, 'gemma-2-2b':3200, 'llama-3.2-3b':2900,
                           'phi-3-mini':2500, 'mistral-7b':1450 }

export function throughput(m, train) {
  const base = BASE_TOK_PER_SEC[m.id] ?? 4e12 / m.params        // fallback ∝ 1/params
  const quantFactor = train.quant==='4bit' ? 0.82 : train.quant==='8bit' ? 0.9 : 1
  const tokensPerSec  = base * quantFactor                      // quant adds dequant overhead
  const samplesPerSec = tokensPerSec / train.maxSeqLen
  const tokensPerStep = train.batchSize * train.gradAccum * train.maxSeqLen
  const secPerStep    = tokensPerStep / tokensPerSec
  return { tokensPerSec, samplesPerSec, secPerStep }
}
```
▸ `base` — a hand-tuned realistic single-GPU training throughput per model (bigger model → fewer
tok/s). The `?? 4e12/params` gives any future model a sane default.
▸ `quantFactor` — 4-bit is *slower* per token (dequantization cost), so throughput is scaled down
~18%. A subtle but real trade-off the sim honors.
▸ `tokensPerStep` — one optimizer step processes `batch × gradAccum` samples of `maxSeqLen`
tokens each.
▸ `secPerStep = tokensPerStep / tokensPerSec` — used by the tick loop to accumulate `simElapsed`
(the simulated wall-clock shown as elapsed/ETA).

---

## `totalSteps(rows, train)` — how long the run is

```ts
export function totalSteps(rows, train) {
  const effectiveBatch = train.batchSize * train.gradAccum
  return Math.max(1, Math.ceil((rows * train.epochs) / effectiveBatch))
}
```
▸ Classic formula: `(#examples × epochs) / effective_batch_size`, rounded up. This is the `total`
the tick loop walks toward and the `~N optimizer steps` comment in the generated `train.py`.

---

## `gpuFit(totalVram)` / `smallestFit(totalVram)` — "will it fit?"

```ts
export function gpuFit(totalVram) {
  return GPUS.map(g => ({ ...g,
    fits: totalVram <= g.vram * 0.95,               // 5% headroom
    utilization: Math.min(1.2, totalVram / g.vram), // for the bar width (capped at 120%)
  }))
}
export const smallestFit = (v) => gpuFit(v).find(g => g.fits)
```
▸ Compares the estimated peak against each reference GPU's VRAM with a 5% safety margin.
▸ `utilization` drives the fill width of the GPU-fit bars (green if it fits, red if not), capped
at 1.2 so an over-budget card still shows a sensible over-full bar.
▸ `smallestFit` returns the cheapest card that fits, shown as the "fits T4/A100" chip.

---

## `round1` / `round2` (bottom of file)

```ts
const round1 = n => Math.round(n*10)/10
const round2 = n => Math.round(n*100)/100
```
▸ Trivial rounding helpers so the VRAM breakdown shows clean 1–2 decimal numbers.

---

**Takeaway:** every headline number (trainable %, adapter MB, VRAM, tok/s, steps, GPU fit) is a
pure function of the config + real model dims. Next: the part that changes over *time* —
[`03-lib-schedule.md`](03-lib-schedule.md).
