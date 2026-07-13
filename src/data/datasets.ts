import type { DatasetInfo } from '../types'

export const DATASETS: DatasetInfo[] = [
  {
    id: 'alpaca',
    name: 'Alpaca',
    hf: 'tatsu-lab/alpaca',
    rows: 52_002,
    avgTokens: 96,
    task: 'Instruction following',
    format: 'alpaca',
    blurb: 'The classic 52K instruction-tuning set generated with self-instruct. A solid default.',
    sample: {
      instruction: 'Give three tips for staying healthy.',
      input: '',
      output:
        '1. Eat a balanced diet with plenty of vegetables.\n2. Exercise for at least 30 minutes a day.\n3. Get 7–8 hours of sleep each night.',
    },
  },
  {
    id: 'dolly',
    name: 'Databricks Dolly 15K',
    hf: 'databricks/databricks-dolly-15k',
    rows: 15_011,
    avgTokens: 118,
    task: 'Instruction / QA',
    format: 'alpaca',
    blurb: 'Human-written prompt/response pairs across brainstorming, classification and QA.',
    sample: {
      instruction: 'Why is the sky blue?',
      input: '',
      output:
        'Sunlight scatters off air molecules, and shorter blue wavelengths scatter more than longer red ones — a process called Rayleigh scattering.',
    },
  },
  {
    id: 'oasst1',
    name: 'OpenAssistant oasst1',
    hf: 'OpenAssistant/oasst1',
    rows: 84_437,
    avgTokens: 214,
    task: 'Multi-turn chat',
    format: 'chatml',
    blurb: 'Crowd-sourced, human-ranked assistant conversations. Great for chat-style tuning.',
    sample: {
      instruction: 'Can you explain what a transformer is in machine learning?',
      output:
        'A transformer is a neural network architecture built around self-attention, letting every token attend to every other token in parallel rather than sequentially.',
    },
  },
  {
    id: 'gsm8k',
    name: 'GSM8K',
    hf: 'openai/gsm8k',
    rows: 8_792,
    avgTokens: 156,
    task: 'Grade-school math',
    format: 'alpaca',
    blurb: 'Word problems with step-by-step solutions. Perfect for chain-of-thought reasoning.',
    sample: {
      instruction:
        'Natalia sold clips to 48 friends in April, then half as many in May. How many total?',
      output:
        'In May she sold 48 / 2 = 24 clips. Total = 48 + 24 = 72 clips. #### 72',
    },
  },
  {
    id: 'codealpaca',
    name: 'CodeAlpaca 20K',
    hf: 'sahil2801/CodeAlpaca-20k',
    rows: 20_022,
    avgTokens: 88,
    task: 'Code generation',
    format: 'alpaca',
    blurb: 'Instruction/code pairs for teaching a base model to write and explain code.',
    sample: {
      instruction: 'Write a Python function to reverse a string.',
      output: 'def reverse(s: str) -> str:\n    return s[::-1]',
    },
  },
  {
    id: 'ultrachat',
    name: 'UltraChat 200K',
    hf: 'HuggingFaceH4/ultrachat_200k',
    rows: 207_865,
    avgTokens: 328,
    task: 'Multi-turn chat',
    format: 'sharegpt',
    blurb: 'Large, filtered multi-turn dialogues — the SFT set behind Zephyr. Heavier runs.',
    sample: {
      instruction: 'Draft a short, friendly out-of-office email.',
      output:
        "Hi! I'm away until Monday with limited access to email. For anything urgent, please reach out to my teammate. I'll reply as soon as I'm back. Thanks!",
    },
  },
]

export const getDataset = (id: string) => DATASETS.find((d) => d.id === id) ?? DATASETS[0]
