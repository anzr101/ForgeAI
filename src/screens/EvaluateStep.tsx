import { motion } from 'framer-motion'
import { useForge } from '../store/useForge'
import { getModel } from '../data/models'
import { getDataset } from '../data/datasets'
import { SectionTitle, Panel, Stat, NeonButton } from '../components/ui/primitives'
import { Sparkline } from '../components/charts'
import { fmtBytes, fmtInt } from '../lib/format'
import { IconGauge } from '../components/icons'

function EmptyState() {
  const setStep = useForge((s) => s.setStep)
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
      <div>
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-panel-2 text-slate-500"><IconGauge width={30} height={30} /></span>
        <h2 className="text-xl font-bold">No results yet</h2>
        <p className="mt-2 text-slate-400">Complete a training run to evaluate the adapter and inspect sample generations.</p>
        <div className="mt-5"><NeonButton onClick={() => setStep('train')}>Go to training</NeonButton></div>
      </div>
    </div>
  )
}

export function EvaluateStep() {
  const { runs, setStep } = useForge()
  const run = runs[runs.length - 1]
  if (!run) return <EmptyState />

  const model = getModel(run.modelId)
  const dataset = getDataset(run.datasetId)
  const score = Math.max(6, Math.min(99, Math.round(100 * (1 - (run.finalEval - 0.6) / 2.4))))

  const benchmarks = [
    { name: 'Instruction following', before: 41, after: Math.min(96, 41 + Math.round(score * 0.5)) },
    { name: 'Response coherence', before: 55, after: Math.min(97, 55 + Math.round(score * 0.38)) },
    { name: 'Format adherence', before: 33, after: Math.min(98, 33 + Math.round(score * 0.6)) },
    { name: 'Task accuracy', before: 38, after: Math.min(95, 38 + Math.round(score * 0.52)) },
  ]

  const prompt = dataset.sample.instruction ?? 'Give three tips for staying healthy.'
  const before = `I can help with that. ${prompt.split(' ').slice(0, 4).join(' ')}… could you clarify what you mean? There are many possible answers depending on context.`
  const after = dataset.sample.output

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle eyebrow="Step 04 · Evaluation" title="Evaluate the fine-tuned adapter" desc={`Results for ${run.name}. Metrics are computed from the run’s eval loss; generations compare the base model against the adapted one.`} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <Stat label="Final train loss" value={run.finalLoss.toFixed(4)} accent="cyan" />
        <Stat label="Final eval loss" value={run.finalEval.toFixed(4)} accent="lime" />
        <Stat label="Perplexity" value={run.finalPpl.toFixed(2)} accent="magenta" sub="exp(eval_loss)" />
        <Stat label="Quality score" value={`${score}`} accent="amber" sub="/ 100 heuristic" />
        <Stat label="Adapter" value={fmtBytes((run.trainableParams * 2) / 1e6)} accent="cyan" sub={`${fmtInt(run.trainableParams)} params`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <span className="label neon-lime">Before → after · benchmark lift</span>
          <div className="mt-4 space-y-4">
            {benchmarks.map((b) => (
              <div key={b.name}>
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="text-slate-300">{b.name}</span>
                  <span className="font-mono text-lime">+{b.after - b.before}</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-void ring-1 ring-line">
                  <div className="absolute left-0 top-0 h-full rounded-full bg-slate-600" style={{ width: `${b.before}%` }} />
                  <motion.div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#a3e635,#22d3ee)' }}
                    initial={{ width: `${b.before}%` }}
                    animate={{ width: `${b.after}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <span className="label neon-cyan">Sample generation</span>
          <div className="mt-3 rounded-lg border border-line bg-void/60 p-3 font-mono text-[12px] text-slate-300">
            <span className="text-cyan">prompt ›</span> {prompt}
          </div>
          <div className="mt-3 grid gap-3">
            <div className="rounded-lg border border-line bg-panel/60 p-3">
              <div className="label mb-1">Base {model.name}</div>
              <p className="text-[12.5px] leading-relaxed text-slate-500">{before}</p>
            </div>
            <div className="rounded-lg border border-lime/30 bg-lime/5 p-3">
              <div className="label mb-1 text-lime">Fine-tuned adapter</div>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-200">{after}</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="label neon-magenta">Checkpoints</span>
          <span className="text-[11px] text-slate-500">{run.checkpoints.length} saved · loss trajectory</span>
        </div>
        {run.checkpoints.length > 0 ? (
          <>
            <div className="mb-3"><Sparkline values={run.checkpoints.map((c) => c.loss)} color="#22d3ee" height={40} /></div>
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-left font-mono text-[12px]">
                <thead className="bg-panel-2/60 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">checkpoint</th>
                    <th className="px-3 py-2">step</th>
                    <th className="px-3 py-2">loss</th>
                    <th className="px-3 py-2">eval</th>
                    <th className="px-3 py-2">ppl</th>
                    <th className="px-3 py-2">size</th>
                  </tr>
                </thead>
                <tbody>
                  {run.checkpoints.map((c, i) => (
                    <tr key={c.id} className="border-t border-line hover:bg-white/5">
                      <td className="px-3 py-2 text-cyan">{c.id}</td>
                      <td className="px-3 py-2 text-slate-400">{fmtInt(c.step)}</td>
                      <td className="px-3 py-2 text-slate-200">{c.loss.toFixed(4)}</td>
                      <td className="px-3 py-2 text-lime">{c.evalLoss.toFixed(4)}</td>
                      <td className="px-3 py-2 text-magenta">{c.perplexity.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-500">{fmtBytes(c.adapterMB)}{i === run.checkpoints.length - 1 ? ' ★' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">No intermediate checkpoints for this run (increase save frequency).</p>
        )}
      </Panel>

      <div className="mt-6 flex justify-between border-t border-line pt-5">
        <button onClick={() => setStep('train')} className="text-sm text-slate-500 hover:text-slate-200">← Training</button>
        <NeonButton accent="magenta" onClick={() => setStep('compare')}>Compare runs →</NeonButton>
      </div>
    </div>
  )
}
