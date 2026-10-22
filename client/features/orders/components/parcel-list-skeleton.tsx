export function ParcelListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading parcels">
      <div className="h-10 w-full max-w-xs animate-pulse rounded-lg bg-muted" />
      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="h-12 border-b border-border bg-muted/60" />
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 px-5 py-4">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading parcel list</span>
    </div>
  );
}
