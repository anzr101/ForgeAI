# 10 — Entry point & build config

The glue that mounts the app and the config that ships it.

---

## `src/main.tsx` — mount

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>)
import './index.css'
```
▸ Standard React 18 root mount into `#root` (defined in `index.html`). `StrictMode` double-invokes
effects in dev to surface bugs. Imports the global stylesheet once.

---

## `src/App.tsx` — routing (there is no router)

```tsx
const SCREENS: Record<Step, () => JSX.Element> = {
  model:ModelStep, dataset:DatasetStep, lora:LoraStep, train:TrainStep, evaluate:EvaluateStep,
  compare:CompareStep, quantize:QuantizeStep, deploy:DeployStep, export:ExportStep }

export default function App() {
  const [launched, setLaunched] = useState(false)     // landing vs lab (local, not in store)
  const step = useForge(s => s.step)                   // which lab screen
  const Screen = SCREENS[step]
  return (<div>
    <Background/>
    <AnimatePresence mode="wait">
      {!launched
        ? <Landing onLaunch={()=>setLaunched(true)} />
        : <Shell onHome={()=>setLaunched(false)}><Screen/></Shell>}
    </AnimatePresence>
  </div>)
}
```
▸ **No react-router.** "Routing" is two switches: `launched` (a local boolean: Landing vs lab) and
`store.step` (which of the 9 screens). `SCREENS` is a lookup table `Step → component`; `Screen` is
the resolved component for the current step.
▸ `useForge(s => s.step)` uses a **selector** so `App` only re-renders when `step` changes, not on
every store mutation (important — the tick loop mutates the store 56×/run; App must not re-render
each time).
▸ `<AnimatePresence mode="wait">` cross-fades between Landing and the lab. `<Background/>` sits
behind everything.

---

## `src/index.css` — the design tokens

▸ Three parts: (1) `@tailwind base/components/utilities`; (2) raw CSS for the body (void-black
background, Inter font) and effects — `.cyber-grid` (the gridlines), `.radial-fade` (color wash),
custom neon scrollbars, the `log-line` slide-in keyframes; (3) an `@layer components` block that
defines the reusable classes the whole UI leans on: `.glass`/`.glass-2` (frosted panels),
`.neon-cyan`/`.neon-magenta`/`.neon-lime` (glowing text), `.chip`, `.label`, `.divider`,
`.text-gradient`. Editing these changes the look globally.

---

## `tailwind.config.js` — the palette & motion

▸ Extends Tailwind with the custom color names (`void`, `panel`, `line`, `cyan`, `magenta`, `lime`,
`amber`, `rose`), the `Inter`/`JetBrains Mono` font families, neon `boxShadow` presets, and
keyframes/animations (`pulse-glow`, `scan`, `flicker`, `fade-up`). `content` globs `index.html` +
`src/**/*.{ts,tsx}` so unused classes are purged from the production CSS.

---

## `vite.config.ts` — the bundler

```ts
export default defineConfig({ base: './', plugins:[react()], server:{ host:true, port:5173 } })
```
▸ `@vitejs/plugin-react` enables JSX/Fast-Refresh. **`base: './'`** is the deploy-portability
trick: it makes all asset URLs *relative*, so the identical `dist/` works both at a domain root
(Vercel) and under a sub-path like `/ForgeAI/` (GitHub Pages). `server.host:true` exposes the dev
server on the LAN.

---

## `tsconfig.json`, `package.json`

▸ **tsconfig** — strict TypeScript (`strict`, `noUnusedLocals`, `noUnusedParameters`),
`moduleResolution:'bundler'`, `jsx:'react-jsx'`, `noEmit` (Vite does the actual transpiling). Its
`include` covers `src` + `vite.config.ts`.
▸ **package.json scripts** — `dev` (Vite dev server), `build` (`tsc --noEmit && vite build` — type-
check *then* bundle), `preview` (serve the built `dist`). Runtime deps: `react`, `react-dom`,
`zustand`, `framer-motion`. Everything else is dev-only (Vite, TS, Tailwind, PostCSS).

---

## Deployment files

- **`.github/workflows/deploy.yml`** — on push to `main`: checkout → setup Node 20 → `npm ci` →
  `npm run build` → `upload-pages-artifact` (the `dist/` folder) → `deploy-pages`. Requires Pages
  "Source: GitHub Actions" enabled. This is what publishes `https://anzr101.github.io/ForgeAI/`.
- **`vercel.json`** — declares the Vite framework, build command, `dist` output, and an SPA
  rewrite, so importing the repo on Vercel "just works."
- **`public/forge.svg`** — the flame favicon (copied verbatim to `dist/` by Vite).

---

## Mental model of a build

```
npm run build
  └─ tsc --noEmit        # fail fast on any type error (no output emitted)
  └─ vite build          # bundle src/* → dist/  (index.html + hashed JS + CSS)
        │
        ▼
     dist/  ──(GitHub Action or Vercel)──▶  static hosting  ──▶  https URL
```

▸ Because the app is 100% static (no server code), "deploy" just means "serve `dist/`." That's why
both GitHub Pages and Vercel work with zero backend configuration.

---

**Takeaway:** the app boots with two booleans of routing, is themed entirely through CSS tokens +
Tailwind, and ships as a single static `dist/` that any host can serve. You've now seen every file.
Back to the [annotated index](README.md) or the [NotebookLM source](../NOTEBOOKLM_SOURCE.md).
