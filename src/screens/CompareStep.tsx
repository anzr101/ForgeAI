import { useForge } from '../store/useForge'
import { getModel } from '../data/models'
import { getDataset } from '../data/datasets'
import { SectionTitle, Panel, NeonButton } from '../components/ui/primitives'
import { fmtDuration, fmtParams, clsx } from '../lib/format'
import type { RunSummary } from '../types'
import { IconCompare } from '../components/icons'

function OverlayChart({ runs }: { runs: RunSummary[] }) {
  const W = 620
  const H = 200
  const padL = 40
  const padR = 14
  const padT = 14
  const padB = 20
  const series = runs.filter((r) => r.checkpoints.length > 1)
  if (series.length === 0)
    return <div className="grid h-[200px] place-items-center font-mono text-xs text-slate-600">no checkpoint curves to overlay</div>

  const allLoss = series.flatMap((r) => r.checkpoints.map((c) => c.loss))
  let min = Math.min(...allLoss)
  let max = Math.max(...allLoss)
  const sp = max - min || 1
  min -= sp * 0.1
  max += sp * 0.1

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {[0, 0.5, 1].map((f) => {
        const gv = min + f * (max - min)
        const y = padT + (1 - f) * (H - padT - padB)
        return (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#1b2233" />
            <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-600" style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}>{gv.toFixed(2)}</text>
          </g>
        )
      })}
      {series.map((r) => {
        const n = r.checkpoints.length
        const pts = r.checkpoints
          .map((c, i) => {
            const x = padL + (i / (n - 1)) * (W - padL - padR)
            const y = padT + (1 - (c.loss - min) / (max - min)) * (H - padT - padB)
            return `${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')
        return <polyline key={r.id} points={pts} fill="none" stroke={r.color} strokeWidth={2} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${r.color})` }} />
      })}
    </svg>
  )
}

export function CompareStep() {
  const { runs, compareA, compareB, setCompare, setStep } = useForge()

  if (runs.length === 0) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
        <div>
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-panel-2 text-slate-500"><IconCompare width={28} height={28} /></span>
          <h2 className="text-xl font-bold">Nothing to compare yet</h2>
          <p className="mt-2 text-slate-400">Run at least two experiments to diff their curves and configs side-by-side.</p>
          <div className="mt-5"><NeonButton onClick={() => setStep('lora')}>Configure a run</NeonButton></div>
        </div>
      </div>
    )
  }

  const A = runs.find((r) => r.id === compareA)
  const B = runs.find((r) => r.id === compareB)
  const selected = [A, B].filter(Boolean) as RunSummary[]

  const diffRows: { k: string; a?: string; b?: string }[] = A && B ? [
    { k: 'model', a: getModel(A.modelId).name, b: getModel(B.modelId).name },
    { k: 'dataset', a: getDataset(A.datasetId).name, b: getDataset(B.datasetId).name },
    { k: 'rank (r)', a: String(A.lora.r), b: String(B.lora.r) },
    { k: 'alpha', a: String(A.lora.alpha), b: String(B.lora.alpha) },
    { k: 'targets', a: String(A.lora.targets.length), b: String(B.lora.targets.length) },
    { k: 'quant', a: A.train.quant, b: B.train.quant },
    { k: 'lr', a: A.train.learningRate.toExponential(1), b: B.train.learningRate.toExponential(1) },
    { k: 'epochs', a: String(A.train.epochs), b: String(B.train.epochs) },
    { k: 'trainable', a: fmtParams(A.trainableParams), b: fmtParams(B.trainableParams) },
    { k: 'peak VRAM', a: `${A.vramGB} GB`, b: `${B.vramGB} GB` },
    { k: 'final loss', a: A.finalLoss.toFixed(4), b: B.finalLoss.toFixed(4) },
    { k: 'final eval', a: A.finalEval.toFixed(4), b: B.finalEval.toFixed(4) },
    { k: 'perplexity', a: A.finalPpl.toFixed(2), b: B.finalPpl.toFixed(2) },
    { k: 'duration', a: fmtDuration(A.durationSec), b: fmtDuration(B.durationSec) },
  ] : []

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle eyebrow="Step 05 · Experiment tracking" title="Compare runs" desc="A Weights & Biases-style ledger of every experiment this session. Assign two runs to A/B to overlay their loss curves and diff their configs." />

      {/* Runs table */}
      <Panel className="mb-4 !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left font-mono text-[12px]">
            <thead className="bg-panel-2/60 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">run</th>
                <th className="px-3 py-2.5">model</th>
                <th className="px-3 py-2.5">r</th>
                <th className="px-3 py-2.5">quant</th>
                <th className="px-3 py-2.5">loss</th>
                <th className="px-3 py-2.5">eval</th>
                <th className="px-3 py-2.5">ppl</th>
                <th className="px-3 py-2.5">vram</th>
                <th className="px-3 py-2.5 text-right">assign</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className={clsx('border-t border-line transition-colors hover:bg-white/5', (r.id === compareA || r.id === compareB) && 'bg-white/[0.03]')}>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }} />
                      <span className="text-slate-300">{r.name.slice(0, 22)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">{getModel(r.modelId).name}</td>
                  <td className="px-3 py-2.5 text-slate-300">{r.lora.r}</td>
                  <td className="px-3 py-2.5 text-slate-400">{r.train.quant}</td>
                  <td className="px-3 py-2.5 text-cyan">{r.finalLoss.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-lime">{r.finalEval.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-magenta">{r.finalPpl.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-slate-400">{r.vramGB}G</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {(['A', 'B'] as const).map((slot) => {
                        const on = (slot === 'A' ? compareA : compareB) === r.id
                        return (
                          <button
                            key={slot}
                            onClick={() => setCompare(slot, r.id)}
                            className={clsx('h-6 w-6 rounded border text-[11px] font-bold transition-colors', on ? 'border-cyan bg-cyan/20 text-cyan' : 'border-line text-slate-500 hover:text-slate-200')}
                          >
                            {slot}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <div className="mb-2 flex items-center justify-between">
            <span className="label neon-cyan">Overlaid checkpoint loss</span>
            <div className="flex gap-3 text-[11px]">
              {selected.map((r) => (
                <span key={r.id} className="flex items-center gap-1.5" style={{ color: r.color }}>
                  <span className="h-1.5 w-3 rounded-full" style={{ background: r.color }} /> {r.name.slice(0, 14)}
                </span>
              ))}
            </div>
          </div>
          <OverlayChart runs={selected} />
        </Panel>

        <Panel>
          <span className="label mb-3 block">A / B diff</span>
          {A && B ? (
            <div className="space-y-1 font-mono text-[12px]">
              <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] uppercase tracking-wider text-slate-600">
                <span>metric</span><span className="text-right" style={{ color: A.color }}>A</span><span className="text-right" style={{ color: B.color }}>B</span>
              </div>
              {diffRows.map((row) => (
                <div key={row.k} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-line/50 py-1">
                  <span className="text-slate-500">{row.k}</span>
                  <span className="text-right text-slate-300">{row.a}</span>
                  <span className={clsx('text-right', row.a !== row.b ? 'text-cyan' : 'text-slate-300')}>{row.b}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Assign a run to both <span className="text-cyan">A</span> and <span className="text-cyan">B</span> above to see the diff.</p>
          )}
        </Panel>
      </div>

      <div className="mt-6 flex justify-between border-t border-line pt-5">
        <button onClick={() => setStep('evaluate')} className="text-sm text-slate-500 hover:text-slate-200">← Evaluate</button>
        <NeonButton accent="amber" onClick={() => setStep('quantize')}>Quantize →</NeonButton>
      </div>
    </div>
  )
}
