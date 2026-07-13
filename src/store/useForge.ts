import { create } from 'zustand'
import type {
  Checkpoint,
  LoraConfig,
  MetricPoint,
  RunStatus,
  RunSummary,
  Step,
  TrainConfig,
} from '../types'
import { getModel } from '../data/models'
import { getDataset } from '../data/datasets'
import {
  estimateVram,
  throughput,
  totalSteps as calcTotalSteps,
  trainableParams,
} from '../lib/lora'
import {
  deriveDynamics,
  evalLossAt,
  lrAt,
  makeRng,
  stepGradNorm,
  stepLoss,
  type Dynamics,
} from '../lib/schedule'

export interface LogLine {
  id: number
  kind: 'system' | 'metric' | 'eval' | 'save' | 'success' | 'warn'
  text: string
}

const RUN_COLORS = ['#22d3ee', '#e879f9', '#a3e635', '#fbbf24', '#fb7185', '#818cf8']
const TICKS = 56 // sim resolution: number of logged points across a run

interface ForgeState {
  step: Step
  modelId: string
  datasetId: string
  lora: LoraConfig
  train: TrainConfig
  runName: string

  status: RunStatus
  currentStep: number
  total: number
  simElapsed: number // simulated training seconds
  simSpeed: number

  metrics: MetricPoint[]
  logs: LogLine[]
  gpuUtil: number
  gpuMem: number
  tokPerSec: number
  checkpoints: Checkpoint[]

  runs: RunSummary[]
  compareA: string | null
  compareB: string | null

  setStep: (s: Step) => void
  setModel: (id: string) => void
  setDataset: (id: string) => void
  setLora: (patch: Partial<LoraConfig>) => void
  setTrain: (patch: Partial<TrainConfig>) => void
  setSimSpeed: (s: number) => void
  setCompare: (which: 'A' | 'B', id: string) => void

  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  resetRun: () => void
}

// Interval + rng live outside React state (non-serializable).
let timer: ReturnType<typeof setInterval> | null = null
let rng: () => number = makeRng(42)
let dyn: Dynamics
let tickCount = 0
let logId = 0
let evalEvery = 6
let saveEvery = 12
let adapterMB = 0
let startedAt = 0

const defaultLora: LoraConfig = {
  r: 16,
  alpha: 32,
  dropout: 0.05,
  targets: ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
}

const defaultTrain: TrainConfig = {
  learningRate: 2e-4,
  epochs: 1,
  batchSize: 4,
  gradAccum: 4,
  maxSeqLen: 1024,
  warmupRatio: 0.03,
  scheduler: 'cosine',
  quant: '4bit',
  loggingSteps: 10,
  evalSteps: 50,
  saveSteps: 100,
  wandb: true,
  seed: 42,
}

function makeRunName(modelId: string, datasetId: string, r: number): string {
  const tag = Math.random().toString(36).slice(2, 6)
  return `${modelId}-${datasetId}-r${r}-${tag}`
}

function clearTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export const useForge = create<ForgeState>((set, get) => {
  const pushLog = (kind: LogLine['kind'], text: string) =>
    set((s) => ({ logs: [...s.logs.slice(-180), { id: logId++, kind, text }] }))

  const finalize = () => {
    clearTimer()
    const s = get()
    const last = s.metrics[s.metrics.length - 1]
    const model = getModel(s.modelId)
    const finalEval = evalLossAt(dyn, 1, makeRng(s.train.seed + 999))
    const finalLoss = last?.loss ?? dyn.Lmin
    const finalPpl = Math.exp(finalEval)
    pushLog('success', `Training complete · final loss ${finalLoss.toFixed(4)} · eval ${finalEval.toFixed(4)}`)
    pushLog('save', `Adapter saved → outputs/${s.runName} (${adapterMB.toFixed(1)} MB)`)

    const summary: RunSummary = {
      id: s.runName,
      name: s.runName,
      modelId: s.modelId,
      datasetId: s.datasetId,
      lora: s.lora,
      train: s.train,
      totalSteps: s.total,
      trainableParams: trainableParams(model, s.lora),
      totalParams: model.params,
      vramGB: estimateVram(model, s.lora, s.train).total,
      finalLoss,
      finalEval,
      finalPpl,
      checkpoints: s.checkpoints,
      color: RUN_COLORS[s.runs.length % RUN_COLORS.length],
      createdAt: Date.now(),
      durationSec: s.simElapsed,
    }
    set((st) => {
      const runs = [...st.runs.filter((r) => r.id !== summary.id), summary]
      return {
        status: 'completed',
        runs,
        compareA: st.compareA ?? runs[0]?.id ?? null,
        compareB: summary.id,
      }
    })
  }

  const tick = () => {
    const s = get()
    if (s.status !== 'running') return
    tickCount += 1
    const stepsPerTick = s.total / TICKS
    const step = Math.min(s.total, Math.round(tickCount * stepsPerTick))
    const p = step / s.total
    const model = getModel(s.modelId)
    const { secPerStep, tokensPerSec } = throughput(model, s.train)

    const lr = lrAt(step, s.total, Math.round(s.total * s.train.warmupRatio), s.train.learningRate, s.train.scheduler)
    const loss = stepLoss(dyn, step, s.total, rng)
    const gradNorm = stepGradNorm(dyn, p, rng)

    const point: MetricPoint = { step, loss, lr, gradNorm }

    // Eval events
    let doEval = tickCount % evalEvery === 0
    if (doEval) {
      point.evalLoss = evalLossAt(dyn, p, rng)
    }
    // Checkpoint events
    const doSave = tickCount % saveEvery === 0 && step < s.total

    const epoch = (p * s.train.epochs).toFixed(2)
    pushLog(
      'metric',
      `{'loss': ${loss.toFixed(4)}, 'grad_norm': ${gradNorm.toFixed(3)}, 'learning_rate': ${lr.toExponential(2)}, 'epoch': ${epoch}}`,
    )
    if (doEval) {
      const ppl = Math.exp(point.evalLoss!)
      pushLog('eval', `[eval] step ${step} · eval_loss ${point.evalLoss!.toFixed(4)} · perplexity ${ppl.toFixed(2)}`)
    }

    set((st) => {
      const metrics = [...st.metrics, point]
      const gpuUtil = doSave || doEval ? 42 + rng() * 18 : 88 + rng() * 11
      const vram = estimateVram(model, st.lora, st.train).total
      const gpuMem = vram * (0.96 + rng() * 0.05)
      const tokPerSec = tokensPerSec * (0.9 + rng() * 0.16)
      const simElapsed = st.simElapsed + secPerStep * stepsPerTick

      let checkpoints = st.checkpoints
      if (doSave) {
        const ckpt: Checkpoint = {
          id: `checkpoint-${step}`,
          step,
          loss,
          evalLoss: point.evalLoss ?? evalLossAt(dyn, p, makeRng(st.train.seed + step)),
          perplexity: Math.exp(point.evalLoss ?? evalLossAt(dyn, p, makeRng(st.train.seed + step))),
          adapterMB,
          createdAt: Date.now(),
        }
        checkpoints = [...st.checkpoints, ckpt]
      }
      return { currentStep: step, metrics, gpuUtil, gpuMem, tokPerSec, simElapsed, checkpoints }
    })

    if (doSave) pushLog('save', `Saving checkpoint → checkpoint-${step}`)
    if (step >= s.total) finalize()
  }

  return {
    step: 'model',
    modelId: 'llama-3.2-3b',
    datasetId: 'alpaca',
    lora: defaultLora,
    train: defaultTrain,
    runName: '',

    status: 'idle',
    currentStep: 0,
    total: 0,
    simElapsed: 0,
    simSpeed: 1,

    metrics: [],
    logs: [],
    gpuUtil: 0,
    gpuMem: 0,
    tokPerSec: 0,
    checkpoints: [],

    runs: [],
    compareA: null,
    compareB: null,

    setStep: (s) => set({ step: s }),
    setModel: (id) => set({ modelId: id }),
    setDataset: (id) => set({ datasetId: id }),
    setLora: (patch) => set((s) => ({ lora: { ...s.lora, ...patch } })),
    setTrain: (patch) => set((s) => ({ train: { ...s.train, ...patch } })),
    setSimSpeed: (speed) => {
      set({ simSpeed: speed })
      if (get().status === 'running') {
        clearTimer()
        timer = setInterval(tick, 640 / speed)
      }
    },
    setCompare: (which, id) => set(which === 'A' ? { compareA: id } : { compareB: id }),

    start: () => {
      const s = get()
      const model = getModel(s.modelId)
      const dataset = getDataset(s.datasetId)
      const total = calcTotalSteps(dataset.rows, s.train)
      const runName = makeRunName(s.modelId, s.datasetId, s.lora.r)
      const tp = trainableParams(model, s.lora)

      rng = makeRng(s.train.seed)
      dyn = deriveDynamics(model, dataset.id, dataset.rows, s.lora, s.train)
      tickCount = 0
      adapterMB = (tp * 2) / 1e6
      evalEvery = Math.max(2, Math.round((s.train.evalSteps / total) * TICKS))
      saveEvery = Math.max(3, Math.round((s.train.saveSteps / total) * TICKS))
      startedAt = Date.now()
      logId = 0

      set({
        status: 'running',
        step: 'train',
        currentStep: 0,
        total,
        runName,
        simElapsed: 0,
        metrics: [],
        logs: [],
        checkpoints: [],
        gpuUtil: 0,
        gpuMem: 0,
        tokPerSec: 0,
      })

      pushLog('system', `Forge trainer · run "${runName}"`)
      pushLog('system', `Loading ${model.hf} · ${(model.params / 1e9).toFixed(2)}B params · ${s.train.quant === 'none' ? 'bf16' : s.train.quant + ' (QLoRA)'}`)
      pushLog('system', `Loading checkpoint shards: 100%|██████████| ready`)
      pushLog('system', `Loading dataset ${dataset.hf} · ${dataset.rows.toLocaleString()} rows`)
      pushLog('system', `trainable params: ${tp.toLocaleString()} || all params: ${model.params.toLocaleString()} || trainable%: ${((tp / model.params) * 100).toFixed(4)}`)
      pushLog('system', `>>> Starting training for ${total.toLocaleString()} steps (${s.train.epochs} epoch${s.train.epochs > 1 ? 's' : ''})`)

      clearTimer()
      timer = setInterval(tick, 640 / s.simSpeed)
    },

    pause: () => {
      if (get().status !== 'running') return
      clearTimer()
      set({ status: 'paused' })
      pushLog('warn', '>>> Training paused by user')
    },

    resume: () => {
      if (get().status !== 'paused') return
      set({ status: 'running' })
      pushLog('system', '>>> Resuming training')
      clearTimer()
      timer = setInterval(tick, 640 / get().simSpeed)
    },

    stop: () => {
      if (get().status === 'running' || get().status === 'paused') {
        pushLog('warn', '>>> Training stopped early — finalizing adapter')
        finalize()
      }
    },

    resetRun: () => {
      clearTimer()
      tickCount = 0
      void startedAt
      set({
        status: 'idle',
        step: 'train',
        currentStep: 0,
        total: 0,
        simElapsed: 0,
        metrics: [],
        logs: [],
        checkpoints: [],
        gpuUtil: 0,
        gpuMem: 0,
        tokPerSec: 0,
      })
    },
  }
})
