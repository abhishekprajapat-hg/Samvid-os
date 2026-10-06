import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Building2, CalendarDays, CheckCircle2, IndianRupee, ListTodo, Loader, MapPin, Phone, Target, TrendingDown, TrendingUp, UserPlus, Users, Zap } from "lucide-react";
import api from "../../services/api";
import { getLeadSummary } from "../../services/leadService";
import { toErrorMessage } from "../../utils/errorMessage";
import ToastNotice from "../../components/ui/ToastNotice";

const STAGES = [
  ["NEW", "New", ListTodo, "#3478f6", "#eef4ff"], ["CONTACTED", "Contacted", Phone, "#3489f6", "#edf6ff"],
  ["INTERESTED", "Interested", Users, "#16a76b", "#ecfaf4"], ["SITE_VISIT", "Visit", CalendarDays, "#f59e0b", "#fff8e8"],
  ["REQUESTED", "Requested", Activity, "#ff5b4d", "#fff0ef"], ["CLOSED", "Closed", CheckCircle2, "#20b978", "#eefaf5"],
];
const money = (v) => Number(v) >= 100000 ? `₹ ${(Number(v) / 100000).toFixed(1)}L` : `₹ ${Number(v || 0).toLocaleString("en-IN")}`;
const dateOf = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const initials = (name = "") => name.split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "NA";
const Card = ({ title, action, children, className = "" }) => <section className={`overflow-hidden rounded-xl border border-[#e2e8f4] bg-white shadow-[0_5px_20px_rgba(35,58,116,.05)] ${className}`}><header className="flex h-12 items-center justify-between border-b border-[#e9edf5] px-4"><h2 className="text-[14px] font-bold text-[#101936]">{title}</h2>{action}</header>{children}</section>;
const LIST_FIELDS = "_id,name,phone,status,projectInterested,nextFollowUp,updatedAt";
const leadRows = (res) => (Array.isArray(res?.data?.leads) ? res.data.leads : []);
const totalOf = (res) => Number(res?.data?.pagination?.totalCount ?? res?.data?.count ?? 0);
// One count per inventory status, read from the list's total rather than by
// loading every property (the list is paginated, so counting rows undercounts).
const countInventory = (status) => api.get("/inventory", { params: { limit: 1, fields: "_id", ...(status ? { status } : {}) } }).then(totalOf);

const Link = ({ children, onClick }) => <button type="button" onClick={onClick} className="text-[11px] font-semibold text-[#1747e8] hover:underline">{children} →</button>;

// New vs closed leads per month, from the lead summary (real records only).
const TrendChart = ({ rows = [] }) => {
  if (!rows.length) return <p className="grid h-full place-items-center text-xs text-slate-400">No lead data yet</p>;
  const max = Math.max(...rows.map((r) => Math.max(r.newLeads, r.closed)), 1);
  const x = (i) => rows.length > 1 ? 40 + i * (540 / (rows.length - 1)) : 310;
  const y = (v) => 160 - (v / max) * 140;
  const line = (key) => rows.map((r, i) => `${i ? "L" : "M"}${x(i)} ${y(r[key])}`).join("");
  return <div className="flex h-full flex-col">
    <div className="mb-1 flex gap-4 text-[10.5px] text-[#53658a]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#2458ef]"/>New leads</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#19b977]"/>Closed</span></div>
    <svg viewBox="0 0 600 190" className="min-h-0 w-full flex-1" preserveAspectRatio="none" role="img" aria-label="New and closed leads per month">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1="30" x2="590" y1={y(max * t)} y2={y(max * t)} stroke="#e7ebf3" strokeWidth="1"/>)}
      <path d={`${line("newLeads")}L${x(rows.length - 1)} 160L${x(0)} 160Z`} fill="#5d72f2" fillOpacity=".14"/>
      <path d={line("newLeads")} fill="none" stroke="#2458ef" strokeWidth="2"/>
      <path d={line("closed")} fill="none" stroke="#19b977" strokeWidth="2"/>
      {rows.map((r, i) => <g key={r.month}><circle cx={x(i)} cy={y(r.newLeads)} r="4" fill="#2458ef"><title>{`${r.label}: ${r.newLeads} new, ${r.closed} closed`}</title></circle><circle cx={x(i)} cy={y(r.closed)} r="3.5" fill="#19b977"><title>{`${r.label}: ${r.closed} closed`}</title></circle><text x={x(i)} y="182" textAnchor="middle" fontSize="11" fill="#607094">{r.label}</text></g>)}
    </svg>
  </div>;
};

// Brokerage received on closed deals per month this year.
const RevenueBars = ({ rows = [] }) => {
  const max = Math.max(...rows.map((r) => r.revenue), 0);
  return <div className="relative flex h-[220px] items-end gap-3 px-6 pb-6 pt-5">{rows.map((r) => <div key={r.month} className="flex h-full flex-1 flex-col justify-end gap-1" title={`${r.label}: ${money(r.revenue)}`}>
    <small className="text-center text-[8.5px] text-[#607094]">{r.revenue ? money(r.revenue) : ""}</small>
    <div className="rounded-t bg-gradient-to-t from-[#70d7b3] to-[#a5ead2]" style={{ height: `${max ? Math.max((r.revenue / max) * 100, r.revenue ? 3 : 0) : 0}%` }}/>
    <span className="text-center text-[9px] text-[#607094]">{r.label}</span>
  </div>)}{!max ? <p className="absolute inset-x-0 top-1/2 text-center text-xs text-slate-400">No brokerage recorded this year</p> : null}</div>;
};

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [summary, setSummary] = useState(null), [lists, setLists] = useState({ follow: [], upcoming: [], recent: [] });
  const [inventoryCounts, setInventoryCounts] = useState({ total: 0, available: 0, blocked: 0, sold: 0 }), [users, setUsers] = useState([]);
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; } }, []);
  useEffect(() => {
    let live = true;
    const now = new Date(), start = new Date(now), end = new Date(now);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    const list = (params) => api.get("/leads", { params: { fields: LIST_FIELDS, ...params } }).then(leadRows);
    Promise.all([
      getLeadSummary(),
      list({ followUpFrom: start.toISOString(), followUpTo: end.toISOString(), sortBy: "nextFollowUp", limit: 4 }),
      list({ followUpFrom: now.toISOString(), sortBy: "nextFollowUp", limit: 3 }),
      list({ sortBy: "-updatedAt", limit: 4 }),
      Promise.all([countInventory(), countInventory("Available"), countInventory("Blocked"), countInventory("Sold")]),
      api.get("/users", { params: { pagination: "false", fields: "_id,name,role,isActive" } }),
    ]).then(([leadSummary, follow, upcoming, recent, [total, available, blocked, sold], usersRes]) => {
      if (!live) return;
      setSummary(leadSummary);
      setLists({ follow, upcoming, recent });
      setInventoryCounts({ total, available, blocked, sold });
      setUsers(usersRes.data?.users || []);
    }).catch((e) => live && setError(toErrorMessage(e, "Failed to load dashboard"))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);
  const d = useMemo(() => {
    const { total, available, blocked, sold } = inventoryCounts;
    const byStatus = summary?.byStatus || {}, monthly = Array.isArray(summary?.monthly) ? summary.monthly : [];
    const thisMonth = monthly[monthly.length - 1] || null, thisYear = thisMonth?.year;
    const withWhen = (rows) => rows.map((x) => ({ ...x, when: dateOf(x.nextFollowUp) })).filter((x) => x.when);
    const stages = STAGES.map(([key,label,icon,color,soft]) => ({ key,label,icon,color,soft,value: Number(byStatus[key] || 0) }));
    return {
      total, available, blocked, occupied: sold, occupancy: total ? Math.round(sold/total*100) : 0,
      leadTotal: Number(summary?.total || 0), closedCount: Number(summary?.closed || 0), openCount: Number(summary?.open || 0),
      revenue: Number(thisMonth?.revenue || 0),
      trend: monthly.slice(-6), yearRevenue: monthly.filter((m) => m.year === thisYear),
      follow: withWhen(lists.follow), followCount: Number(summary?.followUpsToday || 0), upcoming: withWhen(lists.upcoming), recent: lists.recent, stages,
    };
  }, [inventoryCounts, lists, summary]);
  if (loading) return <div className="grid h-full place-items-center bg-[#f6f8fc]"><span className="flex items-center gap-2 text-sm text-slate-600"><Loader className="animate-spin" size={18}/>Loading dashboard...</span></div>;
  const hour = new Date().getHours(), greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening", max = Math.max(...d.stages.map((x) => x.value), 1);
  const segments = [["Available",d.available,"#19b977"],["Occupied / Sold",d.occupied,"#3478f6"],["Blocked",d.blocked,"#f5a623"]]; let offset = 0;
  const action = (path, text = "View All") => <Link onClick={() => navigate(path)}>{text}</Link>;
  return <div className="h-full overflow-y-auto bg-[#f6f8fc] px-4 py-4 text-[#101936] sm:px-5 lg:px-6"><ToastNotice message={error} type="error"/><div className="mx-auto max-w-[1500px] space-y-4">
    <header><h1 className="text-[23px] font-bold tracking-[-.02em]">{greeting}, {user?.name || "Admin"} 👋</h1><p className="mt-0.5 text-[12px] text-[#607094]">Here&apos;s what&apos;s happening with your workspace today.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Total Properties",d.total,"Active in portfolio",Building2,"#1747e8","#eaf0ff",false,"/inventory"],
      ["Total Clients",d.closedCount,"Closed deals",Users,"#1747e8","#edf2ff",false,"/coworking/clients"],
      ["Current Occupancy",`${d.occupancy}%`,`${d.occupied}/${d.total || 0} units occupied`,Target,"#1747e8","#edf2ff",false,"/inventory"],
      ["Open Leads",d.openCount,`${d.stages.find(x=>x.key==="INTERESTED")?.value || 0} interested`,Activity,"#ff574c","#fff0ef",true,"/leads"],
      ["Monthly Revenue",money(d.revenue),"Brokerage received this month",IndianRupee,"#0aa86f","#e8f8f2",false,"/finance"],
    ].map(([label,value,help,IconComponent,color,bg,,to]) => <button key={label} type="button" onClick={() => navigate(to)} className="flex min-h-[108px] items-start gap-3 rounded-xl border border-[#e2e8f4] bg-white p-3 text-left shadow-[0_5px_20px_rgba(35,58,116,.05)] transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{color,background:bg}}>{React.createElement(IconComponent, { size: 22 })}</span><span className="min-w-0 pt-0.5"><span className="block text-[12px] text-[#54658c]">{label}</span><span className="mt-1 flex items-end gap-2"><strong className="text-[23px] leading-none">{value}</strong></span><span className="mt-2 block truncate text-[11px] text-[#526184]">{help}</span></span></button>)}</section>
    <section className="grid gap-4 xl:grid-cols-[1.7fr_1.05fr_1.05fr]">
      <Card title="📈  Leads Trend" action={<span className="text-[11px] text-[#607094]">Last 6 months</span>}><div className="h-[235px] p-4"><TrendChart rows={d.trend}/></div></Card>
      <Card title="♨  Inventory Status" action={action("/inventory")}><div className="flex min-h-[235px] items-center gap-5 p-4"><div className="relative h-32 w-32 shrink-0"><svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">{segments.map(([label,value,color])=>{const n=d.total?value/d.total*100:0,c=<circle key={label} cx="21" cy="21" r="15.9" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${n} ${100-n}`} strokeDashoffset={-offset}/>;offset+=n;return c;})}</svg><div className="absolute inset-0 grid place-content-center text-center"><strong className="text-xl">{d.total}</strong><small className="text-[10px] text-[#607094]">Total Units</small></div></div><ul className="min-w-0 flex-1 space-y-3">{segments.map(([label,value,color])=><li key={label} className="flex items-center gap-2 text-[11px]"><i className="h-2.5 w-2.5 rounded-full" style={{background:color}}/><span className="flex-1 text-[#53658a]">{label}</span><strong>{value} ({d.total?Math.round(value/d.total*100):0}%)</strong></li>)}</ul></div></Card>
      <Card title={`▣  Today's Follow-ups (${d.followCount})`} action={action("/leads")}><div className="divide-y divide-[#edf0f6] px-4">{d.follow.length?d.follow.map((lead,i)=><button key={lead._id} type="button" onClick={()=>navigate("/leads")} className="flex w-full items-center gap-3 py-2.5 text-left"><span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${i%2?"bg-violet-100 text-violet-700":"bg-blue-100 text-blue-700"}`}>{initials(lead.name)}</span><span className="min-w-0 flex-1"><b className="block truncate text-[12px]">{lead.name||"Lead"}</b><small className="block truncate text-[10.5px] text-[#607094]">{lead.status?.replace(/_/g," ")}</small></span><time className="text-[10px]">{lead.when.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</time></button>):<p className="py-16 text-center text-xs text-slate-400">No follow-ups today</p>}</div></Card>
    </section>
    <Card title="Pipeline Snapshot"><div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{d.stages.map(s=><button key={s.key} type="button" onClick={()=>navigate("/leads")} className="rounded-lg border border-[#e0e6f1] p-3 text-left" style={{background:s.soft}}><span className="flex items-center gap-2 text-[11px] text-[#53658a]">{React.createElement(s.icon, { size: 14, style: { color: s.color } })}{s.label}</span><span className="mt-2 flex items-end justify-between"><strong className="text-lg">{s.value}</strong><small className="text-[10px]">{d.leadTotal?Math.round(s.value/d.leadTotal*100):0}%</small></span><span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/80"><i className="block h-full rounded-full" style={{width:`${s.value/max*100}%`,background:s.color}}/></span></button>)}</div></Card>
    <section className="grid gap-4 xl:grid-cols-[1.15fr_1.5fr_1fr]">
      <Card title="⌁  Recent Activity" action={action("/leads")}><div className="divide-y divide-[#edf0f6] px-4">{d.recent.map((lead,i)=><button key={lead._id} type="button" onClick={()=>navigate("/leads")} className="flex w-full gap-3 py-2.5 text-left"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500"/><span className="min-w-0 flex-1"><b className="block truncate text-[12px]">{i?lead.status?.replace(/_/g," "):"Lead updated"}</b><small className="block truncate text-[10.5px] text-[#607094]">{lead.name||lead.phone}</small></span><time className="text-[10px]">{dateOf(lead.updatedAt)?.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</time></button>)}</div></Card>
      <Card title="▥  Revenue Overview" action={<span className="text-[11px] text-[#607094]">This year · brokerage received</span>}><RevenueBars rows={d.yearRevenue}/></Card>
      <div className="space-y-4"><Card title="Upcoming Visits" action={action("/calendar","View Calendar")}><div className="divide-y divide-[#edf0f6] px-4">{d.upcoming.length?d.upcoming.map(lead=><button key={lead._id} type="button" onClick={()=>navigate("/calendar")} className="flex w-full items-center gap-3 py-2 text-left"><span className="grid h-9 w-12 place-items-center rounded-lg bg-[#eef2fa]"><MapPin size={16} className="text-blue-600"/></span><span className="min-w-0 flex-1"><b className="block truncate text-[11.5px]">{lead.projectInterested||lead.name}</b><small className="text-[10px] text-[#607094]">{lead.name}</small></span><time className="text-right text-[10px]">{lead.when.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}<br/>{lead.when.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</time></button>):<p className="py-8 text-center text-xs text-slate-400">No upcoming visits</p>}</div></Card><Card title="Quick Actions"><div className="grid grid-cols-2 gap-2 p-3">{[["Add Property",Building2,"/inventory","bg-blue-50 text-blue-700"],["Add Client",UserPlus,"/coworking/clients","bg-emerald-50 text-emerald-700"],["Schedule Visit",CalendarDays,"/calendar","bg-amber-50 text-amber-700"],["Create Task",Zap,"/tasks","bg-violet-50 text-violet-700"]].map(([label,IconComponent,to,cls])=><button key={label} type="button" onClick={()=>navigate(to)} className={`grid min-h-20 place-content-center gap-2 rounded-xl text-[11px] font-semibold ${cls}`}>{React.createElement(IconComponent, { size: 20, className: "mx-auto" })}{label}</button>)}</div></Card></div>
    </section>
    <p className="pb-2 text-right text-[10px] text-slate-400">{users.filter(x=>x?.isActive!==false).length} active team members</p>
  </div></div>;
};
export default ManagerDashboard;
