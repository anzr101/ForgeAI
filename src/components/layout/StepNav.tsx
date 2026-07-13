import { NeonButton } from '../ui/primitives'
import { IconArrowRight } from '../icons'
import { useForge } from '../../store/useForge'
import type { Step } from '../../types'

export function StepNav({
  back,
  next,
  nextLabel = 'Continue',
  onNext,
  nextAccent = 'cyan',
  nextDisabled,
}: {
  back?: Step
  next?: Step
  nextLabel?: string
  onNext?: () => void
  nextAccent?: 'cyan' | 'magenta' | 'lime' | 'amber'
  nextDisabled?: boolean
}) {
  const setStep = useForge((s) => s.setStep)
  return (
    <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
      {back ? (
        <button onClick={() => setStep(back)} className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-200">
          ← Back
        </button>
      ) : (
        <span />
      )}
      {(next || onNext) && (
        <NeonButton
          accent={nextAccent}
          disabled={nextDisabled}
          onClick={() => {
            onNext?.()
            if (next) setStep(next)
          }}
        >
          {nextLabel} <IconArrowRight width={16} height={16} />
        </NeonButton>
      )}
    </div>
  )
}
