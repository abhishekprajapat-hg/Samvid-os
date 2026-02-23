import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarClock,
  FileText,
  Hash,
  History,
  Image as ImageIcon,
  Loader,
  Share2,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  getInventoryAssetActivity,
  getInventoryAssetById,
} from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";

const formatPrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return `Rs ${parsed.toLocaleString("en-IN")}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const toCoordinateNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatUserRef = (value) => {
  if (!value) return "-";
  if (typeof value === "string") return value;
  const name = value.name || "";
  const role = value.role || "";
  if (name && role) return `${name} (${role})`;
  return name || role || "-";
};

const statusClass = (status) => {
  if (status === "Available") return "bg-emerald-100 text-emerald-700";
  if (status === "Blocked" || status === "Reserved") return "bg-amber-100 text-amber-700";
  if (status === "Sold") return "bg-slate-900 text-white";
  return "bg-slate-100 text-slate-700";
};

const FieldRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2">
    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-slate-800 text-right break-words min-w-0 max-w-[65%]">
      {value || "-"}
    </span>
  </div>
);

const InventoryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = localStorage.getItem("role") || "";
  const isFieldExecutive = role === "FIELD_EXECUTIVE";
  const canViewActivity = [
    "ADMIN",
    "MANAGER",
    "ASSISTANT_MANAGER",
    "TEAM_LEADER",
  ].includes(role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asset, setAsset] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [activities, setActivities] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const detail = await getInventoryAssetById(id);

      setAsset(detail?.asset || null);
      setInventory(detail?.inventory || null);

      if (canViewActivity) {
        try {
          const activityRows = await getInventoryAssetActivity(id, { limit: 100 });
          setActivities(Array.isArray(activityRows) ? activityRows : []);
        } catch {
          // Activity endpoint is intentionally restricted for some roles.
          setActivities([]);
        }
      } else {
        setActivities([]);
      }

      setActiveImageIndex(0);
    } catch (detailsError) {
      setError(toErrorMessage(detailsError, "Failed to load inventory details"));
    } finally {
      setLoading(false);
    }
  }, [canViewActivity, id]);

  useEffect(() => {
    if (!id) {
      setError("Invalid property id");
      setLoading(false);
      return;
    }
    fetchDetails();
  }, [fetchDetails, id]);

  const pageTitle = useMemo(() => {
    if (asset?.title) return asset.title;
    if (!inventory) return "Property Details";
    return [inventory.projectName, inventory.towerName, inventory.unitNumber]
      .filter(Boolean)
      .join(" - ");
  }, [asset?.title, inventory]);

  const statusValue = inventory?.status || asset?.status || "Unknown";
  const images = useMemo(
    () => (Array.isArray(inventory?.images) && inventory.images.length ? inventory.images : asset?.images || []),
    [asset?.images, inventory?.images],
  );
  const documents = useMemo(
    () =>
      Array.isArray(inventory?.documents) && inventory.documents.length
        ? inventory.documents
        : asset?.documents || [],
    [asset?.documents, inventory?.documents],
  );

  const safeImageIndex = Math.min(activeImageIndex, Math.max(images.length - 1, 0));
  const activeImage = images[safeImageIndex] || "";
  const inventorySiteLat = toCoordinateNumber(inventory?.siteLocation?.lat ?? asset?.siteLocation?.lat);
  const inventorySiteLng = toCoordinateNumber(inventory?.siteLocation?.lng ?? asset?.siteLocation?.lng);
  const inventoryCoordinates =
    inventorySiteLat !== null && inventorySiteLng !== null
      ? `${inventorySiteLat}, ${inventorySiteLng}`
      : "-";
  const sharePayload = useMemo(() => {
    const inventoryId = inventory?._id || asset?._id;
    if (!inventoryId) return null;

    const title =
      asset?.title
      || [inventory?.projectName, inventory?.towerName, inventory?.unitNumber]
        .filter(Boolean)
        .join(" - ")
      || "Inventory Unit";

    return {
      inventoryId,
      title,
      location: inventory?.location || asset?.location || "",
      siteLocation:
        inventorySiteLat !== null && inventorySiteLng !== null
          ? { lat: inventorySiteLat, lng: inventorySiteLng }
          : null,
      price: Number(inventory?.price ?? asset?.price) || 0,
      status: statusValue,
      image: images[0] || "",
    };
  }, [
    asset?._id,
    asset?.location,
    asset?.price,
    asset?.title,
    images,
    inventory?._id,
    inventory?.location,
    inventory?.price,
    inventory?.projectName,
    inventorySiteLat,
    inventorySiteLng,
    inventory?.towerName,
    inventory?.unitNumber,
    statusValue,
  ]);

  const handleShareToChat = () => {
    if (!sharePayload) return;
    navigate("/chat", {
      state: { shareProperty: sharePayload },
    });
  };

  if (loading) {
    return (
      <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 flex items-center justify-center text-slate-400 gap-2">
        <Loader className="animate-spin" size={22} />
        Loading property details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 space-y-6 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <h1 className="font-display text-3xl tracking-wide text-slate-900">{pageTitle || "Property Details"}</h1>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">
            Full inventory profile
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${statusClass(
              statusValue,
            )}`}
          >
            <ShieldCheck size={14} />
            {statusValue}
          </div>
          {sharePayload && (
            <button
              onClick={handleShareToChat}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-cyan-700 hover:bg-cyan-100"
            >
              <Share2 size={13} />
              Share to Chat
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="h-80 sm:h-96 xl:h-[32rem] bg-slate-100 flex items-center justify-center">
            {activeImage ? (
              <img src={activeImage} alt={pageTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-300 flex flex-col items-center">
                <ImageIcon size={52} />
                <span className="text-xs font-bold uppercase mt-2">No Image</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="p-3 border-t border-slate-100 flex gap-2 overflow-x-auto">
              {images.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  onClick={() => setActiveImageIndex(index)}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                    index === safeImageIndex ? "border-emerald-500" : "border-transparent"
                  }`}
                >
                  <img src={url} alt={`thumb-${index}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
            <Building2 size={15} />
            Property Info
          </h2>
          <FieldRow label="Project" value={inventory?.projectName} />
          <FieldRow label="Tower" value={inventory?.towerName} />
          <FieldRow label="Unit" value={inventory?.unitNumber} />
          <FieldRow label="Price" value={formatPrice(inventory?.price ?? asset?.price)} />
          <FieldRow label="Location" value={inventory?.location || asset?.location} />
          <FieldRow label="Coordinates" value={inventoryCoordinates} />
          <FieldRow label="Type" value={asset?.type || "Sale"} />
          <FieldRow label="Category" value={asset?.category || "Apartment"} />
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${isFieldExecutive ? "xl:grid-cols-1" : "xl:grid-cols-2"}`}>
        {!isFieldExecutive && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
              <User size={15} />
              Ownership & Approval
            </h2>
            <FieldRow label="Team" value={formatUserRef(inventory?.teamId)} />
            <FieldRow label="Created By" value={formatUserRef(inventory?.createdBy)} />
            <FieldRow label="Approved By" value={formatUserRef(inventory?.approvedBy)} />
            <FieldRow label="Updated By" value={formatUserRef(inventory?.updatedBy)} />
            <FieldRow label="Created At" value={formatDate(inventory?.createdAt)} />
            <FieldRow label="Updated At" value={formatDate(inventory?.updatedAt)} />
            <FieldRow label="Record Id" value={inventory?._id || asset?._id} />
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
            <FileText size={15} />
            Documents
          </h2>

          {documents.length === 0 ? (
            <p className="text-sm text-slate-400">No documents attached.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <a
                  key={`${doc}-${index}`}
                  href={doc}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-emerald-700 hover:text-emerald-900 break-all underline"
                >
                  Document {index + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {canViewActivity && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
            <History size={15} />
            Activity Timeline
          </h2>

          {activities.length === 0 ? (
            <p className="text-sm text-slate-400">No activity logged yet.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((row) => (
                <div key={row._id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Hash size={14} />
                      {row.actionType || "CHANGE"}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <CalendarClock size={13} />
                      {formatDate(row.timestamp)}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">
                    By: {formatUserRef(row.changedBy)} {row.role ? `(${row.role})` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default InventoryDetails;
