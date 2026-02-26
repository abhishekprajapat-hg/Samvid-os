import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { createChatSocket } from "../../services/chatSocket";
import {
  getConversationMessages,
  getCallLogs,
  getMessengerContacts,
  sendDirectMessage,
  createCallLog,
  updateCallLog,
  uploadChatFile,
} from "../../services/chatService";
import { toErrorMessage } from "../../utils/errorMessage";
import { formatDateTime } from "../../utils/date";
import type { ChatCallLog, ChatContact, ChatConversation, ChatMessage } from "../../types";

const mergeMessages = (prev: ChatMessage[], incoming: ChatMessage[]) => {
  const map = new Map<string, ChatMessage>();
  [...prev, ...incoming].forEach((item) => {
    if (item?._id) map.set(item._id, item);
  });
  return [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const initials = (name: string) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

type PendingAttachment = { uri: string; name: string; mimeType: string; size?: number };

type ForwardPayload = {
  textInput?: string;
  attachment?: {
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    size?: number;
    storagePath?: string;
  } | null;
};

type ChatListItem =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: ChatMessage }
  | { kind: "image-group"; key: string; messages: ChatMessage[] };

const getAttachmentMimeType = (message: ChatMessage) => String(message.attachment?.mimeType || "").toLowerCase();
const isImageMessage = (message: ChatMessage) => Boolean(message.attachment?.fileUrl) && getAttachmentMimeType(message).startsWith("image/");
const getSenderId = (message: ChatMessage) => String(message.sender?._id || "");

const toDayKey = (dateInput: string | Date) => {
  const date = new Date(dateInput);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

const formatDayLabel = (dateInput: string | Date) => {
  const date = new Date(dateInput);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  if (isSameDay(date, tomorrow)) return "Tomorrow";

  const diffDays = Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (Math.abs(diffDays) <= 6) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const renderAvatar = (name: string, avatarUrl: string, size = 32) => {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#1e3a8a", fontSize: 10, fontWeight: "700" }}>{initials(name)}</Text>
    </View>
  );
};

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [forwardVisible, setForwardVisible] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardItems, setForwardItems] = useState<ForwardPayload[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [callLogs, setCallLogs] = useState<ChatCallLog[]>([]);
  const [callLogsVisible, setCallLogsVisible] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    callType: "VOICE" | "VIDEO";
    status: "OUTGOING" | "INCOMING" | "CONNECTED";
    startedAt: number;
    peerName: string;
    peerId: string;
    conversationId: string;
  } | null>(null);
  const [callTick, setCallTick] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState("");

  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const filePickerLockRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHasMoreHistory(true);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoading(true);
        const list = await getConversationMessages({ conversationId, limit: 60 });
        const rows = Array.isArray(list) ? list : [];
        setMessages(rows);
        setHasMoreHistory(rows.length >= 60);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to load messages"));
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    if (!incomingCallPayload?.callId) return;
    setActiveCall({
      callId: String(incomingCallPayload.callId || ""),
      callType: String(incomingCallPayload.callType || "VOICE").toUpperCase() === "VIDEO" ? "VIDEO" : "VOICE",
      status: "INCOMING",
      startedAt: Date.now(),
      peerName: contactName,
      peerId: contactId,
      conversationId: String(incomingCallPayload.conversationId || conversationId || ""),
    });
  }, [incomingCallPayload, contactId, contactName, conversationId]);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || loading || loadingHistory || !hasMoreHistory || messages.length === 0) return;

    const oldest = messages[0];
    if (!oldest?.createdAt) return;

    try {
      setLoadingHistory(true);
      const older = await getConversationMessages({
        conversationId,
        limit: 60,
        before: oldest.createdAt,
      });
      const rows = Array.isArray(older) ? older : [];
      setMessages((prev) => mergeMessages(rows, prev));
      setHasMoreHistory(rows.length >= 60);
    } catch {
      // keep silent; initial load already handles hard failures
    } finally {
      setLoadingHistory(false);
    }
  }, [conversationId, hasMoreHistory, loading, loadingHistory, messages]);

  useEffect(() => {
    getMessengerContacts().then((list) => setContacts(Array.isArray(list) ? list : [])).catch(() => setContacts([]));
  }, []);

  const loadCallLogs = useCallback(async (targetConversationId?: string) => {
    try {
      const list = await getCallLogs({
        conversationId: targetConversationId || conversationId || undefined,
        limit: 80,
      });
      setCallLogs(Array.isArray(list) ? list : []);
    } catch {
      // silent; message channel should not break
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      loadCallLogs(conversationId);
    }
  }, [conversationId, loadCallLogs]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== "CONNECTED") return;
    const timer = setInterval(() => setCallTick((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [activeCall]);

  useEffect(() => () => {
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = createChatSocket(token);
    socketRef.current = socket;

    socket.on("messenger:message:new", ({ conversation, message }: { conversation?: ChatConversation; message?: ChatMessage }) => {
      if (!conversation?._id || !message?._id) return;

      if (!conversationId) {
        const participantIds = (conversation.participants || []).map((p) => String(p._id));
        if (participantIds.includes(String(contactId))) {
          setConversationId(conversation._id);
        }
      }

      if (String(conversation._id) === String(conversationId || params.conversationId || "")) {
        setMessages((prev) => mergeMessages(prev, [message]));
      }
    });

    socket.on("messenger:call:incoming", (payload: any) => {
      const callerId = String(payload?.caller?._id || "");
      const incomingConversationId = String(payload?.conversationId || conversationId || "");
      const callerName = String(payload?.caller?.name || contactName);

      setActiveCall({
        callId: String(payload?.callId || ""),
        callType: String(payload?.callType || "VOICE").toUpperCase() === "VIDEO" ? "VIDEO" : "VOICE",
        status: "INCOMING",
        startedAt: Date.now(),
        peerName: callerName,
        peerId: callerId || contactId,
        conversationId: incomingConversationId,
      });
    });

    socket.on("messenger:call:update", async (payload: any) => {
      const status = String(payload?.status || "").toUpperCase();
      const incomingCallId = String(payload?.callId || "");
      if (!incomingCallId) return;

      if (status === "ACCEPTED") {
        setActiveCall((prev) => {
          if (!prev || prev.callId !== incomingCallId) return prev;
          return { ...prev, status: "CONNECTED", startedAt: Date.now() };
        });
      }

      if (["REJECTED", "MISSED", "ENDED", "FAILED", "CANCELLED"].includes(status)) {
        setActiveCall((prev) => (prev && prev.callId === incomingCallId ? null : prev));
        await loadCallLogs(String(payload?.conversationId || conversationId || ""));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, conversationId, contactId, params.conversationId, contactName, loadCallLogs]);

  const dispatchMessage = async ({
    textInput = "",
    attachment = null,
    overrideConversationId,
    overrideRecipientId,
  }: {
    textInput?: string;
    attachment?: ForwardPayload["attachment"];
    overrideConversationId?: string;
    overrideRecipientId?: string;
  }) => {
    const text = textInput.trim();
    if (!text && !attachment) return;

    const targetConversationId = overrideConversationId || conversationId;
    const targetRecipientId = overrideRecipientId || contactId;

    const payload = targetConversationId
      ? { conversationId: targetConversationId, text, attachment }
      : { recipientId: targetRecipientId, text, attachment };

    if (!overrideConversationId && !overrideRecipientId) {
      const socket = socketRef.current;
      if (socket?.connected) {
        const ack = await new Promise<{ ok?: boolean; message?: ChatMessage; conversation?: ChatConversation; error?: string }>((resolve) =>
          socket.emit("messenger:send", payload, (response: unknown) => resolve((response || {}) as any)),
        );

        if (!ack?.ok) {
          throw new Error(ack?.error || "Failed to send");
        }

        if (ack?.conversation?._id && !conversationId) {
          setConversationId(String(ack.conversation._id));
        }
        if (ack?.message) {
          setMessages((prev) => mergeMessages(prev, [ack.message as ChatMessage]));
        }
        return;
      }
    }

    const result = await sendDirectMessage(payload);
    if (!overrideConversationId && !overrideRecipientId && result?.message) {
      if (result?.conversation?._id && !conversationId) {
        setConversationId(String(result.conversation._id));
      }
      setMessages((prev) => mergeMessages(prev, [result.message]));
    }
  };

  const sendFile = async () => {
    if (sending || pickingFile || filePickerLockRef.current) return;

    filePickerLockRef.current = true;
    setPickingFile(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
        type: ["image/*", "application/pdf"],
      });
      if (picked.canceled || !picked.assets?.length) return;

      const nextFiles = picked.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name || "attachment",
        mimeType: asset.mimeType || "application/octet-stream",
        size: asset.size,
      }));

      setPendingAttachments((prev) => {
        const map = new Map<string, PendingAttachment>();
        [...prev, ...nextFiles].forEach((file) => map.set(`${file.uri}|${file.name}|${file.size || 0}`, file));
        return [...map.values()];
      });
    } catch (e) {
      setError(toErrorMessage(e, "Failed to select files"));
    } finally {
      setPickingFile(false);
      filePickerLockRef.current = false;
    }
  };

  const sendCameraPhoto = async () => {
    if (sending || pickingFile || isRecording) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera permission is required");
        return;
      }

      const captured = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: false });
      if (captured.canceled || !captured.assets?.length) return;

      setSending(true);
      const asset = captured.assets[0];
      const uploaded = await uploadChatFile({
        uri: asset.uri,
        name: asset.fileName || `camera-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });

      if (!uploaded) throw new Error("Upload failed");
      await dispatchMessage({ textInput: "", attachment: uploaded });
    } catch (e) {
      setError(toErrorMessage(e, "Failed to capture image"));
    } finally {
      setSending(false);
    }
  };

  const startAudioRecording = async () => {
    if (sending || isRecording) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError("Microphone permission is required");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
    } catch (e) {
      setRecording(null);
      setIsRecording(false);
      setError(toErrorMessage(e, "Failed to start recording"));
    }
  };

  const stopAudioRecording = async () => {
    if (!recording || !isRecording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);

      if (!uri) throw new Error("Recording file unavailable");
      const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
      const name = `voice-note-${Date.now()}.m4a`;
      setPendingAttachments((prev) => [...prev, { uri, name, mimeType }]);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to record voice note"));
    } finally {
      setRecording(null);
      setIsRecording(false);
    }
  };

  const removePendingAttachment = (indexToRemove: number) => {
    setPendingAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const sendQueuedMessage = async () => {
    if (sending || pickingFile || isRecording) return;

    const text = draft.trim();
    const attachments = [...pendingAttachments];
    if (!text && attachments.length === 0) return;

    setSending(true);
    setError("");
    setDraft("");
    setPendingAttachments([]);

    try {
      if (text) await dispatchMessage({ textInput: text });

      for (const file of attachments) {
        const mime = String(file.mimeType || "").toLowerCase();
        const isImage = mime.startsWith("image/");
        const isAudio = mime.startsWith("audio/");
        const uploaded = await uploadChatFile({ uri: file.uri, name: file.name, mimeType: file.mimeType });

        if (!uploaded) throw new Error("Upload failed");

        await dispatchMessage({
          textInput: isImage || isAudio ? "" : file.name || "Attachment",
          attachment: uploaded,
        });
      }
    } catch (e) {
      setDraft(text);
      setPendingAttachments(attachments);
      setError(toErrorMessage(e, "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  const openImageViewer = (urls: string[], index = 0) => {
    setViewerUrls(urls);
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const closeImageViewer = () => {
    setViewerVisible(false);
    setViewerUrls([]);
    setViewerIndex(0);
  };

  const openForwardPicker = (items: ForwardPayload[]) => {
    setForwardItems(items);
    setForwardSearch("");
    setForwardVisible(true);
  };

  const forwardToContact = async (targetContactId: string) => {
    if (!targetContactId || forwarding || !forwardItems.length) return;

    try {
      setForwarding(true);
      for (const item of forwardItems) {
        await dispatchMessage({
          textInput: item.textInput || "",
          attachment: item.attachment || null,
          overrideRecipientId: targetContactId,
        });
      }
      setForwardVisible(false);
      setForwardItems([]);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to forward message"));
    } finally {
      setForwarding(false);
    }
  };

  const filteredForwardContacts = useMemo(() => {
    const q = forwardSearch.trim().toLowerCase();
    const list = contacts.filter((person) => String(person._id) !== String(user?._id || user?.id || ""));
    if (!q) return list;
    return list.filter((person) => String(person.name || "").toLowerCase().includes(q));
  }, [contacts, forwardSearch, user]);

  const formatCallDuration = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(safe / 60)).padStart(2, "0");
    const ss = String(safe % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const playAudioAttachment = async (messageId: string, url: string) => {
    if (!url) return;
    try {
      if (playingMessageId === messageId && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlayingMessageId("");
        return;
      }

      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingMessageId(messageId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if ((status as any).didJustFinish) {
          setPlayingMessageId("");
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
        }
      });
    } catch (e) {
      setPlayingMessageId("");
      setError(toErrorMessage(e, "Unable to play voice note"));
    }
  };

  const startCall = async (callType: "VOICE" | "VIDEO") => {
    try {
      setError("");
      const e2ee = {
        enabled: true,
        protocol: "X25519-AES-256-GCM",
        senderKeyFingerprint: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      };
      const created = await createCallLog({
        conversationId: conversationId || undefined,
        recipientId: contactId || undefined,
        callType,
        e2ee,
      });
      if (!created.call?._id) {
        throw new Error("Failed to create call");
      }

      if (created.conversationId && !conversationId) {
        setConversationId(created.conversationId);
      }

      const socket = socketRef.current;
      socket?.emit("messenger:call:initiate", {
        callId: created.call._id,
        conversationId: created.conversationId || conversationId || null,
        recipientId: contactId,
        callType,
        e2ee,
      });
      navigation.navigate("CallScreen", {
        callId: created.call._id,
        callType,
        peerId: contactId,
        peerName: contactName,
        conversationId: created.conversationId || conversationId || "",
        incoming: false,
      });
      loadCallLogs(created.conversationId || conversationId || "");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to start call"));
    }
  };

  const acceptIncomingCall = async () => {
    if (!activeCall?.callId) return;
    try {
      await updateCallLog({ callId: activeCall.callId, status: "ACCEPTED" });
      socketRef.current?.emit("messenger:call:update", {
        callId: activeCall.callId,
        conversationId: activeCall.conversationId || conversationId || null,
        recipientId: activeCall.peerId || contactId,
        status: "ACCEPTED",
      });
      navigation.navigate("CallScreen", {
        callId: activeCall.callId,
        callType: activeCall.callType,
        peerId: activeCall.peerId || contactId,
        peerName: activeCall.peerName || contactName,
        conversationId: activeCall.conversationId || conversationId || "",
        incoming: true,
      });
      setActiveCall(null);
      loadCallLogs(activeCall.conversationId || conversationId || "");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to accept call"));
    }
  };

  const rejectIncomingCall = async () => {
    if (!activeCall?.callId) return;
    try {
      await updateCallLog({ callId: activeCall.callId, status: "REJECTED", durationSec: 0 });
      socketRef.current?.emit("messenger:call:update", {
        callId: activeCall.callId,
        conversationId: activeCall.conversationId || conversationId || null,
        recipientId: activeCall.peerId || contactId,
        status: "REJECTED",
        durationSec: 0,
      });
      setActiveCall(null);
      loadCallLogs(activeCall.conversationId || conversationId || "");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to reject call"));
    }
  };

  const endActiveCall = async () => {
    if (!activeCall?.callId) return;
    try {
      const durationSec = activeCall.status === "CONNECTED"
        ? Math.max(0, Math.floor((Date.now() - activeCall.startedAt) / 1000))
        : 0;
      await updateCallLog({ callId: activeCall.callId, status: "ENDED", durationSec });
      socketRef.current?.emit("messenger:call:update", {
        callId: activeCall.callId,
        conversationId: activeCall.conversationId || conversationId || null,
        recipientId: activeCall.peerId || contactId,
        status: "ENDED",
        durationSec,
      });
      setActiveCall(null);
      loadCallLogs(activeCall.conversationId || conversationId || "");
    } catch (e) {
      setError(toErrorMessage(e, "Failed to end call"));
    }
  };

  const chatItems = useMemo<ChatListItem[]>(() => {
    const baseItems: Array<{ kind: "message" | "image-group"; key: string; createdAt: string; message?: ChatMessage; messages?: ChatMessage[] }> = [];
    let index = 0;

    while (index < messages.length) {
      const current = messages[index];
      if (!isImageMessage(current)) {
        baseItems.push({ kind: "message", key: `message:${current._id}`, message: current, createdAt: current.createdAt });
        index += 1;
        continue;
      }

      const grouped = [current];
      let nextIndex = index + 1;
      let previousTime = new Date(current.createdAt).getTime();

      while (nextIndex < messages.length) {
        const nextMessage = messages[nextIndex];
        if (!isImageMessage(nextMessage)) break;
        if (getSenderId(nextMessage) !== getSenderId(current)) break;
        const nextTime = new Date(nextMessage.createdAt).getTime();
        if (!Number.isFinite(nextTime) || !Number.isFinite(previousTime)) break;
        if (Math.abs(nextTime - previousTime) > 90 * 1000) break;
        grouped.push(nextMessage);
        previousTime = nextTime;
        nextIndex += 1;
      }

      if (grouped.length > 1) {
        baseItems.push({ kind: "image-group", key: `image-group:${grouped[0]._id}:${grouped.length}`, messages: grouped, createdAt: grouped[grouped.length - 1].createdAt });
      } else {
        baseItems.push({ kind: "message", key: `message:${current._id}`, message: current, createdAt: current.createdAt });
      }

      index = nextIndex;
    }

    const rows: ChatListItem[] = [];
    let lastDay = "";
    baseItems.forEach((item) => {
      const dayKey = toDayKey(item.createdAt);
      if (dayKey !== lastDay) {
        rows.push({ kind: "day", key: `day:${dayKey}`, label: formatDayLabel(item.createdAt) });
        lastDay = dayKey;
      }

      if (item.kind === "message" && item.message) rows.push({ kind: "message", key: item.key, message: item.message });
      if (item.kind === "image-group" && item.messages) rows.push({ kind: "image-group", key: item.key, messages: item.messages });
    });

    return rows;
  }, [messages]);

  const messageCountText = useMemo(() => `${messages.length} messages`, [messages.length]);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color="#334155" />
          </Pressable>
          {renderAvatar(contactName, contactAvatar, 32)}
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{contactName}</Text>
            <Text style={styles.subTitle}>{contactRole || "Member"}</Text>
          </View>
          <Pressable style={styles.headerIconBtn} onPress={() => startCall("VOICE")}>
            <Ionicons name="call-outline" size={16} color="#334155" />
          </Pressable>
          <Pressable style={styles.headerIconBtn} onPress={() => startCall("VIDEO")}>
            <Ionicons name="videocam-outline" size={16} color="#334155" />
          </Pressable>
          <Pressable style={styles.headerIconBtn} onPress={() => setCallLogsVisible(true)}>
            <Ionicons name="time-outline" size={16} color="#334155" />
          </Pressable>
          <Text style={styles.messageCount}>{messageCountText}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color="#0f172a" /></View>
        ) : (
          <View style={styles.chatArea}>
            <FlatList
              data={chatItems}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>No messages yet</Text>}
              onScroll={(event) => {
                if (event.nativeEvent.contentOffset.y <= 40) {
                  loadOlderMessages();
                }
              }}
              scrollEventThrottle={80}
              ListHeaderComponent={
                loadingHistory ? (
                  <View style={styles.historyLoader}>
                    <ActivityIndicator size="small" color="#64748b" />
                    <Text style={styles.historyLoaderText}>Loading older messages...</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                if (item.kind === "day") {
                  return <View style={styles.dayWrap}><Text style={styles.dayText}>{item.label}</Text></View>;
                }

                if (item.kind === "image-group") {
                  const firstMessage = item.messages[0];
                  const mine = String(firstMessage.sender?._id || "") === String(user?._id || user?.id || "");
                  const urls = item.messages.map((row) => String(row.attachment?.fileUrl || "")).filter(Boolean);
                  const previewUrls = urls.slice(0, 4);
                  const extraCount = Math.max(urls.length - previewUrls.length, 0);
                  const lastMessage = item.messages[item.messages.length - 1];
                  const compactGrid = previewUrls.length <= 2;

                  return (
                    <View style={[styles.messageWrap, mine && styles.messageWrapMine]}>
                      <Pressable
                        style={styles.forwardBtn}
                        onPress={() => openForwardPicker(item.messages.map((row) => ({ textInput: row.text || "", attachment: row.attachment || null })))}
                      >
                        <Ionicons name="arrow-redo-outline" size={15} color="#475569" />
                      </Pressable>

                      <View style={[styles.messageBubble, mine && styles.messageBubbleMine]}>
                        <Text style={[styles.messageAuthor, mine && styles.messageTextMine]}>{mine ? "You" : contactName}</Text>
                        <Pressable onPress={() => openImageViewer(urls, 0)} style={styles.groupedImageWrap}>
                          <View style={[styles.groupedGrid, compactGrid && styles.groupedGridCompact]}>
                            {previewUrls.map((url, previewIndex) => {
                              const showOverlay = extraCount > 0 && previewIndex === previewUrls.length - 1;
                              return (
                                <View key={`${url}-${previewIndex}`} style={[styles.groupedTile, compactGrid && styles.groupedTileCompact]}>
                                  <Image source={{ uri: url }} style={styles.groupedTileImage} resizeMode="cover" />
                                  {showOverlay ? (
                                    <View style={styles.groupedTileOverlay}><Text style={styles.groupedOverlayText}>+{extraCount}</Text></View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        </Pressable>
                        <Text style={[styles.messageTime, mine && styles.messageTextMine]}>{formatDateTime(lastMessage.createdAt)}</Text>
                      </View>
                    </View>
                  );
                }

                const message = item.message;
                const mine = String(message.sender?._id || "") === String(user?._id || user?.id || "");
                const hasAttachment = Boolean(message.attachment?.fileUrl);
                const attachmentMime = getAttachmentMimeType(message);
                const isImageAttachment = attachmentMime.startsWith("image/");
                const fileUrl = String(message.attachment?.fileUrl || "");
                const fileName = String(message.attachment?.fileName || "");
                const isAudioAttachment =
                  attachmentMime.startsWith("audio/")
                  || /\.(m4a|mp3|aac|amr|ogg|wav)$/i.test(fileUrl)
                  || /\.(m4a|mp3|aac|amr|ogg|wav)$/i.test(fileName);
                const isPdfAttachment = attachmentMime.includes("pdf");
                const hasText = Boolean(String(message.text || "").trim());

                return (
                  <View style={[styles.messageWrap, mine && styles.messageWrapMine]}>
                    <Pressable
                      style={styles.forwardBtn}
                      onPress={() => openForwardPicker([{ textInput: message.text || "", attachment: message.attachment || null }])}
                    >
                      <Ionicons name="arrow-redo-outline" size={15} color="#475569" />
                    </Pressable>

                    <View style={[styles.messageBubble, mine && styles.messageBubbleMine]}>
                      <Text style={[styles.messageAuthor, mine && styles.messageTextMine]}>{mine ? "You" : contactName}</Text>
                      {!hasAttachment ? (
                        <Text style={[styles.messageText, mine && styles.messageTextMine]}>{message.text}</Text>
                      ) : isImageAttachment ? (
                        <Pressable onPress={() => openImageViewer([String(message.attachment?.fileUrl || "")], 0)}>
                          <Image source={{ uri: String(message.attachment?.fileUrl || "") }} style={styles.attachmentImage} resizeMode="cover" />
                        </Pressable>
                      ) : isAudioAttachment ? (
                        <Pressable
                          style={[styles.audioCard, mine && styles.audioCardMine]}
                          onPress={() => playAudioAttachment(message._id, String(message.attachment?.fileUrl || ""))}
                        >
                          <Ionicons
                            name={playingMessageId === message._id ? "pause" : "play"}
                            size={16}
                            color={mine ? "#ffffff" : "#0f172a"}
                          />
                          <Text style={[styles.audioText, mine && styles.messageTextMine]}>
                            {playingMessageId === message._id ? "Playing..." : "Voice note"}
                          </Text>
                        </Pressable>
                      ) : isPdfAttachment ? (
                        <Pressable style={[styles.pdfCard, mine && styles.pdfCardMine]} onPress={() => Linking.openURL(String(message.attachment?.fileUrl || ""))}>
                          <Ionicons name="document-text-outline" size={16} color={mine ? "#ffffff" : "#1e293b"} />
                          <Text style={[styles.pdfText, mine && styles.messageTextMine]} numberOfLines={1}>{message.attachment?.fileName || "Open PDF"}</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => Linking.openURL(String(message.attachment?.fileUrl || ""))}>
                          <Text style={[styles.fileText, mine && styles.messageTextMine]}>{message.attachment?.fileName || "Open file"}</Text>
                        </Pressable>
                      )}
                      {hasAttachment && hasText && !isImageAttachment && !isAudioAttachment ? (
                        <Text style={[styles.messageText, mine && styles.messageTextMine]}>{message.text}</Text>
                      ) : null}
                      <Text style={[styles.messageTime, mine && styles.messageTextMine]}>{formatDateTime(message.createdAt)}</Text>
                    </View>
                  </View>
                );
              }}
            />

            {pendingAttachments.length > 0 ? (
              <View style={styles.pendingWrap}>
                <Text style={styles.pendingLabel}>Ready to send ({pendingAttachments.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pendingList}>
                  {pendingAttachments.map((file, index) => {
                    const isImage = String(file.mimeType || "").toLowerCase().startsWith("image/");
                    const isAudio = String(file.mimeType || "").toLowerCase().startsWith("audio/");
                    return (
                      <View key={`${file.uri}-${index}`} style={styles.pendingItem}>
                        {isImage ? (
                          <Image source={{ uri: file.uri }} style={styles.pendingThumb} resizeMode="cover" />
                        ) : isAudio ? (
                          <View style={styles.pendingIconWrap}><Ionicons name="mic" size={16} color="#334155" /></View>
                        ) : (
                          <View style={styles.pendingIconWrap}><Ionicons name="document-text-outline" size={16} color="#334155" /></View>
                        )}
                        <Text numberOfLines={1} style={styles.pendingName}>{file.name}</Text>
                        <Pressable style={styles.pendingRemove} onPress={() => removePendingAttachment(index)}>
                          <Ionicons name="close-circle" size={16} color="#ef4444" />
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.composer}>
              <Pressable style={styles.attachBtn} onPress={sendFile} disabled={sending || pickingFile || isRecording}>
                <Ionicons name="attach" size={16} color="#475569" />
              </Pressable>
              <Pressable style={styles.attachBtn} onPress={sendCameraPhoto} disabled={sending || pickingFile || isRecording}>
                <Ionicons name="camera-outline" size={16} color="#475569" />
              </Pressable>
              <Pressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={isRecording ? stopAudioRecording : startAudioRecording} disabled={sending || pickingFile}>
                <Ionicons name={isRecording ? "stop" : "mic"} size={16} color={isRecording ? "#fff" : "#475569"} />
              </Pressable>
              <TextInput
                style={styles.input}
                placeholder={isRecording ? "Recording voice note..." : `Message ${contactName}...`}
                value={draft}
                onChangeText={setDraft}
                editable={!sending && !pickingFile && !isRecording}
              />
              <Pressable
                style={[styles.sendBtn, ((!draft.trim() && pendingAttachments.length === 0) || sending || pickingFile || isRecording) && styles.sendDisabled]}
                onPress={sendQueuedMessage}
                disabled={(!draft.trim() && pendingAttachments.length === 0) || sending || pickingFile || isRecording}
              >
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="paper-plane" size={15} color="#fff" />}
              </Pressable>
            </View>
          </View>
        )}

        <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={closeImageViewer}>
          <View style={styles.viewerBackdrop}>
            <View style={styles.viewerHeader}>
              <Text style={styles.viewerTitle}>{viewerUrls.length > 0 ? `${viewerIndex + 1}/${viewerUrls.length}` : "Image"}</Text>
              <Pressable onPress={closeImageViewer} style={styles.viewerClose}><Ionicons name="close" size={18} color="#ffffff" /></Pressable>
            </View>
            <FlatList
              data={viewerUrls}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              keyExtractor={(url, index) => `${url}-${index}`}
              onMomentumScrollEnd={(event) => {
                const width = Dimensions.get("window").width || 1;
                setViewerIndex(Math.round(event.nativeEvent.contentOffset.x / width));
              }}
              getItemLayout={(_, index) => {
                const width = Dimensions.get("window").width || 1;
                return { index, length: width, offset: width * index };
              }}
              renderItem={({ item: url }) => (
                <View style={styles.viewerSlide}><Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" /></View>
              )}
            />
          </View>
        </Modal>

        <Modal visible={forwardVisible} transparent animationType="fade" onRequestClose={() => setForwardVisible(false)}>
          <View style={styles.forwardBackdrop}>
            <View style={styles.forwardCard}>
              <Text style={styles.forwardTitle}>Forward To</Text>
              <TextInput style={styles.forwardInput} value={forwardSearch} onChangeText={setForwardSearch} placeholder="Search team member" />
              <FlatList
                data={filteredForwardContacts}
                keyExtractor={(item) => item._id}
                style={styles.forwardList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.forwardRow} onPress={() => forwardToContact(item._id)} disabled={forwarding}>
                    {renderAvatar(item.name, item.avatarUrl || "", 30)}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.forwardName}>{item.name}</Text>
                      <Text style={styles.forwardRole}>{item.role}</Text>
                    </View>
                    {forwarding ? <ActivityIndicator size="small" color="#0f172a" /> : null}
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No contacts</Text>}
              />
              <Pressable style={styles.forwardCancel} onPress={() => setForwardVisible(false)}>
                <Text style={styles.forwardCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={Boolean(activeCall)} transparent animationType="fade" onRequestClose={endActiveCall}>
          <View style={styles.callBackdrop}>
            <View style={styles.callCard}>
              <Ionicons name={activeCall?.callType === "VIDEO" ? "videocam" : "call"} size={24} color="#0f172a" />
              <Text style={styles.callTitle}>
                {activeCall?.status === "INCOMING" ? "Incoming Call" : activeCall?.status === "OUTGOING" ? "Calling..." : "In Call"}
              </Text>
              <Text style={styles.callPeer}>{activeCall?.peerName || contactName}</Text>
              <Text style={styles.callSub}>
                {activeCall?.status === "CONNECTED"
                  ? `Duration ${formatCallDuration(Math.floor((Date.now() - (activeCall?.startedAt || Date.now())) / 1000))}`
                  : "E2EE enabled"}
              </Text>

              {activeCall?.status === "INCOMING" ? (
                <View style={styles.callActions}>
                  <Pressable style={[styles.callBtn, styles.callRejectBtn]} onPress={rejectIncomingCall}>
                    <Text style={styles.callBtnText}>Reject</Text>
                  </Pressable>
                  <Pressable style={[styles.callBtn, styles.callAcceptBtn]} onPress={acceptIncomingCall}>
                    <Text style={[styles.callBtnText, styles.callAcceptText]}>Accept</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.callBtn, styles.callEndBtn]} onPress={endActiveCall}>
                  <Text style={styles.callBtnText}>End Call</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={callLogsVisible} transparent animationType="fade" onRequestClose={() => setCallLogsVisible(false)}>
          <View style={styles.forwardBackdrop}>
            <View style={styles.forwardCard}>
              <Text style={styles.forwardTitle}>Call Logs</Text>
              <FlatList
                data={callLogs}
                keyExtractor={(item) => item._id}
                style={styles.forwardList}
                ListEmptyComponent={<Text style={styles.empty}>No call logs yet</Text>}
                renderItem={({ item }) => {
                  const mine = String(item.caller?._id || "") === String(user?._id || user?.id || "");
                  const peerName = mine ? item.callee?.name : item.caller?.name;
                  return (
                    <View style={styles.callLogRow}>
                      <Ionicons
                        name={item.callType === "VIDEO" ? "videocam-outline" : "call-outline"}
                        size={16}
                        color="#334155"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.forwardName}>{peerName || "Unknown"}</Text>
                        <Text style={styles.forwardRole}>
                          {item.status} | {formatDateTime(item.startedAt)}{item.durationSec ? ` | ${formatCallDuration(item.durationSec)}` : ""}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
              <Pressable style={styles.forwardCancel} onPress={() => setCallLogsVisible(false)}>
                <Text style={styles.forwardCancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 6 },
  backBtn: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, marginLeft: 6 },
  title: { color: "#0f172a", fontSize: 14, fontWeight: "700" },
  subTitle: { marginTop: 1, color: "#64748b", fontSize: 11 },
  messageCount: { color: "#94a3b8", fontSize: 11 },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  error: { marginHorizontal: 12, marginTop: 8, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  chatArea: { flex: 1 },
  messagesContent: { padding: 12, paddingBottom: 18, gap: 8 },
  dayWrap: { alignSelf: "center", backgroundColor: "#e2e8f0", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 6 },
  dayText: { color: "#334155", fontSize: 11, fontWeight: "700" },
  messageWrap: { alignItems: "flex-start", flexDirection: "row", gap: 6 },
  messageWrapMine: { alignItems: "flex-end", alignSelf: "flex-end" },
  forwardBtn: { width: 24, height: 24, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", marginTop: 18 },
  messageBubble: { maxWidth: "84%", backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: "#dbe3ee", paddingHorizontal: 10, paddingVertical: 8 },
  messageBubbleMine: { backgroundColor: "#67c3d6", borderColor: "#67c3d6" },
  messageAuthor: { color: "#0f172a", fontSize: 11, fontWeight: "700" },
  messageText: { color: "#0f172a", fontSize: 14, marginTop: 2 },
  messageTime: { color: "#64748b", fontSize: 10, marginTop: 4 },
  messageTextMine: { color: "#ffffff" },
  fileText: { marginTop: 3, color: "#0f172a", fontSize: 13, textDecorationLine: "underline" },
  attachmentImage: { marginTop: 6, width: 180, height: 180, borderRadius: 10, backgroundColor: "#e2e8f0" },
  groupedImageWrap: { marginTop: 2 },
  groupedGrid: { marginTop: 6, width: 180, height: 180, borderRadius: 10, overflow: "hidden", flexDirection: "row", flexWrap: "wrap", gap: 4, backgroundColor: "#dbe3ee" },
  groupedGridCompact: { height: 88 },
  groupedTile: { width: 88, height: 88, backgroundColor: "#e2e8f0" },
  groupedTileCompact: { flex: 1 },
  groupedTileImage: { width: "100%", height: "100%" },
  groupedTileOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,23,42,0.55)" },
  groupedOverlayText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  pdfCard: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#f8fafc", maxWidth: 220 },
  pdfCardMine: { borderColor: "rgba(255,255,255,0.45)", backgroundColor: "rgba(255,255,255,0.2)" },
  pdfText: { flex: 1, color: "#0f172a", fontSize: 12, fontWeight: "600" },
  audioCard: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    maxWidth: 220,
  },
  audioCardMine: {
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  audioText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600",
  },
  pendingWrap: { borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff", paddingTop: 8, paddingBottom: 6, paddingHorizontal: 12 },
  pendingLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 6 },
  pendingList: { paddingRight: 6, gap: 8 },
  pendingItem: { width: 120, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, backgroundColor: "#fff", padding: 6 },
  pendingThumb: { width: "100%", height: 60, borderRadius: 8, backgroundColor: "#e2e8f0" },
  pendingIconWrap: { height: 60, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  pendingName: { marginTop: 6, fontSize: 11, color: "#334155" },
  pendingRemove: { position: "absolute", top: 4, right: 4 },
  composer: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 20, borderTopWidth: 1, borderTopColor: "#e2e8f0", backgroundColor: "#ffffff" },
  attachBtn: { width: 34, height: 34, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  micBtn: { width: 34, height: 34, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  micBtnActive: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  input: { flex: 1, height: 40, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: "#0f172a", backgroundColor: "#fff" },
  sendBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: "#67c3d6", alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.55 },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.95)" },
  viewerHeader: { paddingTop: 42, paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  viewerTitle: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  viewerClose: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(148,163,184,0.25)" },
  viewerSlide: { width: Dimensions.get("window").width, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  viewerImage: { width: "100%", height: "82%" },
  forwardBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 16 },
  forwardCard: { maxHeight: "72%", backgroundColor: "#fff", borderRadius: 14, padding: 12 },
  forwardTitle: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  forwardInput: { marginTop: 10, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, height: 40, paddingHorizontal: 12, color: "#0f172a", backgroundColor: "#fff" },
  forwardList: { marginTop: 10 },
  forwardRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 8, marginBottom: 6 },
  forwardName: { color: "#0f172a", fontSize: 13, fontWeight: "700" },
  forwardRole: { color: "#64748b", fontSize: 11, marginTop: 1 },
  forwardCancel: { marginTop: 8, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, height: 38, alignItems: "center", justifyContent: "center" },
  forwardCancelText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 14, fontSize: 12 },
  callBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 16 },
  callCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  callTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  callPeer: { fontSize: 14, fontWeight: "600", color: "#334155" },
  callSub: { fontSize: 12, color: "#64748b" },
  callActions: { marginTop: 8, flexDirection: "row", gap: 10 },
  callBtn: {
    minWidth: 110,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  callRejectBtn: { borderColor: "#fecaca", backgroundColor: "#fff1f2" },
  callAcceptBtn: { borderColor: "#86efac", backgroundColor: "#dcfce7" },
  callEndBtn: { borderColor: "#fecaca", backgroundColor: "#fee2e2", marginTop: 8 },
  callBtnText: { color: "#991b1b", fontSize: 13, fontWeight: "700" },
  callAcceptText: { color: "#166534" },
  callLogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  historyLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  historyLoaderText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
});
