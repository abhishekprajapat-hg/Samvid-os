import React from "react";
import {
  Building2,
  Edit3,
  Eye,
  Home,
  Image as ImageIcon,
  Layers3,
  MapPin,
  MoreHorizontal,
  Share2,
  Trash2,
} from "lucide-react";
import { Badge, Button, EmptyState, Skeleton } from "../../../components/ui";
import { DataTableShell, MetricCard } from "../../../components/crm";
import { toApiInventoryStatus } from "./propertyWorkspaceUtils";
import InventoryCard from "./InventoryCard";

const INITIAL_VISIBLE_ASSETS = 60;
const VISIBLE_ASSET_INCREMENT = 60;

export const PropertyStatusBadge = ({ status }) => {
  const normalized = toApiInventoryStatus(status);
  const tone =
    normalized === "Available"
      ? "emerald"
      : normalized === "Blocked"
        ? "amber"
        : normalized === "Sold"
          ? "slate"
          : "cyan";

  return (
    <Badge variant={tone} className="uppercase tracking-widest">
      {normalized || status || "Unknown"}
    </Badge>
  );
};

const formatEnum = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return "-";
  return clean
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getAreaLabel = (asset) => {
  const area = toNumberOrNull(asset?.totalArea ?? asset?.carpetArea ?? asset?.builtUpArea);
  if (area === null) return "-";
  const unit = String(asset?.areaUnit || "").toUpperCase() === "SQ_M" ? "sq m" : "sq ft";
  return `${area.toLocaleString("en-IN")} ${unit}`;
};

const getLocationLabel = (asset) =>
  [asset?.area, asset?.city, asset?.location]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ") || "-";

const PropertyMeta = ({ icon, label, value }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
      {React.createElement(icon, { size: 12 })}
      {label}
    </div>
    <div className="mt-1 truncate text-sm font-semibold text-slate-800">{value || "-"}</div>
  </div>
);

export const InventoryKpiGrid = ({ metrics = [] }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
    {metrics.map((metric) => (
      <MetricCard
        key={metric.label}
        title={metric.label}
        value={metric.value}
        helper={metric.helper}
        icon={metric.icon}
      />
    ))}
  </div>
);

export const PropertyCard = React.memo(({
  asset,
  canManage,
  canDeleteDirect,
  canRequestDelete,
  pendingDeleteAssetIds,
  canOpenEditModal,
  canRequestStatusChange,
  deleting,
  updatingStatus,
  requestingStatus,
  statusOptions,
  getAssetTitle,
  formatPrice,
  formatCurrency,
  formatSoldLeadLabel,
  formatSoldPaymentModeLabel,
  formatSoldPaymentTypeLabel,
  onView,
  onEdit,
  onDelete,
  onShare,
  onStatusChange,
  onStatusChangeRequest,
}) => {
  const image = Array.isArray(asset?.images) ? asset.images[0] : "";
  const imageCount = Array.isArray(asset?.images) ? asset.images.length : 0;
  const statusValue = toApiInventoryStatus(asset?.status);
  const isRent = String(asset?.type || "").trim().toUpperCase() === "RENT";
  const isDeleteRequested = pendingDeleteAssetIds?.has(String(asset?._id || ""));

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
      <button
        type="button"
        onClick={() => onView(asset?._id)}
        className="relative block h-40 w-full overflow-hidden bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-52"
        aria-label={`View ${getAssetTitle(asset)}`}
      >
        {image ? (
          <img
            src={image}
            alt={getAssetTitle(asset)}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-slate-300">
            <ImageIcon size={34} />
            <span className="mt-2 text-[10px] font-bold uppercase tracking-widest">No Image</span>
          </div>
        )}
        <div className="absolute left-3 top-3">
          <PropertyStatusBadge status={asset?.status} />
        </div>
        {imageCount > 1 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-slate-950/75 px-2 py-1 text-[10px] font-bold text-white">
            +{imageCount - 1} media
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900">{getAssetTitle(asset)}</h3>
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
                <MapPin size={13} />
                {getLocationLabel(asset)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-extrabold text-slate-950">{formatPrice(asset)}</div>
              {isRent && toNumberOrNull(asset?.deposit) !== null && (
                <div className="text-[11px] font-semibold text-slate-500">
                  Deposit {formatCurrency(asset.deposit)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
            <Badge variant="outline">{formatEnum(asset?.type)}</Badge>
            <Badge variant="outline">{formatEnum(asset?.inventoryType)}</Badge>
            <Badge variant="outline">{formatEnum(asset?.furnishingStatus)}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <PropertyMeta icon={Layers3} label="Area" value={getAreaLabel(asset)} />
          <PropertyMeta icon={Building2} label="Unit" value={asset?.unitNumber || asset?.propertyId} />
        </div>

        {statusValue === "Blocked" && asset?.reservationReason ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Blocked: {asset.reservationReason}
          </div>
        ) : null}

        {isDeleteRequested ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            Delete requested - awaiting approval
          </div>
        ) : null}

        {statusValue === "Sold" && asset?.saleDetails ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">
              Sold to {formatSoldLeadLabel(asset.saleDetails?.leadId)}
            </div>
            <div>
              {formatSoldPaymentModeLabel(asset.saleDetails?.paymentMode)} |{" "}
              {formatSoldPaymentTypeLabel(asset.saleDetails?.paymentType)}
            </div>
          </div>
        ) : null}

        <div className="mt-auto space-y-2.5 border-t border-slate-100 pt-3 sm:space-y-3">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => onView(asset?._id)} className="flex-1">
              <Eye size={14} />
              View
            </Button>
            {canOpenEditModal && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(asset)} aria-label="Edit property" className="w-9 px-0">
                <Edit3 size={15} />
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => onShare(asset)} aria-label="Share property" className="w-9 px-0">
              <Share2 size={15} />
            </Button>
            {(canDeleteDirect || canRequestDelete) && (
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => onDelete(asset?._id)}
                disabled={deleting || isDeleteRequested}
                aria-label={isDeleteRequested ? "Property delete already requested" : canDeleteDirect ? "Delete property" : "Request property delete"}
                className="w-9 px-0"
              >
                {deleting ? <MoreHorizontal size={15} /> : <Trash2 size={15} />}
              </Button>
            )}
          </div>

          {canManage || canRequestStatusChange ? (
            <select
              value={statusValue}
              disabled={updatingStatus || requestingStatus}
              onChange={(event) =>
                canManage
                  ? onStatusChange(asset?._id, event.target.value)
                  : onStatusChangeRequest(asset?._id, event.target.value)
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
              aria-label="Update property status"
            >
              {statusOptions.map((statusOption) => (
                <option key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              View-only access
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

export const PropertyTable = React.memo(({
  assets,
  canManage,
  canDeleteDirect,
  canRequestDelete,
  pendingDeleteAssetIds,
  canOpenEditModal,
  canRequestStatusChange,
  deletingId,
  updatingStatusId,
  requestingStatusId,
  statusOptions,
  getAssetTitle,
  formatPrice,
  onView,
  onEdit,
  onDelete,
  onShare,
  onStatusChange,
  onStatusChangeRequest,
}) => (
  <DataTableShell>
    <table className="min-w-full divide-y divide-slate-200">
      <thead className="bg-slate-50">
        <tr>
          {["Property", "Type", "Status", "Area", "Price", "Actions"].map((header) => (
            <th
              key={header}
              className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {assets.map((asset) => {
          const isDeleteRequested = pendingDeleteAssetIds?.has(String(asset?._id || ""));
          return (
          <tr key={asset._id} className="hover:bg-slate-50/80">
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => onView(asset?._id)}
                className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="font-semibold text-slate-900">{getAssetTitle(asset)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {[asset?.propertyId, getLocationLabel(asset)].filter(Boolean).join(" | ")}
                </div>
                {isDeleteRequested ? (
                  <div className="mt-1 text-xs font-bold text-rose-600">Delete requested - awaiting approval</div>
                ) : null}
              </button>
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{formatEnum(asset?.type)}</Badge>
                <Badge variant="outline">{formatEnum(asset?.inventoryType)}</Badge>
              </div>
            </td>
            <td className="px-4 py-3">
              <PropertyStatusBadge status={asset?.status} />
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-slate-700">{getAreaLabel(asset)}</td>
            <td className="px-4 py-3 text-sm font-bold text-slate-900">{formatPrice(asset)}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                {canManage || canRequestStatusChange ? (
                  <select
                    value={toApiInventoryStatus(asset?.status)}
                    disabled={updatingStatusId === asset._id || requestingStatusId === asset._id}
                    onChange={(event) =>
                      canManage
                        ? onStatusChange(asset?._id, event.target.value)
                        : onStatusChangeRequest(asset?._id, event.target.value)
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none"
                    aria-label="Update property status"
                  >
                    {statusOptions.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {canOpenEditModal && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(asset)} aria-label="Edit property" className="w-9 px-0">
                    <Edit3 size={15} />
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => onShare(asset)} aria-label="Share property" className="w-9 px-0">
                  <Share2 size={15} />
                </Button>
                {(canDeleteDirect || canRequestDelete) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => onDelete(asset?._id)}
                    disabled={deletingId === asset._id || isDeleteRequested}
                    aria-label={isDeleteRequested ? "Property delete already requested" : canDeleteDirect ? "Delete property" : "Request property delete"}
                    className="w-9 px-0"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  </DataTableShell>
));

export const PropertyWorkspace = ({
  loading,
  assets,
  viewMode,
  actionProps,
  emptyAction,
}) => {
  const [visibleCount, setVisibleCount] = React.useState(INITIAL_VISIBLE_ASSETS);

  React.useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ASSETS);
  }, [assets, viewMode]);

  const visibleAssets = React.useMemo(
    () => assets.slice(0, visibleCount),
    [assets, visibleCount],
  );
  const hiddenCount = Math.max(0, assets.length - visibleAssets.length);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="mt-4 h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!assets.length) {
    return (
      <EmptyState
        icon={Home}
        title="No properties match current filters"
        description="Adjust search, status, type, budget, or area filters to widen the inventory view."
        actionLabel={emptyAction?.label}
        onAction={emptyAction?.onClick}
      />
    );
  }

  if (viewMode === "table") {
    return (
      <>
        <div className="hidden md:block">
          <PropertyTable assets={visibleAssets} {...actionProps} />
        </div>
        <div className="grid grid-cols-1 gap-3 pb-8 md:hidden">
          {visibleAssets.map((asset) => (
            <PropertyCard
              key={asset._id}
              asset={asset}
              deleting={actionProps.deletingId === asset._id}
              updatingStatus={actionProps.updatingStatusId === asset._id}
              requestingStatus={actionProps.requestingStatusId === asset._id}
              {...actionProps}
            />
          ))}
        </div>
        {hiddenCount > 0 ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + VISIBLE_ASSET_INCREMENT)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              Show {Math.min(VISIBLE_ASSET_INCREMENT, hiddenCount)} more of {hiddenCount}
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="grid gap-5 pb-8 md:grid-cols-2 xl:grid-cols-3">
        {visibleAssets.map((asset) => (
          <InventoryCard
            key={asset._id}
            asset={asset}
            priceLabel={actionProps.formatPrice(asset)}
            onView={actionProps.onView}
            onEdit={actionProps.onEdit}
            onShare={actionProps.onShare}
            onDelete={actionProps.onDelete}
            canOpenEditModal={actionProps.canOpenEditModal}
            canDelete={actionProps.canDeleteDirect || actionProps.canRequestDelete}
            deleting={actionProps.deletingId === asset._id}
            deleteRequested={actionProps.pendingDeleteAssetIds?.has(String(asset?._id || ""))}
          />
        ))}
        {actionProps.canOpenCreateModal ? (
          <button
            type="button"
            onClick={actionProps.onOpenAddModal}
            className="grid min-h-[180px] place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-slate-400 outline-none transition hover:border-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-500"
          >
            <span>
              <span className="block text-[22px] leading-none">+</span>
              <span className="mt-2 block text-[12.5px] font-semibold">Add property</span>
              <span className="mt-0.5 block text-[11px]">or drop a spreadsheet</span>
            </span>
          </button>
        ) : null}
      </div>
      {hiddenCount > 0 ? (
        <div className="-mt-2 flex justify-center pb-8">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + VISIBLE_ASSET_INCREMENT)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold uppercase tracking-widest text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Show {Math.min(VISIBLE_ASSET_INCREMENT, hiddenCount)} more properties
          </button>
        </div>
      ) : null}
    </>
  );
};
