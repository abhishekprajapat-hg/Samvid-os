import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../../components/ui/Icon";
import { Screen } from "../../components/common/Screen";
import { getMessengerContacts, getMessengerConversations, markConversationRead } from "../../services/chatService";
import { createChatSocket } from "../../services/chatSocket";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { updateCallLog } from "../../services/chatService";
import type { ChatContact, ChatConversation } from "../../types";
import { themedStyles, themeColor } from "../../theme/themedStyles";
import { toAbsoluteUrl } from "../../services/uploadService";

const initials = (name: string) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

export const TeamChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  /*
   * A property handed over from inventory ("Share to chat"). Web opens its chat
   * with the card queued and waits for a conversation to be picked; this list
   * does the same, and the conversation opened next receives it.
   */
  const [pendingShare, setPendingShare] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const share = route.params?.shareProperty;
    if (share && typeof share === "object" && share.inventoryId) {
      setPendingShare(share);
      navigation.setParams({ shareProperty: undefined });
    }
  }, [navigation, route.params?.shareProperty]);
  const { token, user } = useAuth();
  const {
    chatUnreadByConversation,
    markAllChatRead,
    markChatConversationRead,
    syncChatUnreadFromConversations,
  } = useRealtimeAlerts();
  /* Web's "All Chats" / "Unread" switch over the conversation list. */
  const [chatFilter, setChatFilter] = useState<"all" | "unread">("all");
  const [markingAllRead, setMarkingAllRead] = useState(false);
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
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");
      const [nextContacts, nextConversations] = await Promise.all([
        getMessengerContacts(),
        getMessengerConversations(),
      ]);

      const sortedConversations = [...nextConversations].sort(
        (a, b) =>
          new Date(b.lastMessageAt || b.updatedAt || 0).getTime()
          - new Date(a.lastMessageAt || a.updatedAt || 0).getTime(),
      );

      setContacts(nextContacts);
      setConversations(sortedConversations);
      syncChatUnreadFromConversations(sortedConversations);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load messenger"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [syncChatUnreadFromConversations]);

  useEffect(() => {
    markAllChatRead();
  }, [markAllChatRead]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const socket = createChatSocket(token);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("messenger:message:new", ({ conversation }: { conversation?: ChatConversation }) => {
      if (!conversation?._id) return;
      setConversations((prev) => {
        const map = new Map(prev.map((row) => [String(row._id), row]));
        map.set(String(conversation._id), conversation);
        return [...map.values()].sort(
          (a, b) =>
            new Date(b.lastMessageAt || b.updatedAt || 0).getTime()
            - new Date(a.lastMessageAt || a.updatedAt || 0).getTime(),
        );
      });
    });
    const handleIncomingCall = (payload: any) => {
      const caller = payload?.caller || payload?.from || {};
      setIncomingCall({
        callId: String(payload?.callId || ""),
        callType: String(payload?.callType || payload?.mode || "VOICE").toUpperCase() === "VIDEO" ? "VIDEO" : "VOICE",
        conversationId: String(payload?.conversationId || payload?.roomId || ""),
        callerId: String(caller?._id || ""),
        callerName: String(caller?.name || "Unknown"),
        callerRole: String(caller?.role || ""),
        callerAvatar: String(caller?.avatarUrl || caller?.profileImageUrl || ""),
      });
    };

    socket.on("messenger:call:incoming", handleIncomingCall);
    socket.on("chat:call:incoming", handleIncomingCall);

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [token]);

  const acceptIncomingCall = async () => {
    if (!incomingCall?.callId) return;

    try {
      await updateCallLog({ callId: incomingCall.callId, status: "ACCEPTED" });
    } catch {
      // proceed with navigation even if log update fails
    }

    navigation.navigate("CallScreen", {
      callId: incomingCall.callId,
      callType: incomingCall.callType,
      peerId: incomingCall.callerId,
      peerName: incomingCall.callerName,
      conversationId: incomingCall.conversationId || "",
      incoming: true,
    });
    setIncomingCall(null);
  };

  const rejectIncomingCall = async () => {
    if (!incomingCall?.callId) {
      setIncomingCall(null);
      return;
    }
    try {
      await updateCallLog({ callId: incomingCall.callId, status: "REJECTED", durationSec: 0 });
    } catch {
      // ignore
    } finally {
      setIncomingCall(null);
    }
  };

  const openConversation = ({
    conversationId = "",
    contactId,
    contactName,
    contactRole = "",
    contactAvatar = "",
  }: {
    conversationId?: string;
    contactId: string;
    contactName: string;
    contactRole?: string;
    contactAvatar?: string;
  }) => {
    if (conversationId) {
      markChatConversationRead(conversationId);
    }
    navigation.navigate("ChatConversation", {
      conversationId,
      contactId,
      contactName,
      contactRole,
      contactAvatar,
      ...(pendingShare ? { shareProperty: pendingShare } : {}),
    });
    if (pendingShare) setPendingShare(null);
  };

  const renderAvatar = (person: { name?: string; avatarUrl?: string }, size = 28) => {
    if (person?.avatarUrl) {
      return (
        <Image
          source={{ uri: toAbsoluteUrl(String(person.avatarUrl)) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }

    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.avatarText}>{initials(person?.name || "")}</Text>
      </View>
    );
  };

  const unreadCountOf = useCallback(
    (conversationId: string) => Math.max(0, Number(chatUnreadByConversation[String(conversationId)] || 0)),
    [chatUnreadByConversation],
  );
  const unreadTotal = useMemo(
    () => conversations.reduce((sum, row) => sum + unreadCountOf(row._id), 0),
    [conversations, unreadCountOf],
  );

  /*
   * Web's "Mark all read": every conversation with unread messages is marked
   * read on the server, so the senders see them as seen and the counts stay
   * cleared on the next load. Web also does this whenever its chat page opens;
   * the phone waits for the tap, so the badges below mean something.
   */
  const markEveryConversationRead = async () => {
    const ids = conversations.map((row) => String(row._id)).filter((id) => unreadCountOf(id) > 0);
    if (!ids.length || markingAllRead) return;
    setMarkingAllRead(true);
    try {
      markAllChatRead();
      await Promise.all(ids.map((id) => markConversationRead(id).catch(() => null)));
      setConversations((prev) => prev.map((row) => (ids.includes(String(row._id)) ? { ...row, unreadCount: 0 } : row)));
    } finally {
      setMarkingAllRead(false);
    }
  };

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scoped = chatFilter === "unread"
      ? conversations.filter((conversation) => unreadCountOf(conversation._id) > 0)
      : conversations;
    if (!q) return scoped;
    return scoped.filter((conversation) => {
      const peer = conversation.participants.find(
        (participant) => String(participant._id) !== String(user?._id || user?.id || ""),
      );
      const name = peer?.name || "";
      return (
        name.toLowerCase().includes(q)
        || String(conversation.lastMessage || "").toLowerCase().includes(q)
      );
    });
  }, [chatFilter, conversations, search, unreadCountOf, user]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) => contact.name.toLowerCase().includes(q));
  }, [contacts, search]);

  const goBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs");
  };

  return (
    <Screen title="Team Chat" subtitle="Realtime Messenger" loading={loading} error={error}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.pageContent}
      >
        <View style={styles.quickTop}>
          <Pressable style={styles.quickBtn} onPress={goBack}>
            <Icon name="arrow-back" size={16} color={themeColor("#39424f")} />
          </Pressable>
          <View style={styles.quickTopRight}>
            <Pressable style={styles.quickBtn} onPress={() => load(true)}>
              <Icon name="refresh" size={15} color={themeColor("#6c7789")} />
            </Pressable>
            <Pressable style={styles.quickBtn} onPress={() => setProfileVisible(true)}>
              {renderAvatar({ name: user?.name || "Me", avatarUrl: user?.profileImageUrl || "" }, 24)}
            </Pressable>
          </View>
        </View>

        {pendingShare ? (
          <View style={styles.shareBanner}>
            <Icon name="share-social-outline" size={16} color={themeColor("#0a6544")} />
            <Text style={styles.shareBannerText} numberOfLines={2}>
              Pick a chat to share {String(pendingShare.title || "this property")}
            </Text>
            <Pressable onPress={() => setPendingShare(null)} hitSlop={8} accessibilityLabel="Cancel sharing">
              <Icon name="close" size={16} color={themeColor("#0a6544")} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.searchCard}>
          <View style={styles.searchHead}>
            <Text style={styles.searchTitle}>Chats</Text>
            <Text style={styles.searchMeta}>{conversations.length} conversations</Text>
          </View>

          <View style={styles.searchRow}>
            <Icon name="search" size={14} color={themeColor("#98a3b5")} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search chats or contacts"
            />
          </View>
          <View style={styles.tabRow}>
            <Pressable style={[styles.tabBtn, activeTab === "CHATS" && styles.tabBtnActive]} onPress={() => setActiveTab("CHATS")}>
              <Text style={[styles.tabText, activeTab === "CHATS" && styles.tabTextActive]}>Chats</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === "CONTACTS" && styles.tabBtnActive]} onPress={() => setActiveTab("CONTACTS")}>
              <Text style={[styles.tabText, activeTab === "CONTACTS" && styles.tabTextActive]}>Contacts</Text>
            </Pressable>
          </View>

          {activeTab === "CHATS" ? (
            <View style={styles.filterRow}>
              <View style={[styles.tabRow, styles.filterTabs]}>
                <Pressable
                  style={[styles.tabBtn, chatFilter === "all" && styles.tabBtnActive]}
                  onPress={() => setChatFilter("all")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chatFilter === "all" }}
                >
                  <Text style={[styles.tabText, chatFilter === "all" && styles.tabTextActive]}>All Chats</Text>
                </Pressable>
                <Pressable
                  style={[styles.tabBtn, chatFilter === "unread" && styles.tabBtnActive]}
                  onPress={() => setChatFilter("unread")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chatFilter === "unread" }}
                >
                  <Text style={[styles.tabText, chatFilter === "unread" && styles.tabTextActive]}>
                    Unread{unreadTotal > 0 ? ` (${unreadTotal > 99 ? "99+" : unreadTotal})` : ""}
                  </Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.markAllBtn, (!unreadTotal || markingAllRead) && styles.smallBtnDisabled]}
                onPress={markEveryConversationRead}
                disabled={!unreadTotal || markingAllRead}
                accessibilityRole="button"
                accessibilityLabel="Mark all read"
              >
                <Icon name="checkmark-done" size={14} color={themeColor("#0a6544")} />
                <Text style={styles.markAllText}>{markingAllRead ? "Marking…" : "Mark all read"}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={[styles.connection, connected ? styles.connectionOn : styles.connectionOff]}>
            {connected ? "Realtime connected" : "Realtime reconnecting"}
          </Text>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.panelLabel}>{activeTab === "CHATS" ? "Conversations" : "Contacts"}</Text>
          {activeTab === "CHATS" && filteredConversations.length === 0 ? (
            <Text style={styles.empty}>{chatFilter === "unread" ? "No unread conversations" : "No conversations"}</Text>
          ) : null}
          {activeTab === "CHATS" ? filteredConversations.map((item) => {
            const peer = item.participants.find(
              (participant) => String(participant._id) !== String(user?._id || user?.id || ""),
            );
            if (!peer) return null;
            const unread = unreadCountOf(item._id);

            return (
              <Pressable
                key={item._id}
                style={styles.userRow}
                onPress={() =>
                  openConversation({
                    conversationId: item._id,
                    contactId: peer._id,
                    contactName: peer.name,
                    contactRole: peer.role,
                    contactAvatar: peer.avatarUrl || "",
                  })}
              >
                {renderAvatar({ name: peer.name, avatarUrl: peer.avatarUrl || "" })}
                <View style={styles.userBody}>
                  <Text style={styles.userName}>{peer.name}</Text>
                  <Text style={[styles.userSub, unread > 0 && styles.userSubUnread]} numberOfLines={1}>
                    {item.lastMessage || "No messages yet"}
                  </Text>
                </View>
                <View style={styles.rowEnd}>
                  <Text style={styles.rowTime}>
                    {formatDateTime(item.lastMessageAt || item.updatedAt)}
                  </Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge} accessibilityLabel={`${unread} unread`}>
                      <Text style={styles.unreadBadgeText}>{unread > 99 ? "99+" : unread}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }) : null}
          {activeTab === "CONTACTS" && filteredContacts.length === 0 ? <Text style={styles.empty}>No contacts</Text> : null}
          {activeTab === "CONTACTS" ? filteredContacts.map((item) => (
            <Pressable
              key={item._id}
              style={styles.userRow}
              onPress={() =>
                openConversation({
                  contactId: item._id,
                  contactName: item.name,
                  contactRole: item.role,
                  contactAvatar: item.avatarUrl || "",
                })}
            >
              {renderAvatar({ name: item.name, avatarUrl: item.avatarUrl || "" })}
              <View style={styles.userBody}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.roleBadge}>{item.role}</Text>
              </View>
            </Pressable>
          )) : null}
        </View>
      </ScrollView>

      {incomingCall ? (
        <View style={styles.callOverlay}>
          <View style={styles.callCard}>
            <Text style={styles.callTitle}>Incoming {incomingCall.callType === "VIDEO" ? "Video" : "Voice"} Call</Text>
            <Text style={styles.callPeer}>{incomingCall.callerName}</Text>
            <Text style={styles.callSub}>E2EE enabled</Text>
            <View style={styles.callActions}>
              <Pressable style={[styles.callBtn, styles.callReject]} onPress={rejectIncomingCall}>
                <Text style={styles.callRejectText}>Reject</Text>
              </Pressable>
              <Pressable style={[styles.callBtn, styles.callAccept]} onPress={acceptIncomingCall}>
                <Text style={styles.callAcceptText}>Accept</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <Modal visible={profileVisible} transparent animationType="fade" onRequestClose={() => setProfileVisible(false)}>
        <View style={styles.profileOverlay}>
          <View style={styles.profileModal}>
            <Text style={styles.profileModalTitle}>My Profile</Text>
            <View style={styles.profileRow}>
              <Text style={styles.profileKey}>Name</Text>
              <Text style={styles.profileVal}>{user?.name || "-"}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileKey}>Email</Text>
              <Text style={styles.profileVal}>{user?.email || "-"}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileKey}>Phone</Text>
              <Text style={styles.profileVal}>{user?.phone || "-"}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileKey}>Role</Text>
              <Text style={styles.profileVal}>{String(user?.role || "-")}</Text>
            </View>
            <Text style={styles.profileHint}>Profile photo actions are available in account settings.</Text>
            <Pressable style={styles.profileCloseBtn} onPress={() => setProfileVisible(false)}>
              <Text style={styles.profileCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = themedStyles((c) => StyleSheet.create({
  shareBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.emerald[200],
    backgroundColor: c.emerald[50],
  },
  shareBannerText: { flex: 1, fontSize: 12, fontWeight: "600", color: c.emerald[800] },
  quickTop: {
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickTopRight: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  quickBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    padding: 10,
    marginBottom: 10,
  },
  pageContent: {
    paddingBottom: 16,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileTitle: {
    color: c.text,
    fontWeight: "700",
    fontSize: 13,
  },
  profileSubtitle: {
    marginTop: 2,
    color: c.textMuted,
    fontSize: 11,
  },
  profileActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  smallBtnText: {
    color: c.slate[700],
    fontSize: 12,
    fontWeight: "600",
  },
  smallBtnDanger: {
    borderWidth: 1,
    borderColor: c.errorBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.errorBg,
  },
  smallBtnDangerText: {
    color: c.rose[700],
    fontSize: 12,
    fontWeight: "700",
  },
  smallBtnDisabled: {
    opacity: 0.6,
  },
  searchCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    padding: 10,
    marginBottom: 10,
  },
  searchHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchTitle: {
    fontSize: 13,
    color: c.text,
    fontWeight: "700",
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  searchMeta: {
    color: c.textMuted,
    fontSize: 11,
  },
  searchRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: 10,
    backgroundColor: c.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontSize: 12,
  },
  tabRow: {
    marginTop: 10,
    flexDirection: "row",
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    padding: 2,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: c.text,
  },
  connection: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "600",
  },
  connectionOn: {
    backgroundColor: c.emerald[100],
    color: c.emerald[800],
  },
  connectionOff: {
    backgroundColor: c.amber[100],
    color: c.amber[800],
  },
  listCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    padding: 10,
    marginBottom: 10,
  },
  panelLabel: {
    fontSize: 11,
    color: c.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
    gap: 8,
    backgroundColor: c.surface,
  },
  avatar: {
    backgroundColor: c.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: c.slate[700],
    fontSize: 10,
    fontWeight: "700",
  },
  userBody: {
    flex: 1,
  },
  userName: {
    color: c.text,
    fontWeight: "700",
    fontSize: 13,
  },
  userSub: {
    marginTop: 2,
    color: c.textMuted,
    fontSize: 11,
  },
  roleBadge: {
    marginTop: 3,
    alignSelf: "flex-start",
    backgroundColor: c.emerald[100],
    color: c.emerald[800],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  rowTime: {
    color: c.textTertiary,
    fontSize: 10,
    marginLeft: 6,
  },
  rowEnd: { alignItems: "flex-end", gap: 4 },
  userSubUnread: { color: c.text, fontWeight: "600" },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.emerald[600],
  },
  unreadBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  filterRow: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  filterTabs: { flex: 1, marginTop: 0 },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.emerald[200],
    backgroundColor: c.emerald[50],
  },
  markAllText: { fontSize: 11, fontWeight: "700", color: c.emerald[800] },
  empty: {
    textAlign: "center",
    color: c.textTertiary,
    fontSize: 12,
    marginVertical: 10,
  },
  callOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  callCard: {
    width: "100%",
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  callTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: "700",
  },
  callPeer: {
    color: c.slate[700],
    fontSize: 15,
    fontWeight: "600",
  },
  callSub: {
    color: c.textMuted,
    fontSize: 12,
  },
  callActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  callBtn: {
    minWidth: 110,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  callReject: {
    borderColor: c.errorBorder,
    backgroundColor: c.errorBg,
  },
  callAccept: {
    borderColor: c.emerald[300],
    backgroundColor: c.emerald[100],
  },
  callRejectText: {
    color: c.rose[700],
    fontWeight: "700",
    fontSize: 13,
  },
  callAcceptText: {
    color: c.emerald[800],
    fontWeight: "700",
    fontSize: 13,
  },
  profileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  profileModal: {
    width: "100%",
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    gap: 10,
  },
  profileModalTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  profileKey: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  profileVal: {
    color: c.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  profileHint: {
    marginTop: 4,
    color: c.textMuted,
    fontSize: 11,
  },
  profileCloseBtn: {
    marginTop: 8,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCloseText: {
    color: c.slate[700],
    fontWeight: "700",
    fontSize: 13,
  },
}));
