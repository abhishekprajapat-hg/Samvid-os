import React from "react";
import {
  Ban,
  CalendarPlus,
  Check,
  IndianRupee,
  LogOut,
  MoveRight,
  Pencil,
  RotateCcw,
  Timer,
  TimerOff,
  UserPlus,
} from "lucide-react";
import { Button, Modal, cn } from "../../../../components/ui";
import { formatDateTime } from "../../../../utils/format";

/*
 * What has happened to this floor, newest first.
 *
 * Every action the board takes writes one line here. It is the answer to "who
 * released C-12 and when" - a question that gets asked on a coworking floor far
 * more often than anyone expects, usually after the client has already called.
 */

const KINDS = {
  onboard: { icon: UserPlus, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  book: { icon: Check, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  hold: { icon: Timer, tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  expire: { icon: TimerOff, tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  release: { icon: LogOut, tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
  renew: { icon: CalendarPlus, tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  transfer: { icon: MoveRight, tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  block: { icon: Ban, tone: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  unblock: { icon: RotateCcw, tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  payment: { icon: IndianRupee, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  edit: { icon: Pencil, tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
};

const ActivityLogDialog = ({ open, activity, onClose, onOpenCabin }) => (
  <Modal
    open={open}
    onClose={onClose}
    size="lg"
    title="Activity"
    description={activity.length ? `${activity.length} recorded for this coworking space` : "Nothing recorded yet"}
    footer={<Button onClick={onClose}>Done</Button>}
  >
    {activity.length ? (
      <ol className="custom-scrollbar max-h-[58vh] space-y-2 overflow-y-auto">
        {activity.map((item) => {
          const kind = KINDS[item.kind] || KINDS.edit;
          const Icon = kind.icon;
          return (
            <li key={item.id} className="flex gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", kind.tone)}>
                <Icon aria-hidden="true" size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400">{item.detail}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.cabinCodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onOpenCabin(code)}
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 outline-none transition hover:border-blue-500 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:border-slate-700 dark:text-slate-300"
                    >
                      {code.replace(/^([A-D])/, "$1-")}
                    </button>
                  ))}
                  <span className="ml-auto text-[10.5px] text-slate-400 dark:text-slate-500">
                    {formatDateTime(item.at)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    ) : (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-[12.5px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
        Onboard a client, hold a cabin or record a payment and it will show up here.
      </p>
    )}
  </Modal>
);

export default ActivityLogDialog;
