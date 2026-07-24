import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const LAST_UPDATED = "February 23, 2026";

const sections = [
  {
    title: "Scope",
    body:
      "This Privacy Policy explains how Samvid OS collects, uses, stores, and protects your information when you use our platform, including authentication and integrations with Google services.",
  },
  {
    title: "Data We Collect",
    body:
      "We may collect account details (name, email, role), operational records (inventory, leads, activities), and technical metadata (device/browser logs, IP, session timestamps) required to provide and secure the service.",
  },
  {
    title: "Google Account And API Data",
    body:
      "If Google Sign-In or Google APIs are enabled, we may access your Google basic profile data (name, email address, profile image, Google user ID) and OAuth tokens required for authentication and authorized API actions.",
  },
  {
    title: "How Google Data Is Used",
    body:
      "Google data is used only to authenticate users, maintain secure sessions, and support approved product workflows. We do not use Google user data for advertising, profiling for ad targeting, or sale to third parties.",
  },
  {
    title: "Google Limited Use Commitment",
    body:
      "Our use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
  },
  {
    title: "Sharing And Disclosure",
    body:
      "We may share data with authorized team members in your organization and essential service providers (hosting, security, analytics) under contractual controls. We may also disclose data when legally required.",
  },
  {
    title: "Retention And Deletion",
    body:
      "Data is retained only as long as needed for service delivery, legal compliance, and security. You can request deletion of your account data and associated records subject to legal or audit requirements.",
  },
  {
    title: "Revoking Google Access",
    body:
      "You can revoke app access from your Google Account permissions page at any time. Revocation may disable Google-based sign-in or connected Google features until re-authorized.",
  },
  {
    title: "Security",
    body:
      "We apply reasonable technical and organizational safeguards, including role-based access control, authentication controls, transport security, and operational logging to protect your data.",
  },
  {
    title: "Policy Updates",
    body:
      "We may update this policy periodically. Material changes will be reflected by revising the last updated date and, where required, notifying users through platform channels.",
  },
];

const DataUseNotice = () => (
  <div className="ui-page-shell min-h-screen text-slate-900">
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        to="/login"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 hover:border-cyan-400 hover:text-cyan-700"
      >
        <ArrowLeft size={14} />
        Back To Login
      </Link>

      <div className="ui-soft-panel mt-6 rounded-3xl p-6 shadow-[0_26px_65px_-36px_rgba(2,6,23,0.2)] backdrop-blur-xl sm:p-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-cyan-300 bg-cyan-100 p-2 text-cyan-700">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-700">
              Legal
            </p>
            <h1 className="mt-1 font-display text-3xl text-slate-900">Privacy Policy</h1>
            <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-7 space-y-5">
          {sections.map((section) => (
            <section key={section.title} className="ui-soft-panel rounded-2xl p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-900">
                {section.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default DataUseNotice;
