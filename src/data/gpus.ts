export interface GpuSpec {
  id: string
  name: string
  vram: number // GB
  note: string
  tier: 'free' | 'consumer' | 'cloud' | 'datacenter'
}

// Reference cards for the "will it fit?" estimator.
export const GPUS: GpuSpec[] = [
  { id: 't4', name: 'NVIDIA T4', vram: 16, note: 'Free Colab / Kaggle', tier: 'free' },
  { id: 'rtx4090', name: 'RTX 4090', vram: 24, note: 'Consumer flagship', tier: 'consumer' },
  { id: 'a10g', name: 'A10G', vram: 24, note: 'AWS g5 / cloud', tier: 'cloud' },
  { id: 'a100-40', name: 'A100 40GB', vram: 40, note: 'Data-center', tier: 'datacenter' },
  { id: 'a100-80', name: 'A100 80GB', vram: 80, note: 'Data-center', tier: 'datacenter' },
]
