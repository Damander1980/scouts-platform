// Pulsing placeholder cards shown while a page's data loads.
export default function Skeleton({ hero = true, cards = 3, rows = 4 }: { hero?: boolean; cards?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-5 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 rounded-xl" style={{ background: "#DDD6C5" }} />
      {hero && <div className="h-36 rounded-[20px]" style={{ background: "#C9D3E0" }} />}
      <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
        {Array.from({ length: cards }, (_, i) => <div key={i} className="card h-32" />)}
      </div>
      <div className="card flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => <div key={i} className="h-5 rounded-lg" style={{ background: "#EEE8D9", width: `${90 - i * 12}%` }} />)}
      </div>
    </div>
  );
}
