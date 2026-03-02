import React, { useState } from "react";

const FieldOpsQuickLocateSection = ({
  locatableExecutives,
  selectedExecutiveId,
  selectedPropertyId,
  mapProperties,
  onExecutiveSelect,
  onPropertySelect,
}) => {
  const [mobileMode, setMobileMode] = useState("executives");
  const showExecutives = mobileMode === "executives";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Quick Locate Lists
      </h2>
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
        Click rows to focus on map
      </p>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 xl:hidden">
      <button
        type="button"
        onClick={() => setMobileMode("executives")}
        className={`h-8 rounded-md text-xs font-semibold ${
          showExecutives ? "bg-white text-cyan-700 shadow-sm" : "text-slate-600"
        }`}
      >
        Executives ({locatableExecutives.length})
      </button>
      <button
        type="button"
        onClick={() => setMobileMode("properties")}
        className={`h-8 rounded-md text-xs font-semibold ${
          !showExecutives ? "bg-white text-amber-700 shadow-sm" : "text-slate-600"
        }`}
      >
        Properties ({mapProperties.length})
      </button>
    </div>

    <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${showExecutives ? "" : "hidden xl:block"}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            Field Executives
          </p>
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
            {locatableExecutives.length}
          </span>
        </div>
        {locatableExecutives.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No executive locations available.</p>
        ) : (
          <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {locatableExecutives.map((row) => {
              const executiveId = String(row.executive._id);
              const active = executiveId === String(selectedExecutiveId);

              return (
                <button
                  key={`loc-exec-${executiveId}`}
                  type="button"
                  onClick={() => onExecutiveSelect(row)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {row.executive.name || "Executive"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.markerMode === "live" ? "Live location" : `Estimated: ${row.markerCity}`}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${showExecutives ? "hidden xl:block" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
            Properties
          </p>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
            {mapProperties.length}
          </span>
        </div>
        {mapProperties.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No property locations available.</p>
        ) : (
          <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {mapProperties.map((asset) => {
              const propertyId = String(asset._id || "");
              const active = propertyId === String(selectedPropertyId);

              return (
                <button
                  key={`loc-property-${propertyId}`}
                  type="button"
                  onClick={() => onPropertySelect(asset)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {asset.title || "Property"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {asset.location || "Location unavailable"}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </section>
  );
};

export default FieldOpsQuickLocateSection;
