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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/common/Screen";
import { getMessengerContacts, getMessengerConversations } from "../../services/chatService";
import { createChatSocket } from "../../services/chatSocket";
import { useAuth } from "../../context/AuthContext";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { updateCallLog } from "../../services/chatService";
import type { ChatContact, ChatConversation } from "../../types";

const initials = (name: string) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

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
    } catch (e) {
      setError(toErrorMessage(e, "Failed to load messenger"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    navigation.navigate("ChatConversation", {
      conversationId,
      contactId,
      contactName,
      contactRole,
      contactAvatar,
    });
  };

  const renderAvatar = (person: { name?: string; avatarUrl?: string }, size = 28) => {
    if (person?.avatarUrl) {
      return (
        <Image
          source={{ uri: person.avatarUrl }}
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

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((conversation) => {
      const peer = conversation.participants.find(
        (participant) => String(participant._id) !== String(user?._id || user?.id || ""),
      );
      const name = peer?.name || "";
      return (
        name.toLowerCase().includes(q)
        || String(conversation.lastMessage || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, search, user]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) => contact.name.toLowerCase().includes(q));
  }, [contacts, search]);

  return (
    <Screen title="Team Chat" subtitle="Realtime Messenger" loading={loading} error={error}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.pageContent}
      >
        <View style={styles.quickTop}>
          <Pressable style={styles.quickBtn} onPress={() => setProfileVisible(true)}>
            {renderAvatar({ name: user?.name || "Me", avatarUrl: user?.profileImageUrl || "" }, 24)}
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => load(true)}>
            <Ionicons name="refresh" size={15} color="#64748b" />
          </Pressable>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchHead}>
            <Text style={styles.searchTitle}>Chats</Text>
            <Text style={styles.searchMeta}>{conversations.length} conversations</Text>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={14} color="#94a3b8" />
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

          <Text style={[styles.connection, connected ? styles.connectionOn : styles.connectionOff]}>
            {connected ? "Realtime connected" : "Realtime reconnecting"}
          </Text>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.panelLabel}>{activeTab === "CHATS" ? "Conversations" : "Contacts"}</Text>
          {activeTab === "CHATS" && filteredConversations.length === 0 ? <Text style={styles.empty}>No conversations</Text> : null}
          {activeTab === "CHATS" ? filteredConversations.map((item) => {
            const peer = item.participants.find(
              (participant) => String(participant._id) !== String(user?._id || user?.id || ""),
            );
            if (!peer) return null;

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
                  <Text style={styles.userSub} numberOfLines={1}>
                    {item.lastMessage || "No messages yet"}
                  </Text>
                </View>
                <Text style={styles.rowTime}>
                  {formatDateTime(item.lastMessageAt || item.updatedAt)}
                </Text>
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

const styles = StyleSheet.create({
  quickTop: {
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
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
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  profileSubtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  profileActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  smallBtnText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  smallBtnDanger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f2",
  },
  smallBtnDangerText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  smallBtnDisabled: {
    opacity: 0.6,
  },
  searchCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
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
    color: "#0f172a",
    fontWeight: "700",
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  searchMeta: {
    color: "#64748b",
    fontSize: 11,
  },
  searchRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    fontSize: 12,
  },
  tabRow: {
    marginTop: 10,
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#0f172a",
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
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  connectionOff: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  listCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 10,
  },
  panelLabel: {
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "700",
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
    gap: 8,
    backgroundColor: "#fff",
  },
  avatar: {
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "700",
  },
  userBody: {
    flex: 1,
  },
  userName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 13,
  },
  userSub: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  roleBadge: {
    marginTop: 3,
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  rowTime: {
    color: "#94a3b8",
    fontSize: 10,
    marginLeft: 6,
  },
  empty: {
    textAlign: "center",
    color: "#94a3b8",
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
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  callTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
  callPeer: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "600",
  },
  callSub: {
    color: "#64748b",
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
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  callAccept: {
    borderColor: "#86efac",
    backgroundColor: "#dcfce7",
  },
  callRejectText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 13,
  },
  callAcceptText: {
    color: "#166534",
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
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  profileModalTitle: {
    color: "#0f172a",
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
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  profileVal: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  profileHint: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 11,
  },
  profileCloseBtn: {
    marginTop: 8,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCloseText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 13,
  },
});
