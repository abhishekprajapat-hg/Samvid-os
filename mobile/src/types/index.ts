export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "ASSISTANT_MANAGER"
  | "TEAM_LEADER"
  | "EXECUTIVE"
  | "FIELD_EXECUTIVE"
  | "CHANNEL_PARTNER";

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

export interface Lead {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  source?: string;
  projectInterested?: string;
  status: string;
  nextFollowUp?: string;
  assignedTo?: User;
  inventoryId?: InventoryAsset | string | null;
  relatedInventoryIds?: Array<InventoryAsset | string>;
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
  amenities?: string[];
  images?: string[];
  documents?: string[];
  description?: string;
  createdAt?: string;
  updatedAt?: string;
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
}

export interface ChatConversation {
  _id: string;
  participants: ChatContact[];
  lastMessage?: string;
  lastMessageAt?: string;
  updatedAt?: string;
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
