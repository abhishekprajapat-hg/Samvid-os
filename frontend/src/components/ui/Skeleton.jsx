import { cn } from "./utils";

const Skeleton = ({ className, ...props }) => (
  <div
    aria-hidden="true"
    className={cn("animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800", className)}
    {...props}
  />
);

export default Skeleton;
