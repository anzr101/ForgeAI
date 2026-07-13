import { useEffect, useRef } from 'react'
import type { LogLine } from '../store/useForge'
import { clsx } from '../lib/format'

const KIND_STYLE: Record<LogLine['kind'], string> = {
  system: 'text-slate-500',
  metric: 'text-cyan',
  eval: 'text-lime',
  save: 'text-magenta',
  success: 'text-lime font-semibold',
  warn: 'text-amber',
}

const KIND_PREFIX: Record<LogLine['kind'], string> = {
  system: '·',
  metric: '›',
  eval: '✓',
  save: '⬇',
  success: '★',
  warn: '!',
}

export function LogConsole({ logs, height = 260 }: { logs: LogLine[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-void/80">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-lime/80" />
          <span className="ml-2 font-mono text-[11px] text-slate-500">trainer.log — live</span>
        </div>
        <span className="font-mono text-[10px] text-slate-600">{logs.length} lines</span>
      </div>
      <div ref={ref} className="overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed" style={{ height }}>
        {logs.length === 0 && <div className="text-slate-700">// logs will stream here once training starts…</div>}
        {logs.map((l) => (
          <div key={l.id} className={clsx('log-line flex gap-2', KIND_STYLE[l.kind])}>
            <span className="select-none opacity-50">{KIND_PREFIX[l.kind]}</span>
            <span className="whitespace-pre-wrap break-all">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
