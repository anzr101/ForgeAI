# Annotated Source Walkthroughs

Each file here mirrors one or more source files and explains **every meaningful line** — what it
does, why it exists, and how data flows through it. Read them in dependency order (bottom-up):
data → math → store → UI. That way each file only references things you've already seen.

| # | Doc | Covers source | Role |
|---|---|---|---|
| 01 | [types & data](01-types-and-data.md) | `types.ts`, `data/*.ts` | Vocabulary + real constants |
| 02 | [lib/lora](02-lib-lora.md) | `lib/lora.ts` | The LoRA/VRAM math ("physics") |
| 03 | [lib/schedule](03-lib-schedule.md) | `lib/schedule.ts` | The seeded simulation engine |
| 04 | [lib/codegen](04-lib-codegen.md) | `lib/codegen.ts` | Real train.py / notebook generator |
| 05 | [lib format & io](05-lib-format-io.md) | `lib/format.ts`, `lib/io.ts` | Formatters + clipboard/download |
| 06 | [store/useForge](06-store-useForge.md) | `store/useForge.ts` | State + the tick() loop (the heart) |
| 07 | [charts](07-charts.md) | `components/charts.tsx` | Hand-drawn SVG charts |
| 08 | [components](08-components.md) | `components/ui/*`, visualizer, console, icons | Reusable UI |
| 09 | [screens](09-screens.md) | `screens/*.tsx` | The 9 workflow steps |
| 10 | [app & config](10-app-and-config.md) | `App.tsx`, `main.tsx`, configs | Entry + build |

**Notation:** code is shown in blocks; annotations follow as `▸ line/range — explanation`.
