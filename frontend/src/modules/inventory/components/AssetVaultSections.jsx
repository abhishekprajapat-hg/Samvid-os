import React from "react";
import { Plus, Search } from "lucide-react";

export const AssetVaultToolbar = ({ modeType, onModeChange, canOpenCreateModal, canManage, onOpenAddModal }) => (
  <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 z-10">
    <div>
      <h1 className="font-display text-4xl text-slate-800 tracking-widest">
        ASSET <span className="text-emerald-600">VAULT</span>
      </h1>
      <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">
        Live Inventory Database
      </p>
    </div>

    <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
      <div className="bg-slate-200 p-1 rounded-full flex gap-1">
        <button
          onClick={() => onModeChange("sale")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
            modeType === "sale"
              ? "bg-white shadow-sm text-slate-800"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          For Sale
        </button>
        <button
          onClick={() => onModeChange("rent")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
            modeType === "rent"
              ? "bg-white shadow-sm text-amber-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Rentals
        </button>
      </div>

      {canOpenCreateModal && (
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg"
        >
          <Plus size={16} /> {canManage ? "Add Asset" : "Add Request"}
        </button>
      )}
    </div>
  </div>
);

export const AssetVaultFilters = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 z-10">
    <div className="md:col-span-2 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        type="text"
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search title, location, category"
        className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      />
    </div>

    <select
      value={statusFilter}
      onChange={(event) => onStatusFilterChange(event.target.value)}
      className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
    >
      <option value="all">All statuses</option>
      {statusOptions.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  </div>
);

export const PendingInventoryRequestsPanel = ({
  canManage,
  pendingRequests,
  reviewingRequestId,
  requestFieldLabels,
  getInventoryUnitLabel,
  formatRequestValue,
  formatCurrency,
  onApprove,
  onReject,
  onViewInventory,
}) => {
  if (!canManage) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Pending Inventory Requests
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
          {pendingRequests.length}
        </span>
      </div>

      {pendingRequests.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">No pending requests</p>
      ) : (
        <div className="mt-3 space-y-2">
          {pendingRequests.map((request) => {
            const requestId = String(request._id || "");
            const isCreateRequest = request.type === "create";
            const proposedData = request.proposedData || {};
            const currentInventory = request.inventoryId || {};
            const inventoryLabel = isCreateRequest
              ? getInventoryUnitLabel(proposedData)
              : getInventoryUnitLabel(currentInventory);
            const currentStatus = currentInventory?.status || "-";
            const requestedStatus = proposedData?.status || "Available";
            const detailSource = isCreateRequest ? proposedData : currentInventory;
            const requestedFields = !isCreateRequest
              ? Object.entries(proposedData).filter(([key]) => requestFieldLabels[key])
              : [];
            const detailLocation = detailSource?.location || "-";
            const detailCoordinates = formatRequestValue("siteLocation", detailSource?.siteLocation);
            const detailPrice = formatCurrency(detailSource?.price);
            const detailStatus = isCreateRequest
              ? proposedData?.status || "Available"
              : currentStatus;
            const imageList = Array.isArray(detailSource?.images) ? detailSource.images : [];
            const documentList = Array.isArray(detailSource?.documents)
              ? detailSource.documents
              : [];
            const firstImage = imageList[0] || "";
            const linkedInventoryId = String(currentInventory?._id || "");
            const loadingReview = reviewingRequestId === requestId;
            const createdAt = request.createdAt ? new Date(request.createdAt) : null;
            const submittedAt =
              createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "-";

            return (
              <div
                key={requestId}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {inventoryLabel}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      By: {request.requestedBy?.name || "Unknown"} ({request.requestedBy?.role || "-"})
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600">
                      {isCreateRequest
                        ? `New inventory request (${requestedStatus})`
                        : `${currentStatus} to ${requestedStatus}`}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-700">Location:</span> {detailLocation}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Coordinates:</span> {detailCoordinates}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Price:</span> {detailPrice}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Status:</span> {detailStatus}
                      </p>
                      {String(detailStatus || "").toLowerCase() === "sold" && detailSource?.saleDetails ? (
                        <p className="col-span-2">
                          <span className="font-semibold text-slate-700">Sold Details:</span>{" "}
                          {formatRequestValue("saleDetails", detailSource.saleDetails)}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-semibold text-slate-700">Images:</span> {imageList.length}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Documents:</span> {documentList.length}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Submitted:</span>{" "}
                        {submittedAt}
                      </p>
                    </div>

                    {firstImage && (
                      <div className="mt-2">
                        <img
                          src={firstImage}
                          alt={inventoryLabel}
                          className="h-20 w-28 rounded-md border border-slate-200 object-cover"
                        />
                      </div>
                    )}

                    {!isCreateRequest && requestedFields.length > 0 && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Requested Changes
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                          {requestedFields.map(([key, value]) => (
                            <p key={`${requestId}-${key}`}>
                              <span className="font-semibold text-slate-700">
                                {requestFieldLabels[key] || key}:
                              </span>{" "}
                              {formatRequestValue(key, value)}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isCreateRequest && linkedInventoryId && (
                      <button
                        onClick={() => onViewInventory(linkedInventoryId)}
                        className="mt-2 text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 underline"
                      >
                        View full property details
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(requestId)}
                      disabled={loadingReview}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {loadingReview ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => onReject(requestId)}
                      disabled={loadingReview}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
