import BirthdayReminders from "../booking/components/BirthdayReminders";
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Download, FileWarning, Repeat2, Search, Users } from "lucide-react";
import { Button, Input, cn } from "../../../components/ui";
import ToastNotice from "../../../components/ui/ToastNotice";
import Segmented from "../booking/components/Segmented";
import { directoryFrom, useBoard } from "../booking/boardStore";
import { kycStatusOf } from "../booking/kycDocuments";
import ClientProfile from "./components/ClientProfile";

/*
 * Clients in this coworking space, current and former, with the profile beside the list.
 *
 * Two panes rather than a list that navigates away: picking through clients is
 * a scanning job - you compare a few before you settle on one - and a full page
 * change per click loses your place in the list every time.
 *
 * The directory is derived from the cabins, so there is no client table to fall
 * out of step with the board. A former client is not a deleted row; they are the
 * history a cabin keeps.
 */

const initials = (name = "") =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const CSV_NEWLINE = String.fromCharCode(13, 10);
const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const ClientsPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [board, dispatch, sync] = useBoard();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);

  const directory = directoryFrom(board.cabins);
  const active = directory.filter((client) => client.kind === "active");
  const former = directory.filter((client) => client.kind === "former");
  const pendingKyc = active.filter(
    (client) => !kycStatusOf({ kind: client.entityKind, documents: client.documents }).complete,
  );

  const term = query.trim().toLowerCase();
  const shown = directory
    .filter((client) => {
      if (tab === "all") return true;
      if (tab === "kyc") return pendingKyc.includes(client);
      return client.kind === tab;
    })
    .filter((client) =>
      term
        ? `${client.name} ${client.industry} ${client.contactPerson} ${client.phone} ${client.cabins
            .map((cabin) => cabin.label)
            .join(" ")} ${client.stays.map((stay) => stay.cabinLabel).join(" ")}`
            .toLowerCase()
            .includes(term)
        : true,
    );

  // The selected client lives in the URL, so a profile can be linked to from
  // the board's "Open client record" and survives a reload.
  const selectedId = params.get("client") || shown[0]?.id || "";
  const selected = directory.find((client) => client.id === selectedId) || shown[0] || null;

  const select = (id) => setParams(id ? { client: id } : {}, { replace: true });

  const exportCsv = () => {
    const header = ["Client", "Status", "Type", "Industry", "Contact", "Phone", "Cabins", "Seats", "Monthly rent", "Dues", "KYC"];
    const rows = directory.map((client) => [
      client.name,
      client.kind === "active" ? (client.returning ? "Current (returning)" : "Current") : "Former",
      client.kind === "active" ? (client.entityKind === "individual" ? "Individual" : "Company") : "",
      client.industry,
      client.contactPerson,
      client.phone,
      (client.kind === "active" ? client.cabins.map((cabin) => cabin.label) : client.stays.map((stay) => stay.cabinLabel)).join(" / "),
      client.capacity || client.stays.reduce((sum, stay) => sum + stay.seats, 0),
      client.monthlyRent,
      client.duesAmount,
      client.kind === "active"
        ? (() => {
            const status = kycStatusOf({ kind: client.entityKind, documents: client.documents });
            return status.complete ? "Complete" : `${status.uploaded}/${status.required}`;
          })()
        : "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join(CSV_NEWLINE);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "coworking-clients.csv";
    link.click();
    URL.revokeObjectURL(url);
    setToast({ type: "success", message: `Exported ${directory.length} clients to CSV.` });
  };

  return (
    <div className="custom-scrollbar h-full min-h-0 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6">
        {/* Clients are onboarded from here too, so a board that is not saving
            has to say so on this page as well as on the board itself. */}
        {sync.error ? (
          <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-900">
            {sync.error}
          </p>
        ) : null}
        <BirthdayReminders clients={directory} />
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50">
              Clients
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
              {active.length} current · {former.length} former
            {pendingKyc.length ? ` · ${pendingKyc.length} awaiting documents` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={Download} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button onClick={() => navigate("/coworking/booking-board")}>Booking board</Button>
          </div>
        </header>

        <div className="mt-4 grid min-h-0 items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-crm-soft dark:border-slate-700 dark:bg-slate-900">
            <div className="space-y-2 border-b border-slate-200 p-3 dark:border-slate-800">
              <Input
                leftIcon={Search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, contact or cabin"
              />
              <Segmented
                className="w-full"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "all", label: "All", count: directory.length },
                  { value: "active", label: "Current", count: active.length },
                  { value: "former", label: "Former", count: former.length },
                  { value: "kyc", label: "KYC due", count: pendingKyc.length },
                ]}
              />
            </div>

            <ul className="custom-scrollbar max-h-[64vh] min-h-0 flex-1 overflow-y-auto p-2">
              {shown.map((client) => {
                const isSelected = selected?.id === client.id;
                return (
                  <li key={client.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => select(client.id)}
                      className={cn(
                        "mb-1 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left outline-none transition",
                        "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                        isSelected
                          ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10"
                          : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                          client.kind === "active" ? "bg-blue-600" : "bg-slate-400 dark:bg-slate-600",
                        )}
                      >
                        {initials(client.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                            {client.name}
                          </span>
                          {client.returning ? (
                            <Repeat2 aria-hidden="true" size={12} className="shrink-0 text-blue-600 dark:text-blue-400" />
                          ) : null}
                          {client.duesAmount > 0 ? (
                            <AlertTriangle aria-hidden="true" size={12} className="shrink-0 text-rose-600" />
                          ) : null}
                          {pendingKyc.includes(client) ? (
                            <FileWarning aria-hidden="true" size={12} className="shrink-0 text-amber-600" />
                          ) : null}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {client.kind === "active"
                            ? `${client.cabins.length} ${client.cabins.length === 1 ? "cabin" : "cabins"} · ${client.capacity} seats`
                            : `${client.stays.length} past ${client.stays.length === 1 ? "stay" : "stays"} · ${client.totalMonths} mo`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}

              {!shown.length ? (
                <li className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-[12.5px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  No client matches that.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-crm-soft dark:border-slate-700 dark:bg-slate-900">
            {selected ? (
              <ClientProfile
                key={selected.id}
                client={selected}
                onOpenCabin={(code) => navigate(`/coworking/booking-board?cabin=${code}`)}
                onDocumentsChange={(clientId, documents) => {
                  dispatch({ type: "SET_CLIENT_DOCUMENTS", clientId, documents });
                  setToast({ type: "success", message: "Documents updated." });
                }}
                onRecordPayment={(code) => {
                  dispatch({ type: "RECORD_PAYMENT", cabinCode: code });
                  setToast({ type: "success", message: `Payment recorded for ${code.replace(/^([A-D])/, "$1-")}.` });
                }}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                <Users aria-hidden="true" size={28} className="mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">No client selected</p>
                <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                  Pick someone from the list to see their cabins, agreements and tenancy history.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {toast ? (
        <ToastNotice key={toast.message} type={toast.type} message={toast.message} onDismiss={() => setToast(null)} />
      ) : null}
    </div>
  );
};

export default ClientsPage;
