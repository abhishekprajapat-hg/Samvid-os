import React, { useMemo, useState } from "react";
import { MessageCircle, NotebookPen, Phone } from "lucide-react";
import {
  ActivityFeed,
  DataTable,
  DetailPanel,
  FilterChips,
  StatCard,
  StatusBadge,
  StatusStepper,
  statusToStep,
} from "../../components/crm";
import { Button, IconButton, cn } from "../../components/ui";

/**
 * TEMPORARY review surface for the Phase 4 shared components. Mounted only in
 * development, and removed altogether in Phase 14.
 */

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "REQUESTED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT",
  "SITE_VISIT_OVERDUE",
  "MISSING_IN_ACTION",
  "NOT_PICKING_CALLS",
  "CLOSED",
  "LOST",
  "INVALID",
  "OWNER",
  "BROKER",
];

const FIRST = ["Rohan", "Sneha", "Vikram", "Aarti", "Nikhil", "Suresh", "Meera", "Gaurav"];
const LAST = ["Mehta", "Kulkarni", "Joshi", "Desai", "Pawar", "Patil", "Nair", "Thakur"];

const buildRows = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `lead-${index + 1}`,
    name: `${FIRST[index % FIRST.length]} ${LAST[(index * 3) % LAST.length]}`,
    phone: `+91 9${String(8000000000 + index * 7919).slice(0, 9)}`,
    status: LEAD_STATUSES[index % LEAD_STATUSES.length],
    requirement: index % 2 ? "Commercial · Lease" : "Residential · Rent",
    budget: `₹${(1 + (index % 9) * 0.4).toFixed(2)} L`,
    followUp: index % 3 === 0 ? "4d late" : index % 3 === 1 ? "Today · 4:00 PM" : "5 Sep",
  }));

const Section = ({ title, note, children }) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="text-[15px] font-semibold tracking-[-0.018em] text-slate-900 dark:text-slate-50">{title}</h2>
      {note ? <p className="mt-0.5 text-[13px] text-slate-600 dark:text-slate-400">{note}</p> : null}
    </div>
    {children}
  </section>
);

const KitchenSink = () => {
  const rows = useMemo(() => buildRows(200), []);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState([
    { id: "risk", label: "At risk", active: true },
    { id: "type", label: "Type", value: "Commercial", active: true },
    { id: "budget", label: "Budget", active: false },
    { id: "location", label: "Location", active: false },
    { id: "source", label: "Source", active: false },
  ]);

  const toggleFilter = (target) =>
    setFilters((current) =>
      current.map((filter) => (filter.id === target.id ? { ...filter, active: !filter.active } : filter)),
    );

  const columns = [
    {
      key: "name",
      header: "Lead",
      render: (row) => (
        <div className="min-w-0">
          <b className="block truncate text-[13.2px] font-semibold text-slate-900 dark:text-slate-100">{row.name}</b>
          <span className="block truncate font-mono text-[11.5px] text-slate-500 dark:text-slate-400">{row.phone}</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "requirement", header: "Requirement" },
    { key: "budget", header: "Budget", align: "right" },
    {
      key: "followUp",
      header: "Next follow-up",
      render: (row) => (
        <span
          className={cn(
            "font-semibold",
            row.followUp.includes("late") && "text-rose-600 dark:text-rose-400",
            row.followUp.startsWith("Today") && "text-amber-600 dark:text-amber-400",
          )}
        >
          {row.followUp}
        </span>
      ),
    },
    { key: "hiddenExample", header: "Assigned", hidden: true },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-[-0.018em] text-slate-900 dark:text-slate-50">
          Kitchen sink
        </h1>
        <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
          Temporary review surface for the Phase 4 shared components. Development builds only.
        </p>
      </header>

      <Section title="StatCard" note="Default and alert tones. The third is clickable.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Needs action" value="27" helper="18 overdue · 9 due today" tone="alert" />
          <StatCard label="Open pipeline" value="342" delta={{ direction: "up", label: "8.4%" }} helper="vs Aug" />
          <StatCard
            label="Closed — Sep"
            value="11"
            delta={{ direction: "down", label: "3" }}
            helper="vs Aug"
            onClick={() => {}}
          />
          <StatCard label="Approvals waiting" value="4" helper="2 payment · 2 inventory" />
        </div>
      </Section>

      <Section title="FilterChips" note="Active chips carry their own dismiss; inactive ones are dashed.">
        <FilterChips filters={filters} onToggle={toggleFilter} onRemove={toggleFilter} onAdd={() => {}} />
      </Section>

      <Section title="StatusStepper" note="All 14 statuses mapped onto five stages, or onto a side state.">
        <div className="grid gap-5 sm:grid-cols-2">
          {LEAD_STATUSES.map((status) => {
            const { stepKey, sideState } = statusToStep(status);
            return (
              <div key={status} className="flex flex-col gap-2">
                <StatusBadge status={status} className="w-fit" />
                <StatusStepper currentKey={stepKey} sideState={sideState} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="DataTable" note="200 rows, sticky header, selection, hover and focus row actions.">
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <DataTable
            columns={columns}
            rows={rows}
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            onRowClick={() => {}}
            rowActions={() => (
              <>
                <IconButton icon={Phone} label="Call" size="sm" />
                <IconButton icon={MessageCircle} label="WhatsApp" size="sm" />
                <IconButton icon={NotebookPen} label="Log an outcome" size="sm" />
              </>
            )}
          />
        </div>
        <p className="text-[13px] text-slate-600 dark:text-slate-400">{selectedKeys.length} selected</p>
      </Section>

      <Section title="DataTable — loading and empty">
        <DataTable columns={columns.slice(0, 3)} rows={[]} loading />
        <DataTable columns={columns.slice(0, 3)} rows={[]} />
      </Section>

      <Section title="DetailPanel + ActivityFeed" note="Header stays put while the body scrolls.">
        <DetailPanel
          className="max-h-[460px]"
          title="Rohan Mehta"
          subtitle="+91 98213 44120"
          media={
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-[13px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
              RM
            </div>
          }
          badges={
            <>
              <StatusBadge status="SITE_VISIT_OVERDUE" />
              <StatusBadge status="Meta lead" />
            </>
          }
          actions={
            <>
              <Button size="sm">Call</Button>
              <Button size="sm" variant="secondary">
                WhatsApp
              </Button>
              <Button size="sm" variant="secondary">
                Log
              </Button>
            </>
          }
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "requirement", label: "Requirement" },
            { key: "properties", label: "Properties" },
            { key: "activity", label: "Activity" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          <ActivityFeed
            items={[
              {
                id: "1",
                highlight: true,
                body: (
                  <>
                    <b className="font-semibold text-slate-900 dark:text-slate-100">Site visit no-show.</b> Client did
                    not reach Solitaire; will confirm a new slot by evening.
                  </>
                ),
                timestamp: "28 Aug, 4:40 PM",
                meta: "Priya N.",
              },
              { id: "2", body: "Shared 3 shortlisted options on WhatsApp.", timestamp: "26 Aug, 11:12 AM", meta: "Priya N." },
              {
                id: "3",
                body: (
                  <span className="flex flex-wrap items-center gap-1.5">
                    Status changed
                    <StatusBadge status="INTERESTED" />
                    <span aria-hidden="true">→</span>
                    <StatusBadge status="SITE_VISIT_SCHEDULED" />
                  </span>
                ),
                timestamp: "24 Aug, 6:02 PM",
                meta: "system",
              },
              { id: "4", body: "Budget revised up to ₹1.6 L after board approval.", timestamp: "22 Aug, 3:15 PM", meta: "Priya N." },
            ]}
          />
        </DetailPanel>
      </Section>
    </div>
  );
};

export default KitchenSink;
