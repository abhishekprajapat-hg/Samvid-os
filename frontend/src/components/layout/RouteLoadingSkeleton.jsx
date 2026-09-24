import BrandLogo from "../common/BrandLogo";
import { Skeleton } from "../ui";
import Loader from "./Loader";

const RouteLoadingSkeleton = ({ compact = false }) => (
  <div
    className={`flex min-h-0 flex-1 flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${
      compact ? "p-5" : "p-4 sm:p-6"
    }`}
    aria-busy="true"
    aria-live="polite"
  >
    <div className="flex items-center gap-3">
      <div className="brand-logo-frame flex h-11 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <BrandLogo className="h-full w-full" />
      </div>
      <div className="min-w-0 flex-1">
        <Skeleton className="h-3 w-28 rounded-full" />
        <Skeleton className="mt-2 h-7 w-52 max-w-[70vw] rounded-lg" />
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Loader />
      </div>
    </div>

    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>

    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Skeleton className="h-10 rounded-xl" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    </div>
  </div>
);

export default RouteLoadingSkeleton;
