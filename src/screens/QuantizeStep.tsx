import { useState } from 'react'
import { useForge } from '../store/useForge'
import { getModel } from '../data/models'
import { SectionTitle, Panel, Segmented } from '../components/ui/primitives'
import { StepNav } from '../components/layout/StepNav'
import { generateQuantizeScript } from '../lib/codegen'
import { useCopy, download } from '../lib/io'
import { fmtBytes, clsx } from '../lib/format'
import { IconCopy, IconDownload, IconCheck } from '../components/icons'

type Method = 'gguf' | 'awq' | 'gptq'

const METHODS: { id: Method; name: string; bpw: number; bitsOptions: number[]; runtime: string; retention: number; speedup: string; desc: string }[] = [
  { id: 'gguf', name: 'GGUF', bpw: 4.5, bitsOptions: [4, 5, 8], runtime: 'llama.cpp · Ollama · LM Studio', retention: 0.985, speedup: '3.1× CPU', desc: 'Best for local & edge. Runs on CPU, Apple Silicon and consumer GPUs.' },
  { id: 'awq', name: 'AWQ', bpw: 4.0, bitsOptions: [4], runtime: 'vLLM · TGI · AutoAWQ', retention: 0.992, speedup: '2.4× GPU', desc: 'Activation-aware 4-bit. Excellent quality retention, GPU-served.' },
  { id: 'gptq', name: 'GPTQ', bpw: 4.0, bitsOptions: [4, 8], runtime: 'vLLM · ExLlama · AutoGPTQ', retention: 0.981, speedup: '2.2× GPU', desc: 'Classic post-training quantization. Wide tooling support.' },
]

export function QuantizeStep() {
  const { modelId, runs } = useForge()
  const model = getModel(modelId)
  const runName = runs[runs.length - 1]?.name ?? `${model.id}-adapter`
  const [method, setMethod] = useState<Method>('gguf')
  const [bits, setBits] = useState(4)
  const [copied, copy] = useCopy()

  const cfg = METHODS.find((m) => m.id === method)!
  const effBpw = method === 'gguf' ? (bits === 4 ? 4.5 : bits === 5 ? 5.5 : 8.5) : bits
  const fp16MB = (model.params * 2) / 1e6
  const quantMB = (model.params * (effBpw / 8)) / 1e6
  const reduction = 1 - quantMB / fp16MB
  const script = generateQuantizeScript(method, bits, model, runName)
  const ext = method === 'gguf' ? 'sh' : 'py'

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle eyebrow="Step 06 · Quantization" title="Shrink it for deployment" desc="Merge the adapter into the base model, then quantize. Sizes below are computed from the real parameter count and each format’s bits-per-weight." />

      {/* Format comparison */}
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        {METHODS.map((m) => {
          const active = m.id === method
          const mQuant = (model.params * (m.bpw / 8)) / 1e6
          return (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setBits(m.bitsOptions[0]) }}
              className={clsx('glass p-4 text-left transition-all')}
              style={active ? { boxShadow: '0 0 0 1px #fbbf24, 0 0 26px -10px #fbbf24' } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-extrabold text-slate-100">{m.name}</span>
                <span className="chip text-[10px]">{m.speedup}</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{m.desc}</p>
              <div className="mt-3 flex items-baseline gap-2 border-t border-line pt-2.5">
                <span className="font-mono text-lg font-bold text-amber">{fmtBytes(mQuant)}</span>
                <span className="text-[11px] text-slate-500">· {(m.retention * 100).toFixed(1)}% quality</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-600">{m.runtime}</div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Panel glow="amber">
            <span className="label">Configure · {cfg.name}</span>
            {cfg.bitsOptions.length > 1 && (
              <div className="mt-3">
                <div className="label mb-2">Precision</div>
                <Segmented<string> value={String(bits)} accent="amber" onChange={(v) => setBits(parseInt(v))} options={cfg.bitsOptions.map((b) => ({ value: String(b), label: `${b}-bit` }))} />
              </div>
            )}
            <div className="mt-4 space-y-3">
              <Bar label="fp16 original" value={fp16MB} max={fp16MB} color="#475569" />
              <Bar label={`${cfg.name} ${bits}-bit`} value={quantMB} max={fp16MB} color="#fbbf24" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              <Metric k="size" v={fmtBytes(quantMB)} c="#fbbf24" />
              <Metric k="smaller" v={`${(reduction * 100).toFixed(0)}%`} c="#a3e635" />
              <Metric k="quality" v={`${(cfg.retention * 100).toFixed(1)}%`} c="#22d3ee" />
            </div>
          </Panel>

          <Panel>
            <span className="label mb-2 block">Deployment targets</span>
            <div className="flex flex-wrap gap-2">
              {cfg.runtime.split(' · ').map((r) => (
                <span key={r} className="chip">{r}</span>
              ))}
            </div>
          </Panel>
        </div>

        <Panel className="!p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="font-mono text-[12px] text-slate-400">quantize.{ext}</span>
            <div className="flex gap-2">
              <button onClick={() => copy(script)} className="chip hover:border-cyan/50 hover:text-cyan">
                {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />} {copied ? 'copied' : 'copy'}
              </button>
              <button onClick={() => download(`quantize.${ext}`, script)} className="chip hover:border-cyan/50 hover:text-cyan">
                <IconDownload width={13} height={13} /> download
              </button>
            </div>
          </div>
          <pre className="max-h-[420px] overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-slate-300"><code>{script}</code></pre>
        </Panel>
      </div>

      <StepNav back="compare" next="deploy" nextLabel="Deploy" nextAccent="lime" />
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-300">{fmtBytes(value)}</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-void ring-1 ring-line">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

function Metric({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div>
      <div className="label mb-1">{k}</div>
      <div className="font-mono text-base font-bold" style={{ color: c }}>{v}</div>
    </div>
  )
}
