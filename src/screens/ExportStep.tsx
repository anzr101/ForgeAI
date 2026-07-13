import { useMemo, useState } from 'react'
import { useForge } from '../store/useForge'
import { getModel } from '../data/models'
import { getDataset } from '../data/datasets'
import { SectionTitle, Panel, NeonButton } from '../components/ui/primitives'
import { StepNav } from '../components/layout/StepNav'
import { generateTrainPy, generateRequirements, generateNotebook, generateQuantizeScript, type CodegenInput } from '../lib/codegen'
import { useCopy, download } from '../lib/io'
import { IconCopy, IconCheck, IconDownload, IconCode } from '../components/icons'

type Tab = 'train' | 'reqs' | 'notebook' | 'quantize'

export function ExportStep() {
  const { modelId, datasetId, lora, train, runs } = useForge()
  const model = getModel(modelId)
  const dataset = getDataset(datasetId)
  const runName = runs[runs.length - 1]?.name ?? `${model.id}-${dataset.id}-r${lora.r}`
  const [tab, setTab] = useState<Tab>('train')
  const [copied, copy] = useCopy()

  const input: CodegenInput = useMemo(() => ({ model, dataset, lora, train, runName }), [model, dataset, lora, train, runName])

  const files = useMemo(
    () => ({
      train: { name: 'train.py', lang: 'python', code: generateTrainPy(input) },
      reqs: { name: 'requirements.txt', lang: 'text', code: generateRequirements(input.train) },
      notebook: { name: `${runName}.ipynb`, lang: 'json', code: generateNotebook(input) },
      quantize: { name: 'quantize.sh', lang: 'bash', code: generateQuantizeScript('gguf', 4, model, runName) },
    }),
    [input, model, runName],
  )

  const TABS: { id: Tab; label: string }[] = [
    { id: 'train', label: 'train.py' },
    { id: 'reqs', label: 'requirements.txt' },
    { id: 'notebook', label: 'Colab notebook' },
    { id: 'quantize', label: 'quantize.sh' },
  ]

  const active = files[tab]

  const downloadAll = () => {
    Object.values(files).forEach((f, i) => setTimeout(() => download(f.name, f.code, f.lang === 'json' ? 'application/json' : 'text/plain'), i * 120))
  }

  return (
    <div className="mx-auto max-w-6xl">
      <SectionTitle
        eyebrow="Step 08 · Reproduce for real"
        title="Export runnable training code"
        desc="This isn’t a mock — it’s a genuine PEFT + TRL pipeline wired to every parameter you set. Copy it to a GPU box or Colab and this exact run trains for real."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-cyan/25 bg-cyan/5 p-4">
        <IconCode width={22} height={22} className="text-cyan" />
        <div className="text-sm">
          <span className="font-semibold text-slate-100">{model.name}</span>
          <span className="text-slate-400"> · {dataset.name} · r={lora.r}, α={lora.alpha} · {train.quant === 'none' ? 'LoRA/bf16' : 'QLoRA ' + train.quant} · lr {train.learningRate.toExponential(1)}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <NeonButton size="sm" accent="lime" onClick={downloadAll}><IconDownload width={14} height={14} /> Download all</NeonButton>
          <a href="https://colab.research.google.com" target="_blank" rel="noreferrer">
            <NeonButton size="sm" variant="ghost" accent="amber">Open Colab ↗</NeonButton>
          </a>
        </div>
      </div>

      <Panel className="!p-0">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 font-mono text-[12px] transition-colors ${tab === t.id ? 'bg-cyan/15 text-cyan' : 'text-slate-500 hover:text-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button onClick={() => copy(active.code)} className="chip hover:border-cyan/50 hover:text-cyan">
              {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />} {copied ? 'copied' : 'copy'}
            </button>
            <button onClick={() => download(active.name, active.code, active.lang === 'json' ? 'application/json' : 'text/plain')} className="chip hover:border-cyan/50 hover:text-cyan">
              <IconDownload width={13} height={13} /> {active.name}
            </button>
          </div>
        </div>
        <pre className="max-h-[560px] overflow-auto p-5 font-mono text-[12px] leading-relaxed text-slate-300"><code>{active.code}</code></pre>
      </Panel>

      <StepNav back="deploy" />
    </div>
  )
}
