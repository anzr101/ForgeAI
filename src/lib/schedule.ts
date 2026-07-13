import type { LoraConfig, ModelArch, Scheduler, TrainConfig } from '../types'
import { trainableParams } from './lora'

// ── Deterministic PRNG (mulberry32) so a seed fully reproduces a run ─────────
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gauss(rng: () => number): number {
  // Box–Muller
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ── Learning-rate schedule (matches HF get_scheduler behaviour) ──────────────
export function lrAt(
  step: number,
  total: number,
  warmup: number,
  peak: number,
  scheduler: Scheduler,
): number {
  if (step < warmup && warmup > 0) return peak * (step / warmup)
  const progress = total > warmup ? (step - warmup) / (total - warmup) : 1
  const p = Math.min(1, Math.max(0, progress))
  switch (scheduler) {
    case 'cosine':
      return peak * 0.5 * (1 + Math.cos(Math.PI * p))
    case 'linear':
      return peak * (1 - p)
    case 'constant':
    default:
      return peak
  }
}

// ── Per-run dynamics derived from the actual configuration ───────────────────
const DATASET_DIFFICULTY: Record<string, number> = {
  alpaca: 0.0,
  dolly: 0.02,
  oasst1: 0.05,
  gsm8k: 0.18,
  codealpaca: 0.1,
  ultrachat: 0.06,
}

export interface Dynamics {
  L0: number
  Lmin: number
  k: number
  noise: number
  evalGap: number
  gradNorm0: number
  instability: number // chance of a loss spike, driven by learning rate
}

export function deriveDynamics(
  model: ModelArch,
  datasetId: string,
  datasetRows: number,
  lora: LoraConfig,
  train: TrainConfig,
): Dynamics {
  const diff = DATASET_DIFFICULTY[datasetId] ?? 0.05
  const billions = model.params / 1e9

  // Larger, instruction-tuned models start at a lower loss.
  const L0 = 2.35 - 0.08 * Math.log(billions) + diff * 1.4

  // Adapter capacity: more trainable params relative to the model → lower floor.
  const capacity = trainableParams(model, lora) / model.params // ~0.001–0.02
  const capacityScore = Math.min(0.18, capacity * 12)

  // Learning-rate effectiveness peaks near 2e-4 for LoRA.
  const lrScore = 1 - Math.min(1, Math.abs(Math.log(train.learningRate / 2e-4)) / 2.2)

  const Lmin = Math.max(
    0.35,
    L0 * (0.62 - capacityScore - 0.12 * lrScore + diff * 0.5),
  )

  // Decay speed: more data-passes and a good LR converge faster.
  const k = (2.4 + train.epochs * 0.9) * (0.6 + 0.6 * lrScore)

  // Small datasets trained for many epochs overfit → eval loss drifts up.
  const overfit = Math.max(0, train.epochs - 1) * (20_000 / Math.max(datasetRows, 1500)) * 0.02
  const evalGap = 0.04 + Math.min(0.35, overfit)

  // Too-high LR destabilises training.
  const instability = train.learningRate > 4e-4 ? Math.min(0.4, (train.learningRate - 4e-4) * 1200) : 0.015

  return {
    L0: round3(L0),
    Lmin: round3(Lmin),
    k,
    noise: 0.035 + diff * 0.12,
    evalGap,
    gradNorm0: 0.9 + diff * 0.8,
    instability,
  }
}

// Smoothed training loss at a given progress point (0..1).
export function smoothLoss(dyn: Dynamics, progress: number): number {
  return dyn.Lmin + (dyn.L0 - dyn.Lmin) * Math.exp(-dyn.k * progress)
}

// Noisy per-step training loss, optionally spiking when unstable.
export function stepLoss(
  dyn: Dynamics,
  step: number,
  total: number,
  rng: () => number,
): number {
  const p = step / total
  const base = smoothLoss(dyn, p)
  const noise = gauss(rng) * dyn.noise * (0.45 + 0.55 * (1 - p))
  const spike = rng() < dyn.instability ? rng() * dyn.noise * 6 : 0
  return Math.max(0.05, base + noise + spike)
}

export function stepGradNorm(dyn: Dynamics, progress: number, rng: () => number): number {
  const decay = dyn.gradNorm0 * (0.35 + 0.65 * Math.exp(-2.2 * progress))
  return Math.max(0.02, decay + gauss(rng) * 0.06)
}

export function evalLossAt(dyn: Dynamics, progress: number, rng: () => number): number {
  const base = smoothLoss(dyn, progress)
  return Math.max(0.1, base * (1 + dyn.evalGap * progress) + gauss(rng) * 0.02)
}

const round3 = (n: number) => Math.round(n * 1000) / 1000
