# 05 — `src/lib/format.ts` & `src/lib/io.ts` — utilities

Small, boring, everywhere. Formatters keep the neon numbers readable; io handles copy/download.

---

## `src/lib/format.ts` — display formatters

```ts
export const fmtInt   = n => n.toLocaleString('en-US')                 // 52002 → "52,002"
export function fmtParams(n) {                                          // 1.24e9 → "1.24B"
  if (n>=1e9) return (n/1e9).toFixed(n>=1e10?0:2)+'B'
  if (n>=1e6) return (n/1e6).toFixed(n>=1e8?1:1)+'M'
  if (n>=1e3) return (n/1e3).toFixed(1)+'K'
  return `${n}`
}
export function fmtBytes(mb) { return mb>=1024 ? (mb/1024).toFixed(2)+' GB' : mb.toFixed(1)+' MB' }
export const fmtPct = (x,d=2) => (x*100).toFixed(d)+'%'                // 0.0021 → "0.21%"
export function fmtDuration(sec) { … }                                  // 3725 → "1h 2m"
export const fmtLr = lr => lr.toExponential(2)                         // 0.0002 → "2.00e-4"
export function clsx(...parts) { return parts.filter(Boolean).join(' ') }
```
▸ **fmtParams** — the workhorse: adaptive precision so 1.24B, 340M, 16.0K all read cleanly. Used
for param counts, vocab sizes, context lengths.
▸ **fmtBytes** — auto-switches MB↔GB; used for adapter and checkpoint sizes.
▸ **fmtLr** — scientific notation, matching how HF prints learning rates in logs.
▸ **clsx** — a 1-line `classnames` clone: joins truthy class strings, drops falsy ones. Lets
components write `clsx('base', active && 'on')`. Used all over the UI.
▸ These are pure and dependency-free — the formatting layer between raw numbers and the render.

---

## `src/lib/io.ts` — clipboard + file download

```ts
export function useCopy(): [boolean, (text)=>void] {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(text => {
    const done = () => { setCopied(true); setTimeout(()=>setCopied(false), 1400) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(done)
    else { /* textarea + document.execCommand('copy') fallback */ ; done() }
  }, [])
  return [copied, copy]
}
```
▸ A reusable **hook** returning `[copied, copy]`. Calling `copy(text)` writes to the clipboard and
flips `copied` true for 1.4 s so buttons can show a ✓ then revert.
▸ Uses the modern `navigator.clipboard` API with a legacy `<textarea>`+`execCommand` fallback for
older/insecure contexts. Every "copy" button on the Quantize/Deploy/Export screens uses this.

```ts
export function download(filename, content, mime='text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```
▸ The classic "download a string as a file" trick: wrap the text in a `Blob`, make an object URL,
click a temporary `<a download>`, then revoke the URL to free memory. This is how `train.py`,
`requirements.txt`, and the `.ipynb` get saved — **entirely client-side, no server**.

---

**Takeaway:** these two files are the plumbing between pure data and the browser (strings→pixels,
strings→clipboard/files). Next: the module that ties everything together —
[`06-store-useForge.md`](06-store-useForge.md).
