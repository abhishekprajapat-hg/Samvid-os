import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Home,
  Plus,
  Pencil,
  X,
  Loader,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  getInventoryAssets,
  createInventoryAsset,
  updateInventoryAsset,
  deleteInventoryAsset,
  requestInventoryStatusChange,
  getPendingInventoryRequests,
  approveInventoryRequest,
  rejectInventoryRequest,
} from "../../services/inventoryService";
import { toErrorMessage } from "../../utils/errorMessage";

const STATUS_OPTIONS = ["Available", "Reserved", "Sold"];
const STATUS_UPDATE_OPTIONS = [
  { label: "Available", value: "Available" },
  { label: "Reserved", value: "Blocked" },
  { label: "Sold", value: "Sold" },
];

const toApiStatus = (status) => {
  if (status === "Reserved") return "Blocked";
  return status;
};

const DEFAULT_FORM = {
  title: "",
  location: "",
  price: "",
  type: "Sale",
  category: "Apartment",
  status: "Available",
  images: [],
};

const statusPillClass = (status) => {
  if (status === "Available") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Reserved") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Sold") {
    return "bg-slate-900 text-white";
  }

  if (status === "Rented") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-slate-100 text-slate-600";
};

const formatPrice = (asset) => {
  const value = Number(asset.price) || 0;

  if (asset.type === "Rent") {
    return `Rs ${value.toLocaleString("en-IN")}/mo`;
  }

  return `Rs ${value.toLocaleString("en-IN")}`;
};

const AssetVault = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState("");
  const [modeType, setModeType] = useState("sale");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const [requestingStatusId, setRequestingStatusId] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [reviewingRequestId, setReviewingRequestId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState(DEFAULT_FORM);

  const role = localStorage.getItem("role") || "";
  const canManage = role === "ADMIN";
  const canRequestStatusChange = role === "FIELD_EXECUTIVE";

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [list, requests] = await Promise.all([
        getInventoryAssets(),
        canManage ? getPendingInventoryRequests() : Promise.resolve([]),
      ]);

      setAssets(Array.isArray(list) ? list : []);
      setPendingRequests(Array.isArray(requests) ? requests : []);
    } catch (fetchError) {
      console.error(`Error loading inventory: ${toErrorMessage(fetchError, "Unknown error")}`);
      setAssets([]);
      setPendingRequests([]);
      setError(toErrorMessage(fetchError, "Failed to load inventory"));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return assets.filter((asset) => {
      const typeMatch = modeType === "sale" ? asset.type === "Sale" : asset.type === "Rent";
      const statusMatch = statusFilter === "all" ? true : asset.status === statusFilter;

      const searchMatch =
        !normalizedSearch ||
        [asset.title, asset.location, asset.category].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedSearch),
        );

      return typeMatch && statusMatch && searchMatch;
    });
  }, [assets, modeType, searchTerm, statusFilter]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    const newImageUrls = [];

    try {
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", "samvid_upload");
        data.append("cloud_name", "djfiq8kiy");

        const res = await fetch("https://api.cloudinary.com/v1_1/djfiq8kiy/image/upload", {
          method: "POST",
          body: data,
        });

        const cloudData = await res.json();
        if (cloudData.secure_url) {
          newImageUrls.push(cloudData.secure_url);
        }
      }

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...newImageUrls],
      }));
    } catch (uploadError) {
      console.error(`Upload Error: ${toErrorMessage(uploadError, "Unknown error")}`);
      setError("Error uploading one or more images");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const removeImage = (urlToRemove) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((url) => url !== urlToRemove),
    }));
  };

  const resetForm = () => {
    setFormData({ ...DEFAULT_FORM });
  };

  const closeFormModal = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setEditingAssetId("");
    resetForm();
  };

  const openAddModal = () => {
    setError("");
    setSuccess("");
    setIsEditModalOpen(false);
    setEditingAssetId("");
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleSaveAsset = async () => {
    if (!canManage) return;

    if (!formData.title.trim() || formData.price === "" || !formData.location.trim()) {
      setError("Title, location and price are required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...formData,
        title: formData.title.trim(),
        price: Number(formData.price),
      };

      const createdAsset = await createInventoryAsset(payload);

      setAssets((prev) => [createdAsset, ...prev]);
      setSuccess("Asset added to inventory");
      closeFormModal();
    } catch (saveError) {
      console.error(`Save asset failed: ${toErrorMessage(saveError, "Unknown error")}`);
      setError(toErrorMessage(saveError, "Failed to save asset"));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditModal = (asset) => {
    if (!canManage || !asset?._id) return;

    setError("");
    setSuccess("");
    setIsAddModalOpen(false);
    setEditingAssetId(asset._id);
    setFormData({
      title: asset.title || "",
      location: asset.location || "",
      price:
        asset.price === null || asset.price === undefined || Number.isNaN(Number(asset.price))
          ? ""
          : String(asset.price),
      type: asset.type || "Sale",
      category: asset.category || "Apartment",
      status: asset.status || "Available",
      images: Array.isArray(asset.images) ? asset.images : [],
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAsset = async () => {
    if (!canManage || !editingAssetId) return;

    if (!formData.title.trim() || formData.price === "" || !formData.location.trim()) {
      setError("Title, location and price are required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...formData,
        title: formData.title.trim(),
        price: Number(formData.price),
      };

      const updatedAsset = await updateInventoryAsset(editingAssetId, payload);
      setAssets((prev) =>
        prev.map((asset) => (String(asset._id) === String(editingAssetId) ? updatedAsset : asset)),
      );
      setSuccess("Asset updated");
      closeFormModal();
    } catch (updateError) {
      console.error(`Update asset failed: ${toErrorMessage(updateError, "Unknown error")}`);
      setError(toErrorMessage(updateError, "Failed to update asset"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!canManage) return;

    const shouldDelete = window.confirm("Delete this asset from inventory?");
    if (!shouldDelete) return;

    try {
      setDeletingId(assetId);
      setError("");
      setSuccess("");

      await deleteInventoryAsset(assetId);
      setAssets((prev) => prev.filter((asset) => asset._id !== assetId));
      setSuccess("Asset deleted");
    } catch (deleteError) {
      console.error(`Delete asset failed: ${toErrorMessage(deleteError, "Unknown error")}`);
      setError(toErrorMessage(deleteError, "Failed to delete asset"));
    } finally {
      setDeletingId("");
    }
  };

  const handleStatusChange = async (assetId, status) => {
    if (!canManage) return;

    try {
      setUpdatingStatusId(assetId);
      setError("");
      setSuccess("");

      const updated = await updateInventoryAsset(assetId, { status });
      setAssets((prev) => prev.map((asset) => (asset._id === assetId ? updated : asset)));
      setSuccess("Asset status updated");
    } catch (statusError) {
      console.error(`Update status failed: ${toErrorMessage(statusError, "Unknown error")}`);
      setError(toErrorMessage(statusError, "Failed to update status"));
    } finally {
      setUpdatingStatusId("");
    }
  };

  const handleStatusChangeRequest = async (assetId, status) => {
    if (!canRequestStatusChange) return;

    const asset = assets.find((row) => String(row._id) === String(assetId));
    const currentStatus = toApiStatus(asset?.status || "");
    if (!asset || !status || status === currentStatus) {
      setError("Please select a different status");
      return;
    }

    try {
      setRequestingStatusId(assetId);
      setError("");
      setSuccess("");

      await requestInventoryStatusChange(assetId, status);
      setSuccess("Status change request submitted for admin approval");
    } catch (requestError) {
      console.error(`Request status change failed: ${toErrorMessage(requestError, "Unknown error")}`);
      setError(toErrorMessage(requestError, "Failed to submit status change request"));
    } finally {
      setRequestingStatusId("");
    }
  };

  const handleOpenDetails = (assetId) => {
    if (!assetId) return;
    navigate(`/inventory/${assetId}`);
  };

  const handleApproveRequest = async (requestId) => {
    if (!canManage || !requestId) return;

    try {
      setReviewingRequestId(requestId);
      setError("");
      setSuccess("");

      await approveInventoryRequest(requestId);
      setSuccess("Request approved and inventory updated");
      await fetchAssets();
    } catch (approveError) {
      console.error(`Approve request failed: ${toErrorMessage(approveError, "Unknown error")}`);
      setError(toErrorMessage(approveError, "Failed to approve request"));
    } finally {
      setReviewingRequestId("");
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!canManage || !requestId) return;

    const reason = window.prompt("Reject reason:");
    if (!reason || !reason.trim()) return;

    try {
      setReviewingRequestId(requestId);
      setError("");
      setSuccess("");

      await rejectInventoryRequest(requestId, reason.trim());
      setSuccess("Request rejected");
      await fetchAssets();
    } catch (rejectError) {
      console.error(`Reject request failed: ${toErrorMessage(rejectError, "Unknown error")}`);
      setError(toErrorMessage(rejectError, "Failed to reject request"));
    } finally {
      setReviewingRequestId("");
    }
  };

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar relative bg-slate-50/50">
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
              onClick={() => setModeType("sale")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
                modeType === "sale"
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              For Sale
            </button>
            <button
              onClick={() => setModeType("rent")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
                modeType === "rent"
                  ? "bg-white shadow-sm text-amber-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Rentals
            </button>
          </div>

          {canManage && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg"
            >
              <Plus size={16} /> Add Asset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 z-10">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search title, location, category"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 p-3 text-sm">
          {success}
        </div>
      )}

      {canManage && (
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
                const currentStatus = request.inventoryId?.status || "-";
                const requestedStatus = request.proposedData?.status || "-";
                const loadingReview = reviewingRequestId === requestId;

                return (
                  <div
                    key={requestId}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {request.inventoryId?.projectName || "Inventory"} - {request.inventoryId?.towerName || "-"} - {request.inventoryId?.unitNumber || "-"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          By: {request.requestedBy?.name || "Unknown"} ({request.requestedBy?.role || "-"})
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-600">
                          {currentStatus} to {requestedStatus}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(requestId)}
                          disabled={loadingReview}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {loadingReview ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleRejectRequest(requestId)}
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
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
          <Loader className="animate-spin" size={24} /> Accessing Vault...
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
          <Home size={48} className="mb-4 opacity-20" />
          <p className="text-sm font-bold">No assets match current filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8 z-0">
          {filteredAssets.map((asset) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={asset._id}
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-emerald-500/30 transition-all duration-300 flex flex-col h-[360px]"
            >
              <div className="relative h-40 bg-slate-100 flex items-center justify-center overflow-hidden">
                {asset.images && asset.images.length > 0 ? (
                  <img
                    src={asset.images[0]}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={asset.title}
                  />
                ) : (
                  <div className="text-slate-300 flex flex-col items-center">
                    <ImageIcon size={32} />
                    <span className="text-[10px] font-bold uppercase mt-2 tracking-widest">
                      No Image
                    </span>
                  </div>
                )}

                {asset.images && asset.images.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-slate-900/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    +{asset.images.length - 1} more
                  </div>
                )}

                <div
                  className={`absolute top-3 right-3 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${statusPillClass(
                    asset.status,
                  )}`}
                >
                  {asset.status}
                </div>

                {canManage && (
                  <button
                    onClick={() => handleDeleteAsset(asset._id)}
                    disabled={deletingId === asset._id}
                    className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/90 text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {deletingId === asset._id ? (
                      <Loader size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg tracking-wide text-slate-800 truncate">
                    {asset.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                    <MapPin size={12} /> {asset.location || "-"}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase">{asset.category}</span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {formatPrice(asset)}
                    </span>
                  </div>

                  {canManage ? (
                    <>
                      <select
                        value={toApiStatus(asset.status)}
                        disabled={updatingStatusId === asset._id}
                        onChange={(e) => handleStatusChange(asset._id, e.target.value)}
                        className="mt-3 w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        {STATUS_UPDATE_OPTIONS.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>
                            {statusOption.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleOpenEditModal(asset)}
                        className="mt-2 w-full h-9 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        <Pencil size={13} />
                        Edit Property
                      </button>
                      <button
                        onClick={() => handleOpenDetails(asset._id)}
                        className="mt-2 w-full h-9 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        View Details
                      </button>
                    </>
                  ) : canRequestStatusChange ? (
                    <>
                      <select
                        value={toApiStatus(asset.status)}
                        disabled={requestingStatusId === asset._id}
                        onChange={(e) => handleStatusChangeRequest(asset._id, e.target.value)}
                        className="mt-3 w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        {STATUS_UPDATE_OPTIONS.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>
                            {statusOption.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                        Admin approval required
                      </div>
                      <button
                        onClick={() => handleOpenDetails(asset._id)}
                        className="mt-2 w-full h-9 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        View Details
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        View-only access
                      </div>
                      <button
                        onClick={() => handleOpenDetails(asset._id)}
                        className="mt-2 w-full h-9 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        View Details
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {(isAddModalOpen || isEditModalOpen) && canManage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <h3 className="font-display text-lg text-slate-900">
                  {isEditModalOpen ? "Edit Property" : "New Inventory Asset"}
                </h3>
                <button
                  onClick={closeFormModal}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                    Property Images
                  </label>

                  {formData.images.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                      {formData.images.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 group"
                        >
                          <img src={url} className="w-full h-full object-cover" alt="asset" />
                          <button
                            onClick={() => removeImage(url)}
                            className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-center w-full">
                    <label
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all ${
                        uploading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {uploading ? (
                          <Loader className="animate-spin text-slate-400 mb-2" size={24} />
                        ) : (
                          <UploadCloud className="text-slate-400 mb-2" size={24} />
                        )}
                        <p className="text-xs text-slate-500 font-bold">
                          {uploading ? "Uploading..." : "Click to upload photos"}
                        </p>
                        <p className="text-[10px] text-slate-400">SVG, PNG, JPG</p>
                      </div>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Asset Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sunset Villa 402"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Price (Rs)
                    </label>
                    <input
                      type="number"
                      placeholder="12500000"
                      value={formData.price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="Sector 42"
                      value={formData.location}
                      onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      <option value="Sale">For Sale</option>
                      <option value="Rent">For Rent</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Office">Office</option>
                      <option value="Plot">Plot</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                <button
                  onClick={closeFormModal}
                  className="flex-1 py-3 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={isEditModalOpen ? handleUpdateAsset : handleSaveAsset}
                  disabled={uploading || saving}
                  className={`flex-1 py-3 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all ${
                    uploading || saving
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {uploading || saving
                    ? isEditModalOpen
                      ? "Updating..."
                      : "Saving..."
                    : isEditModalOpen
                      ? "Update Asset"
                      : "Save Asset"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssetVault;
