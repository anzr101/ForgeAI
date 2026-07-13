# 🔥 Forge — Open-weight LLM Fine-Tuning Laboratory

> GitHub + VSCode + Weights & Biases + Hugging Face, reimagined as one **cyberpunk workbench** built purely for LoRA / QLoRA experimentation.

Forge is an interactive laboratory for designing, running, analyzing, and shipping open-weight LLM fine-tunes. Configure a run, watch it **train live** (animated GPU utilization, streaming loss & eval curves, real-time trainer logs), compare checkpoints, quantize, deploy — then **export the exact runnable code** to reproduce it on real hardware.

## ✨ What makes it real

Forge runs a **fully simulated training engine driven by genuine math** — no GPU required to explore, yet nothing is faked hand-wavily:

- **Real parameter counts** — trainable LoRA params are computed from each model's true architecture (`r · (in + out)` per adapted projection × layers).
- **Real VRAM estimates** — a component breakdown (base · optimizer · gradients · activations · overhead) from actual quantization byte-widths and Adam state sizes.
- **Config-driven dynamics** — the loss curve, convergence speed, overfitting gap and instability all respond to your learning rate, rank, dataset and epochs, seeded for reproducibility.
- **Real code export** — every run generates a runnable `train.py` + Colab notebook using `transformers` · `peft` · `trl` · `bitsandbytes`, plus GGUF/AWQ/GPTQ quantization scripts.

## 🧭 The workflow

```
Model → Dataset → LoRA / QLoRA → Train → Evaluate → Compare → Quantize → Deploy → Export
```

## 🎛️ Covers the whole stack

`LoRA` · `QLoRA` · `PEFT` · `Transformers` · `HuggingFace` · `Datasets` · `TRL` · `W&B` · `Quantization` · `GGUF` · `AWQ` · `GPTQ` · `vLLM`

**Models:** Llama 3.2 (1B / 3B) · Phi-3 Mini · Mistral 7B · Gemma 2 2B
**Datasets:** Alpaca · Dolly 15K · OpenAssistant · GSM8K · CodeAlpaca · UltraChat 200K

## 🛠️ Tech

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Framer Motion. 100% client-side, custom SVG/canvas charts — no backend required.

## 🚀 Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## ☁️ Deploy

**Vercel (recommended):** Import this repo at [vercel.com/new](https://vercel.com/new) — it auto-detects Vite (`vercel.json` included). Every push redeploys.

**GitHub Pages:** Enable Pages → *Source: GitHub Actions*. The included workflow (`.github/workflows/deploy.yml`) builds and publishes `dist/` on every push to `main`.

---

Built by [@anzr101](https://github.com/anzr101).
