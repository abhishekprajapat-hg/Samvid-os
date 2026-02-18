import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Globe2,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

const STORAGE_KEY = "samvid.system.settings.v1";

const DEFAULT_SETTINGS = {
  organizationName: "Samvid Real Estate",
  supportEmail: "admin@samvid.os",
  supportPhone: "+91 98765 43210",
  language: "English",
  timezone: "Asia/Kolkata",
  currency: "INR",
  fiscalYearStart: "April",
  taxPercent: "18",
  appearance: {
    accent: "cyan",
    density: "comfortable",
    compactTables: false,
    reduceMotion: false,
    highContrast: false,
  },
  notifications: {
    leadAssigned: true,
    paymentReceived: true,
    dailyDigest: true,
    weeklyOps: false,
    securityAlerts: true,
  },
  security: {
    sessionTimeout: "60",
    enforce2FA: true,
    allowNewDeviceLogin: true,
    geoLock: false,
    ipWhitelist: "",
  },
  automation: {
    autoAssignLeads: true,
    smartFollowups: true,
    webhookSync: true,
    nightlyBackup: true,
    backupRetentionDays: "30",
  },
};

const ACCENT_THEMES = {
  cyan: {
    dot: "bg-cyan-500",
    ring: "ring-cyan-300",
    soft: "bg-cyan-500/10 border-cyan-300/40 text-cyan-700",
  },
  emerald: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-300",
    soft: "bg-emerald-500/10 border-emerald-300/40 text-emerald-700",
  },
  amber: {
    dot: "bg-amber-500",
    ring: "ring-amber-300",
    soft: "bg-amber-500/10 border-amber-300/40 text-amber-700",
  },
  rose: {
    dot: "bg-rose-500",
    ring: "ring-rose-300",
    soft: "bg-rose-500/10 border-rose-300/40 text-rose-700",
  },
};

const normalizeSettings = (raw = {}) => ({
  organizationName: raw.organizationName ?? DEFAULT_SETTINGS.organizationName,
  supportEmail: raw.supportEmail ?? DEFAULT_SETTINGS.supportEmail,
  supportPhone: raw.supportPhone ?? DEFAULT_SETTINGS.supportPhone,
  language: raw.language ?? DEFAULT_SETTINGS.language,
  timezone: raw.timezone ?? DEFAULT_SETTINGS.timezone,
  currency: raw.currency ?? DEFAULT_SETTINGS.currency,
  fiscalYearStart: raw.fiscalYearStart ?? DEFAULT_SETTINGS.fiscalYearStart,
  taxPercent: raw.taxPercent ?? DEFAULT_SETTINGS.taxPercent,
  appearance: {
    ...DEFAULT_SETTINGS.appearance,
    ...(raw.appearance || {}),
  },
  notifications: {
    ...DEFAULT_SETTINGS.notifications,
    ...(raw.notifications || {}),
  },
  security: {
    ...DEFAULT_SETTINGS.security,
    ...(raw.security || {}),
  },
  automation: {
    ...DEFAULT_SETTINGS.automation,
    ...(raw.automation || {}),
  },
});

const readInitialSettings = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return normalizeSettings(raw);
  } catch {
    return normalizeSettings();
  }
};

const Toggle = ({ value, onChange, isDark }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    aria-pressed={value}
    className={`relative h-7 w-12 shrink-0 rounded-full border overflow-hidden transition-all ${
      value
        ? "bg-cyan-500 border-cyan-400"
        : isDark
          ? "bg-slate-700 border-slate-600"
          : "bg-slate-300 border-slate-300"
    }`}
  >
    <span
      className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        value ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const Panel = ({ icon: Icon, title, subtitle, children, delay = 0 }) => (
  <motion.section
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="relative rounded-3xl border border-slate-200/90 bg-white/85 backdrop-blur p-5 sm:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
  >
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-display text-slate-900 tracking-wide">{title}</h3>
        <p className="mt-1 text-xs text-slate-500 uppercase tracking-wider">{subtitle}</p>
      </div>
      <div className="h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600">
        <Icon size={16} />
      </div>
    </div>
    {children}
  </motion.section>
);

const MetricCard = ({ title, value, hint, tone = "slate" }) => {
  const toneStyles = {
    slate: "bg-slate-100 text-slate-700",
    cyan: "bg-cyan-100 text-cyan-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{title}</div>
      <div className="mt-2 flex items-end justify-between">
        <div className="text-2xl font-display text-slate-900">{value}</div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${toneStyles[tone]}`}>
          {hint}
        </span>
      </div>
    </div>
  );
};

const SystemSettings = () => {
  const [settings, setSettings] = useState(() => readInitialSettings());
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(readInitialSettings()),
  );
  const [saveStatus, setSaveStatus] = useState("idle");

  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );

  const accentMeta = ACCENT_THEMES[settings.appearance.accent] || ACCENT_THEMES.cyan;

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== savedSnapshot,
    [settings, savedSnapshot],
  );

  const securityScore = useMemo(() => {
    let score = 40;
    if (settings.security.enforce2FA) score += 25;
    if (!settings.security.allowNewDeviceLogin) score += 15;
    if (settings.security.geoLock) score += 10;
    if (settings.security.sessionTimeout === "15") score += 10;
    return Math.min(score, 100);
  }, [settings.security]);

  const enabledNotifications = useMemo(
    () => Object.values(settings.notifications).filter(Boolean).length,
    [settings.notifications],
  );

  const activeAutomations = useMemo(
    () =>
      [
        settings.automation.autoAssignLeads,
        settings.automation.smartFollowups,
        settings.automation.webhookSync,
        settings.automation.nightlyBackup,
      ].filter(Boolean).length,
    [settings.automation],
  );

  useEffect(() => {
    if (saveStatus === "saved") {
      const timer = setTimeout(() => setSaveStatus("idle"), 1800);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const updateRoot = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedSnapshot(JSON.stringify(settings));
    setSaveStatus("saved");
  };

  const handleRestore = () => {
    try {
      const saved = JSON.parse(savedSnapshot);
      setSettings(normalizeSettings(saved));
      setSaveStatus("idle");
    } catch {
      setSettings(normalizeSettings());
    }
  };

  const handleFactoryReset = () => {
    const confirmed = window.confirm(
      "Factory reset all system settings? This will replace current values.",
    );
    if (!confirmed) return;

    const next = normalizeSettings(DEFAULT_SETTINGS);
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedSnapshot(JSON.stringify(next));
    setSaveStatus("saved");
  };

  return (
    <div className="w-full h-full px-4 sm:px-6 lg:px-10 pt-20 md:pt-24 pb-10 overflow-y-auto custom-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-3xl border p-5 sm:p-7 mb-6 ${
          isDark
            ? "border-cyan-200/20 bg-slate-900/85"
            : "border-slate-200 bg-white/90"
        }`}
      >
        <div className="absolute -top-20 -right-20 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-300/60 bg-white/70 text-[10px] font-bold tracking-widest uppercase text-slate-600">
              <Sparkles size={12} /> Enterprise Control Center
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-display tracking-wide text-slate-900">
              System Orchestrator
            </h1>
            <p className="mt-2 text-xs tracking-[0.25em] uppercase text-slate-500">
              Configure identity, security, automation, and operator experience
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[10px] px-3 py-1 rounded-full border font-bold uppercase tracking-widest ${
                isDirty
                  ? "bg-amber-100 border-amber-300 text-amber-700"
                  : "bg-emerald-100 border-emerald-300 text-emerald-700"
              }`}
            >
              {isDirty ? "Unsaved Changes" : "All Synced"}
            </span>

            <button
              onClick={handleRestore}
              className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Restore
            </button>

            <button
              onClick={handleSave}
              disabled={!isDirty}
              className="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center gap-2 hover:bg-slate-800 disabled:opacity-60"
            >
              <Save size={14} /> Save Changes
            </button>
          </div>
        </div>

        {saveStatus === "saved" && (
          <div className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-700 px-3 py-2 text-xs font-semibold">
            <CheckCircle2 size={14} /> Settings saved successfully
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)] gap-6">
        <aside className="xl:sticky xl:top-24 h-fit space-y-4">
          <MetricCard
            title="Security Posture"
            value={`${securityScore}%`}
            hint={securityScore >= 80 ? "Strong" : "Review"}
            tone={securityScore >= 80 ? "emerald" : "amber"}
          />
          <MetricCard
            title="Notification Rules"
            value={enabledNotifications}
            hint="Active"
            tone="cyan"
          />
          <MetricCard
            title="Automation Flows"
            value={activeAutomations}
            hint="Running"
            tone="slate"
          />

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-rose-700 text-sm font-bold">
              <AlertTriangle size={16} /> Factory Zone
            </div>
            <p className="mt-2 text-xs text-rose-600 leading-relaxed">
              Reset will immediately overwrite all saved settings for this environment.
            </p>
            <button
              onClick={handleFactoryReset}
              className="mt-3 w-full h-9 rounded-lg border border-rose-300 text-rose-700 text-xs font-bold uppercase tracking-wider hover:bg-rose-100"
            >
              Factory Reset
            </button>
          </div>
        </aside>

        <div className="space-y-5 pb-6">
          <Panel
            icon={Globe2}
            title="Organization Identity"
            subtitle="Brand, contact, and regional defaults"
            delay={0.05}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Organization Name</label>
                <input
                  value={settings.organizationName}
                  onChange={(e) => updateRoot("organizationName", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Support Email</label>
                <input
                  value={settings.supportEmail}
                  onChange={(e) => updateRoot("supportEmail", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Support Phone</label>
                <input
                  value={settings.supportPhone}
                  onChange={(e) => updateRoot("supportPhone", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateRoot("language", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                >
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Marathi</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => updateRoot("timezone", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => updateRoot("currency", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                >
                  <option value="INR">INR (Rs)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (Euro)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Fiscal Year Start</label>
                <select
                  value={settings.fiscalYearStart}
                  onChange={(e) => updateRoot("fiscalYearStart", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                >
                  <option>April</option>
                  <option>January</option>
                  <option>July</option>
                  <option>October</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Default Tax (%)</label>
                <input
                  value={settings.taxPercent}
                  onChange={(e) => updateRoot("taxPercent", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>
          </Panel>

          <Panel
            icon={Palette}
            title="Experience Design"
            subtitle="Theme accents, density, readability"
            delay={0.08}
          >
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Accent Profile</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.keys(ACCENT_THEMES).map((accent) => {
                    const selected = settings.appearance.accent === accent;
                    const theme = ACCENT_THEMES[accent];

                    return (
                      <button
                        key={accent}
                        onClick={() => updateGroup("appearance", "accent", accent)}
                        className={`h-10 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                          selected
                            ? `ring-2 ${theme.ring} border-slate-300 bg-white`
                            : "border-slate-300 bg-white text-slate-600"
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                        {accent}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Compact Tables</div>
                    <div className="text-[11px] text-slate-500">Higher data density for leads & reports</div>
                  </div>
                  <Toggle
                    value={settings.appearance.compactTables}
                    onChange={(value) => updateGroup("appearance", "compactTables", value)}
                    isDark={isDark}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Reduce Motion</div>
                    <div className="text-[11px] text-slate-500">Disable heavy transitions and effects</div>
                  </div>
                  <Toggle
                    value={settings.appearance.reduceMotion}
                    onChange={(value) => updateGroup("appearance", "reduceMotion", value)}
                    isDark={isDark}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">High Contrast UI</div>
                    <div className="text-[11px] text-slate-500">Improve visibility in bright environments</div>
                  </div>
                  <Toggle
                    value={settings.appearance.highContrast}
                    onChange={(value) => updateGroup("appearance", "highContrast", value)}
                    isDark={isDark}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Layout Density</label>
                  <select
                    value={settings.appearance.density}
                    onChange={(e) => updateGroup("appearance", "density", e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">Live Preview</div>
                <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Control Feed Widget</div>
                    <div className="text-[11px] text-slate-500">Lead assignment throughput stable</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${accentMeta.soft}`}>
                    Accent Active
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            icon={Bell}
            title="Notification Matrix"
            subtitle="Choose what your team gets and when"
            delay={0.11}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["leadAssigned", "New lead assignment alerts"],
                ["paymentReceived", "Payment and receipt confirmation"],
                ["dailyDigest", "Daily performance digest"],
                ["weeklyOps", "Weekly operations report"],
                ["securityAlerts", "Critical security anomaly alerts"],
              ].map(([key, label]) => (
                <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-700">{label}</div>
                  <Toggle
                    value={settings.notifications[key]}
                    onChange={(value) => updateGroup("notifications", key, value)}
                    isDark={isDark}
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            icon={ShieldCheck}
            title="Security Envelope"
            subtitle="Session hardening and access restrictions"
            delay={0.14}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Session Timeout</label>
                <select
                  value={settings.security.sessionTimeout}
                  onChange={(e) => updateGroup("security", "sessionTimeout", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="240">4 hours</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">IP Whitelist</label>
                <input
                  value={settings.security.ipWhitelist}
                  onChange={(e) => updateGroup("security", "ipWhitelist", e.target.value)}
                  placeholder="203.0.113.20, 198.51.100.14"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">Enforce 2FA</div>
                <Toggle
                  value={settings.security.enforce2FA}
                  onChange={(value) => updateGroup("security", "enforce2FA", value)}
                  isDark={isDark}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">Allow New Device Login</div>
                <Toggle
                  value={settings.security.allowNewDeviceLogin}
                  onChange={(value) => updateGroup("security", "allowNewDeviceLogin", value)}
                  isDark={isDark}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">Geo Lock</div>
                <Toggle
                  value={settings.security.geoLock}
                  onChange={(value) => updateGroup("security", "geoLock", value)}
                  isDark={isDark}
                />
              </div>
            </div>
          </Panel>

          <Panel
            icon={Wand2}
            title="Automation Kernel"
            subtitle="Operational automations and resilience"
            delay={0.17}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">Auto-assign incoming leads</div>
                <Toggle
                  value={settings.automation.autoAssignLeads}
                  onChange={(value) => updateGroup("automation", "autoAssignLeads", value)}
                  isDark={isDark}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">Smart follow-up scheduler</div>
                <Toggle
                  value={settings.automation.smartFollowups}
                  onChange={(value) => updateGroup("automation", "smartFollowups", value)}
                  isDark={isDark}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">Webhook synchronization</div>
                <Toggle
                  value={settings.automation.webhookSync}
                  onChange={(value) => updateGroup("automation", "webhookSync", value)}
                  isDark={isDark}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
                <div className="text-sm text-slate-700">Nightly backups</div>
                <Toggle
                  value={settings.automation.nightlyBackup}
                  onChange={(value) => updateGroup("automation", "nightlyBackup", value)}
                  isDark={isDark}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Backup Retention (days)</label>
                <input
                  value={settings.automation.backupRetentionDays}
                  onChange={(e) => updateGroup("automation", "backupRetentionDays", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 flex items-center gap-2">
              <Database size={16} className="text-slate-500" />
              Last backup simulation: every night at 02:30 local server time
            </div>
          </Panel>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="h-12 px-5 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-2xl flex items-center gap-2 hover:bg-slate-800 disabled:opacity-60"
        >
          {isDirty ? <Save size={15} /> : <CheckCircle2 size={15} />} {isDirty ? "Save" : "Saved"}
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;
