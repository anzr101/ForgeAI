# Forge — Documentation & Reverse-Engineering Guide

This folder is a complete map of the Forge codebase. It is written so you (or an LLM like
**NotebookLM**) can reconstruct the entire project from first principles.

## How to use these docs

| If you want to… | Read |
|---|---|
| Understand the big picture in 5 minutes | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Trace exactly what happens during a training run | [`DATA_FLOW.md`](DATA_FLOW.md) |
| Feed the whole project into NotebookLM / an LLM | [`NOTEBOOKLM_SOURCE.md`](NOTEBOOKLM_SOURCE.md) |
| Read every source file line-by-line | [`annotated/`](annotated/) |

## Reading order (recommended)

1. **ARCHITECTURE.md** — the mental model: layers, folders, and how they connect.
2. **DATA_FLOW.md** — a step-by-step trace of one training run from click to chart.
3. **annotated/** — deep dives, in dependency order:
   1. [`01-types-and-data.md`](annotated/01-types-and-data.md) — the vocabulary (types) and datasets
   2. [`02-lib-lora.md`](annotated/02-lib-lora.md) — the real LoRA/VRAM math (the "physics")
   3. [`03-lib-schedule.md`](annotated/03-lib-schedule.md) — the simulation engine (RNG, loss, LR)
   4. [`04-lib-codegen.md`](annotated/04-lib-codegen.md) — the real-code exporter
   5. [`05-lib-format-io.md`](annotated/05-lib-format-io.md) — formatting + clipboard/download
   6. [`06-store-useForge.md`](annotated/06-store-useForge.md) — the Zustand store & the tick loop (the "heart")
   7. [`07-charts.md`](annotated/07-charts.md) — the SVG chart primitives
   8. [`08-components.md`](annotated/08-components.md) — UI primitives, background, visualizer, console
   9. [`09-screens.md`](annotated/09-screens.md) — the 9 workflow screens
   10. [`10-app-and-config.md`](annotated/10-app-and-config.md) — entry point, routing, build config

## One-paragraph summary

Forge is a **100% client-side React app** that *simulates* LLM fine-tuning. There is no
backend and no GPU. A single **Zustand store** (`src/store/useForge.ts`) holds all state and
runs a `setInterval` "tick" loop that advances a simulated training run. The numbers the loop
produces are **not random noise** — they come from real math in `src/lib/` (true LoRA
parameter counts, VRAM estimates, learning-rate schedules, and a seeded loss model). React
components subscribe to the store and render the numbers as neon charts. When you're done, the
same config object is fed to a **code generator** (`src/lib/codegen.ts`) that emits a genuinely
runnable `train.py` + Colab notebook.

The golden rule: **config → math → store state → React render.** Everything follows that arrow.
