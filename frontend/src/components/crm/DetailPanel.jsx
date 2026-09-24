import React from "react";
import { Tabs, TabButton, cn } from "../ui";

/**
 * Record panel whose identity header stays put while the body scrolls, so you
 * never lose track of whose record you are looking at.
 *
 * @param {node}     title       Record name.
 * @param {node}     subtitle    Secondary identity line, e.g. a phone number.
 * @param {node}     badges      Status and source badges, rendered under the title.
 * @param {node}     actions     Primary action row, rendered at the header's right.
 * @param {node}     media       Optional leading slot, e.g. an avatar.
 * @param {Array}    tabs        [{ key, label }]. Omitted entirely when empty.
 * @param {string}   activeTab   Key of the active tab.
 * @param {Function} onTabChange (key) => void.
 * @param {node}     children    Panel body.
 * @param {string}   className   Merged onto the panel.
 */
const DetailPanel = ({
  title,
  subtitle,
  badges,
  actions,
  media,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  className,
}) => (
  <section
    className={cn(
      "flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-crm-card",
      "dark:border-slate-700 dark:bg-slate-900",
      className,
    )}
  >
    {/* Sticky within the panel, not the page - the body below is what scrolls. */}
    <header className="sticky top-0 z-10 rounded-t-xl border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        {media ? <div className="shrink-0">{media}</div> : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold tracking-[-0.018em] text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          {badges ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div> : null}
        </div>
      </div>
      {actions ? <div className="mt-3.5 flex flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>

    {tabs.length ? (
      <Tabs className="gap-4 px-4">
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            active={tab.key === activeTab}
            onClick={() => onTabChange?.(tab.key)}
          >
            {tab.label}
          </TabButton>
        ))}
      </Tabs>
    ) : null}

    <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
  </section>
);

export default DetailPanel;
