import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../ui/Icon";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";

const iconForKind = (kind: "CHAT" | "CALL" | "NOTIFICATION") => {
  if (kind === "CALL") return "call";
  if (kind === "CHAT") return "chatbubble-ellipses";
  return "notifications";
};

export const RealtimePopupOverlay = () => {
  const { popupItems, dismissPopup, acceptCallPopup, rejectCallPopup } = useRealtimeAlerts();

  if (!popupItems.length) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {popupItems.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name={iconForKind(item.kind)} size={14} color="#161c24" />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
            {item.kind === "CALL" ? (
              <View style={styles.callActions}>
                <Pressable style={[styles.callBtn, styles.callReject]} onPress={() => rejectCallPopup(item.id)}>
                  <Text style={styles.callRejectText}>Reject</Text>
                </Pressable>
                <Pressable style={[styles.callBtn, styles.callAccept]} onPress={() => acceptCallPopup(item.id)}>
                  <Text style={styles.callAcceptText}>Accept</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <Pressable
            style={styles.closeBtn}
            onPress={() => (item.kind === "CALL" ? rejectCallPopup(item.id) : dismissPopup(item.id))}
            hitSlop={8}
          >
            <Icon name="close" size={14} color="#4e5867" />
          </Pressable>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    zIndex: 3000,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: "#c8d0dd",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    shadowColor: "#161c24",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 5,
  },
  iconWrap: {
    marginTop: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0e5ed",
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: "#161c24",
    fontSize: 13,
    fontWeight: "700",
  },
  message: {
    color: "#39424f",
    fontSize: 12,
    lineHeight: 16,
  },
  callActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  callBtn: {
    minWidth: 76,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  callReject: {
    borderColor: "#f6b8b5",
    backgroundColor: "#fdedec",
  },
  callAccept: {
    borderColor: "#6ecdaa",
    backgroundColor: "#cdeee0",
  },
  callRejectText: {
    color: "#942626",
    fontSize: 11,
    fontWeight: "700",
  },
  callAcceptText: {
    color: "#084f36",
    fontSize: 11,
    fontWeight: "700",
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f7fa",
    borderWidth: 1,
    borderColor: "#e0e5ed",
  },
});
