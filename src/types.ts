export type Scheduler = 'cosine' | 'linear' | 'constant'
export type Quant = 'none' | '8bit' | '4bit'
export type TargetModule =
  | 'q_proj'
  | 'k_proj'
  | 'v_proj'
  | 'o_proj'
  | 'gate_proj'
  | 'up_proj'
  | 'down_proj'

export interface ModelArch {
  id: string
  name: string
  family: string
  hf: string // HuggingFace repo id
  params: number // total parameters
  hidden: number
  intermediate: number
  layers: number
  heads: number
  kvHeads: number
  vocab: number
  seqLen: number
  license: string
  blurb: string
  accent: 'cyan' | 'magenta' | 'lime' | 'amber'
}

export interface DatasetInfo {
  id: string
  name: string
  hf: string
  rows: number
  avgTokens: number
  task: string
  format: 'alpaca' | 'chatml' | 'sharegpt' | 'text' | 'preference'
  blurb: string
  sample: { instruction?: string; input?: string; output: string }
}

export interface LoraConfig {
  r: number
  alpha: number
  dropout: number
  targets: TargetModule[]
}

export interface TrainConfig {
  learningRate: number
  epochs: number
  batchSize: number
  gradAccum: number
  maxSeqLen: number
  warmupRatio: number
  scheduler: Scheduler
  quant: Quant
  loggingSteps: number
  evalSteps: number
  saveSteps: number
  wandb: boolean
  seed: number
}

export interface MetricPoint {
  step: number
  loss: number
  lr: number
  gradNorm: number
  evalLoss?: number
}

export interface Checkpoint {
  id: string
  step: number
  loss: number
  evalLoss: number
  perplexity: number
  adapterMB: number
  createdAt: number
}

export type RunStatus = 'idle' | 'running' | 'paused' | 'completed'

export interface RunSummary {
  id: string
  name: string
  modelId: string
  datasetId: string
  lora: LoraConfig
  train: TrainConfig
  totalSteps: number
  trainableParams: number
  totalParams: number
  vramGB: number
  finalLoss: number
  finalEval: number
  finalPpl: number
  checkpoints: Checkpoint[]
  color: string
  createdAt: number
  durationSec: number
}

export type Step =
  | 'model'
  | 'dataset'
  | 'lora'
  | 'train'
  | 'evaluate'
  | 'compare'
  | 'quantize'
  | 'deploy'
  | 'export'
