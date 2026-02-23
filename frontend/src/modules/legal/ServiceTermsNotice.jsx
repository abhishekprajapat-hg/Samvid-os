import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const LAST_UPDATED = "February 23, 2026";

const terms = [
  {
    title: "Acceptance Of Terms",
    body:
      "By accessing or using Samvid, you agree to these Terms and Conditions. If you do not agree, do not use the platform.",
  },
  {
    title: "Eligibility And Accounts",
    body:
      "You must use accurate account information and keep credentials secure. You are responsible for all activities performed through your account.",
  },
  {
    title: "Google Authentication And Integrations",
    body:
      "When Google Sign-In or Google APIs are used, you authorize Samvid to access approved Google account data and API scopes needed for product functions.",
  },
  {
    title: "Google Policy Compliance",
    body:
      "Use of Google-derived data is governed by Google API Services requirements. Our handling of such data follows the Google API Services User Data Policy, including Limited Use requirements.",
  },
  {
    title: "Permitted Use",
    body:
      "You may use the service only for lawful business purposes related to property operations, lead handling, and approved collaboration workflows.",
  },
  {
    title: "Prohibited Conduct",
    body:
      "You must not attempt unauthorized access, interfere with service availability, misuse Google integrations, extract data outside approved scope, or violate applicable laws.",
  },
  {
    title: "Data And Privacy",
    body:
      "Your use of the platform is also subject to our Privacy Policy. You are responsible for lawful collection and processing of any third-party data you upload.",
  },
  {
    title: "Service Availability",
    body:
      "We may modify, suspend, or discontinue features at any time for maintenance, security, compliance, or product updates.",
  },
  {
    title: "Disclaimer And Liability",
    body:
      "The service is provided on an as-available basis. To the maximum extent permitted by law, Samvid disclaims implied warranties and limits liability for indirect or consequential damages.",
  },
  {
    title: "Termination",
    body:
      "We may suspend or terminate access for misuse, policy violations, legal requirements, or security risk. You may stop using the service at any time.",
  },
  {
    title: "Changes To Terms",
    body:
      "We may revise these Terms periodically. Continued use after updates means you accept the revised Terms.",
  },
];

const ServiceTermsNotice = () => (
  <div className="min-h-screen bg-slate-50 text-slate-800">
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        to="/login"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 hover:border-cyan-500/60 hover:text-cyan-700"
      >
        <ArrowLeft size={14} />
        Back To Login
      </Link>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-cyan-50 p-2 text-cyan-700">
            <FileText size={18} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-700">
              Legal
            </p>
            <h1 className="mt-1 font-display text-3xl text-slate-900">Terms And Conditions</h1>
            <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>

        <div className="mt-7 space-y-5">
          {terms.map((term) => (
            <section key={term.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-800">
                {term.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{term.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default ServiceTermsNotice;
