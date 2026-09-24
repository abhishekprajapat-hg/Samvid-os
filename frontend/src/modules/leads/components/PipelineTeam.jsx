import React, { useMemo } from "react";
import { ArrowRight, Users } from "lucide-react";
import { EmptyState, Skeleton, cn } from "../../../components/ui";

const initialsOf = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
};

const titleCase = (value) => String(value || "")
  .replace(/_/g, " ")
  .toLowerCase()
  .replace(/\b\w/g, (character) => character.toUpperCase());

const employeeIdOf = (employee) => String(employee?._id || employee?.id || "").trim();

const PipelineTeam = ({ leads = [], employees = [], loading = false, onOpenEmployee, className }) => {
  const team = useMemo(() => {
    const byId = new Map();

    employees.forEach((employee) => {
      const id = employeeIdOf(employee);
      if (id) byId.set(id, {
        id,
        name: employee.name || employee.fullName || "Unnamed employee",
        role: employee.role,
        count: 0,
        statuses: new Map(),
      });
    });

    leads.forEach((lead) => {
      const assigned = lead?.assignedTo;
      const id = String(assigned?._id || assigned?.id || assigned || "").trim();
      if (!id) return;
      const current = byId.get(id) || {
        id,
        name: assigned?.name || "Unnamed employee",
        role: assigned?.role,
        count: 0,
        statuses: new Map(),
      };
      current.count += 1;
      const status = String(lead?.status || "NEW").toUpperCase();
      current.statuses.set(status, (current.statuses.get(status) || 0) + 1);
      byId.set(id, current);
    });

    return [...byId.values()]
      .filter((employee) => employee.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [employees, leads]);

  if (loading) {
    return (
      <div className={cn("grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="mt-4 h-8 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (!team.length) {
    return (
      <div className={cn("p-4", className)}>
        <EmptyState
          title="No assigned leads yet"
          description="Employees will appear here as soon as leads are assigned to them."
          icon={Users}
        />
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {team.map((employee) => {
        const topStatuses = [...employee.statuses.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        return (
          <button
            key={employee.id}
            type="button"
            onClick={() => onOpenEmployee?.(employee)}
            className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-crm-soft transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-600"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                  {initialsOf(employee.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-slate-900 dark:text-slate-100">{employee.name}</span>
                  <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{titleCase(employee.role) || "Employee"}</span>
                </span>
              </div>
              <ArrowRight size={17} className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
            </div>

            <div className="mt-5 flex items-end justify-between gap-3">
              <span>
                <span className="block text-2xl font-bold leading-none text-slate-900 dark:text-slate-100">{employee.count}</span>
                <span className="mt-1 block text-[11.5px] text-slate-500 dark:text-slate-400">Assigned leads</span>
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                {topStatuses.map(([status, count]) => (
                  <span key={status} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {titleCase(status)} {count}
                  </span>
                ))}
              </span>
            </div>
            <span className="mt-4 block text-[11.5px] font-semibold text-blue-600 dark:text-blue-400">Open employee leads</span>
          </button>
        );
      })}
    </div>
  );
};

export default PipelineTeam;
