import React from "react";
import {
  Building2,
  BriefcaseBusiness,
  ChevronUp,
  ClipboardList,
  FileText,
  History,
  MapPinned,
  Star,
} from "lucide-react";
import { Card, CardContent, Tabs, TabButton } from "../../../components/ui";
import { KeyValue } from "./InventoryKeyValue";

const detailMeta = {
  Area: { label: "Area Details", icon: MapPinned },
  Commercial: { label: "Commercial Details", icon: BriefcaseBusiness },
  Residential: { label: "Residential Details", icon: Building2 },
  Building: { label: "Building Details", icon: Building2 },
  Terms: { label: "Terms & Conditions", icon: ClipboardList },
  "Lease terms": { label: "Terms & Conditions", icon: ClipboardList },
  Sale: { label: "Sale Details", icon: ClipboardList },
  Reservation: { label: "Reservation", icon: ClipboardList },
};

const DetailBlock = ({ title, rows }) => {
  const meaningful = rows.filter((row) => row.value !== null && row.value !== undefined && row.value !== "" && row.value !== "-");
  if (!meaningful.length) return null;
  const meta = detailMeta[title] || { label: title, icon: ClipboardList };
  const Icon = meta.icon;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
          <Icon size={18} className="text-blue-600" strokeWidth={2} />
          {meta.label}
        </h3>
        <ChevronUp size={16} className="text-slate-700" />
      </div>
      <div className="p-4">
        <KeyValue rows={meaningful} labelWidth="minmax(0, 1fr)" className="[&>dt]:text-[13px] [&>dd]:text-right [&>dd]:text-[13px]" />
      </div>
    </section>
  );
};

const AmenityPill = ({ label }) => (
  <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[13px] font-medium text-slate-700">
    <Star size={16} className="text-blue-600" />
    {label}
  </span>
);

const InventorySpecTabs = ({
  activeTab,
  onTabChange,
  showApprovals,
  showActivity,
  specBlocks = [],
  amenities = [],
  documents = [],
  floorPlans = [],
  videoTours = [],
  activities = [],
  approvalRows = [],
  formatDate,
}) => {
  const tabs = [
    { key: "specification", label: "Specification" },
    { key: "documents", label: "Documents" },
    ...(showActivity ? [{ key: "activity", label: "Activity" }] : []),
    ...(showApprovals ? [{ key: "approvals", label: "Approvals" }] : []),
  ];

  const fileList = (items, emptyLabel) => (
    items.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0">{items.map((item, index) => {
      const url = typeof item === "string" ? item : item?.url;
      const name = typeof item === "string" ? item.split("/").pop() : item?.name || item?.url?.split("/").pop();
      return <li key={`${url}-${index}`}><a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50"><FileText size={15} className="text-blue-600" />{name || "Untitled file"}</a></li>;
    })}</ul> : <p className="text-[13px] text-slate-500">{emptyLabel}</p>
  );

  return (
    <Card className="overflow-hidden border-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
      <Tabs className="gap-7 px-5">
        {tabs.map((tab) => <TabButton key={tab.key} active={tab.key === activeTab} onClick={() => onTabChange(tab.key)} className="py-3.5 text-[14px]">{tab.label}</TabButton>)}
      </Tabs>

      <CardContent className="p-4">
        {activeTab === "specification" ? <>
          <div className="grid gap-4 xl:grid-cols-4">{specBlocks.map((block) => <DetailBlock key={block.title} title={block.title} rows={block.rows} />)}</div>
          {amenities.length ? <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-4 flex items-center gap-2 text-[14px] font-bold text-slate-900"><Star size={19} className="text-blue-600" />Amenities</h3>
            <div className="flex flex-wrap gap-3">{amenities.map((item) => <AmenityPill key={item} label={item} />)}</div>
          </section> : null}
        </> : null}

        {activeTab === "documents" ? <div className="grid gap-4 md:grid-cols-3">
          <section><h3 className="mb-3 text-[14px] font-bold">Documents</h3>{fileList(documents, "No documents attached.")}</section>
          <section><h3 className="mb-3 text-[14px] font-bold">Floor plans</h3>{fileList(floorPlans, "No floor plans attached.")}</section>
          <section><h3 className="mb-3 text-[14px] font-bold">Video tours</h3>{fileList(videoTours, "No video tours attached.")}</section>
        </div> : null}

        {activeTab === "activity" ? (activities.length ? <ol className="m-0 list-none space-y-3 p-0">{activities.map((row, index) => <li key={row?._id || index} className="border-l-2 border-blue-200 pl-3"><p className="text-[13px] text-slate-700">{row?.message || row?.action || "Activity"}</p><p className="mt-1 text-[11px] text-slate-500">{formatDate?.(row?.createdAt)}</p></li>)}</ol> : <p className="flex items-center gap-2 text-[13px] text-slate-500"><History size={15} />No activity recorded for this property.</p>) : null}
        {activeTab === "approvals" ? <KeyValue rows={approvalRows} labelWidth="130px" /> : null}
      </CardContent>
    </Card>
  );
};

export default InventorySpecTabs;
