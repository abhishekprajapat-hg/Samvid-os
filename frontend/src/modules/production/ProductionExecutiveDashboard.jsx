import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Target,
  UserCheck,
} from "lucide-react";
import { getMyAttendance } from "../../services/attendanceService";
import { getTaskStats, getTasks } from "../../services/taskService";
import { toErrorMessage } from "../../utils/errorMessage";

const pct = (completed, total) => {
  const safeTotal = Number(total || 0);
  if (!safeTotal) return 0;
  return Math.round((Number(completed || 0) / safeTotal) * 100);
};

const formatDate = (value) => {
  if (!value) return "No deadline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const statusLabel = (value) =>
  String(value || "Not marked").replace(/_/g, " ").toLowerCase();

const Metric = ({ label, value, icon, tone = "cyan" }) => {
  const Icon = icon;
  const toneClass = {
    cyan: "bg-cyan-50 text-cyan-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </p>
        <span className={`rounded-lg p-2 ${toneClass}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
};

const ActionCard = ({ to, icon, title, subtitle }) => {
  const Icon = icon;

  return (
    <Link
      to={to}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Icon size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
};

const ProductionExecutiveDashboard = ({ mode = "home" }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [attendance, setAttendance] = useState(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [taskStats, taskRows, attendanceData] = await Promise.all([
          getTaskStats(),
          getTasks(),
          getMyAttendance(),
        ]);

        if (!alive) return;
        setStats(taskStats || {});
        setTasks(Array.isArray(taskRows) ? taskRows : []);
        setAttendance(attendanceData?.today || null);
      } catch (err) {
        if (alive) setError(toErrorMessage(err, "Failed to load production dashboard"));
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  const upcomingTasks = useMemo(() => {
    const now = new Date();
    return [...tasks]
      .filter((task) => task.status !== "COMPLETED")
      .sort((a, b) => {
        const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return left - right;
      })
      .slice(0, 5)
      .map((task) => ({
        ...task,
        isOverdue: task.dueDate && new Date(task.dueDate) < now,
      }));
  }, [tasks]);

  const completionRate = pct(stats?.COMPLETED, stats?.total);
  const heading =
    mode === "performance" ? "Performance Dashboard" : "Production Executive Dashboard";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-slate-500">
        Loading production workspace...
      </div>
    );
  }

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
                Production Workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 sm:text-3xl">
                {heading}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Tasks, attendance, internal communication, and personal output in one focused view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/tasks"
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
              >
                Open Tasks
              </Link>
              <Link
                to="/attendance"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
              >
                Attendance
              </Link>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Tasks Assigned" value={stats?.total || 0} icon={Target} />
          <Metric label="Tasks Completed" value={stats?.COMPLETED || 0} icon={CheckCircle2} tone="emerald" />
          <Metric label="Pending Tasks" value={stats?.pending || 0} icon={Clock3} tone="amber" />
          <Metric label="Overdue Tasks" value={stats?.overdue || 0} icon={CalendarClock} tone="rose" />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Upcoming Deadlines
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Today and next priorities</h2>
              </div>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                {completionRate}% complete
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {upcomingTasks.length ? upcomingTasks.map((task) => (
                <Link
                  key={task._id}
                  to="/tasks"
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-cyan-200 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.priority || "MEDIUM"} priority | {task.status || "TODO"}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold ${task.isOverdue ? "text-rose-600" : "text-slate-500"}`}>
                    {formatDate(task.dueDate)}
                  </span>
                </Link>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No pending task deadlines.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Attendance Status
              </p>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-2xl font-semibold capitalize text-slate-950">
                  {statusLabel(attendance?.status)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Check-in: {attendance?.checkIn ? new Date(attendance.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Check-out: {attendance?.checkOut ? new Date(attendance.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "-"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <ActionCard to="/chat" icon={MessageSquare} title="Team Messaging" subtitle="Open one-to-one and team conversations." />
              <ActionCard to="/profile" icon={UserCheck} title="Profile Settings" subtitle="Update identity and account details." />
              <ActionCard to="/tasks" icon={Bell} title="Task Notifications" subtitle="Review new assignments and deadline changes." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionExecutiveDashboard;
