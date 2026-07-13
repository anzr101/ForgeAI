import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForge } from '../store/useForge'
import { getModel } from '../data/models'
import { getDataset } from '../data/datasets'
import { SectionTitle, Panel, NeonButton, Stat } from '../components/ui/primitives'
import { StepNav } from '../components/layout/StepNav'
import { useCopy } from '../lib/io'
import { IconRocket, IconCopy, IconCheck, IconZap } from '../components/icons'

type Phase = 'idle' | 'deploying' | 'live'
const STAGES = ['Merging adapter into base weights', 'Loading shards onto GPU', 'Allocating paged KV cache', 'Warming up CUDA graphs', 'Starting vLLM OpenAI server']

export function DeployStep() {
  const { modelId, runs } = useForge()
  const model = getModel(modelId)
  const run = runs[runs.length - 1]
  const runName = run?.name ?? `${model.id}-adapter`
  const dataset = getDataset(run?.datasetId ?? 'alpaca')

  const [phase, setPhase] = useState<Phase>('idle')
  const [stage, setStage] = useState(0)
  const [copied, copy] = useCopy()
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)

  const endpoint = `https://api.forge.dev/v1/${runName}`

  const deploy = () => {
    setPhase('deploying')
    setStage(0)
    let i = 0
    const iv = setInterval(() => {
      i += 1
      setStage(i)
      if (i >= STAGES.length) {
        clearInterval(iv)
        setTimeout(() => setPhase('live'), 500)
      }
    }, 750)
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [chat])

  const send = () => {
    const q = input.trim()
    if (!q) return
    const reply = `Based on my ${dataset.task.toLowerCase()} fine-tune: ${dataset.sample.output.split('\n')[0]} ${q.length > 40 ? '' : '(Ask a follow-up for more detail.)'}`
    setChat((c) => [...c, { role: 'user', text: q }, { role: 'assistant', text: reply }])
    setInput('')
  }

  const curl = `curl ${endpoint}/chat/completions \\
  -H "Authorization: Bearer $FORGE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${runName}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`

  const pyClient = `from openai import OpenAI
client = OpenAI(base_url="${endpoint}", api_key="$FORGE_KEY")

resp = client.chat.completions.create(
    model="${runName}",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle eyebrow="Step 07 · Serving" title="Deploy to a vLLM endpoint" desc="Spin up an OpenAI-compatible inference server for the quantized model. (Simulated — export the code on the next step to deploy for real.)" />

      {phase === 'idle' && (
        <Panel className="grid place-items-center py-16 text-center">
          <div>
            <span className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-2xl" style={{ background: 'linear-gradient(135deg,#a3e635,#22d3ee)', boxShadow: '0 0 40px -8px #a3e635' }}>
              <IconRocket width={38} height={38} className="text-void" />
            </span>
            <h3 className="text-xl font-bold">Deploy {runName}</h3>
            <p className="mx-auto mt-2 max-w-md text-slate-400">Serve on vLLM with continuous batching and an OpenAI-compatible API.</p>
            <div className="mt-6"><NeonButton size="lg" accent="lime" onClick={deploy}><IconRocket width={18} height={18} /> Deploy endpoint</NeonButton></div>
          </div>
        </Panel>
      )}

      {phase === 'deploying' && (
        <Panel className="py-12">
          <div className="mx-auto max-w-md">
            <div className="mb-6 text-center font-mono text-sm text-lime">deploying · {Math.min(stage, STAGES.length)}/{STAGES.length}</div>
            <div className="space-y-2.5">
              {STAGES.map((st, i) => (
                <div key={st} className="flex items-center gap-3 text-sm">
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < stage ? 'bg-lime/20 text-lime' : i === stage ? 'bg-cyan/20 text-cyan' : 'bg-panel-2 text-slate-600'}`}>
                    {i < stage ? '✓' : i === stage ? '•' : ''}
                  </span>
                  <span className={i <= stage ? 'text-slate-200' : 'text-slate-600'}>{st}</span>
                  {i === stage && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}

      <AnimatePresence>
        {phase === 'live' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-lime/30 bg-lime/5 p-4">
              <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-70" /><span className="relative h-3 w-3 rounded-full bg-lime" /></span>
              <span className="font-semibold text-lime">Endpoint live</span>
              <code className="chip font-mono text-[11px]">{endpoint}</code>
              <span className="ml-auto chip"><IconZap width={12} height={12} className="text-amber" /> vLLM 0.6 · A100</span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="TTFT" value="42" accent="cyan" sub="ms first token" />
              <Stat label="Throughput" value="3,180" accent="lime" sub="tok/s aggregate" />
              <Stat label="Concurrency" value="64" accent="magenta" sub="live requests" />
              <Stat label="Context" value="8K" accent="amber" sub="max tokens" />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                <Snippet title="cURL" code={curl} onCopy={() => copy(curl)} copied={copied} />
                <Snippet title="Python · OpenAI SDK" code={pyClient} onCopy={() => copy(pyClient)} copied={copied} />
              </div>

              <Panel className="flex flex-col !p-0">
                <div className="border-b border-line px-4 py-2.5 font-mono text-[12px] text-slate-400">playground · {runName}</div>
                <div ref={chatRef} className="min-h-[240px] flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 320 }}>
                  {chat.length === 0 && <div className="grid h-full place-items-center text-sm text-slate-600">Send a message to test the deployed model…</div>}
                  {chat.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] ${m.role === 'user' ? 'bg-cyan/15 text-cyan' : 'border border-line bg-panel-2 text-slate-200'}`}>{m.text}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-line p-3">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                    placeholder="Ask the fine-tuned model…"
                    className="flex-1 rounded-lg border border-line bg-void/70 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan/50"
                  />
                  <NeonButton size="sm" onClick={send}>Send</NeonButton>
                </div>
              </Panel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StepNav back="quantize" next="export" nextLabel="Export training code" nextAccent="magenta" />
    </div>
  )
}

function Snippet({ title, code, onCopy, copied }: { title: string; code: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-void/70">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-[12px] text-slate-400">{title}</span>
        <button onClick={onCopy} className="chip hover:border-cyan/50 hover:text-cyan">
          {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />} {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="overflow-auto p-4 font-mono text-[11.5px] leading-relaxed text-slate-300"><code>{code}</code></pre>
    </div>
  )
}
