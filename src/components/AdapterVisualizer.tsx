import { motion } from 'framer-motion'
import type { LoraConfig, ModelArch, TargetModule } from '../types'
import { moduleDims } from '../lib/lora'
import { fmtParams } from '../lib/format'

const ATTN: TargetModule[] = ['q_proj', 'k_proj', 'v_proj', 'o_proj']
const MLP: TargetModule[] = ['gate_proj', 'up_proj', 'down_proj']

function ModuleNode({
  name,
  dims,
  r,
  active,
}: {
  name: string
  dims: [number, number]
  r: number
  active: boolean
}) {
  return (
    <div
      className="relative flex flex-col items-center rounded-md border px-2.5 py-2 text-center transition-colors"
      style={{
        borderColor: active ? '#22d3ee66' : '#1b2233',
        background: active ? 'rgba(34,211,238,0.08)' : 'rgba(10,13,22,0.6)',
      }}
    >
      <span className={active ? 'text-[11px] font-semibold text-cyan' : 'text-[11px] font-medium text-slate-500'}>{name}</span>
      <span className="font-mono text-[9px] text-slate-600">
        {dims[0]}×{dims[1]}
      </span>
      {active && (
        <motion.div
          className="mt-1 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold text-void"
          style={{ background: '#e879f9' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          +LoRA r={r}
        </motion.div>
      )}
    </div>
  )
}

export function AdapterVisualizer({ model, lora }: { model: ModelArch; lora: LoraConfig }) {
  const dims = moduleDims(model)
  const isActive = (t: TargetModule) => lora.targets.includes(t)

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-void/50 p-5">
      {/* animated flow line */}
      <motion.div
        className="pointer-events-none absolute left-0 top-0 h-full w-24"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.10), transparent)' }}
        animate={{ x: ['-10%', '520%'] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative flex items-stretch gap-3">
        <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-panel-2/70 px-3 py-4">
          <span className="label">input</span>
          <span className="mt-1 font-mono text-xs text-slate-300">hidden {model.hidden}</span>
        </div>

        <div className="flex-1 rounded-lg border border-dashed border-cyan/25 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="label neon-cyan">Decoder Block</span>
            <span className="chip">× {model.layers} layers</span>
          </div>
          <div className="mb-2">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Self-Attention</span>
            <div className="grid grid-cols-4 gap-2">
              {ATTN.map((t) => (
                <ModuleNode key={t} name={t} dims={dims[t]} r={lora.r} active={isActive(t)} />
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">MLP</span>
            <div className="grid grid-cols-3 gap-2">
              {MLP.map((t) => (
                <ModuleNode key={t} name={t} dims={dims[t]} r={lora.r} active={isActive(t)} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-panel-2/70 px-3 py-4">
          <span className="label">output</span>
          <span className="mt-1 font-mono text-xs text-slate-300">logits {fmtParams(model.vocab)}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-line bg-panel/60 p-3">
          <div className="label mb-1">Frozen base</div>
          <div className="font-mono text-sm font-bold text-slate-300">{fmtParams(model.params)}</div>
          <div className="text-[10px] text-slate-600">weights held fixed ❄</div>
        </div>
        <div className="rounded-lg border border-line bg-panel/60 p-3">
          <div className="label mb-1">Adapters injected</div>
          <div className="font-mono text-sm font-bold text-magenta">
            {lora.targets.length} × {model.layers} = {lora.targets.length * model.layers}
          </div>
          <div className="text-[10px] text-slate-600">low-rank A·B matrices 🔥</div>
        </div>
        <div className="rounded-lg border border-line bg-panel/60 p-3">
          <div className="label mb-1">Rank / Alpha</div>
          <div className="font-mono text-sm font-bold text-lime">
            r={lora.r} · α={lora.alpha}
          </div>
          <div className="text-[10px] text-slate-600">scaling = α/r = {(lora.alpha / lora.r).toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}
