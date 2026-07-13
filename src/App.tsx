import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Background } from './components/ui/Background'
import { Shell } from './components/layout/Shell'
import { Landing } from './screens/Landing'
import { ModelStep } from './screens/ModelStep'
import { DatasetStep } from './screens/DatasetStep'
import { LoraStep } from './screens/LoraStep'
import { TrainStep } from './screens/TrainStep'
import { EvaluateStep } from './screens/EvaluateStep'
import { CompareStep } from './screens/CompareStep'
import { QuantizeStep } from './screens/QuantizeStep'
import { DeployStep } from './screens/DeployStep'
import { ExportStep } from './screens/ExportStep'
import { useForge } from './store/useForge'
import type { Step } from './types'

const SCREENS: Record<Step, () => JSX.Element> = {
  model: ModelStep,
  dataset: DatasetStep,
  lora: LoraStep,
  train: TrainStep,
  evaluate: EvaluateStep,
  compare: CompareStep,
  quantize: QuantizeStep,
  deploy: DeployStep,
  export: ExportStep,
}

export default function App() {
  const [launched, setLaunched] = useState(false)
  const step = useForge((s) => s.step)
  const Screen = SCREENS[step]

  return (
    <div className="relative min-h-screen">
      <Background />
      <AnimatePresence mode="wait">
        {!launched ? (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.99 }} transition={{ duration: 0.4 }}>
            <Landing onLaunch={() => setLaunched(true)} />
          </motion.div>
        ) : (
          <motion.div key="lab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            <Shell onHome={() => setLaunched(false)}>
              <Screen />
            </Shell>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
