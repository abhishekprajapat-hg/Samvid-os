export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "EXECUTIVE"
  | "FIELD_EXECUTIVE"
  | "PRODUCTION_EXECUTIVE"
  | "COMMUNITY_MANAGER"
  | "CHANNEL_PARTNER"
  | "COWORKING_ADMIN";

export interface User {
  _id?: string;
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
  profileImageUrl?: string;
  canViewInventory?: boolean;
}

export interface AuthPayload {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  user: User;
}

export interface LeadRequirements {
  // COWORKING was added to the backend enum and to web; mobile had not
  // followed, so a coworking enquiry could not be typed at all.
  inventoryType?: "COMMERCIAL" | "RESIDENTIAL" | "COWORKING" | "";
  transactionType?: "SALE" | "LEASE" | "RENT" | "";
  furnishingStatus?: string;
  /*
   * The current requirements model: a subtype key plus a free-form bag of
   * whatever fields that subtype defines. See
   * src/config/propertyRequirementConfig.ts for the field sets, and
   * backend/src/models/Lead.js for the schema. The commercial/residential
   * objects below predate it and are still written by the backend, so both
   * shapes coexist.
   */
  propertySubtype?: string;
  subtypeData?: Record<string, unknown>;
  budgetMin?: number | null;
  budgetMax?: number | null;
  areaMin?: number | null;
  areaMax?: number | null;
  areaUnit?: "SQ_FT" | "SQ_M";
  commercial?: {
    seats?: number | null;
    cabins?: number | null;
    conferenceRooms?: number | null;
    conferenceSeats?: number | null;
    parkingAvailable?: boolean;
    pantry?: boolean;
    receptionArea?: boolean;
    waitingArea?: boolean;
    cafeteria?: boolean;
    serverRoom?: boolean;
    storageRoom?: boolean;
    breakoutArea?: boolean;
  };
  residential?: {
    bhkType?: string;
    floor?: number | null;
    amenities?: {
      lift?: boolean;
      security?: boolean;
      gym?: boolean;
      swimmingPool?: boolean;
      clubhouse?: boolean;
      powerBackup?: boolean;
      parking?: boolean;
    };
  };
  /* A coworking enquiry: one entry per cabin, plus the terms agreed. */
  coworking?: {
    cabins?: Array<{ seats: number }>;
    workstations?: number | null;
    depositMonths?: number | null;
    agreedRent?: number | null;
    noticePeriodMonths?: number | null;
    lockInMonths?: number | null;
  };
}

export interface Lead {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  /* How it reached the CRM: the Meta webhook, or somebody typing it in. */
  source?: string;
  /*
   * Where the enquiry actually came from - Meta, JustDial, a reference, a
   * broker, a walk-in. Distinct from `source`, which the intake and the dedupe
   * branch on; see the note on the backend model.
   */
  sourceChannel?: string;
  company?: string;
  clientProfession?: string;
  preferredLocations?: string[];
  /* Where a site visit is verified, radius in metres. */
  siteLocation?: { lat?: number | null; lng?: number | null; radiusMeters?: number | null } | null;
  projectInterested?: string;
  status: string;
  /*
   * Two resolutions of the same thing. `hotClient` came first and is what the
   * web flame toggle and the Hot filters read; `temperature` is the three-step
   * version the mobile comps ask for. The backend keeps them in step, and ""
   * means the lead predates the field - read it through `temperatureOf()`.
   */
  hotClient?: boolean;
  temperature?: "COLD" | "WARM" | "HOT" | "";
  nextFollowUp?: string;
  /** Why the follow-up exists - "Discuss shortlisted properties". */
  followUpPurpose?: string;
  lastContactedAt?: string;
  assignedTo?: User;
  inventoryId?: InventoryAsset | string | null;
  relatedInventoryIds?: Array<InventoryAsset | string>;
  requirements?: LeadRequirements;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryAsset {
  _id: string;
  title: string;
  location?: string;
  price?: number;
  type?: string;
  category?: string;
  status?: string;
  reservationReason?: string;
  reservationLeadId?: string;
  reservationLead?: {
    _id?: string;
    name?: string;
    phone?: string;
    status?: string;
  } | null;
  saleDetails?: {
    leadId?: string | { _id?: string; name?: string; phone?: string };
    paymentMode?: string;
    paymentType?: string;
    totalAmount?: number;
    remainingAmount?: number;
    paymentReference?: string;
    note?: string;
    soldAt?: string;
  } | null;
  amenities?: string[];
  images?: string[];
  documents?: string[];
  description?: string;
  officeNumber?: string;
  ownerName?: string;
  ownerNumber?: string;
  keyManagerName?: string;
  keyManagerNumber?: string;
  dealType?: string;
  propertyDate?: string;
  gstApplicable?: boolean;
  createdAt?: string;
  updatedAt?: string;

  /*
   * The structured columns the Inventory model actually stores. The legacy
   * asset shape above predates them and the normaliser used to drop them, so
   * a list could not show an area or a furnishing without refetching. They are
   * optional because a legacy asset row carries none of them.
   */
  propertyId?: string;
  projectName?: string;
  towerName?: string;
  inventoryType?: string;
  furnishingStatus?: string;
  buildingName?: string;
  floorNumber?: number | null;
  totalFloors?: number | null;
  carpetArea?: number | null;
  builtUpArea?: number | null;
  totalArea?: number | null;
  areaUnit?: string;
  city?: string;
  area?: string;
  pincode?: string;
  rent?: number | null;
  deposit?: number | null;
  depositMonths?: number | null;
  agreementYears?: number | null;
  lockInYears?: number | null;
  maintenanceCharges?: number | null;
  floorPlans?: string[];
  siteLocation?: { lat?: number | null; lng?: number | null } | null;
}

export interface InventoryActivity {
  _id: string;
  action: string;
  createdAt: string;
  performedBy?: {
    _id?: string;
    name?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ChatContact {
  _id: string;
  name: string;
  role: UserRole;
  roleLabel?: string;
  avatarUrl?: string;
}

export interface ChatMessage {
  _id: string;
  text: string;
  type?: string;
  attachment?: {
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    size?: number;
    storagePath?: string;
  } | null;
  createdAt: string;
  sender?: {
    _id?: string;
    name?: string;
    avatarUrl?: string;
  };
  /* Receipts, as the server stores them: one row per user who acked. */
  deliveredTo?: Array<{ user?: string; at?: string } | string>;
  seenBy?: Array<{ user?: string; at?: string } | string>;
  room?: string;
  conversation?: string;
  /* A property shared into the chat from inventory. */
  sharedProperty?: ChatSharedProperty | null;
}

export interface ChatSharedProperty {
  inventoryId?: string;
  title?: string;
  location?: string;
  price?: number;
  status?: string;
  image?: string;
}

export interface ChatConversation {
  _id: string;
  participants: ChatContact[];
  lastMessage?: string;
  lastMessageAt?: string;
  updatedAt?: string;
  unreadCount?: number;
}

export interface ChatCallLog {
  _id: string;
  conversationId?: string;
  caller?: {
    _id?: string;
    name?: string;
    role?: UserRole | string;
    profileImageUrl?: string;
  };
  callee?: {
    _id?: string;
    name?: string;
    role?: UserRole | string;
    profileImageUrl?: string;
  };
  callType: "VOICE" | "VIDEO";
  status: "INITIATED" | "RINGING" | "ACCEPTED" | "REJECTED" | "MISSED" | "ENDED" | "FAILED" | "CANCELLED";
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSec?: number;
  e2ee?: {
    enabled?: boolean;
    protocol?: string;
    senderKeyFingerprint?: string;
    receiverKeyFingerprint?: string;
  };
  metadata?: Record<string, unknown>;
}
