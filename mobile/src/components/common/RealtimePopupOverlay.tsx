import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRealtimeAlerts } from "../../context/RealtimeAlertsContext";

const iconForKind = (kind: "CHAT" | "CALL" | "NOTIFICATION") => {
  if (kind === "CALL") return "call";
  if (kind === "CHAT") return "chatbubble-ellipses";
  return "notifications";
};

export const RealtimePopupOverlay = () => {
  const { popupItems, dismissPopup } = useRealtimeAlerts();

  if (!popupItems.length) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {popupItems.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={iconForKind(item.kind)} size={14} color="#0f172a" />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={() => dismissPopup(item.id)} hitSlop={8}>
            <Ionicons name="close" size={14} color="#475569" />
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
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
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
    backgroundColor: "#e2e8f0",
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  message: {
    color: "#334155",
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
});
