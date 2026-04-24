interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-container-high rounded-xl ${className}`}
      aria-hidden="true"
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
      <Skeleton className="h-3 w-24 rounded-md" />
      <Skeleton className="h-10 w-16 rounded-md" />
    </div>
  )
}

export function ReportCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-48 rounded-md" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full rounded-md mb-2" />
      <Skeleton className="h-4 w-3/4 rounded-md mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  )
}

export function SnapshotCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/10 flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-md" />
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <Skeleton className="h-10 w-20 rounded-md" />
    </div>
  )
}

export function TimelineChartSkeleton() {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}

export function FamilyCardSkeleton() {
  return (
    <div className="bg-surface-container-high p-8 rounded-2xl h-64 flex flex-col items-center justify-center">
      <Skeleton className="h-20 w-20 rounded-full mb-4" />
      <Skeleton className="h-5 w-24 rounded-md mb-2" />
      <Skeleton className="h-4 w-16 rounded-md mb-4" />
      <Skeleton className="h-3 w-20 rounded-md" />
    </div>
  )
}

export function InsightCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-4 w-full rounded-md mb-2" />
      <Skeleton className="h-4 w-5/6 rounded-md" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="px-8 pb-12 max-w-[1440px] mx-auto space-y-10" aria-label="Loading dashboard" role="status">
      <span className="sr-only">Loading dashboard content...</span>
      
      {/* Stats row skeleton */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </section>

      {/* Main grid skeleton */}
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Recent Reports */}
        <section className="flex-1 lg:flex-[0.65] space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="space-y-4">
            <ReportCardSkeleton />
            <ReportCardSkeleton />
            <ReportCardSkeleton />
          </div>
        </section>

        {/* Health Snapshot */}
        <section className="flex-1 lg:flex-[0.35] space-y-6">
          <Skeleton className="h-7 w-36 rounded-md" />
          <div className="space-y-4">
            <SnapshotCardSkeleton />
            <SnapshotCardSkeleton />
            <SnapshotCardSkeleton />
          </div>
        </section>
      </div>
    </div>
  )
}

export function ReportsListSkeleton() {
  return (
    <div className="px-8 pb-12 max-w-[1440px] mx-auto space-y-8" aria-label="Loading reports" role="status">
      <span className="sr-only">Loading reports...</span>
      
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-6 w-8 rounded-full" />
        </div>
      </div>

      {/* Search/filter skeleton */}
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-12 w-32 rounded-xl" />
        <Skeleton className="h-12 w-32 rounded-xl" />
      </div>

      {/* Reports list skeleton */}
      <div className="space-y-4">
        <ReportCardSkeleton />
        <ReportCardSkeleton />
        <ReportCardSkeleton />
        <ReportCardSkeleton />
      </div>
    </div>
  )
}

export function BiomarkerLibrarySkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading biomarker library" role="status">
      <span className="sr-only">Loading biomarker library…</span>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="hidden md:block" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest/80 p-8 md:p-10">
        <div className="flex flex-col md:flex-row gap-10">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-10 w-3/4 max-w-sm rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-10 w-48 rounded-md" />
          </div>
          <div className="w-full md:w-80 space-y-4">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ReportCardSkeleton />
        <ReportCardSkeleton />
        <ReportCardSkeleton />
        <ReportCardSkeleton />
        <ReportCardSkeleton />
        <ReportCardSkeleton />
      </div>
    </div>
  )
}

export function TimelineSkeleton() {
  return (
    <div className="px-8 pb-12 max-w-[1440px] mx-auto space-y-8" aria-label="Loading timeline" role="status">
      <span className="sr-only">Loading health timeline...</span>
      
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 rounded-md" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Chart skeleton */}
      <TimelineChartSkeleton />

      {/* Biomarker list skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InsightCardSkeleton />
        <InsightCardSkeleton />
        <InsightCardSkeleton />
        <InsightCardSkeleton />
      </div>
    </div>
  )
}
