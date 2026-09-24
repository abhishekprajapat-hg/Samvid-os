import React from "react";
import { EmptyState, Skeleton, cn } from "../ui";

/**
 * Dense data table shared by the pipeline, dashboards and inventory screens.
 *
 * @param {Array}    columns           [{ key, header, width, align, render, hidden }].
 *                                     `render(row, index)` returns a node; without it the
 *                                     raw `row[key]` is printed. `align: "right"|"center"`.
 *                                     `hidden: true` drops the column, for role gating.
 * @param {Array}    rows              Row objects.
 * @param {Function} rowKey            (row, index) => key. Defaults to row.id, else index.
 * @param {boolean}  selectable        Render the leading checkbox column.
 * @param {Array}    selectedKeys      Keys currently selected.
 * @param {Function} onSelectionChange (nextKeys) => void.
 * @param {Function} onRowClick        (row) => void. Also makes rows keyboard-activatable.
 * @param {Function} rowActions        (row, index) => node. Shown on hover and focus-within.
 * @param {boolean}  loading           Render skeleton rows instead of content.
 * @param {node}     emptyState        Rendered in place of the table when there are no rows.
 * @param {boolean}  stickyHeader      Default true.
 * @param {boolean}  dense             Default true. False loosens the row padding.
 * @param {string}   className         Merged onto the scroll container.
 */
const DataTable = ({
  columns = [],
  rows = [],
  rowKey,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  onRowClick,
  rowActions,
  loading = false,
  emptyState,
  stickyHeader = true,
  dense = true,
  className,
}) => {
  const visible = columns.filter((column) => !column.hidden);
  const keyOf = (row, index) => String(rowKey ? rowKey(row, index) : (row?.id ?? index));
  const selected = new Set(selectedKeys.map(String));

  const allSelected = rows.length > 0 && rows.every((row, index) => selected.has(keyOf(row, index)));
  const someSelected = !allSelected && rows.some((row, index) => selected.has(keyOf(row, index)));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : rows.map((row, index) => keyOf(row, index)));
  };

  const toggleOne = (key) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange([...next]);
  };

  const alignOf = (column) =>
    column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left";

  // Columns of figures only line up if the digits are tabular.
  const numericOf = (column) => (column.align === "right" ? "tabular-nums" : null);

  const cellPad = dense ? "px-3 py-2.5" : "px-3 py-3.5";
  const headCell = cn(
    "border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900",
    stickyHeader && "sticky top-0 z-10",
  );
  const bodyCell = "border-b border-slate-200 dark:border-slate-800";
  const columnCount = visible.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  if (!loading && rows.length === 0) {
    return <div className={className}>{emptyState || <EmptyState />}</div>;
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {selectable ? (
              <th scope="col" className={cn(headCell, "w-10")}>
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-blue-600"
                />
              </th>
            ) : null}
            {visible.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  headCell,
                  "whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400",
                  alignOf(column),
                )}
              >
                {column.header}
              </th>
            ))}
            {rowActions ? (
              <th scope="col" className={cn(headCell, "w-px")}>
                <span className="sr-only">Row actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  {Array.from({ length: columnCount }).map((__, cell) => (
                    <td key={cell} className={cn(cellPad, bodyCell)}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, index) => {
                const key = keyOf(row, index);
                const isSelected = selected.has(key);

                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.target !== event.currentTarget) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      "group/row outline-none transition-colors",
                      "hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-800/50 dark:focus-visible:bg-slate-800/50",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-blue-50 dark:bg-blue-500/10",
                    )}
                  >
                    {selectable ? (
                      <td className={cn(cellPad, bodyCell)}>
                        <input
                          type="checkbox"
                          aria-label={`Select row ${index + 1}`}
                          checked={isSelected}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleOne(key)}
                          className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-blue-600"
                        />
                      </td>
                    ) : null}
                    {visible.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          cellPad,
                          bodyCell,
                          "align-middle text-slate-700 dark:text-slate-300",
                          alignOf(column),
                          numericOf(column),
                        )}
                      >
                        {column.render ? column.render(row, index) : (row?.[column.key] ?? null)}
                      </td>
                    ))}
                    {rowActions ? (
                      <td
                        className={cn(cellPad, bodyCell, "text-right")}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {/* Keyboard users reach these through focus-within, never hover. */}
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
                          {rowActions(row, index)}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
