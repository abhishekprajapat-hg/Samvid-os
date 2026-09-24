import { lazy, Suspense, useEffect, useState } from "react";
import { MessageCircle, Minus, X } from "lucide-react";
const TeamChat = lazy(() => import("../../modules/chat/TeamChat"));
export default function FloatingMessenger({ theme, unreadTotal = 0 }) {
 const [mode, setMode] = useState("closed");
 useEffect(() => { const open = () => setMode("open"); window.addEventListener("crm:open-messenger", open); return () => window.removeEventListener("crm:open-messenger", open); }, []);
 return <aside className="fixed bottom-4 right-4 z-[80] max-w-[calc(100vw-2rem)]">
  {mode !== "closed" && <section aria-label="Team messenger" className={mode === "open" ? "flex h-[min(680px,80dvh)] w-[min(900px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:bg-slate-950" : "hidden"}>
   <header className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white"><strong>Team messenger</strong><div className="flex gap-3"><button aria-label="Minimize messenger" onClick={() => setMode("minimized")}><Minus size={18}/></button><button aria-label="Close messenger" onClick={() => setMode("closed")}><X size={18}/></button></div></header>
   <div className="min-h-0 flex-1"><Suspense fallback={<p className="p-4">Loading conversations…</p>}><TeamChat theme={theme} embedded visible={mode === "open"}/></Suspense></div>
  </section>}
  {mode !== "open" && <button onClick={() => setMode("open")} className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 font-semibold text-white shadow-xl" aria-label="Open messenger"><MessageCircle size={19}/>Messenger{unreadTotal > 0 && <span className="rounded-full bg-blue-500 px-2 text-xs">{unreadTotal}</span>}</button>}
 </aside>;
}
