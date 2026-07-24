import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Loader,
  MapPin,
  Maximize2,
  Ruler,
  ShieldCheck,
  X,
} from "lucide-react";
import { getSharedInventory } from "../../services/publicInventoryService";

/* ────────────────────────── Formatters ────────────────────────── */

const formatPrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `₹${parsed.toLocaleString("en-IN")}`;
};

const formatArea = (value, unit) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const unitLabel = String(unit || "").toUpperCase() === "SQ_M" ? "sq m" : "sq ft";
  return `${parsed.toLocaleString("en-IN")} ${unitLabel}`;
};

const formatEnumLabel = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return null;
  return clean
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatYesNo = (value) => (value ? "Yes" : "No");

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

/* ────────────────────────── Sub-components ────────────────────────── */

const InfoRow = ({ label, value, accent = false }) => {
  if (value === null || value === undefined || value === "" || value === "-") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100/80 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span
        className={`text-sm font-semibold text-right break-words min-w-0 max-w-[65%] ${
          accent ? "text-emerald-700" : "text-slate-800"
        }`}
      >
        {value}
      </span>
    </div>
  );
};

const AmenityChip = ({ label, active }) => {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
      ✓ {label}
    </span>
  );
};

const SectionCard = ({ title, icon, children }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
        {icon}
        {title}
      </h2>
    </div>
    <div className="px-5 py-3">{children}</div>
  </div>
);

/* ────────────────────────── Lightbox ────────────────────────── */

const ImageLightbox = ({ images, index, onClose, onPrev, onNext }) => {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10"
      >
        <X size={28} />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors z-10"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors z-10"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <img
        src={images[index]}
        alt={`Property ${index + 1}`}
        className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs font-semibold bg-black/50 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
};

/* ────────────────────────── Main Component ────────────────────────── */

const SharedInventoryView = () => {
  const { shareToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState(""); // "expired" | "invalid" | "error"
  const [inventory, setInventory] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setErrorType("");
      const data = await getSharedInventory(shareToken);
      if (!data) {
        setError("Property not found");
        setErrorType("invalid");
        return;
      }
      setInventory(data);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || "Failed to load property details";
      if (status === 410) {
        setError("This share link has expired. Please request a new link.");
        setErrorType("expired");
      } else if (status === 404) {
        setError("This share link is invalid or has been revoked.");
        setErrorType("invalid");
      } else {
        setError(msg);
        setErrorType("error");
      }
    } finally {
      setLoading(false);
    }
  }, [shareToken]);

  useEffect(() => {
    if (shareToken) fetchInventory();
    else {
      setError("No share token provided");
      setErrorType("invalid");
      setLoading(false);
    }
  }, [fetchInventory, shareToken]);

  const images = useMemo(
    () => (Array.isArray(inventory?.images) ? inventory.images.filter(Boolean) : []),
    [inventory?.images],
  );
  const documents = useMemo(
    () => (Array.isArray(inventory?.documents) ? inventory.documents.filter(Boolean) : []),
    [inventory?.documents],
  );
  const floorPlans = useMemo(
    () => (Array.isArray(inventory?.floorPlans) ? inventory.floorPlans.filter(Boolean) : []),
    [inventory?.floorPlans],
  );
  const videoTours = useMemo(
    () => (Array.isArray(inventory?.videoTours) ? inventory.videoTours.filter(Boolean) : []),
    [inventory?.videoTours],
  );

  const title = inventory?.title || "Property Details";
  const statusValue = inventory?.status || "Available";
  const inventoryType = String(inventory?.inventoryType || "").toUpperCase();
  const isCommercial = inventoryType === "COMMERCIAL";
  const isResidential = inventoryType === "RESIDENTIAL";
  const commercialDetails = inventory?.commercialDetails || null;
  const residentialDetails = inventory?.residentialDetails || null;
  const transactionType = inventory?.type || "Sale";

  const safeIndex = Math.min(activeImageIndex, Math.max(images.length - 1, 0));

  const handlePrevImage = useCallback(
    () => setActiveImageIndex((prev) => (prev <= 0 ? images.length - 1 : prev - 1)),
    [images.length],
  );
  const handleNextImage = useCallback(
    () => setActiveImageIndex((prev) => (prev >= images.length - 1 ? 0 : prev + 1)),
    [images.length],
  );

  /* ────────── Status badge styles ────────── */
  const statusStyles = useMemo(() => {
    if (statusValue === "Available")
      return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200";
    if (statusValue === "Blocked" || statusValue === "Reserved")
      return "bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-amber-200";
    if (statusValue === "Sold")
      return "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-slate-300";
    return "bg-slate-200 text-slate-700";
  }, [statusValue]);

  /* ────────── Loading state ────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader className="animate-spin mx-auto text-emerald-500" size={32} />
          <p className="text-sm font-medium text-slate-500">Loading property details...</p>
        </div>
      </div>
    );
  }

  /* ────────── Error state ────────── */
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/20 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div
            className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
              errorType === "expired"
                ? "bg-amber-100 text-amber-600"
                : "bg-red-100 text-red-500"
            }`}
          >
            <AlertCircle size={36} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {errorType === "expired" ? "Link Expired" : "Link Unavailable"}
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">{error}</p>
          <p className="text-xs text-slate-400">
            Please contact the person who shared this link with you for an updated link.
          </p>
        </div>
      </div>
    );
  }

  /* ────────── Success render ────────── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20">
      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <ImageLightbox
          images={images}
          index={safeIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
        />
      )}

      {/* ═══ Hero header ═══ */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.3),transparent_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.2),transparent_60%)]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/80 mb-2">
                Property Showcase
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                {title}
              </h1>
              {inventory?.location && (
                <p className="mt-2 text-sm text-slate-300 flex items-center gap-1.5">
                  <MapPin size={14} className="text-emerald-400" />
                  {inventory.location}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg ${statusStyles}`}
              >
                <ShieldCheck size={14} />
                {statusValue}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-xs font-semibold uppercase tracking-wider text-white/80">
                {transactionType}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Main content ═══ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ─── Price highlight ─── */}
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-6 sm:p-8 shadow-lg shadow-emerald-200/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-100/80 mb-1">
                {transactionType === "Rent" ? "Monthly Rent" : "Asking Price"}
              </p>
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {formatPrice(transactionType === "Rent" ? (inventory?.rent ?? inventory?.price) : inventory?.price)}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {formatArea(inventory?.totalArea, inventory?.areaUnit) && (
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-xl px-4 py-2">
                  <Ruler size={16} className="text-emerald-200" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100/70">
                      Total Area
                    </p>
                    <p className="text-sm font-bold">
                      {formatArea(inventory?.totalArea, inventory?.areaUnit)}
                    </p>
                  </div>
                </div>
              )}
              {transactionType === "Rent" && inventory?.deposit != null && (
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur rounded-xl px-4 py-2">
                  <ShieldCheck size={16} className="text-emerald-200" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100/70">
                      Security Deposit
                    </p>
                    <p className="text-sm font-bold">{formatPrice(inventory?.deposit)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Image gallery + Property info ─── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Image gallery */}
          <div className="xl:col-span-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="relative h-72 sm:h-96 xl:h-[28rem] bg-slate-100 flex items-center justify-center group">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[safeIndex]}
                    alt={`Property ${safeIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Maximize2 size={16} />
                  </button>

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {safeIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-slate-300 flex flex-col items-center">
                  <ImageIcon size={52} />
                  <span className="text-xs font-bold uppercase mt-2">No Images</span>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="p-3 border-t border-slate-100 flex gap-2 overflow-x-auto">
                {images.map((url, i) => (
                  <button
                    key={`thumb-${i}`}
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      i === safeIndex
                        ? "border-emerald-500 shadow-md shadow-emerald-100"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property info card */}
          <SectionCard title="Property Info" icon={<Building2 size={15} />}>
            <InfoRow label="Project" value={inventory?.projectName} />
            <InfoRow label="Tower / Block" value={inventory?.towerName} />
            <InfoRow label="Unit" value={inventory?.unitNumber} />
            <InfoRow label="Property ID" value={inventory?.propertyId} />
            <InfoRow label="Type" value={formatEnumLabel(inventoryType)} />
            <InfoRow label="Category" value={inventory?.category} />
            <InfoRow label="Furnishing" value={formatEnumLabel(inventory?.furnishingStatus)} />
            <InfoRow label="City" value={inventory?.city} />
            <InfoRow label="Area" value={inventory?.area} />
            <InfoRow label="Pincode" value={inventory?.pincode} />
            <InfoRow label="Building" value={inventory?.buildingName} />
            <InfoRow label="Floor" value={inventory?.floorNumber} />
            <InfoRow label="Total Floors" value={inventory?.totalFloors} />
            <InfoRow
              label="Total Area"
              value={formatArea(inventory?.totalArea, inventory?.areaUnit)}
            />
            <InfoRow
              label="Carpet Area"
              value={formatArea(inventory?.carpetArea, inventory?.areaUnit)}
            />
            <InfoRow
              label="Built-up Area"
              value={formatArea(inventory?.builtUpArea, inventory?.areaUnit)}
            />
            <InfoRow
              label="Maintenance"
              value={inventory?.maintenanceCharges ? formatPrice(inventory.maintenanceCharges) : null}
            />
            <InfoRow label="Transaction" value={transactionType} />
          </SectionCard>
        </div>

        {/* ─── Commercial details ─── */}
        {isCommercial && commercialDetails && (
          <SectionCard title="Commercial Office Details" icon={<Building2 size={15} />}>
            <div className="space-y-1">
              <InfoRow label="Commercial Property Type" value={formatEnumLabel(commercialDetails?.officeType)} />
              <InfoRow label="Cabins" value={commercialDetails?.officeLayout?.totalCabins} />
              <InfoRow label="Cabin Seats" value={commercialDetails?.officeLayout?.cabinSeats} />
              <InfoRow label="Workstations" value={commercialDetails?.officeLayout?.workstations} />
              <InfoRow label="Seats" value={commercialDetails?.officeLayout?.seats} />
              <InfoRow label="Conference Rooms" value={commercialDetails?.officeLayout?.conferenceRooms} />
              <InfoRow label="Conference Seats" value={commercialDetails?.officeLayout?.conferenceSeats} />
              <InfoRow label="Reserved Parking Type" value={formatEnumLabel(commercialDetails?.buildingDetails?.parkingType)} />
              <InfoRow label="Reserved Parking Slots" value={commercialDetails?.buildingDetails?.parkingSlots} />
              <InfoRow label="Total Floors" value={commercialDetails?.buildingDetails?.totalFloors} />
              <InfoRow label="Ready to Move" value={formatYesNo(commercialDetails?.availability?.readyToMove)} />
              <InfoRow label="Available From" value={formatDate(commercialDetails?.availability?.availableFrom)} />
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Amenities
              </p>
              <div className="flex flex-wrap gap-2">
                <AmenityChip label="Reception Area" active={commercialDetails?.officeLayout?.receptionArea} />
                <AmenityChip label="Waiting Area" active={commercialDetails?.officeLayout?.waitingArea} />
                <AmenityChip label="Pantry" active={commercialDetails?.amenities?.pantry} />
                <AmenityChip label="Cafeteria" active={commercialDetails?.amenities?.cafeteria} />
                <AmenityChip label="Server Room" active={commercialDetails?.amenities?.serverRoom} />
                <AmenityChip label="Storage Room" active={commercialDetails?.amenities?.storageRoom} />
                <AmenityChip label="Breakout Area" active={commercialDetails?.amenities?.breakoutArea} />
                <AmenityChip label="Lift" active={commercialDetails?.amenities?.liftAvailable} />
                <AmenityChip label="Power Backup" active={commercialDetails?.amenities?.powerBackup} />
                <AmenityChip label="Central AC" active={commercialDetails?.amenities?.centralAC} />
                <AmenityChip label="Fire Safety" active={commercialDetails?.buildingDetails?.fireSafety} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ─── Residential details ─── */}
        {isResidential && residentialDetails && (
          <SectionCard title="Residential Details" icon={<Building2 size={15} />}>
            <div className="space-y-1">
              <InfoRow label="Property Type" value={formatEnumLabel(residentialDetails?.propertyType)} />
              <InfoRow label="BHK" value={formatEnumLabel(residentialDetails?.bhkType)} />
              <InfoRow label="Bedrooms" value={residentialDetails?.bedrooms} />
              <InfoRow label="Bathrooms" value={residentialDetails?.bathrooms} />
              <InfoRow label="Balcony" value={residentialDetails?.balcony} />
              <InfoRow label="Reserved Parking Slots" value={residentialDetails?.parking} />
              <InfoRow label="Study Room" value={residentialDetails?.studyRoom ? "Yes" : null} />
              <InfoRow label="Servant Room" value={residentialDetails?.servantRoom ? "Yes" : null} />
              <InfoRow label="Water Supply" value={formatEnumLabel(residentialDetails?.utilities?.waterSupply)} />
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Amenities
              </p>
              <div className="flex flex-wrap gap-2">
                <AmenityChip label="Modular Kitchen" active={residentialDetails?.amenities?.modularKitchen} />
                <AmenityChip label="Lift" active={residentialDetails?.amenities?.lift} />
                <AmenityChip label="Security" active={residentialDetails?.amenities?.security} />
                <AmenityChip label="Power Backup" active={residentialDetails?.amenities?.powerBackup} />
                <AmenityChip label="Gym" active={residentialDetails?.amenities?.gym} />
                <AmenityChip label="Swimming Pool" active={residentialDetails?.amenities?.swimmingPool} />
                <AmenityChip label="Clubhouse" active={residentialDetails?.amenities?.clubhouse} />
                <AmenityChip label="Electricity Backup" active={residentialDetails?.utilities?.electricityBackup} />
                <AmenityChip label="Gas Pipeline" active={residentialDetails?.utilities?.gasPipeline} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ─── Files & Links ─── */}
        {(documents.length > 0 || floorPlans.length > 0 || videoTours.length > 0) && (
          <SectionCard title="Files & Media" icon={<FileText size={15} />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {documents.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Documents
                  </p>
                  <div className="space-y-1.5">
                    {documents.map((doc, i) => (
                      <a
                        key={`doc-${i}`}
                        href={doc}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-emerald-700 hover:text-emerald-900 underline"
                      >
                        Document {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {floorPlans.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Floor Plans
                  </p>
                  <div className="space-y-1.5">
                    {floorPlans.map((url, i) => (
                      <a
                        key={`fp-${i}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-cyan-700 hover:text-cyan-900 underline"
                      >
                        Floor Plan {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {videoTours.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                    Video Tours
                  </p>
                  <div className="space-y-1.5">
                    {videoTours.map((url, i) => (
                      <a
                        key={`vt-${i}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-indigo-700 hover:text-indigo-900 underline"
                      >
                        Video Tour {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* ─── Map embed ─── */}
        {inventory?.siteLocation?.lat != null && inventory?.siteLocation?.lng != null && (
          <SectionCard title="Location" icon={<MapPin size={15} />}>
            <div className="rounded-xl overflow-hidden border border-slate-200 h-64 sm:h-80">
              <iframe
                title="Property Location"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://www.google.com/maps?q=${inventory.siteLocation.lat},${inventory.siteLocation.lng}&z=15&output=embed`}
                allowFullScreen
              />
            </div>
          </SectionCard>
        )}

        {/* ─── Footer ─── */}
        <div className="text-center py-6 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            This property listing was shared with you via{" "}
            <span className="font-semibold text-slate-500">Samvid OS</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedInventoryView;
