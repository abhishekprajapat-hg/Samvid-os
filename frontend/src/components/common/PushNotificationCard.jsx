import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Smartphone } from "lucide-react";
import {
  isPushSupported,
  isIosWithoutHomeScreen,
  getPermission,
  getPushStatus,
  isSubscribedOnThisDevice,
  enablePush,
  disablePush,
  sendTestPush,
} from "../../services/pushService";

/*
 * Turning on phone notifications, per device.
 *
 * Deliberately per device rather than per account: permission is granted by a
 * browser, so "notifications are on" is only ever true of the thing you are
 * holding. The count of other registered devices is shown separately so someone
 * can tell "my phone is off" from "I have nothing registered anywhere".
 */
const PushNotificationCard = () => {
  const [permission, setPermission] = useState(() => getPermission());
  const [devices, setDevices] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  const supported = isPushSupported();
  const iosNeedsInstall = isIosWithoutHomeScreen();

  const refresh = useCallback(() => {
    getPushStatus()
      .then((status) => { setDevices(status.devices); setServerEnabled(status.enabled); })
      .catch(() => setDevices(null));
    isSubscribedOnThisDevice().then(setSubscribed);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleEnable = async () => {
    setBusy("enable");
    setMessage(null);
    try {
      await enablePush();
      setPermission(getPermission());
      setSubscribed(true);
      setMessage({ type: "success", text: "This device will now receive notifications." });
      refresh();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Could not turn on notifications." });
    } finally {
      setBusy("");
    }
  };

  const handleDisable = async () => {
    setBusy("disable");
    setMessage(null);
    try {
      await disablePush();
      setSubscribed(false);
      setMessage({ type: "info", text: "This device will no longer receive notifications." });
      refresh();
    } catch {
      setMessage({ type: "error", text: "Could not turn notifications off." });
    } finally {
      setBusy("");
    }
  };

  const handleTest = async () => {
    setBusy("test");
    setMessage(null);
    try {
      const result = await sendTestPush();
      setMessage({ type: "success", text: result.message || "Test notification sent." });
    } catch (error) {
      setMessage({ type: "error", text: error.response?.data?.message || "Could not send a test notification." });
    } finally {
      setBusy("");
    }
  };

  /*
   * "On" has to mean this device actually holds a subscription, not merely that
   * the browser would permit one. Permission alone strands a device that is at
   * "granted" with nothing registered: it would be shown only "turn off", and
   * no way back on. See isSubscribedOnThisDevice.
   */
  const active = permission === "granted" && subscribed;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
          <Bell size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-semibold leading-tight text-slate-900">Phone notifications</h4>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Get told about new tasks, messages and leads even when the app is closed
          </p>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {!supported ? (
          <p className="text-[12.5px] text-slate-500">This browser cannot receive push notifications.</p>
        ) : iosNeedsInstall ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
            <Smartphone size={14} className="mt-px shrink-0" aria-hidden="true" />
            <span>
              On iPhone, open this site in <strong>Safari</strong>, tap Share &rarr; <strong>Add to Home Screen</strong>,
              then open it from the Home Screen icon and turn notifications on there. iOS does not deliver
              notifications to a site running in a browser tab.
            </span>
          </p>
        ) : !serverEnabled ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
            Push is not configured on the server yet. VAPID keys need to be set before any device can be registered.
          </p>
        ) : permission === "denied" ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-800">
            Notifications are blocked for this site. Allow them in your browser or phone settings, then reload this page.
          </p>
        ) : null}

        {message ? (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={`rounded-lg p-3 text-[12.5px] ${
              message.type === "error"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : message.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {active ? (
            <button
              type="button"
              onClick={handleDisable}
              disabled={Boolean(busy)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-slate-700 disabled:opacity-60"
            >
              {busy === "disable" ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
              Turn off on this device
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnable}
              disabled={Boolean(busy) || !supported || iosNeedsInstall || !serverEnabled || permission === "denied"}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {busy === "enable" ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
              Turn on for this device
            </button>
          )}

          {active ? (
            <button
              type="button"
              onClick={handleTest}
              disabled={Boolean(busy)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-slate-700 disabled:opacity-60"
            >
              {busy === "test" ? <Loader2 size={14} className="animate-spin" /> : null}
              Send a test
            </button>
          ) : null}
        </div>

        {devices !== null ? (
          <p className="text-[11.5px] text-slate-400">
            {devices === 0
              ? "No devices registered yet."
              : `${devices} device${devices === 1 ? "" : "s"} registered on your account.`}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default PushNotificationCard;
