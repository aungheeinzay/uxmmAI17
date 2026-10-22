export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading dashboard" role="status">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-10 w-96 max-w-full animate-pulse rounded-full bg-muted" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-5 w-44 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-52 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="rounded-[20px] border border-border bg-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="h-5 w-52 animate-pulse rounded bg-muted" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="mt-6 h-48 animate-pulse rounded-xl bg-muted" />
      </div>
      <span className="sr-only">Loading parcel dashboard</span>
    </div>
  );
}
