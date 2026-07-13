import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { clsx } from '../../lib/format'

type Accent = 'cyan' | 'magenta' | 'lime' | 'amber' | 'rose'

const ACCENT_HEX: Record<Accent, string> = {
  cyan: '#22d3ee',
  magenta: '#e879f9',
  lime: '#a3e635',
  amber: '#fbbf24',
  rose: '#fb7185',
}

export function accentHex(a: Accent) {
  return ACCENT_HEX[a]
}

export function Panel({
  children,
  className,
  glow,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  glow?: Accent
  as?: 'div' | 'section'
}) {
  const Comp = as as any
  return (
    <Comp
      className={clsx('glass p-5', className)}
      style={glow ? { boxShadow: `0 0 0 1px ${ACCENT_HEX[glow]}22, 0 0 34px -12px ${ACCENT_HEX[glow]}66` } : undefined}
    >
      {children}
    </Comp>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow?: string
  title: string
  desc?: string
}) {
  return (
    <div className="mb-5">
      {eyebrow && <div className="label mb-1.5 neon-cyan">{eyebrow}</div>}
      <h2 className="text-xl font-bold tracking-tight text-slate-50">{title}</h2>
      {desc && <p className="mt-1 max-w-2xl text-sm text-slate-400">{desc}</p>}
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  accent = 'cyan',
  mono = true,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: Accent
  mono?: boolean
}) {
  return (
    <div className="glass-2 rounded-lg p-3.5">
      <div className="label mb-1.5">{label}</div>
      <div
        className={clsx('text-[22px] font-bold leading-none', mono && 'font-mono')}
        style={{ color: ACCENT_HEX[accent], textShadow: `0 0 16px ${ACCENT_HEX[accent]}55` }}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

export function NeonButton({
  children,
  onClick,
  accent = 'cyan',
  variant = 'solid',
  disabled,
  className,
  size = 'md',
}: {
  children: ReactNode
  onClick?: () => void
  accent?: Accent
  variant?: 'solid' | 'ghost'
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const hex = ACCENT_HEX[accent]
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-[15px]',
  }
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        sizes[size],
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
      style={
        variant === 'solid'
          ? {
              color: '#05060a',
              background: `linear-gradient(100deg, ${hex}, ${hex}cc)`,
              boxShadow: disabled ? undefined : `0 0 24px -6px ${hex}`,
            }
          : {
              color: hex,
              border: `1px solid ${hex}55`,
              background: `${hex}12`,
            }
      }
    >
      {children}
    </motion.button>
  )
}

export function Chip({ children, active, accent = 'cyan', onClick }: {
  children: ReactNode
  active?: boolean
  accent?: Accent
  onClick?: () => void
}) {
  const hex = ACCENT_HEX[accent]
  return (
    <button
      onClick={onClick}
      className="chip transition-all"
      style={active ? { borderColor: `${hex}88`, color: hex, background: `${hex}18`, boxShadow: `0 0 14px -4px ${hex}` } : undefined}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  accent = 'cyan',
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  accent?: Accent
}) {
  const hex = ACCENT_HEX[accent]
  return (
    <div className="inline-flex rounded-lg border border-line bg-panel-2/70 p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              active ? 'text-void' : 'text-slate-400 hover:text-slate-200',
            )}
            style={active ? { background: hex, boxShadow: `0 0 16px -6px ${hex}` } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, accent = 'cyan' }: {
  checked: boolean
  onChange: (v: boolean) => void
  accent?: Accent
}) {
  const hex = ACCENT_HEX[accent]
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 rounded-full border border-line transition-colors"
      style={{ background: checked ? `${hex}33` : '#141a29', borderColor: checked ? `${hex}88` : undefined }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        className="absolute top-1/2 block h-4 w-4 -translate-y-1/2 rounded-full"
        style={{ left: checked ? 22 : 4, background: checked ? hex : '#64748b', boxShadow: checked ? `0 0 10px ${hex}` : undefined }}
      />
    </button>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-cyan">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="label">{label}</span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
