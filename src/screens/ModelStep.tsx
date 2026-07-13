import { motion } from 'framer-motion'
import { useForge } from '../store/useForge'
import { MODELS } from '../data/models'
import { SectionTitle, Stat, accentHex } from '../components/ui/primitives'
import { StepNav } from '../components/layout/StepNav'
import { fmtInt, fmtParams, clsx } from '../lib/format'
import { getModel } from '../data/models'

export function ModelStep() {
  const { modelId, setModel } = useForge()
  const selected = getModel(modelId)

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle
        eyebrow="Step 01 · Base model"
        title="Choose an open-weight model"
        desc="Pick the foundation you’ll adapt. Parameter counts and geometry below are the real values from each model’s config — Forge uses them to compute exact adapter sizes and VRAM."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {MODELS.map((m, i) => {
          const active = m.id === modelId
          const hex = accentHex(m.accent)
          return (
            <motion.button
              key={m.id}
              onClick={() => setModel(m.id)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              className={clsx('glass group relative overflow-hidden p-5 text-left transition-all')}
              style={active ? { boxShadow: `0 0 0 1px ${hex}, 0 0 32px -10px ${hex}` } : undefined}
            >
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ background: hex, opacity: active ? 0.22 : 0.08 }} />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{m.family}</div>
                  <div className="text-lg font-bold text-slate-50">{m.name}</div>
                </div>
                <span
                  className="grid h-6 w-6 place-items-center rounded-full border text-[11px]"
                  style={{ borderColor: active ? hex : '#1b2233', color: active ? hex : '#334155', background: active ? `${hex}18` : 'transparent' }}
                >
                  {active ? '✓' : ''}
                </span>
              </div>

              <div className="relative mt-4 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-extrabold" style={{ color: hex, textShadow: `0 0 18px ${hex}66` }}>
                  {fmtParams(m.params)}
                </span>
                <span className="text-xs text-slate-500">params</span>
              </div>

              <p className="relative mt-3 text-[13px] leading-relaxed text-slate-400">{m.blurb}</p>

              <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 font-mono text-[11px]">
                <div><span className="text-slate-600">layers</span><br /><span className="text-slate-300">{m.layers}</span></div>
                <div><span className="text-slate-600">hidden</span><br /><span className="text-slate-300">{m.hidden}</span></div>
                <div><span className="text-slate-600">ctx</span><br /><span className="text-slate-300">{fmtParams(m.seqLen)}</span></div>
              </div>
              <div className="relative mt-3 flex items-center gap-2">
                <span className="chip text-[10px]">{m.license}</span>
                <span className="chip text-[10px] font-mono">{m.hf.split('/')[0]}</span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Selected details */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hidden size" value={selected.hidden} accent={selected.accent} sub={`${selected.heads} attn heads · ${selected.kvHeads} KV`} />
        <Stat label="Intermediate" value={fmtInt(selected.intermediate)} accent={selected.accent} sub="MLP width" />
        <Stat label="Vocab" value={fmtParams(selected.vocab)} accent={selected.accent} sub="tokens" />
        <Stat label="HF repo" value={<span className="text-sm">{selected.hf.split('/')[1]}</span>} accent={selected.accent} sub={selected.hf.split('/')[0]} mono={false} />
      </div>

      <StepNav next="dataset" nextLabel="Choose dataset" />
    </div>
  )
}
