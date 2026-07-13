import { motion } from 'framer-motion'
import { useForge } from '../store/useForge'
import { DATASETS, getDataset } from '../data/datasets'
import { SectionTitle } from '../components/ui/primitives'
import { StepNav } from '../components/layout/StepNav'
import { fmtInt, clsx } from '../lib/format'

const FORMAT_COLOR: Record<string, string> = {
  alpaca: '#22d3ee',
  chatml: '#e879f9',
  sharegpt: '#a3e635',
  text: '#fbbf24',
  preference: '#fb7185',
}

export function DatasetStep() {
  const { datasetId, setDataset } = useForge()
  const ds = getDataset(datasetId)

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle
        eyebrow="Step 02 · Training data"
        title="Pick your fine-tuning dataset"
        desc="These are real Hugging Face datasets. Row counts and average token lengths feed directly into Forge’s step-count and throughput estimates."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {DATASETS.map((d, i) => {
            const active = d.id === datasetId
            const hex = FORMAT_COLOR[d.format]
            return (
              <motion.button
                key={d.id}
                onClick={() => setDataset(d.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                whileHover={{ y: -2 }}
                className={clsx('glass p-4 text-left transition-all')}
                style={active ? { boxShadow: `0 0 0 1px ${hex}, 0 0 26px -10px ${hex}` } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-slate-100">{d.name}</span>
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${hex}22`, color: hex }}>
                    {d.format}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500">{d.hf}</div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{d.blurb}</p>
                <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5 font-mono text-[11px]">
                  <span className="text-cyan">{fmtInt(d.rows)} <span className="text-slate-600">rows</span></span>
                  <span className="text-magenta">~{d.avgTokens} <span className="text-slate-600">tok</span></span>
                  <span className="ml-auto text-slate-500">{d.task}</span>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Sample preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="label">Sample record</span>
              <span className="chip font-mono text-[10px]">{ds.format}</span>
            </div>
            <div className="space-y-3 p-4 font-mono text-[12px]">
              {ds.sample.instruction && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-cyan">instruction</div>
                  <div className="rounded-md border border-line bg-void/60 p-2.5 text-slate-300">{ds.sample.instruction}</div>
                </div>
              )}
              {ds.sample.input ? (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber">input</div>
                  <div className="rounded-md border border-line bg-void/60 p-2.5 text-slate-300">{ds.sample.input}</div>
                </div>
              ) : null}
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-lime">output</div>
                <div className="whitespace-pre-wrap rounded-md border border-line bg-void/60 p-2.5 text-slate-300">{ds.sample.output}</div>
              </div>
            </div>
            <div className="border-t border-line px-4 py-3 text-[11px] text-slate-500">
              Formatted into a single supervised prompt at train time via the exported <span className="font-mono text-cyan">format_example</span> fn.
            </div>
          </div>
        </div>
      </div>

      <StepNav back="model" next="lora" nextLabel="Configure LoRA" />
    </div>
  )
}
