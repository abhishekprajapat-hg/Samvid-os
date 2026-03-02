import React from "react";

const FieldOpsQuickLocateSection = ({
  locatableExecutives,
  selectedExecutiveId,
  selectedPropertyId,
  mapProperties,
  onExecutiveSelect,
  onPropertySelect,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
      Quick Locate Lists
    </h2>
    <p className="mt-1 text-xs text-slate-500">
      Click any row to zoom map to that location.
    </p>

    <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          Field Executives
        </p>
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
          Properties
        </p>
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

export default FieldOpsQuickLocateSection;

