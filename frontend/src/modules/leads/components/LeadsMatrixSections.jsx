import React from "react";
import { motion as Motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  History,
  Loader,
  Mail,
  Mic,
  MicOff,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";

export const LeadsMatrixToolbar = ({ refreshing, canAddLead, onRefresh, onOpenAddModal }) => (
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-5">
    <div>
      <h1 className="font-display text-2xl sm:text-4xl text-slate-900 tracking-tight">
        Lead Matrix
      </h1>
      <p className="text-slate-500 mt-2 font-mono text-xs uppercase tracking-widest">
        Click any lead to open full detail
      </p>
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={onRefresh}
        className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold uppercase tracking-wide flex items-center gap-2"
      >
        {refreshing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Refresh
      </button>

      {canAddLead && (
        <button
          onClick={onOpenAddModal}
          className="h-10 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-emerald-600"
        >
          <Plus size={15} /> Add Lead
        </button>
      )}
    </div>
  </div>
);

export const LeadsMatrixAlerts = ({ error, success }) => (
  <>
    {error && (
      <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 mb-4">
        {error}
      </div>
    )}

    {success && (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2 mb-4 flex items-center gap-2">
        <CheckCircle2 size={14} /> {success}
      </div>
    )}
  </>
);

export const LeadsMatrixMetrics = ({ metrics }) => (
  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total</div>
      <div className="text-2xl font-display text-slate-900 mt-1">{metrics.total}</div>
    </div>
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">New</div>
      <div className="text-2xl font-display text-blue-700 mt-1">{metrics.new}</div>
    </div>
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Interested</div>
      <div className="text-2xl font-display text-emerald-700 mt-1">{metrics.interested}</div>
    </div>
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Closed</div>
      <div className="text-2xl font-display text-slate-900 mt-1">{metrics.closed}</div>
    </div>
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Due Followups</div>
      <div className="text-2xl font-display text-amber-700 mt-1">{metrics.dueFollowUps}</div>
    </div>
  </div>
);

export const LeadsMatrixFilters = ({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  leadStatuses,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
    <div className="md:col-span-2 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
      <input
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search name, phone, email, city"
        className="h-10 w-full pl-9 pr-3 rounded-xl border border-slate-300 text-sm"
      />
    </div>

    <select
      value={statusFilter}
      onChange={(event) => onStatusFilterChange(event.target.value)}
      className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
    >
      <option value="ALL">All statuses</option>
      {leadStatuses.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  </div>
);

export const LeadsMatrixTable = ({
  loading,
  filteredLeads,
  onOpenLeadDetails,
  leadRowClass,
  getStatusColor,
  formatDate,
}) => (
  <div className="flex-1 bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[420px]">
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <div className="col-span-3">Client</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Next Follow-up</div>
          <div className="col-span-2">Action</div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
              <Loader className="animate-spin" size={20} /> Loading leads...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <User size={42} className="mb-3 opacity-30" />
              <p>No leads found for current filters</p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <Motion.button
                type="button"
                key={lead._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onOpenLeadDetails(lead)}
                className={leadRowClass}
              >
                <div className="col-span-3 font-bold text-slate-800">
                  {lead.name}
                  <div className="text-xs text-slate-400 mt-1">{lead.city || "-"}</div>
                </div>

                <div className="col-span-3 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Phone size={12} /> {lead.phone}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Mail size={12} /> {lead.email || "-"}
                  </div>
                </div>

                <div className="col-span-2">
                  <span className={`px-2 py-1 text-xs font-bold border rounded ${getStatusColor(lead.status)}`}>
                    {lead.status || "-"}
                  </span>
                </div>

                <div className="col-span-2 text-sm text-slate-600">
                  {formatDate(lead.nextFollowUp)}
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Open <ArrowUpRight size={12} />
                  </span>
                </div>
              </Motion.button>
            ))
          )}
        </div>
      </div>
    </div>
  </div>
);

export const AddLeadModal = ({
  formData,
  setFormData,
  inventoryOptions,
  getInventoryLeadLabel,
  onInventorySelection,
  onClose,
  onSave,
  savingLead,
}) => (
  <Motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
  >
    <Motion.div
      initial={{ scale: 0.96, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.96, y: 10 }}
      className="bg-white w-full max-w-md rounded-2xl border shadow-2xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-slate-900">Add New Lead</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <select
          value={formData.inventoryId}
          onChange={(event) => onInventorySelection(event.target.value)}
          className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
        >
          <option value="">Select Inventory (optional)</option>
          {inventoryOptions.map((inventory) => {
            const inventoryLabel = getInventoryLeadLabel(inventory) || "Inventory Unit";
            const inventoryLocation = String(inventory.location || "").trim();
            return (
              <option key={inventory._id} value={inventory._id}>
                {inventoryLocation ? `${inventoryLabel} - ${inventoryLocation}` : inventoryLabel}
              </option>
            );
          })}
        </select>

        {[
          ["name", "Name"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["city", "City"],
          ["projectInterested", "Project Interested"],
        ].map(([field, label]) => (
          <input
            key={field}
            placeholder={label}
            value={formData[field]}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, [field]: event.target.value }))
            }
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        ))}

        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Site Latitude (optional)"
            value={formData.siteLat}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, siteLat: event.target.value }))
            }
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
          <input
            placeholder="Site Longitude (optional)"
            value={formData.siteLng}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, siteLng: event.target.value }))
            }
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 h-10 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={savingLead}
          className="flex-1 h-10 rounded-lg bg-slate-900 text-white font-semibold text-sm disabled:opacity-60"
        >
          {savingLead ? "Saving..." : "Save Lead"}
        </button>
      </div>
    </Motion.div>
  </Motion.div>
);

export const LeadDetailsDrawer = ({
  selectedLead,
  onClose,
  selectedLeadDialerHref,
  selectedLeadWhatsAppHref,
  selectedLeadMailHref,
  selectedLeadMapsHref,
  selectedLeadRelatedInventories,
  selectedLeadActiveInventoryId,
  propertyActionType,
  propertyActionInventoryId,
  canManageLeadProperties,
  onSelectRelatedProperty,
  onOpenRelatedProperty,
  onRemoveRelatedProperty,
  availableRelatedInventoryOptions,
  relatedInventoryDraft,
  setRelatedInventoryDraft,
  linkingProperty,
  onLinkPropertyToLead,
  leadStatuses,
  statusDraft,
  setStatusDraft,
  followUpDraft,
  setFollowUpDraft,
  siteLatDraft,
  setSiteLatDraft,
  siteLngDraft,
  setSiteLngDraft,
  canConfigureSiteLocation,
  selectedLeadSiteLat,
  selectedLeadSiteLng,
  siteVisitRadiusMeters,
  userRole,
  onUpdateLead,
  savingUpdates,
  canAssignLead,
  executiveDraft,
  setExecutiveDraft,
  executives,
  onAssignLead,
  assigning,
  diaryDraft,
  setDiaryDraft,
  onDiaryVoiceToggle,
  savingDiary,
  isDiaryMicSupported,
  isDiaryListening,
  onAddDiary,
  diaryLoading,
  diaryEntries,
  activityLoading,
  activities,
  formatDate,
  getInventoryLeadLabel,
  toObjectIdString,
  WhatsAppIcon,
}) => (
  <>
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-900/45"
    />

    <Motion.aside
      initial={{ x: 420 }}
      animate={{ x: 0 }}
      exit={{ x: 420 }}
      className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white border-l border-slate-200 shadow-2xl flex flex-col"
    >
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-900">Lead Details</div>
          <div className="text-[11px] text-slate-500">{selectedLead.name}</div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
          <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Contact</div>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <Phone size={13} />
              {selectedLeadDialerHref ? (
                <a
                  href={selectedLeadDialerHref}
                  className="hover:text-emerald-700 hover:underline underline-offset-2"
                >
                  {selectedLead.phone}
                </a>
              ) : (
                <span>-</span>
              )}
              {selectedLeadWhatsAppHref && (
                <a
                  href={selectedLeadWhatsAppHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open WhatsApp chat for ${selectedLead.phone}`}
                  className="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-100 p-1 text-emerald-700 hover:bg-emerald-200"
                >
                  {React.createElement(WhatsAppIcon, { size: 12 })}
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Mail size={13} />
              {selectedLeadMailHref ? (
                <a
                  href={selectedLeadMailHref}
                  className="hover:text-emerald-700 hover:underline underline-offset-2 break-all"
                >
                  {selectedLead.email}
                </a>
              ) : (
                <span>-</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <User size={13} />
              {selectedLeadMapsHref ? (
                <a
                  href={selectedLeadMapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-700 hover:underline underline-offset-2"
                >
                  {selectedLead.city}
                </a>
              ) : (
                <span>-</span>
              )}
            </div>
            <div className="pt-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                Related Properties
              </div>

              {selectedLeadRelatedInventories.length === 0 ? (
                <div className="text-xs text-slate-500">No property linked yet</div>
              ) : (
                <div className="space-y-1">
                  {selectedLeadRelatedInventories.map((inventory) => {
                    const inventoryId = toObjectIdString(inventory);
                    const inventoryLabel = getInventoryLeadLabel(inventory);
                    const inventoryLocation = String(inventory?.location || "").trim();
                    const fallbackLabel = inventoryId
                      ? `Inventory ${inventoryId.slice(-6)}`
                      : "Inventory";
                    const isActiveProperty =
                      String(selectedLeadActiveInventoryId || "") === String(inventoryId || "");
                    const isSelectingThisProperty =
                      propertyActionType === "select"
                      && String(propertyActionInventoryId || "") === String(inventoryId || "");
                    const isRemovingThisProperty =
                      propertyActionType === "remove"
                      && String(propertyActionInventoryId || "") === String(inventoryId || "");

                    return (
                      <div
                        key={inventoryId || fallbackLabel}
                        onClick={() => {
                          if (!inventoryId || isSelectingThisProperty || isRemovingThisProperty) {
                            return;
                          }
                          onSelectRelatedProperty(inventoryId);
                        }}
                        className={`rounded-lg border px-2 py-1 text-xs ${
                          isActiveProperty
                            ? "border-emerald-300 bg-emerald-50/60"
                            : "border-slate-200 bg-white hover:border-emerald-200"
                        } ${
                          inventoryId && !isSelectingThisProperty && !isRemovingThisProperty
                            ? "cursor-pointer"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-700 break-words">
                              {inventoryLabel || fallbackLabel}
                              {inventoryLocation ? ` (${inventoryLocation})` : ""}
                            </div>
                            {isActiveProperty && (
                              <div className="text-[10px] text-emerald-700">
                                Active property for site coordinates
                              </div>
                            )}
                          </div>

                          {canManageLeadProperties && inventoryId && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onOpenRelatedProperty(inventoryId);
                                }}
                                disabled={isSelectingThisProperty || isRemovingThisProperty}
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Open property details"
                              >
                                {isSelectingThisProperty ? (
                                  <Loader size={12} className="animate-spin" />
                                ) : (
                                  <Eye size={12} />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onRemoveRelatedProperty(inventoryId);
                                }}
                                disabled={isRemovingThisProperty || isSelectingThisProperty}
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Delete property from lead"
                              >
                                {isRemovingThisProperty ? (
                                  <Loader size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canManageLeadProperties && (
                <div className="mt-2 space-y-1">
                  <select
                    value={relatedInventoryDraft}
                    onChange={(event) => {
                      const selectedInventoryId = String(event.target.value || "");
                      setRelatedInventoryDraft(selectedInventoryId);
                      if (selectedInventoryId) {
                        onLinkPropertyToLead(selectedInventoryId);
                      }
                    }}
                    disabled={linkingProperty}
                    className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-xs"
                  >
                    <option value="">
                      {linkingProperty ? "Linking property..." : "Select property to link (auto-add)"}
                    </option>
                    {availableRelatedInventoryOptions.map((inventory) => {
                      const inventoryLabel = getInventoryLeadLabel(inventory) || "Inventory Unit";
                      const inventoryLocation = String(inventory.location || "").trim();
                      return (
                        <option key={inventory._id} value={inventory._id}>
                          {inventoryLocation
                            ? `${inventoryLabel} - ${inventoryLocation}`
                            : inventoryLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 space-y-3">
          <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Lead Controls</div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status</label>
            <select
              value={statusDraft}
              onChange={(event) => setStatusDraft(event.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
              <CalendarClock size={12} /> Next Follow-up
            </label>
            <input
              type="datetime-local"
              value={followUpDraft}
              onChange={(event) => setFollowUpDraft(event.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              Site Location
            </div>

            {canConfigureSiteLocation ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={siteLatDraft}
                  onChange={(event) => setSiteLatDraft(event.target.value)}
                  placeholder="Latitude"
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm bg-white"
                />
                <input
                  type="number"
                  step="any"
                  value={siteLngDraft}
                  onChange={(event) => setSiteLngDraft(event.target.value)}
                  placeholder="Longitude"
                  className="w-full h-9 rounded-lg border border-slate-300 px-3 text-sm bg-white"
                />
              </div>
            ) : (
              <div className="text-xs text-slate-600">
                {selectedLeadSiteLat !== null && selectedLeadSiteLng !== null
                  ? `${selectedLeadSiteLat}, ${selectedLeadSiteLng}`
                  : "Not configured by admin/manager"}
              </div>
            )}

            <div className="mt-2 text-[10px] text-slate-500">
              Site visit status is verified within {siteVisitRadiusMeters} meters.
            </div>
          </div>

          {userRole === "FIELD_EXECUTIVE" && statusDraft === "SITE_VISIT" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
              SITE_VISIT will be accepted only if your live location is within {siteVisitRadiusMeters} meters of configured site location.
            </div>
          )}

          <button
            onClick={onUpdateLead}
            disabled={savingUpdates}
            className="w-full h-10 rounded-lg bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {savingUpdates ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            Save Lead Update
          </button>
        </div>

        {canAssignLead && (
          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Assignment</div>

            <select
              value={executiveDraft}
              onChange={(event) => setExecutiveDraft(event.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="">Select executive</option>
              {executives.map((executive) => (
                <option key={executive._id} value={executive._id}>
                  {executive.name} ({executive.role})
                </option>
              ))}
            </select>

            <button
              onClick={onAssignLead}
              disabled={!executiveDraft || assigning}
              className="w-full h-10 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold disabled:opacity-60"
            >
              {assigning ? "Assigning..." : "Assign Lead"}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">
            Lead Diary
          </div>

          <textarea
            value={diaryDraft}
            onChange={(event) => setDiaryDraft(event.target.value)}
            placeholder="Add conversation notes, visit details, objections, or next step context..."
            className="w-full min-h-[84px] rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-slate-300"
            maxLength={2000}
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[10px] text-slate-500">
              {diaryDraft.length}/2000
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onDiaryVoiceToggle}
                disabled={savingDiary || !isDiaryMicSupported}
                className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
              >
                {isDiaryListening ? <MicOff size={13} /> : <Mic size={13} />}
                {isDiaryListening ? "Stop Mic" : "Voice"}
              </button>
              <button
                onClick={onAddDiary}
                disabled={savingDiary || !diaryDraft.trim()}
                className="h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1"
              >
                {savingDiary ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
                Add Note
              </button>
            </div>
          </div>

          {!isDiaryMicSupported && (
            <div className="mt-2 text-[10px] text-amber-700">
              Voice input is not supported in this browser. Use Chrome/Edge for mic dictation.
            </div>
          )}

          <div className="mt-3">
            {diaryLoading ? (
              <div className="h-16 flex items-center justify-center text-slate-400 text-sm gap-2">
                <Loader size={14} className="animate-spin" /> Loading diary...
              </div>
            ) : diaryEntries.length === 0 ? (
              <div className="text-sm text-slate-500">No diary notes yet</div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                {diaryEntries.map((entry) => (
                  <div key={entry._id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <div className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                      {entry.note}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {formatDate(entry.createdAt)}
                      {entry.createdBy?.name ? ` - ${entry.createdBy.name}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1 mb-2">
            <History size={12} /> Activity Timeline
          </div>

          {activityLoading ? (
            <div className="h-24 flex items-center justify-center text-slate-400 text-sm gap-2">
              <Loader size={14} className="animate-spin" /> Loading timeline...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-sm text-slate-500">No activity yet</div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div key={activity._id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                  <div className="text-sm text-slate-800">{activity.action}</div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {formatDate(activity.createdAt)}
                    {activity.performedBy?.name ? ` - ${activity.performedBy.name}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Motion.aside>
  </>
);
