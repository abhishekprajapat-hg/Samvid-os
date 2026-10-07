import React from "react";
import FittedImage from "../../../components/ui/FittedImage";
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

// Every filter is a native <select> laid invisibly over its pill, so a click
// opens a real dropdown with an "Any" option to clear it. (Cabins, seats, floor,
// budget and amenities used to be invisible text boxes: typing showed nothing
// and budget silently needed a hidden "min-max" format.)
const CABIN_FILTER_OPTIONS = ["1", "2", "3", "5", "10"];
const SEAT_FILTER_OPTIONS = ["5", "10", "20", "50", "100"];
const FLOOR_FILTER_OPTIONS = ["1", "3", "5", "10"];

const BUDGET_FILTER_GROUPS = [
  {
    label: "Sale price",
    options: [
      { value: "sale:0-2500000", label: "Under Rs 25 L" },
      { value: "sale:2500000-5000000", label: "Rs 25 L - 50 L" },
      { value: "sale:5000000-10000000", label: "Rs 50 L - 1 Cr" },
      { value: "sale:10000000-50000000", label: "Rs 1 Cr - 5 Cr" },
      { value: "sale:50000000-", label: "Above Rs 5 Cr" },
    ],
  },
  {
    label: "Monthly rent",
    options: [
      { value: "rent:0-25000", label: "Under Rs 25k /mo" },
      { value: "rent:25000-50000", label: "Rs 25k - 50k /mo" },
      { value: "rent:50000-100000", label: "Rs 50k - 1 L /mo" },
      { value: "rent:100000-200000", label: "Rs 1 L - 2 L /mo" },
      { value: "rent:200000-", label: "Above Rs 2 L /mo" },
    ],
  },
];

const AMENITY_FILTER_OPTIONS = [
  { value: "LIFT", label: "Lift" },
  { value: "POWER_BACKUP", label: "Power Backup" },
  { value: "CENTRAL_AC", label: "Central AC" },
  { value: "PARKING", label: "Parking" },
  { value: "SECURITY", label: "Security" },
  { value: "FIRE_SAFETY", label: "Fire Safety" },
  { value: "RECEPTION", label: "Reception" },
  { value: "PANTRY", label: "Pantry" },
  { value: "CAFETERIA", label: "Cafeteria" },
  { value: "SERVER_ROOM", label: "Server / IT Room" },
  { value: "STORAGE_ROOM", label: "Storage Room" },
  { value: "BREAKOUT_AREA", label: "Breakout Area" },
  { value: "INTERNET", label: "Internet / Wi-Fi" },
  { value: "GYM", label: "Gym" },
  { value: "SWIMMING_POOL", label: "Swimming Pool" },
  { value: "CLUBHOUSE", label: "Clubhouse" },
  { value: "MODULAR_KITCHEN", label: "Modular Kitchen" },
  { value: "GAS_PIPELINE", label: "Gas Pipeline" },
];

const FILTER_SELECT_CLASS = "absolute inset-0 cursor-pointer opacity-0";

const toTitleLabel = (value) =>
  String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

const budgetFilterLabel = (value) =>
  BUDGET_FILTER_GROUPS.flatMap((group) => group.options).find((option) => option.value === value)?.label || value;

const amenityFilterLabel = (value) =>
  AMENITY_FILTER_OPTIONS.find((option) => option.value === value)?.label || value;

/*
 * Filters that make sense for the chosen category only (R13): cabins, seats and
 * pantry describe offices, BHK describes homes. With "All" selected only the
 * filters every property shares are shown.
 */
export const AssetVaultFilters = ({
  inventoryTypeFilter,
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
  hasActiveFilters = false,
  onClearFilters,
}) => {
  const isCommercial = inventoryTypeFilter === "COMMERCIAL";
  const isResidential = inventoryTypeFilter === "RESIDENTIAL";
  return (
    <div className="inventory-filter-panel z-20 space-y-2 bg-transparent p-0">
      <div className="inventory-reference-filter-row flex flex-wrap items-center gap-2">
        <InventoryFilterControl icon={IndianRupee} label={budgetRangeFilter ? budgetFilterLabel(budgetRangeFilter) : "Budget"}>
          <select aria-label="Budget range" value={budgetRangeFilter} onChange={(event) => onBudgetRangeFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}>
            <option value="">Any budget</option>
            {BUDGET_FILTER_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </optgroup>
            ))}
          </select>
        </InventoryFilterControl>
        <InventoryFilterControl icon={Armchair} label={furnishingFilter ? toTitleLabel(furnishingFilter) : "Furnishing"}>
          <select aria-label="Furnishing" value={furnishingFilter} onChange={(event) => onFurnishingFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}><option value="">All furnishing</option><option value="UNFURNISHED">Unfurnished</option><option value="SEMI_FURNISHED">Semi Furnished</option><option value="FULLY_FURNISHED">Fully Furnished</option><option value="BARE_SHELL">Bare Shell</option><option value="WARM_SHELL">Warm Shell</option><option value="MANAGED_OFFICE">Managed Office</option><option value="COWORKING">Coworking</option></select>
        </InventoryFilterControl>
        {isResidential ? (
          <InventoryFilterControl icon={Grid2X2} label={bhkFilter ? bhkFilter.replace("BHK", " BHK") : "BHK"}>
            <select aria-label="BHK" value={bhkFilter} onChange={(event) => onBhkFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}><option value="">All BHK</option><option value="1BHK">1 BHK</option><option value="2BHK">2 BHK</option><option value="3BHK">3 BHK</option><option value="4BHK">4 BHK</option><option value="5BHK">5 BHK</option></select>
          </InventoryFilterControl>
        ) : null}
        {isCommercial ? (
          <>
            <InventoryFilterControl icon={UsersRound} label={cabinsFilter ? `${cabinsFilter}+ cabins` : "Cabins"}>
              <select aria-label="Minimum cabins" value={cabinsFilter} onChange={(event) => onCabinsFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}>
                <option value="">Any cabins</option>
                {CABIN_FILTER_OPTIONS.map((value) => <option key={value} value={value}>{value}+ cabins</option>)}
              </select>
            </InventoryFilterControl>
            <InventoryFilterControl icon={UsersRound} label={seatsFilter ? `${seatsFilter}+ seats` : "Seats"}>
              <select aria-label="Minimum seats" value={seatsFilter} onChange={(event) => onSeatsFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}>
                <option value="">Any seats</option>
                {SEAT_FILTER_OPTIONS.map((value) => <option key={value} value={value}>{value}+ seats</option>)}
              </select>
            </InventoryFilterControl>
            <InventoryFilterControl icon={Coffee} label={pantryFilter === "true" ? "Pantry" : pantryFilter === "false" ? "No pantry" : "Pantry"}>
              <select aria-label="Pantry" value={pantryFilter} onChange={(event) => onPantryFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}><option value="">All pantry</option><option value="true">Pantry Yes</option><option value="false">Pantry No</option></select>
            </InventoryFilterControl>
          </>
        ) : null}
        <InventoryFilterControl icon={Layers3} label={floorFilter ? `Floor ${floorFilter}+` : "Floor"}>
          <select aria-label="Minimum floor" value={floorFilter} onChange={(event) => onFloorFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}>
            <option value="">Any floor</option>
            {FLOOR_FILTER_OPTIONS.map((value) => <option key={value} value={value}>Floor {value} and above</option>)}
          </select>
        </InventoryFilterControl>
        <InventoryFilterControl icon={CarFront} label={parkingFilter === "true" ? "Parking" : parkingFilter === "false" ? "No parking" : "Parking"}>
          <select aria-label="Parking" value={parkingFilter} onChange={(event) => onParkingFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}><option value="">All parking</option><option value="true">Parking Available</option><option value="false">No Parking</option></select>
        </InventoryFilterControl>
        <InventoryFilterControl icon={Sparkles} label={amenitiesFilter ? amenityFilterLabel(amenitiesFilter) : "Amenities"}>
          <select aria-label="Amenities" value={amenitiesFilter} onChange={(event) => onAmenitiesFilterChange(event.target.value)} className={FILTER_SELECT_CLASS}>
            <option value="">Any amenity</option>
            {AMENITY_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </InventoryFilterControl>
        {hasActiveFilters && onClearFilters ? (
          <button type="button" onClick={onClearFilters} className="h-10 rounded-xl px-3 text-[13px] font-semibold text-blue-700 hover:bg-blue-50">
            Clear filters
          </button>
        ) : null}
        {!isCommercial && !isResidential ? (
          <span className="text-[12.5px] text-slate-500">Pick Commercial or Residential for cabins, seats or BHK filters.</span>
        ) : null}
      </div>
    </div>
  );
};

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
  canApproveDelete = true,
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
            const detailListingType = String(detailSource?.type || "").trim().toUpperCase();
            const detailPrice = formatCurrency(detailSource?.price);
            const detailRent = formatCurrency(detailSource?.rent);
            const showDetailPrice = detailListingType !== "RENT";
            const showDetailRent = detailListingType === "RENT" || detailListingType === "BOTH";
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
                      {showDetailPrice ? (
                        <p>
                          <span className="font-semibold text-slate-700">Price:</span> {detailPrice}
                        </p>
                      ) : null}
                      {showDetailRent ? (
                        <p>
                          <span className="font-semibold text-slate-700">Rent / month:</span> {detailRent}
                        </p>
                      ) : null}
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
                        <span className="block h-20 w-28 overflow-hidden rounded-md border border-slate-200">
                          <FittedImage src={firstImage} alt={inventoryLabel} backdrop={false} />
                        </span>
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

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    {isDeleteRequest && !canApproveDelete ? (
                      <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        Admin approves deletes
                      </span>
                    ) : (
                      <button
                        onClick={() => onApprove(requestId)}
                        disabled={loadingReview}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {loadingReview ? "..." : "Approve"}
                      </button>
                    )}
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
