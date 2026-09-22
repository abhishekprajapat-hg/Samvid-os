import { lazy, Suspense, useState } from "react";
import { MessageCircle, Minus, X } from "lucide-react";

const TeamChat = lazy(() => import("../../modules/chat/TeamChat"));

/*
 * The messenger that follows you around the CRM.
 *
 * It shares the bottom-right corner with the back-to-top button, which is a
 * 50px circle at 20px from each edge, so the launcher sits directly above it
 * rather than under it - they used to occupy the same spot, and back-to-top's
 * higher z-index meant it covered this one. The two now read as one stack of
 * round buttons against the same right edge.
 *
 * The launcher is an icon alone. A labelled pill is wider than the controls it
 * floats over, and on the booking board it sat across the selection bar's
 * buttons; a circle the size of its neighbour does not.
 *
 * Open, the panel drops back down to the corner - there is no reason to hold a
 * 680px panel 60px off the floor - and rises above the back-to-top button,
 * which has no business floating over a conversation.
 */
const FloatingMessenger = ({ theme, unreadTotal = 0 }) => {
  /*
   * No `crm:open-messenger` listener any more. The header's chat icon was the
   * only thing that ever dispatched that event, and it now goes to the full
   * /chat page instead - so the listener sat waiting for a message nobody
   * sends. The launcher below is the way in.
   */
  const [mode, setMode] = useState("closed");

  const isOpen = mode === "open";

  return (
    <aside
      className={`fixed right-5 z-[95] max-w-[calc(100vw-2.5rem)] ${
        isOpen ? "bottom-5" : "bottom-[5.25rem]"
      }`}
    >
      {mode !== "closed" ? (
        <section
          aria-label="Team messenger"
          className={
            isOpen
              ? "flex h-[min(680px,80dvh)] w-[min(900px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
              : "hidden"
          }
        >
          <header className="flex items-center justify-between bg-slate-900 px-4 py-2 text-white">
            <strong>Team messenger</strong>
            <div className="flex gap-3">
              <button type="button" aria-label="Minimize messenger" onClick={() => setMode("minimized")}>
                <Minus size={18} />
              </button>
              <button type="button" aria-label="Close messenger" onClick={() => setMode("closed")}>
                <X size={18} />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1">
            <Suspense fallback={<p className="p-4">Loading conversations…</p>}>
              <TeamChat theme={theme} embedded visible={isOpen} />
            </Suspense>
          </div>
        </section>
      ) : null}

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setMode("open")}
          title={unreadTotal > 0 ? `Messenger — ${unreadTotal} unread` : "Messenger"}
          aria-label={unreadTotal > 0 ? `Open messenger, ${unreadTotal} unread` : "Open messenger"}
          className="relative grid h-[50px] w-[50px] place-items-center rounded-full bg-slate-900 text-white shadow-xl transition hover:bg-slate-800"
        >
          <MessageCircle size={21} />
          {unreadTotal > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
          ) : null}
        </button>
      ) : null}
    </aside>
  );
};

export default FloatingMessenger;
