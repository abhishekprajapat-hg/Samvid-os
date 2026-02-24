import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MonitorCog,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import {
  DEFAULT_SYSTEM_SETTINGS,
  applySystemSettingsToDocument,
  normalizeSystemSettings,
  readSystemSettings,
  writeSystemSettings,
} from "../../utils/systemSettings";

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    aria-pressed={value}
    className={`relative h-7 w-12 rounded-full border transition-colors ${
      value ? "border-cyan-500 bg-cyan-500" : "border-slate-300 bg-slate-300"
    }`}
  >
    <span
      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        value ? "left-6" : "left-1"
      }`}
    />
  </button>
);

const Section = ({ icon: Icon, title, subtitle, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{subtitle}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600">
        <Icon size={15} />
      </div>
    </div>
    {children}
  </section>
);

const SystemSettings = () => {
  const initial = useMemo(() => readSystemSettings(), []);
  const [settings, setSettings] = useState(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(initial));
  const [saveStatus, setSaveStatus] = useState("idle");

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== savedSnapshot,
    [settings, savedSnapshot],
  );

  useEffect(() => {
    if (saveStatus !== "saved") return undefined;
    const timer = setTimeout(() => setSaveStatus("idle"), 1800);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    applySystemSettingsToDocument(settings);
    return () => {
      applySystemSettingsToDocument(readSystemSettings());
    };
  }, [settings]);

  const updateGroup = (group, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    const saved = writeSystemSettings(settings);
    setSettings(saved);
    setSavedSnapshot(JSON.stringify(saved));
    setSaveStatus("saved");
  };

  const handleRestoreSaved = () => {
    const saved = readSystemSettings();
    setSettings(saved);
    setSavedSnapshot(JSON.stringify(saved));
    setSaveStatus("idle");
  };

  const handleFactoryReset = () => {
    const confirmed = window.confirm(
      "Reset system settings to defaults? This will overwrite saved values.",
    );
    if (!confirmed) return;

    const reset = writeSystemSettings(normalizeSystemSettings(DEFAULT_SYSTEM_SETTINGS));
    setSettings(reset);
    setSavedSnapshot(JSON.stringify(reset));
    setSaveStatus("saved");
  };

  return (
    <div className="h-full w-full overflow-y-auto px-4 pb-10 pt-20 sm:px-6 lg:px-10 md:pt-24 custom-scrollbar">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">System Settings</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
              Essential controls only (fully active)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                isDirty
                  ? "border-amber-300 bg-amber-100 text-amber-700"
                  : "border-emerald-300 bg-emerald-100 text-emerald-700"
              }`}
            >
              {isDirty ? "Unsaved" : "Saved"}
            </span>
            <button
              type="button"
              onClick={handleRestoreSaved}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
            >
              <RefreshCw size={14} />
              Restore
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} />
              Save Changes
            </button>
          </div>
        </div>

        {saveStatus === "saved" ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={14} />
            Settings saved
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section
          icon={MonitorCog}
          title="Accessibility and UI"
          subtitle="Applies globally after save"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Compact Tables</p>
                <p className="text-xs text-slate-500">Reduces table row spacing across modules</p>
              </div>
              <Toggle
                value={settings.appearance.compactTables}
                onChange={(value) => updateGroup("appearance", "compactTables", value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Reduce Motion</p>
                <p className="text-xs text-slate-500">Minimizes animation and transition effects</p>
              </div>
              <Toggle
                value={settings.appearance.reduceMotion}
                onChange={(value) => updateGroup("appearance", "reduceMotion", value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">High Contrast</p>
                <p className="text-xs text-slate-500">Improves readability and visual contrast</p>
              </div>
              <Toggle
                value={settings.appearance.highContrast}
                onChange={(value) => updateGroup("appearance", "highContrast", value)}
              />
            </div>
          </div>
        </Section>

        <Section
          icon={ShieldCheck}
          title="Session Security"
          subtitle="Automatically logs out inactive sessions"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Session Timeout
              <select
                value={settings.security.sessionTimeoutMinutes}
                onChange={(event) =>
                  updateGroup("security", "sessionTimeoutMinutes", event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="240">4 hours</option>
              </select>
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              Inactivity timeout is enforced in the running app. Any mouse, keyboard, touch, or
              scroll activity resets the timer.
            </div>
          </div>
        </Section>

        <Section
          icon={Settings2}
          title="Maintenance"
          subtitle="Reset only if configuration is corrupted"
        >
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
              <AlertTriangle size={15} />
              Factory Reset
            </div>
            <p className="mt-2 text-xs text-rose-700">
              Resets all saved system settings to default values for this device.
            </p>
            <button
              type="button"
              onClick={handleFactoryReset}
              className="mt-3 inline-flex h-10 items-center rounded-lg border border-rose-300 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
            >
              Reset To Defaults
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default SystemSettings;
