import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { createChatSocket } from "../../services/chatSocket";
import { updateCallLog } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import { toErrorMessage } from "../../utils/errorMessage";

let webrtcModule: any = null;
try {
  webrtcModule = require("react-native-webrtc");
} catch {
  webrtcModule = null;
}

const RTCIceCandidateCtor = webrtcModule?.RTCIceCandidate;
const RTCPeerConnectionCtor = webrtcModule?.RTCPeerConnection;
const RTCSessionDescriptionCtor = webrtcModule?.RTCSessionDescription;
const RTCViewNative = webrtcModule?.RTCView;
const mediaDevicesApi = webrtcModule?.mediaDevices;

const TURN_URL = String(process.env.EXPO_PUBLIC_TURN_URL || "").trim();
const TURN_USERNAME = String(process.env.EXPO_PUBLIC_TURN_USERNAME || "").trim();
const TURN_CREDENTIAL = String(process.env.EXPO_PUBLIC_TURN_CREDENTIAL || "").trim();

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    ...(TURN_URL
      ? [{
          urls: TURN_URL,
          username: TURN_USERNAME,
          credential: TURN_CREDENTIAL,
        }]
      : []),
  ],
};

const toDuration = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const ensureAndroidPermissions = async (callType: "VOICE" | "VIDEO") => {
  if (Platform.OS !== "android") return true;

  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (callType === "VIDEO") {
    wanted.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

  const granted = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((perm) => granted[perm] === PermissionsAndroid.RESULTS.GRANTED);
};

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
    RTCPeerConnectionCtor &&
    RTCSessionDescriptionCtor &&
    RTCViewNative &&
    mediaDevicesApi,
  );

  const pcRef = useRef<any>(null);
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);
  const connectedAtRef = useRef<number>(0);
  const hasEndedRef = useRef(false);

  const callLabel = useMemo(() => {
    if (connected) return `Connected ${toDuration(elapsed)}`;
    if (incoming) return "Connecting incoming call...";
    return "Calling...";
  }, [connected, elapsed, incoming]);

  useEffect(() => {
    if (!connectedAtRef.current) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [connected]);

  const emitSignal = (signalType: string, signal: any) => {
    if (!socketRef.current || !peerId) return;
    socketRef.current.emit("messenger:call:signal", {
      callId,
      conversationId: conversationId || null,
      recipientId: peerId,
      signalType,
      signal,
    });
  };

  const markConnected = () => {
    if (!connectedAtRef.current) {
      connectedAtRef.current = Date.now();
      setConnected(true);
    }
  };

  const startOutgoingOffer = async () => {
    const pc = pcRef.current;
    if (!pc) return;

    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "VIDEO" });
    await pc.setLocalDescription(offer);
    emitSignal("offer", offer);
  };

  const teardownMedia = async () => {
    try {
      if (localStream) {
        localStream.getTracks().forEach((track: any) => {
          try { track.stop(); } catch {}
        });
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track: any) => {
          try { track.stop(); } catch {}
        });
      }
    } catch {}

    try {
      pcRef.current?.close();
    } catch {}

    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);

    try {
      socketRef.current?.disconnect();
    } catch {}
    socketRef.current = null;
  };

  const endCall = async (status: "ENDED" | "REJECTED" | "FAILED" = "ENDED") => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    const durationSec = connectedAtRef.current
      ? Math.max(0, Math.floor((Date.now() - connectedAtRef.current) / 1000))
      : 0;

    try {
      await updateCallLog({ callId, status, durationSec });
    } catch {
      // call log route may not exist on older deployment
    }

    try {
      socketRef.current?.emit("messenger:call:update", {
        callId,
        conversationId: conversationId || null,
        recipientId: peerId,
        status,
        durationSec,
      });
    } catch {}

    await teardownMedia();
    navigation.goBack();
  };

  useEffect(() => {
    if (!hasWebRtc) {
      setError("This build does not support calling. Install development build for voice/video call.");
      setLoading(false);
      return;
    }

    if (!token || !peerId || !callId) {
      setError("Invalid call context");
      setLoading(false);
      return;
    }

    let isMounted = true;

    const setup = async () => {
      try {
        const permissionOk = await ensureAndroidPermissions(callType);
        if (!permissionOk) {
          throw new Error("Camera/Microphone permission denied");
        }

        const stream = await mediaDevicesApi.getUserMedia({
          audio: true,
          video: callType === "VIDEO" ? { facingMode: "user" } : false,
        });

        if (!isMounted) return;
        setLocalStream(stream);

        const pc = new RTCPeerConnectionCtor(ICE_SERVERS as any);
        pcRef.current = pc;

        stream.getTracks().forEach((track: any) => {
          pc.addTrack(track, stream);
        });

        (pc as any).onicecandidate = (event: any) => {
          if (!event?.candidate) return;
          emitSignal("ice-candidate", event.candidate);
        };

        (pc as any).ontrack = (event: any) => {
          if (event?.streams?.[0]) {
            setRemoteStream(event.streams[0]);
            markConnected();
          }
        };

        (pc as any).onconnectionstatechange = () => {
          const state = String((pc as any).connectionState || "").toLowerCase();
          if (["connected", "completed"].includes(state)) {
            markConnected();
          }
          if (["failed", "disconnected", "closed"].includes(state) && !hasEndedRef.current) {
            endCall("FAILED");
          }
        };

        const socket = createChatSocket(token);
        socketRef.current = socket;

        socket.on("messenger:call:signal", async (payload: any) => {
          try {
            const incomingCallId = String(payload?.callId || "");
            if (incomingCallId && incomingCallId !== callId) return;

            const fromUserId = String(payload?.fromUserId || "");
            if (fromUserId && fromUserId !== peerId) return;

            const signalType = String(payload?.signalType || "").toLowerCase();
            const signal = payload?.signal;

            if (!pcRef.current || !signalType || !signal) return;

            if (signalType === "offer") {
              await pcRef.current.setRemoteDescription(new RTCSessionDescriptionCtor(signal));
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              emitSignal("answer", answer);
              markConnected();
              return;
            }

            if (signalType === "answer") {
              await pcRef.current.setRemoteDescription(new RTCSessionDescriptionCtor(signal));
              markConnected();
              return;
            }

            if (signalType === "ice-candidate" && signal?.candidate) {
              await pcRef.current.addIceCandidate(new RTCIceCandidateCtor(signal));
            }
          } catch {
            // ignore malformed signal packets
          }
        });

        socket.on("messenger:call:update", (payload: any) => {
          const incomingCallId = String(payload?.callId || "");
          if (incomingCallId && incomingCallId !== callId) return;
          const status = String(payload?.status || "").toUpperCase();
          if (["REJECTED", "MISSED", "ENDED", "FAILED", "CANCELLED"].includes(status)) {
            endCall(status === "REJECTED" ? "REJECTED" : "ENDED");
          }
        });

        socket.on("connect", async () => {
          if (incoming) {
            try {
              await updateCallLog({ callId, status: "ACCEPTED" });
            } catch {
              // optional on legacy backend
            }
            socket.emit("messenger:call:update", {
              callId,
              conversationId: conversationId || null,
              recipientId: peerId,
              status: "ACCEPTED",
            });
          } else {
            await startOutgoingOffer();
          }
        });

        setLoading(false);
      } catch (e) {
        setError(toErrorMessage(e, "Failed to start call"));
        setLoading(false);
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (!hasEndedRef.current) {
        endCall("ENDED");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, peerId, callId, callType, incoming, conversationId, hasWebRtc]);

  const toggleMic = () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks?.()[0];
    if (!track) return;
    const next = !micMuted;
    track.enabled = !next;
    setMicMuted(next);
  };

  const toggleCamera = () => {
    if (!localStream || callType !== "VIDEO") return;
    const track = localStream.getVideoTracks?.()[0];
    if (!track) return;
    const next = !cameraMuted;
    track.enabled = !next;
    setCameraMuted(next);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{callType === "VIDEO" ? "Video Call" : "Voice Call"}</Text>
        <Text style={styles.peer}>{peerName}</Text>
        <Text style={styles.sub}>{callLabel}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.stage}>
        {callType === "VIDEO" && remoteStream ? (
          <RTCViewNative
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            {loading ? <ActivityIndicator color="#ffffff" /> : null}
            <Ionicons name={callType === "VIDEO" ? "videocam" : "call"} size={42} color="#cbd5e1" />
            <Text style={styles.placeholderText}>{connected ? "Connected" : "Waiting for peer..."}</Text>
          </View>
        )}

        {callType === "VIDEO" && localStream ? (
          <RTCViewNative
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror
          />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={toggleMic}>
          <Ionicons name={micMuted ? "mic-off" : "mic"} size={20} color="#0f172a" />
          <Text style={styles.actionText}>{micMuted ? "Unmute" : "Mute"}</Text>
        </Pressable>

        {callType === "VIDEO" ? (
          <Pressable style={styles.actionBtn} onPress={toggleCamera}>
            <Ionicons name={cameraMuted ? "videocam-off" : "videocam"} size={20} color="#0f172a" />
            <Text style={styles.actionText}>{cameraMuted ? "Camera On" : "Camera Off"}</Text>
          </Pressable>
        ) : null}

        <Pressable style={[styles.actionBtn, styles.endBtn]} onPress={() => endCall("ENDED")}>
          <Ionicons name="call" size={20} color="#ffffff" />
          <Text style={styles.endText}>End</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  header: { alignItems: "center", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  title: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  peer: { marginTop: 4, color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
  sub: { marginTop: 2, color: "#94a3b8", fontSize: 12 },
  error: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlign: "center",
  },
  stage: { flex: 1, margin: 12, borderRadius: 14, overflow: "hidden", backgroundColor: "#020617" },
  remoteVideo: { flex: 1, backgroundColor: "#000" },
  localVideo: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 110,
    height: 160,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderText: { color: "#94a3b8", fontSize: 12 },
  actions: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  actionBtn: {
    minWidth: 96,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
  },
  actionText: { color: "#0f172a", fontSize: 12, fontWeight: "700" },
  endBtn: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  endText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
});
