import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../../components/common/Screen";
import { getMessengerContacts, getMessengerConversations } from "../../services/chatService";
import { createChatSocket } from "../../services/chatSocket";
import { useAuth } from "../../context/AuthContext";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import { updateCallLog } from "../../services/chatService";
import { deleteMyProfilePicture, uploadMyProfilePicture } from "../../services/userService";
import type { ChatContact, ChatConversation } from "../../types";

const initials = (name: string) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const roleBadgeStyle = (role?: string) => {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "ADMIN") return { backgroundColor: "#ffe4e6", color: "#be123c" };
  if (normalized === "MANAGER") return { backgroundColor: "#cffafe", color: "#0e7490" };
  if (normalized === "ASSISTANT_MANAGER") return { backgroundColor: "#e0f2fe", color: "#0369a1" };
  if (normalized === "TEAM_LEADER") return { backgroundColor: "#e0e7ff", color: "#4338ca" };
  if (normalized === "FIELD_EXECUTIVE") return { backgroundColor: "#f3e8ff", color: "#7e22ce" };
  return { backgroundColor: "#dcfce7", color: "#166534" };
};

export const TeamChatScreen = () => {
  const navigation = useNavigation<any>();
  const { token, user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [updatingProfileImage, setUpdatingProfileImage] = useState(false);
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
    socket.on("messenger:call:incoming", (payload: any) => {
      const caller = payload?.caller || {};
      setIncomingCall({
        callId: String(payload?.callId || ""),
        callType: String(payload?.callType || "VOICE").toUpperCase() === "VIDEO" ? "VIDEO" : "VOICE",
        conversationId: String(payload?.conversationId || ""),
        callerId: String(caller?._id || ""),
        callerName: String(caller?.name || "Unknown"),
        callerRole: String(caller?.role || ""),
        callerAvatar: String(caller?.profileImageUrl || ""),
      });
    });

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

  const handlePickProfileImage = async (fromCamera: boolean) => {
    if (updatingProfileImage) return;

    try {
      setUpdatingProfileImage(true);
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError(fromCamera ? "Camera permission is required" : "Gallery permission is required");
        return;
      }

      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      const nextUser = await uploadMyProfilePicture({
        uri: asset.uri,
        name: asset.fileName || "profile.jpg",
        mimeType: asset.mimeType || "image/jpeg",
      });

      if (nextUser?.profileImageUrl) {
        await updateUser({ profileImageUrl: nextUser.profileImageUrl });
      }
      setError("");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to update profile picture"));
    } finally {
      setUpdatingProfileImage(false);
    }
  };

  const handleDeleteProfileImage = async () => {
    if (updatingProfileImage) return;

    Alert.alert("Delete profile picture", "Remove your current profile picture?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setUpdatingProfileImage(true);
            await deleteMyProfilePicture();
            await updateUser({ profileImageUrl: "" });
            setError("");
          } catch (e) {
            setError(toErrorMessage(e, "Failed to delete profile picture"));
          } finally {
            setUpdatingProfileImage(false);
          }
        },
      },
    ]);
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
        <View style={styles.profileCard}>
          <Pressable style={styles.profileInfo} onPress={() => setProfileVisible(true)}>
            {renderAvatar(
              {
                name: user?.name || "Me",
                avatarUrl: user?.profileImageUrl || "",
              },
              42,
            )}
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileTitle}>Your Profile Picture</Text>
              <Text style={styles.profileSubtitle}>Square ratio like WhatsApp DP</Text>
            </View>
          </Pressable>
          <View style={styles.profileActions}>
            <Pressable
              style={[styles.smallBtn, updatingProfileImage && styles.smallBtnDisabled]}
              onPress={() => handlePickProfileImage(false)}
              disabled={updatingProfileImage}
            >
              <Text style={styles.smallBtnText}>Upload</Text>
            </Pressable>
            <Pressable
              style={[styles.smallBtn, updatingProfileImage && styles.smallBtnDisabled]}
              onPress={() => handlePickProfileImage(true)}
              disabled={updatingProfileImage}
            >
              <Text style={styles.smallBtnText}>Camera</Text>
            </Pressable>
            <Pressable
              style={[styles.smallBtnDanger, updatingProfileImage && styles.smallBtnDisabled]}
              onPress={handleDeleteProfileImage}
              disabled={updatingProfileImage}
            >
              {updatingProfileImage ? (
                <ActivityIndicator size="small" color="#b91c1c" />
              ) : (
                <Text style={styles.smallBtnDangerText}>Delete</Text>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchHead}>
            <Text style={styles.searchTitle}>Chats</Text>
            <Pressable style={styles.iconBtn} onPress={() => load(true)}>
              <Ionicons name="refresh" size={15} color="#64748b" />
            </Pressable>
          </View>
          <Text style={styles.searchMeta}>{conversations.length} conversations</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={14} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search chats or contacts"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <Text style={[styles.connection, connected ? styles.connectionOn : styles.connectionOff]}>
            {connected ? "Realtime connected" : "Realtime reconnecting"}
          </Text>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.panelLabel}>Conversations</Text>
          {filteredConversations.length === 0 ? <Text style={styles.empty}>No conversations</Text> : null}
          {filteredConversations.map((item) => {
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
          })}
        </View>

        <View style={styles.listCard}>
          <Text style={styles.panelLabel}>Start New Chat</Text>
          {filteredContacts.length === 0 ? <Text style={styles.empty}>No contacts</Text> : null}
          {filteredContacts.map((item) => (
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
                <Text style={[styles.roleBadge, roleBadgeStyle(item.role)]}>{item.role}</Text>
              </View>
            </Pressable>
          ))}
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
  profileCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  pageContent: {
    paddingBottom: 20,
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
    fontSize: 14,
  },
  profileSubtitle: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  profileActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
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
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 12,
  },
  searchHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchTitle: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  searchMeta: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 11,
  },
  searchRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    fontSize: 13,
  },
  connection: {
    marginTop: 10,
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
    backgroundColor: "#cffafe",
    color: "#0e7490",
  },
  connectionOff: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  listCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 12,
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
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    gap: 10,
    backgroundColor: "#fff",
  },
  avatar: {
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#0e7490",
    fontSize: 10,
    fontWeight: "700",
  },
  userBody: {
    flex: 1,
  },
  userName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 14,
  },
  userSub: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
  },
  roleBadge: {
    marginTop: 3,
    alignSelf: "flex-start",
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
    marginLeft: 4,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    alignItems: "center",
    gap: 8,
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
    marginTop: 10,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
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
