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

const formatYesNo = (value) => (value ? "Yes" : "No");

const formatEnumLabel = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return "-";

  return clean
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatArea = (value, unit) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  const unitLabel = String(unit || "").toUpperCase() === "SQ_M" ? "sq m" : "sq ft";
  return `${parsed.toLocaleString("en-IN")} ${unitLabel}`;
};

const formatSoldPaymentMode = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "-";
  if (normalized === "NET_BANKING_NEFTRTGSIMPS") return "Net Banking (NEFT/RTGS/IMPS)";
  if (normalized === "CHECK") return "Check / Cheque";
  return normalized;
};

const formatSoldPaymentType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "FULL") return "Full Payment";
  if (normalized === "PARTIAL") return "Partial Payment";
  return normalized || "-";
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
  const transactionType = asset?.type || inventory?.type || "Sale";
  const saleDetails = inventory?.saleDetails || asset?.saleDetails || null;
  const soldLeadLabel = (() => {
    const lead = saleDetails?.leadId;
    if (!lead) return "-";
    if (typeof lead === "string") return lead;

    const name = String(lead?.name || "").trim();
    const phone = String(lead?.phone || "").trim();
    const fallbackId = String(lead?._id || "").trim();
    return [name, phone].filter(Boolean).join(" | ") || fallbackId || "-";
  })();
  const inventoryType = String(inventory?.inventoryType || asset?.inventoryType || "").toUpperCase();
  const commercialDetails = inventory?.commercialDetails || asset?.commercialDetails || null;
  const commercialLayout = commercialDetails?.officeLayout || {};
  const commercialAmenities = commercialDetails?.amenities || {};
  const commercialBuilding = commercialDetails?.buildingDetails || {};
  const commercialAvailability = commercialDetails?.availability || {};
  const residentialDetails = inventory?.residentialDetails || asset?.residentialDetails || null;
  const residentialAmenities = residentialDetails?.amenities || {};
  const residentialUtilities = residentialDetails?.utilities || {};
  const isCommercial = inventoryType === "COMMERCIAL" || (!inventoryType && Boolean(commercialDetails));
  const isResidential = inventoryType === "RESIDENTIAL" || (!inventoryType && Boolean(residentialDetails));
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
  const floorPlans = useMemo(
    () =>
      Array.isArray(inventory?.floorPlans) && inventory.floorPlans.length
        ? inventory.floorPlans
        : asset?.floorPlans || [],
    [asset?.floorPlans, inventory?.floorPlans],
  );
  const videoTours = useMemo(
    () =>
      Array.isArray(inventory?.videoTours) && inventory.videoTours.length
        ? inventory.videoTours
        : asset?.videoTours || [],
    [asset?.videoTours, inventory?.videoTours],
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
          <FieldRow label="Property ID" value={inventory?.propertyId || asset?.propertyId} />
          <FieldRow label="Inventory Type" value={formatEnumLabel(inventoryType)} />
          <FieldRow label="Price" value={formatPrice(inventory?.price ?? asset?.price)} />
          <FieldRow label="Furnishing" value={formatEnumLabel(inventory?.furnishingStatus || asset?.furnishingStatus)} />
          <FieldRow label="Location" value={inventory?.location || asset?.location} />
          <FieldRow label="City" value={inventory?.city || asset?.city} />
          <FieldRow label="Area" value={inventory?.area || asset?.area} />
          <FieldRow label="Pincode" value={inventory?.pincode || asset?.pincode} />
          <FieldRow label="Building" value={inventory?.buildingName || asset?.buildingName} />
          <FieldRow label="Floor Number" value={inventory?.floorNumber ?? asset?.floorNumber} />
          <FieldRow label="Total Floors" value={inventory?.totalFloors ?? asset?.totalFloors} />
          <FieldRow label="Total Area" value={formatArea(inventory?.totalArea ?? asset?.totalArea, inventory?.areaUnit || asset?.areaUnit)} />
          <FieldRow label="Carpet Area" value={formatArea(inventory?.carpetArea ?? asset?.carpetArea, inventory?.areaUnit || asset?.areaUnit)} />
          <FieldRow label="Built-up Area" value={formatArea(inventory?.builtUpArea ?? asset?.builtUpArea, inventory?.areaUnit || asset?.areaUnit)} />
          <FieldRow label="Maintenance" value={formatPrice(inventory?.maintenanceCharges ?? asset?.maintenanceCharges)} />
          {String(transactionType || "").trim().toUpperCase() === "RENT" && (
            <FieldRow label="Security Deposit" value={formatPrice(inventory?.deposit ?? asset?.deposit)} />
          )}
          <FieldRow label="Coordinates" value={inventoryCoordinates} />
          <FieldRow label="Type" value={transactionType} />
          <FieldRow label="Category" value={asset?.category || "Apartment"} />
          {(statusValue === "Blocked" || statusValue === "Reserved") && (
            <FieldRow
              label="Reservation Reason"
              value={inventory?.reservationReason || asset?.reservationReason || "-"}
            />
          )}
          {statusValue === "Sold" && (
            <>
              <FieldRow label="Sold To Lead" value={soldLeadLabel} />
              <FieldRow label="Payment Mode" value={formatSoldPaymentMode(saleDetails?.paymentMode)} />
              <FieldRow label="Payment Type" value={formatSoldPaymentType(saleDetails?.paymentType)} />
              <FieldRow label="Total Amount" value={formatPrice(saleDetails?.totalAmount)} />
              <FieldRow
                label="Remaining Amount"
                value={formatPrice(saleDetails?.remainingAmount ?? 0)}
              />
              <FieldRow label="Payment Reference" value={saleDetails?.paymentReference || "-"} />
              <FieldRow label="Sold At" value={formatDate(saleDetails?.soldAt)} />
              <FieldRow label="Sale Note" value={saleDetails?.note || "-"} />
            </>
          )}
        </div>
      </div>

      {(commercialDetails || residentialDetails) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {isCommercial && commercialDetails && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">
                Commercial Office Details
              </h2>
              <FieldRow label="Office Type" value={formatEnumLabel(commercialDetails?.officeType)} />
              <FieldRow label="Total Cabins" value={commercialLayout?.totalCabins} />
              <FieldRow label="Workstations" value={commercialLayout?.workstations} />
              <FieldRow label="Seats" value={commercialLayout?.seats} />
              <FieldRow label="Conference Rooms" value={commercialLayout?.conferenceRooms} />
              <FieldRow label="Meeting Rooms" value={commercialLayout?.meetingRooms} />
              <FieldRow label="Reception Area" value={formatYesNo(commercialLayout?.receptionArea)} />
              <FieldRow label="Waiting Area" value={formatYesNo(commercialLayout?.waitingArea)} />
              <FieldRow label="Pantry" value={formatYesNo(commercialAmenities?.pantry)} />
              <FieldRow label="Cafeteria" value={formatYesNo(commercialAmenities?.cafeteria)} />
              <FieldRow label="Washroom Type" value={formatEnumLabel(commercialAmenities?.washroomType)} />
              <FieldRow label="Server / IT Room" value={formatYesNo(commercialAmenities?.serverRoom)} />
              <FieldRow label="Storage Room" value={formatYesNo(commercialAmenities?.storageRoom)} />
              <FieldRow label="Breakout Area" value={formatYesNo(commercialAmenities?.breakoutArea)} />
              <FieldRow label="Lift Available" value={formatYesNo(commercialAmenities?.liftAvailable)} />
              <FieldRow label="Power Backup" value={formatYesNo(commercialAmenities?.powerBackup)} />
              <FieldRow label="Central AC" value={formatYesNo(commercialAmenities?.centralAC)} />
              <FieldRow label="Parking Type" value={formatEnumLabel(commercialBuilding?.parkingType)} />
              <FieldRow label="Parking Slots" value={commercialBuilding?.parkingSlots} />
              <FieldRow label="Security" value={formatEnumLabel(commercialBuilding?.securityType)} />
              <FieldRow label="Fire Safety" value={formatYesNo(commercialBuilding?.fireSafety)} />
              <FieldRow label="Ready To Move" value={formatYesNo(commercialAvailability?.readyToMove)} />
              <FieldRow
                label="Under Construction"
                value={formatYesNo(commercialAvailability?.underConstruction)}
              />
              <FieldRow label="Available From" value={formatDate(commercialAvailability?.availableFrom)} />
            </div>
          )}

          {isResidential && residentialDetails && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">
                Residential Details
              </h2>
              <FieldRow label="Property Type" value={formatEnumLabel(residentialDetails?.propertyType)} />
              <FieldRow label="BHK Type" value={formatEnumLabel(residentialDetails?.bhkType)} />
              <FieldRow label="Bedrooms" value={residentialDetails?.bedrooms} />
              <FieldRow label="Bathrooms" value={residentialDetails?.bathrooms} />
              <FieldRow label="Balcony" value={residentialDetails?.balcony} />
              <FieldRow label="Study Room" value={formatYesNo(residentialDetails?.studyRoom)} />
              <FieldRow label="Servant Room" value={formatYesNo(residentialDetails?.servantRoom)} />
              <FieldRow label="Parking Slots" value={residentialDetails?.parking} />
              <FieldRow label="Modular Kitchen" value={formatYesNo(residentialAmenities?.modularKitchen)} />
              <FieldRow label="Lift" value={formatYesNo(residentialAmenities?.lift)} />
              <FieldRow label="Security" value={formatYesNo(residentialAmenities?.security)} />
              <FieldRow label="Power Backup" value={formatYesNo(residentialAmenities?.powerBackup)} />
              <FieldRow label="Gym" value={formatYesNo(residentialAmenities?.gym)} />
              <FieldRow label="Swimming Pool" value={formatYesNo(residentialAmenities?.swimmingPool)} />
              <FieldRow label="Clubhouse" value={formatYesNo(residentialAmenities?.clubhouse)} />
              <FieldRow label="Water Supply" value={formatEnumLabel(residentialUtilities?.waterSupply)} />
              <FieldRow
                label="Electricity Backup"
                value={formatYesNo(residentialUtilities?.electricityBackup)}
              />
              <FieldRow label="Gas Pipeline" value={formatYesNo(residentialUtilities?.gasPipeline)} />
            </div>
          )}
        </div>
      )}

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
            Files & Links
          </h2>

          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Documents
              </p>
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

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Floor Plans
              </p>
              {floorPlans.length === 0 ? (
                <p className="text-sm text-slate-400">No floor plans attached.</p>
              ) : (
                <div className="space-y-2">
                  {floorPlans.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-cyan-700 hover:text-cyan-900 break-all underline"
                    >
                      Floor Plan {index + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Video Tours
              </p>
              {videoTours.length === 0 ? (
                <p className="text-sm text-slate-400">No video tours attached.</p>
              ) : (
                <div className="space-y-2">
                  {videoTours.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-indigo-700 hover:text-indigo-900 break-all underline"
                    >
                      Video Tour {index + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
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
