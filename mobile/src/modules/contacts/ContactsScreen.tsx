import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { AppSegmentedTabs } from "../../components/ui";
import { ContactDatabaseScreen } from "../inventory/components/ContactDatabaseScreen";
import { spacing } from "../../theme/tokens";
import { themedStyles } from "../../theme/themedStyles";

/*
 * The Contacts tab.
 *
 * Web keeps owners and brokers as two sidebar entries; the mobile comp gives
 * the bottom bar a single Contacts destination, so the two directories become
 * a switch inside one screen. Both halves are the same
 * ContactDatabaseScreen the standalone Owner and Broker routes render, so
 * there is one implementation of the directory, not three.
 */

const TABS = [
  { key: "OWNER", label: "Owners" },
  { key: "BROKER", label: "Brokers" },
];

const COPY = {
  OWNER: {
    title: "Contacts",
    blurb:
      "Every property owner on file, kept separately from whether their property is currently available. A property can go from available to rented and back; the owner record stays put. Phone number is the key, so re-saving a number updates that owner instead of creating a duplicate.",
  },
  BROKER: {
    title: "Contacts",
    blurb:
      "Brokers you work with, kept on file independently of any one deal. Phone number is the key, so re-saving a number updates that broker instead of creating a duplicate.",
  },
} as const;

export const ContactsScreen = () => {
  const [kind, setKind] = useState<"OWNER" | "BROKER">("OWNER");

  return (
    <ContactDatabaseScreen
      /*
       * Keyed on the kind so switching tabs remounts the directory. Without
       * it the new kind would render against the previous kind's rows until
       * its own fetch landed.
       */
      key={kind}
      kind={kind}
      title={COPY[kind].title}
      blurb={COPY[kind].blurb}
      above={
        <AppSegmentedTabs
          tabs={TABS}
          activeKey={kind}
          onChange={(next) => setKind(next as "OWNER" | "BROKER")}
          style={styles.tabs}
        />
      }
    />
  );
};

const styles = themedStyles(() => StyleSheet.create({
  tabs: {
    marginBottom: spacing.lg,
  },
}));

export default ContactsScreen;
