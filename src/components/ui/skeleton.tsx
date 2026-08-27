import { type HTMLAttributes, forwardRef } from "react";

const Skeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden="true"
      className={`skeleton-shimmer ${className}`}
      {...props}
    />
  )
);
Skeleton.displayName = "Skeleton";

interface SkeletonTableRowsProps {
  rows?: number;
  cols?: number;
  colSpan?: number;
}

const SkeletonTableRows = forwardRef<
  HTMLTableSectionElement,
  SkeletonTableRowsProps & HTMLAttributes<HTMLTableSectionElement>
>(({ rows = 6, cols = 4, colSpan, className = "", ...props }, ref) => (
  <tbody
    ref={ref}
    aria-hidden="true"
    className={`${className}`}
    {...props}
  >
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} className="border-b border-border/50 last:border-0">
        <td colSpan={colSpan ?? cols} className="px-4 py-3">
          <div className="flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 flex-1 rounded skeleton-shimmer"
                style={{ maxWidth: `${Math.min(85, 60 + c * 8)}%` }}
              />
            ))}
          </div>
        </td>
      </tr>
    ))}
  </tbody>
));
SkeletonTableRows.displayName = "SkeletonTableRows";

interface SkeletonListRowsProps {
  rows?: number;
}

const SkeletonListRows = forwardRef<
  HTMLDivElement,
  SkeletonListRowsProps & HTMLAttributes<HTMLDivElement>
>(({ rows = 8, className = "", ...props }, ref) => (
  <div ref={ref} aria-hidden="true" className={`divide-y divide-border/50 ${className}`} {...props}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 rounded-xl skeleton-shimmer shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 w-1/3 rounded skeleton-shimmer" />
          <div className="h-3 w-2/3 rounded skeleton-shimmer" />
          <div className="h-3 w-1/4 rounded skeleton-shimmer" />
        </div>
        <div className="h-4 w-16 rounded-full skeleton-shimmer shrink-0 self-center" />
      </div>
    ))}
  </div>
));
SkeletonListRows.displayName = "SkeletonListRows";

const SkeletonDetail = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", ...props }, ref) => (
    <div ref={ref} aria-hidden="true" className={`flex flex-col gap-3 ${className}`} {...props}>
      <div className="shrink-0 neu-flat rounded-xl p-4 space-y-3">
        <div className="h-4 w-1/3 rounded skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
        <div className="h-5 w-20 rounded skeleton-shimmer" />
      </div>
      <div className="shrink-0 neu-flat rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="h-8 rounded skeleton-shimmer" />
          <div className="h-8 rounded skeleton-shimmer" />
          <div className="h-8 rounded skeleton-shimmer" />
          <div className="h-8 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="neu-flat rounded-xl p-5 flex-1 min-h-0 space-y-2">
        <div className="h-3 w-full rounded skeleton-shimmer" />
        <div className="h-3 w-full rounded skeleton-shimmer" />
        <div className="h-3 w-5/6 rounded skeleton-shimmer" />
        <div className="h-3 w-4/6 rounded skeleton-shimmer" />
        <div className="h-3 w-full rounded skeleton-shimmer" />
      </div>
    </div>
  )
);
SkeletonDetail.displayName = "SkeletonDetail";

export { Skeleton, SkeletonTableRows, SkeletonListRows, SkeletonDetail };