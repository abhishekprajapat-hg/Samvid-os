import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Glyph } from "../../components/ui/Glyph";
import { brand, brandStyles, layout, type as t } from "../../theme/brand";
import { LeaveSection } from "./components/LeaveSection";

/*
 * Leave, given its own page.
 *
 * It used to be a tab on the Attendance hub. The comp for that hub has no room
 * for one - it is a single scrolling day - so the balance, the request form and
 * the request list moved here, reached from the management menu in the header.
 * The panel itself is unchanged.
 */

export const AttendanceLeaveScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.pageTitle}>Leave</Text>
        <Text style={styles.pageSubtitle}>Balance and requests</Text>
      </View>

      {/*
       * LeaveSection draws no side padding of its own - it used to sit inside
       * the hub's `Screen`, which supplied it. This page has to.
       */}
      <View style={styles.panel}>
        <LeaveSection />
      </View>
    </SafeAreaView>
  );
};

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    header: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 8,
      paddingBottom: 4,
    },
    back: {
      marginBottom: 6,
    },
    pageTitle: {
      fontSize: t.pageTitle,
      lineHeight: 30,
      fontWeight: "700",
      letterSpacing: -0.8,
      color: b.text,
    },
    pageSubtitle: {
      marginTop: 2,
      fontSize: t.cardTitle,
      lineHeight: 18,
      color: b.textMuted,
    },
    panel: {
      flex: 1,
      paddingHorizontal: layout.gutter,
    },
  }),
);

export default AttendanceLeaveScreen;
