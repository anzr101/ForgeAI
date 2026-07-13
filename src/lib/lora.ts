import type { LoraConfig, ModelArch, Quant, TargetModule, TrainConfig } from '../types'
import { GPUS } from '../data/gpus'

// ── Per-module (in, out) dimensions for one decoder layer ────────────────────
// Derived from the model's real hidden/intermediate/head geometry.
export function moduleDims(m: ModelArch): Record<TargetModule, [number, number]> {
  const headDim = m.hidden / m.heads
  const kvOut = m.kvHeads * headDim // grouped-query attention shrinks k/v
  return {
    q_proj: [m.hidden, m.hidden],
    k_proj: [m.hidden, kvOut],
    v_proj: [m.hidden, kvOut],
    o_proj: [m.hidden, m.hidden],
    gate_proj: [m.hidden, m.intermediate],
    up_proj: [m.hidden, m.intermediate],
    down_proj: [m.intermediate, m.hidden],
  }
}

// ── Real LoRA trainable-parameter count ──────────────────────────────────────
// Each adapted linear layer W(out,in) gains A(r×in)+B(out×r) = r·(in+out) params.
export function trainableParams(m: ModelArch, lora: LoraConfig): number {
  const dims = moduleDims(m)
  let perLayer = 0
  for (const t of lora.targets) {
    const [inDim, outDim] = dims[t]
    perLayer += lora.r * (inDim + outDim)
  }
  return perLayer * m.layers
}

export const bytesPerParam = (q: Quant): number =>
  q === '4bit' ? 0.5 : q === '8bit' ? 1 : 2

// ── VRAM estimate with a component breakdown (GB) ────────────────────────────
export interface VramBreakdown {
  base: number
  optimizer: number
  gradients: number
  activations: number
  overhead: number
  total: number
}

export function estimateVram(
  m: ModelArch,
  lora: LoraConfig,
  train: TrainConfig,
): VramBreakdown {
  const GB = 1024 ** 3
  const trainable = trainableParams(m, lora)

  // Frozen base weights, held at the training precision (4-bit for QLoRA).
  const base = (m.params * bytesPerParam(train.quant)) / GB
  // AdamW keeps two fp32 moments per trainable parameter (8 bytes).
  const optimizer = (trainable * 8) / GB
  // Gradients for the adapter only, in bf16 (2 bytes).
  const gradients = (trainable * 2) / GB
  // Activations with gradient checkpointing ~ batch·seq·hidden·layers.
  const activations =
    (train.batchSize * train.maxSeqLen * m.hidden * m.layers * 2 * 2.5) / GB
  // CUDA context + kernels + cache.
  const overhead = 1.3

  const total = base + optimizer + gradients + activations + overhead
  return {
    base: round1(base),
    optimizer: round2(optimizer),
    gradients: round2(gradients),
    activations: round1(activations),
    overhead,
    total: round1(total),
  }
}

// ── Reference training throughput (tokens/sec on a mid-tier GPU) ─────────────
const BASE_TOK_PER_SEC: Record<string, number> = {
  'llama-3.2-1b': 5600,
  'gemma-2-2b': 3200,
  'llama-3.2-3b': 2900,
  'phi-3-mini': 2500,
  'mistral-7b': 1450,
}

export function throughput(m: ModelArch, train: TrainConfig) {
  const base = BASE_TOK_PER_SEC[m.id] ?? 4e12 / m.params
  const quantFactor = train.quant === '4bit' ? 0.82 : train.quant === '8bit' ? 0.9 : 1
  const tokensPerSec = base * quantFactor
  const samplesPerSec = tokensPerSec / train.maxSeqLen
  const tokensPerStep = train.batchSize * train.gradAccum * train.maxSeqLen
  const secPerStep = tokensPerStep / tokensPerSec
  return { tokensPerSec, samplesPerSec, secPerStep }
}

// ── Total optimizer steps for the run ────────────────────────────────────────
export function totalSteps(rows: number, train: TrainConfig): number {
  const effectiveBatch = train.batchSize * train.gradAccum
  return Math.max(1, Math.ceil((rows * train.epochs) / effectiveBatch))
}

// ── "Will it fit?" across reference GPUs ─────────────────────────────────────
export function gpuFit(totalVram: number) {
  return GPUS.map((g) => ({
    ...g,
    fits: totalVram <= g.vram * 0.95,
    utilization: Math.min(1.2, totalVram / g.vram),
  }))
}

export function smallestFit(totalVram: number) {
  return gpuFit(totalVram).find((g) => g.fits)
}

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100
