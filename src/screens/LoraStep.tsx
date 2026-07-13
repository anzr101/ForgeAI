import { useForge } from '../store/useForge'
import { getModel } from '../data/models'
import { getDataset } from '../data/datasets'
import { SectionTitle, Panel, Field, Segmented, Slider, Toggle, Chip, NeonButton } from '../components/ui/primitives'
import { StackBar } from '../components/charts'
import { AdapterVisualizer } from '../components/AdapterVisualizer'
import { StepNav } from '../components/layout/StepNav'
import { estimateVram, gpuFit, throughput, totalSteps, trainableParams } from '../lib/lora'
import { fmtBytes, fmtDuration, fmtInt, fmtParams, fmtPct, clsx } from '../lib/format'
import type { Quant, Scheduler, TargetModule } from '../types'
import { IconFlame } from '../components/icons'

const ALL_TARGETS: TargetModule[] = ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
const PRESETS: { label: string; targets: TargetModule[] }[] = [
  { label: 'Q/V only', targets: ['q_proj', 'v_proj'] },
  { label: 'Attention', targets: ['q_proj', 'k_proj', 'v_proj', 'o_proj'] },
  { label: 'All linear', targets: ALL_TARGETS },
]

export function LoraStep() {
  const { modelId, datasetId, lora, train, setLora, setTrain, start } = useForge()
  const model = getModel(modelId)
  const dataset = getDataset(datasetId)

  const tp = trainableParams(model, lora)
  const vram = estimateVram(model, lora, train)
  const steps = totalSteps(dataset.rows, train)
  const { secPerStep, tokensPerSec } = throughput(model, train)
  const eta = secPerStep * steps
  const adapterMB = (tp * 2) / 1e6
  const fits = gpuFit(vram.total)
  const smallest = fits.find((g) => g.fits)

  const toggleTarget = (t: TargetModule) => {
    const has = lora.targets.includes(t)
    const next = has ? lora.targets.filter((x) => x !== t) : [...lora.targets, t]
    if (next.length) setLora({ targets: next })
  }

  const maxVram = Math.max(24, Math.ceil(vram.total * 1.15))

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle
        eyebrow="Step 03 · Adapter & hyperparameters"
        title="Configure LoRA / QLoRA"
        desc="Every knob updates the live estimates on the right — trainable parameters, VRAM and throughput are recomputed from real formulas as you tune."
      />

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <span className="label neon-magenta">LoRA adapter</span>
              <div className="flex gap-1.5">
                {PRESETS.map((p) => (
                  <Chip key={p.label} accent="magenta" active={p.targets.length === lora.targets.length && p.targets.every((t) => lora.targets.includes(t))} onClick={() => setLora({ targets: p.targets })}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Rank (r)" hint="capacity">
                <Slider value={lora.r} min={4} max={128} step={4} onChange={(v) => setLora({ r: v })} />
              </Field>
              <Field label="Alpha" hint={`scale ${(lora.alpha / lora.r).toFixed(1)}×`}>
                <Slider value={lora.alpha} min={8} max={256} step={8} onChange={(v) => setLora({ alpha: v })} />
              </Field>
              <Field label="Dropout">
                <Slider value={lora.dropout} min={0} max={0.2} step={0.01} onChange={(v) => setLora({ dropout: v })} format={(v) => v.toFixed(2)} />
              </Field>
            </div>
            <div className="mt-5">
              <div className="label mb-2">Target modules</div>
              <div className="flex flex-wrap gap-2">
                {ALL_TARGETS.map((t) => (
                  <Chip key={t} accent="magenta" active={lora.targets.includes(t)} onClick={() => toggleTarget(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <span className="label neon-cyan">Training hyperparameters</span>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Quantization" hint="QLoRA = 4-bit base">
                <Segmented<Quant>
                  value={train.quant}
                  onChange={(v) => setTrain({ quant: v })}
                  options={[
                    { value: 'none', label: 'bf16' },
                    { value: '8bit', label: '8-bit' },
                    { value: '4bit', label: '4-bit' },
                  ]}
                />
              </Field>
              <Field label="LR scheduler">
                <Segmented<Scheduler>
                  value={train.scheduler}
                  onChange={(v) => setTrain({ scheduler: v })}
                  options={[
                    { value: 'cosine', label: 'cosine' },
                    { value: 'linear', label: 'linear' },
                    { value: 'constant', label: 'const' },
                  ]}
                />
              </Field>
              <Field label="Learning rate">
                <Segmented<string>
                  value={String(train.learningRate)}
                  onChange={(v) => setTrain({ learningRate: parseFloat(v) })}
                  options={[
                    { value: '0.00005', label: '5e-5' },
                    { value: '0.0001', label: '1e-4' },
                    { value: '0.0002', label: '2e-4' },
                    { value: '0.0003', label: '3e-4' },
                    { value: '0.0005', label: '5e-4' },
                  ]}
                />
              </Field>
              <Field label="Max sequence length">
                <Segmented<string>
                  value={String(train.maxSeqLen)}
                  onChange={(v) => setTrain({ maxSeqLen: parseInt(v) })}
                  options={[
                    { value: '512', label: '512' },
                    { value: '1024', label: '1024' },
                    { value: '2048', label: '2048' },
                    { value: '4096', label: '4096' },
                  ]}
                />
              </Field>
              <Field label="Batch size / device">
                <Segmented<string>
                  value={String(train.batchSize)}
                  onChange={(v) => setTrain({ batchSize: parseInt(v) })}
                  options={[1, 2, 4, 8, 16].map((n) => ({ value: String(n), label: String(n) }))}
                />
              </Field>
              <Field label="Grad accumulation" hint={`eff. batch ${train.batchSize * train.gradAccum}`}>
                <Segmented<string>
                  value={String(train.gradAccum)}
                  onChange={(v) => setTrain({ gradAccum: parseInt(v) })}
                  options={[1, 2, 4, 8, 16].map((n) => ({ value: String(n), label: String(n) }))}
                />
              </Field>
              <Field label="Epochs">
                <Slider value={train.epochs} min={1} max={5} step={1} onChange={(v) => setTrain({ epochs: v })} format={(v) => `${v} epoch${v > 1 ? 's' : ''}`} />
              </Field>
              <Field label="Warmup ratio">
                <Slider value={train.warmupRatio} min={0} max={0.1} step={0.01} onChange={(v) => setTrain({ warmupRatio: v })} format={(v) => `${(v * 100).toFixed(0)}%`} />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
              <div className="flex items-center gap-2.5">
                <Toggle checked={train.wandb} onChange={(v) => setTrain({ wandb: v })} accent="amber" />
                <span className="text-sm text-slate-300">Log to Weights &amp; Biases</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="label">seed</span>
                <span className="font-mono text-sm text-slate-200">{train.seed}</span>
                <button onClick={() => setTrain({ seed: Math.floor(Math.random() * 9999) })} className="chip hover:border-cyan/50 hover:text-cyan">
                  🎲 randomize
                </button>
              </div>
            </div>
          </Panel>

          <AdapterVisualizer model={model} lora={lora} />
        </div>

        {/* Live estimates */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel glow="cyan">
            <span className="label neon-cyan">Live estimate</span>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Trainable params</div>
                <div className="font-mono text-2xl font-extrabold text-cyan" style={{ textShadow: '0 0 16px #22d3ee66' }}>{fmtParams(tp)}</div>
                <div className="text-[11px] text-slate-500">{fmtPct(tp / model.params, 3)} of {fmtParams(model.params)}</div>
              </div>
              <div>
                <div className="label mb-1">Adapter size</div>
                <div className="font-mono text-2xl font-extrabold text-magenta" style={{ textShadow: '0 0 16px #e879f966' }}>{fmtBytes(adapterMB)}</div>
                <div className="text-[11px] text-slate-500">bf16 · shippable</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="label">Peak VRAM ≈ {vram.total} GB</span>
                {smallest ? (
                  <span className="chip text-[10px]" style={{ color: '#a3e635', borderColor: '#a3e63555' }}>fits {smallest.name}</span>
                ) : (
                  <span className="chip text-[10px]" style={{ color: '#fb7185', borderColor: '#fb718555' }}>needs multi-GPU</span>
                )}
              </div>
              <StackBar
                total={vram.total}
                max={maxVram}
                segments={[
                  { label: 'base', value: vram.base, color: '#22d3ee' },
                  { label: 'optim', value: vram.optimizer, color: '#e879f9' },
                  { label: 'grads', value: vram.gradients, color: '#a3e635' },
                  { label: 'activations', value: vram.activations, color: '#fbbf24' },
                  { label: 'overhead', value: vram.overhead, color: '#475569' },
                ]}
              />
            </div>
          </Panel>

          <Panel>
            <span className="label">Run plan</span>
            <div className="mt-3 space-y-2 font-mono text-[13px]">
              <Row k="optimizer steps" v={fmtInt(steps)} />
              <Row k="effective batch" v={String(train.batchSize * train.gradAccum)} />
              <Row k="throughput" v={`${Math.round(tokensPerSec).toLocaleString()} tok/s`} />
              <Row k="est. wall-clock" v={fmtDuration(eta)} accent="#a3e635" />
              <Row k="dataset" v={`${fmtInt(dataset.rows)} rows`} />
            </div>
          </Panel>

          <Panel>
            <span className="label mb-3 block">GPU fit</span>
            <div className="space-y-1.5">
              {fits.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <span className={clsx('w-24 shrink-0 text-[12px]', g.fits ? 'text-slate-300' : 'text-slate-600')}>{g.name}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-void/70">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{ width: `${Math.min(100, g.utilization * 100)}%`, background: g.fits ? '#a3e635' : '#fb7185' }}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-[11px] text-slate-500">{g.vram}G</span>
                </div>
              ))}
            </div>
          </Panel>

          <NeonButton className="w-full" size="lg" accent="lime" onClick={start}>
            <IconFlame width={18} height={18} /> Start training run
          </NeonButton>
        </div>
      </div>

      <StepNav back="dataset" />
    </div>
  )
}

function Row({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      <span style={{ color: accent ?? '#e6ecff' }}>{v}</span>
    </div>
  )
}
