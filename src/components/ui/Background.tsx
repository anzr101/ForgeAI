export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 radial-fade" />
      <div className="absolute inset-0 cyber-grid opacity-70" />
      {/* drifting orbs */}
      <div
        className="absolute -left-32 top-10 h-96 w-96 rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%)' }}
      />
      <div
        className="absolute -right-24 top-1/3 h-96 w-96 rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(232,121,249,0.16), transparent 70%)' }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 120% at 50% 0%, transparent 55%, rgba(0,0,0,0.55))' }}
      />
    </div>
  )
}
