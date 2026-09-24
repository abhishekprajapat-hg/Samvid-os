import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader, Pencil, Trash2 } from "lucide-react";
import { getProjectById, deleteProject } from "../../services/projectService";
import { toErrorMessage } from "../../utils/errorMessage";
import { usePermissions } from "../../context/usePermissions";
import ToastNotice from "../../components/ui/ToastNotice";
import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  PLOT_BASED_PROJECT_TYPES,
  PROJECT_PLOT_SIZE_OPTIONS,
  PROJECT_BHK_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_AMENITY_OPTIONS,
  PROJECT_HOUSING_CATEGORY_OPTIONS,
  PROJECT_UNIT_STATUS_OPTIONS,
  PROJECT_COMMERCIAL_AMENITY_OPTIONS,
  getProjectOptionLabel,
} from "../../config/projectConfig";

const isBuildingType = (projectType) => projectType === "BUILDING";
const isPlotBasedType = (projectType) => PLOT_BASED_PROJECT_TYPES.includes(projectType);
const isCommercialCategory = (projectCategory) => projectCategory === "COMMERCIAL";

const PROJECT_MANAGE_ROLES = new Set(["ADMIN", "MANAGER"]);
const PROJECT_DELETE_ROLES = new Set(["ADMIN"]);

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `₹${num.toLocaleString("en-IN")}`;
};

const InfoRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 border-b border-slate-50 py-2">
    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    <span className="text-right text-sm text-slate-700">{value || "-"}</span>
  </div>
);

const SectionCard = ({ title, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</div>
    {children}
  </div>
);

const UnitCard = ({ unit, codeField, fieldsToShow }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-[11px] font-bold text-emerald-700">
        {unit[codeField]}{unit.officeName ? ` — ${unit.officeName}` : ""}
      </span>
      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
        {getProjectOptionLabel(PROJECT_UNIT_STATUS_OPTIONS, unit.status)}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
      {fieldsToShow.map(([label, value]) => (
        <span key={label}>{label}: {value ?? "-"}</span>
      ))}
    </div>
    {unit.remarks && <p className="mt-1.5 text-[11px] text-slate-500">Remarks: {unit.remarks}</p>}
  </div>
);

const ProjectDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = String(localStorage.getItem("role") || "").trim().toUpperCase();
  const { canPageAction, enforcePageAccess } = usePermissions();
  const canManage = PROJECT_MANAGE_ROLES.has(role)
    || (enforcePageAccess && canPageAction("projects", "edit"));
  const canDelete = PROJECT_DELETE_ROLES.has(role)
    || (enforcePageAccess && canPageAction("projects", "delete"));

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError("");
    });
    getProjectById(id)
      .then((data) => {
        if (!cancelled) setProject(data);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(toErrorMessage(fetchError, "Failed to load project"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(id);
      navigate("/projects");
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, "Failed to delete project"));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-page-shell custom-scrollbar flex items-center justify-center gap-2 text-slate-400">
        <Loader className="animate-spin" size={22} />
        Loading project details...
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="ui-page-shell custom-scrollbar">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <ToastNotice message={error} type="error" />
      </div>
    );
  }

  if (!project) return null;

  const commercial = isCommercialCategory(project.projectCategory);
  const building = isBuildingType(project.projectType);
  const plotBased = isPlotBasedType(project.projectType);
  const amenityOptions = commercial ? PROJECT_COMMERCIAL_AMENITY_OPTIONS : PROJECT_AMENITY_OPTIONS;

  return (
    <div className="ui-page-shell custom-scrollbar space-y-4">
      <ToastNotice message={error} type="error" />

      <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{project.projectName}</h1>
            <p className="mt-1 font-mono text-xs font-bold text-slate-500">{project.projectId}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              {getProjectOptionLabel(PROJECT_STATUS_OPTIONS, project.status)}
            </span>
            {canManage && (
              <button
                onClick={() => navigate(`/projects?edit=${project._id}`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100"
              >
                <Pencil size={13} />
                Edit
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {project.images?.length > 0 && (
        <SectionCard title={`Photos (${project.images.length})`}>
          <div className="flex flex-wrap gap-2">
            {project.images.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-100"
              >
                <img src={url} className="h-full w-full object-cover" alt={`project ${index + 1}`} />
              </a>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Basic Information">
          <InfoRow label="Category" value={getProjectOptionLabel(PROJECT_CATEGORY_OPTIONS, project.projectCategory)} />
          {!commercial && <InfoRow label="Type" value={getProjectOptionLabel(PROJECT_TYPE_OPTIONS, project.projectType)} />}
          <InfoRow label="Total Land Area" value={project.totalLandArea} />
          {commercial && (
            <>
              <InfoRow label="Total Floors" value={project.totalFloors} />
              <InfoRow label="Offices Per Floor" value={project.officesPerFloor} />
              <InfoRow label="Total Offices" value={project.totalOffices ?? project.offices?.length ?? 0} />
              <InfoRow label="Total Shops" value={project.totalShops ?? project.shops?.length ?? 0} />
              <InfoRow label="Total Showrooms" value={project.totalShowrooms ?? project.showrooms?.length ?? 0} />
            </>
          )}
          {building && (
            <>
              <InfoRow label="Number of Flats" value={project.numberOfFlats} />
              <InfoRow label="Number of Floors" value={project.numberOfFloors} />
              <InfoRow label="Flats Per Floor" value={project.flatsPerFloor} />
            </>
          )}
          {plotBased && (
            <>
              <InfoRow label="Total Plots" value={project.totalPlots} />
              <InfoRow label="Plots Available" value={project.plotsAvailable ?? 0} />
              <InfoRow
                label="Plot Size"
                value={project.plotSize === "CUSTOM" ? project.customPlotSize : getProjectOptionLabel(PROJECT_PLOT_SIZE_OPTIONS, project.plotSize)}
              />
            </>
          )}
        </SectionCard>

        <SectionCard title="Pricing">
          <InfoRow label="PLC" value={project.plc} />
          <InfoRow label="Group" value={project.group} />
          <InfoRow label="Starting Rate" value={formatCurrency(project.startingRate)} />
          <InfoRow label="Current Rate" value={formatCurrency(project.currentRate)} />
          <InfoRow label="Other Charges" value={project.otherCharges} />
        </SectionCard>

        {!commercial && (
          <SectionCard title="Housing Category">
            <InfoRow label="Housing Category" value={getProjectOptionLabel(PROJECT_HOUSING_CATEGORY_OPTIONS, project.housingCategory)} />
          </SectionCard>
        )}

        <SectionCard title="Location">
          <InfoRow label="Complete Address" value={project.location} />
          {commercial && (
            <>
              <InfoRow label="Landmark" value={project.landmark} />
              <InfoRow label="City" value={project.city} />
              <InfoRow label="State" value={project.state} />
              <InfoRow label="Pincode" value={project.pincode} />
              {(project.siteLocation?.lat || project.siteLocation?.lng) && (
                <InfoRow label="Coordinates" value={`${project.siteLocation?.lat ?? "-"}, ${project.siteLocation?.lng ?? "-"}`} />
              )}
            </>
          )}
        </SectionCard>

        <SectionCard title="Owner / Manager">
          <InfoRow label="Name" value={project.ownerManagerName} />
          <InfoRow label="Mobile" value={project.ownerManagerMobile} />
        </SectionCard>

        <SectionCard title="Broker Manager">
          <InfoRow label="Name" value={project.brokerManagerName} />
          <InfoRow label="Mobile" value={project.brokerManagerMobile} />
        </SectionCard>

        <SectionCard title="Meta">
          <InfoRow label="Created By" value={project.createdBy?.name} />
        </SectionCard>
      </div>

      {project.amenities?.length > 0 && (
        <SectionCard title="Amenities">
          <div className="flex flex-wrap gap-1.5">
            {project.amenities.map((amenity) => (
              <span key={amenity} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                {getProjectOptionLabel(amenityOptions, amenity)}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {project.bhkConfigurations?.length > 0 && (
        <SectionCard title="BHK Configurations">
          <div className="space-y-2">
            {project.bhkConfigurations.map((config) => (
              <div key={config.bhk} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600">
                <div className="mb-1 text-[11px] font-bold text-emerald-700">{getProjectOptionLabel(PROJECT_BHK_OPTIONS, config.bhk)}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
                  <span>Size: {config.size} sq.ft</span>
                  <span>Beds: {config.bedrooms}</span>
                  <span>Kitchens: {config.kitchens}</span>
                  <span>Washrooms: {config.washrooms}</span>
                  <span>Drawing Rooms: {config.drawingRooms}</span>
                  <span>Balconies: {config.balconies}</span>
                  <span>Servant Room: {config.servantRoom ? "Yes" : "No"}</span>
                  <span>Parking: {config.reservedParking}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {project.offices?.length > 0 && (
        <SectionCard title={`Office Inventory (${project.offices.length})`}>
          <div className="space-y-2">
            {project.offices.map((office) => (
              <UnitCard
                key={office._id || office.officeCode}
                unit={office}
                codeField="officeCode"
                fieldsToShow={[
                  ["Floor", office.floorNumber],
                  ["Carpet Area", office.carpetArea],
                  ["Starting Rate", formatCurrency(office.startingRate)],
                  ["Current Rate", formatCurrency(office.currentRate)],
                ]}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {project.shops?.length > 0 && (
        <SectionCard title={`Shop Inventory (${project.shops.length})`}>
          <div className="space-y-2">
            {project.shops.map((shop) => (
              <UnitCard
                key={shop._id || shop.shopCode}
                unit={shop}
                codeField="shopCode"
                fieldsToShow={[
                  ["Floor", shop.floorNumber],
                  ["Carpet Area", shop.carpetArea],
                  ["Starting Rate", formatCurrency(shop.startingRate)],
                  ["Current Rate", formatCurrency(shop.currentRate)],
                ]}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {project.showrooms?.length > 0 && (
        <SectionCard title={`Showroom Inventory (${project.showrooms.length})`}>
          <div className="space-y-2">
            {project.showrooms.map((showroom) => (
              <UnitCard
                key={showroom._id || showroom.showroomCode}
                unit={showroom}
                codeField="showroomCode"
                fieldsToShow={[
                  ["Floor", showroom.floorNumber],
                  ["Carpet Area", showroom.carpetArea],
                  ["Starting Rate", formatCurrency(showroom.startingRate)],
                  ["Current Rate", formatCurrency(showroom.currentRate)],
                ]}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-extrabold text-slate-900">Delete Project?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to delete <span className="font-bold text-slate-700">{project.projectName}</span>? This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-widest text-white ${
                  deleting ? "cursor-not-allowed bg-slate-400" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailsPage;
