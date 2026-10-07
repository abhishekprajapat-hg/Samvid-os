/*
 * Legal notices, with the wording lifted verbatim from
 * frontend/src/modules/legal/DataUseNotice.jsx and ServiceTermsNotice.jsx.
 *
 * These are the privacy policy and terms both app stores ask to see, and the
 * text is the company's legal position - so it is copied, not paraphrased, and
 * any change belongs on the web side first.
 */

export type LegalSection = { title: string; body: string };

export const LEGAL_LAST_UPDATED = "February 23, 2026";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Scope",
    body:
      "This Privacy Policy explains how The Office on Rent collects, uses, stores, and protects your information when you use our platform, including authentication and integrations with Google services.",
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

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "Acceptance Of Terms",
    body:
      "By accessing or using The Office on Rent, you agree to these Terms and Conditions. If you do not agree, do not use the platform.",
  },
  {
    title: "Eligibility And Accounts",
    body:
      "You must use accurate account information and keep credentials secure. You are responsible for all activities performed through your account.",
  },
  {
    title: "Google Authentication And Integrations",
    body:
      "When Google Sign-In or Google APIs are used, you authorize The Office on Rent to access approved Google account data and API scopes needed for product functions.",
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
      "The service is provided on an as-available basis. To the maximum extent permitted by law, The Office on Rent disclaims implied warranties and limits liability for indirect or consequential damages.",
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
