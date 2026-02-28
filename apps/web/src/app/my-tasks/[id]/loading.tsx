export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-32 bg-muted rounded" />

      {/* Header */}
      <div className="space-y-3">
        <div className="h-7 w-2/3 bg-muted rounded" />
        <div className="flex gap-4">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
        <div className="h-2 w-full bg-muted rounded mt-4" />
      </div>

      {/* View toggle */}
      <div className="h-8 w-44 bg-muted rounded-lg" />

      {/* Item rows */}
      <div className="border rounded-xl overflow-hidden divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3">
            <div className="h-4 w-4 bg-muted rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="flex gap-3">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-3 w-12 bg-muted rounded" />
              </div>
            </div>
            <div className="flex gap-8 shrink-0">
              <div className="h-4 w-12 bg-muted rounded" />
              <div className="h-4 w-12 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
