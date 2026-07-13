import { motion } from 'framer-motion'
import { useForge } from '../store/useForge'
import { getModel } from '../data/models'
import { getDataset } from '../data/datasets'
import { MetricChart, GpuMeter, RadialGauge } from '../components/charts'
import { LogConsole } from '../components/LogConsole'
import { Panel, NeonButton, Segmented, Stat } from '../components/ui/primitives'
import { estimateVram, throughput } from '../lib/lora'
import { fmtDuration, fmtLr, fmtInt } from '../lib/format'
import { IconPlay, IconPause, IconStop, IconArrowRight, IconFlame } from '../components/icons'

export function TrainStep() {
  const s = useForge()
  const model = getModel(s.modelId)
  const dataset = getDataset(s.datasetId)
  const last = s.metrics[s.metrics.length - 1]
  const lastEval = [...s.metrics].reverse().find((m) => m.evalLoss != null)?.evalLoss
  const vram = estimateVram(model, s.lora, s.train)
  const { secPerStep } = throughput(model, s.train)
  const progress = s.total ? s.currentStep / s.total : 0
  const epoch = s.total ? (progress * s.train.epochs).toFixed(2) : '0.00'
  const etaRemaining = secPerStep * (s.total - s.currentStep)

  // Idle: nothing has been run yet
  if (s.status === 'idle' && s.metrics.length === 0) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center text-center">
        <div>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg,#22d3ee,#e879f9)', boxShadow: '0 0 40px -8px #22d3ee' }}
          >
            <IconFlame width={40} height={40} className="text-void" />
          </motion.div>
          <h2 className="text-2xl font-bold">Ready to forge</h2>
          <p className="mx-auto mt-2 max-w-sm text-slate-400">
            {model.name} · {dataset.name} · r={s.lora.r} · {s.train.quant === 'none' ? 'LoRA' : 'QLoRA ' + s.train.quant}. Kick off the run to watch it train live.
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <NeonButton size="lg" accent="lime" onClick={s.start}>
              <IconPlay width={18} height={18} /> Start training
            </NeonButton>
            <NeonButton size="lg" variant="ghost" onClick={() => s.setStep('lora')}>
              Adjust config
            </NeonButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header + controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Training</h2>
            <span className="chip font-mono text-[10px]">{s.runName}</span>
          </div>
          <p className="text-sm text-slate-500">{model.name} · {dataset.name} · seed {s.train.seed}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="label mr-1">speed</span>
          <Segmented<string>
            value={String(s.simSpeed)}
            onChange={(v) => s.setSimSpeed(parseFloat(v))}
            options={[
              { value: '0.5', label: '0.5×' },
              { value: '1', label: '1×' },
              { value: '2', label: '2×' },
              { value: '4', label: '4×' },
            ]}
          />
          {s.status === 'running' && (
            <>
              <NeonButton accent="amber" variant="ghost" onClick={s.pause}><IconPause width={15} height={15} /> Pause</NeonButton>
              <NeonButton accent="rose" variant="ghost" onClick={s.stop}><IconStop width={15} height={15} /> Stop</NeonButton>
            </>
          )}
          {s.status === 'paused' && (
            <>
              <NeonButton accent="lime" onClick={s.resume}><IconPlay width={15} height={15} /> Resume</NeonButton>
              <NeonButton accent="rose" variant="ghost" onClick={s.stop}><IconStop width={15} height={15} /> Stop</NeonButton>
            </>
          )}
          {s.status === 'completed' && (
            <>
              <NeonButton accent="cyan" onClick={() => s.setStep('evaluate')}>Evaluate <IconArrowRight width={15} height={15} /></NeonButton>
              <NeonButton variant="ghost" accent="magenta" onClick={() => { s.resetRun(); s.setStep('lora') }}>New run</NeonButton>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-slate-500">
          <span>step {fmtInt(s.currentStep)} / {fmtInt(s.total)}</span>
          <span>{(progress * 100).toFixed(1)}% · epoch {epoch}</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-void ring-1 ring-line">
          <motion.div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ background: 'linear-gradient(90deg,#22d3ee,#e879f9)', boxShadow: '0 0 14px #22d3ee' }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat label="Train loss" value={last ? last.loss.toFixed(4) : '—'} accent="cyan" sub={last ? `grad ${last.gradNorm.toFixed(2)}` : ''} />
        <Stat label="Eval loss" value={lastEval ? lastEval.toFixed(4) : '—'} accent="lime" sub={lastEval ? `ppl ${Math.exp(lastEval).toFixed(1)}` : 'pending'} />
        <Stat label="Learning rate" value={last ? fmtLr(last.lr) : '—'} accent="magenta" sub={s.train.scheduler} />
        <Stat label="Throughput" value={s.tokPerSec ? Math.round(s.tokPerSec).toLocaleString() : '—'} accent="amber" sub="tok/s" />
        <Stat label="VRAM" value={`${s.gpuMem ? s.gpuMem.toFixed(1) : vram.total}`} accent="cyan" sub={`/ ${vram.total} GB peak`} />
        <Stat label={s.status === 'completed' ? 'Elapsed' : 'ETA'} value={s.status === 'completed' ? fmtDuration(s.simElapsed) : fmtDuration(etaRemaining)} accent="lime" sub={`sim · ${fmtDuration(s.simElapsed)} in`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Loss chart */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <span className="label neon-cyan">Loss curve</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-cyan"><span className="h-1.5 w-3 rounded-full bg-cyan" /> train</span>
              <span className="flex items-center gap-1.5 text-lime"><span className="h-1.5 w-3 rounded-full bg-lime" /> eval</span>
            </div>
          </div>
          <MetricChart points={s.metrics} height={260} />
        </Panel>

        {/* GPU */}
        <Panel>
          <span className="label neon-magenta">GPU · {model.id.includes('mistral') || model.id.includes('phi') ? 'A100 40GB' : 'T4 16GB'}</span>
          <div className="mt-3 flex items-center justify-around">
            <RadialGauge value={s.gpuUtil / 100} label={`${Math.round(s.gpuUtil)}%`} sub="util" color="#22d3ee" size={110} />
            <RadialGauge value={s.gpuMem / vram.total || 0} label={`${Math.round(((s.gpuMem || 0) / vram.total) * 100)}%`} sub="mem" color="#e879f9" size={110} />
          </div>
          <div className="mt-4">
            <div className="label mb-2">Compute activity</div>
            <GpuMeter util={s.gpuUtil} />
          </div>
        </Panel>
      </div>

      {/* Logs */}
      <div className="mt-4">
        <LogConsole logs={s.logs} height={240} />
      </div>

      {s.status === 'completed' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-lime/30 bg-lime/5 p-5"
        >
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-lime/20 text-lime">✓</span>
          <div>
            <div className="font-bold text-slate-100">Run complete — adapter saved</div>
            <div className="text-sm text-slate-400">Final loss {last?.loss.toFixed(4)} · {s.checkpoints.length} checkpoints · {fmtDuration(s.simElapsed)} simulated</div>
          </div>
          <div className="ml-auto flex gap-2">
            <NeonButton accent="lime" onClick={() => s.setStep('evaluate')}>Evaluate <IconArrowRight width={15} height={15} /></NeonButton>
            <NeonButton variant="ghost" onClick={() => s.setStep('export')}>Export code</NeonButton>
          </div>
        </motion.div>
      )}
    </div>
  )
}
