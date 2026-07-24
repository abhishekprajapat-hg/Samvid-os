import React from "react";
import { Filter, LayoutGrid, Plus, Search, Table2 } from "lucide-react";

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

export const AssetVaultFilters = ({
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  advancedFiltersOpen,
  onToggleAdvancedFilters,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  inventoryTypeFilter,
  onInventoryTypeFilterChange,
  furnishingFilter,
  onFurnishingFilterChange,
  bhkFilter,
  onBhkFilterChange,
  cabinsFilter,
  onCabinsFilterChange,
  seatsFilter,
  onSeatsFilterChange,
  areaRangeFilter,
  onAreaRangeFilterChange,
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
  <div className="z-20 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur md:space-y-3 md:p-3">
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_220px]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search project, tower, unit, city, area, property ID"
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="hidden rounded-xl border border-slate-200 bg-slate-50 p-1 md:flex">
        <button
          type="button"
          onClick={() => onViewModeChange("cards")}
          className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold uppercase tracking-widest transition ${
            viewMode === "cards"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
          aria-pressed={viewMode === "cards"}
        >
          <LayoutGrid size={14} />
          Cards
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("table")}
          className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold uppercase tracking-widest transition ${
            viewMode === "table"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
          aria-pressed={viewMode === "table"}
        >
          <Table2 size={14} />
          Table
        </button>
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

    <button
      type="button"
      onClick={onToggleAdvancedFilters}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase tracking-widest text-slate-600 md:hidden"
    >
      <Filter size={14} />
      {advancedFiltersOpen ? "Hide Filters" : "More Filters"}
    </button>

    <div className={`${advancedFiltersOpen ? "grid" : "hidden"} grid-cols-1 gap-3 md:grid md:grid-cols-2 xl:grid-cols-4`}>
      <select
        value={inventoryTypeFilter}
        onChange={(event) => onInventoryTypeFilterChange(event.target.value)}
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="all">Inventory Type (All)</option>
        <option value="COMMERCIAL">Commercial</option>
        <option value="RESIDENTIAL">Residential</option>
      </select>

      <select
        value={furnishingFilter}
        onChange={(event) => onFurnishingFilterChange(event.target.value)}
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="">Furnishing (All)</option>
        <option value="UNFURNISHED">Unfurnished</option>
        <option value="SEMI_FURNISHED">Semi Furnished</option>
        <option value="FULLY_FURNISHED">Fully Furnished</option>
        <option value="BARE_SHELL">Bare Shell</option>
        <option value="WARM_SHELL">Warm Shell</option>
        <option value="MANAGED_OFFICE">Managed Office</option>
        <option value="COWORKING">Coworking</option>
      </select>

      <select
        value={bhkFilter}
        onChange={(event) => onBhkFilterChange(event.target.value)}
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="">BHK (All)</option>
        <option value="1BHK">1 BHK</option>
        <option value="2BHK">2 BHK</option>
        <option value="3BHK">3 BHK</option>
        <option value="4BHK">4 BHK</option>
        <option value="5BHK">5 BHK</option>
      </select>

      <input
        type="text"
        value={budgetRangeFilter}
        onChange={(event) => onBudgetRangeFilterChange(event.target.value)}
        placeholder="Budget Range (min-max)"
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      />

      <input
        type="text"
        value={areaRangeFilter}
        onChange={(event) => onAreaRangeFilterChange(event.target.value)}
        placeholder="Area Range (min-max)"
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      />

      <input
        type="number"
        min="0"
        value={cabinsFilter}
        onChange={(event) => onCabinsFilterChange(event.target.value)}
        placeholder="Cabins (min)"
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      />

      <input
        type="number"
        min="0"
        value={seatsFilter}
        onChange={(event) => onSeatsFilterChange(event.target.value)}
        placeholder="Seats (min)"
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      />

      <input
        type="number"
        min="0"
        value={floorFilter}
        onChange={(event) => onFloorFilterChange(event.target.value)}
        placeholder="Floor (min)"
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      />

      <select
        value={parkingFilter}
        onChange={(event) => onParkingFilterChange(event.target.value)}
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="">Parking (All)</option>
        <option value="true">Parking Available</option>
        <option value="false">No Parking</option>
      </select>

      <select
        value={pantryFilter}
        onChange={(event) => onPantryFilterChange(event.target.value)}
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      >
        <option value="">Pantry (All)</option>
        <option value="true">Pantry Yes</option>
        <option value="false">Pantry No</option>
      </select>

      <input
        type="text"
        value={amenitiesFilter}
        onChange={(event) => onAmenitiesFilterChange(event.target.value)}
        placeholder="Amenities (comma separated)"
        className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
      />
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
