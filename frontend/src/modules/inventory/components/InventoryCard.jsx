import React, { useState } from "react";
import { Armchair, ArrowRight, Building2, Heart, Image as ImageIcon, MoreHorizontal, Pencil, Ruler, Share2, Trash2 } from "lucide-react";
import { IconButton, cn } from "../../../components/ui";
import { StatusBadge } from "../../../components/crm";
import { toApiInventoryStatus } from "./propertyWorkspaceUtils";

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatEnum = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return "";
  return clean.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

const subtitleOf = (asset) =>
  [asset?.projectName || asset?.buildingName, asset?.unitNumber ? `Unit ${asset.unitNumber}` : "", asset?.area || asset?.city]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");

const areaOf = (asset) => {
  const area = toNumber(asset?.totalArea ?? asset?.carpetArea ?? asset?.builtUpArea);
  if (area === null) return "-";
  return `${area.toLocaleString("en-IN")} ${String(asset?.areaUnit || "").toUpperCase() === "SQ_M" ? "sq m" : "sq ft"}`;
};

const floorOf = (asset) => {
  const floor = toNumber(asset?.floorNumber ?? asset?.floor);
  if (floor === null) return "-";
  const suffix = floor % 100 > 10 && floor % 100 < 14 ? "th" : ["th", "st", "nd", "rd"][Math.min(floor % 10, 3)];
  return `${floor}${suffix} floor`;
};

const InventoryCard = React.memo(({ asset, priceLabel, onView, onEdit, onShare, onDelete, canOpenEditModal, canDelete, deleting, deleteRequested }) => {
  const [favorite, setFavorite] = useState(false);
  const status = toApiInventoryStatus(asset?.status);
  const image = Array.isArray(asset?.images) ? asset.images[0] : "";
  const imageCount = Array.isArray(asset?.images) ? asset.images.length : 0;
  const furnishing = formatEnum(asset?.furnishingStatus) || "Unfurnished";

  return (
    <article className="group flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(37,99,235,0.14)]">
      <div className="relative h-[208px] shrink-0 overflow-hidden bg-slate-100">
        <button type="button" onClick={() => onView?.(asset?._id)} className="absolute inset-0 h-full w-full text-left" aria-label={`View ${asset?.projectName || asset?.propertyId || "property"}`}>
          {image ? <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="grid h-full w-full place-items-center text-slate-400"><ImageIcon size={36} /></span>}
        </button>
        <span className="absolute left-3 top-3"><StatusBadge status={status} className="border border-emerald-200 bg-white/95 text-[12px] font-semibold text-emerald-700 shadow-sm" /></span>
        <button type="button" aria-label={favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => setFavorite((value) => !value)} className={cn("absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/95 shadow-sm transition", favorite ? "text-rose-500" : "text-slate-700 hover:text-rose-500")}><Heart size={19} fill={favorite ? "currentColor" : "none"} /></button>
        {imageCount > 0 ? <span className="absolute bottom-3 left-3 rounded-lg bg-slate-950/80 px-2.5 py-1.5 text-[12px] font-semibold text-white"><ImageIcon size={13} className="mr-1 inline" />{imageCount} Photos</span> : null}
        {asset?.propertyId ? <span className="absolute bottom-3 right-3 rounded-lg bg-slate-950/80 px-2.5 py-1.5 font-mono text-[12px] font-semibold text-white">{asset.propertyId}</span> : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-[17px] font-bold tracking-[-0.02em] text-slate-900">{asset?.projectName || asset?.buildingName || "Untitled property"}</h3>
        <p className="mt-1 truncate text-[13px] text-slate-500">{subtitleOf(asset) || "Property unit"}</p>
        <p className="mt-3 text-[18px] font-bold tracking-[-0.02em] text-blue-700">{priceLabel}</p>

        {deleteRequested ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            Delete requested - awaiting approval
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-[13px] text-slate-600">
          <span className="inline-flex items-center gap-1.5 truncate"><Ruler size={16} className="shrink-0 text-slate-700" />{areaOf(asset)}</span>
          <span className="inline-flex items-center gap-1.5 truncate"><Armchair size={16} className="shrink-0 text-slate-700" />{furnishing}</span>
          <span className="inline-flex items-center gap-1.5 truncate"><Building2 size={16} className="shrink-0 text-slate-700" />{floorOf(asset)}</span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-5">
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-[12px] font-semibold text-blue-700">{formatEnum(asset?.inventoryType) || "Commercial"}</span>
          <span className="rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">{formatEnum(asset?.category) || "Office Space"}</span>
          <button type="button" onClick={() => onView?.(asset?._id)} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[13px] font-semibold text-blue-700 transition hover:bg-blue-100">View Details <ArrowRight size={15} /></button>
        </div>

        <div className="mt-2 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          {canOpenEditModal ? <IconButton icon={Pencil} label="Edit property" size="sm" className="h-7 w-7 border-transparent bg-transparent" onClick={() => onEdit?.(asset)} /> : null}
          <IconButton icon={Share2} label="Share property" size="sm" className="h-7 w-7 border-transparent bg-transparent" onClick={() => onShare?.(asset)} />
          {canDelete ? <IconButton icon={deleting ? MoreHorizontal : Trash2} label={deleteRequested ? "Property delete already requested" : "Delete property"} size="sm" className="h-7 w-7 border-transparent bg-transparent hover:text-rose-600" onClick={() => onDelete?.(asset?._id)} disabled={deleting || deleteRequested} /> : null}
        </div>
      </div>
    </article>
  );
});

InventoryCard.displayName = "InventoryCard";

export default InventoryCard;
