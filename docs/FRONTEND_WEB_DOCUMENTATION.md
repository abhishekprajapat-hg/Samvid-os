# Samvid OS Web Frontend Documentation

Generated from source files in `frontend/src`.

## Coverage Summary
- App shell files: 2
- Page files: 24
- Component files: 26
- Route entries parsed from App router: 28

## Route Map (from `frontend/src/App.jsx`)
| Path | Target component (first match in route element) |
| --- | --- |
| `/login` | `Navigate` |
| `/login/admin` | `Navigate` |
| `/*` | `Navbar` |
| `/` | `LeadsMatrix` |
| `/leads` | `LeadsMatrix` |
| `/leads/:leadId` | `LeadsMatrix` |
| `/my-leads` | `LeadsMatrix` |
| `/my-leads/:leadId` | `LeadsMatrix` |
| `/inventory` | `AssetVault` |
| `/inventory/:id` | `InventoryDetails` |
| `/finance` | `FinancialCore` |
| `/map` | `FieldOps` |
| `/reports` | `IntelligenceReports` |
| `/leaderboard` | `RoleLeaderboard` |
| `/calendar` | `MasterSchedule` |
| `/admin/notifications` | `AdminNotifications` |
| `/admin/users` | `TeamManager` |
| `/admin/users/:userId` | `UserDetailsEditor` |
| `/admin/console` | `AdminCommandConsole` |
| `/settings` | `SystemSettings` |
| `/targets` | `Performance` |
| `/chat` | `TeamChat` |
| `/profile` | `UserProfile` |
| `/privacy-policy` | `DataUseNotice` |
| `/terms-and-conditions` | `ServiceTermsNotice` |
| `/data-use-notice` | `DataUseNotice` |
| `/service-terms` | `ServiceTermsNotice` |
| `/portal/*` | `Navigate` |

## App Shell

### App
- **Path:** `frontend/src/App.jsx`
- **Type:** App Shell
- **Exports:** App
- **Key functions:** resolveHomeHeader, resolvePageHeader, toRadians, calculateDistanceMeters, authUser, applyRuntimeSystemSettings, onActivity, sendLocationUpdate, handleLogout, canAccess, toggleTheme, App
- **Hook usage:** useState=5, useEffect=8, useMemo=2, useCallback=2
- **Service dependencies:** api: api | userService: updateMyLiveLocation
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [systemSettingsVersion, setSystemSettingsVersion] = useState(0);
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    return storedTheme === "dark" ? "dark" : "light";
  });
  const inactivityTimerRef = useRef(null);
  const sessionTimeoutMsRef = useRef(
    getSessionTimeoutMs(readSystemSettings().security.sessionTimeoutMinutes),
  );
  const locationSyncStateRef = useRef({
    inFlight: false,
    lastSentAt: 0,
    lastLat: null,
    lastLng: null,
  });
  const chatRefreshGuardHandledRef = useRef(false);

  const location = useLocation();
  const navigate = useNavigate();
  const authUser = (() => {
```

### main
- **Path:** `frontend/src/main.jsx`
- **Type:** App Shell
- **Exports:** (implicit/default export pattern)
- **Key functions:** (render-only component)
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./App.jsx.
- **Code snippet:**

```jsx
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  shouldUseStrictMode ? <React.StrictMode>{app}</React.StrictMode> : app,
)
```


## Pages

All files under `src/modules` (excluding nested `components` folders) are treated as page-level modules.

### AdminCommandConsole
- **Path:** `frontend/src/modules/admin/AdminCommandConsole.jsx`
- **Type:** Page
- **Exports:** AdminCommandConsole
- **Key functions:** normalizeText, normalizeIntentText, includesAny, toLeadName, toInventoryLabel, resolveUserName, formatDateTime, formatCurrency, getAssistantStorageUserKey, getAssistantActorRole, getHistoryStorageKey, getWorkflowStorageKey
- **Hook usage:** useState=13, useEffect=10, useMemo=7, useCallback=8
- **Service dependencies:** leadService: getAllLeads, getLeadPaymentRequests, updateLeadStatus | inventoryService: approveInventoryRequest, getInventoryAssets, getPendingInventoryRequests, rejectInventoryRequest | userService: getUsers
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const AdminCommandConsole = () => {
  const navigate = useNavigate();
  const chatRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechRetryRef = useRef(0);
  const handleAskRef = useRef(null);
  const historyStorageKey = useMemo(() => getHistoryStorageKey(), []);
  const workflowStorageKey = useMemo(() => getWorkflowStorageKey(), []);
  const subscriptionStorageKey = useMemo(() => getSubscriptionStorageKey(), []);
  const auditStorageKey = useMemo(() => getAuditStorageKey(), []);
  const lastActionablePromptRef = useRef("");
  const lastDrillContextRef = useRef(null);
  const actorRole = useMemo(() => getAssistantActorRole(), []);

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLocale, setSpeechLocale] = useState("hi-IN");
  const [speechError, setSpeechError] = useState("");
  const [runtimeError, setRuntimeError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [messages, setMessages] = useState(
    () => loadStoredMessages(historyStorageKey) || initialMessages(),
```

### AdminNotifications
- **Path:** `frontend/src/modules/admin/AdminNotifications.jsx`
- **Type:** Page
- **Exports:** AdminNotifications
- **Key functions:** formatDate, formatAmount, formatPaymentMode, formatPaymentType, getApprovalTone, formatInventoryStatusLabel, getInventoryUnitLabel, toObjectIdString, formatRoleLabel, formatUserWithRole, getUserContactField, isSoldInventoryStatus
- **Hook usage:** useState=11, useEffect=5, useMemo=4, useCallback=8
- **Service dependencies:** leadService: getLeadPaymentRequests, updateLeadStatus | inventoryService: approveInventoryRequest, getPendingInventoryRequests, rejectInventoryRequest
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const AdminNotifications = () => {
  const navigate = useNavigate();
  const { adminRequestPulseAt, markAdminRequestsRead, recentAdminRequests } = useChatNotifications();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("ALL");
  const [leadRequests, setLeadRequests] = useState([]);
  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [reviewingLeadId, setReviewingLeadId] = useState("");
  const [reviewingInventoryRequestId, setReviewingInventoryRequestId] = useState("");
  const leadSectionRef = useRef(null);
  const inventorySectionRef = useRef(null);

  const isDirectInteractiveTarget = useCallback((target) => {
    if (!target || typeof target.closest !== "function") return false;
    return Boolean(target.closest("button, a, input, select, textarea, option"));
  }, []);
```

### SystemSettings
- **Path:** `frontend/src/modules/admin/SystemSettings.jsx`
- **Type:** Page
- **Exports:** SystemSettings
- **Key functions:** Toggle, Section, SystemSettings, updateGroup, handleSave, handleRestoreSaved, handleFactoryReset
- **Hook usage:** useState=3, useEffect=2, useMemo=2, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Composes local modules/components: ../../utils/systemSettings.
- **Code snippet:**

```jsx
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
```

### TeamManager
- **Path:** `frontend/src/modules/admin/TeamManager.jsx`
- **Type:** Page
- **Exports:** TeamManager
- **Key functions:** getEntityId, TeamManager, getExecutiveIdsForLeader, loadData, resetForm, handleOpenUserProfile, handleCreateUser, handleRebalance, handleDeleteUser, handleToggleChannelPartnerInventoryAccess, getLeadScopeLabel
- **Hook usage:** useState=13, useEffect=2, useMemo=8, useCallback=0
- **Service dependencies:** userService: createUser, deleteUser, getUsers, rebalanceExecutives, updateChannelPartnerInventoryAccess | leadService: getAllLeads
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Includes media/file upload processing.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const TeamManager = ({ theme = "light" }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [rebalancing, setRebalancing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [inventoryAccessUpdatingUserId, setInventoryAccessUpdatingUserId] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "MANAGER",
    reportingToId: "",
  });

  const currentRole = localStorage.getItem("role");
```

### UserDetailsEditor
- **Path:** `frontend/src/modules/admin/UserDetailsEditor.jsx`
- **Type:** Page
- **Exports:** UserDetailsEditor
- **Key functions:** getEntityId, formatDate, safeReadCurrentUserId, UserDetailsEditor, handleChange, handleRoleChange, handleSave
- **Hook usage:** useState=7, useEffect=3, useMemo=2, useCallback=1
- **Service dependencies:** userService: getUserProfileById, getUsers, updateUserByAdmin
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Includes media/file upload processing.
- **Code snippet:**

```jsx
const UserDetailsEditor = ({ theme = "light" }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isDarkTheme = theme === "dark";
  const currentUserId = safeReadCurrentUserId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "MANAGER",
    reportingToId: "",
    isActive: true,
    canViewInventory: false,
    password: "",
  });

  const loadData = useCallback(async () => {
```

### MasterSchedule
- **Path:** `frontend/src/modules/calendar/MasterSchedule.jsx`
- **Type:** Page
- **Exports:** MasterSchedule
- **Key functions:** toDateKey, toLocalDateTimeInput, formatDateTime, formatDiaryTime, buildCalendarCells, getAssignedUser, getAssignedLabel, getReportingLabel, normalizePhoneDigits, getDialerHref, getWhatsAppHref, getMailHref
- **Hook usage:** useState=16, useEffect=7, useMemo=7, useCallback=0
- **Service dependencies:** api: api | leadService: addLeadDiaryEntry, getLeadDiary
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Calls feature APIs/services: api: api | leadService: addLeadDiaryEntry, getLeadDiary.
  - Composes local modules/components: ../../utils/errorMessage.
- **Code snippet:**

```jsx
const MasterSchedule = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [activeDiaryLeadId, setActiveDiaryLeadId] = useState("");
  const [detailsLeadId, setDetailsLeadId] = useState("");
  const [deletingLeadId, setDeletingLeadId] = useState("");
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diarySaving, setDiarySaving] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [diaryEntries, setDiaryEntries] = useState([]);

  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [form, setForm] = useState({
    leadId: "",
    nextFollowUp: "",
  });
```

### TeamChat
- **Path:** `frontend/src/modules/chat/TeamChat.jsx`
- **Type:** Page
- **Exports:** TeamChat
- **Key functions:** roleBadgeClass, toLocalTime, toDayLabel, toSidebarTime, getInitials, formatCurrency, parseIceServersFromEnv, detectMediaKind, sanitizeMediaAttachment, sanitizeMediaAttachments, buildMediaLabel, sanitizeSharePayload
- **Hook usage:** useState=31, useEffect=30, useMemo=17, useCallback=36
- **Service dependencies:** chatService: createDirectRoom, getConversationCalls, getConversationMessages, getMessengerContacts, getMessengerConversations, markMessageDelivered, markMessageSeen, sendDirectMessage | chatSocket: createChatSocket
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Integrates realtime events through socket connections.
- **Code snippet:**

```jsx
const TeamChat = ({ theme = "light" }) => {
  const isDark = theme === "dark";
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useMemo(() => getCurrentUser(), []);
  const {
    unreadByConversation,
    syncUnreadFromConversations,
    setActiveConversationId,
    markConversationRead,
    markAllRead,
  } = useChatNotifications();
  const socketRef = useRef(null);
  const selectedConversationRef = useRef("");
  const chatOpenReadSyncRef = useRef(false);
  const typingStateRef = useRef({ roomId: "", isTyping: false });
  const bottomRef = useRef(null);
  const mediaInputRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const remoteTypingTimeoutsRef = useRef(new Map());
  const seenSocketMessageIdsRef = useRef(new Set());
  const deliveredReceiptIdsRef = useRef(new Set());
  const seenReceiptIdsRef = useRef(new Set());
  const peerConnectionRef = useRef(null);
```

### ExecutiveDashboard
- **Path:** `frontend/src/modules/executive/ExecutiveDashboard.jsx`
- **Type:** Page
- **Exports:** ExecutiveDashboard
- **Key functions:** ExecutiveDashboard, fetchStats, renderContent, ExecutiveOverview, StatCard, QuickPageCard
- **Hook usage:** useState=3, useEffect=1, useMemo=1, useCallback=0
- **Service dependencies:** api: api
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Calls feature APIs/services: api: api.
  - Composes local modules/components: ../inventory/AssetVault, ../leads/LeadsMatrix, ../chat/TeamChat, ../calendar/MasterSchedule, ../reports/Performance.
- **Code snippet:**

```jsx
const ExecutiveDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState({
    totalLeads: 0,
    dealsClosed: 0,
    commission: 0,
    inventoryCount: 0,
  });
  const [leadRows, setLeadRows] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [leadRes, inventoryRes] = await Promise.all([
          api.get("/leads"),
          api.get("/inventory"),
        ]);

        const leads = leadRes.data?.leads || [];
        const inventoryAssets = inventoryRes.data?.assets || [];
        const closedLeads = leads.filter((lead) => lead.status === "CLOSED");
        setLeadRows(Array.isArray(leads) ? leads : []);

        setStats({
```

### FieldDashboard
- **Path:** `frontend/src/modules/field/FieldDashboard.jsx`
- **Type:** Page
- **Exports:** FieldDashboard
- **Key functions:** FieldDashboard, fetchDashboardData, completeTask, renderContent
- **Hook usage:** useState=5, useEffect=1, useMemo=1, useCallback=0
- **Service dependencies:** api: api
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Calls feature APIs/services: api: api.
  - Composes local modules/components: ../inventory/AssetVault, ./FieldOps, ../chat/TeamChat, ../calendar/MasterSchedule, ../leads/LeadsMatrix.
- **Code snippet:**

```jsx
const FieldDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [inventoryCount, setInventoryCount] = useState(0);
  const [leadCount, setLeadCount] = useState(0);
  const [leadRows, setLeadRows] = useState([]);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const [inventoryResult, leadsResult] = await Promise.allSettled([
        api.get("/inventory"),
        api.get("/leads"),
      ]);

      if (inventoryResult.status === "fulfilled") {
        const rows = inventoryResult.value.data?.assets || [];
        setInventoryCount(Array.isArray(rows) ? rows.length : 0);
      } else {
        console.error(
          "Field dashboard inventory error:",
          toErrorMessage(inventoryResult.reason, "Unknown error"),
        );
      }
```

### FieldOps
- **Path:** `frontend/src/modules/field/FieldOps.jsx`
- **Type:** Page
- **Exports:** FieldOps
- **Key functions:** toDate, isSameDay, formatDateTime, hasValidCoordinates, normalizePosition, formatCoordinates, buildDirectionsUrl, getLeadLocationLabel, getInventoryCoordinates, getExecutiveFromLead, hashText, getCityCoordinates
- **Hook usage:** useState=11, useEffect=3, useMemo=14, useCallback=6
- **Service dependencies:** leadService: getAllLeads | inventoryService: getInventoryAssetsWithMeta | userService: getFieldExecutiveLocations, getUsers
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const FieldOps = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [inventoryAssets, setInventoryAssets] = useState([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);

  const focusMapOnPosition = useCallback((position, zoom = 15) => {
    const center = normalizePosition(position);
    if (!center) return;

    setMapFocusTarget({
      center,
      zoom,
      key: `${center[0]}:${center[1]}:${Date.now()}`,
    });
  }, []);
```

### FinancialCore
- **Path:** `frontend/src/modules/finance/FinancialCore.jsx`
- **Type:** Page
- **Exports:** FinancialCore
- **Key functions:** parseLocalDateInput, toDate, toDateInputValue, getDayStart, getDayEnd, resolveRangeBounds, getLeadRangeDate, formatCurrency, formatDateTime, toObjectIdString, toAmountNumber, getLeadRelatedInventories
- **Hook usage:** useState=8, useEffect=2, useMemo=6, useCallback=2
- **Service dependencies:** leadService: getAllLeads
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Calls feature APIs/services: leadService: getAllLeads.
- **Code snippet:**

```jsx
const FinancialCore = () => {
  const navigate = useNavigate();
  const [leadWorkspaceBasePath, setLeadWorkspaceBasePath] = useState("/leads");
  const [rangeKey, setRangeKey] = useState("30D");
  const [customRange, setCustomRange] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 9);
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(now),
    };
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = String(window.localStorage.getItem("role") || "")
      .trim()
      .toUpperCase();
```

### AssetVault
- **Path:** `frontend/src/modules/inventory/AssetVault.jsx`
- **Type:** Page
- **Exports:** AssetVault
- **Key functions:** loadGoogleMapsPlacesScript, rejectWithReset, handleLoad, toApiStatus, isReservedStatusValue, isSoldStatusValue, isNonCashPaymentMode, statusPillClass, formatPrice, formatCurrency, formatSoldPaymentModeLabel, formatSoldPaymentTypeLabel
- **Hook usage:** useState=26, useEffect=4, useMemo=1, useCallback=8
- **Service dependencies:** inventoryService: getInventoryAssets, createInventoryAsset, createInventoryCreateRequest, updateInventoryAsset, deleteInventoryAsset, requestInventoryStatusChange, requestInventoryUpdateChange, getPendingInventoryRequests, approveInventoryRequest, rejectInventoryRequest | leadService: getAllLeads
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Includes media/file upload processing.
- **Code snippet:**

```jsx
const AssetVault = () => {
  const navigate = useNavigate();
  const locationProvider = String(import.meta.env.VITE_LOCATION_PROVIDER || "osm")
    .trim()
    .toLowerCase();
  const googleMapsApiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  const googlePlacesCountry = String(import.meta.env.VITE_GOOGLE_MAPS_PLACES_COUNTRY || "in")
    .trim()
    .toLowerCase();
  const useGooglePlaces = locationProvider === "google" && Boolean(googleMapsApiKey);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState("");
  const [modeType, setModeType] = useState("sale");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState("");
  const [requestingStatusId, setRequestingStatusId] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [reviewingRequestId, setReviewingRequestId] = useState("");
```

### InventoryDetails
- **Path:** `frontend/src/modules/inventory/InventoryDetails.jsx`
- **Type:** Page
- **Exports:** InventoryDetails
- **Key functions:** formatPrice, formatDate, toCoordinateNumber, formatUserRef, formatSoldPaymentMode, formatSoldPaymentType, statusClass, FieldRow, InventoryDetails, soldLeadLabel, handleShareToChat
- **Hook usage:** useState=6, useEffect=1, useMemo=4, useCallback=1
- **Service dependencies:** inventoryService: getInventoryAssetActivity, getInventoryAssetById
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const InventoryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = localStorage.getItem("role") || "";
  const isFieldExecutive = role === "FIELD_EXECUTIVE";
  const canViewActivity = [
    "ADMIN",
    "MANAGER",
    "ASSISTANT_MANAGER",
    "TEAM_LEADER",
  ].includes(role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asset, setAsset] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [activities, setActivities] = useState([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
```

### LeadsMatrix
- **Path:** `frontend/src/modules/leads/LeadsMatrix.jsx`
- **Type:** Page
- **Exports:** LeadsMatrix
- **Key functions:** getInventoryLeadLabel, toObjectIdString, sanitizeClosureDocument, sanitizeClosureDocumentList, getLeadRelatedInventories, pushUnique, getStatusColor, getStatusLabel, getDateMs, toDateTimeInput, formatDate, toCoordinateNumber
- **Hook usage:** useState=50, useEffect=7, useMemo=3, useCallback=8
- **Service dependencies:** leadService: getAllLeads, createLead, updateLeadStatus, assignLead, addLeadRelatedProperty, selectLeadRelatedProperty, removeLeadRelatedProperty, getLeadActivity, getLeadDiary, addLeadDiaryEntry | inventoryService: getInventoryAssets, requestInventoryUpdateChange, updateInventoryAsset | userService: getUsers
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Includes media/file upload processing.
- **Code snippet:**

```jsx
const LeadsMatrix = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { leadId: routeLeadId = "" } = useParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [formData, setFormData] = useState(defaultFormData);
  const [inventoryOptions, setInventoryOptions] = useState([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState(LEAD_SORT_OPTIONS.RECENT);
  const [showDueOnly, setShowDueOnly] = useState(false);

  const [selectedLead, setSelectedLead] = useState(null);
```

### DataUseNotice
- **Path:** `frontend/src/modules/legal/DataUseNotice.jsx`
- **Type:** Page
- **Exports:** DataUseNotice
- **Key functions:** DataUseNotice
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Provides presentational UI and composition logic.
- **Code snippet:**

```jsx
const DataUseNotice = () => (
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
```

### ServiceTermsNotice
- **Path:** `frontend/src/modules/legal/ServiceTermsNotice.jsx`
- **Type:** Page
- **Exports:** ServiceTermsNotice
- **Key functions:** ServiceTermsNotice
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Provides presentational UI and composition logic.
- **Code snippet:**

```jsx
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
```

### LeadPool
- **Path:** `frontend/src/modules/manager/LeadPool.jsx`
- **Type:** Page
- **Exports:** LeadPool
- **Key functions:** LeadCard, LeadPool
- **Hook usage:** useState=1, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const LeadPool = () => {
    const [leads] = useState(initialLeads);
    const columns = ["New", "Assigned", "Site Visit", "Closed"];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col"
        >
            {/* Filters Bar */}
            <div className="flex justify-between items-center mb-6">
                <div className="glass-technical px-4 py-3 rounded-2xl flex items-center gap-3 text-secondary w-96 shadow-sm">
                    <Search size={20} className="text-primary" />
                    <input type="text" placeholder="Search by name, phone, or project..." className="bg-transparent outline-none text-sm w-full font-medium placeholder:text-secondary/50" />
                </div>

                <div className="flex gap-3">
                    <button className="glass-technical p-3 rounded-xl text-primary hover:bg-white transition-colors">
                        <Filter size={20} />
                    </button>
                    <button className="bg-primary text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2">
                        <span>+ MANUAL ENTRY</span>
```

### ManagerDashboard
- **Path:** `frontend/src/modules/manager/ManagerDashboard.jsx`
- **Type:** Page
- **Exports:** ManagerDashboard
- **Key functions:** toEntityId, ManagerDashboard, fetchRealData, isExecutiveRole, isTeamLeadRole, leadAssigneeId, getDirectTeamLeads, collectExecutiveIdsUnderTeamLead
- **Hook usage:** useState=5, useEffect=1, useMemo=7, useCallback=0
- **Service dependencies:** api: api
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Applies role-aware access or action gating.
- **Code snippet:**

```jsx
const ManagerDashboard = ({ theme = "light" }) => {
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    revenue: 0,
    leads: 0,
    assets: 0,
    negotiation: 0,
    closed: 0,
    visits: 0,
  });
  const [leadRows, setLeadRows] = useState([]);
  const [userRows, setUserRows] = useState([]);

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
```

### ClientHome
- **Path:** `frontend/src/modules/portal/ClientHome.jsx`
- **Type:** Page
- **Exports:** ClientHome
- **Key functions:** ClientHome
- **Hook usage:** useState=2, useEffect=0, useMemo=1, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const ClientHome = () => {
  const [mode, setMode] = useState("buy");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const filteredProperties = useMemo(() => {
    const selectedType = mode === "buy" ? "SALE" : "RENT";
    const normalized = query.trim().toLowerCase();

    return FEATURED_PROPERTIES.filter((property) => {
      if (property.type !== selectedType) return false;
      if (!normalized) return true;

      return (
        property.title.toLowerCase().includes(normalized) ||
        property.location.toLowerCase().includes(normalized)
      );
    });
  }, [mode, query]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060b19] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-[10%] h-72 w-72 rounded-full bg-cyan-500/20 blur-[120px]" />
```

### ClientListing
- **Path:** `frontend/src/modules/portal/ClientListing.jsx`
- **Type:** Page
- **Exports:** ClientListing
- **Key functions:** ClientListing
- **Hook usage:** useState=1, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const ClientListing = () => {
    const navigate = useNavigate();
    const [booked, setBooked] = useState(false);

    // MOCK DATA (Simulating a specific property)
    const PROPERTY = {
        title: "Skyline Lux Penthouse",
        price: "₹ 3.5 Cr",
        location: "Green Avenue, Sector 42",
        specs: { beds: 4, baths: 5, area: "3,200 Sq.Ft" },
        desc: "Experience the pinnacle of luxury living. This north-facing penthouse features a private terrace, Italian marble flooring, and smart-home automation. Located in a secure, gated community with 24/7 power backup.",
        images: [
            "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&q=80&w=600",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=600",
            "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=600",
        ]
    };

    return (
        <div className="w-full min-h-screen bg-white font-sans text-slate-900 pb-20">

            {/* 1. NAVIGATION */}
            <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100">
```

### UserProfile
- **Path:** `frontend/src/modules/profile/UserProfile.jsx`
- **Type:** Page
- **Exports:** UserProfile
- **Key functions:** formatDate, toSummaryCards, UserProfile, handleSave
- **Hook usage:** useState=8, useEffect=2, useMemo=1, useCallback=1
- **Service dependencies:** userService: getMyProfile, updateMyProfile
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Applies role-aware access or action gating.
- **Code snippet:**

```jsx
const UserProfile = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({});
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getMyProfile();
      setProfile(response.profile || null);
      setSummary(response.summary || {});
      setNameDraft(String(response.profile?.name || ""));
      setPhoneDraft(String(response.profile?.phone || ""));
    } catch (fetchError) {
      const message = toErrorMessage(fetchError, "Failed to load profile");
      console.error(`Load profile failed: ${message}`);
      setError(message);
      setProfile(null);
```

### IntelligenceReports
- **Path:** `frontend/src/modules/reports/IntelligenceReports.jsx`
- **Type:** Page
- **Exports:** IntelligenceReports
- **Key functions:** parseLocalDateInput, toDate, toDateInputValue, getDayStart, getDayEnd, resolveRangeBounds, getLeadRangeDate, formatPercent, formatDateTime, formatCurrency, toCsvValue, downloadCsv
- **Hook usage:** useState=7, useEffect=1, useMemo=9, useCallback=1
- **Service dependencies:** leadService: getAllLeads | inventoryService: getInventoryAssets
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Calls feature APIs/services: leadService: getAllLeads | inventoryService: getInventoryAssets.
- **Code snippet:**

```jsx
const IntelligenceReports = () => {
  const [rangeKey, setRangeKey] = useState("30D");
  const [customRange, setCustomRange] = useState(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 9);
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(now),
    };
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState([]);
  const [inventory, setInventory] = useState([]);

  const loadReports = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
```

### Performance
- **Path:** `frontend/src/modules/reports/Performance.jsx`
- **Type:** Page
- **Exports:** Performance
- **Key functions:** formatNumber, formatCurrency, getCurrentMonthKey, clampPercent, safeTarget, MetricCard, TargetListItem, Performance, loadTargets, handleRefresh, handleAssign
- **Hook usage:** useState=8, useEffect=2, useMemo=1, useCallback=0
- **Service dependencies:** targetService: assignHierarchyTarget, getMyTargets
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Calls feature APIs/services: targetService: assignHierarchyTarget, getMyTargets.
  - Composes local modules/components: ../../utils/errorMessage.
- **Code snippet:**

```jsx
const Performance = () => {
  const [month, setMonth] = useState(getCurrentMonthKey());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [targetState, setTargetState] = useState({
    month: "",
    canAssign: false,
    assignableReports: [],
    myTarget: null,
    incoming: [],
    outgoing: [],
  });
  const [assignmentForm, setAssignmentForm] = useState({
    assignedToId: "",
    leadsTarget: "",
    revenueTarget: "",
    siteVisitTarget: "",
    notes: "",
  });

  const loadTargets = async (requestedMonth, { quiet = false } = {}) => {
```

### RoleLeaderboard
- **Path:** `frontend/src/modules/reports/RoleLeaderboard.jsx`
- **Type:** Page
- **Exports:** RoleLeaderboard
- **Key functions:** formatPercent, rankBadgeClass, RankIcon, RoleLeaderboard, loadLeaderboard, handleRefresh
- **Hook usage:** useState=7, useEffect=1, useMemo=1, useCallback=0
- **Service dependencies:** userService: getRoleLeaderboard
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Calls feature APIs/services: userService: getRoleLeaderboard.
  - Composes local modules/components: ../../utils/errorMessage.
- **Code snippet:**

```jsx
const RoleLeaderboard = () => {
  const [viewerRole] = useState(() =>
    String(localStorage.getItem("role") || "").trim().toUpperCase(),
  );
  const [selectedRole, setSelectedRole] = useState(viewerRole || "");
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    role: "",
    roleLabel: "",
    count: 0,
    leaderboard: [],
    allowedRoleFilters: [],
  });

  const loadLeaderboard = async (days, roleFilter, { quiet = false } = {}) => {
    if (quiet) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
```


## Components

This section includes reusable components in `src/components`, nested module components, and chat notification context components.

### ErrorBoundary
- **Path:** `frontend/src/components/ErrorBoundary.jsx`
- **Type:** Component
- **Exports:** ErrorBoundary
- **Key functions:** (render-only component)
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ../utils/errorMessage.
- **Code snippet:**

```jsx
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toErrorMessage } from "../utils/errorMessage";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: toErrorMessage(error, "Unexpected UI error"),
    };
  }

  componentDidCatch(error, errorInfo) {
    const message = toErrorMessage(error, "Unexpected UI error");
    const componentStack =
      typeof errorInfo?.componentStack === "string"
```

### Login
- **Path:** `frontend/src/components/auth/Login.jsx`
- **Type:** Component
- **Exports:** Login
- **Key functions:** Login, handleLogin
- **Hook usage:** useState=4, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** api: api
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Calls feature APIs/services: api: api.
  - Composes local modules/components: ../../utils/errorMessage.
- **Code snippet:**

```jsx
const Login = ({ onLogin, portal = "GENERAL" }) => {
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", {
        email,
        password: passcode,
        portal,
      });

      const { token, refreshToken, user } = res.data;

      localStorage.setItem("token", token);
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      } else {
```

### WarpField
- **Path:** `frontend/src/components/background/WarpField.jsx`
- **Type:** Component
- **Exports:** ArchitecturalGrid
- **Key functions:** ArchitecturalGrid, draw, handleResize
- **Hook usage:** useState=0, useEffect=1, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Runs lifecycle side effects for data load or runtime synchronization.
- **Code snippet:**

```jsx
const ArchitecturalGrid = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        let offset = 0;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            // 1. The Paper Texture Base
            ctx.fillStyle = '#F8FAFC'; // Match tailwind 'void'
            ctx.fillRect(0, 0, width, height);

            // 2. The Moving Grid Lines
            ctx.beginPath();
            ctx.lineWidth = 1;
            // Subtle gray lines
```

### LeadPerformancePanel
- **Path:** `frontend/src/components/dashboard/LeadPerformancePanel.jsx`
- **Type:** Component
- **Exports:** LeadPerformancePanel
- **Key functions:** parseDate, normalizeStatus, startOfWeek, addDays, clampPercent, sum, countLeadsByStatus, buildWeeklyTrend, toBucketIndex, buildLineGeometry, formatCompactNumber, toDeltaTone
- **Hook usage:** useState=1, useEffect=0, useMemo=8, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Uses memoized selectors/derived state for rendering efficiency.
- **Code snippet:**

```jsx
const LeadPerformancePanel = ({
  leads = [],
  theme = "light",
  title = "Performance Snapshot",
  subtitle = "Live pipeline distribution",
  accent = "cyan",
  compact = false,
  defaultWindow = 8,
}) => {
  const isDark = theme === "dark";
  const panelId = useId().replace(/:/g, "");
  const palette = ACCENT_PALETTE[accent] || ACCENT_PALETTE.cyan;

  const normalizedWindow = TIME_WINDOWS.some((entry) => entry.value === defaultWindow)
    ? defaultWindow
    : 8;
  const [windowSize, setWindowSize] = useState(normalizedWindow);

  const safeLeads = Array.isArray(leads) ? leads : [];
  const totalLeads = safeLeads.length;

  const statusCounts = useMemo(() => countLeadsByStatus(safeLeads), [safeLeads]);

  const closedLeads = Number(statusCounts.CLOSED || 0);
```

### AdminRequestAlertToast
- **Path:** `frontend/src/components/layout/AdminRequestAlertToast.jsx`
- **Type:** Component
- **Exports:** AdminRequestAlertToast
- **Key functions:** toIdString, resolveLeadId, resolveLeadStatus, resolveRequestId, resolveInventoryId, formatDate, AdminRequestAlertToast
- **Hook usage:** useState=5, useEffect=2, useMemo=1, useCallback=7
- **Service dependencies:** leadService: updateLeadStatus | inventoryService: approveInventoryRequest, rejectInventoryRequest
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Calls feature APIs/services: leadService: updateLeadStatus | inventoryService: approveInventoryRequest, rejectInventoryRequest.
- **Code snippet:**

```jsx
const AdminRequestAlertToast = ({ userRole }) => {
  const navigate = useNavigate();
  const { recentAdminRequests } = useChatNotifications();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("theme-dark"),
  );
  const [dismissedIds, setDismissedIds] = useState([]);
  const [resolvedIds, setResolvedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("theme-dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const activeAlert = useMemo(() => {
    if (userRole !== "ADMIN") return null;

    return (
```

### AppPageHeader
- **Path:** `frontend/src/components/layout/AppPageHeader.jsx`
- **Type:** Component
- **Exports:** AppPageHeader
- **Key functions:** formatTimestamp, formatTimestampCompact
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Provides presentational UI and composition logic.
- **Code snippet:**

```jsx
const AppPageHeader = ({
  title,
  scopeLabel,
  roleLabel,
  updatedAt = new Date(),
}) => (
  <section className="px-2.5 pt-2 sm:px-6 sm:pt-6 lg:px-8">
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 px-2.5 py-2.5 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-2 sm:gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-base font-semibold leading-tight text-white sm:text-2xl">{title}</h1>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] custom-scrollbar sm:flex-wrap sm:gap-2 sm:text-[11px] sm:tracking-[0.12em]">
            {scopeLabel ? (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-1.5 py-0.5 text-cyan-100 sm:px-2.5 sm:py-1">
                {scopeLabel}
              </span>
            ) : null}
            {roleLabel ? (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-1.5 py-0.5 text-cyan-100 sm:px-2.5 sm:py-1">
                <span className="sm:hidden">{roleLabel}</span>
                <span className="hidden sm:inline">Role: {roleLabel}</span>
```

### Navbar
- **Path:** `frontend/src/components/layout/Navbar.jsx`
- **Type:** Component
- **Exports:** Navbar
- **Key functions:** Navbar, storedUser, handleCloseMenus
- **Hook usage:** useState=1, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
  - Composes local modules/components: ../../context/useChatNotifications.
- **Code snippet:**

```jsx
const Navbar = ({ userRole = "manager", onLogout, theme = "light", onToggleTheme }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { adminRequestUnread } = useChatNotifications();
  const isDark = theme === "dark";
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const canChannelPartnerViewInventory = Boolean(storedUser?.canViewInventory);

  const roleKeyMap = {
    ADMIN: "admin",
    MANAGER: "manager",
    ASSISTANT_MANAGER: "manager",
    TEAM_LEADER: "manager",
    EXECUTIVE: "executive",
    FIELD_EXECUTIVE: "field_agent",
    CHANNEL_PARTNER: "partner",
  };

  const normalizedRole = roleKeyMap[userRole] || "manager";
```

### Sidebar
- **Path:** `frontend/src/components/layout/Sidebar.jsx`
- **Type:** Component
- **Exports:** Sidebar
- **Key functions:** Sidebar
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
const Sidebar = ({ userRole = 'manager', onLogout, theme = "light", onToggleTheme }) => {
    const isDark = theme === "dark";
    const roleKeyMap = {
        ADMIN: "admin",
        MANAGER: "manager",
        ASSISTANT_MANAGER: "manager",
        TEAM_LEADER: "manager",
        EXECUTIVE: "executive",
        FIELD_EXECUTIVE: "field_agent",
        CHANNEL_PARTNER: "partner",
    };
    const normalizedRole = roleKeyMap[userRole] || "manager";
    const currentMenu = MENU_CONFIG[normalizedRole] || MENU_CONFIG.manager;

    return (
        <motion.aside
            initial={{ x: -140, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: "circOut" }}
            className={`fixed left-0 top-0 h-full w-36 z-50 flex flex-col justify-between items-center py-8 backdrop-blur-2xl border-r transition-colors ${
                isDark
                    ? "bg-gradient-to-b from-slate-950/95 via-slate-900/90 to-slate-950/95 border-cyan-300/20 shadow-[0_0_80px_rgba(34,211,238,0.12)]"
                    : "bg-gradient-to-b from-white/95 via-slate-100/90 to-white/95 border-slate-300/60 shadow-[0_0_40px_rgba(15,23,42,0.08)]"
            }`}
```

### chatNotificationContext
- **Path:** `frontend/src/context/chatNotificationContext.js`
- **Type:** Component
- **Exports:** ChatNotificationContext
- **Key functions:** (render-only component)
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Provides presentational UI and composition logic.
- **Code snippet:**

```js
import { createContext } from "react";

const ChatNotificationContext = createContext(null);

export default ChatNotificationContext;
```

### chatNotificationProvider
- **Path:** `frontend/src/context/chatNotificationProvider.jsx`
- **Type:** Component
- **Exports:** ChatNotificationProvider
- **Key functions:** playAdminRequestTone, getCurrentUserId, getCurrentUserRole, buildPreviewText, normalizeUnreadMapFromConversations, extractIncomingMessageEvent, normalizeAdminRequestEvent, ChatNotificationProvider, loadUnread, onConnect, onDisconnect, onConnectError
- **Hook usage:** useState=7, useEffect=1, useMemo=2, useCallback=9
- **Service dependencies:** chatSocket: createChatSocket | chatService: getMessengerConversations, markConversationRead as markConversationReadApi
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Integrates realtime events through socket connections.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
export const ChatNotificationProvider = ({ children, enabled = true }) => {
  const [unreadByConversation, setUnreadByConversation] = useState({});
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [adminRequestUnread, setAdminRequestUnread] = useState(0);
  const [recentAdminRequests, setRecentAdminRequests] = useState([]);
  const [adminRequestPulseAt, setAdminRequestPulseAt] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [permission, setPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission || "default";
  });

  const activeConversationIdRef = useRef("");
  const seenMessageIdsRef = useRef(new Set());
  const seenAdminRequestIdsRef = useRef(new Set());

  const unreadTotal = useMemo(
    () =>
      Object.values(unreadByConversation).reduce(
        (sum, value) => sum + Math.max(0, Number(value || 0)),
        0,
      ),
```

### useChatNotifications
- **Path:** `frontend/src/context/useChatNotifications.js`
- **Type:** Component
- **Exports:** useChatNotifications
- **Key functions:** useChatNotifications
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./chatNotificationContext.
- **Code snippet:**

```js
export const useChatNotifications = () => {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    return {
      unreadByConversation: {},
      unreadTotal: 0,
      recentNotifications: [],
      adminRequestUnread: 0,
      recentAdminRequests: [],
      adminRequestPulseAt: 0,
      socketConnected: false,
      permission: "unsupported",
      setActiveConversationId: () => {},
      syncUnreadFromConversations: () => {},
      markConversationRead: async () => {},
      markAllRead: async () => {},
      clearRecentNotifications: () => {},
      markAdminRequestsRead: () => {},
      clearAdminRequestNotifications: () => {},
      requestBrowserPermission: async () => "unsupported",
    };
  }

  return context;
```

### TeamManagerCards
- **Path:** `frontend/src/modules/admin/components/TeamManagerCards.jsx`
- **Type:** Component
- **Exports:** TeamLeadOverviewCards, TeamUserGrid
- **Key functions:** getUserInitials, roleBadgeTone, statusTone, TeamLeadOverviewCards, TeamUserGrid, TeamUserCard
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Applies role-aware access or action gating.
- **Code snippet:**

```jsx
export const TeamLeadOverviewCards = ({
  globalStats,
  roleBreakdown,
  isDarkTheme,
  totalUsers,
  activeUsers,
}) => {
  const cards = [
    {
      key: "teamUsers",
      label: "Team Users",
      value: totalUsers,
      helper: `${activeUsers} active`,
      icon: Users2,
      valueTone: isDarkTheme ? "text-slate-100" : "text-slate-900",
    },
    {
      key: "totalLeads",
      label: "Total Leads",
      value: globalStats.total,
      helper: "all in scope",
      icon: Activity,
      valueTone: isDarkTheme ? "text-slate-100" : "text-slate-900",
    },
```

### TeamManagerPanels
- **Path:** `frontend/src/modules/admin/components/TeamManagerPanels.jsx`
- **Type:** Component
- **Exports:** UserFormPanel, UserProfilePanel
- **Key functions:** UserFormPanel, UserProfilePanel
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Includes media/file upload processing.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```jsx
export const UserFormPanel = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  reportingCandidates,
  reportingLabel,
  submitting,
  error,
  isDarkTheme,
  roleOptions,
  reportingParentRoles,
}) => {
  const needsReporting = Boolean(reportingParentRoles[formData.role]?.length);

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/45 z-50 flex justify-end"
```

### TeamChatPanels
- **Path:** `frontend/src/modules/chat/components/TeamChatPanels.jsx`
- **Type:** Component
- **Exports:** TeamChatSidebar, TeamChatCallLogsPanel
- **Key functions:** TeamChatSidebar, TeamChatCallLogsPanel
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Provides presentational UI and composition logic.
- **Code snippet:**

```jsx
export const TeamChatSidebar = ({
  mobileSidebarVisible,
  activeContact,
  isDark,
  conversations,
  unreadTotal,
  onRefresh,
  refreshing,
  chatSearch,
  setChatSearch,
  mobileListMode,
  setMobileListMode,
  socketConnected,
  filteredConversations,
  currentUserId,
  selectedConversationId,
  unreadByConversation,
  onPickConversation,
  getOtherParticipant,
  getInitials,
  toSidebarTime,
  roleBadgeClass,
  filteredContacts,
  selectedContactId,
```

### FieldOpsDispatchQueueSection
- **Path:** `frontend/src/modules/field/components/FieldOpsDispatchQueueSection.jsx`
- **Type:** Component
- **Exports:** FieldOpsDispatchQueueSection
- **Key functions:** FieldOpsDispatchQueueSection
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./FieldOpsShared.
- **Code snippet:**

```jsx
const FieldOpsDispatchQueueSection = ({
  unassignedQueue,
  formatDateTime,
  getLeadLocationLabel,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Dispatch Queue (Unassigned)
      </h2>
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
        {unassignedQueue.length} Waiting
      </span>
    </div>
    {unassignedQueue.length === 0 ? (
      <EmptyState text="No unassigned active leads in queue." />
    ) : (
      <>
        <div className="mt-3 space-y-2 md:hidden">
          {unassignedQueue.slice(0, 12).map((lead) => (
            <div key={lead._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{lead.name || "-"}</p>
```

### FieldOpsMapSection
- **Path:** `frontend/src/modules/field/components/FieldOpsMapSection.jsx`
- **Type:** Component
- **Exports:** FieldOpsMapSection
- **Key functions:** MapViewportController, FieldOpsMapSection
- **Hook usage:** useState=0, useEffect=1, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Composes local modules/components: ./FieldOpsShared.
- **Code snippet:**

```jsx
const FieldOpsMapSection = ({
  mapCenter,
  mapFocusTarget,
  mapExecutives,
  mapProperties,
  selectedExecutiveId,
  onExecutiveSelect,
  onPropertySelect,
  onOpenDirections,
  propertyMarkerIcon,
  formatDateTime,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
          Executive Coverage Map
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Tap markers to inspect live coverage and property access points.
        </p>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <span className="whitespace-nowrap rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-700">
```

### FieldOpsQuickLocateSection
- **Path:** `frontend/src/modules/field/components/FieldOpsQuickLocateSection.jsx`
- **Type:** Component
- **Exports:** FieldOpsQuickLocateSection
- **Key functions:** FieldOpsQuickLocateSection
- **Hook usage:** useState=1, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
- **Code snippet:**

```jsx
const FieldOpsQuickLocateSection = ({
  locatableExecutives,
  selectedExecutiveId,
  selectedPropertyId,
  mapProperties,
  onExecutiveSelect,
  onPropertySelect,
}) => {
  const [mobileMode, setMobileMode] = useState("executives");
  const showExecutives = mobileMode === "executives";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Quick Locate Lists
      </h2>
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
        Click rows to focus on map
      </p>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 xl:hidden">
      <button
```

### FieldOpsShared
- **Path:** `frontend/src/modules/field/components/FieldOpsShared.jsx`
- **Type:** Component
- **Exports:** StatCard, MiniStat, StatusBadge, EmptyState
- **Key functions:** getLeadStatusLabel, StatCard, MiniStat, StatusBadge, EmptyState
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Provides presentational UI and composition logic.
- **Code snippet:**

```jsx
export const StatCard = ({ title, value, helper, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
        {icon ? React.createElement(icon, { size: 14 }) : null}
      </div>
    </div>
    <p className="mt-3 text-2xl font-display leading-none text-slate-900 sm:text-3xl">{value}</p>
    <p className="mt-2 text-xs text-slate-500">{helper}</p>
  </div>
);

export const MiniStat = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

export const StatusBadge = ({ status }) => {
  const normalized = String(status || "");
  const label = getLeadStatusLabel(normalized);
```

### FieldOpsTaskQueueSection
- **Path:** `frontend/src/modules/field/components/FieldOpsTaskQueueSection.jsx`
- **Type:** Component
- **Exports:** FieldOpsTaskQueueSection
- **Key functions:** FieldOpsTaskQueueSection
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./FieldOpsShared.
- **Code snippet:**

```jsx
const FieldOpsTaskQueueSection = ({
  selectedExecutive,
  formatDateTime,
  getLeadLocationLabel,
  getLiveCoordinates,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Executive Task Queue
      </h2>
      {selectedExecutive ? (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          {selectedExecutive.assignedRows.length} Active
        </span>
      ) : null}
    </div>

    {!selectedExecutive ? (
      <EmptyState text="Select an executive from coverage grid to inspect assignments." />
    ) : (
      <>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
```

### FieldOpsVisitsSection
- **Path:** `frontend/src/modules/field/components/FieldOpsVisitsSection.jsx`
- **Type:** Component
- **Exports:** FieldOpsVisitsSection
- **Key functions:** FieldOpsVisitsSection
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./FieldOpsShared.
- **Code snippet:**

```jsx
const FieldOpsVisitsSection = ({
  visitsTimeline,
  formatDateTime,
  getLeadLocationLabel,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
        Upcoming Site Visits
      </h2>
      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
        {visitsTimeline.length} Queued
      </span>
    </div>
    {visitsTimeline.length === 0 ? (
      <EmptyState text="No site-visit leads in current active pipeline." />
    ) : (
      <div className="mt-3 space-y-2">
        {visitsTimeline.map((lead) => (
          <div key={lead._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{lead.name || "-"}</p>
                <p className="text-xs text-slate-500">
```

### FieldOpsWorkloadSection
- **Path:** `frontend/src/modules/field/components/FieldOpsWorkloadSection.jsx`
- **Type:** Component
- **Exports:** FieldOpsWorkloadSection
- **Key functions:** FieldOpsWorkloadSection
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./FieldOpsShared.
- **Code snippet:**

```jsx
const FieldOpsWorkloadSection = ({
  executiveStats,
  selectedExecutiveId,
  onExecutiveSelect,
  formatDateTime,
}) => {
  const maxActiveLeads = executiveStats.reduce(
    (max, row) => Math.max(max, Number(row.activeAssigned || 0)),
    1,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
          Field Executive Workload
        </h2>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
          {executiveStats.length} Executives
        </span>
      </div>

      {executiveStats.length === 0 ? (
        <EmptyState text="No executive workload data available." />
```

### FieldOverview
- **Path:** `frontend/src/modules/field/components/FieldOverview.jsx`
- **Type:** Component
- **Exports:** FieldOverview
- **Key functions:** FieldOverview, FieldStatCard, QuickPageCard
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Composes local modules/components: ../../../components/dashboard/LeadPerformancePanel.
- **Code snippet:**

```jsx
const FieldOverview = ({
  tasks,
  inventoryCount,
  leadCount,
  leads,
  onCompleteTask,
  onOpen,
}) => {
  const pending = tasks.filter((task) => task.status !== "Done").length;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <FieldStatCard
          title="Pending Tasks"
          value={pending}
          hint="Today route actions"
          icon={ClipboardList}
          onClick={() => onOpen("calendar")}
        />
        <FieldStatCard
          title="Completed"
          value={tasks.length - pending}
          hint="Marked done"
```

### AssetVaultSections
- **Path:** `frontend/src/modules/inventory/components/AssetVaultSections.jsx`
- **Type:** Component
- **Exports:** AssetVaultToolbar, AssetVaultFilters, PendingInventoryRequestsPanel
- **Key functions:** AssetVaultToolbar, AssetVaultFilters, PendingInventoryRequestsPanel
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```jsx
export const AssetVaultToolbar = ({ modeType, onModeChange, canOpenCreateModal, canManage, onOpenAddModal }) => (
  <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-4 z-10">
    <div>
      <h1 className="font-display text-4xl text-slate-800 tracking-widest">
        ASSET <span className="text-emerald-600">VAULT</span>
      </h1>
      <p className="font-mono text-xs mt-2 text-slate-400 tracking-[0.3em] uppercase">
        Live Inventory Database
      </p>
    </div>

    <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
      <div className="bg-slate-200 p-1 rounded-full flex gap-1">
        <button
          onClick={() => onModeChange("sale")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
            modeType === "sale"
              ? "bg-white shadow-sm text-slate-800"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          For Sale
        </button>
        <button
```

### LeadDetailsRebuilt
- **Path:** `frontend/src/modules/leads/components/LeadDetailsRebuilt.jsx`
- **Type:** Component
- **Exports:** LeadDetailsRebuilt
- **Key functions:** approvalLabel, statusLabel, formatCurrencyInr, toDateTimeInputValue, buildDefaultCollectionFollowUp, resolveImageExtension, detectClosureDocumentKind, sanitizeClosureDocument, sanitizeClosureDocumentList, formatFileSize, blobToDataUrl, blobToPdfImageSource
- **Hook usage:** useState=11, useEffect=3, useMemo=23, useCallback=4
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Includes media/file upload processing.
  - Contains location-aware behavior (coordinates/maps/geolocation).
- **Code snippet:**

```jsx
export const LeadDetailsRebuilt = (props) => {
  if (!props.selectedLead) return null;
  return <LeadDetailsRebuiltContent {...props} />;
};
```

### LeadsMatrixSections
- **Path:** `frontend/src/modules/leads/components/LeadsMatrixSections.jsx`
- **Type:** Component
- **Exports:** LeadsMatrixToolbar, LeadsMatrixAlerts, LeadsMatrixMetrics, LeadsMatrixFilters, LeadsMatrixTable, AddLeadModal, LeadDetailsDrawer
- **Key functions:** LeadsMatrixToolbar, LeadsMatrixAlerts, LeadsMatrixMetrics, isCardActive, LeadsMatrixFilters, LeadsMatrixTable, isFollowUpDue, AddLeadModal, LeadDetailsDrawer, getApprovalTone, getApprovalLabel
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Includes media/file upload processing.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```jsx
export const LeadsMatrixToolbar = ({
  isDark,
  refreshing,
  canAddLead,
  onRefresh,
  onOpenAddModal,
  totalLeads,
  filteredLeads,
  dueFollowUps,
}) => (
  <div
    className={`mb-5 overflow-hidden rounded-3xl border px-4 py-4 sm:px-5 sm:py-5 ${
      isDark ? "border-slate-700 bg-slate-900/75" : "border-slate-200 bg-white/90"
    }`}
    style={{
      backgroundImage: isDark
        ? "radial-gradient(circle at 88% 8%, rgba(16,185,129,0.16), transparent 35%), radial-gradient(circle at 8% 90%, rgba(56,189,248,0.12), transparent 38%)"
        : "radial-gradient(circle at 88% 8%, rgba(16,185,129,0.12), transparent 35%), radial-gradient(circle at 8% 90%, rgba(56,189,248,0.1), transparent 38%)",
    }}
  >
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
          isDark ? "text-emerald-200" : "text-emerald-700"
```

### IntelligenceReportSections
- **Path:** `frontend/src/modules/reports/components/IntelligenceReportSections.jsx`
- **Type:** Component
- **Exports:** ReportsHeader, ReportSummaryCards, LeadFunnelSection, LeadAgingSection, SourceEffectivenessSection, ProjectDemandSection, ExecutivePerformanceSection, FollowUpRiskSection, InventoryInsightsSection
- **Key functions:** ReportsHeader, ReportSummaryCards, LeadFunnelSection, LeadAgingSection, SourceEffectivenessSection, ProjectDemandSection, ExecutivePerformanceSection, FollowUpRiskSection, InventoryInsightsSection, StatCard, EmptyState
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Provides presentational UI and composition logic.
- **Code snippet:**

```jsx
export const ReportsHeader = ({
  rangeOptions,
  rangeKey,
  onRangeChange,
  customRange,
  onCustomRangeChange,
  refreshing,
  onRefresh,
  onExport,
}) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 className="text-3xl font-semibold text-slate-900">Reports Dashboard</h1>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
        Funnel, quality, team and inventory reporting
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Use filters to scope report windows and export current insights.
      </p>
    </div>

    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
```

