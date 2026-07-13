import { motion } from 'framer-motion'
import type { MetricPoint } from '../types'

// ── Loss / metric line chart (SVG) ───────────────────────────────────────────
export function MetricChart({
  points,
  height = 220,
  showEval = true,
}: {
  points: MetricPoint[]
  height?: number
  showEval?: boolean
}) {
  const W = 620
  const H = height
  const padL = 40
  const padR = 14
  const padT = 14
  const padB = 22

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-line bg-void/40" style={{ height }}>
        <span className="font-mono text-xs text-slate-600">awaiting first optimizer step…</span>
      </div>
    )
  }

  const maxStep = points[points.length - 1].step || 1
  const losses = points.map((p) => p.loss)
  const evals = points.filter((p) => p.evalLoss != null).map((p) => p.evalLoss!)
  const all = [...losses, ...evals]
  let minV = Math.min(...all)
  let maxV = Math.max(...all)
  const span = maxV - minV || 1
  minV -= span * 0.12
  maxV += span * 0.12

  const x = (s: number) => padL + (s / maxStep) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB)

  const line = points.map((p) => `${x(p.step).toFixed(1)},${y(p.loss).toFixed(1)}`).join(' ')
  const area = `${padL},${H - padB} ${line} ${x(maxStep).toFixed(1)},${H - padB}`
  const evalPts = points.filter((p) => p.evalLoss != null)
  const last = points[points.length - 1]

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => minV + f * (maxV - minV))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="overflow-visible">
      <defs>
        <linearGradient id="lossArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lossLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>

      {gridVals.map((gv, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke="#1b2233" strokeWidth={1} />
          <text x={padL - 6} y={y(gv) + 3} textAnchor="end" className="fill-slate-600" style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}>
            {gv.toFixed(2)}
          </text>
        </g>
      ))}

      <polygon points={area} fill="url(#lossArea)" />
      <polyline points={line} fill="none" stroke="url(#lossLine)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {showEval && evalPts.length > 0 && (
        <polyline
          points={evalPts.map((p) => `${x(p.step)},${y(p.evalLoss!)}`).join(' ')}
          fill="none"
          stroke="#a3e635"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.85}
        />
      )}
      {showEval &&
        evalPts.map((p) => (
          <circle key={p.step} cx={x(p.step)} cy={y(p.evalLoss!)} r={2.5} fill="#a3e635" />
        ))}

      {/* live head */}
      <motion.circle
        cx={x(last.step)}
        cy={y(last.loss)}
        r={4}
        fill="#22d3ee"
        animate={{ r: [4, 6, 4], opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ filter: 'drop-shadow(0 0 6px #22d3ee)' }}
      />
      <text x={padL} y={H - 6} className="fill-slate-600" style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}>
        step 0
      </text>
      <text x={W - padR} y={H - 6} textAnchor="end" className="fill-slate-600" style={{ fontSize: 9, fontFamily: 'JetBrains Mono' }}>
        {maxStep}
      </text>
    </svg>
  )
}

// ── Radial gauge ─────────────────────────────────────────────────────────────
export function RadialGauge({
  value,
  label,
  sub,
  color = '#22d3ee',
  size = 120,
}: {
  value: number // 0..1
  label: string
  sub?: string
  color?: string
  size?: number
}) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#141a29" strokeWidth={7} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-lg font-bold" style={{ color }}>
          {label}
        </span>
        {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
      </div>
    </div>
  )
}

// ── GPU utilization equalizer ────────────────────────────────────────────────
export function GpuMeter({ util }: { util: number }) {
  const bars = 28
  const active = util / 100
  return (
    <div className="flex h-16 items-end gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => {
        const base = 0.2 + Math.abs(Math.sin(i * 0.7)) * 0.5
        return (
          <motion.div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              background: `linear-gradient(to top, #22d3ee, ${active > 0.85 ? '#e879f9' : '#22d3ee'})`,
              boxShadow: '0 0 8px -2px #22d3ee',
            }}
            animate={{ height: `${Math.max(6, base * active * 100 * (0.6 + Math.random() * 0.7))}%` }}
            transition={{ duration: 0.34, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

// ── Horizontal stacked bar (VRAM breakdown) ──────────────────────────────────
export function StackBar({
  segments,
  total,
  max,
}: {
  segments: { label: string; value: number; color: string }[]
  total: number
  max: number
}) {
  return (
    <div>
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-void/70 ring-1 ring-line">
        {segments.map((s, i) => {
          const left = segments.slice(0, i).reduce((a, b) => a + b.value, 0)
          return (
            <div
              key={s.label}
              className="absolute top-0 h-full"
              style={{
                left: `${(left / max) * 100}%`,
                width: `${(s.value / max) * 100}%`,
                background: s.color,
                opacity: 0.85,
              }}
              title={`${s.label}: ${s.value.toFixed(2)} GB`}
            />
          )
        })}
        <div className="absolute top-0 h-full border-r-2 border-rose/70" style={{ left: `${(total / max) * 100}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label} <span className="font-mono text-slate-300">{s.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mini sparkline ───────────────────────────────────────────────────────────
export function Sparkline({ values, color = '#22d3ee', height = 34 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return <div style={{ height }} />
  const W = 120
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * W},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  )
}
