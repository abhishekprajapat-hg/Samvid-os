import api from "./api";

/*
 * Owner and broker records.
 *
 * Web calls /contacts straight from ContactDatabasePage rather than through a
 * service; mobile keeps the service layer intact, as every other module here
 * does, so the endpoints stay in one place.
 *
 * Phone is the key. Re-saving a number updates that contact rather than
 * creating a duplicate, which is why there is a POST and no PATCH.
 */

export type ContactKind = "OWNER" | "BROKER";

export type CrmContact = {
  _id?: string;
  kind?: ContactKind;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  city?: string;
  propertyDetails?: string;
  notes?: string;
  blockedLeadCount?: number;
  createdAt?: string;
};

/** The columns a contact carries, in the order the form shows them. */
export const CONTACT_FIELDS = [
  "name",
  "phone",
  "email",
  "company",
  "city",
  "propertyDetails",
  "notes",
] as const;

export const EMPTY_CONTACT: Record<string, string> = Object.fromEntries(
  CONTACT_FIELDS.map((field) => [field, ""]),
);

export const getContacts = async (params: {
  kind: ContactKind;
  search?: string;
  page?: number;
}) => {
  const res = await api.get("/contacts", { params });
  return {
    contacts: (Array.isArray(res.data?.contacts) ? res.data.contacts : []) as CrmContact[],
    total: Number(res.data?.total || 0),
  };
};

/** Creates, or updates the existing record with that phone number. */
export const saveContact = async (contact: Partial<CrmContact>, kind: ContactKind) => {
  const res = await api.post("/contacts", { ...contact, kind });
  return (res.data?.contact || null) as CrmContact | null;
};

export const deleteContact = async (contactId: string) => {
  await api.delete(`/contacts/${contactId}`);
};

/*
 * The leads a broker number kept out of the pipeline. Brokers only - owners
 * do not gate lead intake, which is why web shows this column on one page.
 */
export const getBlockedLeads = async (contactId: string) => {
  const res = await api.get(`/contacts/${contactId}/blocked-leads`);
  return Array.isArray(res.data?.entries) ? res.data.entries : [];
};

/** Is this phone number already an owner or a broker? Used when adding a lead. */
export const identifyContact = async (phone: string) => {
  const res = await api.get("/contacts/identify", { params: { phone } });
  return res.data?.contact || null;
};

export const bulkImportContacts = async (kind: ContactKind, rows: Record<string, unknown>[]) => {
  const res = await api.post("/contacts/bulk", { kind, rows });
  return res.data || {};
};
