import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../ui";

const Breadcrumbs = ({ items = [], className }) => {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <ChevronRight aria-hidden="true" size={12} className="text-slate-300 dark:text-slate-600" /> : null}
            {item.path && !isLast ? (
              <Link to={item.path} className="truncate hover:text-blue-600 dark:hover:text-blue-300">
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className={cn("truncate", isLast && "text-slate-800 dark:text-slate-200")}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
