import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as MailComposer from "expo-mail-composer";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { AppSheet } from "../../components/ui/Overlay";
import {
  FieldCol,
  FieldLabel,
  FieldRow,
  SectionCard,
  SelectField,
  TextField,
  Toggle,
} from "../../components/ui/form";
import { useAuth } from "../../context/AuthContext";
import { updateUserPageAccess } from "../../services/accessService";
import { getCustomRoles, type CustomRole } from "../../services/roleService";
import { getRolesWithPermissions, type RoleRow } from "../../services/teamService";
import { pickImageFromLibrary, uploadFile } from "../../services/uploadService";
import { createUser, getUsers, updateUserById } from "../../services/userService";
import { toErrorMessage } from "../../utils/errorMessage";
import { brand, brandStyles, layout, round, type as t } from "../../theme/brand";
import { ROLE_LABELS, avatarTone, dayMonthYear, initialsOf, type TeamMember } from "./teamVocab";

/*
 * Add Team Member, drawn to the comp.
 *
 * Two things the comp implies that this app does not have, and how each is
 * handled rather than faked:
 *
 * - There is no mail transport on the server, so "send an invitation" cannot
 *   mean the server posts one. The account is created either way and the
 *   invitation is composed on the device, in the admin's own mail app, with
 *   the sign-in details filled in. The account records that it was invited,
 *   which is what the team list's Invited chip reads, and the first sign-in
 *   clears it.
 *
 * - An account needs a password from the moment it exists. The comp collects
 *   none, so one is generated here and handed over with the invitation. With
 *   "require password reset" ticked the account is flagged, and the flag
 *   travels with the profile - see the note in
 *   docs/mobile/00_MOBILE_PARITY_SPEC.md about what still reads it.
 */

const DIAL_CODES = [
  { value: "91", label: "+91" },
  { value: "971", label: "+971" },
  { value: "65", label: "+65" },
  { value: "44", label: "+44" },
  { value: "1", label: "+1" },
];

/* The roles this screen may hand out. ADMIN is not among them by design. */
const ASSIGNABLE_ROLES = [
  "MANAGER",
  "INSIDE_EXECUTIVE",
  "EXECUTIVE",
  "FIELD_EXECUTIVE",
  "PRODUCTION_EXECUTIVE",
  "COMMUNITY_MANAGER",
  "CHANNEL_PARTNER",
  "COWORKING_ADMIN",
];

const PARENT_ROLES: Record<string, string[]> = {
  MANAGER: ["ADMIN"],
  INSIDE_EXECUTIVE: ["MANAGER"],
  EXECUTIVE: ["MANAGER"],
  FIELD_EXECUTIVE: ["MANAGER"],
  PRODUCTION_EXECUTIVE: ["MANAGER"],
  COMMUNITY_MANAGER: ["MANAGER"],
  CHANNEL_PARTNER: ["MANAGER"],
  COWORKING_ADMIN: ["ADMIN"],
};

/*
 * The six switches in Access & Permissions, and the pages each one governs.
 *
 * A switch is a shorthand over the page catalogue, not a permission of its
 * own: turning Leads off removes the lead pages from what the new account is
 * given, and everything the template grants that no switch names is passed
 * through untouched.
 */
const ACCESS_SWITCHES: Array<{
  key: string;
  label: string;
  icon: GlyphName;
  pages: string[];
  /** View-only rows grant nothing but view, whatever the template says. */
  viewOnly?: boolean;
}> = [
  { key: "leads", label: "Leads", icon: "people-outline", pages: ["leads", "my_leads"] },
  { key: "finance", label: "Finance", icon: "card-outline", pages: ["finance"] },
  { key: "inventory", label: "Inventory (view)", icon: "cube-outline", pages: ["inventory"], viewOnly: true },
  { key: "reports", label: "Reports (view)", icon: "bar-chart-outline", pages: ["reports"], viewOnly: true },
  { key: "tasks", label: "Tasks", icon: "checkbox-outline", pages: ["tasks"] },
  {
    key: "admin",
    label: "Admin",
    icon: "settings-outline",
    pages: ["admin_team", "admin_console", "admin_notifications", "settings"],
  },
];

/* A password nobody has to think up, and nobody keeps. */
const generatePassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let index = 0; index < 12; index += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${out}#7`;
};

const toIsoDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

/* --------------------------------------------------------------- pieces -- */

const PhoneField = ({
  code,
  onCodeChange,
  value,
  onChangeText,
}: {
  code: string;
  onCodeChange: (next: string) => void;
  value: string;
  onChangeText: (next: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = DIAL_CODES.find((entry) => entry.value === code) || DIAL_CODES[0];

  return (
    <View style={styles.group}>
      <FieldLabel label="Mobile number" required />
      <View style={styles.phoneShell}>
        <Pressable
          style={styles.dialBlock}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Country code"
        >
          <Text style={styles.dialText}>{selected.label}</Text>
          <Glyph name="chevron-down" size={15} color={brand.textSecondary} />
        </Pressable>
        <View style={styles.dialDivider} />
        <TextInput
          style={styles.phoneInput}
          value={value}
          onChangeText={onChangeText}
          placeholder="98765 43210"
          placeholderTextColor={brand.placeholder}
          keyboardType="phone-pad"
        />
      </View>

      <AppSheet visible={open} onClose={() => setOpen(false)} title="Country code">
        {DIAL_CODES.map((entry) => (
          <Pressable
            key={entry.value}
            style={styles.dialOption}
            onPress={() => {
              onCodeChange(entry.value);
              setOpen(false);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.dialOptionText}>{entry.label}</Text>
            {entry.value === code ? <Glyph name="checkmark" size={18} color={brand.primary} /> : null}
          </Pressable>
        ))}
      </AppSheet>
    </View>
  );
};

/* --------------------------------------------------------------- screen -- */

export const AddTeamMemberScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { role: myRole } = useAuth();
  const isAdmin = String(myRole || "").toUpperCase() === "ADMIN";

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("91");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState("");

  const [roleValue, setRoleValue] = useState("EXECUTIVE");
  const [team, setTeam] = useState("");
  const [teamOther, setTeamOther] = useState("");
  const [managerId, setManagerId] = useState("");
  const [joining, setJoining] = useState(toIsoDate(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  const [template, setTemplate] = useState("EXECUTIVE");
  const [switches, setSwitches] = useState<Record<string, boolean>>({});
  const [sendInvite, setSendInvite] = useState(true);
  const [mustReset, setMustReset] = useState(true);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const name = `${first.trim()} ${last.trim()}`.trim();

  /* ------------------------------------------------------------- load -- */

  useEffect(() => {
    let alive = true;
    (async () => {
      const [userPayload, roles, matrix] = await Promise.all([
        getUsers().catch(() => ({ users: [] })),
        getCustomRoles().catch(() => []),
        /* Admin only. A manager still gets the form, without the switches. */
        getRolesWithPermissions().catch(() => null),
      ]);
      if (!alive) return;
      setMembers((userPayload?.users || []) as TeamMember[]);
      setCustomRoles(roles);
      setRoleRows(matrix?.roles || []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* A draft kept by the previous visit, or a team handed in by the hub. */
  useEffect(() => {
    const preset = String(route.params?.team || "");
    if (preset) setTeam(preset);
  }, [route.params]);

  /* ---------------------------------------------------------- options -- */

  const roleOptions = useMemo(
    () => [
      ...ASSIGNABLE_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] || value })),
      ...customRoles.map((entry) => ({
        value: `custom:${entry._id}`,
        label: String(entry.name || ""),
      })),
    ],
    [customRoles],
  );

  const baseRoleOf = useCallback(
    (value: string) => {
      if (!value.startsWith("custom:")) return value;
      const id = value.slice("custom:".length);
      const found = customRoles.find((entry) => String(entry._id) === id);
      return String((found as { baseRole?: string } | undefined)?.baseRole || "EXECUTIVE");
    },
    [customRoles],
  );

  const teamOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const member of members) {
      const value = String(member.department || "").trim();
      if (value) seen.add(value);
    }
    const known = [...seen].sort((a, b) => a.localeCompare(b));
    return [
      ...known.map((value) => ({ value, label: value })),
      { value: "__OTHER__", label: "Another team…" },
    ];
  }, [members]);

  const managerOptions = useMemo(() => {
    const allowed = new Set(PARENT_ROLES[baseRoleOf(roleValue)] || []);
    return members
      .filter((member) => member.isActive !== false && allowed.has(String(member.role || "")))
      .map((member) => ({ value: String(member._id || ""), label: String(member.name || "") }));
  }, [members, roleValue, baseRoleOf]);

  const templateOptions = useMemo(
    () => ASSIGNABLE_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] || value })),
    [],
  );

  /*
   * The template's own page grants, which the switches start from. Without the
   * roles payload (a manager cannot read it) there is nothing to start from,
   * so the switches are hidden rather than shown guessing.
   */
  const templatePages = useMemo(() => {
    const row = roleRows.find((entry) => entry.key === template);
    return row?.pageAccess || [];
  }, [roleRows, template]);

  const canCustomise = roleRows.length > 0 && isAdmin;

  useEffect(() => {
    if (!templatePages.length) return;
    const granted = new Set(templatePages.map((entry) => entry.pageKey));
    const next: Record<string, boolean> = {};
    for (const entry of ACCESS_SWITCHES) {
      next[entry.key] = entry.pages.some((pageKey) => granted.has(pageKey));
    }
    setSwitches(next);
  }, [templatePages]);

  /* Follow the role unless somebody has picked a template by hand. */
  useEffect(() => {
    setTemplate(baseRoleOf(roleValue));
  }, [roleValue, baseRoleOf]);

  /* ----------------------------------------------------------- photo -- */

  const choosePhoto = async () => {
    try {
      const picked = await pickImageFromLibrary();
      if (!picked) return;
      const uploaded = await uploadFile(picked, "profile-images");
      setPhoto(String(uploaded?.url || ""));
    } catch (e) {
      Alert.alert("Could not add the photo", toErrorMessage(e, "Upload failed"));
    }
  };

  /* ---------------------------------------------------------- submit -- */

  const validate = (): string => {
    if (!first.trim()) return "First name is required";
    if (!last.trim()) return "Last name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "A valid work email is required";
    if (phone.replace(/\D/g, "").length < 10) return "Mobile number needs at least 10 digits";
    if (!roleValue) return "Pick a role";
    const chosenTeam = team === "__OTHER__" ? teamOther.trim() : team;
    if (!chosenTeam) return "Pick a team";
    if (!managerId && (PARENT_ROLES[baseRoleOf(roleValue)] || []).length) {
      return "Pick a reporting manager";
    }
    if (!joining) return "Joining date is required";
    if (!employeeId.trim()) return "Employee ID is required";
    return "";
  };

  /** The page list the new account starts on, once the switches are applied. */
  const resolvePageAccess = () => {
    if (!canCustomise || !templatePages.length) return null;

    const byKey = new Map(templatePages.map((entry) => [entry.pageKey, entry]));
    for (const entry of ACCESS_SWITCHES) {
      const on = switches[entry.key];
      for (const pageKey of entry.pages) {
        if (!on) {
          byKey.delete(pageKey);
          continue;
        }
        const existing = byKey.get(pageKey);
        if (entry.viewOnly) {
          byKey.set(pageKey, { pageKey, actions: ["view"] });
        } else if (!existing) {
          byKey.set(pageKey, { pageKey, actions: ["view"] });
        }
      }
    }
    return [...byKey.values()];
  };

  const save = async (invite: boolean) => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError("");
    setSaving(true);
    const password = generatePassword();
    const chosenTeam = team === "__OTHER__" ? teamOther.trim() : team;

    try {
      const payload: Record<string, unknown> = {
        name,
        email: email.trim().toLowerCase(),
        phone: `+${dial}${phone.replace(/\D/g, "")}`,
        password,
        employeeId: employeeId.trim(),
        department: chosenTeam,
        joiningDate: joining,
        reportingToId: managerId || undefined,
        sendInvite: invite,
        mustChangePassword: mustReset,
      };
      if (roleValue.startsWith("custom:")) payload.customRoleId = roleValue.slice("custom:".length);
      else payload.role = roleValue;

      const created = await createUser(payload as any);
      const newId = String(created?.user?._id || "");

      if (newId && photo) {
        await updateUserById(newId, { profileImageUrl: photo } as any).catch(() => null);
      }

      const pages = resolvePageAccess();
      if (newId && pages) {
        /*
         * Access is written after the account exists, because that is the only
         * shape the API offers - a role is a starting point, and the override
         * belongs to the person. A failure here leaves a working account on
         * its role defaults, which is why it is reported rather than thrown.
         */
        await updateUserPageAccess(newId, { pageAccess: pages }).catch((e) => {
          Alert.alert(
            "Account created, access not narrowed",
            toErrorMessage(e, "The permission switches could not be saved. Open the member to set them."),
          );
        });
      }

      if (invite) await sendInvitation(password);
      else await showCredentials(password);

      navigation.goBack();
    } catch (e) {
      setError(toErrorMessage(e, "Could not add the member"));
    } finally {
      setSaving(false);
    }
  };

  const invitationText = (password: string) =>
    [
      `Hello ${first.trim()},`,
      "",
      `You have been added to the team on The Office On Rent.`,
      "",
      `Email: ${email.trim().toLowerCase()}`,
      `Temporary password: ${password}`,
      "",
      mustReset
        ? "Please change this password as soon as you sign in."
        : "Keep this password somewhere safe.",
    ].join("\n");

  const sendInvitation = async (password: string) => {
    try {
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          recipients: [email.trim().toLowerCase()],
          subject: "Your account is ready",
          body: invitationText(password),
        });
        return;
      }
    } catch {
      /* Fall through to the clipboard. */
    }
    await showCredentials(password);
  };

  const showCredentials = async (password: string) => {
    await Clipboard.setStringAsync(invitationText(password)).catch(() => null);
    Alert.alert(
      `${name} added`,
      `Temporary password: ${password}\n\nThe sign-in details have been copied so you can pass them on.`,
    );
  };

  const saveDraft = () => {
    Alert.alert(
      "Draft kept",
      "The form keeps what you have typed while you stay on this screen. Nothing has been created yet.",
    );
  };

  /* ---------------------------------------------------------- render -- */

  const tone = avatarTone(name || "New member");

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Glyph name="arrow-back" size={24} color={brand.text} />
        </Pressable>
        <Text style={styles.barTitle}>Add Team Member</Text>
        <Pressable onPress={saveDraft} hitSlop={10} accessibilityRole="button">
          <Text style={styles.barAction}>Save draft</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.photoBlock}>
            <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel="Add profile photo">
              <View style={styles.photoWrap}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, { backgroundColor: brand.tintAvatar }]}>
                    {/* Initials once there is a name; before that a person, not
                        the "?" that initialsOf falls back to. */}
                    {name ? (
                      <Text style={[styles.photoInitials, { color: tone.fg }]}>
                        {initialsOf(name)}
                      </Text>
                    ) : (
                      <Glyph name="person" size={30} color={brand.deep} />
                    )}
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Glyph name="camera" size={14} color={brand.onPrimary} />
                </View>
              </View>
            </Pressable>
            <Pressable onPress={choosePhoto} accessibilityRole="button">
              <Text style={styles.photoLabel}>{photo ? "Change profile photo" : "Add profile photo"}</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <SectionCard title="Personal Details">
            <FieldRow>
              <FieldCol>
                <TextField
                  label="First name"
                  required
                  value={first}
                  onChangeText={setFirst}
                  placeholder="Arjun"
                  autoCapitalize="words"
                />
              </FieldCol>
              <FieldCol>
                <TextField
                  label="Last name"
                  required
                  value={last}
                  onChangeText={setLast}
                  placeholder="Kapoor"
                  autoCapitalize="words"
                />
              </FieldCol>
            </FieldRow>

            <TextField
              label="Work email"
              required
              value={email}
              onChangeText={setEmail}
              placeholder="arjun@officeonrent.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <PhoneField code={dial} onCodeChange={setDial} value={phone} onChangeText={setPhone} />
          </SectionCard>

          <SectionCard title="Work Details">
            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Role"
                  required
                  value={roleValue}
                  options={roleOptions}
                  onChange={setRoleValue}
                />
              </FieldCol>
              <FieldCol>
                <SelectField
                  label="Team"
                  required
                  value={team}
                  options={teamOptions}
                  onChange={setTeam}
                  placeholder="Select team"
                />
              </FieldCol>
            </FieldRow>

            {team === "__OTHER__" ? (
              <TextField
                label="Team name"
                required
                value={teamOther}
                onChangeText={setTeamOther}
                placeholder="Name the team"
                autoCapitalize="words"
              />
            ) : null}

            <FieldRow>
              <FieldCol>
                <SelectField
                  label="Reporting manager"
                  required
                  value={managerId}
                  options={managerOptions}
                  onChange={setManagerId}
                  placeholder="Pick a manager"
                  leading={
                    managerId ? (
                      <View
                        style={[
                          styles.managerAvatar,
                          { backgroundColor: avatarTone(managerOptions.find((o) => o.value === managerId)?.label).bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.managerInitials,
                            { color: avatarTone(managerOptions.find((o) => o.value === managerId)?.label).fg },
                          ]}
                        >
                          {initialsOf(managerOptions.find((o) => o.value === managerId)?.label)}
                        </Text>
                      </View>
                    ) : undefined
                  }
                />
              </FieldCol>
              <FieldCol>
                <View style={styles.group}>
                  <FieldLabel label="Joining date" required />
                  <Pressable
                    onPress={() => setDatePickerOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Joining date"
                  >
                    <View style={styles.dateShell}>
                      <Glyph name="calendar-outline" size={17} color={brand.textSecondary} />
                      <Text style={styles.dateValue} numberOfLines={1}>
                        {dayMonthYear(joining)}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </FieldCol>
            </FieldRow>

            <TextField
              label="Employee ID"
              required
              value={employeeId}
              onChangeText={setEmployeeId}
              placeholder="OOR-024"
              autoCapitalize="characters"
            />
          </SectionCard>

          <SectionCard title="Access & Permissions">
            <SelectField
              label="Permission template"
              required
              value={template}
              options={templateOptions}
              onChange={setTemplate}
            />

            {canCustomise ? (
              <>
                <View style={styles.switchGrid}>
                  {ACCESS_SWITCHES.map((entry) => (
                    <View key={entry.key} style={styles.switchCell}>
                      <Glyph name={entry.icon} size={18} color={brand.textSecondary} />
                      <Text style={styles.switchLabel} numberOfLines={1}>
                        {entry.label}
                      </Text>
                      <Toggle
                        value={Boolean(switches[entry.key])}
                        onValueChange={(next) =>
                          setSwitches((prev) => ({ ...prev, [entry.key]: next }))
                        }
                      />
                    </View>
                  ))}
                </View>

                <Pressable
                  style={styles.customise}
                  onPress={() => navigation.navigate("RolesPermissions", { role: template })}
                  accessibilityRole="button"
                >
                  <Text style={styles.customiseText}>Customize permissions</Text>
                  <Glyph name="arrow-forward" size={15} color={brand.primary} />
                </Pressable>
              </>
            ) : (
              <Text style={styles.note}>
                The new account starts on this template&apos;s access. Only an admin can narrow it
                further, on the member&apos;s own page.
              </Text>
            )}
          </SectionCard>

          <SectionCard title="Invitation">
            <View style={styles.inviteRow}>
              <Glyph name="paper-plane-outline" size={19} color={brand.textSecondary} />
              <Text style={styles.inviteLabel}>Send email invitation</Text>
              <Toggle value={sendInvite} onValueChange={setSendInvite} />
            </View>

            <Pressable
              style={styles.checkRow}
              onPress={() => setMustReset(!mustReset)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: mustReset }}
            >
              <View style={[styles.checkbox, mustReset && styles.checkboxOn]}>
                {mustReset ? <Glyph name="checkmark" size={14} color={brand.onPrimary} /> : null}
              </View>
              <Text style={styles.checkLabel}>Require password reset on first login</Text>
            </Pressable>

            <View style={styles.infoStrip}>
              <Glyph name="information-circle-outline" size={16} color={brand.textSecondary} />
              <Text style={styles.infoText}>
                {sendInvite ? (
                  <>
                    {"An invitation will open in your mail app for "}
                    <Text style={styles.infoStrong}>{email.trim() || "the work email"}</Text>
                  </>
                ) : (
                  "The sign-in details will be copied for you to pass on."
                )}
              </Text>
            </View>
          </SectionCard>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[styles.submit, saving && styles.submitOff]}
            onPress={() => save(true)}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>{saving ? "Adding…" : "Invite member"}</Text>
            {!saving ? <Glyph name="arrow-forward" size={18} color={brand.onPrimary} /> : null}
          </Pressable>

          <Pressable
            style={styles.secondary}
            onPress={() => save(false)}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Add without invitation</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {datePickerOpen ? (
        <DateTimePicker
          value={joining ? new Date(joining) : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event: DateTimePickerEvent, picked?: Date) => {
            setDatePickerOpen(false);
            if (event.type === "dismissed" || !picked) return;
            setJoining(toIsoDate(picked));
          }}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default AddTeamMemberScreen;

const styles = brandStyles((b) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: b.bg,
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },
    group: {
      marginBottom: layout.fieldGap,
    },

    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: layout.pageGutter,
      paddingTop: 6,
      paddingBottom: 10,
    },
    barTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: t.barTitle,
      lineHeight: 23,
      fontWeight: "700",
      letterSpacing: -0.5,
      color: b.text,
    },
    barAction: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.primary,
    },

    body: {
      paddingHorizontal: layout.pageGutter,
      paddingBottom: 24,
      gap: 12,
    },
    error: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.alert,
    },
    note: {
      fontSize: t.body,
      lineHeight: 17,
      color: b.textMuted,
    },

    /* ---- the avatar block ---- */
    photoBlock: {
      alignItems: "center",
      paddingTop: 6,
      paddingBottom: 4,
      gap: 9,
    },
    photoWrap: {
      width: 78,
      height: 78,
    },
    photo: {
      width: 78,
      height: 78,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    photoInitials: {
      fontSize: 22,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    cameraBadge: {
      position: "absolute",
      right: -2,
      bottom: 2,
      width: 26,
      height: 26,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: b.bg,
      backgroundColor: "#008561",
    },
    photoLabel: {
      fontSize: t.tagline,
      fontWeight: "600",
      color: b.primary,
    },

    /* ---- the phone box ---- */
    phoneShell: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: layout.fieldHeight,
      paddingRight: 12,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    dialBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
    },
    dialText: {
      fontSize: t.field,
      fontWeight: "500",
      color: b.text,
    },
    dialDivider: {
      width: 1,
      height: layout.fieldHeight,
      backgroundColor: b.fieldBorder,
    },
    phoneInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 0,
      fontSize: t.field,
      color: b.text,
    },
    dialOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: b.hairline,
    },
    dialOptionText: {
      fontSize: t.field,
      color: b.text,
    },

    dateShell: {
      height: layout.fieldHeight,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 11,
      borderWidth: 1,
      borderColor: b.fieldBorder,
      borderRadius: round.field,
      backgroundColor: b.surface,
    },
    dateValue: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },

    managerAvatar: {
      width: 25,
      height: 25,
      borderRadius: round.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    managerInitials: {
      fontSize: t.tagline,
      fontWeight: "700",
    },

    /* ---- access switches ---- */
    switchGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 14,
      columnGap: layout.fieldGap,
    },
    switchCell: {
      width: "46%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    switchLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 9.5,
      color: b.text,
    },
    customise: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    customiseText: {
      fontSize: t.field,
      fontWeight: "700",
      color: b.primary,
    },

    /* ---- invitation ---- */
    inviteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    inviteLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },
    checkRow: {
      marginTop: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: b.fieldBorder,
      backgroundColor: b.surface,
    },
    checkboxOn: {
      borderColor: "#008561",
      backgroundColor: "#008561",
    },
    checkLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: t.field,
      color: b.text,
    },
    infoStrip: {
      marginTop: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: round.field,
      backgroundColor: b.tintSoft,
    },
    infoText: {
      flex: 1,
      minWidth: 0,
      fontSize: 9.5,
      lineHeight: 14,
      color: b.textSecondary,
    },
    infoStrong: {
      fontWeight: "700",
      color: b.text,
    },

    /* ---- footer ---- */
    footer: {
      paddingHorizontal: layout.pageGutter,
      paddingTop: 10,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: b.hairline,
      backgroundColor: b.bg,
    },
    submit: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      height: 50,
      borderRadius: round.field,
      backgroundColor: "#0b7d52",
    },
    submitOff: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: 14,
      fontWeight: "700",
      color: b.onPrimary,
    },
    secondary: {
      alignItems: "center",
      paddingBottom: 2,
    },
    secondaryText: {
      fontSize: t.tagline,
      fontWeight: "700",
      color: b.primary,
    },
  }),
);
