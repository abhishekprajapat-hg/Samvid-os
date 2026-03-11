# Samvid OS Mobile App Documentation

Generated from source files in `mobile/App.tsx` and `mobile/src`.

## Coverage Summary
- Root entry files: 2
- Navigation files: 3
- Context files: 1
- Screen files: 22
- Component files: 2

## Role Navigation Map (from `mobile/src/navigation/RoleTabs.tsx`)

### Bottom Tabs
| Tab Name | Component |
| --- | --- |
| `Dashboard` | `ManagerDashboardScreen` |
| `Leads` | `LeadsMatrixScreen` |
| `Inventory` | `AssetVaultScreen` |
| `Reports` | `IntelligenceReportsScreen` |
| `Targets` | `PerformanceScreen` |
| `Finance` | `FinancialCoreScreen` |
| `Chat` | `TeamChatScreen` |
| `More` | `MoreMenuScreen` |
| `Dashboard` | `ExecutiveDashboardScreen` |
| `Leads` | `LeadsMatrixScreen` |
| `Inventory` | `AssetVaultScreen` |
| `Finance` | `FinancialCoreScreen` |
| `Targets` | `PerformanceScreen` |
| `Calendar` | `MasterScheduleScreen` |
| `Chat` | `TeamChatScreen` |
| `More` | `MoreMenuScreen` |
| `Dashboard` | `FieldDashboardScreen` |
| `Leads` | `LeadsMatrixScreen` |
| `Inventory` | `AssetVaultScreen` |
| `Finance` | `FinancialCoreScreen` |
| `Targets` | `PerformanceScreen` |
| `Field Ops` | `FieldOpsScreen` |
| `Calendar` | `MasterScheduleScreen` |
| `Chat` | `TeamChatScreen` |
| `More` | `MoreMenuScreen` |

### Stack Screens
| Stack Name | Component |
| --- | --- |
| `MainTabs` | `(render callback)` |
| `LeadDetails` | `LeadDetailsScreen` |
| `InventoryDetails` | `InventoryDetailsScreen` |
| `ChatConversation` | `ChatConversationScreen` |
| `Samvid Bot` | `SamvidBotScreen` |
| `CallScreen` | `CallScreen` |
| `Notifications` | `NotificationsScreen` |
| `Users` | `TeamManagerScreen` |
| `Profile` | `ProfileScreen` |
| `Settings` | `SystemSettingsScreen` |
| `Field Ops` | `FieldOpsScreen` |

## Root App and Navigation

### App
- **Path:** `mobile/App.tsx`
- **Type:** App / Navigation Component
- **Exports:** App
- **Key functions:** App
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./src/navigation/RootNavigator.
- **Code snippet:**

```tsx
export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator />
    </>
  );
}
```

### index
- **Path:** `mobile/index.ts`
- **Type:** App / Navigation Component
- **Exports:** (implicit/default export pattern)
- **Key functions:** (render-only component)
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ./App.
- **Code snippet:**

```ts
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
```

### AuthStack
- **Path:** `mobile/src/navigation/AuthStack.tsx`
- **Type:** App / Navigation Component
- **Exports:** AuthStack
- **Key functions:** AuthStack
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ../modules/auth/LoginScreen.
- **Code snippet:**

```tsx
export const AuthStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);
```

### RoleTabs
- **Path:** `mobile/src/navigation/RoleTabs.tsx`
- **Type:** App / Navigation Component
- **Exports:** RoleTabs
- **Key functions:** getTabIconName, RoleMainTabs, RoleTabs
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
  - Applies role-aware access or action gating.
  - Composes local modules/components: ../context/AuthContext, ../types, ../modules/manager/ManagerDashboardScreen, ../modules/executive/ExecutiveDashboardScreen, ../modules/field/FieldDashboardScreen.
- **Code snippet:**

```tsx
export const RoleTabs = ({ role }: { role: UserRole }) => (
  <Stack.Navigator>
    <Stack.Screen
      name="MainTabs"
      options={{ headerShown: false }}
    >
      {() => <RoleMainTabs role={role} />}
    </Stack.Screen>
    <Stack.Screen
      name="LeadDetails"
      component={LeadDetailsScreen}
      options={{ title: "Lead Details" }}
    />
    <Stack.Screen
      name="InventoryDetails"
      component={InventoryDetailsScreen}
      options={{ title: "Inventory Details" }}
    />
    <Stack.Screen
      name="ChatConversation"
      component={ChatConversationScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
```

### RootNavigator
- **Path:** `mobile/src/navigation/RootNavigator.tsx`
- **Type:** App / Navigation Component
- **Exports:** RootNavigator
- **Key functions:** AppShell, RootNavigator
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ../context/AuthContext, ./AuthStack, ./RoleTabs.
- **Code snippet:**

```tsx
export const RootNavigator = () => (
  <AuthProvider>
    <NavigationContainer>
      <AppShell />
    </NavigationContainer>
  </AuthProvider>
);
```

### AuthContext
- **Path:** `mobile/src/context/AuthContext.tsx`
- **Type:** App / Navigation Component
- **Exports:** AuthProvider, useAuth
- **Key functions:** AuthProvider, restore, login, logout, updateUser, useAuth
- **Hook usage:** useState=1, useEffect=2, useMemo=0, useCallback=0
- **Service dependencies:** authService: getCurrentUser, loginUser | api: setUnauthorizedHandler
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Calls feature APIs/services: authService: getCurrentUser, loginUser | api: setUnauthorizedHandler.
  - Composes local modules/components: ../storage/sessionStorage, ../types.
- **Code snippet:**

```tsx
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      setToken(null);
      setUser(null);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    const restore = async () => {
      const [storedToken, storedUser] = await Promise.all([
        sessionStorage.getToken(),
        sessionStorage.getUser(),
      ]);
```


## Screens

All `*Screen.tsx` files under `src/modules` are treated as page-level screens.

### SystemSettingsScreen
- **Path:** `mobile/src/modules/admin/SystemSettingsScreen.tsx`
- **Type:** Screen
- **Exports:** SystemSettingsScreen
- **Key functions:** SystemSettingsScreen, SettingRow
- **Hook usage:** useState=3, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Composes local modules/components: ../../components/common/Screen.
- **Code snippet:**

```tsx
export const SystemSettingsScreen = () => {
  const [leadAlerts, setLeadAlerts] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [inventoryAlerts, setInventoryAlerts] = useState(true);

  return (
    <Screen title="System Settings" subtitle="App Preferences">
      <View style={styles.card}>
        <SettingRow label="Lead Alerts" value={leadAlerts} onChange={setLeadAlerts} />
        <SettingRow label="Chat Alerts" value={chatAlerts} onChange={setChatAlerts} />
        <SettingRow label="Inventory Alerts" value={inventoryAlerts} onChange={setInventoryAlerts} />

        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Save Settings</Text>
        </Pressable>
      </View>
    </Screen>
  );
};

const SettingRow = ({
  label,
  value,
  onChange,
```

### TeamManagerScreen
- **Path:** `mobile/src/modules/admin/TeamManagerScreen.tsx`
- **Type:** Screen
- **Exports:** TeamManagerScreen
- **Key functions:** getRefId, TeamManagerScreen, openEditSheet, closeEditSheet, saveEditedUser, resetForm, addUser, rebalance, remove, Metric
- **Hook usage:** useState=23, useEffect=3, useMemo=8, useCallback=1
- **Service dependencies:** userService: createUser, deleteUser, getUsers, rebalanceExecutives, updateUserById | leadService: getAllLeads
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```tsx
export const TeamManagerScreen = () => {
  const { role, user } = useAuth();
  const isAdmin = role === "ADMIN";
  const canManageUsers = isAdmin || MANAGEMENT_ROLES.has(String(role || ""));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [leads, setLeads] = useState<TeamLead[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<"USERS" | "MANAGERS" | "EXECUTIVES" | "LEADS" | "CLOSED" | "UNASSIGNED">("USERS");
  const [editOpen, setEditOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("EXECUTIVE");
  const [editManagerId, setEditManagerId] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
```

### LoginScreen
- **Path:** `mobile/src/modules/auth/LoginScreen.tsx`
- **Type:** Screen
- **Exports:** LoginScreen
- **Key functions:** LoginScreen, submitLogin
- **Hook usage:** useState=4, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Composes local modules/components: ../../context/AuthContext, ../../utils/errorMessage, ../../components/common/ui.
- **Code snippet:**

```tsx
export const LoginScreen = () => {
  const { login } = useAuth();

  const [portal, setPortal] = useState<Portal>("GENERAL");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openDoc, setOpenDoc] = useState<LegalDoc>(null);

  const docTitle = openDoc === "TERMS" ? "Terms And Conditions" : "Privacy Policy";
  const docSections = openDoc === "TERMS" ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  const submitLogin = async () => {
    try {
      setLoading(true);
      setError("");
      await login({ email: email.trim(), password, portal });
    } catch (e) {
      setError(toErrorMessage(e, "Login failed"));
    } finally {
      setLoading(false);
```

### MasterScheduleScreen
- **Path:** `mobile/src/modules/calendar/MasterScheduleScreen.tsx`
- **Type:** Screen
- **Exports:** MasterScheduleScreen
- **Key functions:** pad2, toDateInputValue, toTimeInputValue, toDate, MasterScheduleScreen, load, openPicker, applyWebPicker, onPickerChange, scheduleLead, openLeadDiary, closeLeadDiary
- **Hook usage:** useState=19, useEffect=3, useMemo=1, useCallback=0
- **Service dependencies:** leadService: addLeadDiaryEntry, getAllLeads, getLeadDiary, updateLeadDiaryEntry, updateLeadStatus, type LeadDiaryEntry
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
  - Calls feature APIs/services: leadService: addLeadDiaryEntry, getAllLeads, getLeadDiary, updateLeadDiaryEntry, updateLeadStatus, type LeadDiaryEntry.
- **Code snippet:**

```tsx
export const MasterScheduleScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draftMap, setDraftMap] = useState<Record<string, Date>>({});
  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [webPickerVisible, setWebPickerVisible] = useState(false);
  const [webPickerLeadId, setWebPickerLeadId] = useState("");
  const [webPickerDate, setWebPickerDate] = useState("");
  const [webPickerTime, setWebPickerTime] = useState("");
  const [diaryModalLead, setDiaryModalLead] = useState<Lead | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<LeadDiaryEntry[]>([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState("");
  const [showAllDiaryEntries, setShowAllDiaryEntries] = useState(false);
  const [editingDiaryEntryId, setEditingDiaryEntryId] = useState("");
  const [diaryEditDraft, setDiaryEditDraft] = useState("");
  const [updatingDiaryEntry, setUpdatingDiaryEntry] = useState(false);
  const [isDiaryListening, setIsDiaryListening] = useState(false);
```

### CallScreen
- **Path:** `mobile/src/modules/chat/CallScreen.tsx`
- **Type:** Screen
- **Exports:** CallScreen
- **Key functions:** toDuration, ensureAndroidPermissions, CallScreen, emitSignal, markConnected, startOutgoingOffer, teardownMedia, endCall, setup, toggleMic, toggleCamera
- **Hook usage:** useState=6, useEffect=2, useMemo=1, useCallback=0
- **Service dependencies:** chatSocket: createChatSocket | chatService: updateCallLog
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Integrates realtime events through socket connections.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Calls feature APIs/services: chatSocket: createChatSocket | chatService: updateCallLog.
- **Code snippet:**

```tsx
export const CallScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { token } = useAuth();

  const params = route.params || {};
  const callId = String(params.callId || "");
  const callType = (String(params.callType || "VOICE").toUpperCase() === "VIDEO" ? "VIDEO" : "VOICE") as "VOICE" | "VIDEO";
  const peerId = String(params.peerId || "");
  const peerName = String(params.peerName || "Unknown");
  const conversationId = String(params.conversationId || "");
  const incoming = Boolean(params.incoming);

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(callType === "VOICE");
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const hasWebRtc = Boolean(
    RTCIceCandidateCtor &&
```

### ChatConversationScreen
- **Path:** `mobile/src/modules/chat/ChatConversationScreen.tsx`
- **Type:** Screen
- **Exports:** ChatConversationScreen
- **Key functions:** mergeMessages, initials, getAttachmentMimeType, isImageMessage, getSenderId, toDayKey, isSameDay, formatDayLabel, renderAvatar, isLikelyImageMime, isRenderableImageUri, toAttachment
- **Hook usage:** useState=17, useEffect=7, useMemo=2, useCallback=2
- **Service dependencies:** chatSocket: createChatSocket | chatService: getConversationMessages, getCallLogs, getMessengerContacts, sendDirectMessage, createCallLog, updateCallLog, uploadChatFile
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Integrates realtime events through socket connections.
- **Code snippet:**

```tsx
export const ChatConversationScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { token, user } = useAuth();

  const params = route.params || {};
  const contactId = String(params.contactId || "");
  const contactName = String(params.contactName || "Chat");
  const contactRole = String(params.contactRole || "");
  const contactAvatar = String(params.contactAvatar || "");
  const incomingCallPayload = params.incomingCallPayload || null;

  const [conversationId, setConversationId] = useState(String(params.conversationId || ""));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pickingFile, setPickingFile] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUrls, setViewerUrls] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
```

### SamvidBotScreen
- **Path:** `mobile/src/modules/chat/SamvidBotScreen.tsx`
- **Type:** Screen
- **Exports:** SamvidBotScreen
- **Key functions:** uid, SamvidBotScreen, sendQuery, toggleVoice
- **Hook usage:** useState=5, useEffect=1, useMemo=1, useCallback=0
- **Service dependencies:** samvidService: askSamvid
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Applies role-aware access or action gating.
  - Calls feature APIs/services: samvidService: askSamvid.
- **Code snippet:**

```tsx
export const SamvidBotScreen = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isMicSupported, setIsMicSupported] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([
    {
      id: uid(),
      role: "bot",
      text: "Namaste, main Samvid hoon. Aap inventory, lead, sold/interested status, ya best performance puch sakte hain.",
    },
  ]);

  const scrollRef = useRef<ScrollView | null>(null);
  const recognitionRef = useRef<any>(null);

  const canSend = useMemo(() => input.trim().length > 1 && !loading, [input, loading]);

  useEffect(() => {
    const win = globalThis as any;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsMicSupported(false);
```

### TeamChatScreen
- **Path:** `mobile/src/modules/chat/TeamChatScreen.tsx`
- **Type:** Screen
- **Exports:** TeamChatScreen
- **Key functions:** initials, TeamChatScreen, handleIncomingCall, acceptIncomingCall, rejectIncomingCall, openConversation, renderAvatar
- **Hook usage:** useState=6, useEffect=2, useMemo=2, useCallback=1
- **Service dependencies:** chatService: getMessengerContacts, getMessengerConversations | chatSocket: createChatSocket | chatService: updateCallLog
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Integrates realtime events through socket connections.
- **Code snippet:**

```tsx
export const TeamChatScreen = () => {
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeTab, setActiveTab] = useState<"CHATS" | "CONTACTS">("CHATS");
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callType: "VOICE" | "VIDEO";
    conversationId: string;
    callerId: string;
    callerName: string;
    callerRole: string;
    callerAvatar: string;
  } | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
```

### ExecutiveDashboardScreen
- **Path:** `mobile/src/modules/executive/ExecutiveDashboardScreen.tsx`
- **Type:** Screen
- **Exports:** ExecutiveDashboardScreen
- **Key functions:** formatCurrency, formatDate, getLeadPendingPaymentRows, pushUnique, ExecutiveDashboardScreen, load, openLeads, StatCard
- **Hook usage:** useState=2, useEffect=1, useMemo=2, useCallback=0
- **Service dependencies:** leadService: getAllLeads
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Calls feature APIs/services: leadService: getAllLeads.
- **Code snippet:**

```tsx
export const ExecutiveDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const rows = await getAllLeads();
        setLeads(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load executive dashboard"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
```

### FieldDashboardScreen
- **Path:** `mobile/src/modules/field/FieldDashboardScreen.tsx`
- **Type:** Screen
- **Exports:** FieldDashboardScreen
- **Key functions:** FieldDashboardScreen, load, completeTask, StatCard, QuickAction
- **Hook usage:** useState=3, useEffect=1, useMemo=3, useCallback=0
- **Service dependencies:** api: api
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```tsx
export const FieldDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inventoryCount, setInventoryCount] = useState(0);
  const [inventoryRows, setInventoryRows] = useState<any[]>([]);
  const [tasks, setTasks] = useState<FieldTask[]>(DEFAULT_TASKS);
  const [activeBlock, setActiveBlock] = useState<"PENDING" | "COMPLETED" | "INVENTORY" | "NAVIGATION" | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/inventory");
        const rows = res.data?.assets || [];
        setInventoryCount(Array.isArray(rows) ? rows.length : 0);
        setInventoryRows(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load field data"));
      } finally {
        setLoading(false);
      }
    };
```

### FieldOpsScreen
- **Path:** `mobile/src/modules/field/FieldOpsScreen.tsx`
- **Type:** Screen
- **Exports:** FieldOpsScreen
- **Key functions:** toFinite, hasValidCoords, formatDate, getInventoryTitle, getExecutiveFromLead, getLeadStatusLabel, getStatusStyle, mergeUsersWithLocations, buildMapHtml, postNative, WebMapCanvas, handler
- **Hook usage:** useState=9, useEffect=5, useMemo=10, useCallback=0
- **Service dependencies:** leadService: getAllLeads | inventoryService: getInventoryAssets | userService: getFieldExecutiveLocations, getUsers
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```tsx
export const FieldOpsScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<FieldExecutive[]>([]);
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [selectedExecutiveId, setSelectedExecutiveId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [propertyDetailVisible, setPropertyDetailVisible] = useState(false);
  const [activeLeadsVisible, setActiveLeadsVisible] = useState(false);
  const [siteVisitsVisible, setSiteVisitsVisible] = useState(false);
  const [allPropertiesVisible, setAllPropertiesVisible] = useState(false);
  const [leadQueueFilter, setLeadQueueFilter] = useState<"ALL" | "VISIT" | "OVERDUE">("ALL");

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      setError("");
      const [leadRows, userPayload, locationRows, inventoryRows] = await Promise.all([
        getAllLeads(),
        getUsers(),
        getFieldExecutiveLocations({ staleMinutes: LOCATION_STALE_MINUTES }).catch(() => []),
```

### FinancialCoreScreen
- **Path:** `mobile/src/modules/finance/FinancialCoreScreen.tsx`
- **Type:** Screen
- **Exports:** FinancialCoreScreen
- **Key functions:** toDate, getRangeStart, formatCurrency, formatDateTime, getAssigneeName, pushUnique, pad2, toDateInputValue, WebDateInput, FinancialCoreScreen, load, openMonthPicker
- **Hook usage:** useState=12, useEffect=1, useMemo=6, useCallback=0
- **Service dependencies:** leadService: getAllLeads
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Calls feature APIs/services: leadService: getAllLeads.
- **Code snippet:**

```tsx
export const FinancialCoreScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("ALL");
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCustomFromPicker, setShowCustomFromPicker] = useState(false);
  const [showCustomToPicker, setShowCustomToPicker] = useState(false);
  const [webMonthPickerVisible, setWebMonthPickerVisible] = useState(false);
  const [webMonthDateValue, setWebMonthDateValue] = useState(toDateInputValue(new Date()));
  const [webCustomPickerVisible, setWebCustomPickerVisible] = useState(false);
  const [webCustomFromValue, setWebCustomFromValue] = useState("");
  const [webCustomToValue, setWebCustomToValue] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
```

### AssetVaultScreen
- **Path:** `mobile/src/modules/inventory/AssetVaultScreen.tsx`
- **Type:** Screen
- **Exports:** AssetVaultScreen
- **Key functions:** resolveFileUrl, buildDefaultImageSet, AssetVaultScreen, pickImages, pickFiles, removePickedImage, removePickedFile, toggleAmenity, resetForm, resetPendingStatusChange, createAsset, applyStatusChange
- **Hook usage:** useState=10, useEffect=3, useMemo=1, useCallback=1
- **Service dependencies:** inventoryService: approveInventoryRequest, createInventoryAsset, deleteInventoryAsset, getInventoryAssets, getPendingInventoryRequests, rejectInventoryRequest, requestInventoryStatusChange, updateInventoryAsset | chatService: uploadChatFile
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```tsx
export const AssetVaultScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { role } = useAuth();
  const canManage = role === "ADMIN";
  const canRequestStatusChange = role === "FIELD_EXECUTIVE";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [requests, setRequests] = useState<
    Array<{
      _id: string;
      inventoryId?: { title?: string };
      proposedData?: { status?: string; reservationReason?: string };
    }>
  >([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
```

### InventoryDetailsScreen
- **Path:** `mobile/src/modules/inventory/InventoryDetailsScreen.tsx`
- **Type:** Screen
- **Exports:** InventoryDetailsScreen
- **Key functions:** buildDefaultImageSet, resolveFileUrl, formatActionLabel, InventoryDetailsScreen, loadDetails, applyStatusUpdate, closeReasonModal, updateStatus, submitPendingStatus, openFile
- **Hook usage:** useState=8, useEffect=3, useMemo=1, useCallback=0
- **Service dependencies:** inventoryService: getInventoryAssetActivity, getInventoryAssetById, updateInventoryAsset
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Applies role-aware access or action gating.
  - Calls feature APIs/services: inventoryService: getInventoryAssetActivity, getInventoryAssetById, updateInventoryAsset.
- **Code snippet:**

```tsx
export const InventoryDetailsScreen = () => {
  const route = useRoute<any>();
  const assetId = String(route.params?.assetId || "");
  const { role } = useAuth();
  const canManage = role === "ADMIN";
  const { width: windowWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [asset, setAsset] = useState<InventoryAsset | null>(null);
  const [activities, setActivities] = useState<InventoryActivity[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [reservationReasonDraft, setReservationReasonDraft] = useState("");
  const viewerListRef = useRef<FlatList<string>>(null);

  const galleryImages = useMemo(
    () => (asset?.images?.length ? asset.images : asset ? buildDefaultImageSet(asset.title || asset._id) : []),
    [asset],
  );
```

### LeadDetailsScreen
- **Path:** `mobile/src/modules/leads/LeadDetailsScreen.tsx`
- **Type:** Screen
- **Exports:** LeadDetailsScreen
- **Key functions:** pad, toDigits, toLocalTenDigitPhone, toWhatsAppPhone, formatFollowUpInput, parseFollowUpInput, pickUriString, LeadDetailsScreen, saveUpdate, openDialer, openWhatsApp, openMail
- **Hook usage:** useState=22, useEffect=4, useMemo=9, useCallback=2
- **Service dependencies:** leadService: addLeadDiaryEntry, assignLead, approveLeadStatusRequest, getAllLeads, getLeadActivity, getLeadDiary, getPendingLeadStatusRequests, rejectLeadStatusRequest, requestLeadStatusChange, updateLeadDiaryEntry, updateLeadStatus, type LeadDiaryEntry, type LeadStatusRequest | chatService: uploadChatFile | userService: getUsers
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Provides document generation or export workflow.
- **Code snippet:**

```tsx
export const LeadDetailsScreen = () => {
  const route = useRoute<any>();
  const leadId = String(route.params?.leadId || "");
  const { role, user } = useAuth();
  const canManage = ["ADMIN", "MANAGER", "ASSISTANT_MANAGER", "TEAM_LEADER"].includes(String(role || ""));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Array<{ _id: string; action: string; createdAt: string; performedBy?: { name?: string } }>>([]);
  const [diaryEntries, setDiaryEntries] = useState<LeadDiaryEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<LeadStatusRequest[]>([]);
  const [saleLeadOptions, setSaleLeadOptions] = useState<Array<{ _id: string; name: string; phone?: string }>>([]);
  const [executives, setExecutives] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);

  const [statusDraft, setStatusDraft] = useState("NEW");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [assignDraft, setAssignDraft] = useState("");
  const [statusRequestOpen, setStatusRequestOpen] = useState(false);
  const [statusRequestReason, setStatusRequestReason] = useState("");
  const [statusRequestAttachment, setStatusRequestAttachment] = useState<{
```

### LeadsMatrixScreen
- **Path:** `mobile/src/modules/leads/LeadsMatrixScreen.tsx`
- **Type:** Screen
- **Exports:** LeadsMatrixScreen
- **Key functions:** toInputDateTime, resolveAssignedTo, toDigits, toLocalTenDigitPhone, toWhatsAppPhone, formatCurrency, escapeHtml, buildInventoryLabel, resolveMediaUrl, getPendingPaymentRows, pushUnique, LeadsMatrixScreen
- **Hook usage:** useState=23, useEffect=3, useMemo=5, useCallback=1
- **Service dependencies:** leadService: assignLead, createLead, getAllLeads, getLeadActivity, updateLeadStatus | inventoryService: getInventoryAssets | userService: getUsers
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Uses memoized callbacks for stable handler references.
  - Implements route or stack navigation flows.
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```tsx
export const LeadsMatrixScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const canManage = role === "ADMIN" || role === "MANAGER";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<Array<{ _id?: string; name: string; role?: string; isActive?: boolean }>>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
```

### ManagerDashboardScreen
- **Path:** `mobile/src/modules/manager/ManagerDashboardScreen.tsx`
- **Type:** Screen
- **Exports:** ManagerDashboardScreen
- **Key functions:** formatCurrency, toPercent, ManagerDashboardScreen, load, openLeads, openClosedDealsFromRevenue, openInventory, HeroChip, MetricCard
- **Hook usage:** useState=2, useEffect=1, useMemo=2, useCallback=0
- **Service dependencies:** leadService: getAllLeads | inventoryService: getInventoryAssets
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Calls feature APIs/services: leadService: getAllLeads | inventoryService: getInventoryAssets.
- **Code snippet:**

```tsx
export const ManagerDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assets, setAssets] = useState<InventoryAsset[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [leadRows, inventoryRows] = await Promise.all([getAllLeads(), getInventoryAssets()]);
        setLeads(Array.isArray(leadRows) ? leadRows : []);
        setAssets(Array.isArray(inventoryRows) ? inventoryRows : []);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load manager dashboard"));
      } finally {
        setLoading(false);
      }
    };

    load();
```

### MoreMenuScreen
- **Path:** `mobile/src/modules/more/MoreMenuScreen.tsx`
- **Type:** Screen
- **Exports:** MoreMenuScreen
- **Key functions:** Row, MoreMenuScreen, open
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Implements route or stack navigation flows.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Applies role-aware access or action gating.
  - Composes local modules/components: ../../components/common/Screen, ../../components/common/ui, ../../context/AuthContext.
- **Code snippet:**

```tsx
export const MoreMenuScreen = ({ navigation }: any) => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";
  const isManagement = role === "ADMIN" || role === "MANAGER" || role === "ASSISTANT_MANAGER" || role === "TEAM_LEADER";
  const open = (screen: string) => {
    const parent = navigation?.getParent?.();
    if (parent?.navigate) {
      parent.navigate(screen);
      return;
    }
    navigation.navigate(screen);
  };

  return (
    <Screen title="More" subtitle="Quick Access">
      <AppCard style={styles.card as object}>
        <Row label="Samvid Bot" onPress={() => open("Samvid Bot")} />
        {isManagement ? <Row label="Notifications" onPress={() => open("Notifications")} /> : null}
        <Row label="Profile" onPress={() => open("Profile")} />
        {isManagement ? <Row label="Users" onPress={() => open("Users")} /> : null}
        {isManagement ? <Row label="Settings" onPress={() => open("Settings")} /> : null}
        {isAdmin ? <Row label="Field Ops" onPress={() => open("Field Ops")} /> : null}
      </AppCard>
    </Screen>
```

### NotificationsScreen
- **Path:** `mobile/src/modules/notifications/NotificationsScreen.tsx`
- **Type:** Screen
- **Exports:** NotificationsScreen
- **Key functions:** asDate, formatDate, NotificationsScreen, load, doApprove, doReject
- **Hook usage:** useState=6, useEffect=2, useMemo=0, useCallback=0
- **Service dependencies:** leadService: approveLeadStatusRequest, getPendingLeadStatusRequests, rejectLeadStatusRequest, type LeadStatusRequest | inventoryService: approveInventoryRequest, getPendingInventoryRequests, rejectInventoryRequest
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Applies role-aware access or action gating.
  - Calls feature APIs/services: leadService: approveLeadStatusRequest, getPendingLeadStatusRequests, rejectLeadStatusRequest, type LeadStatusRequest | inventoryService: approveInventoryRequest, getPendingInventoryRequests, rejectInventoryRequest.
  - Composes local modules/components: ../../components/common/Screen, ../../components/common/ui, ../../context/AuthContext, ../../utils/errorMessage.
- **Code snippet:**

```tsx
export const NotificationsScreen = () => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");

  const [leadRequests, setLeadRequests] = useState<LeadStatusRequest[]>([]);
  const [inventoryRequests, setInventoryRequests] = useState<InventoryRequest[]>([]);

  const [previewItem, setPreviewItem] = useState<NotificationItem | null>(null);
  const [rejectItem, setRejectItem] = useState<NotificationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      const [leadRows, inventoryRows] = await Promise.all([
```

### ProfileScreen
- **Path:** `mobile/src/modules/profile/ProfileScreen.tsx`
- **Type:** Screen
- **Exports:** ProfileScreen
- **Key functions:** formatDateTime, prettifyLabel, initials, ProfileScreen, load, saveProfile, uploadProfilePhoto, deleteProfilePhoto
- **Hook usage:** useState=9, useEffect=2, useMemo=1, useCallback=0
- **Service dependencies:** chatService: uploadChatFile | userService: getMyProfile, updateMyProfile
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains modal/overlay or multi-panel interaction patterns.
  - Calls feature APIs/services: chatService: uploadChatFile | userService: getMyProfile, updateMyProfile.
  - Composes local modules/components: ../../components/common/Screen, ../../components/common/ui, ../../context/AuthContext, ../../utils/errorMessage.
- **Code snippet:**

```tsx
export const ProfileScreen = () => {
  const { updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState<any>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const load = async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const data = await getMyProfile();
      const row = data.profile || {};
      setProfile(row);
```

### IntelligenceReportsScreen
- **Path:** `mobile/src/modules/reports/IntelligenceReportsScreen.tsx`
- **Type:** Screen
- **Exports:** IntelligenceReportsScreen
- **Key functions:** toDate, pad2, toDateInputValue, WebDateInput, IntelligenceReportsScreen, load, shareReport, openMonthPicker, openCustomRangePicker, applyWebMonthPicker, applyWebCustomRange
- **Hook usage:** useState=12, useEffect=1, useMemo=5, useCallback=0
- **Service dependencies:** leadService: getAllLeads | inventoryService: getInventoryAssets
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Implements route or stack navigation flows.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
- **Code snippet:**

```tsx
export const IntelligenceReportsScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState<RangeKey>("ALL");
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCustomFromPicker, setShowCustomFromPicker] = useState(false);
  const [showCustomToPicker, setShowCustomToPicker] = useState(false);
  const [webMonthPickerVisible, setWebMonthPickerVisible] = useState(false);
  const [webMonthDateValue, setWebMonthDateValue] = useState(toDateInputValue(new Date()));
  const [webCustomPickerVisible, setWebCustomPickerVisible] = useState(false);
  const [webCustomFromValue, setWebCustomFromValue] = useState("");
  const [webCustomToValue, setWebCustomToValue] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [assets, setAssets] = useState<Array<{ _id: string; status?: string; location?: string; price?: number; createdAt?: string }>>([]);

  const load = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
```

### PerformanceScreen
- **Path:** `mobile/src/modules/reports/PerformanceScreen.tsx`
- **Type:** Screen
- **Exports:** PerformanceScreen
- **Key functions:** formatNumber, formatCurrency, clampPercent, pad2, toDateInputValue, getMonthKeyFromDate, getLeadDate, parseDate, getLeadPendingPaymentRows, pushUnique, toWeekBuckets, findBucketIndex
- **Hook usage:** useState=19, useEffect=3, useMemo=13, useCallback=0
- **Service dependencies:** api: api | userService: getUsers | targetService: assignHierarchyTarget, getMyTargets
- **Functional highlights:**
  - Maintains local component state for UI and interactions.
  - Runs lifecycle side effects for data load or runtime synchronization.
  - Uses memoized selectors/derived state for rendering efficiency.
  - Contains location-aware behavior (coordinates/maps/geolocation).
  - Contains modal/overlay or multi-panel interaction patterns.
  - Applies role-aware access or action gating.
- **Code snippet:**

```tsx
export const PerformanceScreen = () => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [range, setRange] = useState<"ALL" | "THIS_MONTH" | "CUSTOM">("ALL");
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCustomFromPicker, setShowCustomFromPicker] = useState(false);
  const [showCustomToPicker, setShowCustomToPicker] = useState(false);
  const [webMonthPickerVisible, setWebMonthPickerVisible] = useState(false);
  const [webMonthDateValue, setWebMonthDateValue] = useState(toDateInputValue(new Date()));
  const [webCustomPickerVisible, setWebCustomPickerVisible] = useState(false);
  const [webCustomFromValue, setWebCustomFromValue] = useState("");
  const [webCustomToValue, setWebCustomToValue] = useState("");
  const [assigneeDropdownVisible, setAssigneeDropdownVisible] = useState(false);
  const [leaderboardDetailsVisible, setLeaderboardDetailsVisible] = useState(false);
```


## Shared Components

### Screen
- **Path:** `mobile/src/components/common/Screen.tsx`
- **Type:** Component
- **Exports:** Screen
- **Key functions:** Screen
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Composes local modules/components: ../../theme/tokens.
- **Code snippet:**

```tsx
export const Screen = ({ title, subtitle, loading, error, children }: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  children?: React.ReactNode;
}) => (
  <SafeAreaView style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>

    {error ? <Text style={styles.error}>{error}</Text> : null}

    {loading ? (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    ) : (
      <View style={styles.body}>{children}</View>
    )}
  </SafeAreaView>
);
```

### ui
- **Path:** `mobile/src/components/common/ui.tsx`
- **Type:** Component
- **Exports:** AppCard, AppButton, AppChip, AppInput
- **Key functions:** AppCard, AppButton, AppChip, AppInput
- **Hook usage:** useState=0, useEffect=0, useMemo=0, useCallback=0
- **Service dependencies:** None
- **Functional highlights:**
  - Contains modal/overlay or multi-panel interaction patterns.
  - Composes local modules/components: ../../theme/tokens.
- **Code snippet:**

```tsx
export const AppCard = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const AppButton = ({
  title,
  onPress,
  disabled,
  variant = "primary",
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  style?: object;
}) => (
  <Pressable
    disabled={disabled}
    style={[
      styles.button,
      variant === "primary" ? styles.buttonPrimary : styles.buttonGhost,
      disabled && styles.buttonDisabled,
      style,
```

