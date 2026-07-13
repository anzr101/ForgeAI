import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useForge } from '../../store/useForge'
import type { Step } from '../../types'
import { getModel } from '../../data/models'
import { clsx } from '../../lib/format'
import {
  IconCpu,
  IconDatabase,
  IconLayers,
  IconPlay,
  IconGauge,
  IconCompare,
  IconPackage,
  IconRocket,
  IconCode,
  IconFlame,
} from '../icons'

const STEPS: { id: Step; label: string; icon: (p: any) => ReactNode; group: string }[] = [
  { id: 'model', label: 'Model', icon: IconCpu, group: 'Configure' },
  { id: 'dataset', label: 'Dataset', icon: IconDatabase, group: 'Configure' },
  { id: 'lora', label: 'LoRA / QLoRA', icon: IconLayers, group: 'Configure' },
  { id: 'train', label: 'Train', icon: IconPlay, group: 'Run' },
  { id: 'evaluate', label: 'Evaluate', icon: IconGauge, group: 'Analyze' },
  { id: 'compare', label: 'Compare', icon: IconCompare, group: 'Analyze' },
  { id: 'quantize', label: 'Quantize', icon: IconPackage, group: 'Ship' },
  { id: 'deploy', label: 'Deploy', icon: IconRocket, group: 'Ship' },
  { id: 'export', label: 'Export Code', icon: IconCode, group: 'Ship' },
]

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: '#64748b',
    running: '#a3e635',
    paused: '#fbbf24',
    completed: '#22d3ee',
  }
  const c = map[status] ?? '#64748b'
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === 'running' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: c }} />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
    </span>
  )
}

export function Shell({ children, onHome }: { children: ReactNode; onHome: () => void }) {
  const { step, setStep, status, modelId, runName, runs } = useForge()
  const model = getModel(modelId)

  let lastGroup = ''

  return (
    <div className="flex min-h-screen">
      {/* Left rail */}
      <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r border-line bg-panel/40 backdrop-blur-xl">
        <button onClick={onHome} className="flex items-center gap-2.5 px-5 py-5 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: 'linear-gradient(135deg,#22d3ee,#e879f9)', boxShadow: '0 0 20px -4px #22d3ee' }}>
            <IconFlame width={20} height={20} className="text-void" />
          </span>
          <div>
            <div className="text-[15px] font-extrabold tracking-tight text-slate-50">Forge</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Fine-Tune Lab</div>
          </div>
        </button>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {STEPS.map((s) => {
            const active = step === s.id
            const showGroup = s.group !== lastGroup
            lastGroup = s.group
            const Icon = s.icon
            return (
              <div key={s.id}>
                {showGroup && <div className="label mb-1 mt-3 px-2">{s.group}</div>}
                <button
                  onClick={() => setStep(s.id)}
                  className={clsx(
                    'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    active ? 'text-cyan' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                  )}
                  style={active ? { background: 'rgba(34,211,238,0.10)', boxShadow: 'inset 0 0 0 1px rgba(34,211,238,0.25)' } : undefined}
                >
                  <Icon width={17} height={17} />
                  <span>{s.label}</span>
                  {s.id === 'train' && status === 'running' && (
                    <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <StatusDot status={status} />
            <span className="font-mono">{status}</span>
            <span className="ml-auto chip">{runs.length} runs</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-void/70 px-6 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="chip" style={{ borderColor: '#22d3ee55', color: '#22d3ee' }}>
              <IconCpu width={13} height={13} /> {model.name}
            </span>
            {runName && status !== 'idle' && (
              <span className="chip font-mono text-[10px]">{runName}</span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://github.com/anzr101/ForgeAI"
              target="_blank"
              rel="noreferrer"
              className="chip hover:border-cyan/50 hover:text-cyan"
            >
              ★ Star on GitHub
            </a>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 py-6">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
