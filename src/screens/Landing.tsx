import { motion } from 'framer-motion'
import { NeonButton } from '../components/ui/primitives'
import { IconFlame, IconArrowRight, IconCpu, IconDatabase, IconLayers, IconPlay, IconGauge, IconCompare, IconPackage, IconRocket } from '../components/icons'

const COVERS = ['LoRA', 'QLoRA', 'PEFT', 'Transformers', 'HuggingFace', 'Datasets', 'TRL', 'W&B', 'Quantization', 'GGUF', 'AWQ', 'GPTQ', 'vLLM']

const PIPELINE = [
  { icon: IconCpu, label: 'Model' },
  { icon: IconDatabase, label: 'Dataset' },
  { icon: IconLayers, label: 'LoRA' },
  { icon: IconPlay, label: 'Train' },
  { icon: IconGauge, label: 'Evaluate' },
  { icon: IconCompare, label: 'Compare' },
  { icon: IconPackage, label: 'Quantize' },
  { icon: IconRocket, label: 'Deploy' },
]

const FEATURES = [
  { t: 'Real LoRA math', d: 'Trainable-parameter counts and VRAM estimates computed from each model’s true architecture — not hand-waved.', a: '#22d3ee' },
  { t: 'Live telemetry', d: 'Animated GPU utilization, streaming loss & eval curves, gradient norms and a real-time trainer log console.', a: '#e879f9' },
  { t: 'Adapter visualizer', d: 'See exactly where low-rank adapters inject into every attention & MLP projection across the decoder stack.', a: '#a3e635' },
  { t: 'Checkpoint compare', d: 'Diff runs and checkpoints side-by-side, W&B style, with reproducible seeds so configuration actually matters.', a: '#fbbf24' },
  { t: 'Quantize & ship', d: 'GGUF, AWQ and GPTQ with size/quality/speed trade-offs, then a vLLM OpenAI-compatible deploy mock.', a: '#22d3ee' },
  { t: 'Export real code', d: 'Every run generates a runnable train.py + Colab notebook using transformers · peft · trl · bitsandbytes.', a: '#e879f9' },
]

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="relative">
      {/* Nav */}
      <nav className="sticky top-0 z-30 flex items-center gap-3 border-b border-line/60 bg-void/60 px-6 py-4 backdrop-blur-xl md:px-10">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: 'linear-gradient(135deg,#22d3ee,#e879f9)', boxShadow: '0 0 20px -4px #22d3ee' }}>
            <IconFlame width={20} height={20} className="text-void" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">Forge</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a href="https://github.com/anzr101/ForgeAI" target="_blank" rel="noreferrer" className="hidden text-sm text-slate-400 hover:text-cyan sm:block">
            GitHub ↗
          </a>
          <NeonButton size="sm" onClick={onLaunch}>
            Launch Lab <IconArrowRight width={15} height={15} />
          </NeonButton>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 text-center md:pt-24">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="chip mx-auto mb-6 animate-pulse-glow" style={{ borderColor: '#22d3ee55', color: '#22d3ee' }}>
            <IconFlame width={13} height={13} /> Open-weight LLM Fine-Tuning Laboratory
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
            Fine-tune LLMs like a <span className="text-gradient">pro</span>.
            <br /> Watch every gradient <span className="text-gradient">flow</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            GitHub + VSCode + Weights &amp; Biases + Hugging Face — reimagined as one cyberpunk
            workbench built purely for LoRA &amp; QLoRA experimentation.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <NeonButton size="lg" onClick={onLaunch}>
              <IconPlay width={17} height={17} /> Start a training run
            </NeonButton>
            <NeonButton size="lg" variant="ghost" accent="magenta" onClick={onLaunch}>
              Explore the lab
            </NeonButton>
          </div>
        </motion.div>

        {/* Pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-16 flex max-w-4xl flex-wrap items-center justify-center gap-2"
        >
          {PIPELINE.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="flex items-center gap-2">
                <div className="glass-2 flex items-center gap-2 rounded-lg px-3 py-2">
                  <Icon width={16} height={16} className="text-cyan" />
                  <span className="text-xs font-semibold text-slate-300">{s.label}</span>
                </div>
                {i < PIPELINE.length - 1 && <IconArrowRight width={14} height={14} className="text-slate-700" />}
              </div>
            )
          })}
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto mt-24 max-w-6xl px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              className="glass group relative overflow-hidden p-6"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity group-hover:opacity-100" style={{ background: f.a, opacity: 0.14 }} />
              <div className="mb-3 h-1 w-8 rounded-full" style={{ background: f.a, boxShadow: `0 0 12px ${f.a}` }} />
              <h3 className="text-base font-bold text-slate-100">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Covers marquee */}
      <section className="mx-auto mt-24 max-w-5xl px-6 text-center">
        <div className="label mb-5">Covers the entire open-weight stack</div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {COVERS.map((c, i) => (
            <motion.span
              key={c}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="chip text-[13px]"
              style={{ borderColor: '#22d3ee33' }}
            >
              <span className="text-lime">✓</span> {c}
            </motion.span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-24 max-w-4xl px-6 pb-24">
        <div className="glass relative overflow-hidden p-10 text-center" style={{ boxShadow: '0 0 50px -20px #22d3ee' }}>
          <div className="absolute inset-0 cyber-grid opacity-40" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight">Spin up your first adapter in seconds.</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              No GPU required to explore — configure a run, watch it train live, then export the exact
              code to reproduce it on real hardware.
            </p>
            <div className="mt-7 flex justify-center">
              <NeonButton size="lg" onClick={onLaunch}>
                <IconFlame width={17} height={17} /> Enter the Forge
              </NeonButton>
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-slate-600">
          Built with React · TypeScript · a fully simulated training engine driven by real LoRA math.
        </p>
      </section>
    </div>
  )
}
