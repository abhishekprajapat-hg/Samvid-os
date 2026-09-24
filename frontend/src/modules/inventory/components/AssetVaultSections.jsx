import React from "react";
import {
  Armchair,
  Building2,
  CarFront,
  ChevronDown,
  Coffee,
  Grid2X2,
  IndianRupee,
  Layers3,
  Plus,
  Sparkles,
  UsersRound,
} from "lucide-react";

export const AssetVaultToolbar = ({ modeType, onModeChange, canOpenCreateModal, onOpenAddModal }) => (
  <div className="flex flex-col items-start gap-4 z-10 xl:flex-row xl:items-end xl:justify-end">
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
          <Plus size={16} /> Add Asset
        </button>
      )}
    </div>
  </div>
);

const InventoryFilterControl = ({ icon: Icon, label, children, className = "" }) => (
  <label className={`inventory-reference-filter relative inline-flex h-10 min-w-[112px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm transition hover:border-blue-200 ${className}`}>
    {React.createElement(Icon, { size: 17, className: "shrink-0 text-slate-700", strokeWidth: 1.9 })}
    <span className="pointer-events-none min-w-0 flex-1 truncate">{label}</span>
    {children}
    <ChevronDown size={15} className="pointer-events-none shrink-0 text-slate-500" />
  </label>
);

export const AssetVaultFilters = ({
  inventoryTypeFilter,
  onInventoryTypeFilterChange,
  canChooseInventoryRoleType = true,
  furnishingFilter,
  onFurnishingFilterChange,
  bhkFilter,
  onBhkFilterChange,
  cabinsFilter,
  onCabinsFilterChange,
  seatsFilter,
  onSeatsFilterChange,
  budgetRangeFilter,
  onBudgetRangeFilterChange,
  floorFilter,
  onFloorFilterChange,
  parkingFilter,
  onParkingFilterChange,
  pantryFilter,
  onPantryFilterChange,
  amenitiesFilter,
  onAmenitiesFilterChange,
}) => (
  <div className="inventory-filter-panel z-20 space-y-2 bg-transparent p-0">
    <div className="inventory-reference-filter-row flex flex-wrap items-center gap-2">
      <InventoryFilterControl icon={Building2} label={inventoryTypeFilter === "RESIDENTIAL" ? "Residential" : "Commercial"}>
        {canChooseInventoryRoleType ? (
          <select aria-label="Inventory type" value={inventoryTypeFilter} onChange={(event) => onInventoryTypeFilterChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
            <option value="all">All inventory types</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="RESIDENTIAL">Residential</option>
          </select>
        ) : null}
      </InventoryFilterControl>
      <InventoryFilterControl icon={Armchair} label={furnishingFilter ? furnishingFilter.replace(/_/g, " ") : "Furnishing"}>
        <select aria-label="Furnishing" value={furnishingFilter} onChange={(event) => onFurnishingFilterChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0"><option value="">All furnishing</option><option value="UNFURNISHED">Unfurnished</option><option value="SEMI_FURNISHED">Semi Furnished</option><option value="FULLY_FURNISHED">Fully Furnished</option><option value="BARE_SHELL">Bare Shell</option><option value="WARM_SHELL">Warm Shell</option><option value="MANAGED_OFFICE">Managed Office</option><option value="COWORKING">Coworking</option></select>
      </InventoryFilterControl>
      <InventoryFilterControl icon={Grid2X2} label={bhkFilter || "BHK"}>
        <select aria-label="BHK" value={bhkFilter} onChange={(event) => onBhkFilterChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0"><option value="">All BHK</option><option value="1BHK">1 BHK</option><option value="2BHK">2 BHK</option><option value="3BHK">3 BHK</option><option value="4BHK">4 BHK</option><option value="5BHK">5 BHK</option></select>
      </InventoryFilterControl>
      <InventoryFilterControl icon={CarFront} label={parkingFilter === "true" ? "Parking" : parkingFilter === "false" ? "No parking" : "Parking"}>
        <select aria-label="Parking" value={parkingFilter} onChange={(event) => onParkingFilterChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0"><option value="">All parking</option><option value="true">Parking Available</option><option value="false">No Parking</option></select>
      </InventoryFilterControl>
      <InventoryFilterControl icon={Coffee} label={pantryFilter === "true" ? "Pantry" : pantryFilter === "false" ? "No pantry" : "Pantry"}>
        <select aria-label="Pantry" value={pantryFilter} onChange={(event) => onPantryFilterChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0"><option value="">All pantry</option><option value="true">Pantry Yes</option><option value="false">Pantry No</option></select>
      </InventoryFilterControl>
      <InventoryFilterControl icon={UsersRound} label={cabinsFilter ? `${cabinsFilter} cabins` : "Cabins"}>
        <input aria-label="Minimum cabins" type="number" min="0" value={cabinsFilter} onChange={(event) => onCabinsFilterChange(event.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0" />
      </InventoryFilterControl>
      <InventoryFilterControl icon={UsersRound} label={seatsFilter ? `${seatsFilter} seats` : "Seats"}>
        <input aria-label="Minimum seats" type="number" min="0" value={seatsFilter} onChange={(event) => onSeatsFilterChange(event.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0" />
      </InventoryFilterControl>
      <InventoryFilterControl icon={Layers3} label={floorFilter ? `Floor ${floorFilter}` : "Floor"}>
        <input aria-label="Minimum floor" type="number" min="0" value={floorFilter} onChange={(event) => onFloorFilterChange(event.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0" />
      </InventoryFilterControl>
      <InventoryFilterControl icon={IndianRupee} label={budgetRangeFilter || "Budget"}>
        <input aria-label="Budget range" type="text" value={budgetRangeFilter} onChange={(event) => onBudgetRangeFilterChange(event.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0" />
      </InventoryFilterControl>
      <InventoryFilterControl icon={Sparkles} label={amenitiesFilter || "Amenities"}>
        <input aria-label="Amenities" type="text" value={amenitiesFilter} onChange={(event) => onAmenitiesFilterChange(event.target.value)} className="absolute inset-0 w-full cursor-pointer opacity-0" />
      </InventoryFilterControl>
    </div>
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
  if (!canManage || pendingRequests.length === 0) return null;

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
            const isDeleteRequest = request.type === "delete";
            const proposedData = request.proposedData || {};
            const currentInventory = request.inventoryId || {};
            const inventoryLabel = isCreateRequest
              ? getInventoryUnitLabel(proposedData)
              : getInventoryUnitLabel(currentInventory);
            const currentStatus = currentInventory?.status || "-";
            const requestedStatus = proposedData?.status || "Available";
            const detailSource = isCreateRequest || isDeleteRequest ? proposedData : currentInventory;
            const requestedFields = !isCreateRequest && !isDeleteRequest
              ? Object.entries(proposedData).filter(([key]) => requestFieldLabels[key])
              : [];
            const detailLocation = detailSource?.location || "-";
            const detailCoordinates = formatRequestValue("siteLocation", detailSource?.siteLocation);
            const detailPrice = formatCurrency(detailSource?.price);
            const detailDeposit =
              String(detailSource?.type || "").trim().toUpperCase() === "RENT"
                ? formatCurrency(detailSource?.deposit)
                : "-";
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">
                      {inventoryLabel}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      By: {request.requestedBy?.name || "Unknown"} ({request.requestedBy?.role || "-"})
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600">
                      {isDeleteRequest
                        ? "Delete inventory request"
                        : isCreateRequest
                        ? `New inventory request (${requestedStatus})`
                        : `${currentStatus} to ${requestedStatus}`}
                    </p>

                    <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-2">
                      <p>
                        <span className="font-semibold text-slate-700">Location:</span> {detailLocation}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Coordinates:</span> {detailCoordinates}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Price:</span> {detailPrice}
                      </p>
                      {String(detailSource?.type || "").trim().toUpperCase() === "RENT" ? (
                        <p>
                          <span className="font-semibold text-slate-700">Deposit:</span> {detailDeposit}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-semibold text-slate-700">Status:</span> {detailStatus}
                      </p>
                      {String(detailStatus || "").toLowerCase() === "sold" && detailSource?.saleDetails ? (
                        <p className="sm:col-span-2">
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
                        <div className="mt-1 grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-2">
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

                    {request.requestNote ? (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        Reason: {request.requestNote}
                      </p>
                    ) : null}

                    {!isCreateRequest && linkedInventoryId && (
                      <button
                        onClick={() => onViewInventory(linkedInventoryId)}
                        className="mt-2 text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 underline"
                      >
                        View full property details
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 sm:shrink-0">
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
